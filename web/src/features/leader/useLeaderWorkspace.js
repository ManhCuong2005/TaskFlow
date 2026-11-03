import { useCallback, useEffect, useRef, useState } from 'react';
import {
  getLeaderOverview,
  saveMemberPermissions
} from '../../models/leaderModel';

export default function useLeaderWorkspace(projectId, token, revision) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const requestId = useRef(0);

  const reload = useCallback(async () => {
    const id = ++requestId.current;
    setLoading(true);
    setError('');
    try {
      const result = await getLeaderOverview(projectId, token);
      if (id === requestId.current) setData(result);
    } catch (err) {
      if (id === requestId.current) setError(err.message);
    } finally {
      if (id === requestId.current) setLoading(false);
    }
  }, [projectId, token]);

  useEffect(() => {
    reload();
    return () => {
      requestId.current += 1;
    };
  }, [reload, revision]);

  const savePermissions = async (member, permissions) => {
    try {
      await saveMemberPermissions(
        projectId,
        member.id,
        {
          ...permissions,
          expected_version: member.permissions_version
        },
        token
      );
    } catch (err) {
      if (err.status === 409) await reload();
      throw err;
    }
    await reload();
  };

  return { data, loading, error, reload, savePermissions };
}
