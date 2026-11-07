---
title: 'Story 1.22: Configure initial processing routes without silent fallback'
type: 'feature'
created: '2026-10-30'
status: 'in-progress'
baseline_commit: 'NO_VCS'
source_commit: '7cae5f3aceeec3f84b5eca6e3fb57cf774553b8e'
route: 'dispatch'
review_loop_iteration: 1
context:
  - '{project-root}/_bmad-output/implementation-artifacts/epic-1-context.md'
  - '{project-root}/_bmad-output/planning-artifacts/architecture/architecture-inquello-2026-10-26/claude-access-routes-2026-10-27.md'
  - '{project-root}/_bmad-output/implementation-artifacts/spec-1-13-keep-provider-credentials-separate.md'
  - '{project-root}/_bmad-output/implementation-artifacts/spec-1-20-authorize-specific-actions.md'
  - '{project-root}/_bmad-output/implementation-artifacts/spec-1-21-discover-tools-and-connections.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Credentials and tools are discoverable, but Tasks have no governed processing-route selection and the retained runtime speaks Responses only. An Anthropic key or changed URL is not Messages compatibility.

**Approach:** Configure the inherited Codex route and selected Claude API-key route, implement CR-1's native Messages adapter, and expose truthful route-specific capabilities and eligibility in S07 and each private Task. Unsupported work fails on the selected route, never switches silently.

## Boundaries & Constraints

**Always:**
- Preserve 1.9/1.13/1.19–1.21 protections. Provider authentication changes inference authority only, never Inquello identity, memberships or grants.
- Route metadata includes stable route ID, provider, deployment/endpoint, exact model/API version, account reference without secrets, applicable region (unknown stays unknown), capability limits and evidence. Execution, inference and connector flows are separate.
- Route configuration is distinct from credential presence, adapter support and evidence-backed enablement. Keep “not verified”, “verified for synthetic” and “verified for real data” distinct. No UI toggle upgrades eligibility; unknown/current-route failures fail closed. Remaining named routes stay visible as later supply/eligibility gates.
- Persist creator-private Task selection through domain commands, operation receipts and expected revisions. No implicit default route; switching is explicit, cancels the old attempt and invalidates continuation state. Re-encode only permitted compatible history.
- Inquello adapters own Messages translation; retained runtime alone executes tools and owns turns/history. Shared, versioned normalized contracts serve both adapters. Credentials are absent from model-visible records.
- Claude key travels from main's existing vault over a dedicated bounded private stdio RPC into volatile runtime auth state, never general config, environment, prompts, history or renderer responses. Bind it to credential generation and route; replacement/removal/logout/runtime death invalidates use and cancels affected attempts. Preserve Codex OS-keyring-only authentication, existing redaction and data controls.
- Native Messages uses HTTPS api.anthropic.com/v1/messages, API 2026-10-21 and model claude-sonnet-5-5. Fixtures pin these identifiers; no entitlement or live verification inferred. Reject unsupported settings/blocks before dispatch. Text and runtime-owned tools are the initial declared capabilities; images, provider-hosted tools and optional extensions remain unsupported.
- Bind each request/event to schema, Task/run/turn/attempt, route/model, authority basis, sequence and provider IDs where supplied. Preserve ordered role/origin blocks; tool output stays untrusted. Buffer partial tool JSON until complete and schema-valid; IDs must be unique/matched. Retry cannot replay completed tool effects.
- Preserve CR-1 stop/error/usage meanings, partial output and unknown usage; never equate end_turn with acceptance. Terminal events close attempts. Cancellation/revocation suppress late results without claiming remote rollback or reversed billing. No automatic Messages retries; explicit retries create attributable attempts after effects reconciliation.
- Fixture-only tests may use loopback TLS with synthetic credentials; production endpoint override is forbidden.
- Complete 1.20's route-dependent automatic permission reviewer, default off. Activate only for an enabled Workspace switch and this Task's explicitly configured, evidence-verified route at the applicable data tier; credential presence alone is insufficient. No new tools or independent reviewer authority.
- Only a trusted runtime-created review invocation may yield an automated verdict. Bind its unforgeable internal handle to the bound principal, Task, pending permission ID, exact action/destination digest, policy revision/authority epoch, selected route/model, credential generation and attempt ID. Renderer/main-supplied actor references or verdicts never establish this provenance. Accept a complete schema-valid verdict once, while the request is pending; record actor_kind=automated_reviewer with invocation/route attribution.
- Recheck current authority, policy, route eligibility and request freshness immediately before review dispatch and atomic verdict application. Re-evaluate the controlling rule; forbid/cannot-ask cannot become allow. Route/key changes, cancellation, expiry and revocation invalidate the invocation and discard late verdicts. No reviewer changes sandbox, allowlists, review states or Professional Approval.
- Keep the global runtime reviewer set to user. Use a scoped trusted review invocation at the existing permission boundary, not an unguarded global flag. Off/unavailable/unverified/error/malformed verdict means human review through the existing mediator where policy permits asking; otherwise refuse. This is human permission handling, never inference-provider fallback. Label decisions “Automated permission review — not analytical review or Professional Approval”.

