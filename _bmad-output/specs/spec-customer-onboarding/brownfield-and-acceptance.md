# Brownfield boundaries and acceptance

## Source facts

- `desktop/src/renderer/Account.tsx` exposes sign-in/out; `Shell/Sidebar.tsx` lists existing workspaces and an empty state. Neither establishes a customer account/workspace.
- `desktop/src/main/identity/{session,pkce,loopback,service-client,vault}.ts` already owns external-browser PKCE, session handling and credential protection; reuse it.
- `engine/codex-rs/inquello-service/src/routes.rs` has GET workspaces, role and membership commands, and invite acceptance, but no workspace creation endpoint or pending-invitation discovery.
- `admin.rs` bootstraps workspaces transactionally through the operator CLI. `workspace_commands.rs` and `workspaces.rs` implement invitations, roles, removal, receipts and authorization epochs.
- `oidc.rs` validates signature, issuer, audience, nonce, lifetime and subject. Its current IdentityClaims carries display email/name but no email_verified authority. Raw email therefore cannot safely redeem an invitation.
- Current native-client contract uses Authorization Code/PKCE S256, ephemeral `http://127.0.0.1:<port>/callback`, and `openid profile email`; service validates nonce/issuer/audience/azp/signature/subject. Static JWKS configuration needs a production rotation design. Desktop config currently accepts HTTPS origins only, so path-based issuers require a deliberate exact-issuer/endpoint trust extension, not weaker validation.
- Story 1.11 explicitly selected operator-only bootstrap and exact issuer/subject invitations. Story 1.14 organizes already-accessible workspaces. The new customer journey changes scope; do not rewrite either historical completed contract.
- Public Codex login code is an OAuth/PKCE client of hosted account services, not their signup or workspace backend source.

## Proposed implementation boundaries

One cohesive customer-onboarding goal, proposed Story 1.31. The owner approved verified-user self-service creation and email invitations with verified-recipient acceptance and no automatic account linking. Auth0 hosted OIDC is selected; the build checkpoint remains pending. The compatibility pilot must establish the exact permitted loopback callback registration without relaxing state, PKCE, issuer or origin checks. No vendor setup is authorized.

A workspace-create transaction must authenticate its caller, apply the approved creation eligibility and server-owned initial policy, create exactly one initial owner membership, and retain an operation receipt. It cannot accept caller-defined grants or elevate an existing workspace. No auto-joining by email domain.

Invite discovery must reveal only invitations already bound to the authenticated recipient. For approved email invitations, specify verified claim provenance, normalization, expiry, token hashing/one-time redemption, wrong-account behavior, delivery retry and no cross-issuer linking before implementation. Verified-email eligibility must be fresh at grant time, with bounded proof age and safe reauthentication; local refresh must not perpetuate old issuer proof indefinitely. Auth0 discovery/JWKS must use exact issuer trust, bounded caching/unknown-key refresh and rotation/revocation tests. Delivery success is distinct from membership acceptance. Do not expose a global account search.

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

## Auth0 compatibility implementation references

- [OIDC scopes](https://auth0.com/docs/get-started/apis/scopes/openid-connect-scopes): request `openid profile email`; require the boolean verified claim from server-validated identity, never display text.
- [JWKS](https://auth0.com/docs/secure/tokens/json-web-tokens/json-web-key-sets): multiple keys, bounded caching, rate-limited unknown-key refresh and explicit revoked-key expiry behavior.
- [Hosted signup](https://support.auth0.com/center/s/article/How-to-Redirect-Users-directly-to-the-Hosted-Signup-Page): `screen_hint=signup` on the normal authorization request, not a separate password implementation.
- [Callback matching](https://support.auth0.com/center/s/article/Callback-URL-Mismatch-Error-Is-Not-in-the-List-of-Allowed-Callback-URLs) describes exact port matching; arbitrary ephemeral-port registration is not established. Candidate: explicitly configured fixed `127.0.0.1` callback registered exactly, listener bound before external browser launch, clear occupied-port refusal, no arbitrary callback fallback. Test Windows listener ownership, wrong state, replay and cancellation.
- [Loopback confirmation](https://support.auth0.com/center/s/article/end-of-life-rollout-for-defaulting-to-skip-login-confirmation-for-non-verifiable-callback-uris): retain Auth0's login confirmation; never disable it or rely on silent `prompt=none`.

These are engineering compatibility requirements, not proof of a live tenant. Do not create vendor accounts, register applications, configure credentials or change trust without separate approval.
