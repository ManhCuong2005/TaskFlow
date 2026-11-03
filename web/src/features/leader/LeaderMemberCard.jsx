import { ArrowRight, Crown, ShieldCheck } from 'lucide-react';
import { getAvatarColor, getInitials } from '../../utils/helpers';

export default function LeaderMemberCard({ member, isLead, onEdit, onAssign }) {
  const progress = member.assigned
    ? Math.round((member.completed / member.assigned) * 100)
    : 0;
  return (
    <article className="rounded-xl border border-slate-200 p-4">
      <div className="flex items-center gap-3">
        <span
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-xs font-bold ${getAvatarColor(member.full_name)}`}
        >
          {getInitials(member.full_name)}
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="flex items-center gap-1.5 text-sm font-semibold text-slate-800">
            <span className="truncate">{member.full_name}</span>
            {isLead && (
              <Crown
                className="h-3.5 w-3.5 shrink-0 text-amber-500"
                aria-label="Leader"
              />
            )}
          </h3>
          <p className="mt-1 truncate text-[11px] text-slate-400">
            {member.email}
          </p>
        </div>
      </div>
      {!member.is_active && (
        <p className="mt-3 rounded-lg bg-rose-50 p-2 text-xs text-rose-600">
          Tài khoản đã bị Admin khóa
        </p>
      )}
      <div className="mt-4 flex justify-between gap-2 text-xs">
        <span className="text-slate-500">
          {Number(member.todo) + Number(member.in_progress)} việc chưa xong
        </span>
        <span className="font-semibold text-slate-700">
          {member.completed}/{member.assigned} xong
        </span>
      </div>
      <div
        role="progressbar"
        aria-label={`Tiến độ của ${member.full_name}`}
        aria-valuenow={progress}
        aria-valuemin={0}
        aria-valuemax={100}
        className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-100"
      >
        <div
          className="h-full rounded-full bg-blue-600"
          style={{ width: `${progress}%` }}
        />
      </div>
      {Number(member.overdue) > 0 && (
        <p className="mt-2 text-xs font-medium text-rose-500">
          {member.overdue} việc quá hạn
        </p>
      )}
      {!isLead && (
        <div className="mt-4 space-y-2 border-t border-slate-100 pt-3">
          {[
            { label: 'Cập nhật trạng thái', allowed: member.can_update_status },
            { label: 'Bình luận', allowed: member.can_comment }
          ].map((item) => (
            <div
              key={item.label}
              className="flex justify-between gap-2 text-xs"
            >
              <span className="text-slate-500">{item.label}</span>
              <span
                className={item.allowed ? 'text-emerald-600' : 'text-slate-400'}
              >
                {item.allowed ? 'Cho phép' : 'Tạm khóa'}
              </span>
            </div>
          ))}
        </div>
      )}
      <div className="mt-4 flex gap-2">
        {!isLead && (
          <button
            type="button"
            onClick={() => onEdit(member)}
            aria-label={`Thiết lập quyền của ${member.full_name}`}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-slate-200 px-2 py-2.5 text-xs font-semibold text-slate-600"
          >
            <ShieldCheck className="h-3.5 w-3.5" />
            Quyền
          </button>
        )}
        <button
          type="button"
          onClick={() => onAssign(member.id)}
          disabled={!member.is_active}
          aria-label={`Giao việc cho ${member.full_name}`}
          className="flex flex-1 items-center justify-center gap-1 rounded-lg bg-blue-50 px-2 py-2.5 text-xs font-semibold text-blue-600"
        >
          Giao việc
          <ArrowRight className="h-3.5 w-3.5" />
        </button>
      </div>
    </article>
  );
}
