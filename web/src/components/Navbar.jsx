import React, { useState, useRef, useEffect } from 'react';
import {
  Search,
  RefreshCw,
  Plus,
  Bell,
  Filter,
  CheckCircle2,
  Crown,
  FolderPlus,
  UserPlus,
  Shield,
  User,
  Lock,
  FolderKanban,
  LogOut,
  ChevronDown,
  Check,
  X,
  Loader2
} from 'lucide-react';
import { getInitials, getAvatarColor } from '../utils/helpers';

export default function Navbar({
  activeTab,
  searchQuery,
  setSearchQuery,
  onRefresh,
  refreshing,
  onOpenCreateModal,
  currentUser,
  filterOnlyMine,
  setFilterOnlyMine,
  currentProject,
  onOpenCreateProjectModal,
  onOpenCreateUserModal,
  onOpenAccountModal,
  myInvitations = [],
  onRespondInvitation,
  onLogout,
}) {
  const [avatarDropdownOpen, setAvatarDropdownOpen] = useState(false);
  const [bellDropdownOpen, setBellDropdownOpen] = useState(false);
  const [respondingId, setRespondingId] = useState(null);

  const dropdownRef = useRef(null);
  const bellRef = useRef(null);

  const isAdmin = currentUser?.role === 'admin';

  const titles = {
    // Admin tabs
    admin_overview: 'System Overview & Telemetry',
    admin_users: 'User Account Management',
    admin_projects: 'Project Governance',
    admin_infra: 'Cloud Infrastructure Specs',
    // Employee tabs
    dashboard: 'Dashboard & Analytics',
    leader: 'Quản lý dự án',
    board: 'Kanban Board',
    tasks: 'All Issues',
    team: 'Project Members',
    profile: isAdmin ? 'Admin Profile' : 'User Profile',
  };

  const isProjectLead = Boolean(currentProject && currentUser && String(currentProject.lead_id) === String(currentUser.id));

  // Close dropdowns when clicking outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setAvatarDropdownOpen(false);
      }
      if (bellRef.current && !bellRef.current.contains(event.target)) {
        setBellDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleRespond = async (invitationId, accept) => {
    setRespondingId(invitationId);
    try {
      if (onRespondInvitation) {
        await onRespondInvitation(invitationId, accept);
      }
    } finally {
      setRespondingId(null);
    }
  };

  return (
    <header className="h-16 shrink-0 border-b border-slate-200/80 bg-white/95 backdrop-blur-sm px-3 sm:px-6 flex items-center justify-between gap-2 sm:gap-4 sticky top-0 z-10">
      {/* Left: Breadcrumbs & Page Title */}
      <div className="min-w-0 flex-1 lg:flex-none">
        <div className="lg:hidden">
          <p className="truncate text-sm font-bold text-slate-900">{titles[activeTab] || 'TaskFlow'}</p>
          <p className="mt-0.5 truncate text-[11px] text-slate-400">{isAdmin ? 'System Administration' : currentProject?.name || 'Workspace'}</p>
        </div>
        <div className="hidden lg:flex items-center gap-2 text-sm text-slate-500 font-medium">
          {isAdmin ? (
            <>
              <span className="flex items-center gap-1 text-purple-700 font-bold">
                <Shield className="w-4 h-4" /> System Administration
              </span>
              <span>/</span>
              <span className="text-slate-900 font-bold">{titles[activeTab] || 'Admin Console'}</span>
            </>
          ) : (
            <>
              <span className="hover:text-slate-800 cursor-pointer">Projects</span>
              <span>/</span>
              {currentProject ? (
                <>
                  <span className="hover:text-slate-800 cursor-pointer text-blue-600 font-semibold">
                    {currentProject.name}
                  </span>
                  {isProjectLead && (
                    <span className="text-[10px] bg-amber-50 text-amber-700 font-bold px-1.5 py-0.5 rounded border border-amber-200/60 flex items-center gap-0.5">
                      <Crown className="w-3 h-3 text-amber-600" /> Lead
                    </span>
                  )}
                </>
              ) : (
                <span className="text-slate-400 italic">Chưa có dự án</span>
              )}
              <span>/</span>
              <span className="text-slate-900 font-bold">{titles[activeTab] || 'Workspace'}</span>
            </>
          )}
        </div>
      </div>

      {/* Middle: Universal Search Bar (only in task/board views) */}
      {!isAdmin && (activeTab === 'board' || activeTab === 'tasks') && (
        <div className="flex-1 max-w-md hidden xl:flex items-center gap-2">
          <div className="relative w-full">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search tasks, descriptions..."
              className="w-full pl-9 pr-4 py-1.5 text-xs rounded-xl bg-slate-100/80 border border-transparent hover:bg-slate-100 focus:bg-white focus:border-blue-500 focus:outline-none transition-all"
            />
          </div>

          <button
            onClick={() => setFilterOnlyMine(!filterOnlyMine)}
            className={`px-3 py-1.5 text-xs font-semibold rounded-xl flex items-center gap-1.5 border transition-all cursor-pointer whitespace-nowrap ${
              filterOnlyMine
                ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                : 'bg-white text-slate-600 hover:text-slate-800 border-slate-200/80 hover:bg-slate-50'
            }`}
            title="Filter tasks assigned to you"
          >
            <Filter className={`w-3.5 h-3.5 ${filterOnlyMine ? 'text-white' : 'text-slate-500'}`} />
            <span>Only My Issues</span>
          </button>
        </div>
      )}

      {/* Right Actions */}
      <div className="flex shrink-0 items-center gap-1 sm:gap-2.5">
        <button
          onClick={onRefresh}
          disabled={refreshing}
          className="p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition-all cursor-pointer"
          title="Refresh data"
        >
          <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin text-purple-600' : ''}`} />
        </button>

        {/* Notifications: Project Invitations ONLY */}
        {!isAdmin && (
          <div className="relative" ref={bellRef}>
            <button
              onClick={() => {
                setBellDropdownOpen(!bellDropdownOpen);
                setAvatarDropdownOpen(false);
              }}
              className={`p-2 rounded-xl transition-all relative cursor-pointer ${
                bellDropdownOpen
                  ? 'bg-amber-50 text-amber-700'
                  : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100'
              }`}
              title="Thông báo lời mời dự án"
            >
              <Bell className="w-4 h-4" />
              {myInvitations.length > 0 && (
                <span className="absolute top-1 right-1 w-4 h-4 rounded-full bg-amber-500 text-white text-[9px] font-bold flex items-center justify-center animate-pulse">
                  {myInvitations.length}
                </span>
              )}
            </button>

            {/* Invitations Popover */}
            {bellDropdownOpen && (
              <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white border border-slate-200 rounded-2xl shadow-xl z-50 p-4 space-y-3 animate-in fade-in zoom-in-95 duration-150">
                <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
                  <div className="flex items-center gap-2">
                    <FolderKanban className="w-4 h-4 text-blue-600" />
                    <h3 className="text-xs font-bold text-slate-900">Lời mời tham gia dự án</h3>
                  </div>
                  {myInvitations.length > 0 && (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">
                      {myInvitations.length} mới
                    </span>
                  )}
                </div>

                {myInvitations.length === 0 ? (
                  <div className="text-center py-6 text-slate-400">
                    <FolderKanban className="w-8 h-8 mx-auto mb-1.5 opacity-40" />
                    <p className="text-xs font-semibold text-slate-700">Không có lời mời nào</p>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      Khi một Project Lead gửi lời mời, bạn sẽ thấy thông báo tại đây để tham gia.
                    </p>
                  </div>
                ) : (
                  <div className="max-h-72 overflow-y-auto space-y-2.5">
                    {myInvitations.map((inv) => (
                      <div
                        key={inv.id}
                        className="p-3 rounded-xl border border-slate-200 bg-slate-50/50 hover:bg-white transition-all space-y-2.5"
                      >
                        <div className="flex items-start gap-2.5">
                          <div className="w-8 h-8 rounded-lg bg-blue-50 border border-blue-200 text-blue-700 font-mono font-bold flex items-center justify-center text-xs shrink-0">
                            {inv.project_key}
                          </div>
                          <div className="truncate flex-1">
                            <div className="text-xs font-bold text-slate-900 truncate">
                              {inv.project_name}
                            </div>
                            <div className="text-[11px] text-slate-500 truncate mt-0.5">
                              Chủ trì:{' '}
                              <span className="font-semibold text-slate-700">
                                {inv.inviter_name}
                              </span>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 pt-1 border-t border-slate-100">
                          <button
                            onClick={() => handleRespond(inv.id, true)}
                            disabled={respondingId === inv.id}
                            className="flex-1 py-1.5 px-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold shadow-xs transition-all flex items-center justify-center gap-1 cursor-pointer disabled:opacity-50"
                          >
                            {respondingId === inv.id ? (
                              <Loader2 className="w-3 h-3 animate-spin" />
                            ) : (
                              <Check className="w-3 h-3" />
                            )}
                            <span>Chấp nhận</span>
                          </button>

                          <button
                            onClick={() => handleRespond(inv.id, false)}
                            disabled={respondingId === inv.id}
                            className="flex-1 py-1.5 px-2 rounded-lg bg-slate-100 hover:bg-rose-50 text-slate-600 hover:text-rose-600 text-[11px] font-bold transition-all flex items-center justify-center gap-1 cursor-pointer disabled:opacity-50"
                          >
                            <X className="w-3 h-3" />
                            <span>Từ chối</span>
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Admin Single Canonical Action: Add User */}
        {isAdmin ? (
          <button
            onClick={onOpenCreateUserModal}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold shadow-xs transition-all hover:shadow-md hover:shadow-purple-500/20 active:scale-95 cursor-pointer"
            title="Create a new user account"
          >
            <UserPlus className="w-4 h-4" />
            <span>+ Add User</span>
          </button>
        ) : (
          <>
            <button
              onClick={onOpenCreateProjectModal}
              className="hidden lg:flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-all cursor-pointer"
              title="Create a new project where you are Project Lead"
            >
              <FolderPlus className="w-3.5 h-3.5 text-blue-600" />
              <span>New Project</span>
            </button>

            {isProjectLead && (
              <button
                onClick={onOpenCreateModal}
                className="hidden sm:flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium shadow-xs transition-all hover:shadow-md hover:shadow-blue-500/20 active:scale-95 cursor-pointer"
                title="Tạo Issue mới (Project Lead)"
              >
                <Plus className="w-4 h-4" />
                <span className="hidden sm:inline">Create</span>
              </button>
            )}
          </>
        )}

        <div className="h-6 w-px bg-slate-200 mx-1 hidden sm:block" />

        {/* User Avatar with Dropdown Menu for Self-Management */}
        <div className="relative" ref={dropdownRef}>
          <button
            onClick={() => {
              setAvatarDropdownOpen(!avatarDropdownOpen);
              setBellDropdownOpen(false);
            }}
            className="flex items-center gap-1 p-0.5 rounded-full hover:ring-2 hover:ring-blue-400 transition-all cursor-pointer group"
            title="Tài khoản cá nhân"
          >
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs ring-2 ring-white shadow-xs ${getAvatarColor(
                currentUser?.full_name
              )}`}
            >
              {getInitials(currentUser?.full_name)}
            </div>
            <ChevronDown className="w-3 h-3 text-slate-400 group-hover:text-slate-700 hidden sm:block" />
          </button>

          {/* Avatar Dropdown Menu */}
          {avatarDropdownOpen && (
            <div className="absolute right-0 mt-2 w-64 bg-white border border-slate-200 rounded-2xl shadow-xl z-50 p-2 space-y-1 animate-in fade-in zoom-in-95 duration-150">
              {/* User Header */}
              <div className="px-3 py-2 border-b border-slate-100">
                <div className="text-xs font-bold text-slate-900 truncate">
                  {currentUser?.full_name}
                </div>
                <div className="text-[11px] text-slate-400 truncate mt-0.5">
                  {currentUser?.email}
                </div>
                <div className="mt-1.5">
                  <span
                    className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded ${
                      isAdmin ? 'bg-purple-100 text-purple-700' : 'bg-blue-50 text-blue-700'
                    }`}
                  >
                    {isAdmin ? 'System Admin' : 'User'}
                  </span>
                </div>
              </div>

              {/* Menu Actions: Self Account Management ONLY */}
              <div className="pt-1 space-y-0.5">
                <button
                  onClick={() => {
                    setAvatarDropdownOpen(false);
                    if (onOpenAccountModal) onOpenAccountModal('profile');
                  }}
                  className="w-full px-3 py-2 text-xs font-medium text-slate-700 hover:bg-blue-50 hover:text-blue-700 rounded-xl flex items-center gap-2.5 transition-colors cursor-pointer text-left"
                >
                  <User className="w-4 h-4 text-slate-400" />
                  <span>Quản lý tài khoản</span>
                </button>

                <button
                  onClick={() => {
                    setAvatarDropdownOpen(false);
                    if (onOpenAccountModal) onOpenAccountModal('security');
                  }}
                  className="w-full px-3 py-2 text-xs font-medium text-slate-700 hover:bg-blue-50 hover:text-blue-700 rounded-xl flex items-center gap-2.5 transition-colors cursor-pointer text-left"
                >
                  <Lock className="w-4 h-4 text-slate-400" />
                  <span>Đổi mật khẩu</span>
                </button>
              </div>

              {/* Sign Out */}
              <div className="pt-1 border-t border-slate-100">
                <button
                  onClick={() => {
                    setAvatarDropdownOpen(false);
                    if (onLogout) onLogout();
                  }}
                  className="w-full px-3 py-2 text-xs font-medium text-rose-600 hover:bg-rose-50 rounded-xl flex items-center gap-2.5 transition-colors cursor-pointer text-left"
                >
                  <LogOut className="w-4 h-4" />
                  <span>Đăng xuất</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
