import React, { useState, useEffect, useCallback } from 'react';
import { requestJson, requestFiles } from '../models/apiModel';
import Sidebar from '../components/Sidebar';
import Navbar from '../components/Navbar';
import Toast from '../components/Toast';
import KanbanBoard from '../features/kanban/KanbanBoard';
import DashboardView from '../features/dashboard/DashboardView';
import TaskListView from '../features/tasks/TaskListView';
import TaskDetailDrawer from '../features/tasks/TaskDetailDrawer';
import CreateTaskModal from '../features/tasks/CreateTaskModal';
import CreateProjectModal from '../features/projects/CreateProjectModal';
import CreateUserModal from '../features/admin/CreateUserModal';
import AdminPortal from '../features/admin/AdminPortal';
import TeamView from '../features/team/TeamView';
import ProfileView from '../features/profile/ProfileView';
import AuthView from '../features/auth/AuthView';
import AccountSettingsModal from '../features/profile/AccountSettingsModal';
import InviteMemberModal from '../features/team/InviteMemberModal';
import LeaderWorkspace from '../features/leader/LeaderWorkspace';
import { FolderPlus } from 'lucide-react';

const STORAGE_KEY_TOKEN = 'taskflow_token';
const STORAGE_KEY_USER = 'taskflow_user';

