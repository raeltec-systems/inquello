---
title: 'OpenAI API-key chat through the ordinary production workflow'
type: 'feature'
created: '2026-11-02'
status: 'in-progress'
route: 'dispatch'
review_loop_iteration: 0
baseline_commit: 'f3a7f67c14c7af150897634adc649c8c39bd155e'
context:
  - '{project-root}/_bmad-output/implementation-artifacts/model-bindings-engineering.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

Connect an existing OpenAI API key, select a supported model by name, send a message through the ordinary composer and receive an actual response. Finish production admission currently blocked by synthetic-only eligibility. Fixtures test the production implementation; a separately authorized live check verifies that same workflow.

## Boundaries & Constraints

**Always:** Preserve the existing profile, workspace, history and approved design. Reuse secure key entry and native OS keyring. Start with the supported `gpt-6.1-terra` Responses adapter; other models require their own support/evidence. Preserve independent conversation selections across restarts.

Retain principal/session, creator-private Task ownership, current workspace policy/organization authorization, quotas, credential generation, exact immutable configuration and revocation/output fences. Capability promotion requires passing actual evidence. Organization processing consent is a deliberate, auditable one-time workspace-owner action alongside provider connection, not an implicit consequence of storing a credential. Current authorization is checked automatically for every operation. Compatible independently qualified software updates or model-name changes do not require human renewal; material processing-contract changes require fresh consent.

Separate reviewed adapter/build evidence from each user's opaque credential-slot reference, currently included in the compiled configuration digest. Customers must not require recompilation for each key. Preserve exact provider/model/API/transport/build/platform evidence and current per-operation checks of credentials and selected configuration. This explicitly amends that inherited evidence contract, not user authority.

**Never:** Require fixture features, synthetic markers, paid-test variables or a separate test chat for production. No relabeling real content, technical route fields, silent fallback, new installs, Auth0/account/membership changes, main merge, fabricated evidence or unapproved paid inference. Test spending limits must not become a two-message product limit.

## I/O & Edge-Case Matrix

| State/action | Required result |
|---|---|
| Valid key, supported model, current workspace authorization; Send | Actual OpenAI response appears in the ordinary conversation |
| Invalid key, model access denied, rate limit or network failure | Actionable error; draft/history retained; no model substitution or hidden retry |
| A and B have independent selections; reopen/follow up | Each uses its own exact saved model and context |
| Credential, membership or organization approval withdrawn during a wait | Affected work stops; late output cannot restore access |
| Relaunch | Secure credential handoff and saved selections work without test flags |
| Current active server-established `owner` explicitly connects and allows the provider, or allows an already connected provider | Durable workspace consent and auditable receipt; no paid dispatch caused by consent |
| Nonowner, inactive/revoked member, arbitrary membership-admin role or historical creator without current owner role | Consent mutation denied atomically; personal secure credential connection may remain available, but processing requires existing workspace consent |
| Same explicit processing contract, independently qualified build or model-name change | Existing consent remains usable; exact current software/model evidence still required |
| Provider, endpoint trust boundary, approved data categories/use, region or retention contract materially changes | Previous consent does not authorize the changed contract; fresh owner consent required |
| Personal credential disconnect | Only that principal's credential and affected Tasks lose authority; workspace consent is not revoked |
| Explicit current-owner workspace provider revoke | New processing denied, affected in-flight authority invalidated and late output fenced; no fallback to an older operator grant |
| Owner changes after consent | Existing organization decision remains auditable and valid until explicit revoke/material change; only the current owner may mutate it |
| Replayed/stale/concurrent consent command | Exact operation replay or revision conflict; no duplicate grant or lost revocation |

</frozen-after-approval>

## Code Map

Native paths start at `engine/codex-rs/`:

- `inquello-domain/src/routes/{authorization.rs,model.rs}`, `src/capability/register.rs`, `register/capabilities.json`: version evidence identity semantics; retain compiled maximum and exact transport. Old proof cannot silently gain new meaning.
- `app-server/src/request_processors/{inquello_tasks.rs,inquello_routes.rs}`: `measured_route_identity`, `check_real_route_inner`; genuine `RealSession` and exact configuration at each boundary.
- `inquello-service/src/route_eligibility.rs`, `inquello-protocol/src/workspace.rs`: coherent evidence/approval matching, current transaction ordering and receipts.
- `desktop/src/main/{providers/codex-account.ts,routes/service.ts,tasks/bootstrap.ts,tasks/service.ts,identity/wire.ts}`: ordinary key handoff, production bootstrap and typed failures through existing IPC.
- `desktop/src/renderer/{Providers.tsx,ProcessingRoutes.tsx,Shell/StartView.tsx,Shell/TaskLifecycle.tsx}`: actionable availability/errors in existing controls.
- `desktop/scripts/run-auth0-pilot.cjs`: stable matched launch independent of development edits; preserve existing resume metadata.

