'use strict';
const pool = require('./connection');
const { NotFoundError, ForbiddenError, ConflictError, AppError } = require('../utils/errors');
const { canAccessTask } = require('./tasks.repository');
const { requireTaskPermission, requireProjectAssignees } = require('./projectAccess');

async function getAssignments(taskId, user) {
  const access = await canAccessTask(taskId, user);
  if (!access) throw new ForbiddenError('Access denied');

  const { rows } = await pool.query(
    `SELECT ta.*,
            u.full_name, u.email,
            u.full_name AS assignee_name, u.email AS assignee_email,
            ab.full_name AS assigned_by_name,
            rb.full_name AS revoked_by_name
     FROM task_assignments ta
     JOIN users u ON u.id = ta.user_id
     JOIN users ab ON ab.id = ta.assigned_by
     LEFT JOIN users rb ON rb.id = ta.revoked_by
     WHERE ta.task_id = $1 AND ta.assignment_status = 'active'
     ORDER BY ta.assigned_at DESC`,
    [taskId]
  );
  return rows;
}

async function assignUsers(taskId, assignee_ids, assigned_by, user) {
  const { rows: taskLeadRows } = await pool.query(
    `SELECT t.created_by, t.project_id, p.lead_id
     FROM tasks t
     LEFT JOIN projects p ON p.id = t.project_id
     WHERE t.id = $1 AND t.deleted_at IS NULL`,
    [taskId]
  );
  if (taskLeadRows.length === 0) throw new NotFoundError('Task not found');
  const task = taskLeadRows[0];
  const canAssign = user.role === 'admin'
    || String(task.lead_id) === String(user.id)
    || (!task.project_id && String(task.created_by) === String(user.id));
  if (!canAssign) throw new ForbiddenError('Only the Project Lead, Task Creator, or Admin can assign members');

  if (!Array.isArray(assignee_ids) || assignee_ids.length === 0) {
    throw new AppError('assignee_ids must be a non-empty array', 400);
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await requireProjectAssignees(task.project_id, assignee_ids, client);

    const { rows: taskRows } = await client.query(
      'SELECT id FROM tasks WHERE id = $1 AND deleted_at IS NULL FOR SHARE',
      [taskId]
    );
    if (taskRows.length === 0) throw new NotFoundError('Task not found');

    const userIdsToLock = [...new Set([...assignee_ids, assigned_by].map(String))];
    const { rows: userRows } = await client.query(
      `SELECT id, is_active
       FROM users
       WHERE id = ANY($1::bigint[])
       ORDER BY id
       FOR SHARE`,
      [userIdsToLock]
    );
    const activeUserIds = new Set(userRows.filter((row) => row.is_active).map((row) => String(row.id)));
    if (!activeUserIds.has(String(assigned_by))) {
      throw new ForbiddenError('Your account is inactive');
    }
    if (assignee_ids.some((userId) => !activeUserIds.has(String(userId)))) {
      throw new NotFoundError('One or more assignee users not found or inactive');
    }

    const results = [];
    for (const userId of assignee_ids) {
      // Check if already actively assigned
      const { rows: existing } = await client.query(
        `SELECT id FROM task_assignments WHERE task_id = $1 AND user_id = $2 AND assignment_status = 'active'`,
        [taskId, userId]
      );
      if (existing.length > 0) {
        throw new ConflictError(`User ${userId} is already actively assigned to this task`);
      }

      const { rows: aRows } = await client.query(
        `INSERT INTO task_assignments (task_id, user_id, assigned_by, status, assignment_status)
         VALUES ($1, $2, $3, 'todo', 'active')
         RETURNING *`,
        [taskId, userId, assigned_by]
      );
      await client.query(
        `INSERT INTO task_status_history (assignment_id, changed_by, old_status, new_status, note)
         VALUES ($1, $2, NULL, 'todo', 'Assigned by admin')`,
        [aRows[0].id, assigned_by]
      );
      results.push(aRows[0]);
    }
    await client.query('COMMIT');
    return results;
  } catch (err) {
    await client.query('ROLLBACK');
    if (err.code === '23505' && err.constraint === 'idx_task_assignments_active_unique') {
      throw new ConflictError('One or more users are already actively assigned to this task');
    }
    throw err;
  } finally {
    client.release();
  }
}

