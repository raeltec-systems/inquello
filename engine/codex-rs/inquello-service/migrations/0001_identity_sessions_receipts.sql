-- Inquello shared service, schema 1: principals, login transactions, sessions,
-- refresh families, hashed credentials, fixture-seeded memberships, SC-2
-- receipts and invalidation events. No raw credential is ever stored: every
-- credential column holds a 32-byte SHA-256 hash.

-- The current SC-2 command epoch. Rotated (for example after a restore) so that
-- operations from an older epoch are never treated as fresh.
CREATE TABLE service_state (
    singleton BOOLEAN PRIMARY KEY DEFAULT TRUE CHECK (singleton),
    command_epoch BIGINT NOT NULL CHECK (command_epoch > 0)
);
INSERT INTO service_state (singleton, command_epoch) VALUES (TRUE, 1);

-- A principal is keyed by (issuer, subject). Email and display name are mutable
-- attributes: deliberately not unique and not indexed, never a link key.
CREATE TABLE principals (
    principal_id UUID PRIMARY KEY,
    issuer TEXT NOT NULL,
    subject TEXT NOT NULL CHECK (subject <> ''),
    email TEXT,
    display_name TEXT,
    status TEXT NOT NULL CHECK (status IN ('active', 'disabled')),
    revision BIGINT NOT NULL CHECK (revision > 0),
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL,
    UNIQUE (issuer, subject)
);

-- Expiring, one-use login transactions bound to nonce, issuer, client and
-- redirect URI. proof_hash is the hash of the proof returned at creation.
CREATE TABLE login_transactions (
    login_transaction_id UUID PRIMARY KEY,
    proof_hash BYTEA NOT NULL UNIQUE CHECK (octet_length(proof_hash) = 32),
    nonce TEXT NOT NULL,
    issuer TEXT NOT NULL,
    client_id TEXT NOT NULL,
    redirect_uri TEXT NOT NULL,
    device_id UUID NOT NULL,
    created_at TIMESTAMPTZ NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    consumed_at TIMESTAMPTZ,
    consumed_reason TEXT CHECK (consumed_reason IN ('bootstrapped', 'abandoned')),
    session_id UUID,
    CHECK ((consumed_at IS NULL) = (consumed_reason IS NULL))
);

-- Hashes of ID tokens already used for a bootstrap, so a token is never
-- accepted twice.
CREATE TABLE consumed_id_tokens (
    issuer TEXT NOT NULL,
    token_hash BYTEA NOT NULL CHECK (octet_length(token_hash) = 32),
    consumed_at TIMESTAMPTZ NOT NULL,
    token_expires_at TIMESTAMPTZ NOT NULL,
    PRIMARY KEY (issuer, token_hash)
);

CREATE TABLE refresh_families (
    family_id UUID PRIMARY KEY,
    principal_id UUID NOT NULL REFERENCES principals (principal_id),
    created_at TIMESTAMPTZ NOT NULL,
    revoked_at TIMESTAMPTZ,
    revoked_reason TEXT CHECK (revoked_reason IN ('refresh_reuse', 'family_revoke', 'logout', 'login_abandoned')),
    CHECK ((revoked_at IS NULL) = (revoked_reason IS NULL))
);
CREATE INDEX refresh_families_principal ON refresh_families (principal_id);

-- The server-held session record. (issuer, subject) is the subject reference.
CREATE TABLE sessions (
    session_id UUID PRIMARY KEY,
    principal_id UUID NOT NULL REFERENCES principals (principal_id),
    device_id UUID NOT NULL,
    family_id UUID NOT NULL REFERENCES refresh_families (family_id),
    login_transaction_id UUID NOT NULL REFERENCES login_transactions (login_transaction_id),
    issuer TEXT NOT NULL,
    subject TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL,
    last_authenticated_at TIMESTAMPTZ NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    revoked_at TIMESTAMPTZ,
    revision BIGINT NOT NULL CHECK (revision > 0)
);
CREATE INDEX sessions_principal ON sessions (principal_id);
CREATE INDEX sessions_family ON sessions (family_id);

-- Access and refresh credentials, by hash. A refresh rotates both: the old pair
-- becomes 'rotated' and a new 'current' pair is issued at the next generation.
CREATE TABLE session_credentials (
    credential_hash BYTEA PRIMARY KEY CHECK (octet_length(credential_hash) = 32),
    kind TEXT NOT NULL CHECK (kind IN ('access', 'refresh')),
    session_id UUID NOT NULL REFERENCES sessions (session_id),
    generation BIGINT NOT NULL CHECK (generation > 0),
    state TEXT NOT NULL CHECK (state IN ('current', 'rotated', 'revoked')),
    issued_at TIMESTAMPTZ NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL
);
CREATE INDEX session_credentials_session ON session_credentials (session_id);

-- Displayable memberships. Seeded by fixtures only: no API writes this table
-- until Story 1.11.
CREATE TABLE memberships (
    principal_id UUID NOT NULL REFERENCES principals (principal_id),
    workspace_id UUID NOT NULL,
    workspace_kind TEXT NOT NULL,
    role TEXT NOT NULL,
    status TEXT NOT NULL,
    revision BIGINT NOT NULL CHECK (revision > 0),
    PRIMARY KEY (principal_id, workspace_id)
);

-- Durable SC-2 operation receipts. The response is the exact recorded outcome
-- and never contains a credential.
CREATE TABLE operation_receipts (
    receipt_id UUID PRIMARY KEY,
    principal_id UUID NOT NULL REFERENCES principals (principal_id),
    scope_kind TEXT NOT NULL CHECK (scope_kind IN ('principal', 'workspace')),
    scope_id UUID NOT NULL,
    operation_id TEXT NOT NULL CHECK (octet_length(operation_id) BETWEEN 1 AND 128),
    command_epoch BIGINT NOT NULL CHECK (command_epoch > 0),
    command TEXT NOT NULL,
    request_digest TEXT NOT NULL CHECK (request_digest ~ '^[0-9a-f]{64}$'),
    response JSONB NOT NULL,
    recorded_at TIMESTAMPTZ NOT NULL,
    UNIQUE (principal_id, scope_kind, scope_id, operation_id)
);

-- Durable principal/session invalidations, written in the same transaction as
-- the revocation they record. No credential or content is stored here.
CREATE TABLE invalidation_events (
    event_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    principal_id UUID NOT NULL REFERENCES principals (principal_id),
    session_id UUID NOT NULL REFERENCES sessions (session_id),
    family_id UUID NOT NULL REFERENCES refresh_families (family_id),
    reason TEXT NOT NULL,
    recorded_at TIMESTAMPTZ NOT NULL
);