## Tasks & Acceptance

- [ ] Repair evidence identity and compatibility tests without weakening per-user/configuration authority.
- [ ] Complete ordinary native/service/desktop production admission, response delivery and secure restart handling.
- [ ] Verify positive workflow, denials, cancellation, retained output and independent models.
- [ ] Produce exact-build evidence and a reviewable organization-approval request; do not apply approval during implementation.
- [ ] Deliver stable default build; run authorized live acceptance. Commit verified work on the existing feature branch; obtain actual-head CodeRabbit review.

**Acceptance:** Default build supports real connection, model selection, Send, answer, follow-up and reopen without fixture features/variables. Completion requires an authorized actual OpenAI response through this flow.

## Implementation Notes

Owner approved and requested continued implementation on 2026-11-02. Frozen intent is locked. No paid call or actual organization-approval mutation is authorized.

The approved model-binding extension has existing staged Desktop changes and committed native checkpoints on this same branch. Preserve them and their separate evidence. Start source edits only after its current matched Electron verification has quiesced; one source writer at a time. Existing user-owned untracked files must never be included in scoped commits.

Production admission investigation found a measurement cycle: version 1 validated a declaration of real-data eligibility only after complete proof existed, while the behavior fingerprint correctly includes that declaration. Register schema 2 therefore has one reviewed compiled `ceiling`; effective status is always the lesser of that ceiling and passing exact evidence. Missing/incomplete evidence remains blocked for real data, failed references fail closed, and complete route/transport/scope mismatches are refused. The ceiling and scope remain measured enforcement inputs; only the existing evidence metadata exclusions remain. This implements the approved evidence decoupling and does not grant organization approval.

Evidence identity schema 2 uses an adapter configuration digest independent of opaque credential slots, retains exact deployment/endpoint/model/API/region/build/platform, and requires authorization suite v4. Native production checks snapshot current credential generation and cached inherited authentication around service waits. Private test-only proof substitution exercises actual RealSession callbacks; it is never a runtime/renderer/environment evidence toggle or a production report.

### Engineering amendment: behavioral identity and full provenance (2026-11-03)

Review approved a second, narrowly scoped cycle repair after the schema-2 implementation above: a genuine protocol regeneration following an evidence-only engine commit changes `desktop/src/protocol/schema-stamp.json`'s `forkTreeHash`, which formerly changed the behavioral identity of the proof it described. Behavioral fingerprint domain v2 therefore validates the exact stamp JSON and required field types/digest shapes, then normalizes only that exact `forkTreeHash` provenance field. This is the sole additional normalization beyond the existing capability-register evidence metadata; it does not exclude the stamp, generated protocol, unknown stamp fields, code, policy, ceiling, or other behavioral inputs. Invalid stamp metadata fails the build closed. Old fingerprint-domain proofs cannot silently acquire the new semantics.

Full provenance remains independent and strict: protocol generation still requires a clean committed engine and records its actual Git tree; schema verification and the stable launcher still require the current engine tree, exact generated content hash/count, runtime version, and full binary/Desktop artifact hashes. Reports distinguish the behavioral digest, source commit/tree, default versus fixture build configuration, and each executable hash. Attaching evidence and genuinely regenerating only its tree provenance need not invalidate unchanged behavior; changes to protocol bytes, other stamp fields, enforcement or source still do. This amendment does not confer capability eligibility, organization approval, or permission for paid inference, and changes no user profile or authority fence.

### Engineering correction: approval bounds and ordinary private transport (2026-11-03)

The first reviewed v4 software report remains immutable historical evidence. Subsequent ordinary-service preparation found its Terra processing-scope prose was 261 UTF-8 bytes while the existing service approval and protected-use contract allows 256. A red compiled-register test reproduced the mismatch. The approved correction shortens only that prose to 211 bytes, shares the unchanged byte bound, and tests both the compiled scope through actual approval validation and production `apply()` against an owned fictional PostgreSQL workspace. Stale attached proof is withdrawn pending a distinct r2 exact-source report; neither scope nor enforcement changes are normalized out of behavioral identity. Positive compiled approval must execute again after the new genuine proof is attached, with wrong scope/policy/identity, oversized text, atomic no-write and operation-replay checks.

