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

Retain principal/session, creator-private Task ownership, current workspace policy/organization authorization, quotas, credential generation, exact immutable configuration and revocation/output fences. Capability promotion requires passing actual evidence. Organization approval remains a scoped auditable operator action.

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

## Spec Change Log

- 2026-11-03: Reviewed implementation amendment above separates the exact schema-generation tree provenance from versioned behavioral identity while retaining strict full-source/artifact provenance gates.

## Review Triage Log

## Verification

Use installed offline tools: native formatting; domain/adapters/service tests; affected native library and serialized authorization runtime tests; strict Clippy. Rebuild CLI/server, commit verified engine, genuinely regenerate protocol, rebuild against final desktop inputs.

Run both TypeScript checks, production build, full Vitest and affected owned Electron journeys. Record failures/unrun gates honestly. Exact existing commands: `model-bindings-engineering.md`, Verification section; add `cargo test --offline -j 4 -p inquello-service`.

Before live acceptance, present artifact/model/workspace, prompt, request/token bounds and spending limit; obtain applicable authorization before dispatch or organization-approval mutation. Owner enters key directly in Inquello. Record sanitized outcome/usage, no keys/private text.

Official [Terra contract](https://developers.openai.com/api/docs/models/gpt-6.1-terra) checked 2026-11-02; account access remains unverified until actual use.