**Never:** Real credentials or paid/live inference; Claude.ai token collection; gateway translation; Claude Code/harness replacement; provider/local-model fallback; real-data enablement; new installs/downloads without approval. Keep task execution (1.25), reasoning/usage UI (1.24) and broader location UX (1.23) separate while supplying their route contract.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|---|---|---|---|
| Select/reopen | Creator selects either route | Same persisted metadata in S07/Task | Conflict requires refresh; other principal gets unknown |
| Missing proof | Credential present, adapter/evidence absent | Not enabled; precise gate | Never infer readiness from login |
| Unsupported | Unsupported model/setting/history/tool | Preserve draft; name limit | No alternate route request |
| Stream/tool | Interleaved deltas and tool results | Ordered IDs, validated complete calls only | Duplicate/missing IDs or malformed/truncated JSON fail attempt |
| Terminal | Refusal, output limit, disconnect or unknown required semantic | Partial output/usage retained; accurate non-success | No manufactured completion |
| Cancel/switch/revoke | In-flight response | Cancel locally; late output unusable; old auth invalidated | No remote-stop/billing guarantee |
| Retry | Explicit retry after partial/tool effects | New attempt, same logical turn; reconciled effects | No duplicate tool execution |
| Secret isolation | Sentinel key through private handoff | Only vault/volatile auth holds secret | Fail leak scan including RPC tracing, logs, exports and child environment |
| Policy | Forbidden command or revoked authority | Existing checks still refuse | Adapter cannot execute or widen permissions |
| Transport recovery | Responses WebSocket unavailable | Existing same-route HTTP recovery remains identifiable | Never select another provider |
| Reviewer eligible | Switch on, verified configured route, pending permitted request | Trusted invocation; bounded one-use verdict with actor/route attribution | No widening or professional approval |
| Reviewer unavailable | Off/unverified/failed/malformed result | Existing human review if asking permitted; otherwise refuse | No provider fallback or forged automated actor |
| Reviewer race | Policy/key/route changes, revocation, cancellation or duplicate verdict | Recheck and reject stale/replayed verdict; no action | Preserve pending work where still valid |

</frozen-after-approval>

## Code Map

- `engine/codex-rs/model-provider-info/src/lib.rs::WireApi`, `core/src/client.rs::ModelClientSession::stream` — Responses-only dispatch; preserve same-route transport recovery.
- `inquello-domain/src/capability/{register,inventory}.rs` and `register/capabilities.json` (under engine/codex-rs/inquello-domain) — reviewed, fail-closed evidence; no runtime eligibility override.
- `inquello-domain/src/organise/{commands,ports,model}.rs` — creator checks. Mirror `execution_policy/broad_mode.rs`, `inquello-adapters/src/broad_modes.rs` and migration 0004 for a separate Task-route record/revision with atomic receipts; do not overload Task organisation revision.
- `app-server/src/request_processors/inquello_processor.rs` — domain bridge; PROCESSING_ROUTE_AVAILABLE=false is not safely replaced by a credential boolean.
- `inquello-domain/src/execution_policy/{command_rules,permission}.rs` — reuse permission_reviewer and bounded_reviewer_verdict; `desktop/src/main/policy/permissions.ts` owns human mediation. Bind automated decisions internally rather than trusting the existing actor_ref input.
- `desktop/src/main/providers/{index,status,claude-vault}.ts`, `runtime/{config,rpc,process,env}.ts` — generation, auth isolation and preserved 1.21 protections.
- `desktop/src/main/capabilities/service.ts`, `security/operations.ts`, `src/preload/preload.ts`, `src/renderer/{Capabilities,Shell/TaskView}.tsx` — named mediation and existing accessible primitives.

## Tasks & Acceptance

**Execution:**
- [ ] `engine/codex-rs/inquello-domain/src/routes/`, `inquello-adapters/src/routes.rs` and next unused migration — add governed route configuration/Task selection and atomic receipt tests; extend capability register only with actually passing evidence.
- [ ] `engine/codex-rs/inquello-protocol/src/inference.rs`, `fixtures/inference/` — CR-1 requests/events and shared Responses/Messages fixtures; authorization and sequence semantics.
- [ ] `engine/codex-rs/inquello-adapters/src/anthropic/`, its `Cargo.toml`, `core/src/client.rs`, `core/Cargo.toml`, `model-provider-info/src/lib.rs` — native request/history/SSE mapping and explicit dispatch using existing workspace HTTP/stream crates; no dependency cycle or tool execution in adapter.
- [ ] `engine/codex-rs/app-server/src/request_processors/inquello_processor.rs`, `app-server-protocol/src/protocol/{common.rs,v2/inquello.rs}` and `desktop/src/main/providers/` — bound-principal named route read/set operations, bounded secret handoff, invalidation and safe diagnostics.
- [ ] `desktop/src/main/routes/`, operations/preload, `desktop/src/renderer/ProcessingRoutes.tsx`, S07 and TaskView — explicit selection/status, keyboard operation and truthful errors.
- [ ] `engine/codex-rs/app-server/src/request_processors/inquello_reviewer.rs`, processor/permission domain, `inquello-adapters/src/permissions.rs` and `desktop/src/main/policy/permissions.ts` — scoped trusted review invocations, atomic one-use freshness checks and attributed receipts; retain global user reviewer protection. Add `inquello_reviewer_tests.rs` and desktop permission tests for both route fixtures, spoofing, policy races, cancellation, no-widening and human-review unavailability handling.
- [ ] `desktop/data-policy.json`, `FORK-CUT.md`, `desktop/src/main/smoke-probe.ts` — held route/history categories, focused fork patch record and routes smoke report.
- [ ] `engine/codex-rs/inquello-adapters/tests/processing_routes.rs`, core/app-server regressions and `desktop/test/routes*.test.*` — execute every matrix row, real-runtime fixture transport, cross-principal refusal, secret probes and previous-story regressions; regenerate genuine protocol, never hand-edit generated files.

