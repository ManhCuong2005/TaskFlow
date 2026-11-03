import { useState } from 'react';
import {
  AlertCircle,
  ArrowRight,
  CheckCheck,
  ChevronRight,
  Clock3,
  Crown,
  FolderKanban,
  History,
  ListTodo,
  Loader2,
  LockKeyhole,
  MessageSquare,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  UserPlus,
  Users
} from 'lucide-react';
import {
  formatDateTime,
  formatDueDateTime,
  getAvatarColor,
  getInitials
} from '../../utils/helpers';
import useLeaderWorkspace from './useLeaderWorkspace';
import MemberPermissionsDialog from './MemberPermissionsDialog';
import LeaderMemberCard from './LeaderMemberCard';

const number = (value) => Number(value || 0);
const percent = (done, total) => (total ? Math.round((done / total) * 100) : 0);

function Progress({ done, total, label, small = false }) {
  const value = percent(number(done), number(total));
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuenow={value}
      aria-valuemin={0}
      aria-valuemax={100}
      className={`overflow-hidden rounded-full bg-slate-100 ${small ? 'h-1.5' : 'h-2.5'}`}
    >
      <div
        className="h-full rounded-full bg-blue-600 transition-[width] duration-300"
        style={{ width: `${value}%` }}
      />
    </div>
  );
}

