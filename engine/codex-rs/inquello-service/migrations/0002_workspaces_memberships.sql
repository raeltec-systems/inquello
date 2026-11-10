-- Inquello shared service, schema 2 (Story 1.11): internal-company Workspaces
-- with a versioned role policy, memberships with role bindings, Engagements and
-- their memberships, identity-bound invites, operator receipts and Workspace
-- invalidation events. Grants and resource registrations are fixture-only: no
-- API writes them until Epic 4. No content is stored.

-- 0001's displayable memberships table was fixture-only; real memberships
-- replace it.
DROP TABLE memberships;

-- `external_audit` is representable only so it can be refused as
-- route_not_available (OQ-15); the operator CLI never creates one.
-- authorization_epoch increments on every authority change (member removed,
-- roles changed, Engagement member removed, policy updated); commands take this
-- row's lock after principal and session and before any resource.
CREATE TABLE workspaces (
    workspace_id UUID PRIMARY KEY,
    name TEXT NOT NULL CHECK (char_length(name) BETWEEN 1 AND 200),
    kind TEXT NOT NULL CHECK (kind IN ('internal_company', 'external_audit')),
    policy_revision BIGINT NOT NULL CHECK (policy_revision > 0),
    authorization_epoch BIGINT NOT NULL CHECK (authorization_epoch > 0),
    revision BIGINT NOT NULL CHECK (revision > 0),
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL
);

-- Every policy revision of a Workspace, kept so a membership's policy_revision
-- always names a stored document.
CREATE TABLE workspace_policies (
    workspace_id UUID NOT NULL REFERENCES workspaces (workspace_id),
    policy_revision BIGINT NOT NULL CHECK (policy_revision > 0),
    document JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL,
    PRIMARY KEY (workspace_id, policy_revision)
);

CREATE TABLE memberships (
    workspace_id UUID NOT NULL REFERENCES workspaces (workspace_id),
    principal_id UUID NOT NULL REFERENCES principals (principal_id),
    status TEXT NOT NULL CHECK (status IN ('active', 'removed')),
    roles TEXT[] NOT NULL,
    policy_revision BIGINT NOT NULL CHECK (policy_revision > 0),
    revision BIGINT NOT NULL CHECK (revision > 0),
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL,
    PRIMARY KEY (workspace_id, principal_id),
    CHECK (status = 'active' OR cardinality(roles) = 0)
);
CREATE INDEX memberships_principal ON memberships (principal_id);

CREATE TABLE engagements (
    engagement_id UUID PRIMARY KEY,
    workspace_id UUID NOT NULL REFERENCES workspaces (workspace_id),
    name TEXT NOT NULL CHECK (char_length(name) BETWEEN 1 AND 200),
    revision BIGINT NOT NULL CHECK (revision > 0),
    created_by UUID NOT NULL REFERENCES principals (principal_id),
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL,
    UNIQUE (workspace_id, engagement_id)
);

-- Engagement membership is distinct from Workspace membership, needs an active
-- Workspace membership, and never exposes a private Task.
CREATE TABLE engagement_memberships (
    engagement_id UUID NOT NULL,
    workspace_id UUID NOT NULL,
    principal_id UUID NOT NULL REFERENCES principals (principal_id),
    status TEXT NOT NULL CHECK (status IN ('active', 'removed')),
    revision BIGINT NOT NULL CHECK (revision > 0),
    updated_at TIMESTAMPTZ NOT NULL,
    PRIMARY KEY (engagement_id, principal_id),
    FOREIGN KEY (workspace_id, engagement_id) REFERENCES engagements (workspace_id, engagement_id),
    FOREIGN KEY (workspace_id, principal_id) REFERENCES memberships (workspace_id, principal_id)
);

