'use strict';
const pool = require('./connection');
const { requireProjectLead } = require('./projectAccess');
const { AppError, ConflictError, NotFoundError } = require('../utils/errors');

// Same assignment-derived status used by the existing task repository. Counts
// are computed over the whole project, independently of UI filters/pagination.
const PROJECT_TASKS = `WITH project_tasks AS (
  SELECT t.*, CASE
    WHEN COUNT(a.id) = 0 THEN 'unassigned'
    WHEN BOOL_AND(a.status = 'todo') THEN 'todo'
    WHEN BOOL_AND(a.status = 'completed') THEN 'completed'
    ELSE 'in_progress' END AS overall_status
  FROM tasks t LEFT JOIN task_assignments a ON a.task_id = t.id AND a.assignment_status = 'active'
  WHERE t.project_id = $1 AND t.deleted_at IS NULL GROUP BY t.id
)`;

function handleSchemaError(error) {
  if (['42703', '42P01'].includes(error.code)) {
    throw new AppError(
      'Không gian quản lý Leader chưa được khởi tạo. Vui lòng liên hệ người quản lý hệ thống.',
      503
    );
  }
  throw error;
}

async function getOverview(projectId, user) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ');
    const project = await requireProjectLead(projectId, user, client);
    const { rows: summary } = await client.query(
      `${PROJECT_TASKS}
      SELECT COUNT(*)::int AS total,
        COUNT(*) FILTER (WHERE overall_status IN ('todo','unassigned'))::int AS todo,
        COUNT(*) FILTER (WHERE overall_status = 'in_progress')::int AS in_progress,
        COUNT(*) FILTER (WHERE overall_status = 'completed')::int AS completed,
        COUNT(*) FILTER (WHERE overall_status = 'unassigned')::int AS unassigned,
        COUNT(*) FILTER (WHERE overall_status != 'completed' AND due_date < NOW())::int AS overdue,
        COUNT(*) FILTER (WHERE overall_status != 'completed' AND due_date >= NOW()
          AND due_date <= NOW() + INTERVAL '48 hours')::int AS due_soon
      FROM project_tasks`,
      [projectId]
    );
    const { rows: members } = await client.query(
      `SELECT u.id, u.full_name, u.email, u.is_active, pm.project_id, pm.role AS project_role,
        pm.can_update_status, pm.can_comment, pm.permissions_version,
        COUNT(a.id)::int AS assigned,
        COUNT(a.id) FILTER (WHERE a.status = 'todo')::int AS todo,
        COUNT(a.id) FILTER (WHERE a.status = 'in_progress')::int AS in_progress,
        COUNT(a.id) FILTER (WHERE a.status = 'completed')::int AS completed,
        COUNT(a.id) FILTER (WHERE a.status != 'completed' AND t.due_date < NOW())::int AS overdue
      FROM project_members pm JOIN users u ON u.id = pm.user_id
      LEFT JOIN tasks t ON t.project_id = pm.project_id AND t.deleted_at IS NULL
      LEFT JOIN task_assignments a ON a.task_id = t.id AND a.user_id = pm.user_id AND a.assignment_status = 'active'
      WHERE pm.project_id = $1 GROUP BY u.id, pm.id
      ORDER BY (u.id = $2) DESC, u.full_name, u.id`,
      [projectId, project.lead_id]
    );
    const { rows: attention } = await client.query(
      `${PROJECT_TASKS}
      SELECT id, title, priority, due_date, overall_status, created_at, created_by,
        project_id, $2::bigint AS project_lead_id, $3::text AS project_key,
        COALESCE((SELECT json_agg(json_build_object('id', u.id, 'full_name', u.full_name))
          FROM task_assignments a JOIN users u ON u.id = a.user_id
          WHERE a.task_id = t.id AND a.assignment_status = 'active'), '[]'::json) AS assignees
      FROM project_tasks t WHERE overall_status != 'completed'
        AND (due_date <= NOW() + INTERVAL '48 hours' OR overall_status = 'unassigned' OR priority = 'high')
      ORDER BY (due_date < NOW()) DESC NULLS LAST, due_date ASC NULLS LAST, id DESC LIMIT 6`,
      [projectId, project.lead_id, project.key]
    );
    const { rows: history } = await client.query(
      `SELECT h.id, h.member_id, h.previous_permissions, h.new_permissions, h.created_at,
        m.full_name AS member_name, actor.full_name AS changed_by_name
      FROM project_permission_history h JOIN users m ON m.id = h.member_id
      JOIN users actor ON actor.id = h.changed_by WHERE h.project_id = $1
      ORDER BY h.created_at DESC, h.id DESC LIMIT 10`,
      [projectId]
    );
    await client.query('COMMIT');
    return { project, summary: summary[0], members, attention, history };
  } catch (error) {
    await client.query('ROLLBACK');
    handleSchemaError(error);
  } finally {
    client.release();
  }
}

async function updatePermissions(projectId, memberId, updates, user) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const project = await requireProjectLead(projectId, user, client);
    if (String(project.lead_id) === String(memberId)) {
      throw new AppError(
        'Không thể thay đổi quyền của Leader đang phụ trách dự án.',
        400
      );
    }
    const { rows } = await client.query(
      `SELECT can_update_status, can_comment, permissions_version
       FROM project_members WHERE project_id = $1 AND user_id = $2 FOR UPDATE`,
      [projectId, memberId]
    );
    if (!rows.length)
      throw new NotFoundError('Thành viên không thuộc dự án này.');
    const previous = rows[0];
    if (previous.permissions_version !== updates.expected_version) {
      throw new ConflictError(
        'Quyền đã được thay đổi bởi người khác. Hãy tải lại trước khi lưu.'
      );
    }
    const permissions = {
      can_update_status: updates.can_update_status,
      can_comment: updates.can_comment
    };
    if (
      previous.can_update_status === permissions.can_update_status &&
      previous.can_comment === permissions.can_comment
    ) {
      await client.query('COMMIT');
      return {
        ...permissions,
        permissions_version: previous.permissions_version
      };
    }
    const { rows: updated } = await client.query(
      `UPDATE project_members SET can_update_status = $3, can_comment = $4,
        permissions_version = permissions_version + 1
       WHERE project_id = $1 AND user_id = $2
       RETURNING can_update_status, can_comment, permissions_version`,
      [
        projectId,
        memberId,
        permissions.can_update_status,
        permissions.can_comment
      ]
    );
    await client.query(
      `INSERT INTO project_permission_history (project_id, member_id, changed_by, previous_permissions, new_permissions)
       VALUES ($1, $2, $3, $4::jsonb, $5::jsonb)`,
      [
        projectId,
        memberId,
        user.id,
        JSON.stringify({
          can_update_status: previous.can_update_status,
          can_comment: previous.can_comment
        }),
        JSON.stringify(permissions)
      ]
    );
    await client.query('COMMIT');
    return updated[0];
  } catch (error) {
    await client.query('ROLLBACK');
    handleSchemaError(error);
  } finally {
    client.release();
  }
}

module.exports = { getOverview, updatePermissions };