**Acceptance Criteria:**
- Given separately configured candidate routes, when inspected in S07 and a private Task, then metadata, data flows, limitations and current evidence agree without claiming live or real-data verification.
- Given a Messages fixture turn through the real packaged runtime, when text and tool traffic completes, then normalized events and existing permission enforcement match CR-1, with no external provider call.
- Given a route-eligible policy-enabled permission review using synthetic local fixtures, when a verdict is applied, then its trusted invocation is current, attributed and one-use; forged/stale verdicts cannot authorize actions and unavailable review returns to permitted human handling without changing provider.
- Given the full required native/runtime/database/keyring topology, when validation runs, then each matrix row passes and prior protections remain intact; blocked/skipped checks remain unmet.

## Implementation Notes

## Spec Change Log

### Round 1 loopback — non-frozen plan correction

Triggering groups: B2/E1 draft provenance; B3 task-scoped lifetime; B4 classification freshness; B5 provider-native continuation; B7/B8/E2 complete cancellation propagation; E3 true packaged-runtime fixture. Frozen intent is unchanged. Lower patch findings B1/V1 are incorporated in re-derivation, not patched onto discarded code. B6/B9 were rejected on their specific claims; B10 remains an explicit native/generation gate.

**Amendments:**
- Configuration forms bind draft values to the exact loaded revision; refresh must not silently advance a dirty draft's write revision. Test two-window changes and deliberate reload/reconciliation.
- Separate principal/credential/runtime authority epochs from per-Task route epochs; selecting Task A must not cancel Task B or rebind unchanged provider credentials. Credential/session changes still invalidate all affected attempts.
- Obtain trusted data classification anew with policy/authority before dispatch and application; unknown/noneligible changes invalidate staged review and use only policy-permitted human handling.
- Preserve inherited Responses opaque history without coercing it through Messages-specific encrypted-content parsing. Shared normalized contracts must carry provider-specific continuation bound to exact route/model/API; required history remains protocol state, never audit evidence. Add both-provider continuation coverage and exact Messages signed/redacted roundtrips.
- Use cancellation-aware bounded sends on every core event/output/error/terminal channel. Bind context cancellation to credential-lease transport cancellation before dispatch; receiver closure during headers must stop local HTTP work. Tests saturate output and event queues, cancel before dispatch/during headers/during delivery, and reject late output. No claim remote charges are reversed.
- Credential mutation/verification rechecks generation and vault identity after invalidation waits, including concurrent local-data deletion; test with isolated sentinel keys only.
- The default-off fixture must execute inference dispatch inside an actual app-server test binary/process and route emitted tools through its real permission/sandbox path. Do not substitute inference in the parent test process. Test-only injection remains absent from default release binaries and cannot add production Task-start orchestration, arbitrary endpoints or credentials. If a required fixture cannot be authored, state that gap, not just unrun.

**KEEP:** Preserve immutable route records, independent Task revisions, creator checks, operation replay/atomic receipts, migrations, exact capability evidence gates with no upgrades, fixed production endpoint, private stdio origin/size/redaction protections, global user reviewer, trusted staged one-use verdicts, current policy/local revision checks, all passing desktop security/lifecycle cases, schema/state/stream validation, no Messages automatic retry/fallback, and no production 1.25 API. Preserve authored validation limitations and actual test results as historical round-1 evidence, not proof for re-derived code.

Round-1 snapshot for positive preservation only: `/workspace/shared/inquello-story122-round1-preserved`. It contains known-bad implementation; do not restore it wholesale or carry the defects above forward. Re-derive from the corrected spec and pinned baseline.

## Review Triage Log

### Round 1 — 2026-10-30

All three independent layers completed. Likelihood is conditioned on the named trigger, not a claim that currently disabled inference is active. Impact grades the consequence if reached. High native risks remain source-grounded, not executed bug claims.

