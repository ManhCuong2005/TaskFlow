'use strict';
const pool = require('./connection');
const { AppError, NotFoundError, ForbiddenError, ConflictError } = require('../utils/errors');
const { requireProjectLead } = require('./projectAccess');

async function getProjects(user) {
  let query;
  let params = [];

  if (user.role === 'admin') {
    // Admin can view all projects in the system for system administration
    query = `
      SELECT p.*, u.full_name AS lead_name, u.email AS lead_email,
             COUNT(DISTINCT pm.user_id)::int AS member_count,
             COUNT(DISTINCT t.id)::int AS task_count
      FROM projects p
      JOIN users u ON u.id = p.lead_id
      LEFT JOIN project_members pm ON pm.project_id = p.id
      LEFT JOIN tasks t ON t.project_id = p.id AND t.deleted_at IS NULL
      GROUP BY p.id, u.full_name, u.email
      ORDER BY p.created_at DESC
    `;
  } else {
    // Normal user sees projects where they are Lead or Member
    query = `
      SELECT p.*, u.full_name AS lead_name, u.email AS lead_email,
             COUNT(DISTINCT pm2.user_id)::int AS member_count,
             COUNT(DISTINCT t.id)::int AS task_count,
             (p.lead_id = $1) AS is_lead
      FROM projects p
      JOIN users u ON u.id = p.lead_id
      JOIN project_members pm ON pm.project_id = p.id AND pm.user_id = $1
      LEFT JOIN project_members pm2 ON pm2.project_id = p.id
      LEFT JOIN tasks t ON t.project_id = p.id AND t.deleted_at IS NULL
      GROUP BY p.id, u.full_name, u.email
      ORDER BY p.created_at DESC
    `;
    params = [user.id];
  }

  const { rows } = await pool.query(query, params);
  return rows;
}

async function getProjectById(projectId, user) {
  const { rows } = await pool.query(
    `SELECT p.*, u.full_name AS lead_name, u.email AS lead_email,
            (p.lead_id = $2) AS is_lead
     FROM projects p
     JOIN users u ON u.id = p.lead_id
     WHERE p.id = $1`,
    [projectId, user.id]
  );
  if (rows.length === 0) throw new NotFoundError('Project not found');
  const project = rows[0];

  // Check access if not admin
  if (user.role !== 'admin') {
    const { rows: memberRows } = await pool.query(
      `SELECT 1 FROM project_members WHERE project_id = $1 AND user_id = $2`,
      [projectId, user.id]
    );
    if (memberRows.length === 0 && project.lead_id !== user.id) {
      throw new ForbiddenError('You are not a member of this project');
    }
  }

  // Fetch members
  const { rows: members } = await pool.query(
    `SELECT u.id, u.full_name, u.email, u.is_active, u.role AS system_role, pm.role AS project_role, pm.joined_at,
       COALESCE((to_jsonb(pm)->>'can_update_status')::boolean, TRUE) AS can_update_status,
       COALESCE((to_jsonb(pm)->>'can_comment')::boolean, TRUE) AS can_comment
     FROM project_members pm
     JOIN users u ON u.id = pm.user_id
     WHERE pm.project_id = $1
     ORDER BY CASE WHEN pm.role = 'lead' THEN 0 ELSE 1 END, u.full_name ASC`,
    [projectId]
  );

  project.members = members;
  return project;
}

