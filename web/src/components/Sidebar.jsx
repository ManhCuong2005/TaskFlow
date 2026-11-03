import React, { useState } from 'react';
import {
  LayoutDashboard,
  Kanban,
  ListTodo,
  Users,
  User,
  LogOut,
  Layers,
  ChevronLeft,
  ChevronRight,
  PlusCircle,
  FolderKanban,
  ChevronDown,
  FolderPlus,
  ShieldCheck,
  Crown,
  Activity,
  Server,
  Trash2
} from 'lucide-react';
import { getInitials, getAvatarColor } from '../utils/helpers';

export default function Sidebar({
  activeTab,
  setActiveTab,
  currentUser,
  onLogout,
  onOpenCreateModal,
  onOpenCreateProjectModal,
  collapsed,
  setCollapsed,
  projects = [],
  currentProject,
  onSelectProject,
  onDeleteProject,
  onOpenAccountModal,
}) {
  const [projectDropdownOpen, setProjectDropdownOpen] = useState(false);

  const isAdmin = currentUser?.role === 'admin';
  const isProjectLead = Boolean(currentProject && currentUser && String(currentProject.lead_id) === String(currentUser.id));

  // Distinct Nav items for Admin vs Employee
  const adminNavItems = [
    { id: 'admin_overview', label: 'System Overview', icon: Activity },
    { id: 'admin_users', label: 'User Accounts', icon: Users },
    { id: 'admin_projects', label: 'Project Governance', icon: FolderKanban },
    { id: 'admin_infra', label: 'Cloud Telemetry', icon: Server },
    { id: 'profile', label: 'Admin Profile', icon: User },
  ];

  const employeeNavItems = [
    ...(isProjectLead ? [{ id: 'leader', label: 'Quản lý dự án', icon: Crown }] : []),
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'board', label: 'Kanban Board', icon: Kanban },
    { id: 'tasks', label: 'All Tasks', icon: ListTodo },
    {
      id: 'team',
      label: isProjectLead ? 'Project Members (Lead)' : 'Project Team',
      icon: Users,
    },
    { id: 'profile', label: 'My Profile', icon: User },
  ];

  const navItems = isAdmin ? adminNavItems : employeeNavItems;

  return (
    <aside
      className={`relative flex flex-col border-r border-slate-200/80 bg-white transition-all duration-300 select-none z-20 shrink-0 ${
        collapsed ? 'w-20' : 'w-64'
      }`}
    >
      {/* Floating Jira-Style Collapse / Expand Toggle Button */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="absolute -right-3 top-5 w-6 h-6 bg-white border border-slate-200 rounded-full flex items-center justify-center text-slate-500 hover:text-slate-900 shadow-sm hover:shadow hover:scale-110 z-30 transition-all cursor-pointer"
        title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
      >
        {collapsed ? <ChevronRight className="w-3.5 h-3.5" /> : <ChevronLeft className="w-3.5 h-3.5" />}
      </button>

      {/* Brand Header */}
      <div
        className={`flex items-center h-16 border-b border-slate-200/80 transition-all overflow-hidden ${
          collapsed ? 'justify-center px-2' : 'justify-start px-4'
        }`}
      >
        {collapsed ? (
          <button
            onClick={() => setCollapsed(false)}
            className={`flex items-center justify-center w-10 h-10 rounded-xl text-white shadow-md transition-all hover:scale-105 active:scale-95 cursor-pointer shrink-0 ${
              isAdmin
                ? 'bg-gradient-to-tr from-purple-700 to-indigo-700 shadow-purple-500/20'
                : 'bg-gradient-to-tr from-blue-600 to-indigo-600 shadow-blue-500/20'
            }`}
            title="Click to expand sidebar"
          >
            {isAdmin ? <ShieldCheck className="w-5 h-5" /> : <Layers className="w-5 h-5" />}
          </button>
        ) : (
          <div className="flex items-center gap-3 overflow-hidden">
            <div
              className={`flex items-center justify-center w-10 h-10 rounded-xl text-white shadow-md shrink-0 ${
                isAdmin
                  ? 'bg-gradient-to-tr from-purple-700 to-indigo-700 shadow-purple-500/20'
                  : 'bg-gradient-to-tr from-blue-600 to-indigo-600 shadow-blue-500/20'
              }`}
            >
              {isAdmin ? <ShieldCheck className="w-5 h-5" /> : <Layers className="w-5 h-5" />}
            </div>
            <div className="flex flex-col truncate">
              <span className="font-bold text-base text-slate-900 tracking-tight flex items-center gap-1.5">
                TaskFlow
                <span
                  className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded border ${
                    isAdmin
                      ? 'bg-purple-100 text-purple-700 border-purple-200'
                      : 'bg-blue-50 text-blue-600 border-blue-200/60'
                  }`}
                >
                  {isAdmin ? 'Admin' : 'Cloud'}
                </span>
              </span>
              <span className="text-xs text-slate-500 truncate">
                {isAdmin ? 'Management Console' : 'Jira Workspace'}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Project Switcher for Employees ONLY */}
      {!isAdmin && !collapsed && (
        <div className="relative px-3 py-2.5 border-b border-slate-100 bg-slate-50/60">
          {!currentProject || projects.length === 0 ? (
            <button
              onClick={onOpenCreateProjectModal}
              className="flex items-center justify-between gap-2 w-full p-2.5 rounded-xl bg-blue-50/70 border border-dashed border-blue-300 hover:bg-blue-100/60 hover:border-blue-400 transition-all text-left group cursor-pointer"
              title="Nhấn để tạo dự án mới"
            >
              <div className="flex items-center gap-2.5 truncate">
                <div className="w-7 h-7 rounded-lg bg-blue-100 text-blue-600 flex items-center justify-center shrink-0">
                  <FolderPlus className="w-4 h-4" />
                </div>
                <div className="truncate">
                  <div className="text-xs font-bold text-blue-800 truncate">Chưa có dự án</div>
                  <div className="text-[10px] text-blue-600 truncate">+ Tạo dự án mới</div>
                </div>
              </div>
            </button>
          ) : (
            <button
              onClick={() => setProjectDropdownOpen(!projectDropdownOpen)}
              className="flex items-center justify-between gap-2 w-full p-2 rounded-xl bg-white border border-slate-200 hover:border-blue-400 shadow-2xs transition-all text-left group cursor-pointer"
            >
              <div className="flex items-center gap-2.5 truncate">
                <div className="w-7 h-7 rounded-lg bg-blue-50 text-blue-700 font-bold text-xs flex items-center justify-center shrink-0 border border-blue-200/60">
                  {currentProject.key}
                </div>
                <div className="truncate">
                  <div className="text-xs font-bold text-slate-900 group-hover:text-blue-600 truncate flex items-center gap-1">
                    <span>{currentProject.name}</span>
                  </div>
                  <div className="text-[10px] text-slate-500 flex items-center gap-1 truncate">
                    {isProjectLead ? (
                      <span className="font-bold text-amber-600 flex items-center gap-0.5">
                        <Crown className="w-3 h-3" /> You are Lead
                      </span>
                    ) : (
                      <span>Lead: {currentProject.lead_name || 'Project Lead'}</span>
                    )}
                  </div>
                </div>
              </div>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            </button>
          )}

          {projectDropdownOpen && currentProject && (
            <div className="absolute top-full left-3 right-3 mt-1 bg-white border border-slate-200 rounded-2xl shadow-xl z-30 p-2 space-y-1 animate-in fade-in zoom-in-95 duration-150">
              <div className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Switch Projects
              </div>

              <div className="max-h-48 overflow-y-auto space-y-1">
                {projects.map((p) => {
                  const isSelected = p.id === currentProject?.id;
                  const isUserLead = String(p.lead_id) === String(currentUser?.id);
                  return (
                    <button
                      key={p.id}
                      onClick={() => {
                        onSelectProject(p);
                        setProjectDropdownOpen(false);
                      }}
                      className={`w-full p-2 rounded-xl text-left text-xs flex items-center justify-between transition-all cursor-pointer ${
                        isSelected
                          ? 'bg-blue-50 text-blue-700 font-bold border border-blue-200/60'
                          : 'hover:bg-slate-50 text-slate-700'
                      }`}
                    >
                      <div className="flex items-center gap-2 truncate">
                        <span className="font-mono font-bold text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-700">
                          {p.key}
                        </span>
                        <span className="truncate">{p.name}</span>
                      </div>
                      {isUserLead && (
                        <span className="text-[9px] bg-amber-100 text-amber-800 font-bold px-1.5 py-0.5 rounded-full flex items-center gap-0.5 shrink-0">
                          <Crown className="w-2.5 h-2.5" /> Lead
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Quick Action Button - ONLY FOR PROJECT LEAD */}
      {!isAdmin && isProjectLead && (
        <div className="p-3">
          <button
            onClick={onOpenCreateModal}
            className={`flex items-center justify-center gap-2 w-full py-2.5 px-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium shadow-sm transition-all hover:shadow-md hover:shadow-blue-500/20 active:scale-[0.98] cursor-pointer ${
              collapsed ? 'px-0' : ''
            }`}
            title="Tạo Issue mới (Project Lead)"
          >
            <PlusCircle className="w-4 h-4 shrink-0" />
            {!collapsed && <span>Create Issue</span>}
          </button>
        </div>
      )}

      {/* Navigation Links */}
      <nav className="flex-1 px-3 py-3 space-y-1 overflow-y-auto">
        {!collapsed && (
          <div className="px-3 pb-2 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
            {isAdmin ? 'System Governance' : 'Workspace'}
          </div>
        )}
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`flex items-center gap-3 w-full px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                isActive
                  ? isAdmin
                    ? 'bg-purple-100 text-purple-900 font-bold shadow-xs'
                    : 'bg-blue-50 text-blue-700 font-bold shadow-xs'
                  : 'text-slate-600 hover:bg-slate-100/80 hover:text-slate-900'
              } ${collapsed ? 'justify-center px-0' : ''}`}
              title={collapsed ? item.label : undefined}
            >
              <Icon
                className={`w-5 h-5 shrink-0 ${
                  isActive ? (isAdmin ? 'text-purple-700' : 'text-blue-600') : 'text-slate-400'
                }`}
              />
              {!collapsed && (
                <div className="flex-1 flex items-center justify-between text-left truncate">
                  <span>{item.label}</span>
                  {item.badge && (
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-700">
                      {item.badge}
                    </span>
                  )}
                </div>
              )}
            </button>
          );
        })}
      </nav>

      {/* User Footer Profile */}
      <div className="p-3 border-t border-slate-200/80 bg-slate-50/60">
        <div className={`flex items-center gap-3 ${collapsed ? 'justify-center' : ''}`}>
          <button
            onClick={() => onOpenAccountModal && onOpenAccountModal('profile')}
            className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-xs shrink-0 shadow-xs cursor-pointer hover:ring-2 hover:ring-blue-400 transition-all ${getAvatarColor(
              currentUser?.full_name
            )}`}
            title="Quản lý tài khoản cá nhân"
          >
            {getInitials(currentUser?.full_name)}
          </button>
          {!collapsed && (
            <div
              onClick={() => onOpenAccountModal && onOpenAccountModal('profile')}
              className="flex-1 truncate cursor-pointer group"
              title="Quản lý tài khoản cá nhân"
            >
              <div className="text-xs font-semibold text-slate-900 group-hover:text-blue-600 truncate transition-colors">
                {currentUser?.full_name || 'User'}
              </div>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span
                  className={`text-[10px] font-bold px-1.5 py-0.2 rounded uppercase ${
                    isAdmin
                      ? 'bg-purple-100 text-purple-700'
                      : 'bg-slate-200 text-slate-700'
                  }`}
                >
                  {isAdmin ? 'System Admin' : 'User'}
                </span>
                <span className="text-[11px] text-slate-400 truncate">{currentUser?.email}</span>
              </div>
            </div>
          )}
          {!collapsed && (
            <button
              onClick={onLogout}
              className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
              title="Sign out"
            >
              <LogOut className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </aside>
  );
}
