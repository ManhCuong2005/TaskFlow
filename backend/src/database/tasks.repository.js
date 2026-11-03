'use strict';
const pool = require('./connection');
const { NotFoundError, ForbiddenError, AppError } = require('../utils/errors');
const { requireTaskPermission, requireProjectAssignees, requireProjectAccess } = require('./projectAccess');

const OVERALL_STATUS_SQL = `(
  SELECT CASE
    WHEN COUNT(*) FILTER (WHERE ta.assignment_status = 'active') = 0 THEN 'unassigned'
    WHEN COUNT(*) FILTER (WHERE ta.assignment_status = 'active' AND ta.status != 'todo') = 0 THEN 'todo'
    WHEN COUNT(*) FILTER (WHERE ta.assignment_status = 'active' AND ta.status != 'completed') = 0 THEN 'completed'
    ELSE 'in_progress'
  END
  FROM task_assignments ta
  WHERE ta.task_id = t.id
)`;

async function getTaskOverallStatus(taskId, client = pool) {
  const { rows } = await client.query(
    `SELECT ${OVERALL_STATUS_SQL} AS overall_status FROM tasks t WHERE t.id = $1`,
    [taskId]
  );
  return rows[0]?.overall_status || 'unassigned';
}

async function canAccessTask(taskId, user, client = pool) {
  const { rows } = await client.query(
    `SELECT (
       $2 = 'admin'
       OR t.created_by = $3
       OR EXISTS (
         SELECT 1 FROM task_assignments ta
         WHERE ta.task_id = t.id AND ta.user_id = $3 AND ta.assignment_status = 'active'
       )
       OR EXISTS (
         SELECT 1 FROM projects p
         WHERE p.id = t.project_id AND p.lead_id = $3
       )
       OR EXISTS (
         SELECT 1 FROM project_members pm
         WHERE pm.project_id = t.project_id AND pm.user_id = $3
       )
     ) AS can_access
     FROM tasks t
     WHERE t.id = $1 AND t.deleted_at IS NULL`,
    [taskId, user.role, user.id]
  );
  if (rows.length === 0) throw new NotFoundError('Task not found');
  return rows[0].can_access;
}

