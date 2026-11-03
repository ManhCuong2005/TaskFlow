# HTTP API reference

Base path: `/api`. JSON responses use `{ "status": "success" | "error", "message": "...", "data": ... }`. Paginated endpoints also include `pagination` with `page`, `limit`, `total`, and `totalPages`. Protected routes require `Authorization: Bearer <JWT>`.

## Health and authentication

| Method | Path | Access | Purpose |
|---|---|---|---|
| `GET` | `/health` | Public | API and database readiness |
| `POST` | `/auth/register` | Public, rate limited | Create an employee account (`full_name`, `email`, `password`) |
| `POST` | `/auth/login` | Public, rate limited | Authenticate (`email`, `password`); returns `{ user, token }` |
| `GET` | `/auth/me` | Authenticated | Return the current active user |

Passwords must be at least eight UTF-8 bytes and no more than 72 UTF-8 bytes (the bcrypt input limit). Registration cannot create administrators; use the one-time `seed:admin` operation.

## Users

| Method | Path | Access | Purpose |
|---|---|---|---|
| `GET` | `/users?page=1&limit=20&role=&is_active=&search=` | Admin | Filtered, paginated directory |
| `GET` | `/users/:id` | Admin or same user | User profile |
| `PATCH` | `/users/:id/status` | Admin | Set `{ "is_active": boolean }`; cannot deactivate the current or last active administrator |

## Tasks

| Method | Path | Access | Purpose |
|---|---|---|---|
| `GET` | `/tasks` | Authenticated | Paginated task list; supports `search`, `status`, `priority`, `assignee_id`, `due_after`, `due_before`, and admin-only `created_by` |
| `POST` | `/tasks` | Project Lead or Admin for project-scoped tasks | Create task (`title`, optional `description`, `priority`, `due_date`, `assignee_ids`, `project_id`) |
| `GET` | `/tasks/:id` | Admin, creator, or active assignee | Task detail |
| `PATCH` | `/tasks/:id` | Admin or Project Lead | Update `title`, `description`, `priority`, or `due_date` |
| `DELETE` | `/tasks/:id` | Admin or Project Lead | Soft-delete task |
| `GET` | `/tasks/:id/documents` | Task reader | List shared task documents |
| `POST` | `/tasks/:id/documents` | Admin or task creator | Upload up to five `files` in multipart form data |
| `GET` | `/tasks/:id/documents/:documentId/url?disposition=inline|attachment` | Task reader | Get a 2-minute signed view/download URL |
| `GET` | `/tasks/:id/reports` | Task reader | List completion reports and report files |
| `GET` | `/tasks/:id/reports/:reportId/documents/:documentId/url?disposition=inline|attachment` | Task reader | Get a 2-minute signed report view/download URL |

Task date filters accept ISO 8601 values. A date-only `due_before` value includes the entire calendar day.

Valid priority values are `low`, `medium`, `high`; task statuses are `unassigned`, `todo`, `in_progress`, `completed`. For project-scoped tasks, the creator must be that project's Lead or Admin, and recipients must be active members of the project. Omitted/empty `assignee_ids` default to the creator. Legacy task creation without `project_id` remains available to authenticated users.

## Assignments

| Method | Path | Access | Purpose |
|---|---|---|---|
| `GET` | `/tasks/:id/assignments` | Task reader | Read active and revoked assignment history |
| `POST` | `/tasks/:id/assignments` | Project Lead or Admin; legacy task creator for tasks without a project | Assign active project members (`assignee_ids: number[]`) |
| `PATCH` | `/tasks/:id/assignments/:assignmentId/status` | Admin, Project Lead, or permitted assignment owner | Change status; optional `note` |
| `POST` | `/tasks/:id/assignments/:assignmentId/report/files` | Admin or assignment owner, while completed | Upload up to five `files` to the latest completion report |
| `PATCH` | `/tasks/:id/assignments/:assignmentId/revoke` | Project Lead or Admin; legacy task creator for tasks without a project | Revoke active assignment; optional `revoke_reason` |

## Leader workspace and project permissions

| Method | Path | Access | Purpose |
|---|---|---|---|
| `GET` | `/projects/:id/leader` | That project's Lead or Admin | Full-project summary, member workload/permissions, up to 6 attention items and 10 permission-history events |
| `PATCH` | `/projects/:id/members/:userId/permissions` | That project's Lead or Admin | Set project-scoped permissions with optimistic concurrency |

PATCH body (all three fields required; booleans must be JSON booleans):

```json
{ "can_update_status": true, "can_comment": false, "expected_version": 0 }
```

Returns `data: { can_update_status, can_comment, permissions_version }`. A successful change increments the version and records old/new permission values in the same transaction. A no-op preserves the version and creates no audit event. `409` means the member's permissions have changed since the caller loaded them; reload the overview before retrying. `400` protects the current Lead's membership, `404` means the project/member does not exist, `403` denies insufficient project scope, and `422` rejects invalid fields. Uninitialized Leader schema returns `503`.

Overview data is `{ project, summary, members, attention, history }`. Summary fields: `total`, `todo` (including unassigned), `in_progress`, `completed`, `unassigned`, `overdue`, `due_soon` (next 48 hours). Member fields include `id`, `full_name`, `email`, `is_active`, `project_role`, both permission booleans, `permissions_version`, `assigned`, `todo`, `in_progress`, `completed`, `overdue`. Member counts are assignment-specific; project status derives from all active assignees, so those counts are intentionally different.

`can_update_status` is enforced for members on both `/tasks/:id/status` and `/tasks/:id/assignments/:assignmentId/status`; members can update only their own assigned work. `can_comment` is enforced when creating/editing comments. Reading remains available and authors can still delete their own comments. Lead/Admin retain their project-management authority. Neither permission grants system roles, task metadata editing/deletion, or account activation rights. Recipient validation on task creation/assignment rejects inactive users or users outside the project. Pending invitation lists are restricted to the project's managers.

See [Leader setup and SQL instructions](leader-workspace.md).

Allowed status transitions: `todo → in_progress`, `in_progress → todo|completed`, and `completed → in_progress`. Transitions, their history event, and a new completion report are stored transactionally. On a transition to `completed`, the optional JSON field `completion_note` (up to 5,000 characters) is saved as a report; report files can be attached afterward.

File uploads use multipart form data with the field name `files`. Up to five files, 10 MB each, are accepted in PDF, Word, Excel, PowerPoint, TXT, PNG, and JPG formats. Task documents are visible to users who can access that task. Completion reports are separate per completion cycle and assignment; files are private in storage and delivered using short-lived signed URLs.

## History and comments

| Method | Path | Access | Purpose |
|---|---|---|---|
| `GET` | `/tasks/:id/history?assignment_id=` | Task reader | Read ordered task status/revocation history |
| `GET` | `/tasks/:id/comments?page=1&limit=50` | Task reader | Read paginated comments |
| `POST` | `/tasks/:id/comments` | Task reader | Add `{ "content": "..." }` |
| `PATCH` | `/tasks/:id/comments/:commentId` | Admin or comment author with current task access | Edit content |
| `DELETE` | `/tasks/:id/comments/:commentId` | Admin or comment author with current task access | Soft-delete comment |

Comments are limited to 5,000 characters. Unknown routes return HTTP 404; validation, authentication, authorization, conflict, and not-found errors return non-2xx status codes with a JSON error body.
