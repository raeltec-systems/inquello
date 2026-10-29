-- Inquello working store: a person's own command rules and permission
-- requests with their decisions (Story 1.20).
--
-- user_command_rules: each row is one immutable version of a principal's
-- rule list, written only through the inquello-domain set_user_rules command
-- together with its receipt in user_rule_receipts, in one transaction. A
-- person's rules only prompt or forbid; the domain refuses `allow`.
--
-- permission_requests: one request for permission to act, never changed
-- except that an allowed request is marked used once (used_at_ms).
-- permission_decisions: at most one decision per request (the primary key),
-- written with its receipt in permission_receipts. A permission decision is
-- never a review or approval state: nothing here touches task_states.

CREATE TABLE user_command_rules (
    principal_id TEXT NOT NULL CHECK (length(principal_id) = 36),
    -- The rules version this record created (1, 2, ...).
    revision INTEGER NOT NULL CHECK (revision >= 1),
    rules TEXT NOT NULL CHECK (json_valid(rules) AND json_type(rules) = 'array'),
    recorded_at_ms INTEGER NOT NULL,
    PRIMARY KEY (principal_id, revision)
) STRICT;

CREATE TABLE user_rule_receipts (
    operation_id TEXT PRIMARY KEY NOT NULL
        CHECK (length(CAST(operation_id AS BLOB)) BETWEEN 1 AND 128),
    principal_id TEXT NOT NULL CHECK (length(principal_id) = 36),
    command TEXT NOT NULL CHECK (command IN ('set_user_rules')),
    expected_revision INTEGER NOT NULL CHECK (expected_revision >= 0),
    resulting_revision INTEGER NOT NULL CHECK (resulting_revision = expected_revision + 1),
    request TEXT NOT NULL CHECK (json_valid(request)),
    status TEXT NOT NULL CHECK (status IN ('applied')),
    recorded_at_ms INTEGER NOT NULL
) STRICT;

CREATE TABLE permission_requests (
    request_id TEXT PRIMARY KEY NOT NULL CHECK (length(request_id) = 36),
    principal_id TEXT NOT NULL CHECK (length(principal_id) = 36),
    task_id TEXT NOT NULL REFERENCES tasks (task_id),
    workspace_id TEXT NOT NULL CHECK (length(workspace_id) = 36),
    origin TEXT NOT NULL CHECK (origin IN ('tools_exec', 'runtime')),
    evaluation TEXT NOT NULL CHECK (json_valid(evaluation)),
    created_at_ms INTEGER NOT NULL,
    expires_at_ms INTEGER NOT NULL CHECK (expires_at_ms > created_at_ms),
    used_at_ms INTEGER
) STRICT;

CREATE INDEX permission_requests_by_principal
    ON permission_requests (principal_id, task_id, created_at_ms);

CREATE TABLE permission_decisions (
    request_id TEXT PRIMARY KEY NOT NULL REFERENCES permission_requests (request_id),
    outcome TEXT NOT NULL CHECK (outcome IN ('allowed', 'denied', 'expired')),
    actor_kind TEXT NOT NULL CHECK (actor_kind IN ('human', 'automated_reviewer', 'system')),
    actor_ref TEXT NOT NULL CHECK (length(CAST(actor_ref AS BLOB)) BETWEEN 1 AND 128),
    decided_at_ms INTEGER NOT NULL,
    -- Only a person or the automatic reviewer allows; only the host expires.
    CHECK (outcome <> 'allowed' OR actor_kind IN ('human', 'automated_reviewer')),
    CHECK (outcome <> 'expired' OR actor_kind = 'system')
) STRICT;

CREATE TABLE permission_receipts (
    operation_id TEXT PRIMARY KEY NOT NULL
        CHECK (length(CAST(operation_id AS BLOB)) BETWEEN 1 AND 128),
    principal_id TEXT NOT NULL CHECK (length(principal_id) = 36),
    command TEXT NOT NULL CHECK (command IN ('request_permission', 'decide_permission')),
    request_id TEXT NOT NULL CHECK (length(request_id) = 36),
    expected_revision INTEGER NOT NULL CHECK (expected_revision >= 0),
    resulting_revision INTEGER NOT NULL CHECK (resulting_revision = expected_revision + 1),
    request TEXT NOT NULL CHECK (json_valid(request)),
    status TEXT NOT NULL CHECK (status IN ('applied')),
    recorded_at_ms INTEGER NOT NULL
) STRICT;
