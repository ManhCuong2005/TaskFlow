'use strict';
// Integration suite. The existing connection guard requires an explicitly
// configured TEST_DATABASE_URL; never point it at the shared project database.
const request = require('supertest');
const jwt = require('jsonwebtoken');
const app = require('../src/app');
const pool = require('../src/database/connection');

const people = {};
let project;
let otherProject;
let task;
let assignment;
const auth = (name) => ({
  Authorization: `Bearer ${jwt.sign({ userId: people[name].id }, process.env.JWT_SECRET)}`
});
const permissions = (extra = {}) => ({
  can_update_status: true,
  can_comment: true,
  expected_version: 0,
  ...extra
});
const patch = (name, memberId, body, projectId = project.id) =>
  request(app)
    .patch(`/api/projects/${projectId}/members/${memberId}/permissions`)
    .set(auth(name))
    .send(body);

async function clearProjects() {
  const ids = Object.values(people).map((person) => person.id);
  await pool.query(
    'DELETE FROM task_comments WHERE task_id IN (SELECT id FROM tasks WHERE created_by = ANY($1::bigint[]))',
    [ids]
  );
  await pool.query(
    'DELETE FROM task_status_history WHERE assignment_id IN (SELECT a.id FROM task_assignments a JOIN tasks t ON t.id = a.task_id WHERE t.created_by = ANY($1::bigint[]))',
    [ids]
  );
  await pool.query(
    'DELETE FROM task_assignments WHERE task_id IN (SELECT id FROM tasks WHERE created_by = ANY($1::bigint[]))',
    [ids]
  );
  await pool.query('DELETE FROM tasks WHERE created_by = ANY($1::bigint[])', [
    ids
  ]);
  await pool.query('DELETE FROM projects WHERE lead_id = ANY($1::bigint[])', [
    ids
  ]);
}

beforeAll(async () => {
  process.env.JWT_SECRET = process.env.JWT_SECRET || 'isolated-test-secret';
  const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  for (const name of [
    'lead',
    'member',
    'colleague',
    'outsider',
    'admin',
    'inactive'
  ]) {
    const { rows } = await pool.query(
      `INSERT INTO users (full_name, email, password_hash, role, is_active)
       VALUES ($1, $2, 'integration-test-not-a-login-hash', $3, $4) RETURNING id`,
      [
        name,
        `leader-${name}-${suffix}@example.test`,
        name === 'admin' ? 'admin' : 'employee',
        name !== 'inactive'
      ]
    );
    people[name] = rows[0];
  }
});

beforeEach(async () => {
  await clearProjects();
  project = (
    await pool.query(
      "INSERT INTO projects (name,key,lead_id) VALUES ('Leader test','LDRTEST',$1) RETURNING *",
      [people.lead.id]
    )
  ).rows[0];
  otherProject = (
    await pool.query(
      "INSERT INTO projects (name,key,lead_id) VALUES ('Other project','OTHERTST',$1) RETURNING *",
      [people.outsider.id]
    )
  ).rows[0];
  for (const name of ['lead', 'member', 'colleague', 'inactive']) {
    await pool.query(
      'INSERT INTO project_members (project_id,user_id,role) VALUES ($1,$2,$3)',
      [project.id, people[name].id, name === 'lead' ? 'lead' : 'member']
    );
  }
  await pool.query(
    "INSERT INTO project_members (project_id,user_id,role) VALUES ($1,$2,'lead'),($1,$3,'member')",
    [otherProject.id, people.outsider.id, people.member.id]
  );
  const tasks = (
    await pool.query(
      `INSERT INTO tasks (title, project_id, created_by, due_date, priority, deleted_at) VALUES
      ('Overdue', $1, $2, NOW() - INTERVAL '1 day', 'medium', NULL),
      ('Completed', $1, $2, NOW() - INTERVAL '1 day', 'medium', NULL),
      ('Mixed status', $1, $2, NOW() + INTERVAL '1 day', 'high', NULL),
      ('Unassigned', $1, $2, NULL, 'low', NULL),
      ('Deleted', $1, $2, NOW() - INTERVAL '1 day', 'high', NOW()),
      ('Other project', $3, $4, NULL, 'medium', NULL) RETURNING id`,
      [project.id, people.lead.id, otherProject.id, people.outsider.id]
    )
  ).rows;
  task = tasks[0];
  assignment = (
    await pool.query(
      `INSERT INTO task_assignments (task_id,user_id,assigned_by,status,completed_at) VALUES
      ($1,$5,$7,'todo',NULL),($2,$5,$7,'completed',NOW()),
      ($3,$5,$7,'todo',NULL),($3,$6,$7,'completed',NOW()),
      ($4,$5,$7,'todo',NULL) RETURNING id`,
      [
        tasks[0].id,
        tasks[1].id,
        tasks[2].id,
        tasks[5].id,
        people.member.id,
        people.colleague.id,
        people.lead.id
      ]
    )
  ).rows[0];
});