The ordinary private runtime already set HTTP/stream retry budgets to zero and refused private authentication recovery, but the upstream stream-error path could still enter its separately enabled unbounded-connection retry or WebSocket fallback. The approved narrow correction returns the original error for trusted private Task threads before those branches. Their HTTP transport also rejects redirects regardless of account-routing headers. Non-private upstream behavior is unchanged. Tests cover default-enabled unbounded retry, zero-budget fallback, interrupted streams/cancellation, actual loopback 30x no-follow with non-private controls, and a single HTTP401 send without provider refresh. These corrections implement the frozen no-hidden-retry/exact-endpoint intent, not a paid-test mode or an aggregate spending cap. Ordinary output remains 4096 tokens per attempt; tools can produce additional legitimate attempts, so two manually submitted turns are not a hard two-request or dollar ceiling.

## Spec Change Log

- 2026-11-03: Reviewed implementation amendment above separates the exact schema-generation tree provenance from versioned behavioral identity while retaining strict full-source/artifact provenance gates.

## Review Triage Log

## Verification

Use installed offline tools: native formatting; domain/adapters/service tests; affected native library and serialized authorization runtime tests; strict Clippy. Rebuild CLI/server, commit verified engine, genuinely regenerate protocol, rebuild against final desktop inputs.

Run both TypeScript checks, production build, full Vitest and affected owned Electron journeys. Record failures/unrun gates honestly. Exact existing commands: `model-bindings-engineering.md`, Verification section; add `cargo test --offline -j 4 -p inquello-service`.

Before live acceptance, present artifact/model/workspace, prompt, request/token bounds and spending limit; obtain applicable authorization before dispatch or organization-approval mutation. Owner enters key directly in Inquello. Record sanitized outcome/usage, no keys/private text.

