---
title: 'Story 1.31: Onboard customers into secure private workspaces'
type: 'feature'
created: '2026-11-01'
status: 'draft'
route: 'dispatch'
review_loop_iteration: 0
baseline_commit: '99918b0f7924bfd727b2de337498f265b017ca74'
context:
  - '{project-root}/_bmad-output/specs/spec-customer-onboarding/SPEC.md'
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

- No unresolved product choices. Validate ephemeral loopback registration; never weaken callback/PKCE checks to fit a provider.
- Migrations add invitation/proof/receipt state; use disposable databases first. Vendor accounts, delivery, trust and production mutations require separate approval.
- Changes span service/protocol, named desktop IPC and onboarding/team UI; no password backend or provider Organizations dependency.

## Spec Change Log

## Review Triage Log

## Verification

- `cargo test --locked --offline -j1 -p inquello-domain -p inquello-protocol -p inquello-service --features inquello-service/test-issuer`: disposable-database contracts and negative cases pass.
- `cargo clippy --locked --offline -j1 -p inquello-domain -p inquello-protocol -p inquello-service --features inquello-service/test-issuer --all-targets -- -D warnings`: clean.
- Matched native/protocol rebuild; `pnpm run build` and relevant `pnpm test`: pass without changing timeouts.
- Actual Electron onboarding plus existing conversation/Stop/Resume regression; inspect keyboard/focus/resize and two-user isolation. Production issuer and delivery acceptance remain separate.
