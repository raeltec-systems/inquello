---
title: 'Story 1.28: Gate current-route real-data use on negative authorization evidence'
type: 'feature'
created: '2026-10-31'
status: 'in-progress'
route: 'dispatch'
review_loop_iteration: 2
baseline_commit: 'NO_VCS'
source_commit: '58820f32f68a1a546e7de193e1870208f130f33d'
context:
  - '{project-root}/_bmad-output/implementation-artifacts/epic-1-context.md'
  - '{project-root}/_bmad-output/planning-artifacts/ux-designs/ux-inquello-2026-10-26/DESIGN.md'
  - '{project-root}/_bmad-output/planning-artifacts/architecture/architecture-inquello-2026-10-26/shared-service-contract-proposal-2026-10-27.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** The auditor needs assurance that company and colleague-private information cannot leak, and that withdrawing access actually stops later protected use. A configured model or passing mock is not that assurance.

**Approach:** Build a repeatable current-route authorization suite, bind its evidence to the exact implementation/configuration, and require independent current organizational authorization before real-data use. Enforce the same boundary through running Tasks, retained results and local recovery/export.

## Boundaries & Constraints

**Always:**
- Keep normal auditor UX and existing DESIGN primitives. Representative fictional procurement cases use the ordinary workflow, without a visible test-mode selector, synthetic banners or repetitive acknowledgments. Input text cannot self-classify its trust or data tier.
- Two independent requirements: compiled, reviewed capability evidence that actually passes the complete negative-authorization suite for the exact enabled route/build, AND current organization approval through the existing trusted service/operator control plane. Provider credentials, administrator role, human action permission and an unsupported capability declaration cannot substitute for either. Operator approval can narrow reviewed capabilities, never enable an otherwise-disabled capability or fabricate test success.
- Evidence records identify suite/scenarios, measured implementation/runtime and contract versions, exact route/model/API/deployment/endpoint/configuration, result counts, command/environment, report digest and limitations. Responses and Messages are distinct routes; no evidence inheritance between adapters or unsupported Windows/runtime configurations. Missing, failed, skipped, mismatched or incomplete required evidence blocks real-data eligibility. Disabled future routes are excluded, not counted as successful denials.
- Organizational approval is an auditable, revisioned, revocable record bound to Workspace, route/evidence digest and applicable processing/data-policy scope. Its issuer, validity/review boundary and operator reference are explicit; do not invent an organization, production owner, region, retention period or approval. Refresh current service authority at protected boundaries; expired approval or unknown freshness denies use. No TTL-only/offline authorization lease.
- Bind current principal/session, creator-private Task, Workspace, route configuration, evidence and policy/authority revisions. Recheck after waits and before context/tool/model dispatch, output disclosure and protected persistence. Revocation or authority uncertainty cancels affected work, suppresses late results and quarantines retained/cached context until explicit current revalidation. Delayed responses cannot undo a newer fence. Follow OQ-16 transaction ordering: the service authorization decision is the ordering boundary, not wall-clock atomicity with a later local OS effect. Every subsequent protected use/disclosure requires its fresh check; observed invalidation cancels in-flight work. Already-transmitted input and exported copies cannot be recalled. These are application-mediated guarantees, not protection against a compromised OS/local administrator. A local tool permission never confers cross-Workspace or peer-private authority.
- Current held data categories, exports, recovery and reopen must not bypass revocation. Use trusted native ownership/category provenance, not filenames, display-name attribution or imported manifests as permission. Unknown/mixed unprovable content stays unavailable with an intelligible reason. Preserve quiescent runtime and atomic database-family recovery; stage recovered data until current validation, never restore authority from old receipts.

**Never:** Actual real-data approval or paid inference during implementation; new sharing, admitted memory, delegation, unattended or attachment features; secret-bearing evidence reports; arbitrary runtime eligibility toggles; silent fallback; fake generated schemas or a green status for unexecuted tests.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|---|---|---|---|
| Company/peer boundary | Two Workspaces, two creators in one Workspace; foreign Task/thread/tool IDs | No content, title/snippet or existence disclosure; allowed creator control still works | Same bounded unavailable response |
| Eligible route | Complete exact-build evidence plus current organizational approval | Current protected operation may proceed within existing policy | No permission beyond that operation |
| Stale/missing proof | Changed model/runtime/configuration, expired/revoked approval, failed/skipped scenario | Real-data use blocked; route explains missing requirement | Draft retained; no alternate route |
| Mid-run revocation | Revoke while model/tool/permission/output awaits; late allowed response | Cancellation/fence, no subsequent protected disclosure or reuse | Honest stopped/unavailable state, no rollback claim |
| Export/recovery bypass | Revoked Workspace, peer-owned store, opaque logs or old backup | Deny/quarantine affected content before disclosure/reopen | Explicit incomplete/unavailable reason; no fabricated lineage |
| Auditor control | Fictional duplicate INV-104, K12,480; distinct INV-105 | Authorized user can complete ordinary audit and reopen permitted results | Prove usefulness as well as prohibited access |