afterAll(async () => {
  await clearProjects();
  await pool.query('DELETE FROM users WHERE id = ANY($1::bigint[])', [
    Object.values(people).map((person) => person.id)
  ]);
  await pool.end();
});

test('overview uses the whole project and derives mixed assignment statuses correctly', async () => {
  const response = await request(app)
    .get(`/api/projects/${project.id}/leader`)
    .set(auth('lead'))
    .expect(200);
  expect(response.body.data.summary).toEqual({
    total: 4,
    todo: 2,
    in_progress: 1,
    completed: 1,
    unassigned: 1,
    overdue: 1,
    due_soon: 1
  });
  expect(
    response.body.data.members.find((member) => member.id === people.member.id)
  ).toMatchObject({ assigned: 3, todo: 2, completed: 1, overdue: 1 });
  expect(
    response.body.data.attention.every((item) => item.project_id === project.id)
  ).toBe(true);
  expect(response.body.data.history).toEqual([]);
});

test.each(['member', 'colleague', 'outsider'])(
  '%s cannot read or mutate the Leader workspace',
  async (name) => {
    await request(app)
      .get(`/api/projects/${project.id}/leader`)
      .set(auth(name))
      .expect(403);
    await patch(
      name,
      people.member.id,
      permissions({ can_comment: false })
    ).expect(403);
  }
);

test('requires authentication and keeps system-wide administration with Admin', async () => {
  await request(app).get(`/api/projects/${project.id}/leader`).expect(401);
  await request(app)
    .get(`/api/projects/${project.id}/leader`)
    .set(auth('admin'))
    .expect(200);
  await request(app)
    .patch(`/api/users/${people.member.id}/status`)
    .set(auth('lead'))
    .send({ is_active: false })
    .expect(403);
});

test('persists permissions and audit history atomically without granting a system role', async () => {
  const changed = await patch(
    'lead',
    people.member.id,
    permissions({ can_comment: false, role: 'admin' })
  ).expect(200);
  expect(changed.body.data).toEqual({
    can_update_status: true,
    can_comment: false,
    permissions_version: 1
  });
  const overview = await request(app)
    .get(`/api/projects/${project.id}/leader`)
    .set(auth('lead'))
    .expect(200);
  expect(overview.body.data.history).toHaveLength(1);
  expect(overview.body.data.history[0]).toMatchObject({
    member_id: people.member.id,
    changed_by_name: 'lead',
    new_permissions: { can_update_status: true, can_comment: false }
  });
  expect(
    (await pool.query('SELECT role FROM users WHERE id=$1', [people.member.id]))
      .rows[0].role
  ).toBe('employee');
});

test('concurrent edits return one conflict rather than silently overwriting a saved change', async () => {
  const results = await Promise.all([
    patch('lead', people.member.id, permissions({ can_comment: false })),
    patch('lead', people.member.id, permissions({ can_update_status: false }))
  ]);
  expect(results.map((result) => result.status).sort()).toEqual([200, 409]);
  expect(
    (
      await pool.query(
        'SELECT count(*)::int AS count FROM project_permission_history WHERE project_id=$1',
        [project.id]
      )
    ).rows[0].count
  ).toBe(1);
});

test('no-op saves do not create misleading history or increment the version', async () => {
  const response = await patch('lead', people.member.id, permissions()).expect(
    200
  );
  expect(response.body.data.permissions_version).toBe(0);
  expect(
    (
      await pool.query(
        'SELECT count(*)::int AS count FROM project_permission_history WHERE project_id=$1',
        [project.id]
      )
    ).rows[0].count
  ).toBe(0);
});

test('protects the Lead, validates booleans/version, and rejects members outside the project', async () => {
  await patch('lead', people.lead.id, permissions()).expect(400);
  await patch('lead', people.outsider.id, permissions()).expect(404);
  await patch(
    'lead',
    people.member.id,
    permissions({ can_comment: 'false' })
  ).expect(422);
  await patch(
    'lead',
    people.member.id,
    permissions({ expected_version: -1 })
  ).expect(422);
  await patch('lead', people.member.id, {
    can_comment: true,
    can_update_status: true
  }).expect(422);
});

