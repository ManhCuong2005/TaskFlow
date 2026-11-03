'use strict';
const pool = require('./connection');
const { NotFoundError, ForbiddenError } = require('../utils/errors');
const { canAccessTask } = require('./tasks.repository');
const { requireTaskPermission } = require('./projectAccess');

async function getComments(taskId, user, { page = 1, limit = 50 } = {}) {
  const access = await canAccessTask(taskId, user);
  if (!access) throw new ForbiddenError('Access denied');

  const offset = (page - 1) * limit;
  const [{ rows: comments }, { rows: countRows }] = await Promise.all([
    pool.query(
      `SELECT tc.id, tc.task_id, tc.user_id, tc.content, tc.created_at, tc.updated_at,
              u.full_name AS author_name
       FROM task_comments tc
       JOIN users u ON u.id = tc.user_id
       WHERE tc.task_id = $1 AND tc.deleted_at IS NULL
       ORDER BY tc.created_at ASC
       LIMIT $2 OFFSET $3`,
      [taskId, limit, offset]
    ),
    pool.query(
      `SELECT COUNT(*) FROM task_comments WHERE task_id = $1 AND deleted_at IS NULL`,
      [taskId]
    ),
  ]);
  return { comments, total: parseInt(countRows[0].count), page, limit };
}

async function lockTaskAccess(taskId, user, client) {
  const { rows: tasks } = await client.query(
    'SELECT id FROM tasks WHERE id = $1 AND deleted_at IS NULL FOR SHARE',
    [taskId]
  );
  if (tasks.length === 0) throw new NotFoundError('Task not found');

  if (user.role === 'admin') return;

  if (!await canAccessTask(taskId, user, client)) throw new ForbiddenError('Access denied');
}

async function addComment(taskId, user_id, content, user) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await lockTaskAccess(taskId, user, client);
    await requireTaskPermission(taskId, user, 'can_comment', client);
    const { rows } = await client.query(
      `INSERT INTO task_comments (task_id, user_id, content)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [taskId, user_id, content]
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

async function updateComment(taskId, commentId, content, user) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await lockTaskAccess(taskId, user, client);
    await requireTaskPermission(taskId, user, 'can_comment', client);

    const { rows } = await client.query(
      `SELECT *
       FROM task_comments
       WHERE id = $1 AND task_id = $2 AND deleted_at IS NULL
       FOR UPDATE`,
      [commentId, taskId]
    );
    if (rows.length === 0) throw new NotFoundError('Comment not found');

    if (user.role !== 'admin' && String(rows[0].user_id) !== String(user.id)) {
      throw new ForbiddenError('You can only edit your own comments');
    }

    const { rows: updated } = await client.query(
      `UPDATE task_comments
       SET content = $1, updated_at = NOW()
       WHERE id = $2 AND deleted_at IS NULL
       RETURNING *`,
      [content, commentId]
    );
    await client.query('COMMIT');
    return updated[0];
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

async function deleteComment(taskId, commentId, user) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await lockTaskAccess(taskId, user, client);

    const { rows } = await client.query(
      `SELECT user_id
       FROM task_comments
       WHERE id = $1 AND task_id = $2 AND deleted_at IS NULL
       FOR UPDATE`,
      [commentId, taskId]
    );
    if (rows.length === 0) throw new NotFoundError('Comment not found');

    if (user.role !== 'admin' && String(rows[0].user_id) !== String(user.id)) {
      throw new ForbiddenError('You can only delete your own comments');
    }

    await client.query(
      'UPDATE task_comments SET deleted_at = NOW() WHERE id = $1 AND deleted_at IS NULL',
      [commentId]
    );
    await client.query('COMMIT');
    return { id: commentId, deleted: true };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

module.exports = { getComments, addComment, updateComment, deleteComment };
