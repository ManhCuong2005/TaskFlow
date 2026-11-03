import React, { useState } from 'react';
import {
  Flame,
  AlertTriangle,
  ArrowDown,
  Clock,
  Plus,
  MoreHorizontal,
  CheckCircle2,
  Calendar,
  Layers,
  Sparkles,
  Trash2
} from 'lucide-react';
import {
  getTaskKey,
  getInitials,
  getAvatarColor,
  formatDate,
  formatDueDateTime,
  isOverdue,
  PRIORITY_CONFIG
} from '../../utils/helpers';

export default function KanbanBoard({
  tasks = [],
  onSelectTask,
  onUpdateTaskStatus,
  onOpenCreateModal,
  onDeleteTask,
  loading,
  isProjectLead = false,
  canUpdateTask = () => true,
}) {
  const [draggedTaskId, setDraggedTaskId] = useState(null);
  const [dragOverColumn, setDragOverColumn] = useState(null);

  // Group tasks into the 3 Kanban columns
  const columns = [
    {
      id: 'todo',
      title: 'To Do',
      color: 'border-t-slate-400',
      badgeBg: 'bg-slate-100 text-slate-700',
      description: 'Tasks waiting to be started',
      // We map 'unassigned' and 'todo' to To Do column
      matcher: (task) => task.overall_status === 'todo' || task.overall_status === 'unassigned',
    },
    {
      id: 'in_progress',
      title: 'In Progress',
      color: 'border-t-blue-500',
      badgeBg: 'bg-blue-100 text-blue-700',
      description: 'Tasks currently actively worked on',
      matcher: (task) => task.overall_status === 'in_progress',
    },
    {
      id: 'completed',
      title: 'Done',
      color: 'border-t-emerald-500',
      badgeBg: 'bg-emerald-100 text-emerald-700',
      description: 'Completed and verified tasks',
      matcher: (task) => task.overall_status === 'completed',
    },
  ];

  // Drag and drop handlers
  const handleDragStart = (e, taskId) => {
    setDraggedTaskId(taskId);
    e.dataTransfer.setData('text/plain', taskId.toString());
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e, columnId) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragOverColumn !== columnId) {
      setDragOverColumn(columnId);
    }
  };

  const handleDragLeave = () => {
    setDragOverColumn(null);
  };

  const handleDrop = (e, targetStatus) => {
    e.preventDefault();
    setDragOverColumn(null);
    const taskId = e.dataTransfer.getData('text/plain') || draggedTaskId;
    if (taskId) {
      onUpdateTaskStatus(parseInt(taskId, 10), targetStatus);
    }
    setDraggedTaskId(null);
  };

  const getPriorityIcon = (priority) => {
    switch (priority) {
      case 'high':
        return <Flame className="w-3.5 h-3.5 text-rose-500 shrink-0" />;
      case 'medium':
        return <AlertTriangle className="w-3.5 h-3.5 text-amber-500 shrink-0" />;
      default:
        return <ArrowDown className="w-3.5 h-3.5 text-emerald-500 shrink-0" />;
    }
  };

  return (
    <div className="flex-1 p-6 overflow-x-auto min-w-0">
      {/* Board Header Bar */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            TaskFlow Board
            <span className="text-xs font-normal text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
              {tasks.length} issues
            </span>
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Drag and drop cards across columns to update issue progression instantly.
          </p>
        </div>

        {isProjectLead && (
          <button
            onClick={onOpenCreateModal}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 shadow-2xs transition-all"
          >
            <Sparkles className="w-3.5 h-3.5 text-blue-600" />
            <span>New Issue</span>
          </button>
        )}
      </div>

      {/* Board Columns Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5 items-start min-w-[850px] pb-10">
        {columns.map((column) => {
          const columnTasks = tasks.filter(column.matcher);
          const isOver = dragOverColumn === column.id;

          return (
            <div
              key={column.id}
              onDragOver={(e) => handleDragOver(e, column.id)}
              onDragLeave={handleDragLeave}
              onDrop={(e) => handleDrop(e, column.id)}
              className={`flex flex-col rounded-2xl bg-slate-100/90 border border-slate-200/80 p-3 min-h-[580px] max-h-[calc(100vh-180px)] transition-all ${
                isOver ? 'bg-blue-50/80 ring-2 ring-blue-400 border-blue-300' : ''
              }`}
            >
              {/* Column Header */}
              <div className="flex items-center justify-between px-2 py-2 mb-2">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-xs tracking-wider uppercase text-slate-700">
                    {column.title}
                  </span>
                  <span
                    className={`text-xs font-bold px-2 py-0.5 rounded-full ${column.badgeBg}`}
                  >
                    {columnTasks.length}
                  </span>
                </div>
                {isProjectLead && (
                  <button
                    onClick={onOpenCreateModal}
                    className="p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-200/70 rounded-md transition-colors"
                    title={`Add task to ${column.title}`}
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                )}
              </div>

              {/* Cards Container */}
              <div className="flex-1 overflow-y-auto space-y-2.5 pr-1">
                {columnTasks.length === 0 ? (
                  <div className="flex flex-col items-center justify-center p-8 border-2 border-dashed border-slate-200 rounded-xl text-center text-slate-400 my-2">
                    <Layers className="w-7 h-7 stroke-1 text-slate-300 mb-2" />
                    <span className="text-xs font-medium">No tasks in {column.title}</span>
                    <span className="text-[11px] text-slate-400 mt-0.5">
                      Drop cards here or click + above
                    </span>
                  </div>
                ) : (
                  columnTasks.map((task) => {
                    const isDragging = draggedTaskId === task.id;
                    const overdue = isOverdue(task.due_date, task.overall_status);
                    const assignees = task.assignees || [];

                    return (
                      <div
                        key={task.id}
                        draggable={canUpdateTask(task)}
                        onDragStart={(e) => handleDragStart(e, task.id)}
                        onClick={() => onSelectTask(task)}
                        className={`group relative bg-white p-3.5 rounded-xl border border-slate-200/90 shadow-2xs hover:shadow-md hover:border-blue-400/80 cursor-grab active:cursor-grabbing transition-all select-none ${
                          isDragging ? 'opacity-40 scale-95 border-blue-400' : ''
                        }`}
                      >
                        {/* Task Top: Key & Priority */}
                        <div className="flex items-center justify-between gap-2 mb-2">
                          <span className="text-[11px] font-mono font-bold text-blue-600 bg-blue-50 hover:bg-blue-100 px-1.5 py-0.5 rounded tracking-wide">
                            {getTaskKey(task.id)}
                          </span>

                          <div className="flex items-center gap-1.5">
                            {/* Priority badge */}
                            <span
                              className={`flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-md border ${
                                PRIORITY_CONFIG[task.priority]?.color || ''
                              }`}
                            >
                              {getPriorityIcon(task.priority)}
                              <span className="capitalize">{task.priority}</span>
                            </span>

                            {isProjectLead && onDeleteTask && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (window.confirm(`Delete ${getTaskKey(task.id)}: "${task.title}"?`)) {
                                    onDeleteTask(task.id);
                                  }
                                }}
                                className="opacity-0 group-hover:opacity-100 p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded transition-all cursor-pointer"
                                title="Delete task (Leader)"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Task Title */}
                        <h3 className="font-semibold text-sm text-slate-900 group-hover:text-blue-600 transition-colors line-clamp-2 leading-snug mb-1">
                          {task.title}
                        </h3>

                        {/* Description Preview (if any) */}
                        {task.description && (
                          <p className="text-xs text-slate-500 line-clamp-2 mb-3 leading-relaxed">
                            {task.description}
                          </p>
                        )}

                        {/* Task Footer: Due Date & Assignees */}
                        <div className="flex items-center justify-between pt-2 border-t border-slate-100/90 mt-2">
                          {/* Due Date */}
                          <div
                            className={`flex items-center gap-1 text-[11px] font-medium ${
                              overdue
                                ? 'text-rose-600 font-semibold'
                                : 'text-slate-500'
                            }`}
                            title={overdue ? 'Overdue deadline!' : 'Due date'}
                          >
                            <Calendar className="w-3.5 h-3.5" />
                            <span>{formatDueDateTime(task.due_date)}</span>
                          </div>

                          {/* Assignees stack */}
                          <div className="flex items-center -space-x-1.5">
                            {assignees.length > 0 ? (
                              assignees.slice(0, 3).map((a, idx) => (
                                <div
                                  key={idx}
                                  className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold ring-2 ring-white shadow-2xs ${getAvatarColor(
                                    a.full_name
                                  )}`}
                                  title={`${a.full_name} (${a.status || 'assigned'})`}
                                >
                                  {getInitials(a.full_name)}
                                </div>
                              ))
                            ) : (
                              <span className="text-[10px] text-slate-400 bg-slate-50 px-1.5 py-0.5 rounded border border-slate-200">
                                Unassigned
                              </span>
                            )}
                            {assignees.length > 3 && (
                              <span className="w-6 h-6 rounded-full bg-slate-200 text-slate-700 text-[10px] font-bold flex items-center justify-center ring-2 ring-white">
                                +{assignees.length - 3}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Quick Add Button at bottom of column */}
              {isProjectLead && (
                <button
                  onClick={onOpenCreateModal}
                  className="mt-2 w-full py-2 px-3 text-xs font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-200/60 rounded-xl flex items-center justify-center gap-1.5 transition-colors border border-transparent hover:border-slate-300/80 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Create issue</span>
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
