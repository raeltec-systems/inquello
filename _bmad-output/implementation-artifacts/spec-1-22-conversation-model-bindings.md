---
title: 'Story 1.22 extension: Independent conversation models by name'
type: 'feature'
created: '2026-11-02'
status: 'in-progress'
route: 'dispatch'
review_loop_iteration: 0
baseline_commit: 'a38f13aa42d023d492fa44a760dfa4e5f5aaa74a'
context:
  - '{project-root}/_bmad-output/implementation-artifacts/model-bindings-engineering.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

Auditors connect a provider, choose a supported model by name, and work. Each conversation retains its exact choice independently. Replace the technical form with this flow and repair the native latest-configuration coupling; hiding fields alone is insufficient.

## Boundaries & Constraints

**Always:** Preserve immutable historical configurations, exact Task foreign keys, selection history, receipts, profile and workspace. Reuse current private credential-slot/account generation and vault/native-login handoff. Add one binding-state table; credential secrets never enter it. Separate immutable binding identity, revocation revision, credential generation and Task selection revision. New model B must neither stale nor cancel A. Explicit saved-conversation changes require creator authority, selection CAS and no conflicting pending work.

Enforce exact active owned binding, current credential generation, fresh policy AND trusted data-tier qualification, workspace authority, quotas and fixed transport/tool/retry/fallback checks through preflight, dispatch, continuation, reviewer and output. Scoped changes fence affected Tasks only; identity/credential/policy revocation retains appropriate broader fences. Opaque accountRef is a trusted slot reference, never renderer-supplied vendor identity proof.

Catalog reads use bundled/cached supported metadata with zero network/auth refresh. Separate model name, unknown account access and qualification. Explicit provider checks stay separate. Superseded legacy configurations require deliberate exact-configuration revalidation; migration grants no eligibility. Keep existing unknown/unqualified work blocked.

**Never:** Auditor deployment/endpoint/API-version/processing-route fields, including Advanced; invented/arbitrary catalog entries; silent model/default fallback; persistent new-chat defaults; duplicate provider-authority storage; new installs/downloads; paid inference; Auth0 changes; main merge or Epic acceptance claims. Engine edits are authorized only for the mapped implementation after approval. Validate using isolated fictional fixtures, never by reclassifying real user data.

## I/O & Edge-Case Matrix

| State/action | Required behavior |
|---|---|
| Create B while A exists or runs | Preserve A's exact model, continuation and output authority |
| Explicit A switch | CAS; reject conflicting pending work; affect A only |
| Revoke binding / replace credential | Fence dependent work; reject late results and stale retries |
| Upgrade/restart | Preserve old rows and receipts; rebind via trusted credentials; no implicit selection |
| Settings mount or catalog failure | No network/login/inference; truthful availability, retained draft |

</frozen-after-approval>

## Code Map

`model-bindings-engineering.md` expands every path, symbol and decision. Native work spans domain routes, adapter routes/tasks, additive migration 0016, protocol DTO/dispatch and routes/reviewer/tasks/usage/catalog processors. Desktop work spans routes service/types/validators, provider mediation, security operations/preload, Settings/ProcessingRoutes, StartView/Shell and generated protocol. Reuse approved tokens/primitives.

## Tasks & Acceptance

- [ ] Companion-mapped domain/adapters -- exact active state, scoped revoke/revalidation, receipts and preserving migration.
- [ ] Companion-mapped processors/protocol -- private resolver, exact guards, real selection revisions, scoped fences and A/B fixture.
- [ ] Companion-mapped desktop mediation -- opaque IDs/CAS; stable credential lifetime and independent notifications.
- [ ] Companion-mapped renderer -- name picker, compact composer model, truthful unavailable choices, compatible reasoning/speed and no technical forms.
- [ ] Companion-mapped tests/evidence -- migration, A/B, races/replay/CAS, pending switch, restart, privacy, offline catalog, retention and actual Electron journey.
- [ ] Verified local checkpoints -- committed engine before protocol generation; truthful Story 1.22 sprint sync and actual-head CodeRabbit. Skip BMAD step 4.

**Acceptance Criteria:**
- Given A uses one model, when another conversation chooses B, then A retains its exact choice across follow-up and reopen, including while B changes.
- Given stale/revoked authority, when any inference or output phase runs, then protected use fails closed without changing model or replaying work.
- Given ordinary Settings and the composer, when an auditor connects/selects, then only provider and model-name choices are required, with availability/qualification stated truthfully.
- Given isolated synthetic fixtures, when selection, Send, follow-up, Stop and reopen/Resume run, then the full journey passes; startup uses a bounded 60-second functional gate and separate honest 20-second observation.

## Implementation Notes

No unresolved product questions. Additive local migration and named cross-layer APIs are the material footprint; no live-profile migration during validation. Detailed engineering decisions and verification commands are in the companion.

Owner approved this spec and its engineering companion on 2026-11-02, with implementation to begin after the verified UI follow-up is committed. Frozen intent is locked. Paid inference and Auth0 changes remain unauthorized.

Implementation starts after UI checkpoint `a38f13aa42d023d492fa44a760dfa4e5f5aaa74a`. Existing Story 1.22 remains in-progress in sprint status. The companion records the verified installed-toolchain environment so no rustup bootstrap/download is repeated. Preserve the committed UI refinements and readable narrow composer through model UI changes.

## Spec Change Log

## Review Triage Log

## Verification

Run the exact native, desktop and owned Electron commands in `model-bindings-engineering.md`. Offline failures require investigation or approval before downloads. Do not mark done while any required check is unrun or failing; broader Epic gates remain open.

## Verification support and disclosure dependency clarification

Required strict Clippy also checks `engine/codex-rs/app-server/build.rs`. Verification support replaces its unchecked unwrap/expect calls with contextual build-time aborts; measured inputs, source normalization, schema/data-policy checks and symlink refusal remain unchanged. No blanket lint waiver or fingerprint exclusion is added.

Retained output depends on the exact bindings of retained executions as well as the current selection. The mapped adapter/routes/protocol/main/renderer work therefore carries bounded trusted disclosure references, includes executed history in scoped invalidation, excludes never-executed old selections, and refuses unknown/overflowing dependency metadata instead of truncating authority.

The same required strict check reaches `engine/codex-rs/exec-server/src/client.rs`: one pre-existing redundant poison-lock closure is replaced with the identical `PoisonError::into_inner` method reference. Lock recovery and transport behavior are unchanged.

`engine/codex-rs/core-plugins/src/mcp_admission.rs` also receives one baseline strict-lint let-chain correction for legacy MCP declaration validation; the same invalid declaration is refused and no plugin/network policy changes.

Required strict Clippy also reaches four baseline core files: `core/src/unified_exec/process_manager.rs`, `core/src/tools/handlers/inquello_progress.rs`, `core/src/tools/registry.rs` and `core/src/inquello_inference.rs`. Support edits only collapse equivalent nested guards into let-chains, remove a JSON-macro borrow-redundant clone, and retain contextual fail-fast handling for fixed schema/previously checked authorization. Cancellation, accounting, tool schema contents, policy conditions and refusal bodies are preserved.
