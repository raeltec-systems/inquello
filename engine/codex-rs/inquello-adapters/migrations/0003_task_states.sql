-- Inquello working store: Task states (Story 1.15).
-- Each row is one immutable state record, written only through the
-- inquello-domain record_task_state command together with its receipt in
-- state_receipts, in one transaction. Seven dimensions, each with its own
-- vocabulary; no value means "done" and no table spans dimensions.

CREATE TABLE task_states (
    task_id TEXT NOT NULL REFERENCES tasks (task_id),
    -- The Task's state revision this record created (1, 2, ...).
    revision INTEGER NOT NULL CHECK (revision >= 1),
    dimension TEXT NOT NULL CHECK (dimension IN (
        'task', 'run', 'output', 'checks', 'review', 'approval_marker', 'delivery_marker'
    )),
    scope_kind TEXT NOT NULL CHECK (scope_kind IN ('task', 'run', 'output')),
    scope_id TEXT NOT NULL CHECK (length(CAST(scope_id AS BLOB)) BETWEEN 1 AND 128),
    value TEXT NOT NULL CHECK (
        (dimension = 'task' AND value IN ('planned', 'running', 'blocked', 'interrupted'))
        OR (dimension = 'run' AND value IN (
            'running', 'blocked', 'interrupted', 'execution_finished', 'failed'
        ))
        OR (dimension = 'output' AND value IN ('produced'))
        OR (dimension = 'checks' AND value IN ('incomplete', 'complete'))
        OR (dimension = 'review' AND value IN (
            'requested', 'revision_requested', 'decision_recorded'
        ))
        OR (dimension = 'approval_marker' AND value IN ('noted_locally'))
        OR (dimension = 'delivery_marker' AND value IN ('attempted', 'confirmed', 'uncertain'))
    ),
    -- 1 for the first record of this (dimension, scope), then one more per record.
    version INTEGER NOT NULL CHECK (version >= 1),
    actor_kind TEXT NOT NULL CHECK (actor_kind IN ('human', 'runtime', 'system')),
    actor_ref TEXT NOT NULL CHECK (length(CAST(actor_ref AS BLOB)) BETWEEN 1 AND 128),
    recorded_at_ms INTEGER NOT NULL,
    PRIMARY KEY (task_id, revision),
    UNIQUE (task_id, dimension, scope_kind, scope_id, version),
    -- Model output can never mint a human decision.
    CHECK (dimension NOT IN ('review', 'approval_marker') OR actor_kind = 'human'),
    CHECK (scope_kind <> 'task' OR scope_id = task_id)
) STRICT;

CREATE TABLE state_receipts (
    operation_id TEXT PRIMARY KEY NOT NULL
        CHECK (length(CAST(operation_id AS BLOB)) BETWEEN 1 AND 128),
    principal_id TEXT NOT NULL CHECK (length(principal_id) = 36),
    command TEXT NOT NULL CHECK (command IN ('record_state')),
    task_id TEXT NOT NULL CHECK (length(task_id) = 36),
    expected_revision INTEGER NOT NULL CHECK (expected_revision >= 0),
    resulting_revision INTEGER NOT NULL CHECK (resulting_revision = expected_revision + 1),
    request TEXT NOT NULL CHECK (json_valid(request)),
    status TEXT NOT NULL CHECK (status IN ('applied')),
    recorded_at_ms INTEGER NOT NULL
) STRICT;