export default function LeaderWorkspace({
  project,
  token,
  revision,
  onCreateTask,
  onInvite,
  onSelectTask,
  onSaved
}) {
  const { data, loading, error, reload, savePermissions } = useLeaderWorkspace(
    project.id,
    token,
    revision
  );
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const [editingMember, setEditingMember] = useState(null);
  const [openingTask, setOpeningTask] = useState(null);
  const summary = data?.summary || {};
  const members = data?.members || [];
  const filteredMembers = members.filter((member) => {
    const matches = `${member.full_name} ${member.email}`
      .toLocaleLowerCase('vi')
      .includes(search.trim().toLocaleLowerCase('vi'));
    return (
      matches &&
      (filter === 'all' ||
        (filter === 'overdue' && number(member.overdue) > 0) ||
        (filter === 'available' &&
          number(member.todo) + number(member.in_progress) === 0))
    );
  });

  const openTask = async (task) => {
    setOpeningTask(task.id);
    try {
      await onSelectTask(task.id);
    } finally {
      setOpeningTask(null);
    }
  };

  return (
    <div className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="flex flex-col justify-between gap-4 xl:flex-row xl:items-center">
          <div>
            <div className="mb-2 flex items-center gap-2 text-xs font-semibold text-blue-600">
              <Crown className="h-4 w-4" />
              <span>KHÔNG GIAN LEADER</span>
              <span className="rounded-md border border-blue-100 bg-blue-50 px-2 py-0.5 font-mono">
                {project.key}
              </span>
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              Quản lý dự án
            </h1>
            <p className="mt-1 text-sm leading-6 text-slate-500">
              Nắm tiến độ, cân bằng công việc và thiết lập quyền cho{' '}
              <span className="font-semibold text-slate-700">
                {project.name}
              </span>
              .
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={reload}
              disabled={loading}
              aria-label="Tải lại dữ liệu Leader"
              className="rounded-xl border border-slate-200 bg-white p-2.5 text-slate-500 hover:bg-slate-50"
            >
              <RefreshCw
                className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`}
              />
            </button>
            <button
              type="button"
              onClick={onInvite}
              className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-semibold text-slate-700 hover:border-blue-200 hover:bg-blue-50"
            >
              <UserPlus className="h-4 w-4" />
              Mời thành viên
            </button>
            <button
              type="button"
              onClick={() => onCreateTask()}
              className="flex items-center gap-2 rounded-xl bg-blue-600 px-3 py-2.5 text-sm font-semibold text-white shadow-xs hover:bg-blue-700"
            >
              <Plus className="h-4 w-4" />
              Tạo công việc
            </button>
          </div>
        </div>

        {error && (
          <div
            role="alert"
            className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700"
          >
            <span className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4 shrink-0" />
              {error}
            </span>
            <button
              type="button"
              onClick={reload}
              className="font-semibold underline underline-offset-2"
            >
              Thử lại
            </button>
          </div>
        )}

        {loading && !data ? (
          <div
            role="status"
            className="flex min-h-64 items-center justify-center gap-3 text-sm text-slate-500"
          >
            <Loader2 className="h-5 w-5 animate-spin text-blue-600" />
            Đang tải thông tin dự án…
          </div>
        ) : (
          data && (
            <>
              <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
                {[
                  {
                    label: 'Tổng công việc',
                    value: summary.total,
                    note: `${number(summary.unassigned)} chưa có người nhận`,
                    icon: ListTodo,
                    color: 'bg-blue-50 text-blue-600'
                  },
                  {
                    label: 'Đã hoàn thành',
                    value: summary.completed,
                    note: `${percent(number(summary.completed), number(summary.total))}% tổng công việc`,
                    icon: CheckCheck,
                    color: 'bg-emerald-50 text-emerald-600'
                  },
                  {
                    label: 'Cần xử lý quá hạn',
                    value: summary.overdue,
                    note: `${number(summary.due_soon)} việc đến hạn trong 48 giờ`,
                    icon: Clock3,
                    color: 'bg-rose-50 text-rose-600'
                  },
                  {
                    label: 'Thành viên dự án',
                    value: members.length,
                    note: `${members.filter((m) => m.is_active).length} tài khoản đang hoạt động`,
                    icon: Users,
                    color: 'bg-violet-50 text-violet-600'
                  }
                ].map(({ label, value, note, icon: Icon, color }) => (
                  <div
                    key={label}
                    className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-2xs sm:p-5"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs font-medium text-slate-500">
                        {label}
                      </p>
                      <span className={`rounded-lg p-2 ${color}`}>
                        <Icon className="h-4 w-4" />
                      </span>
                    </div>
                    <p className="mt-2 text-3xl font-bold tracking-tight text-slate-900">
                      {number(value)}
                    </p>
                    <p className="mt-1 text-xs leading-5 text-slate-400">
                      {note}
                    </p>
                  </div>
                ))}
              </div>

              <div className="grid gap-5 xl:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)]">
                <section
                  className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-2xs sm:p-6"
                  aria-labelledby="leader-progress"
                >
                  <h2
                    id="leader-progress"
                    className="text-sm font-bold text-slate-900"
                  >
                    Tiến độ toàn dự án
                  </h2>
                  <p className="mt-1 text-xs leading-5 text-slate-500">
                    Tổng hợp tất cả công việc, không phụ thuộc bộ lọc danh sách.
                  </p>
                  <div className="mb-3 mt-6 flex items-end justify-between">
                    <p className="text-4xl font-bold tracking-tight text-slate-900">
                      {percent(
                        number(summary.completed),
                        number(summary.total)
                      )}
                      <span className="ml-1 text-lg text-slate-400">%</span>
                    </p>
                    <span className="text-xs text-slate-500">
                      {summary.completed}/{summary.total} hoàn thành
                    </span>
                  </div>
                  <Progress
                    done={summary.completed}
                    total={summary.total}
                    label="Tỷ lệ hoàn thành dự án"
                  />
                  <div className="mt-6 space-y-3">
                    {[
                      {
                        label: 'Chờ làm',
                        value: summary.todo,
                        color: 'bg-slate-400'
                      },
                      {
                        label: 'Đang làm',
                        value: summary.in_progress,
                        color: 'bg-blue-500'
                      },
                      {
                        label: 'Hoàn thành',
                        value: summary.completed,
                        color: 'bg-emerald-500'
                      }
                    ].map((item) => (
                      <div
                        key={item.label}
                        className="flex items-center justify-between text-sm"
                      >
                        <span className="flex items-center gap-2 text-slate-500">
                          <span
                            className={`h-2 w-2 rounded-full ${item.color}`}
                          />
                          {item.label}
                        </span>
                        <span className="font-semibold text-slate-700">
                          {number(item.value)}
                        </span>
                      </div>
                    ))}
                  </div>
                  {!number(summary.total) && (
                    <p className="mt-5 text-xs leading-5 text-slate-400">
                      Tạo công việc đầu tiên để bắt đầu theo dõi tiến độ.
                    </p>
                  )}
                </section>
                <section
                  className="min-w-0 rounded-2xl border border-slate-200/80 bg-white p-5 shadow-2xs sm:p-6"
                  aria-labelledby="leader-attention"
                >
                  <div className="flex items-center justify-between gap-2">
                    <h2
                      id="leader-attention"
                      className="text-sm font-bold text-slate-900"
                    >
                      Cần Leader chú ý
                    </h2>
                    <span className="rounded-full bg-amber-50 px-2 py-1 text-[11px] font-medium text-amber-700">
                      Tối đa 6 việc
                    </span>
                  </div>
                  <p className="mt-1 text-xs leading-5 text-slate-500">
                    Việc quá hạn, sắp đến hạn, ưu tiên cao hoặc chưa được giao.
                  </p>
                  <div className="mt-4 divide-y divide-slate-100">
                    {data.attention.length ? (
                      data.attention.map((task) => {
                        const overdue =
                          task.due_date && new Date(task.due_date) < new Date();
                        return (
                          <button
                            key={task.id}
                            type="button"
                            onClick={() => openTask(task)}
                            disabled={openingTask !== null}
                            className="group flex w-full items-center gap-3 py-3 text-left"
                          >
                            <span
                              className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${overdue ? 'bg-rose-50 text-rose-500' : 'bg-slate-50 text-slate-400'}`}
                            >
                              <FolderKanban className="h-4 w-4" />
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-sm font-semibold text-slate-700 group-hover:text-blue-600">
                                {task.title}
                              </span>
                              <span
                                className={`mt-1 block truncate text-xs ${overdue ? 'text-rose-500' : 'text-slate-400'}`}
                              >
                                {task.assignees.length
                                  ? `${task.assignees.length} người nhận`
                                  : 'Chưa giao việc'}{' '}
                                ·{' '}
                                {task.due_date
                                  ? formatDueDateTime(task.due_date)
                                  : 'Chưa có hạn chót'}
                              </span>
                            </span>
                            {openingTask === task.id ? (
                              <Loader2 className="h-4 w-4 shrink-0 animate-spin text-blue-600" />
                            ) : (
                              <ChevronRight className="h-4 w-4 shrink-0 text-slate-300 group-hover:text-blue-600" />
                            )}
                          </button>
                        );
                      })
                    ) : (
                      <div className="flex flex-col items-center py-10 text-center">
                        <CheckCheck className="h-8 w-8 text-emerald-400" />
                        <p className="mt-3 text-sm font-medium text-slate-600">
                          Mọi việc đang trong tầm kiểm soát
                        </p>
                        <p className="mt-1 text-xs text-slate-400">
                          Chưa có công việc nào cần ưu tiên xử lý.
                        </p>
                      </div>
                    )}
                  </div>
                </section>
              </div>

              <section
                className="min-w-0 overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-2xs"
                aria-labelledby="leader-team"
              >
                <div className="flex flex-col justify-between gap-4 border-b border-slate-100 p-5 sm:p-6 lg:flex-row lg:items-center">
                  <div>
                    <h2
                      id="leader-team"
                      className="text-sm font-bold text-slate-900"
                    >
                      Khối lượng công việc & quyền thành viên
                    </h2>
                    <p className="mt-1 text-xs leading-5 text-slate-500">
                      Số việc tính theo từng người được giao; một việc có thể có
                      nhiều người nhận.
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <div className="relative min-w-44 flex-1">
                      <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                      <input
                        aria-label="Tìm thành viên"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Tìm tên hoặc email…"
                        className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2 pl-9 pr-3 text-xs outline-none focus:border-blue-500"
                      />
                    </div>
                    <select
                      aria-label="Lọc khối lượng công việc"
                      value={filter}
                      onChange={(e) => setFilter(e.target.value)}
                      className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600"
                    >
                      <option value="all">Tất cả thành viên</option>
                      <option value="overdue">Có việc quá hạn</option>
                      <option value="available">
                        Không có việc đang chờ/làm
                      </option>
                    </select>
                  </div>
                </div>
                <div className="space-y-3 p-4 md:hidden">
                  {filteredMembers.map((member) => (
                    <LeaderMemberCard
                      key={member.id}
                      member={member}
                      isLead={String(member.id) === String(project.lead_id)}
                      onEdit={setEditingMember}
                      onAssign={onCreateTask}
                    />
                  ))}
                  {!filteredMembers.length && (
                    <p className="py-6 text-center text-sm text-slate-400">
                      Không tìm thấy thành viên phù hợp.
                    </p>
                  )}
                </div>
                <div className="hidden overflow-x-auto md:block">
                  <table className="w-full min-w-[790px] text-left text-xs">
                    <thead className="border-b border-slate-100 bg-slate-50/80 text-[11px] font-semibold text-slate-500">
                      <tr>
                        <th className="px-6 py-3">Thành viên</th>
                        <th className="px-4 py-3">Công việc được giao</th>
                        <th className="px-4 py-3">Hoàn thành</th>
                        <th className="px-4 py-3">Quyền trong dự án</th>
                        <th className="px-6 py-3 text-right">Thao tác</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {filteredMembers.map((member) => {
                        const isLead =
                          String(member.id) === String(project.lead_id);
                        return (
                          <tr key={member.id} className="hover:bg-slate-50/60">
                            <td className="px-6 py-4">
                              <div className="flex items-center gap-3">
                                <span
                                  className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl font-bold ${getAvatarColor(member.full_name)}`}
                                >
                                  {getInitials(member.full_name)}
                                </span>
                                <div className="min-w-0">
                                  <div className="flex items-center gap-2">
                                    <span className="max-w-44 truncate font-semibold text-slate-800">
                                      {member.full_name}
                                    </span>
                                    {isLead && (
                                      <Crown
                                        aria-label="Leader"
                                        className="h-3.5 w-3.5 text-amber-500"
                                      />
                                    )}
                                  </div>
                                  <p className="mt-1 max-w-52 truncate text-[11px] text-slate-400">
                                    {member.email}
                                  </p>
                                  {!member.is_active && (
                                    <p className="mt-1 text-[10px] font-medium text-rose-500">
                                      Tài khoản đã bị Admin khóa
                                    </p>
                                  )}
                                </div>
                              </div>
                            </td>
                            <td className="px-4 py-4">
                              <p className="font-semibold text-slate-700">
                                {number(member.todo) +
                                  number(member.in_progress)}{' '}
                                việc chưa xong
                              </p>
                              <p className="mt-1 text-[11px] text-slate-400">
                                {member.todo} chờ · {member.in_progress} đang
                                làm
                              </p>
                              {number(member.overdue) > 0 && (
                                <span className="mt-1.5 inline-block rounded-md bg-rose-50 px-1.5 py-0.5 text-[10px] font-semibold text-rose-600">
                                  {member.overdue} quá hạn
                                </span>
                              )}
                            </td>
                            <td className="min-w-32 px-4 py-4">
                              <div className="mb-2 flex justify-between gap-3 text-[11px]">
                                <span className="text-slate-500">
                                  {member.completed}/{member.assigned}
                                </span>
                                <span className="font-semibold text-slate-700">
                                  {percent(
                                    number(member.completed),
                                    number(member.assigned)
                                  )}
                                  %
                                </span>
                              </div>
                              <Progress
                                small
                                done={member.completed}
                                total={member.assigned}
                                label={`Tiến độ của ${member.full_name}`}
                              />
                            </td>
                            <td className="px-4 py-4">
                              {isLead ? (
                                <span className="inline-flex items-center gap-1 rounded-lg bg-amber-50 px-2 py-1 text-[11px] font-medium text-amber-700">
                                  <ShieldCheck className="h-3 w-3" />
                                  Quản lý dự án
                                </span>
                              ) : (
                                <div className="space-y-1.5">
                                  {[
                                    {
                                      label: 'Cập nhật trạng thái',
                                      allowed: member.can_update_status,
                                      icon: CheckCheck
                                    },
                                    {
                                      label: 'Bình luận',
                                      allowed: member.can_comment,
                                      icon: MessageSquare
                                    }
                                  ].map(({ label, allowed, icon: Icon }) => (
                                    <p
                                      key={label}
                                      className={`flex items-center gap-1.5 text-[11px] ${allowed ? 'text-slate-500' : 'text-slate-400'}`}
                                    >
                                      <Icon className="h-3 w-3" />
                                      {label}
                                      <span
                                        className={`ml-1 h-1.5 w-1.5 rounded-full ${allowed ? 'bg-emerald-400' : 'bg-slate-300'}`}
                                        aria-label={
                                          allowed ? 'Được phép' : 'Tạm khóa'
                                        }
                                      />
                                    </p>
                                  ))}
                                </div>
                              )}
                            </td>
                            <td className="px-6 py-4">
                              <div className="flex justify-end gap-2">
                                {!isLead && (
                                  <button
                                    type="button"
                                    onClick={() => setEditingMember(member)}
                                    aria-label={`Thiết lập quyền của ${member.full_name}`}
                                    className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 py-2 font-semibold text-slate-600 hover:border-blue-200 hover:bg-blue-50 hover:text-blue-600"
                                  >
                                    <ShieldCheck className="h-3.5 w-3.5" />
                                    Quyền
                                  </button>
                                )}
                                <button
                                  type="button"
                                  onClick={() => onCreateTask(member.id)}
                                  disabled={!member.is_active}
                                  aria-label={`Giao việc cho ${member.full_name}`}
                                  className="flex items-center gap-1 rounded-lg bg-blue-50 px-2.5 py-2 font-semibold text-blue-600 hover:bg-blue-100"
                                >
                                  Giao việc
                                  <ArrowRight className="h-3.5 w-3.5" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                  {!filteredMembers.length && (
                    <div className="py-12 text-center">
                      <Users className="mx-auto h-7 w-7 text-slate-300" />
                      <p className="mt-2 text-sm text-slate-500">
                        Không tìm thấy thành viên phù hợp.
                      </p>
                      <button
                        type="button"
                        onClick={() => {
                          setSearch('');
                          setFilter('all');
                        }}
                        className="mt-2 text-xs font-semibold text-blue-600"
                      >
                        Xóa bộ lọc
                      </button>
                    </div>
                  )}
                </div>
                <p className="border-t border-slate-100 px-6 py-3 text-[11px] text-slate-400">
                  Hiển thị {filteredMembers.length}/{members.length} thành viên
                  · Leader chỉ quản lý quyền trong dự án đang phụ trách.
                </p>
              </section>

              <section
                className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-2xs sm:p-6"
                aria-labelledby="leader-history"
              >
                <h2
                  id="leader-history"
                  className="flex items-center gap-2 text-sm font-bold text-slate-900"
                >
                  <History className="h-4 w-4 text-slate-400" />
                  Lịch sử thay đổi quyền
                </h2>
                <p className="mt-1 text-xs leading-5 text-slate-500">
                  10 thay đổi gần nhất, ghi nhận người thực hiện và thời điểm
                  lưu.
                </p>
                <div className="mt-4 divide-y divide-slate-100">
                  {data.history.length ? (
                    data.history.map((entry) => (
                      <div
                        key={entry.id}
                        className="flex items-start gap-3 py-3"
                      >
                        <span className="mt-0.5 rounded-lg bg-slate-50 p-2 text-slate-400">
                          <ShieldCheck className="h-4 w-4" />
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm text-slate-600">
                            <strong className="font-semibold text-slate-800">
                              {entry.changed_by_name}
                            </strong>{' '}
                            đã cập nhật quyền của{' '}
                            <strong className="font-semibold text-slate-800">
                              {entry.member_name}
                            </strong>
                          </p>
                          <p className="mt-1 text-xs leading-5 text-slate-400">
                            {[
                              { key: 'can_update_status', label: 'Trạng thái' },
                              { key: 'can_comment', label: 'Bình luận' }
                            ]
                              .filter(
                                (item) =>
                                  entry.previous_permissions[item.key] !==
                                  entry.new_permissions[item.key]
                              )
                              .map(
                                (item) =>
                                  `${item.label}: ${entry.new_permissions[item.key] ? 'cho phép' : 'tạm khóa'}`
                              )
                              .join(' · ')}{' '}
                            · {formatDateTime(entry.created_at)}
                          </p>
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="rounded-xl bg-slate-50 px-4 py-5 text-sm text-slate-400">
                      Chưa có thay đổi quyền. Các lần lưu tiếp theo sẽ xuất hiện
                      tại đây.
                    </p>
                  )}
                </div>
              </section>
            </>
          )
        )}
        <p className="flex items-start gap-2 text-xs leading-5 text-slate-400">
          <LockKeyhole className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          Thiết lập của Leader chỉ có hiệu lực trong dự án này. Quyền quản trị
          và khóa tài khoản do Admin quản lý.
        </p>
      </div>
      {editingMember && (
        <MemberPermissionsDialog
          member={editingMember}
          project={project}
          onSave={savePermissions}
          onClose={() => setEditingMember(null)}
          onSaved={onSaved}
        />
      )}
    </div>
  );
}