-- Expiring, one-use invites bound to (issuer, subject). Email is deliberately
-- absent: it never matches. issued_by is the administrator who held
-- manage_membership, or NULL for the operator's bootstrap invite (then
-- operator_receipt_id names the operator receipt).
CREATE TABLE invites (
    invite_id UUID PRIMARY KEY,
    workspace_id UUID NOT NULL REFERENCES workspaces (workspace_id),
    issuer TEXT NOT NULL CHECK (char_length(issuer) BETWEEN 1 AND 2048),
    subject TEXT NOT NULL CHECK (char_length(subject) BETWEEN 1 AND 255),
    roles TEXT[] NOT NULL CHECK (cardinality(roles) > 0),
    policy_revision BIGINT NOT NULL CHECK (policy_revision > 0),
    issued_by UUID REFERENCES principals (principal_id),
    operator_receipt_id UUID,
    state TEXT NOT NULL CHECK (state IN ('pending', 'accepted', 'revoked')),
    revision BIGINT NOT NULL CHECK (revision > 0),
    created_at TIMESTAMPTZ NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    accepted_by UUID REFERENCES principals (principal_id),
    closed_at TIMESTAMPTZ,
    CHECK ((issued_by IS NULL) <> (operator_receipt_id IS NULL)),
    CHECK ((state = 'pending') = (closed_at IS NULL)),
    CHECK ((state = 'accepted') = (accepted_by IS NOT NULL))
);
CREATE INDEX invites_workspace ON invites (workspace_id);

-- Operator CLI receipts (create-workspace, update-policy). The CLI connects to
-- the database directly; no HTTP route reaches these commands.
CREATE TABLE operator_receipts (
    receipt_id UUID PRIMARY KEY,
    operator TEXT NOT NULL CHECK (char_length(operator) BETWEEN 1 AND 128),
    command TEXT NOT NULL CHECK (command IN ('create_workspace', 'update_policy')),
    workspace_id UUID NOT NULL REFERENCES workspaces (workspace_id),
    request_digest TEXT NOT NULL CHECK (request_digest ~ '^[0-9a-f]{64}$'),
    response JSONB NOT NULL,
    recorded_at TIMESTAMPTZ NOT NULL
);

-- Durable Workspace invalidation events, written in the same transaction as the
-- authority change they record. No content is stored here.
CREATE TABLE workspace_events (
    event_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    workspace_id UUID NOT NULL REFERENCES workspaces (workspace_id),
    authorization_epoch BIGINT NOT NULL CHECK (authorization_epoch > 0),
    kind TEXT NOT NULL,
    principal_id UUID,
    recorded_at TIMESTAMPTZ NOT NULL
);

-- Fixture-only until Epic 4: what the authority knows about a resource, never
-- its content. A private Task reference is allowed only for its creator.
CREATE TABLE resource_registrations (
    workspace_id UUID NOT NULL REFERENCES workspaces (workspace_id),
    resource_id UUID NOT NULL,
    kind TEXT NOT NULL CHECK (kind IN ('private_task', 'shared_resource')),
    creator_principal_id UUID NOT NULL REFERENCES principals (principal_id),
    engagement_id UUID REFERENCES engagements (engagement_id),
    PRIMARY KEY (workspace_id, resource_id)
);

-- Fixture-only until Epic 4: explicit grants. There is no grant-issuing API.
CREATE TABLE grants (
    grant_id UUID PRIMARY KEY,
    workspace_id UUID NOT NULL REFERENCES workspaces (workspace_id),
    resource_id UUID NOT NULL,
    audience_kind TEXT NOT NULL CHECK (audience_kind IN ('principal', 'workspace_audit_team')),
    audience_principal_id UUID REFERENCES principals (principal_id),
    actions TEXT[] NOT NULL,
    state TEXT NOT NULL CHECK (state IN ('active', 'withdrawn')),
    revision BIGINT NOT NULL CHECK (revision > 0),
    CHECK ((audience_kind = 'principal') = (audience_principal_id IS NOT NULL)),
    FOREIGN KEY (workspace_id, resource_id) REFERENCES resource_registrations (workspace_id, resource_id)
);
CREATE INDEX grants_resource ON grants (workspace_id, resource_id);