Official [Terra contract](https://developers.openai.com/api/docs/models/gpt-6.1-terra) checked 2026-11-02; account access remains unverified until actual use.

### Approved product amendment: durable owner processing consent (2026-11-03 07:32 UTC)

The user explicitly approved one-time workspace-owner consent alongside provider connection, automatic current checks thereafter, and renewed consent only for material processing changes. This deliberately supersedes the operator-only organization-grant UX above; it does not authorize an actual workspace grant or paid Hello during implementation. The rejected spending-limit feature remains out of scope.

Consent authority is the current active membership holding the server-established stable `owner` role, not a display label, historical creator, or arbitrary `manage_membership` permission. No new ownership subsystem is introduced. A versioned server-declared provider processing contract separates material consent identity from exact software qualification, model naming, credential slots, workspace RBAC revisions, and the full local-data-policy digest. All those independent current enforcement checks remain required. Only supported, independently qualified configurations explicitly mapped to the same processing contract may reuse consent. Unknown future providers or expanded processing are never implicitly granted. Provider terms must be truthful; no unverified regional, retention, zero-data-retention or enclave guarantees.

Use additive versioned storage, current-authority/revision checks, operation-bound replay receipts and invalidation on revoke/disconnect. Do not autoextend historical grants. The owner sees concise explicit consent beside secure provider connection; ordinary auditors select a model and chat without CLI, expiry or deployment fields. Renderer input never supplies authoritative arbitrary contract hashes or scopes. Retained profile/backup and existing live app remain unchanged until a separately verified update. Final qualification must be regenerated for changed measured behavior; earlier immutable reports remain historical evidence.

The same bounded source batch addresses verified actual-head CodeRabbit findings: recoverable same-model selection after invalidation, exact response variants, proven pre-spawn retirement recovery without claiming uncertain guest cleanup, and typed sanitized private authentication errors without hidden refresh/retry. Regression tests must execute before final source freeze and exact-build rematch.

2026-11-03 07:55 UTC: After an edit safeguard correctly required explicit frozen-intent renegotiation, the user confirmed permission to amend the locked operator-only requirement and its related acceptance criteria. The same previously denied edits then succeeded; no alternate write mechanism was used. The matrix now distinguishes personal credential disconnection from deliberate owner workspace-provider revocation. A nonowner may connect a personal credential, but cannot grant workspace processing authority; owner transfer does not erase an existing organization decision. This amendment does not authorize an actual grant or paid call.

Implementation map for this amendment: a domain-declared processing-contract module and material-field tests; additive service migration 0007 for workspace provider consent/current revision/history/receipts; authenticated owner-only service endpoints and current consent projection in route eligibility; typed service DTOs/parsers; main-process provider-consent orchestration and bounded IPC validation; the existing AI Connections screen only. No separate governance screen, arbitrary renderer contract/hash, credential sharing or automatic legacy grant conversion. Any durable-consent tombstone takes precedence over legacy operator approval. A short-lived exact operation-authority projection is automatic and independent of durable human-consent lifetime, not a fictitious far-future approval expiry.

Owner-authority implementation refinement (approved 2026-11-03 08:09 UTC after actual-source audit): use the current server-established stable `owner` role and guard every owner-role transition, rather than adding a redundant action or policy migration. Existing membership management validates target role existence; it does not have the presumed action-subset anti-escalation lattice. Ordinary membership administrators must not grant/change/invite/restore themselves or peers into Owner. Both invitation acceptance paths and delivery recheck the grantor's current Owner authority for owner invitations. Changing/removing an existing Owner also requires current Owner authority and a remaining active-principal, active-membership Owner under the same Workspace update lock; transfer assigns a successor before demotion/removal. This invariant applies to existing-owner transitions, not unrelated historical ownerless workspaces. Current authorized Owner transfer/grant remains available, as does trusted operator bootstrap; role-definition/policy edits remain explicit trusted operator actions, with no untrusted reserved-owner identity creation or collision. No `ManageProviderConsent` action, membership-policy migration, display-name or historical-creator authority is introduced. Tests cover self/peer elevation, inviter losing Owner, restore, current revocation and legitimate Owner transfer. This supersedes the provisional dedicated-action plan and narrowly protects the approved owner-only consent contract.

Qualification refinement for the approved consent semantics (2026-11-03): authorization suite v5 retains the prior 50 required scenarios and adds eight executed evidence requirements: owner grant/revoke, compatible semantic consent with independent exact qualification, material-change refusal, late revocation/output fencing, lost-acknowledgement/CAS handling, Owner-transition protection, legacy no-fallback, and personal-credential/workspace-consent separation. Old v4 proof cannot qualify v5. Existing r2 reports/reviews remain immutable history; their current Terra attachment is withdrawn because source and local data policy changed. Exact identity schema2 and current policy/software proof checks remain unchanged. New evidence must label service/native/Desktop composition honestly; actual compiled HTTP eligibility positive after reviewed proof attachment and real user-approved provider acceptance remain distinct gates. Official documentation URLs/review dates are provenance outside material consent identity; provider semantic terms revision and all material processing fields remain measured.

## Consolidated offline pass — 2026-11-09/10

Recorded from the Epic 1 consolidated offline verification pass at commit `f992919722` on this Windows host; full gate list, logs and limits are in [epic-1-offline-pass-2026-11-09.md](epic-1-offline-pass-2026-11-09.md). Synthetic and offline only: no live provider, no real credentials, no owner acceptance, and no change to real-data qualification. This supersedes earlier "cargo absent / unrun" entries for the gates listed as passed. Status stays `in-progress` and no task box was changed by this record; the boxes were not re-audited against the code.

Shared gates that passed: `cargo fmt --all -- --check`; native tests for `inquello-domain`, `inquello-protocol`, `inquello-adapters` and `inquello-service` (`test-issuer`, all targets); clippy with warnings as errors on those four crates; default rebuild of CLI, app-server and service; `pnpm run generate:protocol` (816 files, no working-tree change); both desktop type checks; `pnpm run build`; full `pnpm test` (2,270 passed, 0 failed, 21 skipped); seeded Electron smoke (19 of 19 required reports).

Specific to this story, passed:

- `inquello_authorization_runtime` (`inference-fixtures`, 68 cases on both routes) passed 67/68 on the full run; `messages_allowed` failed once on guest setup and passed twice on re-run. This is the runtime test file, not a regenerated 58-scenario composed qualification report.
- `inquello_behavior_fingerprint` and the app-server binary unit tests passed.

Still open or not run:

- A new exact-source qualification report, its independent review and register attachment, the post-attachment compiled HTTP positive, owner workspace consent and an authorized paid OpenAI response all remain open. The owner deferred re-qualification to the end of Epic 1 on 2026-11-09.
