---
title: 'Story 1.31: Onboard customers into secure private workspaces'
type: 'feature'
created: '2026-11-01'
status: 'in-progress'
route: 'dispatch'
review_loop_iteration: 0
baseline_commit: '99918b0f7924bfd727b2de337498f265b017ca74'
context:
  - '{project-root}/_bmad-output/specs/spec-customer-onboarding/SPEC.md'
  - '{project-root}/_bmad-output/specs/spec-customer-onboarding/service-desktop-handoff.md'
---

<frozen-after-approval reason="human-owned intent; draft until owner decisions and checkpoint approval">

## Intent

**Problem:** Customers cannot currently establish accounts and workspace access through the desktop without operator/helper setup.

**Approach:** Provide one complete signup/sign-in, create-or-join, invitation, membership and private-work entry journey using existing identity and authorization services. This is new scope beyond Story 1.11's deliberate operator-only bootstrap, not a correction to its historical acceptance.

**Owner decisions (2026-11-01):** Verified users may create and own a new workspace only. Hosted identity owns signup/login/recovery. Owners invite colleagues by email; acceptance requires the correct verified identity, never automatic linking by matching email text. Auth0 hosted OIDC is selected, with a native callback compatibility pilot before production readiness; vendor setup is separately authorized.

## Boundaries & Constraints

**Always:** Immutable issuer/subject identity; server-owned permissions; operation receipts and expected revisions; OS-backed secrets; validated named IPC; creator-private Tasks. Preserve conversation, Stop/Resume, provider isolation and paid-test bounds. First ownership applies only to the newly created workspace. Confirm member/invitation changes explicitly and reconcile uncertain outcomes before retrying.

**Never:** Raw email as identity proof, cross-issuer auto-linking, caller-selected grants, implicit tool/share/export/real-data access, another member's private Task, password storage in Inquello, helper acceptance as UI proof, or silent mutation replay. No live accounts, external delivery, certificates or paid inference during implementation without separate authorization.

## I/O & Edge-Case Matrix

| Scenario | Input/state | Outcome | Error handling |
| --- | --- | --- | --- |
| Fresh entry | Authenticated eligible person | Create or accept permitted workspace access | Preserve draft on failure |
| Pending invite | Intended current recipient | Explicit acceptance and exact roles | Wrong/expired/revoked indistinguishable |
| Interrupted create | Same operation after uncertainty | Original committed outcome only | Reconcile before retry |
| Membership change | Current authorized administrator | Receipt and refreshed authority | Reject stale revision/escalation/last-admin loss |
| Private work | Another member or administrator | No creator Task disclosure | Same safe response as absent work |

</frozen-after-approval>

## Code Map

- `engine/codex-rs/inquello-service/src/{oidc,login,sessions,admin,workspaces,workspace_commands,routes}.rs`: reuse identity validation, transactional bootstrap, receipts and revocation; no HTTP create/discovery currently.
- `desktop/src/main/identity/{session,service-client,vault}.ts`: retain PKCE and credential boundary.
- `desktop/src/main/security/operations.ts`, `desktop/src/preload/`: named sender/payload-validated operations.
- `desktop/src/renderer/{Account.tsx,Shell/Sidebar.tsx}`: replace empty onboarding dead ends with real actions; retain current conversation.

## Tasks & Acceptance

**Execution:**
- [ ] `inquello-service/src/{oidc,login}.rs`: Auth0-compatible verified-email proof with bounded freshness and JWKS rotation; preserve signature, nonce and exact issuer checks.
- [ ] `inquello-service/{src,migrations}/` and `inquello-protocol/src/`: guarded creation, recipient discovery and membership contracts; atomic receipts, safe retries and negative races.
- [ ] `desktop/src/main/identity/`, `main/security/operations.ts`, `preload/`: expose authorized onboarding operations without tokens or general RPC.
- [ ] `desktop/src/renderer/`: accessible account/workspace/invitation/team flow and recovery states using current branded primitives.
- [ ] `desktop/test/`, `inquello-service/tests/`: every matrix case, private-task isolation and secret non-disclosure.
- [ ] `desktop/scripts/`: normal-operation Electron onboarding journey and inspected pixels, not helper grants.
- [ ] Planning/sprint records: add this extension explicitly after approval; preserve old completed stories.

**Acceptance Criteria:**
- Given a fresh profile and configured identity service, when two fictional people complete the UI journey, then one creates and the other deliberately joins the workspace with correct roles and no developer membership helper.
- Given retries, restart or revoked access, when onboarding resumes, then receipts reconcile without duplicate effects and unauthorized access remains denied.
- Given another member or administrator, when they request the creator's Task or provider secrets, then nothing private is disclosed.
- Given missing production issuer/delivery configuration, when the journey cannot continue, then the UI explains the dependency without claiming signup or delivery succeeded.

## Implementation Notes

- No unresolved product choices. Auth0 uses an explicitly configured, exactly registered fixed `http://127.0.0.1:<port>/callback`; bind before opening the browser and fail if occupied, without port fallback. Ephemeral ports remain the existing synthetic/operator compatibility path only. The real-tenant callback pilot is pending; never weaken state/PKCE/issuer checks.
- Migrations add invitation/proof/receipt state; use disposable databases first. Vendor accounts, delivery, trust and production mutations require separate approval.
- Changes span service/protocol, named desktop IPC and onboarding/team UI; no password backend or provider Organizations dependency.

