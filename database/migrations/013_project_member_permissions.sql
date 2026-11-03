-- Leader workspace: project-scoped member permissions, preserving current access.
ALTER TABLE project_members
  ADD COLUMN can_update_status BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN can_comment BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN permissions_version INTEGER NOT NULL DEFAULT 0
    CHECK (permissions_version >= 0);

CREATE TABLE project_permission_history (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  project_id BIGINT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  member_id BIGINT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  changed_by BIGINT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  previous_permissions JSONB NOT NULL,
  new_permissions JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_project_permission_history_project
  ON project_permission_history(project_id, created_at DESC, id DESC);