async function createTask({ title, description, priority, due_date, created_by, assignee_ids = [], project_id, userRole }) {
  if (!Array.isArray(assignee_ids)) {
    throw new AppError('assignee_ids must be an array', 400);
  }
  if (new Set(assignee_ids.map(String)).size !== assignee_ids.length) {
    throw new AppError('assignee_ids must not contain duplicates', 400);
  }

  // Enforce Project Lead permission: only Project Lead (or admin) can create issues
  if (project_id) {
    const { rows: projRows } = await pool.query(
      'SELECT id, name, lead_id FROM projects WHERE id = $1',
      [project_id]
    );
    if (projRows.length === 0) {
      throw new NotFoundError('Project not found');
    }
    const project = projRows[0];
    if (userRole !== 'admin' && String(project.lead_id) !== String(created_by)) {
      throw new ForbiddenError(`Chỉ Project Lead mới có quyền tạo Issue/Task trong dự án này (${project.name})`);
    }
  }

  // If no assignees are specified, default to the creator
  const effectiveAssigneeIds = (Array.isArray(assignee_ids) && assignee_ids.length > 0)
    ? assignee_ids
    : [created_by];

  const dbClient = await pool.connect();
  try {
    await dbClient.query('BEGIN');
    await requireProjectAssignees(project_id, effectiveAssigneeIds, dbClient);
    const userIdsToLock = [...new Set([...effectiveAssigneeIds, created_by].map(String))];
    const { rows: lockedUsers } = await dbClient.query(
      `SELECT id, is_active
       FROM users
       WHERE id = ANY($1::bigint[])
       ORDER BY id
       FOR SHARE`,
      [userIdsToLock]
    );
    const activeUserIds = new Set(lockedUsers.filter((row) => row.is_active).map((row) => String(row.id)));
    if (!activeUserIds.has(String(created_by))) {
      throw new ForbiddenError('Your account is inactive');
    }
    if (effectiveAssigneeIds.some((userId) => !activeUserIds.has(String(userId)))) {
      throw new NotFoundError('One or more assignee users not found or inactive');
    }

    const { rows } = await dbClient.query(
      `INSERT INTO tasks (title, description, priority, due_date, created_by, project_id)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [title, description || null, priority || 'medium', due_date || null, created_by, project_id || null]
    );
    const task = rows[0];

    for (const userId of effectiveAssigneeIds) {
      const aResult = await dbClient.query(
        `INSERT INTO task_assignments (task_id, user_id, assigned_by, status, assignment_status)
         VALUES ($1, $2, $3, 'todo', 'active')
         RETURNING id`,
        [task.id, userId, created_by]
      );
      await dbClient.query(
        `INSERT INTO task_status_history (assignment_id, changed_by, old_status, new_status, note)
         VALUES ($1, $2, NULL, 'todo', 'Initial assignment')`,
        [aResult.rows[0].id, created_by]
      );
    }

    await dbClient.query('COMMIT');
    return task;
  } catch (err) {
    await dbClient.query('ROLLBACK');
    throw err;
  } finally {
    dbClient.release();
  }
}

async function getTasks(user, { page = 1, limit = 20, search, status, priority, assignee_id, due_after, due_before, created_by, project_id } = {}) {
  const offset = (page - 1) * limit;
  const conditions = ['t.deleted_at IS NULL'];
  const params = [];
  let i = 1;

  // Authorization filter: employees only see tasks where they are creator, assignee, or member of the project
  if (user.role === 'employee') {
    conditions.push(`(
      t.created_by = $${i}
      OR EXISTS (
        SELECT 1 FROM task_assignments ta WHERE ta.task_id = t.id AND ta.user_id = $${i} AND ta.assignment_status = 'active'
      )
      OR EXISTS (
        SELECT 1 FROM project_members pm WHERE pm.project_id = t.project_id AND pm.user_id = $${i}
      )
    )`);
    params.push(user.id);
    i++;
  }

  if (project_id) {
    conditions.push(`t.project_id = $${i++}`);
    params.push(project_id);
  }

  if (search) {
    conditions.push(`(t.title ILIKE $${i} OR t.description ILIKE $${i} OR CAST(t.id AS text) ILIKE $${i} OR (COALESCE(p.key, 'TF') || '-' || CAST(t.id AS text)) ILIKE $${i})`);
    params.push(`%${search}%`);
    i++;
  }
  if (priority) { conditions.push(`t.priority = $${i++}`); params.push(priority); }
  if (due_after) { conditions.push(`t.due_date >= $${i++}`); params.push(due_after); }
  if (due_before) {
    if (/^\d{4}-\d{2}-\d{2}$/.test(due_before)) {
      conditions.push(`t.due_date < ($${i++}::date + INTERVAL '1 day')`);
    } else {
      conditions.push(`t.due_date <= $${i++}`);
    }
    params.push(due_before);
  }
  if (created_by && user.role === 'admin') { conditions.push(`t.created_by = $${i++}`); params.push(created_by); }
  if (assignee_id) {
    conditions.push(`EXISTS (SELECT 1 FROM task_assignments ta2 WHERE ta2.task_id = t.id AND ta2.user_id = $${i++} AND ta2.assignment_status = 'active')`);
    params.push(assignee_id);
  }

  const where = 'WHERE ' + conditions.join(' AND ');

  const baseQuery = `
    SELECT t.id, t.title, t.description, t.priority, t.due_date,
           t.created_by, t.created_at, t.updated_at, t.project_id,
           u.full_name AS creator_name,
           p.name AS project_name,
           COALESCE(p.key, 'TF') AS project_key,
           p.lead_id AS project_lead_id,
           ${OVERALL_STATUS_SQL} AS overall_status,
           COALESCE((
             SELECT json_agg(json_build_object(
               'id', u2.id,
               'full_name', u2.full_name,
               'email', u2.email,
               'status', ta2.status,
               'assignment_id', ta2.id
             ))
             FROM task_assignments ta2
             JOIN users u2 ON u2.id = ta2.user_id
             WHERE ta2.task_id = t.id AND ta2.assignment_status = 'active'
           ), '[]'::json) AS assignees
    FROM tasks t
    JOIN users u ON u.id = t.created_by
    LEFT JOIN projects p ON p.id = t.project_id
    ${where}
  `;

  let finalQuery = baseQuery;
  let finalParams = [...params];

  if (status && status !== 'all') {
    finalQuery = `SELECT * FROM (${baseQuery}) sub WHERE sub.overall_status = $${i}`;
    finalParams = [...params, status];
    const countInner = `SELECT COUNT(*) FROM (${baseQuery}) sub WHERE sub.overall_status = $${i}`;
    const [{ rows: tasks }, { rows: countRows }] = await Promise.all([
      pool.query(`${finalQuery} ORDER BY created_at DESC LIMIT $${i + 1} OFFSET $${i + 2}`, [...finalParams, limit, offset]),
      pool.query(countInner, [...params, status]),
    ]);
    return { tasks, total: parseInt(countRows[0].count), page, limit };
  }

  const [{ rows: tasks }, { rows: countRows }] = await Promise.all([
    pool.query(`${finalQuery} ORDER BY created_at DESC LIMIT $${i} OFFSET $${i + 1}`, [...params, limit, offset]),
    pool.query(`SELECT COUNT(*) FROM tasks t JOIN users u ON u.id = t.created_by ${where}`, params),
  ]);

  return { tasks, total: parseInt(countRows[0].count), page, limit };
}

async function getTaskById(taskId, user) {
  const access = await canAccessTask(taskId, user);
  if (!access) throw new ForbiddenError('Access denied');

  const { rows } = await pool.query(
    `SELECT t.*, u.full_name AS creator_name,
     p.name AS project_name, COALESCE(p.key, 'TF') AS project_key, p.lead_id AS project_lead_id,
     ${OVERALL_STATUS_SQL} AS overall_status,
     COALESCE((
       SELECT json_agg(json_build_object(
         'id', u2.id,
         'full_name', u2.full_name,
         'email', u2.email,
         'status', ta2.status,
         'assignment_id', ta2.id
       ))
       FROM task_assignments ta2
       JOIN users u2 ON u2.id = ta2.user_id
       WHERE ta2.task_id = t.id AND ta2.assignment_status = 'active'
     ), '[]'::json) AS assignees
     FROM tasks t
     JOIN users u ON u.id = t.created_by
     LEFT JOIN projects p ON p.id = t.project_id
     WHERE t.id = $1 AND t.deleted_at IS NULL`,
    [taskId]
  );
  if (rows.length === 0) throw new NotFoundError('Task not found');
  return rows[0];
}

async function updateTask(taskId, user, updates) {
  const task = await getTaskById(taskId, user);
  const isLead = task.project_lead_id && String(task.project_lead_id) === String(user.id);
  const isAdmin = user.role === 'admin';
  if (!isAdmin && !isLead) {
    throw new ForbiddenError('Chỉ Project Lead hoặc Admin mới có quyền chỉnh sửa task này. Thành viên không có quyền chỉnh sửa');
  }
  const allowed = ['title', 'description', 'priority', 'due_date'];
  const fields = [];
  const params = [];
  let i = 1;
  for (const key of allowed) {
    if (updates[key] !== undefined) {
      fields.push(`${key} = $${i++}`);
      params.push(updates[key]);
    }
  }
  if (fields.length === 0) throw new AppError('No valid fields to update', 400);
  fields.push(`updated_at = NOW()`);
  params.push(taskId);
  const { rows } = await pool.query(
    `UPDATE tasks SET ${fields.join(', ')} WHERE id = $${i} AND deleted_at IS NULL RETURNING *`,
    params
  );
  if (rows.length === 0) throw new NotFoundError('Task not found');
  return rows[0];
}

async function deleteTask(taskId, user) {
  const task = await getTaskById(taskId, user);
  const isLead = task.project_lead_id && String(task.project_lead_id) === String(user.id);
  const isAdmin = user.role === 'admin';
  if (!isAdmin && !isLead) {
    throw new ForbiddenError('Chỉ Project Lead hoặc Admin mới có quyền xóa task. Thành viên không được phép xóa task');
  }
  const { rows } = await pool.query(
    `UPDATE tasks SET deleted_at = NOW(), updated_at = NOW() WHERE id = $1 AND deleted_at IS NULL RETURNING id`,
    [taskId]
  );
  if (rows.length === 0) throw new NotFoundError('Task not found or already deleted');
  return { id: taskId, deleted: true };
}

async function updateTaskStatus(taskId, user, targetStatus) {
  if (!['todo', 'in_progress', 'completed'].includes(targetStatus)) {
    throw new AppError('Invalid status. Must be todo, in_progress, or completed', 400);
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows: taskRows } = await client.query(
      'SELECT id, created_by, project_id FROM tasks WHERE id = $1 AND deleted_at IS NULL FOR UPDATE',
      [taskId]
    );
    if (taskRows.length === 0) throw new NotFoundError('Task not found');
    const task = taskRows[0];
    const { isLead } = await requireTaskPermission(taskId, user, 'can_update_status', client);

    const { rows: activeAssignments } = await client.query(
      `SELECT * FROM task_assignments WHERE task_id = $1 AND assignment_status = 'active'`,
      [taskId]
    );

    const isAssignee = activeAssignments.some(a => String(a.user_id) === String(user.id));
    const isCreator = String(task.created_by) === String(user.id);
    const isAdmin = user.role === 'admin';

    const canManage = isAdmin || isLead || (!task.project_id && isCreator);
    if (!canManage && !isAssignee) {
      throw new ForbiddenError('You do not have permission to change the status of this task');
    }

    if (activeAssignments.length === 0) {
      const completedAt = targetStatus === 'completed' ? 'NOW()' : 'NULL';
      const { rows: newAssign } = await client.query(
        `INSERT INTO task_assignments (task_id, user_id, assigned_by, status, assignment_status, completed_at)
         VALUES ($1, $2, $3, $4, 'active', ${completedAt})
         RETURNING *`,
        [taskId, user.id, user.id, targetStatus]
      );
      await client.query(
        `INSERT INTO task_status_history (assignment_id, changed_by, old_status, new_status, note)
         VALUES ($1, $2, NULL, $3, 'Claimed task via Kanban board')`,
        [newAssign[0].id, user.id, targetStatus]
      );
    } else {
      const assignmentsToUpdate = canManage
        ? activeAssignments
        : activeAssignments.filter(a => String(a.user_id) === String(user.id));

      const list = assignmentsToUpdate;
      for (const a of list) {
        if (a.status !== targetStatus) {
          const completedAt = targetStatus === 'completed' ? 'NOW()' : 'NULL';
          await client.query(
            `UPDATE task_assignments
             SET status = $1, completed_at = ${completedAt}, updated_at = NOW()
             WHERE id = $2`,
            [targetStatus, a.id]
          );
          await client.query(
            `INSERT INTO task_status_history (assignment_id, changed_by, old_status, new_status, note)
             VALUES ($1, $2, $3, $4, 'Status updated via Kanban board')`,
            [a.id, user.id, a.status, targetStatus]
          );
        }
      }
    }

    await client.query('COMMIT');
    return await getTaskById(taskId, user);
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

async function getTaskStats(user, projectId = null) {
  if (projectId) await requireProjectAccess(projectId, user);
  const conditions = ['t.deleted_at IS NULL'];
  const params = [];
  let i = 1;

  if (projectId) {
    conditions.push(`t.project_id = $${i++}`);
    params.push(projectId);
  } else if (user.role === 'employee') {
    conditions.push(`(t.created_by = $${i} OR EXISTS (SELECT 1 FROM task_assignments ta WHERE ta.task_id = t.id AND ta.user_id = $${i} AND ta.assignment_status = 'active'))`);
    params.push(user.id);
    i++;
  }

  const whereClause = conditions.join(' AND ');

  const query = `
    WITH user_tasks AS (
      SELECT t.id, t.priority, t.due_date, t.created_by,
             ${OVERALL_STATUS_SQL} AS overall_status
      FROM tasks t
      WHERE ${whereClause}
    )
    SELECT
      COUNT(*)::int AS total,
      COUNT(*) FILTER (WHERE overall_status = 'todo' OR overall_status = 'unassigned')::int AS todo,
      COUNT(*) FILTER (WHERE overall_status = 'in_progress')::int AS in_progress,
      COUNT(*) FILTER (WHERE overall_status = 'completed')::int AS completed,
      COUNT(*) FILTER (WHERE overall_status = 'unassigned')::int AS unassigned,
      COUNT(*) FILTER (WHERE priority = 'high')::int AS high_priority,
      COUNT(*) FILTER (WHERE priority = 'medium')::int AS medium_priority,
      COUNT(*) FILTER (WHERE priority = 'low')::int AS low_priority,
      COUNT(*) FILTER (WHERE due_date < NOW() AND overall_status != 'completed')::int AS overdue
    FROM user_tasks;
  `;
  const { rows } = await pool.query(query, params);
  return rows[0] || {};
}

module.exports = {
  createTask,
  getTasks,
  getTaskById,
  updateTask,
  deleteTask,
  updateTaskStatus,
  getTaskStats,
  canAccessTask,
  getTaskOverallStatus
};