| ID | Verdict | Route | Likelihood / impact | Evidence and disposition |
|---|---|---|---|---|
| B1 | high | patch | Medium / High | Executed isolated witness proves rejected verification can restore a key after concurrent forgetClaudeKey during awaited invalidation. Generation and vault state must be checked after every await before persistence. |
| B2 | medium | bad_spec | Medium / Medium | Configure initializes React draft state once but submit reads current route.revision; background refresh can pair stale values with a newer revision. Bind draft provenance to its loaded revision and require deliberate reconciliation. |
| B3 | medium | bad_spec | Medium / Medium | select calls global changed(), clearing all markers and invalidating all review scope epochs. list then rebinds credentials and runtime cancels principal reviews; unrelated Task work is affected. Separate task-selection invalidation from credential/session scope. |
| B4 | medium | bad_spec | Low currently / High if enabled | The trusted classification port is awaited only once and both phases hard-code synthetic. Default production unknown prevents activation today, but the declared eligible synthetic path lacks freshness across the wait. Re-read trusted tier with authority on both sides. |
| B5 | high | bad_spec | High on native Responses continuation / High | Shared request() accepts reasoning only with Messages OPAQUE_PREFIX; bound Responses histories containing retained native encrypted reasoning fail before dispatch. Separate provider continuation representation while retaining shared trust/identity envelope. |
| B6 | false | reject | Not applicable | The cited Responses path buffers partial arguments until OutputItemDone and validates the complete tool schema/ID before forwarding. Frozen intent does not require withholding a complete valid Responses tool until response terminal; retained Responses already streams complete tools. A later stream failure is not evidence of unauthorized or malformed execution. Do not add a new terminal-only constraint. |
| B7 | high | bad_spec | Medium under backpressure / High | Downstream sender.send awaits in core Messages/Responses translation do not select cancellation. A full bounded consumer queue can retain the task across cancellation and later deliver stale output. Apply one cancellation-aware delivery primitive to every output and terminal/error wait. |
| B8 | medium | bad_spec | Medium on slow headers / Medium | Reviewer cancellation token and Messages lease token are distinct; dropping collect_verdict does not cancel initial builder.send, which does not watch receiver closure. Link dispatch/lease lifetime and receiver closure without remote rollback claims. |
| B9 | false | reject | Not applicable | A durable ledger for every failed reviewer attempt is not a requirement of this approved intent; durable attribution is required for applied permission decisions and is implemented. CR-1 exposes usage/error events, while usage/reasoning UI is explicitly 1.24. No evidence was supplied that mandated persisted accounting records existed and are lost. Do not introduce a new billing ledger as this finding requests. |
| B10 | maybe-false | defer | Unverified / High if native or schema incompatible | Generated protocol and lockfile updates remain required, explicitly owner-accepted unavailable work. Native compilation/locked resolution cannot be established here; no missing generated file has been represented as a pass. Complete native build and genuine generation settle compatibility; retain a visible blocking acceptance gate. |
| E1 | medium | bad_spec | Medium / Medium | Same independently verified draft/current-revision defect as B2; preserve its individual finding before grouping. |
| E2 | high | bad_spec | Low race frequency / High | messages() leases and spawns transport before its forwarding loop checks context cancellation; lease cancellation is independent. A cancelled bound context can still initiate request dispatch. Check and link cancellation before any network send, and arbitrate lifetime through transport. |
| E3 | high | bad_spec | Certain acceptance gap / High | Existing fixture runs inference inside test process and only sends manually extracted commands to packaged app-server. It does not meet the stated packaged-runtime Messages turn criterion. Add a default-off test-only in-runtime harness exercising actual dispatch and tool boundary; no production 1.25 Task-start API or endpoint override. |
| V1 | medium | patch | Medium / Medium | Verification-gap evidence accepted: no checked test supplies an opaque thinking/signature/redacted block. Add exact decoder-to-retained-history-to-next-request roundtrip and wrong route/model/API rejection tests; no live call. |


### Round 2 — 2026-10-30

All three independent layers completed. Each finding classified before grouping; earlier unchanged durable-ledger claim carried. Localized fixes below add no new product surface and use existing bound contracts, failure event, continuation wrapper, EventGuard and HTTP client. Frozen intent unchanged.