</frozen-after-approval>

## Code Map

Native paths below are under `engine/codex-rs/`.
- `inquello-domain/src/{capability/register.rs,routes/model.rs}`: compiled evidence currently has unbound references; `route_eligibility` always rejects Real. Add exact proof/approval conjunction, preserving restrictive register semantics.
- `inquello-service/src/{admin.rs,workspaces.rs,routes.rs}`, `migrations/`, `inquello-protocol/src/workspace.rs`: existing operator commands, transactional principal/session/Workspace lock order and authorization epochs. Extend this control plane; do not add renderer-admin trust.
- `app-server/src/request_processors/{inquello_tasks.rs,inquello_routes.rs}`, `inquello-adapters/src/{tasks.rs,organise.rs}`: TaskGuard freshness, runtime-owned journal/thread binding and private disclosure. Current preflight hardcodes fictional tier; introduce trusted eligible binding without relabelling arbitrary text.
- `desktop/src/main/{identity/service-client.ts,identity/wire.ts,policy/service.ts,tasks/service.ts,tasks/bootstrap.ts,routes/service.ts,organise/service.ts}`: HTTPS authority, generation fencing, isolated fictional session, current versus remembered membership. Retain isolation while adding genuine approved-route operation.
- `desktop/src/main/data/{authority.ts,service.ts,export.ts,import.ts,inventory.ts}`: runtime quiescence exists; current export attribution is not ownership and recovery has no fresh Workspace check. Add trusted category/Task provenance and staging checks.
- `inquello-service/src/export_receipts.rs`, additive service migration and tests: immutable authenticated-service manifest provenance with fresh current access, independent of deletable local export journal.
- `desktop/src/renderer/{ProcessingRoutes.tsx,Capabilities.tsx,LocalData.tsx,Shell/TaskProgress.tsx}`: reuse existing states/primitives for route gates and inaccessible work; no new visual system.

## Tasks & Acceptance

**Execution — sequential, dependency ordered:**
- [ ] Domain capability/routes files and `inquello-protocol/src/workspace.rs` — define strict evidence identity, approval binding and fail-closed decision; unit-test every matrix edge, exact mismatches and unknown states.
- [ ] Service files above, new `migrations/0003_route_eligibility.sql` and `tests/route_eligibility.rs` — auditable operator approval/revocation, current authenticated read/check, epoch ordering and receipt/idempotency; no shipped approved record. Approval references must match the compiled reviewed passing evidence/report digest and required scenario coverage, not an operator-supplied success boolean. Runtime evidence ingestion cannot expand the compiled maximum.
- [ ] Native processor/adapters and desktop authority/Task/route/organise files above — propagate trusted classification and fresh evidence/approval, enforce active cancellation/disclosure fences and creator ownership across current APIs, reject raw runtime bypasses. Preserve approved fictional-session UX and prior no-replay behavior.
- [ ] Desktop data files above and native-owned inventory — bind current held categories to trustworthy ownership; validate before and after slow export/import work, stage recovery and block unknown/opaque content rather than inventing rights. Preserve existing deletion, credential exclusion and DB-family guarantees. Use an immutable service-held digest receipt for approved delete-all recovery continuity; test same-device roundtrip, receipt tampering, foreign principal and current revocation. Test successful authorized export and recovery of known-provenance content as controls; blanket disablement is not acceptance.
- [ ] Renderer files above and `desktop/test/` — explain actionable missing requirements and inaccessible results using existing primitives; validate keyboard/focus and retained drafts. A denied Task must not leave its protected text in another screen/cache.
- [ ] New `engine/codex-rs/app-server/tests/inquello_authorization_runtime.rs`, service tests and desktop negative-suite tests — exercise actual enabled Responses and Messages bindings, local tool effects, retained output, exports/recovery and allowed controls with two companies/two peers. Produce bounded redacted evidence with per-scenario status; document fixtures versus actual execution.
- [ ] `inquello-domain/register/capabilities.json`, `desktop/data-policy.json`, `FORK-CUT.md`, story support and tracker — attach truthful evidence/limits and cumulative local acceptance commands. No eligibility promotion from authored/unrun tests; no manual generated edits.

**Acceptance Criteria:**
- Given the current-route suite, when cross-company and peer-private operations are attempted, then all prohibited access fails without leakage while authorized controls work (AC1.28.1).
- Given one exact enabled route, when complete actual evidence and current organizational approval both pass, then only that route can be eligible; a changed/missing/failed/unknown prerequisite denies it (AC1.28.2–3).
- Given revocation committed before the next service authorization decision, or unknown authority, when protected use/output/reopen/export/recovery is requested, then it fails closed; already-dispatched work is cancelled/suppressed at subsequent boundaries and stale results cannot revive permission (AC1.28.4).

