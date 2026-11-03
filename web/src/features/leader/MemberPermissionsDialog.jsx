import { useEffect, useRef, useState } from 'react';
import {
  Check,
  Loader2,
  LockKeyhole,
  MessageSquare,
  ShieldCheck,
  X
} from 'lucide-react';

const permissions = [
  {
    key: 'can_update_status',
    label: 'Cập nhật trạng thái',
    description:
      'Chuyển trạng thái phần việc được giao giữa Chờ làm, Đang làm và Hoàn thành.',
    icon: Check
  },
  {
    key: 'can_comment',
    label: 'Viết bình luận',
    description:
      'Thêm và chỉnh sửa bình luận của mình trong các công việc thuộc dự án.',
    icon: MessageSquare
  }
];

export default function MemberPermissionsDialog({
  member,
  project,
  onSave,
  onClose,
  onSaved
}) {
  const dialog = useRef(null);
  const [draft, setDraft] = useState({
    can_update_status: member.can_update_status,
    can_comment: member.can_comment
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [conflict, setConflict] = useState(false);
  const dirty = permissions.some(({ key }) => draft[key] !== member[key]);

  useEffect(() => {
    const element = dialog.current;
    element.showModal();
    return () => element.close();
  }, []);

  const submit = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError('');
    try {
      await onSave(member, draft);
      onSaved(`Đã cập nhật quyền của ${member.full_name}.`);
      onClose();
    } catch (err) {
      setError(err.message);
      setConflict(err.status === 409);
    } finally {
      setSaving(false);
    }
  };

  return (
    <dialog
      ref={dialog}
      aria-labelledby="permissions-title"
      aria-describedby="permissions-description"
      onCancel={(event) => {
        event.preventDefault();
        if (!saving) onClose();
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget && !saving) onClose();
      }}
      className="m-auto w-[calc(100%-2rem)] max-w-lg max-h-[90dvh] overflow-y-auto rounded-2xl border border-slate-200 bg-white p-0 text-slate-900 shadow-2xl backdrop:bg-slate-900/40 backdrop:backdrop-blur-xs"
    >
      <form onSubmit={submit}>
        <div className="flex items-start justify-between gap-3 border-b border-slate-100 p-5 sm:p-6">
          <div>
            <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <h2 id="permissions-title" className="text-lg font-bold">
              Quyền thành viên
            </h2>
            <p
              id="permissions-description"
              className="mt-1 text-sm text-slate-500"
            >
              {member.full_name} · {project.key}
            </p>
          </div>
          <button
            type="button"
            autoFocus
            onClick={onClose}
            disabled={saving}
            aria-label="Đóng thiết lập quyền"
            className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="space-y-4 p-5 sm:p-6">
          <p className="text-sm leading-6 text-slate-500">
            Thiết lập chỉ áp dụng trong dự án{' '}
            <strong className="font-semibold text-slate-700">
              {project.name}
            </strong>
            . Thành viên vẫn được xem các công việc trong dự án.
          </p>
          {permissions.map(({ key, label, description, icon: Icon }) => (
            <div
              key={key}
              className="flex items-start gap-3 rounded-xl border border-slate-200 p-4"
            >
              <Icon className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
              <div className="flex-1">
                <p id={`${key}-label`} className="text-sm font-semibold">
                  {label}
                </p>
                <p
                  id={`${key}-description`}
                  className="mt-1 text-xs leading-5 text-slate-500"
                >
                  {description}
                </p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={draft[key]}
                aria-labelledby={`${key}-label`}
                aria-describedby={`${key}-description`}
                disabled={saving || conflict}
                onClick={() =>
                  setDraft((prev) => ({ ...prev, [key]: !prev[key] }))
                }
                className={`relative mt-0.5 h-6 w-11 shrink-0 rounded-full transition-colors ${draft[key] ? 'bg-blue-600' : 'bg-slate-300'}`}
              >
                <span
                  className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition-transform ${draft[key] ? 'left-0.5 translate-x-5' : 'left-0.5'}`}
                />
              </button>
            </div>
          ))}
          <p className="flex items-start gap-2 rounded-xl bg-slate-50 p-3 text-xs leading-5 text-slate-500">
            <LockKeyhole className="mt-0.5 h-4 w-4 shrink-0" />
            Quản lý tài khoản, khóa tài khoản và quyền Admin không thuộc các
            thiết lập này.
          </p>
          {error && (
            <p
              role="alert"
              className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700"
            >
              {error}
            </p>
          )}
        </div>
        <div className="flex justify-end gap-2 border-t border-slate-100 bg-slate-50/50 px-5 py-4 sm:px-6">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50"
          >
            {conflict ? 'Đóng và mở lại quyền mới' : 'Hủy'}
          </button>
          <button
            type="submit"
            disabled={!dirty || saving || conflict}
            className="flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Check className="h-4 w-4" />
            )}
            {saving ? 'Đang lưu…' : 'Lưu thay đổi'}
          </button>
        </div>
      </form>
    </dialog>
  );
}
