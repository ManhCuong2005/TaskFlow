import { requestJson } from './apiModel';

async function readResult(result) {
  if (!result.response.ok) {
    const error = new Error(
      result.data?.message || 'Không thể tải thông tin quản lý dự án.'
    );
    error.status = result.response.status;
    throw error;
  }
  return result.data.data;
}

export async function getLeaderOverview(projectId, token) {
  return readResult(
    await requestJson(`/api/projects/${projectId}/leader`, { token })
  );
}

export async function saveMemberPermissions(
  projectId,
  memberId,
  permissions,
  token
) {
  return readResult(
    await requestJson(
      `/api/projects/${projectId}/members/${memberId}/permissions`,
      {
        token,
        method: 'PATCH',
        body: permissions
      }
    )
  );
}