| ID | Verdict | Route | Likelihood / impact | Evidence and disposition |
|---|---|---|---|---|
| R2-B1 | false | reject | Not applicable | Production Task→turn start is explicitly excluded as Story 1.25 in frozen intent; this story supplies explicit route storage, native dispatch boundary and synthetic in-runtime fixture, not ordinary Task execution. Unbound Messages correctly refuses. |
| R2-B2 | false | reject | Not applicable | No existing trusted persisted Task classifier exists. Approved constraints forbid inferring synthetic from credentials/UI, and shipped routes have no enabled evidence. Default unknown→human is the required truthful behavior, not proof that an eligible known-synthetic Task is misclassified. Future execution/classification integration remains explicit. |
| R2-B3 | high | patch | Medium on transient failure / High | take_attempt consumes binding; await_dispatch returns native retryable errors unchanged, and retained Responses recovery can retry with None context. Convert failures of an explicitly bound dispatch to existing terminal failure; preserve same-call WebSocket→HTTP recovery and unbound legacy behavior. |
| R2-B4 | high | patch | Medium on encrypted-message continuation / High | Reasoning outputs are bound, encrypted assistant Message outputs are not. request stamps raw encrypted Message with current context. Extend existing continuation normalization/wrapping match to encrypted Message and test original model/API refusal. |
| R2-B5 | high | patch | Low unexpected provider output / High | OutputItemDone custom/local-shell/provider-tool variants hit catch-all and bypass the bound contract function schema checks. Explicitly reject unsupported tool-bearing variants before attribution/runtime delivery using existing failure event. |
| R2-B6 | medium | patch | Low malformed stream / Medium | Pinned codex-api SSE parser converts created/output/completed independently and does not enforce normalized lifecycle. responses mapper lacks the existing EventGuard. Apply it before delivering normalized/runtime data and test duplicate/startless sequences. |
| R2-B7 | false | reject | Not applicable | Carried B9: same durable billing-ledger claim and unchanged collector. Frozen intent mandates bound events and applied permission attribution, not a new persistent accounting ledger; usage UI remains 1.24. |
| R2-B8 | medium | patch | High preselection use / Medium | Task-mode candidate rows hide exact metadata before selection. Remove the presentation-only condition so existing RouteFacts also describes selectable candidates before mutation. |
| R2-B9 | medium | patch | Low scalar-root tool definition / Medium | Shared schema validator allows scalar roots; Messages tool definitions require an object root. Add direct root-object rejection for tool definitions before transport, preserving nested scalar/array schema support. |
| R2-B10 | false | reject | Not applicable | Messages UsageUpdate is delivered unchanged to the required bound context.events before the legacy runtime mapping. The legacy integer TokenUsage cannot represent unknown categories; None there does not erase the normalized usage record. No mandated usage UI/accounting sink exists before 1.24; do not fabricate zeros to satisfy this claim. |
| R2-B11 | medium | patch | Medium expired-token refresh / Medium | Pinned AuthManager::auth at 2480–2493 can refresh a token over network; check_configuration awaits it under route-state mutex. Use current cached keyring auth for the synchronous configuration check, leaving refresh/transport outside the mutex and existing application rechecks intact. |
| R2-E1 | high | patch | Medium / High | Same verified encrypted Message binding defect as R2-B4; keep individual row then group. |
| R2-E2 | high | patch | Low / High | Same verified unsupported tool-bearing output defect as R2-B5; complete validation must precede forwarding. |
| R2-E3 | medium | patch | Medium long reviewer output / Medium | Normalized review declares 512 output tokens but typed ResponsesApiRequest has no field, so serialization omits it. Existing ResponsesClient::stream(Value, ...) can send max_output_tokens without changing public request structures; test exact wire body. |
| R2-E4 | false | reject | Not applicable | The corrected test now invokes actual app-server child inference/permission execution. Deliberately excluding loopback fixture RPC from default/release binaries is the approved production endpoint safeguard, not a defect. No release/default-binary certification has been claimed. |
| R2-V1 | medium | patch | Low accidental decode regression / High | Pre-verified gap accepted: parser tests only Some and end-to-end fixtures only allow. Add exact enum assertions plus both-route deny verdict and stored outcome assertions. |
| R2-V2 | low | reject | Low with documented required gate / Low | Pre-verified default-suite omission is real and intentional: a dedicated feature command is explicitly required in the verification runbook and no default-suite success claims this gate. New cross-platform orchestration/CI changes exceed direct correction for this negligible documented-test-discovery issue; keep mandatory owner-run feature command visible rather than enabling fixture code in shipping builds. |
| R2-V3 | high | patch | Medium / High | Same verified encrypted Message binding defect as R2-B4/R2-E1; extend existing match and regression coverage. |

Groups: continuation R2-B4/E1/V3; unsupported outputs R2-B5/E2; remaining surviving patches independent. All patches assigned to the same loop-1 implementer.

## Design Notes

One cohesive goal spans route configuration and its actual adapter, not a selector backed by fictitious compatibility. Footprint includes a durable additive route store and protocol changes; no existing data deletion or live external mutation is authorised.

Initial discovery used 3c7b4e9931e14ebb692f3f93f55fa396cf2941f4 plus the local 1.21 candidate. Published source baseline is now verified commit 7cae5f3aceeec3f84b5eca6e3fb57cf774553b8e, tree 7b05db4595ea7f20126ba918b06042c2065cd07c; metadata: /workspace/shared/inquello-story122-baseline-20261030.json. Before implementation, obtain that complete checkout and record its canonical VCS baseline. 1.21 remains in-progress with native/protocol gates; this partial non-Git planning snapshot cannot establish build readiness.

Reviewer inclusion follows the already-approved 1.20 owner decision, not a new product choice. The prior draft's question was redundant: a scoped trusted invocation closes the route-dependent promise while retaining 1.21's global user-reviewer guard. No blanket PROCESSING_ROUTE_AVAILABLE toggle or renderer-authored automated verdict is sufficient.