export default function WorkspaceController() {
  // Auth state
  const [token, setToken] = useState(() => localStorage.getItem(STORAGE_KEY_TOKEN) || '');
  const [currentUser, setCurrentUser] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_USER);
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  const [authForm, setAuthForm] = useState({
    email: 'admin@example.com',
    password: 'Admin@123456',
    full_name: '',
  });
  const [isRegistering, setIsRegistering] = useState(false);
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState('');
  const [authSuccess, setAuthSuccess] = useState('');

  // UI state: Admin defaults to 'admin_overview', Employee defaults to 'board'
  const [activeTab, setActiveTab] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_USER);
      const user = saved ? JSON.parse(saved) : null;
      return user?.role === 'admin' ? 'admin_overview' : 'board';
    } catch {
      return 'board';
    }
  });

  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => window.innerWidth < 1024);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterOnlyMine, setFilterOnlyMine] = useState(false);
  const [toast, setToast] = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  // Modals state
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [initialAssigneeId, setInitialAssigneeId] = useState(null);
  const [isCreateProjectModalOpen, setIsCreateProjectModalOpen] = useState(false);
  const [isCreateUserModalOpen, setIsCreateUserModalOpen] = useState(false);
  const [isAccountModalOpen, setIsAccountModalOpen] = useState(false);
  const [accountModalTab, setAccountModalTab] = useState('profile');
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);

  // Projects & Invitations state
  const [projects, setProjects] = useState([]);
  const [currentProject, setCurrentProject] = useState(null);
  const [myInvitations, setMyInvitations] = useState([]);
  const [projectInvitations, setProjectInvitations] = useState([]);

  // Data state
  const [tasks, setTasks] = useState([]);
  const [stats, setStats] = useState(null);
  const [teamMembers, setTeamMembers] = useState([]);
  const [selectedTask, setSelectedTask] = useState(null);
  const [taskSubData, setTaskSubData] = useState({
    comments: [],
    history: [],
    documents: [],
    assignments: [],
  });

  // Table pagination & filters
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [statusFilter, setStatusFilter] = useState('all');
  const [priorityFilter, setPriorityFilter] = useState('all');

  // Show toast notification helper
  const showToast = useCallback((message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => {
      setToast(null);
    }, 3500);
  }, []);

  // Auth Submit (Login / Register)
  const handleAuthSubmit = async (e) => {
    e.preventDefault();
    setAuthError('');
    setAuthSuccess('');
    setAuthLoading(true);

    try {
      const endpoint = isRegistering ? '/api/auth/register' : '/api/auth/login';
      const body = isRegistering
        ? {
            full_name: authForm.full_name,
            email: authForm.email,
            password: authForm.password,
          }
        : {
            email: authForm.email,
            password: authForm.password,
          };

      const { response, data } = await requestJson(endpoint, {
        method: 'POST',
        body,
      });

      if (!response.ok) {
        throw new Error(data?.message || 'Authentication failed');
      }

      if (isRegistering) {
        setAuthSuccess('Account created! Please sign in with your credentials.');
        setIsRegistering(false);
        return;
      }

      const receivedToken = data?.data?.token;
      const user = data?.data?.user;

      if (!receivedToken || !user) {
        throw new Error('Invalid authentication response');
      }

      localStorage.setItem(STORAGE_KEY_TOKEN, receivedToken);
      localStorage.setItem(STORAGE_KEY_USER, JSON.stringify(user));
      setToken(receivedToken);
      setCurrentUser(user);
      // Route admin to admin_overview and employee to board
      setActiveTab(user.role === 'admin' ? 'admin_overview' : 'board');
      showToast(`Welcome back, ${user.full_name}!`);
    } catch (err) {
      setAuthError(err.message || 'Login error occurred');
    } finally {
      setAuthLoading(false);
    }
  };

  // Logout
  const handleLogout = () => {
    localStorage.removeItem(STORAGE_KEY_TOKEN);
    localStorage.removeItem(STORAGE_KEY_USER);
    setToken('');
    setCurrentUser(null);
    setSelectedTask(null);
    setTasks([]);
    setStats(null);
    setTeamMembers([]);
    setProjects([]);
    setCurrentProject(null);
    setMyInvitations([]);
    setProjectInvitations([]);
    showToast('Signed out of workspace', 'info');
  };

  // Fetch Projects
  const fetchProjects = useCallback(async () => {
    if (!token) return;
    try {
      const { response, data } = await requestJson('/api/projects', { token });
      if (response.ok && Array.isArray(data?.data)) {
        setProjects(data.data);
        if (data.data.length === 0) {
          setCurrentProject(null);
          setTeamMembers([]);
          setTasks([]);
        } else {
          setCurrentProject((prev) => {
            if (prev) {
              const match = data.data.find((p) => String(p.id) === String(prev.id));
              if (match) {
                // Keep exact same object reference if key fields didn't change!
                if (
                  match.name === prev.name &&
                  match.key === prev.key &&
                  String(match.lead_id) === String(prev.lead_id) &&
                  match.lead_name === prev.lead_name
                ) {
                  return prev;
                }
                return match;
              }
            }
            return data.data[0] || null;
          });
        }
      } else {
        setProjects([]);
        setCurrentProject(null);
      }
    } catch (err) {
      console.error('Fetch projects error:', err);
      setProjects([]);
      setCurrentProject(null);
    }
  }, [token]);

  // Fetch all tasks (scoped to currentProject if employee)
  const fetchTasks = useCallback(async () => {
    if (!token) return;
    if (currentUser?.role !== 'admin' && !currentProject?.id) {
      setTasks([]);
      setTotalPages(1);
      return;
    }
    try {
      const params = new URLSearchParams({
        limit: '100',
        page: page.toString(),
      });
      if (currentUser?.role !== 'admin' && currentProject?.id) {
        params.append('project_id', currentProject.id);
      }
      if (searchQuery.trim()) params.append('search', searchQuery.trim());
      if (statusFilter !== 'all') params.append('status', statusFilter);
      if (priorityFilter !== 'all') params.append('priority', priorityFilter);

      const { response, data } = await requestJson(`/api/tasks?${params.toString()}`, {
        token,
      });

      if (response.ok && data?.data) {
        setTasks(data.data);
        if (data.pagination) {
          setTotalPages(data.pagination.totalPages || 1);
        }
      }
    } catch (err) {
      console.error('Fetch tasks error:', err);
    }
  }, [token, page, searchQuery, statusFilter, priorityFilter, currentProject?.id, currentUser?.role]);

  // Fetch dashboard stats
  const fetchStats = useCallback(async () => {
    if (!token) return;
    if (currentUser?.role !== 'admin' && !currentProject?.id) {
      setStats(null);
      return;
    }
    try {
      const url = currentProject?.id
        ? `/api/tasks/stats?project_id=${currentProject.id}`
        : '/api/tasks/stats';
      const { response, data } = await requestJson(url, { token });
      if (response.ok && data?.data) {
        setStats(data.data);
      }
    } catch (err) {
      console.error('Fetch stats error:', err);
    }
  }, [token, currentUser?.role, currentProject?.id]);

  // Fetch team members
  const fetchTeam = useCallback(async () => {
    if (!token) return;
    try {
      if (currentUser?.role === 'admin') {
        const { response, data } = await requestJson('/api/users?limit=100', { token });
        if (response.ok && data?.data) {
          setTeamMembers(data.data);
        }
      } else if (currentProject?.id) {
        const { response, data } = await requestJson(`/api/projects/${currentProject.id}`, { token });
        if (response.ok && data?.data?.members) {
          setTeamMembers(data.data.members);
          setCurrentProject(prev => prev && String(prev.id) === String(data.data.id)
            ? { ...prev, members: data.data.members } : prev);
        }
      } else {
        setTeamMembers([]);
      }
    } catch (err) {
      console.error('Fetch team error:', err);
      setTeamMembers([]);
    }
  }, [token, currentUser?.role, currentProject?.id]);

  // Fetch my pending project invitations
  const fetchMyInvitations = useCallback(async () => {
    if (!token || currentUser?.role === 'admin') return;
    try {
      const { response, data } = await requestJson('/api/projects/invitations/me', { token });
      if (response.ok && data?.data) {
        setMyInvitations(data.data);
      }
    } catch (err) {
      console.error('Fetch my invitations error:', err);
    }
  }, [token, currentUser?.role]);

  // Fetch invitations sent for current project
  const fetchProjectInvitations = useCallback(async () => {
    if (!token || !currentProject?.id || currentUser?.role === 'admin'
      || String(currentProject.lead_id) !== String(currentUser?.id)) return;
    try {
      const { response, data } = await requestJson(`/api/projects/${currentProject.id}/invitations`, { token });
      if (response.ok && data?.data) {
        setProjectInvitations(data.data);
      }
    } catch (err) {
      console.error('Fetch project invitations error:', err);
    }
  }, [token, currentProject?.id, currentProject?.lead_id, currentUser?.role, currentUser?.id]);

  // Load sub-resources when selectedTask changes
  const loadTaskDetails = useCallback(
    async (task) => {
      if (!task || !token) return;
      try {
        const [commRes, histRes, docsRes, assignRes] = await Promise.all([
          requestJson(`/api/tasks/${task.id}/comments`, { token }),
          requestJson(`/api/tasks/${task.id}/history`, { token }),
          requestJson(`/api/tasks/${task.id}/documents`, { token }),
          requestJson(`/api/tasks/${task.id}/assignments`, { token }),
        ]);

        setTaskSubData({
          comments: commRes.response.ok ? commRes.data?.data || [] : [],
          history: histRes.response.ok ? histRes.data?.data || [] : [],
          documents: docsRes.response.ok ? docsRes.data?.data || [] : [],
          assignments: assignRes.response.ok ? assignRes.data?.data || [] : [],
        });
      } catch (err) {
        console.error('Error loading task sub-data:', err);
      }
    },
    [token]
  );

  useEffect(() => {
    setSelectedTask(null);
    setIsCreateModalOpen(false);
    setInitialAssigneeId(null);
    setIsInviteModalOpen(false);
  }, [currentProject?.id]);

  useEffect(() => {
    if (activeTab === 'leader' && String(currentProject?.lead_id) !== String(currentUser?.id)) {
      setActiveTab('board');
    }
  }, [activeTab, currentProject?.lead_id, currentUser?.id]);

  // Initial fetch for projects and my invitations on login
  useEffect(() => {
    if (token) {
      fetchProjects();
      fetchMyInvitations();
    }
  }, [token, fetchProjects, fetchMyInvitations]);

  // Reactive data fetching when currentProject or task filters change
  useEffect(() => {
    if (token) {
      fetchTasks();
      fetchStats();
      fetchTeam();
      fetchProjectInvitations();
    }
  }, [
    token,
    currentProject?.id,
    page,
    searchQuery,
    statusFilter,
    priorityFilter,
    fetchTasks,
    fetchStats,
    fetchTeam,
    fetchProjectInvitations,
  ]);

  useEffect(() => {
    if (selectedTask) {
      loadTaskDetails(selectedTask);
    }
  }, [selectedTask, loadTaskDetails]);

  // Refresh workspace button
  const handleRefresh = async () => {
    setRefreshing(true);
    await Promise.all([
      fetchProjects(),
      fetchTasks(),
      fetchStats(),
      fetchTeam(),
      fetchMyInvitations(),
      fetchProjectInvitations(),
    ]);
    if (selectedTask) {
      await loadTaskDetails(selectedTask);
    }
    setRefreshing(false);
    showToast('Data refreshed');
  };

  // Create Project (Assigns user as Project Lead)
  const handleCreateProject = async (projectData) => {
    const { response, data } = await requestJson('/api/projects', {
      token,
      method: 'POST',
      body: projectData,
    });
    if (!response.ok) {
      throw new Error(data?.message || 'Failed to create project');
    }
    showToast(`Project ${data.data.name} created! You are the Project Lead.`);
    await fetchProjects();
    setCurrentProject(data.data);
    fetchTasks();
  };

  // Admin Delete Project
  const handleDeleteProject = async (projectId) => {
    try {
      const { response, data } = await requestJson(`/api/projects/${projectId}`, {
        token,
        method: 'DELETE',
      });
      if (!response.ok) throw new Error(data?.message || 'Failed to delete project');
      showToast('Project deleted');
      await fetchProjects();
      fetchTasks();
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  // Admin Provision User
  const handleCreateUser = async (userData) => {
    const { response, data } = await requestJson('/api/users', {
      token,
      method: 'POST',
      body: userData,
    });
    if (!response.ok) {
      throw new Error(data?.message || 'Failed to provision account');
    }
    showToast(`Account created for ${data.data.full_name}`);
    fetchTeam();
  };

  // Create Task
  const handleCreateTask = async (taskData) => {
    if (currentUser?.role !== 'admin' && String(currentProject?.lead_id) !== String(currentUser?.id)) {
      showToast('Chỉ Project Lead mới có quyền tạo Issue trong dự án này', 'error');
      throw new Error('Chỉ Project Lead mới có quyền tạo Issue trong dự án này');
    }

    const { files, ...taskPayload } = taskData;

    const { response, data } = await requestJson('/api/tasks', {
      token,
      method: 'POST',
      body: {
        ...taskPayload,
        project_id: currentProject?.id,
      },
    });
    if (!response.ok) {
      throw new Error(data?.message || 'Failed to create task');
    }
    const createdTask = data?.data;

    // Upload attached files if any (optional)
    if (files && files.length > 0 && createdTask?.id) {
      try {
        const uploadRes = await requestFiles(`/api/tasks/${createdTask.id}/documents`, {
          token,
          files,
        });
        if (!uploadRes.response.ok) {
          console.warn('Issue created, but failed to upload some files:', uploadRes.data?.message);
        }
      } catch (uploadErr) {
        console.error('File upload error:', uploadErr);
      }
    }

    showToast('Issue created successfully!');
    fetchTasks();
    fetchStats();
  };

  // Update Task (title, description, priority, due_date)
  const handleUpdateTask = async (taskId, updates) => {
    if (currentUser?.role !== 'admin' && String(currentProject?.lead_id) !== String(currentUser?.id)) {
      showToast('Chỉ Project Lead mới có quyền chỉnh sửa task. Thành viên không được sửa!', 'error');
      return;
    }
    const { response, data } = await requestJson(`/api/tasks/${taskId}`, {
      token,
      method: 'PATCH',
      body: updates,
    });
    if (!response.ok) {
      showToast(data?.message || 'Failed to update task', 'error');
      return;
    }
    showToast('Task updated');
    fetchTasks();
    if (selectedTask && selectedTask.id === taskId) {
      setSelectedTask((prev) => ({ ...prev, ...data.data }));
    }
  };

  // Update Task Status (Kanban Drag and Drop or Dropdown)
  const handleUpdateTaskStatus = async (taskId, newStatus) => {
    setTasks((prev) =>
      prev.map((t) => (t.id === taskId ? { ...t, overall_status: newStatus } : t))
    );

    try {
      const { response, data } = await requestJson(`/api/tasks/${taskId}/status`, {
        token,
        method: 'PATCH',
        body: { status: newStatus },
      });

      if (!response.ok) {
        throw new Error(data?.message || 'Failed to update status');
      }

      showToast(`Moved to ${newStatus.replace('_', ' ')}`);
      fetchTasks();
      fetchStats();
      if (selectedTask && selectedTask.id === taskId) {
        setSelectedTask((prev) => ({ ...prev, overall_status: newStatus }));
        loadTaskDetails(selectedTask);
      }
    } catch (err) {
      showToast(err.message, 'error');
      fetchTasks();
    }
  };

  // Delete Task
  const handleDeleteTask = async (taskId) => {
    if (currentUser?.role !== 'admin' && String(currentProject?.lead_id) !== String(currentUser?.id)) {
      showToast('Chỉ Project Lead mới có quyền xóa task. Thành viên không được xóa!', 'error');
      return;
    }
    try {
      const { response, data } = await requestJson(`/api/tasks/${taskId}`, {
        token,
        method: 'DELETE',
      });
      if (!response.ok) {
        throw new Error(data?.message || 'Failed to delete task');
      }
      showToast('Task deleted successfully');
      setTasks((prev) => prev.filter((t) => t.id !== taskId));
      fetchStats();
      if (selectedTask && selectedTask.id === taskId) {
        setSelectedTask(null);
      }
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  // Comments
  const handleAddComment = async (taskId, content) => {
    try {
      const { response, data } = await requestJson(`/api/tasks/${taskId}/comments`, {
        token,
        method: 'POST',
        body: { content },
      });
      if (!response.ok) throw new Error(data?.message || 'Failed to post comment');
      showToast('Comment added');
      loadTaskDetails({ id: taskId });
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const handleDeleteComment = async (taskId, commentId) => {
    try {
      const { response, data } = await requestJson(
        `/api/tasks/${taskId}/comments/${commentId}`,
        {
          token,
          method: 'DELETE',
        }
      );
      if (!response.ok) throw new Error(data?.message || 'Failed to delete comment');
      showToast('Comment removed');
      loadTaskDetails({ id: taskId });
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  // Documents
  const handleUploadDocument = async (taskId, files) => {
    try {
      const { response, data } = await requestFiles(`/api/tasks/${taskId}/documents`, {
        token,
        files,
      });
      if (!response.ok) throw new Error(data?.message || 'Failed to upload documents');
      showToast('Attachments uploaded');
      loadTaskDetails({ id: taskId });
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const handleGetDocumentUrl = async (taskId, docId) => {
    try {
      const { response, data } = await requestJson(
        `/api/tasks/${taskId}/documents/${docId}/url?disposition=attachment`,
        { token }
      );
      if (!response.ok) throw new Error(data?.message || 'Failed to get download URL');
      if (data?.data?.url) {
        const link = document.createElement('a');
        link.href = data.data.url;
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        document.body.appendChild(link);
        link.click();
        link.remove();
      }
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  // Assign user to task
  const handleAssignUser = async (taskId, userId) => {
    try {
      const { response, data } = await requestJson(`/api/tasks/${taskId}/assignments`, {
        token,
        method: 'POST',
        body: { assignee_ids: [userId] },
      });
      if (!response.ok) throw new Error(data?.message || 'Failed to assign user');
      showToast('Member assigned');
      loadTaskDetails({ id: taskId });
      fetchTasks();
      fetchStats();
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  // Revoke assignment
  const handleRevokeAssignment = async (taskId, assignmentId) => {
    try {
      const { response, data } = await requestJson(
        `/api/tasks/${taskId}/assignments/${assignmentId}/revoke`,
        {
          token,
          method: 'PATCH',
          body: { revoke_reason: 'Removed by Project Lead' },
        }
      );
      if (!response.ok) throw new Error(data?.message || 'Failed to revoke assignment');
      showToast('Assignment revoked');
      loadTaskDetails({ id: taskId });
      fetchTasks();
      fetchStats();
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  // Toggle user activation (admin)
  const handleToggleUserStatus = async (userId, newActive) => {
    try {
      const { response, data } = await requestJson(`/api/users/${userId}/status`, {
        token,
        method: 'PATCH',
        body: { is_active: newActive },
      });
      if (!response.ok) throw new Error(data?.message || 'Failed to update user status');
      showToast(newActive ? 'User activated' : 'User deactivated');
      fetchTeam();
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  // Self-Account Management Handlers
  const handleOpenAccountModal = (tab = 'profile') => {
    setAccountModalTab(tab);
    setIsAccountModalOpen(true);
  };

  const handleUpdateProfile = async (fullName) => {
    const { response, data } = await requestJson('/api/auth/profile', {
      method: 'PATCH',
      token,
      body: { full_name: fullName },
    });
    if (!response.ok) {
      throw new Error(data?.message || 'Không thể cập nhật thông tin');
    }
    const updated = data.data;
    setCurrentUser(updated);
    localStorage.setItem(STORAGE_KEY_USER, JSON.stringify(updated));
    showToast('Cập nhật thông tin thành công!');
    return updated;
  };

  const handleChangePassword = async (currentPassword, newPassword) => {
    const { response, data } = await requestJson('/api/auth/change-password', {
      method: 'POST',
      token,
      body: { current_password: currentPassword, new_password: newPassword },
    });
    if (!response.ok) {
      throw new Error(data?.message || 'Mật khẩu hiện tại không đúng');
    }
    showToast('Đổi mật khẩu thành công!');
    return data;
  };

  const handleRespondInvitation = async (inviteId, accept) => {
    const { response, data } = await requestJson(`/api/projects/invitations/${inviteId}/respond`, {
      method: 'POST',
      token,
      body: { accept },
    });
    if (!response.ok) {
      throw new Error(data?.message || 'Không thể phản hồi lời mời');
    }
    setMyInvitations((prev) => prev.filter((i) => i.id !== inviteId));
    if (accept) {
      showToast('Đã tham gia dự án thành công!');
      await fetchProjects();
    } else {
      showToast('Đã từ chối lời mời');
    }
  };

  const handleCancelInvitation = async (inviteId) => {
    if (!currentProject?.id) return;
    try {
      const { response, data } = await requestJson(`/api/projects/${currentProject.id}/invitations/${inviteId}`, {
        method: 'DELETE',
        token,
      });
      if (response.ok) {
        setProjectInvitations((prev) => prev.filter((i) => i.id !== inviteId));
        showToast('Đã thu hồi lời mời');
      } else {
        showToast(data?.message || 'Không thể thu hồi lời mời', 'error');
      }
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const handleRemoveProjectMember = async (memberUserId) => {
    if (!currentProject?.id) return;
    try {
      const { response, data } = await requestJson(`/api/projects/${currentProject.id}/members/${memberUserId}`, {
        method: 'DELETE',
        token,
      });
      if (response.ok) {
        showToast('Đã xóa thành viên khỏi dự án');
        fetchTeam();
      } else {
        showToast(data?.message || 'Không thể xóa thành viên', 'error');
      }
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  // If not logged in, show modern AuthView
  if (!token || !currentUser) {
    return (
      <>
        <Toast toast={toast} onClose={() => setToast(null)} />
        <AuthView
          authForm={authForm}
          setAuthForm={setAuthForm}
          isRegistering={isRegistering}
          setIsRegistering={setIsRegistering}
          onSubmit={handleAuthSubmit}
          loading={authLoading}
          error={authError}
          success={authSuccess}
        />
      </>
    );
  }

  const isAdmin = currentUser.role === 'admin';
  const isProjectLead = Boolean(currentProject && currentUser && String(currentProject.lead_id) === String(currentUser.id));

  // Filter tasks if "Only My Issues" is enabled (Employees)
  const displayedTasks = filterOnlyMine
    ? tasks.filter((t) => {
        // 1. Task assigned to current user
        const isAssigned = Array.isArray(t.assignees) && t.assignees.some((a) => String(a.id) === String(currentUser?.id));
        if (isAssigned) return true;
        // 2. Task created by current user and has no other assignees
        const isCreator = String(t.created_by) === String(currentUser?.id);
        const hasNoOtherAssignees = !Array.isArray(t.assignees) || t.assignees.length === 0;
        if (isCreator && hasNoOtherAssignees) return true;
        return false;
      })
    : tasks;

  return (
    <div className="flex h-screen bg-slate-50 text-slate-900 overflow-hidden font-sans">
      <Toast toast={toast} onClose={() => setToast(null)} />

      {/* Role-Specific Sidebar */}
      <Sidebar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        currentUser={currentUser}
        onLogout={handleLogout}
        onOpenCreateModal={() => setIsCreateModalOpen(true)}
        onOpenCreateProjectModal={() => setIsCreateProjectModalOpen(true)}
        collapsed={sidebarCollapsed}
        setCollapsed={setSidebarCollapsed}
        projects={projects}
        currentProject={currentProject}
        onSelectProject={(proj) => {
          setCurrentProject(proj);
          showToast(`Switched to project ${proj.name} [${proj.key}]`);
        }}
        onDeleteProject={handleDeleteProject}
        onOpenAccountModal={handleOpenAccountModal}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top Navbar */}
        <Navbar
          activeTab={activeTab}
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          onRefresh={handleRefresh}
          refreshing={refreshing}
          onOpenCreateModal={() => setIsCreateModalOpen(true)}
          currentUser={currentUser}
          filterOnlyMine={filterOnlyMine}
          setFilterOnlyMine={setFilterOnlyMine}
          currentProject={currentProject}
          onOpenCreateProjectModal={() => setIsCreateProjectModalOpen(true)}
          onOpenCreateUserModal={() => setIsCreateUserModalOpen(true)}
          onOpenAccountModal={handleOpenAccountModal}
          myInvitations={myInvitations}
          onRespondInvitation={handleRespondInvitation}
          onLogout={handleLogout}
        />

        {/* View Switcher: ADMIN PORTAL vs EMPLOYEE PROJECT WORKSPACE */}
        <main className="flex-1 flex flex-col min-h-0 overflow-hidden bg-slate-50/60">
          {/* ADMIN EXCLUSIVE VIEWS (NO KANBAN BOARD) */}
          {isAdmin && activeTab.startsWith('admin_') && (
            <AdminPortal
              subTab={activeTab.replace('admin_', '')}
              setSubTab={(sub) => setActiveTab('admin_' + sub)}
              teamMembers={teamMembers}
              projects={projects}
              tasks={tasks}
              currentUser={currentUser}
              onToggleUserStatus={handleToggleUserStatus}
              onOpenCreateUserModal={() => setIsCreateUserModalOpen(true)}
              onDeleteProject={handleDeleteProject}
              onRefresh={handleRefresh}
              refreshing={refreshing}
            />
          )}

          {/* EMPLOYEE WORKSPACE: NO PROJECT EMPTY STATE */}
          {!isAdmin && (!currentProject || projects.length === 0) && activeTab !== 'profile' && (
            <div className="flex-1 p-8 flex flex-col items-center justify-center text-center">
              <div className="w-20 h-20 rounded-3xl bg-blue-50 border border-blue-200/60 flex items-center justify-center text-blue-600 mb-5 shadow-xs">
                <FolderPlus className="w-10 h-10" />
              </div>
              <h2 className="text-xl font-bold text-slate-900">Chào mừng bạn đến với TaskFlow!</h2>
              <p className="text-xs text-slate-500 max-w-md mt-1.5 leading-relaxed">
                Tài khoản của bạn hiện chưa tham gia dự án nào. Hãy bấm <span className="font-semibold text-blue-600">"New Project"</span> ở góc trên để tự tạo dự án mới (bạn sẽ là Project Lead), hoặc đợi lời mời từ Project Lead khác.
              </p>

              <div className="flex items-center gap-3 mt-6">
                <button
                  onClick={() => setIsCreateProjectModalOpen(true)}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-sm hover:shadow-md hover:shadow-blue-500/20 active:scale-95 transition-all cursor-pointer"
                >
                  <FolderPlus className="w-4 h-4" />
                  <span>+ Tạo dự án mới (New Project)</span>
                </button>
              </div>

              {myInvitations.length > 0 && (
                <div className="mt-8 p-4 rounded-2xl bg-amber-50/70 border border-amber-200 max-w-md text-left flex items-start gap-3">
                  <div className="w-8 h-8 rounded-lg bg-amber-500 text-white flex items-center justify-center shrink-0 font-bold text-xs">
                    {myInvitations.length}
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-amber-900">Bạn có {myInvitations.length} lời mời tham gia dự án!</h4>
                    <p className="text-[11px] text-amber-700 mt-0.5">
                      Bấm vào biểu tượng chuông thông báo trên góc phải để xem chi tiết và chấp nhận tham gia.
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* EMPLOYEE WORKSPACE VIEWS (ACTIVE PROJECT) */}
          {!isAdmin && isProjectLead && currentProject && activeTab === 'leader' && (
            <LeaderWorkspace
              key={currentProject.id}
              project={currentProject}
              token={token}
              revision={stats}
              onInvite={() => setIsInviteModalOpen(true)}
              onCreateTask={(memberId = null) => {
                setInitialAssigneeId(memberId);
                setIsCreateModalOpen(true);
              }}
              onSelectTask={async (taskId) => {
                try {
                  const { response, data } = await requestJson(`/api/tasks/${taskId}`, { token });
                  if (!response.ok) throw new Error(data?.message || 'Không thể mở công việc.');
                  setSelectedTask(data.data);
                } catch (err) { showToast(err.message, 'error'); }
              }}
              onSaved={showToast}
            />
          )}
          {!isAdmin && currentProject && activeTab === 'dashboard' && (
            <DashboardView
              stats={stats}
              tasks={tasks}
              currentProject={currentProject}
              currentUser={currentUser}
              onSelectTask={setSelectedTask}
              onNavigateToBoard={() => setActiveTab('board')}
              onNavigateToTasks={() => setActiveTab('tasks')}
              onOpenCreateModal={() => setIsCreateModalOpen(true)}
              isProjectLead={isProjectLead}
            />
          )}

          {!isAdmin && currentProject && activeTab === 'board' && (
            <KanbanBoard
              tasks={displayedTasks}
              canUpdateTask={(task) => isProjectLead || (
                teamMembers.find(member => String(member.id) === String(currentUser.id))?.can_update_status !== false
                && task.assignees?.some(member => String(member.id) === String(currentUser.id))
              )}
              onSelectTask={setSelectedTask}
              onUpdateTaskStatus={handleUpdateTaskStatus}
              onOpenCreateModal={() => setIsCreateModalOpen(true)}
              onDeleteTask={handleDeleteTask}
              loading={refreshing}
              isProjectLead={isProjectLead}
            />
          )}

          {!isAdmin && currentProject && activeTab === 'tasks' && (
            <TaskListView
              tasks={displayedTasks}
              onSelectTask={setSelectedTask}
              onDeleteTask={handleDeleteTask}
              currentUser={currentUser}
              onOpenCreateModal={() => setIsCreateModalOpen(true)}
              page={page}
              totalPages={totalPages}
              onPageChange={setPage}
              statusFilter={statusFilter}
              setStatusFilter={setStatusFilter}
              priorityFilter={priorityFilter}
              setPriorityFilter={setPriorityFilter}
              searchQuery={searchQuery}
              setSearchQuery={setSearchQuery}
              isProjectLead={isProjectLead}
            />
          )}

          {!isAdmin && currentProject && activeTab === 'team' && (
            <TeamView
              teamMembers={teamMembers}
              currentProject={currentProject}
              currentUser={currentUser}
              onToggleUserStatus={handleToggleUserStatus}
              loading={refreshing}
              onOpenInviteModal={() => setIsInviteModalOpen(true)}
              pendingInvitations={projectInvitations}
              onCancelInvitation={handleCancelInvitation}
              onRemoveMember={handleRemoveProjectMember}
              onDeleteProject={handleDeleteProject}
            />
          )}

          {/* SHARED PROFILE */}
          {activeTab === 'profile' && (
            <ProfileView
              currentUser={currentUser}
              tasks={tasks}
              onOpenAccountModal={handleOpenAccountModal}
            />
          )}
        </main>
      </div>

      {/* Slide-over Task Detail Drawer (Employee only) */}
      {!isAdmin && selectedTask && (
        <TaskDetailDrawer
          task={selectedTask}
          onClose={() => setSelectedTask(null)}
          onUpdateTask={handleUpdateTask}
          onUpdateStatus={handleUpdateTaskStatus}
          onDeleteTask={handleDeleteTask}
          currentUser={currentUser}
          teamMembers={teamMembers}
          currentProject={currentProject}
          isProjectLead={isProjectLead}
          comments={taskSubData.comments}
          onAddComment={handleAddComment}
          onDeleteComment={handleDeleteComment}
          history={taskSubData.history}
          documents={taskSubData.documents}
          onUploadDocument={handleUploadDocument}
          onGetDocumentUrl={handleGetDocumentUrl}
          assignments={taskSubData.assignments}
          onAssignUser={handleAssignUser}
          onRevokeAssignment={handleRevokeAssignment}
        />
      )}

      {/* Create Task Modal (Project Lead only) */}
      {!isAdmin && isProjectLead && (
        <CreateTaskModal
          isOpen={isCreateModalOpen}
          initialAssigneeId={initialAssigneeId}
          onClose={() => { setIsCreateModalOpen(false); setInitialAssigneeId(null); }}
          onCreateTask={handleCreateTask}
          currentUser={currentUser}
          teamMembers={teamMembers}
          currentProject={currentProject}
        />
      )}

      {/* Create Project Modal (User becomes Project Lead) */}
      {!isAdmin && (
        <CreateProjectModal
          isOpen={isCreateProjectModalOpen}
          onClose={() => setIsCreateProjectModalOpen(false)}
          onCreateProject={handleCreateProject}
          currentUser={currentUser}
        />
      )}

      {/* Admin Provision User Modal */}
      {isAdmin && (
        <CreateUserModal
          isOpen={isCreateUserModalOpen}
          onClose={() => setIsCreateUserModalOpen(false)}
          onCreateUser={handleCreateUser}
        />
      )}

      {/* Account Settings / Self-Management Modal */}
      <AccountSettingsModal
        isOpen={isAccountModalOpen}
        onClose={() => setIsAccountModalOpen(false)}
        currentUser={currentUser}
        onUpdateProfile={handleUpdateProfile}
        onChangePassword={handleChangePassword}
        myInvitations={myInvitations}
        onRespondInvitation={handleRespondInvitation}
        initialTab={accountModalTab}
      />

      {/* Project Lead Invite Member Modal */}
      {!isAdmin && currentProject && (
        <InviteMemberModal
          isOpen={isInviteModalOpen}
          onClose={() => setIsInviteModalOpen(false)}
          project={currentProject}
          token={token}
          onInvitationSent={(inv) => {
            setProjectInvitations((prev) => [inv, ...prev]);
            showToast(`Đã gửi lời mời tới ${inv.invitee_name}!`);
          }}
        />
      )}
    </div>
  );
}