## Implementation Notes

Sequential source stages: domain/protocol → service → native enforcement → desktop → service receipts/fixture source → native draft/disclosure corrections → additional coupled/race fixture source → final transport fence → localized desktop integration/verification. One implementation writer at a time. Read-only source investigation and exact pinned baseline restoration were separate.

Implementation/source coverage and exact verification are recorded in `story-1-28-authorization-support.md`. Task checkboxes remain open for their native/owner acceptance gates; authored code is not a passing negative-authorization report. No generated output edits, actual organization approval or eligibility promotion. The capability register attaches only a non-authorizing pending support reference.

## Spec Change Log

- 2026-10-31 review loop 2: R2-E1/R2-B8 require publication-owned rollback and confirmed inspector termination. Add focused native rollout, actual desktop route-envelope and running-tool cancellation coverage. Preserve every loop-1 correction and frozen intent; do not expand into credential attestation, batch authorization redesign or OS-crash certification.

- 2026-10-31 review loop 1: B1/B3/B6/B8/E2/E3 exposed non-frozen coordination gaps; added the bounded corrected-derivation plan, including exact recovery plan, atomic provenance, stale-list/bootstrap fences, RPC settlement and safe activity quiescence. Known-bad states and positive KEEP requirements are explicit below. Frozen user intent unchanged.

- 2026-10-31: Implementation clarification only; frozen intent unchanged. Preserve the approved same-device export/delete-all/reimport control using an immutable authenticated-service export provenance receipt. A deletable local export journal cannot authenticate an archive after Delete all. No hidden local receipt, new signing-key platform, ownership transfer or entitlement is introduced.

## Review Triage Log

- Pre-freeze parent source check: later `send_event` disclosure-denial exits could omit durable terminal accounting. Confirmed and fixed with one shared suppression/accounting helper at all three boundaries and an authored boundary-1/2/3 regression. Rust execution remains unrun; no passing evidence inferred.
- Full desktop regression triage: 11 affected failures corrected without weakening privilege boundaries (native inspector moved to `main/runtime`, state mocks supply fresh service, revised declared category/ownership/UI expectations). Final suite retains only absent-native integration and Git/generated-set gates; exact counts in support.


### Independent review round 1 — individual verdicts before grouping

Likelihood describes the concrete trigger in ordinary supported use (low/medium/high); impact describes harm if triggered. Native source findings are not executed Rust witnesses.

| ID | Verdict | Evidence and risk | Route |
|---|---|---|---|
| B1 | high | `DataService` validates its first manifest, but low-level import rereads mutable source after awaited receipt checks. A changed manifest can choose different hashes/files while authority checks retain old provenance. Likelihood medium for an externally mutable recovery directory; impact high unauthorized restore. | bad_spec |
| B2 | maybe-false | Whole SQLite family bytes exceed live-row inspection, but no supported row-deletion/owner-transfer precursor or effective bundled secure_delete setting establishes foreign remanence. Mixed live owners are refused and deletion removes whole files. Likelihood unknown; impact high if demonstrated; not a confirmed disclosure. | defer |
| B3 | medium | Reservation commits request/run first; separate provenance insert can fail/crash, and existing-operation retry returns without repairing tier. Likelihood low crash/fault window; impact medium permanently quarantined newly created work. | bad_spec |
| B4 | high | A newer empty successful Workspace list changes no per-Workspace highest epoch or generation; delayed older allowed list can republish names/IDs. Likelihood medium concurrent refresh/revocation; impact high private metadata exposure. | patch, absorbed by loop |
| B5 | medium | Completed notification deletes active entry before a delayed running start reply reinserts it; later successful terminal reconcile can clear it, but otherwise Local Data blocks. Likelihood medium fast completion/slow ack; impact medium workflow lockout. | patch, absorbed by loop |
| B6 | high | Final writer drops fenced RPC responses without replacement/connection termination. Desktop `rpc.ts` pending requests have no timeout; promise can remain unresolved. Likelihood medium observed invalidation during output queue; impact high unusable request/UI and unresolved submission. | bad_spec |
| B7 | maybe-false | Build scan includes manifests, lockfile, target/Rust flags and compiler version, but no supported differing-enforcement/same-fingerprint build was demonstrated for external feature/toolchain configuration. Likelihood unknown; impact high if proven. | defer |
| B8 | high | `guard_private_scope_after` retains only Workspace/principal, so Task route approval checked before a slow metadata operation is not refreshed at final response. Membership check alone cannot detect time expiry. Likelihood low exact expiry/wait with future eligible route; impact high protected metadata disclosure. | bad_spec |
| B9 | false | Thread processor stores strong authorization in both thread and turn extension initialization. Terminal completion alone does not drop it; private generic metadata mutations are also rejected by retained-request allowlist. Asserted missing guard/caller was not present. | reject |
| B10 | maybe-false | Rust compilation and actual 34 scenario outcomes remain unknown, not known broken solely because unrun. Cargo absence is verified; user explicitly accepts recorded owner-run gates, not acceptance. Likelihood unknown; impact high if native enforcement fails. | defer validation gate |
| E1 | high | Same claim/location as B4 independently filed: successful removal list leaves no fence against older returned membership. Likelihood medium; impact high metadata exposure. | patch, absorbed by loop |
| E2 | medium | Bootstrap is unkeyed/concurrently spawned. Pinned `connection_rpc_gate.rs` only locks admission, releases it before awaiting handler. No bootstrap generation rejects an older service completion replacing newer session/cancelling its work. Desktop latest-read check reduces ordinary trigger but does not guard native publication. Likelihood low; impact medium cancellation/availability, no proven authority expansion. | bad_spec |
| E3 | medium | Revocation suppresses terminal/progress disclosure; active/pending remain until successful terminal observation or runtime replacement. Export/import/delete reject before stopping; no direct restart UI. Closing/relaunching recovers. Likelihood medium on revocation; impact medium same-runtime Local Data lockout. | bad_spec |
| V1 | medium | Preverified gap: production DataAuthority tests only draft metadata; fake roundtrips replace real-content route approval/check branches. A skipped real-route check would escape tested coverage. Likelihood medium regression; impact high confidentiality if introduced. | patch, absorbed by loop |
| V2 | high | Preverified gap: no maintained denial after recovery publication/quarantine-failure test; removing quarantine loop would leave current tests green. Likelihood medium regression; impact high restored-content exposure. | patch, absorbed by loop |
| V3 | medium | `data-integration.test.ts` constructs DataService without authority and expects excluded stderr exports. With native binary restored first export still fails. This is a real stale test, not just absent binary. Likelihood high owner-run suite; impact medium false validation blockage. | patch, absorbed by loop |

