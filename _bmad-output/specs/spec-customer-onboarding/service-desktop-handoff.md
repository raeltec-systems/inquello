# Story 1.31 sequential checkpoint: service to desktop

The approved build spec remains the source of truth. Whole story remains in-progress. This document records implementation contracts, not customer acceptance.

## Implemented wire contracts

All routes authenticate bearer credentials in main/service only; renderer never handles tokens. Fixed safe errors and no-store responses remain in effect.

- `POST /v1/onboarding/commands`: `OnboardingCommandEnvelope {command_epoch, operation_id, expected_revision, schema_version, payload}`.
  - `payload: {command:"create_workspace", name}`, expected revision `"0"`.
  - `payload: {command:"accept_invitation", invite_id}`, expected revision from invitation discovery.
  - Response is existing `CommandResponse`. **resource_id is workspace ID for both commands**. Creation returns revision 1; acceptance returns membership revision and current authorization epoch.
  - Initial policy has Owner/Member private read/derive/comment; Owner also manages membership. Reviewer uses existing review actions. Sharing/export, network, MCP tools/extensions, broad modes and local MCP remain denied; independent route/provider/creator gates remain unchanged.
- `GET /v1/onboarding/receipts/{operation}`: `CommandResponse | null`. Principal scoped; current workspace membership is rechecked. This is a read, never replay.
- `GET /v1/invitations`: `{ invitations: [{invite_id, workspace_id, workspace_name, roles, revision, expires_at}] }`. Only matching fresh verified-email proof at exact issuer; current grantor/policy/expiry checked. Max 100.
- `GET /v1/workspaces/{workspace_id}/members`: admin-only `{workspace_id, members:[{principal_id,display_name,roles,revision}]}`.
- Existing `POST /v1/workspaces/{id}/commands` gains `{command:"issue_email_invite",email,roles}` with expected revision zero. Response resource_id is the invitation ID. Existing change_roles/remove_member/revoke_invite retain expected revisions, authority checks and receipts.
- `GET /v1/workspaces/{workspace_id}/receipts/{operation}`: `CommandResponse | null`, scoped to current managing caller and workspace.

All revision/command_epoch values use the existing decimal-string protocol. Validate DTOs strictly before projecting renderer-safe fields. Never expose a general URL/RPC method.

## Verification and reauthentication UX

Creation and recipient-discovery `denied` for an authenticated caller require fresh verified email. Show: “Verify your email with your identity provider, then sign in again.” Provide an **active explicit reauthentication** action, not the existing disabled Sign in button. Current IdentitySession.signIn short-circuits when already signed in: continuation must implement confirmed sign-out then hosted sign-in, proceeding only when sign-out succeeds. Service credential refresh does not renew proof.

Acceptance `denied` remains deliberately indistinguishable for missing/wrong-account/expired/revoked/proof failures. Show a safe unavailable state; optional verification/re-sign-in recovery must not reveal invitation details.

Persist draft and operation envelope securely per principal before sending. On uncertain outcome/restart, read the matching receipt first. A missing receipt permits an explicit same-envelope retry; never automatically replay a mutation. After returning from sign-in, rebind to the exact principal, reconcile, and require deliberate retry/confirmation. Do not reuse a prior principal's draft as a different person's mutation.

Email invitation creation only makes an in-app pending invitation. **No email is sent by this increment.** UI must distinguish pending invitation from external delivery and say delivery is not configured, not “email sent”. A recipient without an account signs up/signs in through hosted identity before discovery. Invitation UUID is not bearer authorization; no delivery token or plaintext bearer invitation secret exists.

## Identity configuration foundation

Desktop config adds optional `callback_port` (integer 1024–65535). It binds 127.0.0.1 before browser launch and refuses an occupied fixed port without fallback. `issuer_url` preserves exact HTTPS path/trailing slash; no userinfo/query/fragment. Issuer endpoints stay same-origin HTTPS and refuse userinfo. Existing synthetic/operator configs without callback_port keep ephemeral compatibility; these are not real Auth0 proof.

Service issuer config with empty `jwks.keys` selects HTTPS discovery/JWKS rotation: exact returned issuer, same-origin HTTPS JWKS, no redirect, bounded body/key count, five-minute hard key expiry and 30-second single-flight refresh budget. Non-empty keys retain explicit pinned/offline mode. Production tenant registration/TLS trust changes and delivery remain separately authorized and unperformed.

## Remaining sequential work

1. Configurable invitation delivery adapter, durable atomic outbox/retry/idempotence and local fake-transport tests. This code is approved scope; only real provider setup/email sends require separate authorization. Approved next path: injectable DeliveryTransport plus concrete Resend HTTP adapter using existing reqwest, no new installs. Before coding, read https://resend.com/docs/api-reference/emails/send-email and https://resend.com/docs/dashboard/emails/idempotency-keys . Persist stable idempotency key plus exact payload; provider deduplication is bounded to 24 hours, so uncertain attempts beyond that window must stop/reconcile or require deliberate manual resend. Sent means provider accepted, not inbox delivery. No real account/domain/key/mail setup is authorized.
2. Main onboarding service + validated named IPC/preload methods; strict DTO validation and principal-bound durable pending operations/drafts.
3. Accessible branded account/signup/recovery, workspace create/choice, invitation acceptance and team management controls; explicit confirmations, safe errors, no helper membership acceptance.
4. Actual normal-operation two-fictional-person Electron journey, keyboard/focus/resize pixels, restart/lost-response/revocation and private-provider/conversation/Stop/Resume regression.
5. Matched codex-cli/app-server rebuild before desktop Vitest/Electron; run new identity tests plus existing suite and complete desktop build.
6. Selected T3 presentation provenance/MIT notice if adapting presentation code.
7. Real Auth0 fixed-callback signup/recovery pilot and external delivery acceptance remain separate deployment authorization, not synthetic claims.

The service increment includes disposable-database tests and deterministic synthetic JWKS rotation tests. Test execution results are appended to the main build spec after actual terminal outcomes. Desktop identity tests are added but intentionally not run until the matched native rebuild in the desktop continuation.

## Explicit gaps to close before whole-story acceptance

- The existing last-administrator helper counts active memberships, not principal status. Next service checkpoint must exclude already-disabled principals from eligible-admin counts and exercise that deterministic last-admin case. Preserve principal-to-workspace/member lock order; do not introduce cross-admin deadlocks by acquiring extra principal locks late. Assess concurrent operator disable separately, without claiming an unproven global invariant.
- The fixed-port listener refuses occupied ports, but IdentitySession currently maps generic bind failures to “interrupted”. Add a clear occupied-registered-port refusal in the desktop flow without fallback.
- Existing desktop `ca_path` is the sole trust anchor for **both** service and issuer. A private fixture/service CA alone cannot validate hosted Auth0's public certificate chain. Add deliberate separate issuer-trust configuration (public system roots for hosted Auth0 vs explicit fixture CA) while retaining service pinning, never disabling TLS or modifying OS trust.
- Require the explicit registered fixed callback port in a production Auth0 profile. Optional/ephemeral mode currently exists for synthetic/operator compatibility, not evidence of production compatibility.
- Cache rotation tests use deterministic injected synthetic discovery outcomes and signed keys; real hosted discovery/TLS/tenant registration remains unqualified. URL/port support alone is not an Auth0 compatibility claim.