### Sequential implementation checkpoint (2026-11-01)
- Implemented service/protocol foundation: signed boolean verified-email proof is session-bound to issuer/subject and bounded by both token expiry and 10 minutes from issuer `iat`; refreshing service credentials never renews proof.
- Explicit online JWKS mode uses an empty configured keyset: exact issuer discovery, same-origin HTTPS JWKS, no redirects, bounded response/key counts, five-minute hard cache lifetime, 30-second unknown-key refresh budget and single-flight refresh. Non-empty configured keys retain the existing pinned/offline mode.
- Creation and acceptance have principal-scoped operation receipts; workspace membership commands retain existing receipts. New read-only receipt endpoints reconcile without replaying mutations. Acceptance is one-use, checks invitation revision/current policy/current grantor, and increments workspace authority epoch.
- Default Owner/Member include `derive` so onboarding reaches core private conversation work. This is not execution: independent route qualification/data tier/provider consent/current membership/creator checks remain mandatory. No share/export/tool/network authority is granted. This rationale was confirmed by the integrating parent during the build.
- Invitation email matching preserves local-part case and canonicalizes the ASCII domain only. It is never an account-link key. An opaque invitation ID is not a bearer capability; server-validated issuer-bound proof plus deliberate acceptance authorize redemption. No delivery credential/token is emitted or stored, and no external email is sent by this increment.
- Desktop identity foundation adds exact path/trailing-slash issuers and explicit fixed callback ports with occupied-port failure; signup/team views, named onboarding IPC, durable client drafts/uncertain-state reconciliation and the actual two-person Electron journey remain to implement.
- Whole Story 1.31 remains **in-progress**. This checkpoint is not customer acceptance, production tenant qualification or delivery success. Tests/evidence are recorded after execution; no incomplete checkbox is marked done.

## Spec Change Log

## Review Triage Log

## Verification

The following are whole-story verification targets; only the executed checkpoint evidence below is complete.

- `cargo test --locked --offline -j1 -p inquello-domain -p inquello-protocol -p inquello-service --features inquello-service/test-issuer`: disposable-database contracts and negative cases pass.
- `cargo clippy --locked --offline -j1 -p inquello-domain -p inquello-protocol -p inquello-service --features inquello-service/test-issuer --all-targets -- -D warnings`: clean.
- Matched native/protocol rebuild; `pnpm run build` and relevant `pnpm test`: pass without changing timeouts.
- Actual Electron onboarding plus existing conversation/Stop/Resume regression; inspect keyboard/focus/resize and two-user isolation. Production issuer and delivery acceptance remain separate.

### Executed service/identity checkpoint evidence (2026-11-01)

- Full locked/offline single-job domain/protocol/service test command above: **256 passed, 0 failed** on final source. Includes 8 new onboarding integration tests and 2 new signed-proof/cache-rotation tests; disposable PostgreSQL and synthetic topology only. Log: `.tmp/story131-service-verified.log`.
- Strict all-targets clippy command above: **exit 0**. Async key refresh uses a semaphore and never holds a cache mutex across network I/O. Log: `.tmp/story131-clippy-final.log`.
- `desktop/pnpm run build`: **exit 0** (main/renderer TypeScript, data-policy validation, Vite). Existing Vite future config-loader warning remains. Log: `.tmp/story131-desktop-build.log`.
- No timeout values were increased, no dependencies downloaded, no real accounts/email/provider requests or trust-store changes performed.
- **Not yet executed:** new desktop identity Vitest cases, matched codex-cli/app-server rebuild, Electron onboarding/keyboard/focus/resize pixels and conversation/Stop/Resume regression.
- **Not yet implemented:** approved configurable Resend delivery/outbox/retry, named onboarding IPC/main service, durable client drafts, signup/reauthentication/team UI and truthful delivery statuses. See the context handoff for exact DTOs, separate issuer TLS trust, production fixed-port requirement, and remaining disabled-principal last-admin coverage.
- Story and sprint remain **in-progress**; this checkpoint is not full Story 1.31 acceptance.

### Executed delivery checkpoint evidence (2026-11-01)

- Added atomic invitation outbox and explicit opt-in Resend transport/worker/CLI; default remains disabled. Durable exact payload/idempotency key, configuration identity fence, attempt leases and a conservative 23-hour uncertain-retry cutoff prevent silent replay outside provider deduplication bounds. Administrator delivery statuses are safe projections only.
- Dispatch rechecks current grantor principal/membership/policy eligibility before network I/O. Disabled principals no longer count as eligible remaining administrators. No DB locks are held over delivery I/O; already-in-flight notices cannot be recalled and grant no access. Concurrent operator disablement is not claimed as a globally serialized last-administrator invariant.
- Full locked/offline single-job domain/protocol/service test command above: **262 passed, 0 failed**, including 14 onboarding integration tests. Tests use disposable PostgreSQL and injected fake delivery transports; no real email/provider endpoint was activated. Log: `.tmp/story131-delivery-tests.log`.
- Strict all-targets clippy command above: **exit 0**. Log: `.tmp/story131-delivery-clippy.log`. `git diff --check` clean (line-ending warnings only).
- Operator opt-in scheduler/worker configuration and exact delivery status semantics are documented in `engine/codex-rs/inquello-service/DELIVERY.md` (repository-relative path). No accounts, API keys, external delivery, certificates, trust changes or paid inference were configured.
- This supersedes only the earlier "delivery/outbox/retry not implemented" gap. Named desktop onboarding IPC, encrypted principal-bound drafts/receipt reconciliation, signup/team UI, matched native rebuild/new desktop tests and actual Electron acceptance remain incomplete. Story/sprint stay **in-progress**.