Grouping follows individual verdicts: B4/E1 share stale listing root; B5/E3 share incomplete activity lifecycle; B1, B3, B6, B8 and E2 are separate coordination defects. V1/V2/V3 are distinct coverage/caller repairs. No new product intent is required. Nontrivial coordination groups route to bad_spec; preserve working controls, restore baseline code, and rederive this bounded corrected implementation. Deferred concerns remain unverified and do not assert acceptance.


### Independent review round 2 — individual verdicts before grouping

| ID | Verdict | Evidence and likelihood / impact | Route |
|---|---|---|---|
| R2-B1 | false | The replacement fence is captured while the response remains local, before final fresh authorization, never renewed in the output queue. Continued denial fails the final check; a later valid service decision orders subsequent disclosure under OQ-16. Reviewer retracted categorical claim after tracing callers. | reject |
| R2-B2 | false | Each tree entry receives its own service decision before projection; expiry only after that decision is not a counterexample to OQ-16. No subsequent independent protected operation without authorization was demonstrated; observed invalidation still fences output. Reviewer downgraded/retracted expiry-only claim. | reject |
| R2-B3 | false | Parameterless Workspace list retains original pre-handler fence. Any observed check failure invalidates it. Unobserved revocation after an earlier successful per-item decision is the explicitly documented distributed ordering boundary, not a proven bypass. | reject |
| R2-B4 | maybe-false | Arbitrary receipt digest requires possession/use of bearer credentials outside supported trusted-main operations. Renderer exposes argument-free export; normal recovery reinspects native bytes/owner and fresh authority. A forged schema-consistent archive plus independently minted digest would require a demonstrated authorized caller outside that boundary. Likelihood unknown; impact high if such a caller exists. | defer |
| R2-B5 | maybe-false | Direct destination copy precedes digest comparison, but runtime is stopped and every chunk has current checks. Claimed unproven-byte disclosure needs a concurrent external source writer and destination reader; no supported application producer established. Likelihood unknown; impact high if an in-scope mutation path exists. | defer |
| R2-B6 | medium | Running-tool fixture releases its blocked shell after withdrawal but never asserts late marker absence/actual process stop. Provider counts and suppressed notifications cannot prove cancellation. Likelihood medium regression; impact high if future cancellation silently fails. | patch, absorbed by loop |
| R2-B7 | medium | Actual native inspector tests pass no runtime home or Task root, leaving owned/foreign rollout-header and Task-folder gates unexercised; fake desktop inspector cannot replace this coverage. Likelihood medium regression; impact high if allowlist gate is removed. | patch, absorbed by loop |
| R2-B8 | medium | `inspectNative` rejects immediately after SIGTERM on timeout/oversized output, before child close. DataService finally can restart native runtime while inspector retains read-only SQLite handles. No corruption shown, but Windows recovery/deletion/quiescence can fail. Likelihood low slow/hung inspector; impact medium blocked/restarted local data operation. | bad_spec |
| R2-B9 | maybe-false | Recovery marker lacks fsync, but no crash image demonstrates restored data durability without marker and bypass of current native disclosure checks. Source alone does not establish claimed unauthorized reopening; realistic power-loss durability witness would settle it. Likelihood unknown; impact high if demonstrated. | defer |
| R2-B10 | maybe-false | Per-MiB checks multiply per-Task service calls; 512 MiB/100 real Tasks is an analytical upper example, not measured current auditor workload or demonstrated timeout. Need representative inventory and real service latency/load to establish unacceptable workflow cost. Likelihood unknown; impact medium if measured. Do not replace fresh checks with leases to optimize speculation. | defer |
| R2-E1 | medium | Outer quarantine chooses manifest paths absent from initial inventory, not successful publications. A competing file explicitly preserved by low-level no-overwrite behavior can therefore be moved after later denial. Existing competing-destination regression contract makes this supported robustness, though a single stopped desktop does not create the competitor. Likelihood low; impact high data loss/family split if triggered. | bad_spec |
| R2-E2 | false | Same expiry-only tree claim as R2-B2; per-item successful decisions order this response under OQ-16. Follow-up reviewer withdrew confirmed-disclosure claim; no observed-invalidity bypass established. | reject |
| R2-V1 | medium | Preverified gap: native rollout branch is untested; deleting threads.contains(id) would leave checked tests unchanged. Need actual store-bound owned/foreign runtime-home fixtures, exact hashes, and refusal without file list. Likelihood medium regression; impact high foreign history export. | patch, absorbed by loop |
| R2-V2 | medium | Preverified gap: actual TaskService.authority routeDiscovery/routeCheck branches have no contract tests. Removing fields leaves existing tests unchanged while native requires them. Likelihood medium regression; impact medium approved-route unusability. | patch, absorbed by loop |

