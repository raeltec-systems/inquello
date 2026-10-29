-- Inquello working store: a Task's broader execution mode (Story 1.18).
-- Each row is one immutable record, written only through the inquello-domain
-- set_broad_mode command together with its receipt in broad_mode_receipts, in
-- one transaction. The latest record is the Task's recorded mode; there is no
-- global or per-user default. A broader mode is only ever set by a person.

CREATE TABLE task_broad_modes (
    task_id TEXT NOT NULL REFERENCES tasks (task_id),
    -- The Task's broad-mode revision this record created (1, 2, ...).
    revision INTEGER NOT NULL CHECK (revision >= 1),
    mode TEXT NOT NULL CHECK (mode IN ('standard', 'no_prompt', 'full_access')),
    actor_kind TEXT NOT NULL CHECK (actor_kind IN ('human', 'runtime', 'system')),
    actor_ref TEXT NOT NULL CHECK (length(CAST(actor_ref AS BLOB)) BETWEEN 1 AND 128),
    recorded_at_ms INTEGER NOT NULL,
    PRIMARY KEY (task_id, revision),
    CHECK (mode = 'standard' OR actor_kind = 'human')
) STRICT;

CREATE TABLE broad_mode_receipts (
    operation_id TEXT PRIMARY KEY NOT NULL
        CHECK (length(CAST(operation_id AS BLOB)) BETWEEN 1 AND 128),
    principal_id TEXT NOT NULL CHECK (length(principal_id) = 36),
    command TEXT NOT NULL CHECK (command IN ('set_broad_mode')),
    task_id TEXT NOT NULL CHECK (length(task_id) = 36),
    expected_revision INTEGER NOT NULL CHECK (expected_revision >= 0),
    resulting_revision INTEGER NOT NULL CHECK (resulting_revision = expected_revision + 1),
    request TEXT NOT NULL CHECK (json_valid(request)),
    status TEXT NOT NULL CHECK (status IN ('applied')),
    recorded_at_ms INTEGER NOT NULL
) STRICT;
