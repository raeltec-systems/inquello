-- Durable human processing consent. No grants, memberships or policies seeded.
-- Mutations hold the existing Workspace authorization-epoch UPDATE lock.
CREATE TABLE provider_consents (
    workspace_id UUID NOT NULL REFERENCES workspaces(workspace_id),
    provider TEXT NOT NULL CHECK (provider = 'openai-api'),
    revision BIGINT NOT NULL CHECK (revision > 0),
    contract_digest TEXT NOT NULL CHECK (contract_digest ~ '^[0-9a-f]{64}$'),
    contract JSONB NOT NULL,
    state TEXT NOT NULL CHECK (state IN ('allowed', 'revoked')),
    decided_by UUID NOT NULL REFERENCES principals(principal_id),
    decided_at TIMESTAMPTZ NOT NULL,
    PRIMARY KEY (workspace_id, provider)
);
-- A tombstone remains after revoke; legacy approval cannot revive processing.
CREATE TABLE provider_consent_receipts (
    workspace_id UUID NOT NULL REFERENCES workspaces(workspace_id),
    operation_id UUID NOT NULL,
    principal_id UUID NOT NULL REFERENCES principals(principal_id),
    request_digest TEXT NOT NULL CHECK (request_digest ~ '^[0-9a-f]{64}$'),
    receipt_id UUID NOT NULL UNIQUE,
    response JSONB NOT NULL,
    recorded_at TIMESTAMPTZ NOT NULL,
    PRIMARY KEY (workspace_id, operation_id)
);
CREATE TABLE provider_consent_history (
    workspace_id UUID NOT NULL REFERENCES workspaces(workspace_id),
    provider TEXT NOT NULL,
    revision BIGINT NOT NULL CHECK (revision > 0),
    contract_digest TEXT NOT NULL,
    contract JSONB NOT NULL,
    state TEXT NOT NULL CHECK (state IN ('allowed', 'revoked')),
    decided_by UUID NOT NULL REFERENCES principals(principal_id),
    decided_at TIMESTAMPTZ NOT NULL,
    receipt_id UUID NOT NULL REFERENCES provider_consent_receipts(receipt_id),
    PRIMARY KEY (workspace_id, provider, revision)
);
