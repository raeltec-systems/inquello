-- Inquello working store: Engagements, folders, private Tasks (Story 1.14).
-- Every row is written only through inquello-domain organise commands, each with
-- its record-scoped receipt in organise_receipts, in one transaction.

CREATE TABLE engagements (
    engagement_id TEXT PRIMARY KEY NOT NULL CHECK (length(engagement_id) = 36),
    workspace_id TEXT NOT NULL CHECK (length(workspace_id) = 36),
    -- The shared-service Engagement (Story 1.11) that owns membership.
    service_engagement_id TEXT NOT NULL UNIQUE CHECK (length(service_engagement_id) = 36),
    name TEXT NOT NULL CHECK (length(name) BETWEEN 1 AND 200),
    objectives TEXT NOT NULL,
    scope TEXT NOT NULL,
    client_entity TEXT CHECK (client_entity IS NULL OR length(client_entity) BETWEEN 1 AND 200),
    period_start TEXT CHECK (period_start IS NULL OR length(period_start) = 10),
    period_end TEXT CHECK (period_end IS NULL OR length(period_end) = 10),
    revision INTEGER NOT NULL CHECK (revision >= 1),
    created_at_ms INTEGER NOT NULL,
    updated_at_ms INTEGER NOT NULL
) STRICT;

CREATE INDEX engagements_by_workspace ON engagements (workspace_id);

CREATE TABLE folders (
    folder_id TEXT PRIMARY KEY NOT NULL CHECK (length(folder_id) = 36),
    engagement_id TEXT NOT NULL REFERENCES engagements (engagement_id),
    workspace_id TEXT NOT NULL CHECK (length(workspace_id) = 36),
    name TEXT NOT NULL CHECK (length(name) BETWEEN 1 AND 200),
    revision INTEGER NOT NULL CHECK (revision >= 1),
    created_at_ms INTEGER NOT NULL,
    updated_at_ms INTEGER NOT NULL
) STRICT;

CREATE INDEX folders_by_workspace ON folders (workspace_id);

CREATE TABLE tasks (
    task_id TEXT PRIMARY KEY NOT NULL CHECK (length(task_id) = 36),
    workspace_id TEXT NOT NULL CHECK (length(workspace_id) = 36),
    creator_principal_id TEXT NOT NULL CHECK (length(creator_principal_id) = 36),
    engagement_id TEXT REFERENCES engagements (engagement_id),
    folder_id TEXT REFERENCES folders (folder_id),
    title TEXT NOT NULL CHECK (length(title) BETWEEN 1 AND 200),
    runtime_thread_id TEXT CHECK (runtime_thread_id IS NULL OR length(CAST(runtime_thread_id AS BLOB)) BETWEEN 1 AND 128),
    source_refs TEXT NOT NULL CHECK (json_valid(source_refs) AND json_type(source_refs) = 'array'),
    artifact_refs TEXT NOT NULL CHECK (json_valid(artifact_refs) AND json_type(artifact_refs) = 'array'),
    visibility TEXT NOT NULL CHECK (visibility IN ('private')),
    revision INTEGER NOT NULL CHECK (revision >= 1),
    created_at_ms INTEGER NOT NULL,
    updated_at_ms INTEGER NOT NULL,
    CHECK (folder_id IS NULL OR engagement_id IS NOT NULL)
) STRICT;

CREATE INDEX tasks_by_workspace_creator ON tasks (workspace_id, creator_principal_id);

CREATE TABLE workspace_labels (
    principal_id TEXT NOT NULL CHECK (length(principal_id) = 36),
    workspace_id TEXT NOT NULL CHECK (length(workspace_id) = 36),
    name TEXT NOT NULL CHECK (length(name) BETWEEN 1 AND 200),
    revision INTEGER NOT NULL CHECK (revision >= 1),
    updated_at_ms INTEGER NOT NULL,
    PRIMARY KEY (principal_id, workspace_id)
) STRICT;

CREATE TABLE organise_receipts (
    operation_id TEXT PRIMARY KEY NOT NULL
        CHECK (length(CAST(operation_id AS BLOB)) BETWEEN 1 AND 128),
    principal_id TEXT NOT NULL CHECK (length(principal_id) = 36),
    command TEXT NOT NULL CHECK (command IN (
        'create_engagement', 'update_engagement', 'create_folder', 'create_task',
        'rename_task', 'move_task', 'attach_thread', 'remember_workspace'
    )),
    resource_id TEXT NOT NULL CHECK (length(resource_id) = 36),
    expected_revision INTEGER NOT NULL CHECK (expected_revision >= 0),
    resulting_revision INTEGER NOT NULL CHECK (resulting_revision = expected_revision + 1),
    request TEXT NOT NULL CHECK (json_valid(request)),
    status TEXT NOT NULL CHECK (status IN ('applied')),
    recorded_at_ms INTEGER NOT NULL
) STRICT;
