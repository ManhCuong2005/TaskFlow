import React, { useEffect, useState } from 'react';
import { X, Sparkles, FolderKanban, CheckSquare, Calendar, UserCheck, Crown, Paperclip, FileText } from 'lucide-react';
import { fromDateTimeLocalString } from '../../utils/helpers';

export default function CreateTaskModal({
  isOpen,
  onClose,
  onCreateTask,
  currentUser,
  teamMembers = [],
  currentProject,
  initialAssigneeId = null,
}) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState('medium');
  const [dueDate, setDueDate] = useState('');
  const [selectedAssignees, setSelectedAssignees] = useState([]);
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen) setSelectedAssignees(initialAssigneeId == null ? [] : [initialAssigneeId]);
  }, [isOpen, initialAssigneeId, currentProject?.id]);

  if (!isOpen) return null;

  const isProjectLead = Boolean(currentProject && currentUser && String(currentProject.lead_id) === String(currentUser.id));
  const canAssignOthers = currentUser?.role === 'admin' || isProjectLead;

  const handleFileChange = (e) => {
    const files = Array.from(e.target.files);
    if (!files.length) return;
    setSelectedFiles((prev) => [...prev, ...files]);
    e.target.value = '';
  };

  const removeFile = (indexToRemove) => {
    setSelectedFiles((prev) => prev.filter((_, idx) => idx !== indexToRemove));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!title.trim()) {
      setError('Please provide a task summary.');
      return;
    }
    setError('');
    setLoading(true);
    try {
      await onCreateTask({
        title: title.trim(),
        description: description.trim(),
        priority,
        due_date: dueDate ? fromDateTimeLocalString(dueDate) : null,
        assignee_ids: selectedAssignees.length > 0 ? selectedAssignees : [currentUser.id],
        project_id: currentProject?.id,
        files: selectedFiles,
      });
      // Reset form
      setTitle('');
      setDescription('');
      setPriority('medium');
      setDueDate('');
      setSelectedAssignees([]);
      setSelectedFiles([]);
      onClose();
    } catch (err) {
      setError(err.message || 'Failed to create task');
    } finally {
      setLoading(false);
    }
  };

  const toggleAssignee = (userId) => {
    setSelectedAssignees((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]
    );
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs transition-opacity"
        onClick={onClose}
      />

      {/* Modal Dialog */}
      <div role="dialog" aria-modal="true" aria-labelledby="create-task-title" className="relative w-full max-w-xl bg-white rounded-2xl shadow-2xl border border-slate-200/80 z-10 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-blue-600" />
            <h2 id="create-task-title" className="text-base font-bold text-slate-900">Create Issue</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 text-xs bg-rose-50 border border-rose-200 text-rose-700 rounded-xl">
              {error}
            </div>
          )}

          {/* Project & Issue Type Info (Jira style) */}
          <div className="grid grid-cols-2 gap-3 p-3 bg-slate-50/70 rounded-xl border border-slate-100 text-xs">
            <div>
              <span className="text-slate-400 block mb-0.5 font-medium">Project</span>
              <div className="flex items-center gap-1.5 font-semibold text-slate-800">
                <FolderKanban className="w-3.5 h-3.5 text-blue-600" />
                <span>
                  {currentProject?.name || 'TaskFlow Cloud'} ({currentProject?.key || 'TF'})
                </span>
              </div>
            </div>
            <div>
              <span className="text-slate-400 block mb-0.5 font-medium">Your Role in Project</span>
              <div className="flex items-center gap-1.5 font-semibold text-blue-600">
                {isProjectLead ? (
                  <span className="text-amber-700 font-bold flex items-center gap-1">
                    <Crown className="w-3.5 h-3.5 text-amber-500" /> Project Lead
                  </span>
                ) : (
                  <span className="text-slate-700 font-medium">Team Member</span>
                )}
              </div>
            </div>
          </div>

          {/* Title */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
              Summary <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="What needs to be done?"
              className="w-full text-sm p-3 rounded-xl border border-slate-200 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none transition-all"
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
              Description
            </label>
            <textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Add additional details, acceptance criteria..."
              className="w-full text-xs p-3 rounded-xl border border-slate-200 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none transition-all resize-y"
            />
          </div>

          {/* Priority & Due Date */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Priority
              </label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value)}
                className="w-full text-xs p-2.5 rounded-xl border border-slate-200 bg-white font-medium text-slate-800 focus:outline-none focus:border-blue-500"
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Due Date & Time
              </label>
              <input
                type="datetime-local"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full text-xs p-2.5 rounded-xl border border-slate-200 bg-white font-medium text-slate-800 focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>

          {/* Assignees (Enabled for Project Lead or Admin) */}
          {canAssignOthers && teamMembers.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Assign Project Members
                </label>
                <span className="text-[10px] text-amber-600 font-semibold flex items-center gap-1">
                  <Crown className="w-3 h-3" /> Enabled by Project Lead
                </span>
              </div>
              <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto p-2 bg-slate-50/70 border border-slate-100 rounded-xl">
                {teamMembers.filter((member) => member.is_active !== false).map((m) => {
                  const isSelected = selectedAssignees.includes(m.id);
                  return (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => toggleAssignee(m.id)}
                      className={`px-2.5 py-1 text-xs rounded-lg border font-medium transition-all flex items-center gap-1.5 ${
                        isSelected
                          ? 'bg-blue-600 text-white border-blue-600 shadow-2xs'
                          : 'bg-white text-slate-700 border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      <UserCheck className="w-3 h-3" />
                      <span>{m.full_name}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Attachments (Optional / Không bắt buộc) */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                Attachments <span className="text-[10px] text-slate-400 font-normal lowercase">(không bắt buộc)</span>
              </label>
              <span className="text-[10px] text-slate-400">Tối đa 10MB/file</span>
            </div>

            <label className="flex flex-col items-center justify-center p-3 border-2 border-dashed border-slate-200 hover:border-blue-400 rounded-xl cursor-pointer bg-slate-50/70 hover:bg-blue-50/20 transition-all text-center group">
              <Paperclip className="w-4 h-4 text-slate-400 group-hover:text-blue-600 transition-colors mb-1" />
              <span className="text-xs font-semibold text-slate-700 group-hover:text-blue-600 transition-colors">
                Chọn file đính kèm
              </span>
              <span className="text-[10px] text-slate-400 mt-0.5">Hình ảnh, PDF, tài liệu văn bản (Word, Excel, Zip...)</span>
              <input
                type="file"
                multiple
                onChange={handleFileChange}
                className="hidden"
              />
            </label>

            {/* Selected files preview */}
            {selectedFiles.length > 0 && (
              <div className="mt-2 space-y-1.5 max-h-28 overflow-y-auto pr-1">
                {selectedFiles.map((f, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between p-2 rounded-lg bg-blue-50/50 border border-blue-100 text-xs text-slate-800"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <FileText className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                      <span className="font-medium truncate max-w-xs">{f.name}</span>
                      <span className="text-[10px] text-slate-400 shrink-0">
                        ({(f.size / 1024).toFixed(0)} KB)
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeFile(idx)}
                      className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded transition-colors cursor-pointer"
                      title="Xóa file này"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Modal Footer */}
          <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 rounded-xl transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white text-xs font-bold rounded-xl shadow-xs transition-all flex items-center gap-1.5"
            >
              {loading ? 'Creating...' : 'Create Issue'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
