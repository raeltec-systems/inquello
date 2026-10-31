-- Story 1.28: durable export corroboration survives explicit deletion of the
-- local journal. No paths, filenames, source content, credentials, or authority
-- leases. Receipt lookup always requires current same-principal Workspace access.
CREATE TABLE export_provenance_receipts (
    receipt_id UUID PRIMARY KEY,
    principal_id UUID NOT NULL REFERENCES principals (principal_id),
    operation_id UUID NOT NULL,
    command_epoch BIGINT NOT NULL CHECK (command_epoch > 0),
    request_digest TEXT NOT NULL CHECK (request_digest ~ '^[0-9a-f]{64}$'),
    manifest_digest TEXT NOT NULL CHECK (manifest_digest ~ '^[0-9a-f]{64}$'),
    workspace_ids UUID[] NOT NULL CHECK (cardinality(workspace_ids) BETWEEN 1 AND 1000),
    recorded_at TIMESTAMPTZ NOT NULL,
    UNIQUE (principal_id, operation_id)
);
