-- Story 1.31: issuer-validated proof is session-bound, never renewed by refresh.
ALTER TABLE sessions ADD COLUMN verified_email TEXT;
ALTER TABLE sessions ADD COLUMN email_proof_issued_at TIMESTAMPTZ;
ALTER TABLE sessions ADD COLUMN email_proof_expires_at TIMESTAMPTZ;
ALTER TABLE sessions ADD CONSTRAINT verified_email_proof_complete CHECK (
 (verified_email IS NULL AND email_proof_issued_at IS NULL AND email_proof_expires_at IS NULL)
 OR (verified_email IS NOT NULL AND email_proof_issued_at IS NOT NULL AND email_proof_expires_at IS NOT NULL)
);

ALTER TABLE invites ADD COLUMN recipient_email TEXT;
CREATE INDEX invites_recipient ON invites (issuer, recipient_email) WHERE state = 'pending';

ALTER TABLE workspaces ADD COLUMN onboarding_created BOOLEAN NOT NULL DEFAULT false;
