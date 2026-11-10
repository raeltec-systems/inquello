-- Personal navigation metadata belongs to the Task creator, not Workspace peers.
-- Existing retained work remains visible and unpinned. No execution/deletion effects.
ALTER TABLE tasks ADD COLUMN pinned INTEGER NOT NULL DEFAULT 0 CHECK (pinned IN (0, 1));
ALTER TABLE tasks ADD COLUMN archived INTEGER NOT NULL DEFAULT 0 CHECK (archived IN (0, 1));

-- Extend the receipt constraint without losing operation identity or history.
CREATE TABLE organise_receipts_navigation (
    operation_id TEXT PRIMARY KEY NOT NULL
        CHECK (length(CAST(operation_id AS BLOB)) BETWEEN 1 AND 128),
    principal_id TEXT NOT NULL CHECK (length(principal_id) = 36),
    command TEXT NOT NULL CHECK (command IN (
        'create_engagement', 'update_engagement', 'create_folder', 'create_task',
        'rename_task', 'move_task', 'attach_thread', 'remember_workspace', 'set_task_navigation'
    )),
    resource_id TEXT NOT NULL CHECK (length(resource_id) = 36),
    expected_revision INTEGER NOT NULL CHECK (expected_revision >= 0),
    resulting_revision INTEGER NOT NULL CHECK (resulting_revision = expected_revision + 1),
    request TEXT NOT NULL CHECK (json_valid(request)),
    status TEXT NOT NULL CHECK (status IN ('applied')),
    recorded_at_ms INTEGER NOT NULL
) STRICT;

INSERT INTO organise_receipts_navigation SELECT * FROM organise_receipts;
DROP TABLE organise_receipts;
ALTER TABLE organise_receipts_navigation RENAME TO organise_receipts;