async function revokeAssignment(taskId, assignmentId, revoked_by, revoke_reason, user) {
  const { rows: taskLeadRows } = await pool.query(
    `SELECT t.created_by, t.project_id, p.lead_id
     FROM tasks t
     LEFT JOIN projects p ON p.id = t.project_id
     WHERE t.id = $1 AND t.deleted_at IS NULL`,
    [taskId]
  );
  if (taskLeadRows.length === 0) throw new NotFoundError('Task not found');
  const task = taskLeadRows[0];
  const canRevoke = user.role === 'admin'
    || String(task.lead_id) === String(user.id)
    || (!task.project_id && String(task.created_by) === String(user.id));
  if (!canRevoke) throw new ForbiddenError('Only the Project Lead, Task Creator, or Admin can revoke assignments');

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows: taskRows } = await client.query(
      'SELECT id FROM tasks WHERE id = $1 AND deleted_at IS NULL FOR SHARE',
      [taskId]
    );
    if (taskRows.length === 0) throw new NotFoundError('Task not found');

    const { rows } = await client.query(
      `UPDATE task_assignments
       SET assignment_status = 'revoked', revoked_at = NOW(), revoked_by = $1, revoke_reason = $2, updated_at = NOW()
       WHERE id = $3 AND task_id = $4 AND assignment_status = 'active'
       RETURNING *`,
      [revoked_by, revoke_reason || null, assignmentId, taskId]
    );
    if (rows.length === 0) {
      throw new NotFoundError('Active assignment not found');
    }

    await client.query(
      `INSERT INTO task_status_history (assignment_id, changed_by, old_status, new_status, note)
       VALUES ($1, $2, $3, $4, $5)`,
      [assignmentId, revoked_by, rows[0].status, rows[0].status, revoke_reason || 'Assignment revoked']
    );

    await client.query('COMMIT');
    return rows[0];
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

async function updateAssignmentStatus(taskId, assignmentId, newStatus, changed_by, note, completionNote, user) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows: taskRows } = await client.query(
      'SELECT id FROM tasks WHERE id = $1 AND deleted_at IS NULL FOR SHARE',
      [taskId]
    );
    if (taskRows.length === 0) throw new NotFoundError('Task not found');

    const { rows: assignRows } = await client.query(
      `SELECT ta.*
       FROM task_assignments ta
       WHERE ta.id = $1 AND ta.task_id = $2
         AND ta.assignment_status = 'active'
       FOR UPDATE`,
      [assignmentId, taskId]
    );
    if (assignRows.length === 0) throw new NotFoundError('Active assignment not found');

    const assignment = assignRows[0];
    const { isLead } = await requireTaskPermission(taskId, user, 'can_update_status', client);
    if (user.role === 'employee' && !isLead && String(assignment.user_id) !== String(user.id)) {
      throw new ForbiddenError('You can only update your own assignments');
    }
    if (assignment.status === newStatus) {
      throw new AppError(`Assignment is already in '${newStatus}' status`, 400);
    }

    const validTransitions = {
      todo: ['in_progress'],
      in_progress: ['todo', 'completed'],
      completed: ['in_progress'],
    };
    if (!validTransitions[assignment.status] || !validTransitions[assignment.status].includes(newStatus)) {
      throw new AppError(`Invalid status transition from '${assignment.status}' to '${newStatus}'`, 400);
    }

    const completedAt = newStatus === 'completed' ? 'NOW()' : 'NULL';
    const { rows: updatedRows } = await client.query(
      `UPDATE task_assignments
       SET status = $1, completed_at = ${completedAt}, updated_at = NOW()
       WHERE id = $2 AND assignment_status = 'active'
       RETURNING *`,
      [newStatus, assignmentId]
    );
    await client.query(
      `INSERT INTO task_status_history (assignment_id, changed_by, old_status, new_status, note)
       VALUES ($1, $2, $3, $4, $5)`,
      [assignmentId, changed_by, assignment.status, newStatus, note || null]
    );
    if (newStatus === 'completed') {
      await client.query(
        `INSERT INTO task_completion_reports (task_id, assignment_id, submitted_by, note)
         VALUES ($1, $2, $3, $4)`,
        [taskId, assignmentId, changed_by, completionNote?.trim() || null]
      );
    }
    await client.query('COMMIT');
    return updatedRows[0];
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

module.exports = { getAssignments, assignUsers, revokeAssignment, updateAssignmentStatus };