Grouping after individual verdicts: R2-B7/R2-V1 share native inventory coverage. R2-B8 and R2-E1 are separate lifecycle/rollback defects requiring bounded non-frozen plan correction; test-only entries are absorbed in this rederivation. Other claims remain rejected or explicitly unverified, not fabricated failures or acceptance. Earlier unverified B2/B7/B10 remain carried unchanged; their evidence requirements and routes still apply.


### Independent review round 3 — individual verdicts before grouping

| ID | Verdict | Evidence and likelihood / impact | Route |
|---|---|---|---|
| R3-B1 | medium | Each stdout chunk is independently UTF-8 decoded; a split multibyte path produces replacement characters. Reviewer executed isolated split-byte witness against built module. Likelihood medium Unicode paths; impact medium legitimate recovery/export blocked. | patch |
| R3-B2 | medium | Second recipient authorization can reject all targets after callback insertion; outer empty flag reflects first check only, so zero-delivery callback survives. Cancellation elsewhere may eventually clean it but no guarantee here. Likelihood low concurrent withdrawal; impact medium unresolved permission wait. | patch |
| R3-B3 | medium | New child tests launch extensionless shebang programs and Unix signal handlers on all platforms. Windows cannot execute these fixtures as written, independently of product correctness. Likelihood high owner Windows test run; impact medium false suite failure. | patch |
| R3-B4 | medium | Actual inspector deadline/unknown-close branch has no consumer regression for blocking DataService restart or late-close release. The branch is concrete; add controlled child mock and actual DataService consumer. Likelihood low hung process; impact medium unsafe restart regression if gate removed. | patch |
| R3-B5 | low | Custom in-source Cargo output directory is not excluded; default documented build uses exact excluded target and unsupported custom layout can change fingerprint/fail closed, never grant stale proof. Likelihood low nonstandard setup; impact low rebuild burden. Fix needs new path-resolution rules, so reject low/uncommon complexity under workflow; document standard target requirement. | reject |
| R3-B6 | maybe-false | Actual read-only SQLite WAL/SHM byte behavior depends on native bundled SQLite/OS, not established from source. Need populated WAL/SHM native inspection witness showing accepted valid archives without mutation, or failure requiring isolated copy. Likelihood unknown; impact medium availability if confirmed. | defer |
| R3-B7 | false | carried B9: thread and turn extension initialization retains strong authorization; terminal completion alone does not drop it. Generic private metadata mutation is refused by retained-request allowlist. No actual permitted caller/lifetime gap shown. | reject |
| R3-B8 | false | Low-level import intentionally reports per-category notRestored and partial restored counts; skipped DB is never described as restored. Current native ownership/thread authorization still controls later disclosure, so copied unrelated history does not become permitted merely because a file exists. No claim of all-or-nothing multi-category import or actual unauthorized reopen established. | reject |
| R3-B9 | medium | Fingerprint test covers paths but no executable normalization controls. A mistaken removal of capability enforcement input or inclusion of excluded report metadata could pass it. Likelihood medium regression; impact high incorrect evidence identity if introduced. | patch |
| R3-B10 | low | Dense formatting impedes reading but reviewer names no concrete divergent caller/invariant beyond style; formatting command is already explicitly unrun due absent Cargo. No blanket rewrite justified under low-complexity rule. | reject; retain fmt gate |
| R3-E1 | medium | Executed witness moves destination ancestry during new final authorization await; import then publishes into moved fd-bound directory but ledger names original path. Existing directory.check immediately after await closes demonstrated gap. Likelihood low competing filesystem change; impact high misreported restore/cleanup if triggered. | patch |
| R3-E2 | medium | Same executed split-UTF-8 witness as R3-B1; ordinary Unicode filesystem paths are corrupted by chunk-local decoding. Likelihood medium; impact medium legitimate file unavailable. | patch |
| R3-V1 | medium | Preverified gap: actual remote outbound consumer has no private-fence regression. Changing refusal to only cancelled fences would allow current private payload into replay without tested failure. Likelihood medium regression; impact high unsupported remote disclosure. | patch |

