-- Email is a notification, never an invitation bearer capability.
CREATE TABLE invitation_deliveries (
 invite_id uuid PRIMARY KEY REFERENCES invites(invite_id),
 idempotency_key text NOT NULL UNIQUE,
 recipient text NOT NULL,
 payload jsonb,
 configuration_id text,
 state text NOT NULL DEFAULT 'not_configured'
   CHECK (state IN ('not_configured','pending','sending','provider_accepted','retry_pending','manual_reconciliation_required','cancelled','failed')),
 first_attempt_at timestamptz,
 next_attempt_at timestamptz,
 lease_until timestamptz,
 attempt_id uuid,
 attempts integer NOT NULL DEFAULT 0,
 provider_id text,
 updated_at timestamptz NOT NULL
);
CREATE INDEX invitation_delivery_pending ON invitation_deliveries(state, next_attempt_at);
