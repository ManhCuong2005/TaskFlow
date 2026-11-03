import React, { useState, useEffect } from 'react';
import {
  X,
  Trash2,
  Calendar,
  Clock,
  User,
  Paperclip,
  MessageSquare,
  History,
  CheckCircle2,
  ChevronDown,
  Upload,
  Download,
  AlertTriangle,
  Flame,
  ArrowDown
} from 'lucide-react';
import {
  getTaskKey,
  getInitials,
  getAvatarColor,
  formatDate,
  formatDateTime,
  formatDueDateTime,
  toDateTimeLocalString,
  fromDateTimeLocalString,
  STATUS_CONFIG,
  PRIORITY_CONFIG
} from '../../utils/helpers';

export default function TaskDetailDrawer({
  task,
  onClose,
  onUpdateTask,
  onUpdateStatus,
  onDeleteTask,
  currentUser,
  teamMembers = [],
  currentProject,
  isProjectLead: propIsProjectLead,
  // Sub-resources
  comments = [],
  onAddComment,
  onDeleteComment,
  history = [],
  documents = [],
  onUploadDocument,
  onGetDocumentUrl,
  // Assignment actions
  assignments = [],
  onAssignUser,
  onRevokeAssignment,
}) {
  const [activeTab, setActiveTab] = useState('comments');
  const [title, setTitle] = useState(task?.title || '');
  const [description, setDescription] = useState(task?.description || '');
  const [priority, setPriority] = useState(task?.priority || 'medium');
  const [dueDate, setDueDate] = useState(
    task?.due_date ? toDateTimeLocalString(task.due_date) : ''
  );
  const [commentText, setCommentText] = useState('');
  const [selectedAssigneeId, setSelectedAssigneeId] = useState('');
  const [uploading, setUploading] = useState(false);
  const [isDirty, setIsDirty] = useState(false);

  useEffect(() => {
    if (task) {
      setTitle(task.title || '');
      setDescription(task.description || '');
      setPriority(task.priority || 'medium');
      setDueDate(task.due_date ? toDateTimeLocalString(task.due_date) : '');
      setIsDirty(false);
    }
  }, [task]);

  if (!task) return null;

  const handleSaveMain = async () => {
    await onUpdateTask(task.id, {
      title,
      description,
      priority,
      due_date: dueDate ? fromDateTimeLocalString(dueDate) : null,
    });
    setIsDirty(false);
  };

  const handleAddCommentSubmit = async (e) => {
    e.preventDefault();
    if (!commentText.trim()) return;
    await onAddComment(task.id, commentText);
    setCommentText('');
  };

  const handleFileUpload = async (e) => {
    const files = Array.from(e.target.files);
    if (!files.length) return;
    setUploading(true);
    try {
      await onUploadDocument(task.id, files);
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  const handleAssignSubmit = async () => {
    if (!selectedAssigneeId) return;
    await onAssignUser(task.id, parseInt(selectedAssigneeId, 10));
    setSelectedAssigneeId('');
  };

  const isProjectLead = Boolean(
    propIsProjectLead ||
    (currentProject && currentUser && String(currentProject.lead_id) === String(currentUser.id)) ||
    (task?.project_lead_id && currentUser && String(task.project_lead_id) === String(currentUser.id))
  );
  const canEdit = currentUser?.role === 'admin' || isProjectLead;
  const canDelete = currentUser?.role === 'admin' || isProjectLead;
  const canManageAssignments = currentUser?.role === 'admin' || isProjectLead;
  const membership = teamMembers.find(member => String(member.id) === String(currentUser?.id));
  const canComment = canEdit || membership?.can_comment !== false;
  const isAssignee = assignments.some(assignment => String(assignment.user_id) === String(currentUser?.id));
  const canUpdateStatus = canEdit || (isAssignee && membership?.can_update_status !== false);

  return (
    <div className="fixed inset-0 z-50 overflow-hidden flex justify-end">
      {/* Backdrop overlay */}
      <div
        className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs transition-opacity duration-300"
        onClick={onClose}
      />

      {/* Slide-Over Drawer Content */}
      <div className="relative w-full max-w-2xl bg-white shadow-2xl h-full flex flex-col z-10 animate-in slide-in-from-right duration-300">
        {/* Drawer Top Header */}
        <div className="px-6 py-4 border-b border-slate-200/80 flex items-center justify-between gap-4 bg-slate-50/50">
          <div className="flex items-center gap-3">
            <span className="font-mono font-bold text-sm text-blue-600 bg-blue-50 px-2 py-1 rounded-md border border-blue-200/60">
              {getTaskKey(task.id)}
            </span>

            {/* Quick Status Pill Dropdown */}
            <select
              value={task.overall_status === 'unassigned' ? 'todo' : task.overall_status}
              disabled={!canUpdateStatus}
              title={canUpdateStatus ? 'Cập nhật trạng thái' : 'Bạn chưa có quyền cập nhật trạng thái công việc này'}
              onChange={(e) => onUpdateStatus(task.id, e.target.value)}
              className="text-xs font-semibold px-2.5 py-1 rounded-full border border-slate-200 bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer shadow-2xs"
            >
              <option value="todo">To Do</option>
              <option value="in_progress">In Progress</option>
              <option value="completed">Done</option>
            </select>
          </div>

          <div className="flex items-center gap-2">
            {canDelete && (
              <button
                onClick={() => {
                  if (window.confirm(`Delete ${getTaskKey(task.id)}?`)) {
                    onDeleteTask(task.id);
                    onClose();
                  }
                }}
                className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                title="Delete issue"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
              title="Close drawer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Drawer Body - Split into Content & Metadata Sidebar */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Title input */}
          <div>
            <label className="text-[11px] font-bold uppercase text-slate-400 tracking-wider mb-1 block">
              Issue Title
            </label>
            <input
              type="text"
              value={title}
              disabled={!canEdit}
              onChange={(e) => {
                setTitle(e.target.value);
                setIsDirty(true);
              }}
              className="w-full text-lg font-bold text-slate-900 border-b border-transparent hover:border-slate-300 focus:border-blue-500 focus:outline-none py-1 transition-colors disabled:bg-transparent"
              placeholder="Task summary"
            />
          </div>

          {/* Description area */}
          <div>
            <label className="text-[11px] font-bold uppercase text-slate-400 tracking-wider mb-1 block">
              Description
            </label>
            <textarea
              rows={4}
              value={description}
              disabled={!canEdit}
              onChange={(e) => {
                setDescription(e.target.value);
                setIsDirty(true);
              }}
              placeholder="Add a more detailed description..."
              className="w-full text-sm text-slate-800 p-3 rounded-xl border border-slate-200 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none transition-all resize-y disabled:bg-slate-50"
            />
          </div>

          {/* Save Button if Dirty */}
          {isDirty && (
            <div className="flex items-center gap-2">
              <button
                onClick={handleSaveMain}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-xl shadow-xs transition-all"
              >
                Save Changes
              </button>
              <button
                onClick={() => {
                  setTitle(task.title || '');
                  setDescription(task.description || '');
                  setPriority(task.priority || 'medium');
                  setDueDate(task.due_date ? toDateTimeLocalString(task.due_date) : '');
                  setIsDirty(false);
                }}
                className="px-3 py-2 text-slate-500 hover:text-slate-800 text-xs font-semibold rounded-xl"
              >
                Cancel
              </button>
            </div>
          )}

          {/* Issue Attributes Grid */}
          <div className="grid grid-cols-2 gap-4 p-4 rounded-2xl bg-slate-50/70 border border-slate-200/80 text-xs">
            {/* Priority */}
            <div>
              <span className="text-slate-400 font-medium block mb-1">Priority</span>
              <select
                value={priority}
                disabled={!canEdit}
                onChange={(e) => {
                  setPriority(e.target.value);
                  setIsDirty(true);
                }}
                className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white font-semibold capitalize text-slate-800"
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>
            </div>

            {/* Due Date & Time */}
            <div>
              <span className="text-slate-400 font-medium block mb-1">Due Date & Time</span>
              <input
                type="datetime-local"
                value={dueDate}
                disabled={!canEdit}
                onChange={(e) => {
                  setDueDate(e.target.value);
                  setIsDirty(true);
                }}
                className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white font-medium text-slate-800 disabled:bg-slate-100"
              />
            </div>

            {/* Reporter */}
            <div>
              <span className="text-slate-400 font-medium block mb-1">Reporter</span>
              <div className="flex items-center gap-2 text-slate-700 font-semibold mt-1">
                <div
                  className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${getAvatarColor(
                    task.creator_name
                  )}`}
                >
                  {getInitials(task.creator_name)}
                </div>
                <span>{task.creator_name || 'Admin'}</span>
              </div>
            </div>

            {/* Created At */}
            <div>
              <span className="text-slate-400 font-medium block mb-1">Created At</span>
              <span className="text-slate-700 font-medium block mt-1">
                {formatDate(task.created_at)}
              </span>
            </div>
          </div>

          {/* Assigned Members Section */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                Assigned Members ({(assignments || []).length})
              </span>
            </div>

            {/* List of current assignments */}
            <div className="space-y-1.5">
              {(assignments || []).length === 0 ? (
                <div className="text-xs text-slate-400 italic">No members assigned yet.</div>
              ) : (
                assignments.map((a) => {
                  const memberName = a.full_name || a.assignee_name || a.email || a.assignee_email || 'Member';
                  return (
                    <div
                      key={a.id}
                      className="flex items-center justify-between p-2 rounded-xl bg-slate-50 border border-slate-200/70 text-xs"
                    >
                      <div className="flex items-center gap-2">
                        <div
                          className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold ${getAvatarColor(
                            memberName
                          )}`}
                        >
                          {getInitials(memberName)}
                        </div>
                        <span className="font-semibold text-slate-900">{memberName}</span>
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-200 text-slate-700 capitalize">
                          {a.status}
                        </span>
                      </div>

                      {canManageAssignments && (
                        <button
                          onClick={() => onRevokeAssignment(task.id, a.id)}
                          className="text-[11px] text-rose-500 hover:text-rose-700 font-medium cursor-pointer"
                        >
                          Revoke
                        </button>
                      )}
                    </div>
                  );
                })
              )}
            </div>

            {/* Add assignee for Project Lead or Admin */}
            {canManageAssignments && (
              <div className="flex items-center gap-2 pt-1">
                <select
                  value={selectedAssigneeId}
                  onChange={(e) => setSelectedAssigneeId(e.target.value)}
                  className="flex-1 px-3 py-1.5 text-xs rounded-xl border border-slate-200 bg-white"
                >
                  <option value="">+ Assign member to this task...</option>
                  {teamMembers
                    .filter((m) => m.is_active !== false && !assignments.some((a) => String(a.user_id) === String(m.id)))
                    .map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.full_name} ({m.email})
                      </option>
                    ))}
                </select>
                <button
                  onClick={handleAssignSubmit}
                  disabled={!selectedAssigneeId}
                  className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white text-xs font-semibold rounded-xl shadow-xs"
                >
                  Assign
                </button>
              </div>
            )}
          </div>

          {/* Sub-Tabs: Comments, History, Documents */}
          <div className="pt-4 border-t border-slate-200">
            {/* Tab navigation buttons */}
            <div className="flex items-center gap-4 border-b border-slate-200 pb-2 mb-4">
              <button
                onClick={() => setActiveTab('comments')}
                className={`flex items-center gap-1.5 text-xs font-bold pb-1 transition-all ${
                  activeTab === 'comments'
                    ? 'text-blue-600 border-b-2 border-blue-600'
                    : 'text-slate-400 hover:text-slate-700'
                }`}
              >
                <MessageSquare className="w-3.5 h-3.5" />
                <span>Comments ({(comments || []).length})</span>
              </button>

              <button
                onClick={() => setActiveTab('history')}
                className={`flex items-center gap-1.5 text-xs font-bold pb-1 transition-all ${
                  activeTab === 'history'
                    ? 'text-blue-600 border-b-2 border-blue-600'
                    : 'text-slate-400 hover:text-slate-700'
                }`}
              >
                <History className="w-3.5 h-3.5" />
                <span>History</span>
              </button>

              <button
                onClick={() => setActiveTab('documents')}
                className={`flex items-center gap-1.5 text-xs font-bold pb-1 transition-all ${
                  activeTab === 'documents'
                    ? 'text-blue-600 border-b-2 border-blue-600'
                    : 'text-slate-400 hover:text-slate-700'
                }`}
              >
                <Paperclip className="w-3.5 h-3.5" />
                <span>Attachments ({(documents || []).length})</span>
              </button>
            </div>

            {/* Comments Tab View */}
            {activeTab === 'comments' && (
              <div className="space-y-4">
                {/* Comment input box */}
                {canComment ? <form onSubmit={handleAddCommentSubmit} className="space-y-2">
                  <textarea
                    rows={2}
                    value={commentText}
                    onChange={(e) => setCommentText(e.target.value)}
                    placeholder="Write a comment..."
                    className="w-full text-xs p-3 rounded-xl border border-slate-200 focus:border-blue-500 focus:outline-none transition-all"
                  />
                  <div className="flex justify-end">
                    <button
                      type="submit"
                      disabled={!commentText.trim()}
                      className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white text-xs font-semibold rounded-xl shadow-xs"
                    >
                      Save comment
                    </button>
                  </div>
                </form> : <p className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs leading-5 text-slate-500">Leader chưa cấp quyền viết bình luận trong dự án này. Bạn vẫn có thể đọc nội dung trao đổi.</p>}

                {/* Comment list */}
                <div className="space-y-3 pt-2">
                  {(comments || []).length === 0 ? (
                    <div className="text-center py-6 text-xs text-slate-400">
                      No comments yet. Start the conversation!
                    </div>
                  ) : (
                    comments.map((c) => (
                      <div
                        key={c.id}
                        className="p-3 rounded-xl bg-slate-50 border border-slate-100 flex items-start gap-3 text-xs"
                      >
                        <div
                          className={`w-7 h-7 rounded-full flex items-center justify-center font-bold text-[10px] shrink-0 ${getAvatarColor(
                            c.author_name
                          )}`}
                        >
                          {getInitials(c.author_name)}
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center justify-between mb-1">
                            <span className="font-semibold text-slate-900">{c.author_name}</span>
                            <span className="text-[10px] text-slate-400">
                              {formatDateTime(c.created_at)}
                            </span>
                          </div>
                          <p className="text-slate-700 whitespace-pre-wrap">{c.content}</p>
                        </div>
                        {(currentUser?.role === 'admin' || c.user_id === currentUser?.id) && (
                          <button
                            onClick={() => onDeleteComment(task.id, c.id)}
                            className="text-slate-400 hover:text-rose-500 p-1"
                            title="Delete comment"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

            {/* History Tab View */}
            {activeTab === 'history' && (
              <div className="space-y-2">
                {(history || []).length === 0 ? (
                  <div className="text-center py-6 text-xs text-slate-400">
                    No status history recorded yet.
                  </div>
                ) : (
                  history.map((h, i) => (
                    <div
                      key={i}
                      className="flex items-start gap-2 p-2.5 rounded-xl border border-slate-100 text-xs text-slate-700"
                    >
                      <Clock className="w-3.5 h-3.5 text-blue-500 shrink-0 mt-0.5" />
                      <div className="flex-1">
                        <div className="font-medium">
                          {h.changer_name || 'System'}{' '}
                          {h.old_status ? (
                            <>
                              changed status from{' '}
                              <span className="font-semibold text-slate-900">{h.old_status}</span> to{' '}
                              <span className="font-semibold text-blue-600">{h.new_status}</span>
                            </>
                          ) : (
                            <>
                              set status to{' '}
                              <span className="font-semibold text-blue-600">{h.new_status}</span>
                            </>
                          )}
                        </div>
                        {h.note && <div className="text-slate-500 text-[11px] mt-0.5">{h.note}</div>}
                        <div className="text-[10px] text-slate-400 mt-1">
                          {formatDateTime(h.changed_at)}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}

            {/* Documents Tab View */}
            {activeTab === 'documents' && (
              <div className="space-y-4">
                {/* Upload box */}
                <label className="flex flex-col items-center justify-center p-4 border-2 border-dashed border-slate-200 hover:border-blue-400 rounded-xl cursor-pointer bg-slate-50 hover:bg-blue-50/30 transition-all text-center">
                  <Upload className="w-6 h-6 text-slate-400 mb-1" />
                  <span className="text-xs font-semibold text-slate-700">
                    {uploading ? 'Uploading...' : 'Click or drop files to upload'}
                  </span>
                  <span className="text-[11px] text-slate-400 mt-0.5">Max 10MB per file</span>
                  <input
                    type="file"
                    multiple
                    disabled={uploading}
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                </label>

                {/* List documents */}
                <div className="space-y-2">
                  {(documents || []).length === 0 ? (
                    <div className="text-center py-4 text-xs text-slate-400">
                      No attachments uploaded yet.
                    </div>
                  ) : (
                    documents.map((doc) => (
                      <div
                        key={doc.id}
                        className="flex items-center justify-between p-2.5 rounded-xl border border-slate-200 bg-white text-xs"
                      >
                        <div className="flex items-center gap-2 truncate mr-2">
                          <Paperclip className="w-4 h-4 text-slate-400 shrink-0" />
                          <span className="font-medium text-slate-800 truncate">
                            {doc.original_filename}
                          </span>
                        </div>
                        <button
                          onClick={() => onGetDocumentUrl(task.id, doc.id)}
                          className="flex items-center gap-1 text-blue-600 hover:text-blue-800 font-semibold px-2 py-1 rounded"
                        >
                          <Download className="w-3.5 h-3.5" />
                          <span>Download</span>
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