test('revocation is enforced on comments and both status endpoints; read access stays available', async () => {
  const comment = await request(app)
    .post(`/api/tasks/${task.id}/comments`)
    .set(auth('member'))
    .send({ content: 'Existing comment' })
    .expect(201);
  await patch(
    'lead',
    people.member.id,
    permissions({ can_update_status: false, can_comment: false })
  ).expect(200);
  await request(app)
    .post(`/api/tasks/${task.id}/comments`)
    .set(auth('member'))
    .send({ content: 'Blocked' })
    .expect(403);
  await request(app)
    .patch(`/api/tasks/${task.id}/comments/${comment.body.data.id}`)
    .set(auth('member'))
    .send({ content: 'Blocked edit' })
    .expect(403);
  await request(app)
    .patch(`/api/tasks/${task.id}/status`)
    .set(auth('member'))
    .send({ status: 'in_progress' })
    .expect(403);
  await request(app)
    .patch(`/api/tasks/${task.id}/assignments/${assignment.id}/status`)
    .set(auth('member'))
    .send({ status: 'in_progress' })
    .expect(403);
  await request(app)
    .get(`/api/tasks/${task.id}`)
    .set(auth('member'))
    .expect(200);
  await request(app)
    .get(`/api/tasks/${task.id}/comments`)
    .set(auth('member'))
    .expect(200);
  await request(app)
    .delete(`/api/tasks/${task.id}/comments/${comment.body.data.id}`)
    .set(auth('member'))
    .expect(200);
});

test('permissions are scoped to the project and can be restored', async () => {
  await patch(
    'lead',
    people.member.id,
    permissions({ can_comment: false })
  ).expect(200);
  const otherTask = (
    await pool.query('SELECT id FROM tasks WHERE project_id=$1', [
      otherProject.id
    ])
  ).rows[0];
  await request(app)
    .post(`/api/tasks/${otherTask.id}/comments`)
    .set(auth('member'))
    .send({ content: 'Allowed in other project' })
    .expect(201);
  await patch(
    'lead',
    people.member.id,
    permissions({ expected_version: 1 })
  ).expect(200);
  await request(app)
    .post(`/api/tasks/${task.id}/comments`)
    .set(auth('member'))
    .send({ content: 'Allowed again' })
    .expect(201);
});

test('Lead can update project progress; members cannot change another person’s assignments', async () => {
  await request(app)
    .patch(`/api/tasks/${task.id}/status`)
    .set(auth('colleague'))
    .send({ status: 'in_progress' })
    .expect(403);
  await request(app)
    .patch(`/api/tasks/${task.id}/assignments/${assignment.id}/status`)
    .set(auth('colleague'))
    .send({ status: 'in_progress' })
    .expect(403);
  await request(app)
    .patch(`/api/tasks/${task.id}/assignments/${assignment.id}/status`)
    .set(auth('lead'))
    .send({ status: 'in_progress' })
    .expect(200);
  await request(app)
    .patch(`/api/tasks/${task.id}/status`)
    .set(auth('lead'))
    .send({ status: 'completed' })
    .expect(200);
});

test('assigning or creating a task rejects outside/inactive recipients and accepts active members', async () => {
  await request(app)
    .post(`/api/tasks/${task.id}/assignments`)
    .set(auth('lead'))
    .send({ assignee_ids: [people.outsider.id] })
    .expect(403);
  await request(app)
    .post(`/api/tasks/${task.id}/assignments`)
    .set(auth('lead'))
    .send({ assignee_ids: [people.inactive.id] })
    .expect(403);
  await request(app)
    .post('/api/tasks')
    .set(auth('lead'))
    .send({
      title: 'Wrong recipient',
      project_id: project.id,
      assignee_ids: [people.outsider.id]
    })
    .expect(403);
  await request(app)
    .post('/api/tasks')
    .set(auth('lead'))
    .send({
      title: 'No due date',
      project_id: project.id,
      due_date: null,
      assignee_ids: [people.colleague.id]
    })
    .expect(201);
  await request(app)
    .post(`/api/tasks/${task.id}/assignments`)
    .set(auth('lead'))
    .send({ assignee_ids: [people.colleague.id] })
    .expect(201);
});

test('removed members cannot keep writing via a stale active assignment', async () => {
  await pool.query(
    'DELETE FROM project_members WHERE project_id=$1 AND user_id=$2',
    [project.id, people.member.id]
  );
  await request(app)
    .patch(`/api/tasks/${task.id}/status`)
    .set(auth('member'))
    .send({ status: 'in_progress' })
    .expect(403);
  await request(app)
    .post(`/api/tasks/${task.id}/comments`)
    .set(auth('member'))
    .send({ content: 'Stale membership' })
    .expect(403);
});

test('pending invitation lists are private to project managers', async () => {
  await request(app)
    .get(`/api/projects/${project.id}/invitations`)
    .set(auth('colleague'))
    .expect(403);
  await request(app)
    .get(`/api/projects/${project.id}/invitations`)
    .set(auth('lead'))
    .expect(200);
});

test('project statistics reject callers outside the project and invalid project IDs', async () => {
  await request(app)
    .get(`/api/tasks/stats?project_id=${project.id}`)
    .set(auth('outsider'))
    .expect(403);
  await request(app)
    .get(`/api/tasks/stats?project_id=${project.id}`)
    .set(auth('lead'))
    .expect(200);
  await request(app)
    .get('/api/tasks/stats?project_id=invalid')
    .set(auth('lead'))
    .expect(422);
});