Official compatibility sources checked 2026-10-30: [versioning](https://platform.claude.com/docs/en/api/versioning), [migration](https://platform.claude.com/docs/en/api/migration-2026-10-21), [streaming](https://platform.claude.com/docs/en/build-with-claude/streaming), [Sonnet 5.5](https://platform.claude.com/docs/en/models/sonnet-5-5/overview), [model IDs](https://platform.claude.com/docs/en/about-claude/models/model-ids-and-versions). Dateless current IDs are pinned snapshots. API 2026-10-21 rejects sampling parameters; preserve opaque model-bound thinking/signature blocks for continuation, not audit evidence, and refuse incompatible cross-model history. No SDK installation is required.

## Verification

- In `engine/codex-rs`: `cargo fmt --all -- --check`; `CARGO_INCREMENTAL=0 cargo test -j 4 -p inquello-domain -p inquello-adapters -p inquello-protocol -p inquello-service` with isolated database; focused core and app-server tests for every matrix row; `cargo clippy -j 4 -p inquello-domain -p inquello-adapters -p inquello-protocol -p inquello-service -- -D warnings`.
- Build `codex-cli` and `codex-app-server` separately per FORK-CUT, then `pnpm generate:protocol && pnpm run build && pnpm test` in desktop with the real runtime/database. Require genuine generated schemas/stamp and no hidden skips.
- Run seeded, sandbox-enabled keyring smoke per existing topology; require routes and all earlier reports passing, including 1.21 native regressions. Keep unavailable platform/runtime evidence explicitly unmet; no fixture result is a live-provider test.


## Approval and Environment Record

Owner approved Keep full specification on 2026-10-30 at 12:17:34 UTC. The source commit was rechecked against the remote branch before implementation and has no drift. This is a partial materialized source workspace without local Git metadata; baseline_commit therefore honestly records NO_VCS, with the canonical source_commit and complete baseline tree metadata retained for diff verification. Owner accepts documenting unavailable native/runtime/protocol validation, not claiming it passed. No real credentials or paid inference calls are authorized.

## Implementation handoff — 2026-10-30

Source is authored for review, **not acceptance-complete**. Frozen intent and task
checkboxes remain unchanged; sprint status remains `in-progress`. There is no local
Git repository, commit, push, merge or deployment. No dependency/toolchain installation,
real credential, paid request, subscription-token flow or live provider verification
occurred. No passing capability-register evidence or generated protocol was fabricated.

### Authored implementation

- `inquello-domain/src/routes/`, adapter `routes.rs` and migration 0006 implement
  private candidate configuration history and exact-revision Task selection, atomic
  operation receipts, revision conflicts/replay, creator checks and stale-candidate
  refusal. No default route and no implicit upgrade after configuration changes.
- Shared CR-1 inference contracts/fixtures, native Messages request/history/SSE
  translation, bounded volatile generation-scoped auth and explicit retained-client
  dispatch. Partial tools are buffered/schema-checked; effects IDs, opaque history,
  terminal/usage semantics, cancellation and no Messages retry/fallback are represented.
- Source protocol/processor named route operations, bounded private stdio auth with
  redacted diagnostics/analytics exclusion, lifecycle invalidation and safe status.
  Reviewer invocations are hidden runtime-created objects; two-phase main mediation
  freshly reads authority/policy before dispatch and application without supplying
  any verdict. Migration 0007 atomically stores one-use attribution, decision and
  receipt with request/creator/expiry/local-revision checks. Global reviewer stays
  `user`; public automated actor references remain refused.
- Main route/provider services, validated named preload operations, S07 and Task
  route UI, keyboard forms, stale-scope protection, two-phase permission mediation,
  data-policy categories and configuration-only routes smoke. Applicable Task data
  tier has no existing trusted persisted source, so the new trusted port defaults
  **unknown → human handling**; isolated fixtures explicitly supply synthetic.
- Native fixtures include adapter TLS, core contracts and a default-off
  `inference-fixtures` integration target: actual retained ModelClientSession TLS
  inference plus packaged default-feature app-server stdio permission/sandbox tool
  execution, then untrusted tool-result continuation. This does not introduce or
  claim Story 1.25 production Task→turn start orchestration. Exact runbook:
  `engine/codex-rs/app-server/tests/INQUELLO-MESSAGES-FIXTURES.md`.

### Executed checks

- Desktop build and main/full-test/renderer TypeScript checks: **passed**; five
  missing font assets still prevent native visual-fidelity claims.
- Focused route/private-RPC/UI/provider/security/policy/data regressions:
  **486 passed across 13 files** (`desktop/validation/story122-focused.log`).
- Full desktop suite: **exit 1; 1021 passed, 3 failed, 5 skipped; 38 passing files,
  12 failed files, 1 skipped file**. Nine integration suites cannot collect without
  the runtime, including the new routes suite; reference icons/logo are missing;
  schema checks require Git and the full generated tree (48 files versus stamp 816).
  These remain unmet, not assumed passes (`story122-full-test.log`).
- `pnpm generate:protocol`: failed at missing Git metadata. Generated bindings,
  schemas and stamp remain untouched (`story122-generate.log`).
- Seven migrations applied together in isolated Python SQLite **3.53.1**; contract
  JSON and relevant Cargo TOML parse. SQL syntax/schema validation is not execution
  of Rust commands, atomic races or permission enforcement (`story122-source-checks.log`).
- All requested native fmt/tests/clippy/separate builds attempted: **exit 127,
  cargo unavailable** (`story122-native.log` and native fixture logs). Native test
  sources are authored, not passing evidence. No runtime/database/keyring topology
  or seeded sandbox-enabled smoke is available here.
- Existing desktop dependencies were reused by local symlink; no install/download.
  Missing repository context was retrieved read-only at the recorded source commit.
  Targeted WireApi consumers and ConnectionOrigin usages were source-inspected;
  complete-checkout exhaustiveness/native compilation remains unverified.

### Matrix coverage and completion gates

| Matrix rows | Authored coverage | Evidence here |
| --- | --- | --- |
| Select/reopen, missing proof, unsupported, cross-principal | Domain/store tests; desktop route/UI tests; real-runtime route integration | Desktop mocks/UI pass; Rust/runtime unrun |
| Stream/tool, terminal, retry | Shared contract/adapter tests; retained-client and packaged permission split-boundary TLS fixture | Fixture JSON parses; native behavior unrun |
| Cancel/switch/revoke | Auth leases, cancellation-aware streams, route/provider lifecycle and reviewer race tests | Desktop lifecycle passes; native races unrun |
| Secret isolation | Dedicated RPC sentinel tests, private DTO/analytics defenses, native auth tests, existing smoke scans | Desktop RPC probes pass; native tracing/export/environment/keyring scans unmet |
| Policy, same-route transport recovery | Retained enforcement/recovery code and native regression/fixture tests | Desktop policy regressions pass; actual sandbox and recovery unrun |
| Reviewer eligible/unavailable/race | Runtime provenance, two-phase application, atomic-store tests for both route fixtures; desktop mediation | Desktop fixtures pass; native execution unrun; shipped evidence not verified |

Required remaining work is genuine native compilation/formatting/clippy and any fixes
it exposes, lockfile/protocol/config-schema regeneration from matching source/runtime,
explicit Linux feature fixture execution, full runtime/database/keyring regression
and seeded smoke. Never count a default native suite that omitted the feature target
as that fixture passing. Route enablement remains disabled without reviewed passing
evidence. This handoff makes no live-provider, entitlement, real-data, acceptance or
Professional Approval claim.


## Corrected loop 1 implementation handoff — 2026-10-30

The preceding handoff and round-1 test totals are **historical only**, not proof of
this corrected tree. Implementation is authored and locally frozen for review;
acceptance and sprint status remain **in-progress**. Frozen intent, acceptance
checkboxes and capability evidence were not upgraded. No Git commit, remote write,
deployment, install/download, real key, live inference or paid request occurred.

### Corrected source

- Configuration forms retain the revision associated with their draft; background
  refresh cannot silently advance it. A deliberate reload discards/reconciles the
  draft. Tests cover two-window changes and refusal of stale expected revisions.
- Principal/credential/runtime epochs and per-Task route epochs are separate.
  Changing Task A cancels its review/continuation but does not invalidate Task B
  or rebind unchanged credentials. Immutable route records, separate Task revisions,
  creator checks and atomic receipt/replay contracts are retained. Added native
  store regressions cover Task independence and stale configuration drafts.
- Main freshly obtains policy/authority and trusted data classification before
  dispatch and application. Unknown/real/changed tiers cannot apply a staged
  verdict. Runtime reevaluates forbid/cannot-ask before permitting human handling.
  Failed policy lookup refuses; failed classification lookup becomes unknown.
  Global reviewer remains user, and only runtime-created one-use invocations can
  attribute automated decisions.
- Responses opaque continuation now uses a provider-specific representation, not
  Messages encrypted-content parsing. Exact route/model/API binding is checked;
  native Responses records are restored without coercion. Authored tests cover
  native Responses and exact Messages thinking/signature/redacted roundtrips and
  mismatched bindings.
- Every core/adapter bounded output/event/error/terminal delivery observes local
  cancellation. Context cancellation is linked to credential-lease transport
  cancellation before dispatch; cancelled headers and closed receivers stop local
  HTTP work. Authored tests saturate queues and cancel before dispatch, during
  headers and delivery. No remote rollback or reversed billing is claimed.
- Claude key mutation/verification rechecks generation and current vault identity
  after invalidation awaits, including concurrent local-data deletion. Isolated
  sentinel tests show that stale verification cannot resurrect a removed key.
- The rejected parent-inference/split-boundary fixture was replaced: a debug-only,
  default-off app-server fixture method executes retained ModelClientSession
  inference **inside the child process**; emitted tools traverse that same process's
  existing permission/sandbox executor and then untrusted-result continuation.
  The integration test invokes this method from a real subprocess; its parent only
  serves loopback TLS and asserts results. The seam is absent in default/release
  binaries and introduces no production Story 1.25 Task-start API. It is authored,
  **not executed** here; see the updated native fixture runbook.
- Integration preserved bounded private-auth transport and parse-error redaction,
  Messages exclusion from automatic Responses recovery, and serde_json as a real
  inference-contract dependency. No production endpoint override or fallback was
  introduced. Generated protocol and Cargo.lock remain untouched pending genuine
  native tools.

### Executed verification of corrected tree

- Desktop build and complete TypeScript checks: **passed**. Five missing font assets
  remain warnings and prevent visual-fidelity claims.
- Focused desktop regressions: **494 passed / 12 files**. Logs:
  `desktop/validation/story122-loop1-desktop-{focused,build,types}.log`.
- Final full `pnpm test`: **exit 1; 1035 passed, 3 failed, 5 skipped; 38 files passed,
  12 failed, 1 skipped**. Nine integration suites cannot collect without the runtime;
  design reference icons/logo are absent; schema checks lack Git metadata and the
  complete generated tree (48 files versus stamped 816). Unavailable checks remain
  unmet. Log: `desktop/validation/story122-loop1-final-full-test.log`.
- Genuine `pnpm generate:protocol`: **exit 1** at missing Git metadata. No generated
  artifacts were manufactured. Log: `story122-loop1-desktop-generate.log`.
- All seven migrations applied to isolated Python SQLite **3.53.1**; fixture JSON/SSE
  and available touched Cargo TOML parsed. This is source/schema syntax evidence
  only, not Rust behavior or atomic concurrency evidence. The partial snapshot also
  lacks `app-server-protocol/Cargo.toml`; no complete-checkout claim is made.
  Log: `story122-loop1-source-checks.log`.
- Requested cargo fmt, domain/adapter/protocol/service tests, clippy, separate CLI
  and app-server builds, and explicit runtime fixture tests were attempted and
  blocked by **cargo unavailable (exit 127)**. Native test sources are unrun.
  Logs: `story122-loop1-{native-adapter,runtime-native,native-final}.log`.

Required remaining gates: full matching checkout, genuine native compilation and
formatting fixes, lock/protocol/config-schema generation, explicit feature-enabled
child-process fixture execution, full runtime/database/keyring topology regressions,
and seeded sandbox-enabled smoke. No default suite omission, synthetic fixture,
source inspection or blocked check counts as a live-provider, entitlement,
real-data, acceptance or Professional Approval result.


## Final localized review corrections and verification — 2026-10-30

All nine retained Round 2 correction groups have localized source and regression
coverage: terminal bound dispatch failures; exact encrypted-message binding;
unsupported tool refusal; normalized lifecycle validation; preselection route
facts; object-root tool schemas; cached synchronous configuration checks; bounded
Responses reviewer output; and both-provider persisted deny verdicts. The source
was checked against the affected retained APIs. Native regression sources remain
unrun, not proven fixes. The nine groups consolidate the individually recorded
findings above; rejected findings retain their recorded rationale.

Final available-tree verification:
- `pnpm run build`: exit 0.
- `pnpm exec tsc -p tsconfig.json --noEmit`: exit 0.
- `pnpm exec tsc -p tsconfig.renderer.json --noEmit`: exit 0.
- `pnpm test`: exit 1; 1036 passed, 3 failed, 5 skipped; 38 files passed,
  12 failed, 1 skipped. Nine native integration suites could not collect without
  app-server; design collection lacked imported icons; three assertions failed
  for absent imported logo, missing Git metadata, and generated-file count
  mismatch (48 versus 816). These are observed missing-environment/input failures,
  not a passing full suite or assurance that native assertions would pass.
- The newly added preselection UI regression passed with its focused suite
  (8 tests). Final full-suite pass count includes it. The final focused routes run passed
  47 tests across 3 files (`pnpm test test/routes-units.test.ts
  test/routes-rpc.test.ts test/routes-shell.test.tsx`).
- `pnpm generate:protocol`: exit 1 at missing Git metadata.
- Nine requested Cargo formatting/test/lint/build/fixture commands: exit 127,
  Cargo absent. No native test, formatter, build or child-runtime fixture ran.
- An initial typecheck invocation named nonexistent `tsconfig.test.json` and
  failed TS5058; the correct two existing configurations above subsequently passed.

Final logs are `desktop/validation/story122-final-*.log` (delivery evidence only,
not tracked product files). Remote head was rechecked at 15:11 UTC and remained
7cae5f3aceeec3f84b5eca6e3fb57cf774553b8e. No 1.22 commit or push was performed.

The owner's accepted environment-limited handoff overrides the workflow's normal
mark-done terminal step: spec and sprint stay **in-progress** until the previously
listed native/generation/runtime/platform acceptance gates are satisfied. This is
an inspectable implementation candidate, not a release or completion certification.