Group R3-B1/E2 for one decoding correction. Other retained findings are independent small internal corrections or test-only coverage, with demonstrated state and no public authority surface. No intent or non-frozen plan revision needed; apply exact patches through original loop-2 implementer, then rerun checks. Earlier deferred concerns retain their original evidence requirements; native test authorship remains unrun, not acceptance.

## Design Notes

Native draft metadata is creator/Workspace provenance, not an inference data tier. It is atomically recorded by actual native creation and ceases to apply once runtime/content/derived history exists. Current authority governs draft metadata; a draft-only export does not claim model-route permission. Mixed trees expose only safe unavailable entries already proven creator-owned and currently Workspace-visible, never foreign IDs/existence.

Private output fences are non-serialized, captured before current authorization and retained through final stdio write admission. Observed invalidation cannot be undone by a new check on an older envelope. No async authority callback runs in the transport writer. Remote private replay is unsupported and refused. The final OS admission boundary cannot retract bytes already admitted.

Recovery markers are preserved through ordinary category deletion and clear only after current validation or verified protected-category deletion. Journal path presentation is current-owner-only after waits; the journal remains deletable and never grants restore authority.

Recovery provenance: the authenticated shared service stores only immutable canonical manifest digest, principal and Workspace IDs (with ordinary command idempotency); no source bytes, paths or credentials. Main creates the receipt only after native ownership inspection, exact copied-byte hashes and fresh export checks. Restore must match those bytes/Workspaces via native inspection and revalidate the receipt against the same current principal and fresh Workspace/route authority before and after copy/publication. The receipt alone grants nothing. Local journal deletion remains complete; already exported copies cannot be recalled. Existing cross-host ownership-transfer restrictions remain. Maintained desktop regressions cover delete-all roundtrip, tamper, current revocation and foreign principal using an explicitly labeled fake authority; native/service execution remains a separate gate.

Evidence identity must avoid a report hashing the final commit containing itself: define a stable, versioned fingerprint of all executable/enforcement/configuration inputs, excluding only generated evidence/approval metadata; record actual tested artifact hashes separately. Changes to any behavior-bearing input invalidate proof; metadata exclusion is explicit and tested, never a broad source exemption.

One cohesive gate, not an enterprise attestation platform. Reuse the existing operator-only administration and reviewed capability register; both remain necessary and separately restrictive. Schema additions are additive and tested against an existing store; no actual database migration/deployment is executed here. Footprint spans service/domain/runtime/desktop because a UI-only badge or test-only report would not meet the goal. Conservative unknown-category export refusal must be explained, not hidden as a successful empty export. Preserve 1.21–1.27 native/model/Windows gates separately.

## Verification

- Desktop: `pnpm exec tsc -p tsconfig.build.json --noEmit`, `pnpm run build`, affected `pnpm exec vitest run ...`, then `pnpm test`; record exact commands/counts/failures, not assumed environmental passes.
- Native: `cargo fmt --check`; `cargo check -p inquello-service -p codex-app-server`; `cargo test -p inquello-domain`; `cargo test -p inquello-adapters`; `cargo test -p inquello-service`; retained authorization fixture under its documented isolated topology. Record exact feature/binary/PostgreSQL setup in story support. If cargo/dependencies are unavailable, leave these checks explicitly unrun.
- Regenerate matching desktop protocol with `pnpm run generate:protocol` only after a matching native build; never hand-edit output. Run three independent BMAD review layers and record likelihood/impact for remaining risks.
- Owner local acceptance: seeded two-company/two-peer topology, both enabled routes, normal fictional procurement workflow, revoke during real running work, late output, reopen and export/restore attempts; include permitted controls. Distinguish native enforcement evidence from actual model usefulness and from actual organizational approval. No production/real-data enablement until its own required checks and approval are complete.

