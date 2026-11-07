-- Additive Story 1.28 schema. No approval is seeded. Only operator commands write
-- these rows, while holding the Workspace authorization-epoch lock.
CREATE TABLE route_approvals (
    workspace_id UUID NOT NULL REFERENCES workspaces (workspace_id),
    route_id TEXT NOT NULL CHECK (route_id IN ('codex-responses', 'claude-api-key')),
    revision BIGINT NOT NULL CHECK (revision > 0),
    identity JSONB NOT NULL,
    approval JSONB NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL,
    PRIMARY KEY (workspace_id, route_id)
);

-- Append-only bounded receipts, independent of mutable approval state. A receipt
-- is never authorization. Operation IDs cannot be reassigned after revocation.
CREATE TABLE route_approval_receipts (
    workspace_id UUID NOT NULL REFERENCES workspaces (workspace_id),
    operation_id UUID NOT NULL,
    receipt_id UUID NOT NULL UNIQUE,
    operator TEXT NOT NULL CHECK (char_length(operator) BETWEEN 1 AND 128),
    command_epoch BIGINT NOT NULL CHECK (command_epoch > 0),
    request_digest TEXT NOT NULL CHECK (request_digest ~ '^[0-9a-f]{64}$'),
    response JSONB NOT NULL,
    recorded_at TIMESTAMPTZ NOT NULL,
    PRIMARY KEY (workspace_id, operation_id)
);

-- Immutable revision history retains the exact scope and issuer reviewed by the
-- operator, including withdrawals. Contains no Task content or credentials.
CREATE TABLE route_approval_history (
    workspace_id UUID NOT NULL REFERENCES workspaces (workspace_id),
    route_id TEXT NOT NULL,
    revision BIGINT NOT NULL CHECK (revision > 0),
    identity JSONB NOT NULL,
    approval JSONB NOT NULL,
    receipt_id UUID NOT NULL REFERENCES route_approval_receipts (receipt_id),
    recorded_at TIMESTAMPTZ NOT NULL,
    PRIMARY KEY (workspace_id, route_id, revision)
);
