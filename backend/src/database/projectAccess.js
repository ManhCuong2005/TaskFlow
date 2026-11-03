'use strict';
const pool = require('./connection');
const { ForbiddenError, NotFoundError } = require('../utils/errors');

async function requireProjectLead(projectId, user, client = pool) {
  const { rows } = await client.query(
    'SELECT id, name, key, lead_id FROM projects WHERE id = $1 FOR SHARE',
    [projectId]
  );
  if (!rows.length) throw new NotFoundError('Project not found');
  if (user.role !== 'admin' && String(rows[0].lead_id) !== String(user.id)) {
    throw new ForbiddenError(
      'Chỉ Leader phụ trách dự án mới có quyền quản lý dự án này.'
    );
  }
  return rows[0];
}

async function requireProjectAccess(projectId, user, client = pool) {
  const { rows } = await client.query(
    `SELECT p.id FROM projects p WHERE p.id = $1 AND (
      $2 = 'admin' OR p.lead_id = $3 OR EXISTS (
        SELECT 1 FROM project_members pm WHERE pm.project_id = p.id AND pm.user_id = $3
      ))`,
    [projectId, user.role, user.id]
  );
  if (!rows.length)
    throw new ForbiddenError('Bạn không có quyền truy cập dự án này.');
}

// Called inside the caller's transaction. The membership lock serializes a write
// with permission revocation, so stale browser state cannot bypass the policy.
async function requireTaskPermission(taskId, user, permission, client) {
  if (!['can_update_status', 'can_comment'].includes(permission))
    throw new Error('Unknown project permission');
  const { rows } = await client.query(
    `SELECT t.project_id, p.lead_id FROM tasks t
     LEFT JOIN projects p ON p.id = t.project_id
     WHERE t.id = $1 AND t.deleted_at IS NULL`,
    [taskId]
  );
  if (!rows.length) throw new NotFoundError('Task not found');
  const task = rows[0];
  const isLead =
    task.lead_id != null && String(task.lead_id) === String(user.id);
  if (user.role === 'admin' || isLead || !task.project_id) return { isLead };
  const { rows: members } = await client.query(
    `SELECT COALESCE((to_jsonb(pm)->>$3)::boolean, TRUE) AS allowed
     FROM project_members pm WHERE project_id = $1 AND user_id = $2 FOR SHARE`,
    [task.project_id, user.id, permission]
  );
  if (!members.length || !members[0].allowed) {
    throw new ForbiddenError(
      permission === 'can_comment'
        ? 'Bạn chưa được cấp quyền bình luận trong dự án này.'
        : 'Bạn chưa được cấp quyền cập nhật trạng thái trong dự án này.'
    );
  }
  return { isLead };
}

async function requireProjectAssignees(projectId, assigneeIds, client) {
  if (!projectId) return;
  const { rows } = await client.query(
    `SELECT pm.user_id FROM project_members pm JOIN users u ON u.id = pm.user_id
     WHERE pm.project_id = $1 AND pm.user_id = ANY($2::bigint[]) AND u.is_active = TRUE
     ORDER BY pm.user_id FOR SHARE OF pm`,
    [projectId, [...new Set(assigneeIds.map(String))]]
  );
  const members = new Set(rows.map((row) => String(row.user_id)));
  if (assigneeIds.some((id) => !members.has(String(id)))) {
    throw new ForbiddenError(
      'Chỉ có thể giao việc cho thành viên đang hoạt động trong dự án.'
    );
  }
}

module.exports = {
  requireProjectLead,
  requireProjectAccess,
  requireTaskPermission,
  requireProjectAssignees
};