## Review Loop 1 — bounded corrected derivation

The reviewed implementation is preserved outside this working tree at `/workspace/shared/inquello-story128-round0-preserve` with its verified originals manifest and review diff. Product files have been restored to the pinned baseline for this loop. This preservation is reference material, not permission to replay the known-bad paths unchanged. Reuse positive implementation where correct; rederive affected coordination from the requirements below, retaining every existing supported check/test and no broader redesign.

KEEP: strict compiled exact-route evidence ceiling plus independent current approval; all shipped routes still gated; operator/service transactions and additive migrations; private/native ownership and draft metadata provenance; exact fixture transport, no live credentials/fallback; service receipt delete-all recovery continuity; native output fences all the way to final writer; content-free terminal accounting; mixed-tree private placeholders, design primitives, generation failure fences; truthful not-run reports and prior gates. Do not weaken or delete these controls to make a test pass.

1. Recovery must execute the exact immutable manifest/file hashes and categories already inspected and service-receipted, never reread mutable archive metadata as a new plan after waits. Pin the validated plan through low-level import and digest-check every copied byte against it. Mutation must fail without publishing alternate files; quarantine cleanup must use the actual attempted plan. Add deterministic archive mutation during receipt wait and post-publication authority withdrawal tests, including quarantine move failure retaining marker and stopping restart. Preserve existing atomic DB families and no-overwrite/race protections.
2. Native Task reservation, request/run records and trusted data-tier provenance must commit atomically. A failed reservation leaves none; replay preserves original tier and cannot reclassify work. No renderer classification parameter or heuristic text classification. Update trait/callers/tests coherently; no public bypass.
3. Successful Workspace listings also participate in an ordered freshness fence: an older completion must not republish a Workspace removed by newer successful listing. Preserve concurrency without allowing an old rejection to erase a newer valid result. Add deterministic allowed-after-removed response regression.
4. Native bootstrap must reject stale completion before replacing a newer connection session, using request generation/serialization that also respects identity reset and close. Test actual concurrency boundary; desktop checks alone are insufficient.
5. Observed completion-before-start-ack cannot resurrect activity. Revocation/uncertainty cannot be treated as proven quiescence, yet must not indefinitely block Local Data: reuse trusted native stop/quiescence lifecycle to establish stopped work before clearing bookkeeping. Keep uncertain dispatch non-replay and never clear active work merely on authority failure. Test completion-before-ack and revoked terminal suppression with eventual safe Local Data recovery without user restarting the app.
6. Invalidated response payload must still settle its RPC using a bounded content-free unavailable error or explicit connection closure at final transport admission; private notification payload remains suppressed. No protected fields in replacement. Preserve request identity/late-output fences through both queues, ordinary terminal output, and honest uncertain submission semantics. Test actual desktop pending-request outcome, not merely a helper's zero bytes.
7. Preserve Task identity in native private scope through final response authorization and recheck current Task route/approval (including expiry) after waits; Workspace membership alone is insufficient. Unknown ownership remains indistinguishable from absence. Add late route expiry/withdrawal control.
8. Extend production DataAuthority tests with valid real task_content and service rejection/mismatch/stale observations plus allowed control; assert exact service approval/check invocation and action binding. Update real native integration roundtrip setup for the new authority contract and excluded logs; label fake authority honestly if that test only proves runtime shutdown/filesystem behavior, and do not claim it is native ownership/eligibility evidence. Keep full real-native acceptance separately pending.

No new attestation system, broad fingerprint redesign, OS-admin threat expansion, route enablement or future feature. SQLite remanence and unmeasured build-config collision claims remain unverified pending concrete supported witnesses. Do not fabricate native/generated evidence. Required standalone source/fixture gaps and executable checks must remain clearly distinguished from environment-blocked validation.


### Review loop 1 implementation handoff

The bounded correction groups are implemented in source with deterministic regressions. Native bootstrap admission additionally fences the reset-in-progress window, not only older service completions. Recovery rechecks the immutable service receipt after publication as well as before copying. Exact current commands/results and fixture limitations are in `story-1-28-authorization-support.md`; status and acceptance checkboxes remain open for native/generated/owner gates. No frozen intent changes, organization approval, production migration, paid inference or capability promotion.

## Review Loop 2 — bounded final ownership/lifecycle corrections