async function createProject({ name, key, description }, user) {
  if (!name || !key) {
    throw new AppError('Project name and key are required', 400);
  }
  const cleanKey = key.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (cleanKey.length < 2 || cleanKey.length > 10) {
    throw new AppError('Project key must be 2 to 10 uppercase letters/numbers', 400);
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Check key collision
    const { rows: existing } = await client.query(
      'SELECT id FROM projects WHERE key = $1',
      [cleanKey]
    );
    if (existing.length > 0) {
      throw new ConflictError(`Project with key '${cleanKey}' already exists`);
    }

    // The user who clicks Create Project is recorded as Project Lead!
    const { rows: projRows } = await client.query(
      `INSERT INTO projects (name, key, description, lead_id)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [name.trim(), cleanKey, description?.trim() || null, user.id]
    );
    const project = projRows[0];

    // Add creator as lead in project_members
    await client.query(
      `INSERT INTO project_members (project_id, user_id, role)
       VALUES ($1, $2, 'lead')`,
      [project.id, user.id]
    );

    await client.query('COMMIT');
    project.lead_name = user.full_name;
    project.is_lead = true;
    return project;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

async function addProjectMember(projectId, memberUserId, user) {
  const project = await getProjectById(projectId, user);
  if (user.role !== 'admin' && String(project.lead_id) !== String(user.id)) {
    throw new ForbiddenError('Only the Project Lead or System Admin can add members to this project');
  }

  const { rows: userExists } = await pool.query('SELECT id, full_name, email FROM users WHERE id = $1', [memberUserId]);
  if (userExists.length === 0) throw new NotFoundError('User not found');

  const { rows } = await pool.query(
    `INSERT INTO project_members (project_id, user_id, role)
     VALUES ($1, $2, 'member')
     ON CONFLICT (project_id, user_id) DO NOTHING
     RETURNING *`,
    [projectId, memberUserId]
  );
  return { added: true, user: userExists[0] };
}

async function removeProjectMember(projectId, memberUserId, user) {
  const project = await getProjectById(projectId, user);
  if (user.role !== 'admin' && String(project.lead_id) !== String(user.id)) {
    throw new ForbiddenError('Only the Project Lead or System Admin can remove members');
  }
  if (String(project.lead_id) === String(memberUserId)) {
    throw new AppError('Cannot remove the Project Lead from the project', 400);
  }

  await pool.query(
    `DELETE FROM project_members WHERE project_id = $1 AND user_id = $2`,
    [projectId, memberUserId]
  );
  return { removed: true };
}

async function deleteProject(projectId, user) {
  const project = await getProjectById(projectId, user);
  const isLead = String(project.lead_id) === String(user.id);
  const isAdmin = user.role === 'admin';
  if (!isAdmin && !isLead) {
    throw new ForbiddenError('Chỉ Project Lead hoặc Quản trị viên mới có quyền xóa dự án');
  }

  // Soft delete all tasks in the project
  await pool.query('UPDATE tasks SET deleted_at = NOW() WHERE project_id = $1 AND deleted_at IS NULL', [projectId]);

  const { rowCount } = await pool.query('DELETE FROM projects WHERE id = $1', [projectId]);
  if (rowCount === 0) throw new NotFoundError('Project not found');
  return { id: projectId, deleted: true };
}

async function inviteProjectMember(projectId, inviteeId, inviterUser) {
  const project = await getProjectById(projectId, inviterUser);
  if (inviterUser.role !== 'admin' && String(project.lead_id) !== String(inviterUser.id)) {
    throw new ForbiddenError('Only the Project Lead or System Admin can invite members');
  }

  const { rows: userRows } = await pool.query(
    'SELECT id, full_name, email, is_active FROM users WHERE id = $1',
    [inviteeId]
  );
  if (userRows.length === 0 || !userRows[0].is_active) {
    throw new NotFoundError('User not found or inactive');
  }
  const invitee = userRows[0];

  // Check if already a member
  const { rows: memberRows } = await pool.query(
    'SELECT 1 FROM project_members WHERE project_id = $1 AND user_id = $2',
    [projectId, inviteeId]
  );
  if (memberRows.length > 0) {
    throw new ConflictError(`${invitee.full_name} is already a member of this project`);
  }

  // Check if pending invitation exists
  const { rows: pendingRows } = await pool.query(
    `SELECT id FROM project_invitations WHERE project_id = $1 AND invitee_id = $2 AND status = 'pending'`,
    [projectId, inviteeId]
  );
  if (pendingRows.length > 0) {
    throw new ConflictError(`An invitation is already pending for ${invitee.full_name}`);
  }

  const { rows } = await pool.query(
    `INSERT INTO project_invitations (project_id, inviter_id, invitee_id, status)
     VALUES ($1, $2, $3, 'pending')
     RETURNING *`,
    [projectId, inviterUser.id, inviteeId]
  );

  return {
    ...rows[0],
    invitee_name: invitee.full_name,
    invitee_email: invitee.email,
  };
}

async function getProjectPendingInvitations(projectId, user) {
  await requireProjectLead(projectId, user);
  const { rows } = await pool.query(
    `SELECT pi.id, pi.project_id, pi.status, pi.created_at,
            u.id AS invitee_id, u.full_name AS invitee_name, u.email AS invitee_email,
            inv.full_name AS inviter_name
     FROM project_invitations pi
     JOIN users u ON u.id = pi.invitee_id
     JOIN users inv ON inv.id = pi.inviter_id
     WHERE pi.project_id = $1 AND pi.status = 'pending'
     ORDER BY pi.created_at DESC`,
    [projectId]
  );
  return rows;
}

async function cancelInvitation(invitationId, user) {
  const { rows } = await pool.query(
    `SELECT pi.*, p.lead_id FROM project_invitations pi
     JOIN projects p ON p.id = pi.project_id
     WHERE pi.id = $1`,
    [invitationId]
  );
  if (rows.length === 0) throw new NotFoundError('Invitation not found');
  const invite = rows[0];

  if (user.role !== 'admin' && String(invite.lead_id) !== String(user.id) && String(invite.inviter_id) !== String(user.id)) {
    throw new ForbiddenError('Only the Project Lead or Inviter can cancel this invitation');
  }

  await pool.query(`DELETE FROM project_invitations WHERE id = $1`, [invitationId]);
  return { cancelled: true };
}

async function getMyPendingInvitations(userId) {
  const { rows } = await pool.query(
    `SELECT pi.id, pi.project_id, pi.status, pi.created_at,
            p.name AS project_name, p.key AS project_key, p.description AS project_description,
            u.full_name AS inviter_name, u.email AS inviter_email
     FROM project_invitations pi
     JOIN projects p ON p.id = pi.project_id
     JOIN users u ON u.id = pi.inviter_id
     WHERE pi.invitee_id = $1 AND pi.status = 'pending'
     ORDER BY pi.created_at DESC`,
    [userId]
  );
  return rows;
}

async function respondToInvitation(invitationId, accept, user) {
  const { rows } = await pool.query(
    `SELECT * FROM project_invitations WHERE id = $1 AND invitee_id = $2 AND status = 'pending'`,
    [invitationId, user.id]
  );
  if (rows.length === 0) {
    throw new NotFoundError('Pending invitation not found');
  }
  const invite = rows[0];

  if (accept) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(
        `UPDATE project_invitations SET status = 'accepted', responded_at = NOW() WHERE id = $1`,
        [invitationId]
      );
      await client.query(
        `INSERT INTO project_members (project_id, user_id, role)
         VALUES ($1, $2, 'member')
         ON CONFLICT (project_id, user_id) DO NOTHING`,
        [invite.project_id, user.id]
      );
      await client.query('COMMIT');

      const project = await getProjectById(invite.project_id, user);
      return { accepted: true, project };
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  } else {
    await pool.query(
      `UPDATE project_invitations SET status = 'declined', responded_at = NOW() WHERE id = $1`,
      [invitationId]
    );
    return { accepted: false, declined: true };
  }
}

module.exports = {
  getProjects,
  getProjectById,
  createProject,
  addProjectMember,
  removeProjectMember,
  deleteProject,
  inviteProjectMember,
  getProjectPendingInvitations,
  cancelInvitation,
  getMyPendingInvitations,
  respondToInvitation,
};
