# Brownfield boundaries and acceptance

## Source facts

- `desktop/src/renderer/Account.tsx` exposes sign-in/out; `Shell/Sidebar.tsx` lists existing workspaces and an empty state. Neither establishes a customer account/workspace.
- `desktop/src/main/identity/{session,pkce,loopback,service-client,vault}.ts` already owns external-browser PKCE, session handling and credential protection; reuse it.
- `engine/codex-rs/inquello-service/src/routes.rs` has GET workspaces, role and membership commands, and invite acceptance, but no workspace creation endpoint or pending-invitation discovery.
- `admin.rs` bootstraps workspaces transactionally through the operator CLI. `workspace_commands.rs` and `workspaces.rs` implement invitations, roles, removal, receipts and authorization epochs.
- `oidc.rs` validates signature, issuer, audience, nonce, lifetime and subject. Its current IdentityClaims carries display email/name but no email_verified authority. Raw email therefore cannot safely redeem an invitation.
- Story 1.11 explicitly selected operator-only bootstrap and exact issuer/subject invitations. Story 1.14 organizes already-accessible workspaces. The new customer journey changes scope; do not rewrite either historical completed contract.
- Public Codex login code is an OAuth/PKCE client of hosted account services, not their signup or workspace backend source.

## Proposed implementation boundaries

One cohesive customer-onboarding goal, proposed Story 1.31. Until owner decisions are recorded, all creation/provider/email semantics remain draft.

A workspace-create transaction must authenticate its caller, apply the approved creation eligibility and server-owned initial policy, create exactly one initial owner membership, and retain an operation receipt. It cannot accept caller-defined grants or elevate an existing workspace. No auto-joining by email domain.

Invite discovery must reveal only invitations already bound to the authenticated recipient. If email invitations are approved, specify verified claim provenance, normalization, expiry, token hashing/one-time redemption, wrong-account behavior, delivery retry and no cross-issuer linking before implementation. Delivery success is distinct from membership acceptance. Do not expose a global account search.

Reuse policy-defined roles; membership management is distinct from content authority. New workspace defaults must not enable broader tools, sharing/export, automatic permission review or real-data model processing. Preserve the last eligible administrator and revoke cached/in-flight authority on removal.

Use existing Inquello branding and accessible primitives; adapt only relevant pinned T3 presentation code with its license. Account onboarding, workspace choice, pending invitations and team settings must be real wired views, not demo controls. Show a useful empty state and explicit retry after uncertainty; never replay a mutation silently.

## Acceptance coverage

| Case | Required evidence |
| --- | --- |
| Fresh account and workspace | Actual UI creates identity through configured provider and one permitted workspace; no helper membership injection |
| Invitation and role | Admin issues; recipient sees and accepts exact current access; displayed role matches server policy |
| Wrong identity / expired / revoked | Same safe unavailable result; no workspace or private content disclosure |
| Double submit / lost response / restart | Receipt reconciliation returns original result; no duplicate workspace or member |
| Last owner / escalation / stale revision | Transaction refuses invalid change; original authority preserved |
| Removed member with open Task | Subsequent read, cached display and execution are reauthorized and denied when no longer permitted |
| Private Task isolation | Second member and administrator cannot retrieve creator Task, transcript, search snippet or provider secret |
| Accessible recovery | Keyboard/focus, busy/uncertain/error states and resize verified from actual Electron pixels |
| Provider handoff | Identity works without inference credentials; provider connection is explicit and uses the existing secure vault |
| Deployment | Real issuer signup/recovery and chosen delivery integration tested separately from deterministic local fixtures |

## Verification boundary

Tests must cover service transactions against disposable PostgreSQL, protocol fixtures, main/preload sender and payload validation, renderer interaction, and an actual Electron journey using normal onboarding operations. Retain current conversation, Stop/Resume, provider isolation and paid-budget guards. Live identity/email setup and paid inference require their own deployment/credential authorization; no synthetic pass substitutes for them.