The corrected first-loop implementation is preserved at `/workspace/shared/inquello-story128-round1-preserve` with exact reviewed diff and manifest. Product source is restored to pinned baseline for this BMAD rederivation. Reuse positive code, but do not replay the known-bad rollback/process paths. The loop-1 plan remains fully required.

KEEP all loop-1 code/tests: immutable import plan and receipt recheck; atomic reservation/data tier; ordered Workspace/bootstrap reset and close; safe completion/activity accounting; content-free RPC settlement; final Task-scoped authorization; service/evidence ceilings and normal UX. All current native/protocol/model/Windows acceptance gates remain open. Frozen intent is unchanged.

1. Recovery rollback must operate only on files this import actually published, with identity proof sufficient to avoid moving a later replacement. Add a private publication ledger/callback from low-level import, recording successful publication before any next await. Atomic database-family publication must be tracked as a family, not inferred from names or initial absence. A collision/skipped file must never be quarantined. On ambiguous replacement identity, keep runtime stopped with recovery marker and explain inability to safely clean; never move unrelated data. Cover competing ordinary file and competing DB family plus post-publication denial, including skipped and successfully restored cases. Preserve existing family atomicity, immutable-plan and quarantine failure tests.
2. A failed native inspection must not complete to DataService until the inspector is confirmed closed. On timeout/oversize/stdin failure terminate, escalate boundedly if necessary, and wait for actual close; do not mistake sending a signal for quiescence. If process exit cannot be established, keep dependent reopening blocked, with bounded readable failure handling rather than an unsafe restart. Add a real isolated delayed-termination child regression and success/nonzero/oversize coverage. Do not invoke real credentials or production runtime.
3. Add actual native inspector tests using the real temporary SQLite store and bound runtime thread plus runtime-home and Task-root files. Assert owned allowed exact hashes, foreign/unbound rollout refusal with no files, malformed header and supported symlink refusal. These remain authored/not-run when Cargo is absent; fake desktop authority is not native evidence.
4. Add maintained TaskService.authority tests for actual routeDiscovery and routeCheck envelopes, exact callback inputs, service rejection, identity/generation change during awaited service response and malformed/mismatched binding refusal where the contract checks it. Preserve native-side binding verification rather than invent renderer authority.
5. Strengthen running-tool revocation native fixture to observe actual cancellation/termination before asserting no post-observation late side effect. The authorization service decision orders effects; merely revoking server state does not synchronously kill an already-running shell. Arrange deterministic trigger/observation with existing native stop/cancellation path, do not release the shell into a race and then claim rollback of an already-authorized effect. Assert actual stopped child or equivalent cancellation acknowledgment and absence of a marker gated after that observation. Keep allowed control. Document native execution remains unrun.

No speculative broad redesign: receipt bearer-attestation, complete transactional filesystem publication, aggregate service optimization and power-loss durability are not silently claimed solved. Their unverified concerns require the concrete witnesses recorded above. Finish these bounded corrections, supported checks and independent review without adding future features or enabling real-data routes.

### Review loop 2 implementation handoff

The bounded publication-ledger, inspector-close, route-envelope and native
fixture corrections are implemented. All loop-1 controls remain. Exact executed
checks and unrun native/owner gates are recorded in the story support and
`validation/story128-loop2/`. Status and task acceptance remain open: source and
fixture authorship do not create passing capability evidence or organizational
approval. Independent review remains the parent workflow.

## Final patch verification and presentation boundary

All retained round-3 patches were applied by the original loop-2 implementer and read again by the coordinating reviewer. A final source trace corrected an incomplete concern about real-route archive fields: the adapter emits an intermediate response; the actual CLI already enriches it with measured identity, exact compiled evidence and current data-policy digest. This was not a missing production path. Its previously untested composition now has a private helper and actual temporary-SQLite positive/negative native tests, with production evidence lookup hardwired and restrictive register unchanged. This test-only coverage correction does not promote fixture proof into actual evidence.

Final executed desktop verification: both TypeScript checks and build pass; 11 focused files / 167 tests pass; full suite 1,403 pass / 2 failing assertions / 5 skipped, with nine additional missing-native-binary collection failures (55 files pass / 10 fail / 1 skipped). Exact failures and commands are retained in `validation/story128-final/`. Native commands including final composition tests cannot start because Cargo is absent. The present 48 generated files are baseline-identical; full stamped 816-file generation remains an explicit gate.

Three independent layers completed in each of three rounds, with every finding individually triaged before grouping. Deferred concerns were appended to deferred-work.md. All confirmed retained source defects are corrected; unverified concerns and native/Windows/provider/auditor acceptance remain open. In accordance with the owner's explicit validation instruction, this spec and story remain in-progress rather than following the generic workflow's automatic done transition. No local Git metadata exists, so no local commit is fabricated. Publication requires separate approval; no merge/deployment/real-data enablement occurred.
