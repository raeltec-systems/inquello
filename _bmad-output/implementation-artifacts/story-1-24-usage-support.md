# Story 1.24 support and verification record

Status: **in progress — not native acceptance evidence**. Source baseline:
`55db99c056f068702b8bcb49c04efcf69c944d30` (partial, non-Git working snapshot).

## Authoritative sources and supported choices

- `app-server-protocol/src/protocol/v2/model.rs` and
  `protocol/src/openai_models.rs` define supported reasoning efforts, model defaults
  and service-tier identifiers. The native selected-model catalog supplies options;
  renderer input is not capability evidence. Provider catalog changes require
  restart/correction rather than deriving choices from a different provider.
- The initial Messages adapter (`inquello-adapters/src/anthropic/request.rs`) accepts
  defaults only. No effort or speed mapping was invented. Defaults must be saved
  explicitly. Unsupported/stale selections refuse model work until corrected.
- `app-server/src/request_processors/account_processor.rs` supplies inherited Codex
  account limits. Reads explicitly disable Luna Reserve and reset-credit details.
  Only current-account `ordinary_usage_allowed: true` permits model dispatch;
  false blocks and null/check failure refuses. Neither a sparse update nor a past
  reset timestamp grants recovery. Known reset/source details are explanatory only.
  Inherited OS-keyring OpenAI API-key authentication also has no supported quota endpoint; it does not query ChatGPT plan quotas. Exact auth-mode/account/credential-generation binding is checked after waits. No provider quota endpoint is claimed for Messages. Provider refusals still stop
  work; unrelated local tools require no model quota permission.

These are pinned native source contracts, not speculative pricing, budgets or
provider billing reconciliation. No real credentials or paid calls were used.

## Native dispatch and storage

`inquello-domain/src/usage/`, adapter `usage.rs`, and migration 0008 hold private
revisioned choices, atomic operation receipts, immutable attempt snapshots,
terminal outcomes and idempotent sequenced native usage. Unknown token/cache/cost
categories stay null. Monetary values require reported currency/provenance; raw
monetary deltas remain in events when their aggregate cannot truthfully be added. Positive Responses cache counters are retained; zero counters are ambiguous because the retained parser defaults omitted details to zero, so those remain unknown.
Reads return the most recent 100 attempts and omit internal event receipts. Native
records accept at most 4096 events per attempt; there is no renderer event-ingest API.

The existing permission reviewer snapshots before dispatch, checks inherited limits,
rechecks identity/route/credentials after waits, applies only advertised Responses
settings, and records normalized usage even when its verdict is unusable. Provider
refusals retain partial usage and never retry automatically. Provider output IDs
are linked when emitted; prompts, output contents and credentials are not stored.
Automated permission review is separate from human-requested work and Professional
Approval. This is not Story 1.25's Task-start UI or a new Task execution loop.

Actual local command completion is observed in `command_exec.rs`, including both
spawned execution paths. The optional native observer commits before the original
RPC response; existing uninstrumented `command/exec` API remains compatible.
Local-tool records carry Task settings/route context, not a claim that a model ran.
No model token cost is invented for tools. Dropped/unobserved work remains uncertain.

Each processor has a boot UUID. A durable `running` record means **unfinished**, not
proof of a live provider. Inspection from another boot projects it as uncertain,
without finalizing another concurrent owner's record. A late genuine terminal
result can still update it. No read or restart replays effects. An explicit
known-dead-runtime recovery port also exists, but is deliberately not called on
startup/open without proof that the named runtime ended.

## Privacy and governance

Only read and settings commands cross RPC. Native writes recheck Task ownership
inside SQLite transactions; unknown/other-owner IDs do not expose record content.
Main/preload use named validated operations and a bounded projection that removes
principal/runtime/event internals. Identity/runtime/route invalidation clears private
facts and drafts; ordinary history refresh/conflict preserves unsaved settings and mounted focus. Production sandbox-probe completion is an ordinary refresh, not private invalidation.

All new metadata remains in the existing governed working database. It is included
in the existing stopped-runtime working-store export/delete/reimport boundary and
inherits its owner/retention rules. Task foreign keys cascade deletion. No new
retention, artifact attribution, delegated accounting or shared-service grant exists.

## Matrix evidence (executed versus authored)

| Matrix | Evidence | Result here |
|---|---|---|
| Supported choices/defaults, stale revisions, replay | `inquello-adapters/tests/task_usage.rs::defaults_replay_privacy_and_revision_conflict`; `inquello_reviewer_tests.rs::reviewer_attempts_keep_changed_settings_and_uncertain_failures`; `desktop/test/usage-{units,shell}.test.*` | Desktop passed; native authored, unrun |
| Actual partial/failed/repeated native usage | reviewer `partial_failure_keeps_native_usage_and_does_not_retry`; existing reviewer collector; command execution observer; extended `probeEnvironments` mounted smoke | Native and seeded smoke authored, unrun |
| Known limit / unknown required check, zero model dispatch | reviewer `inherited_limit_and_unknown_required_check_dispatch_nothing`; `inquello_usage.rs::account_bound_explicit_permission_only_no_reset_recovery` | Native fixture at production reviewer boundary authored, unrun |
| Rendered native limit refusal | `usage-shell.test.tsx`; combined `probeEnvironments` usage-limit scenario; native child `usage_limit_fixture_refuses_at_native_boundary_and_preserves_local_work` | Mounted unit passed; combined native/seeded smoke authored, unrun |
| Duplicate/out-of-order/late events | adapter `trusted_cumulative_events_deduplicate_and_late_usage_does_not_recover_status`; domain consumption tests | Authored, unrun |
| Restart/concurrent owner and late completion | reviewer `other_boot_inspection_is_uncertain_without_finalizing_concurrent_owner`; adapter restart/recovery test | Authored, unrun |
| Identity/runtime changes after waits | reviewer `tool_observer_rechecks_identity_after_wait_and_commits_before_completion`; desktop service/shell/security tests | Desktop passed; native authored, unrun |
| Real notification path | security preload delivery tests; main settled-tool/reviewer notifications; mounted smoke defaults/history extension | Security passed; seeded smoke unrun |
| Migration/immutability/deletion | SQLite 3.53.1 applied all 8 migrations and tested terminal update, snapshot immutability rejection and Task cascades | Passed (Python SQLite; **not** Rust/sqlx evidence) |

Desktop executed: build, build/renderer/full TypeScript checks passed;
254 focused usage/security/route/environment tests passed (repeated after final native/source documentation changes); 27 data-policy tests also passed. Full suite:
**1112 passed, 3 failed, 5 skipped**; files 42 passed, 12 failed, 1 skipped. Nine
integration suites could not load without the native app-server; missing imported
design assets affect design/Avatar checks; schema checks fail because this snapshot
has no Git tree and only 48 of 816 generated files. These are not full-suite passes.
Full output: `/tmp/story124-final-owner-full.log` in this execution workspace.

Cargo and rustfmt commands exit 127 (not installed). Native domain/adapter/app-server/
protocol compilation and tests, fmt, complete-checkout call-site checking and genuine
protocol generation remain owner-run gates. Running the actual generator failed
before writes at its required Git check; all 48 available generated files plus the
schema stamp were SHA-1 Git-blob verified unchanged against the pinned baseline.
Do not hand-edit them or package this source with old bindings.

Seeded Electron smoke is authored for rendered choices and actual repeated/failed
local commands, but unrun without matching binaries and the isolated topology.
The combined seeded **native quota refusal → mounted usage panel** path is now
authored in `probeEnvironments`, using the existing debug-only private-stdio fixture
dispatcher and production reviewer/ledger. It asserts zero model-provider dispatch,
retained work and the actual mounted explanation/history after production notification.
The matching native child integration test is
`usage_limit_fixture_refuses_at_native_boundary_and_preserves_local_work`.
Both remain unrun: authored source is not acceptance evidence. The full seeded
Story 1.24 smoke requires the separately built debug inference-fixtures binary;
default/release binaries reject the fixture scenario. No production endpoint exists.

## Owner-run gates

In the complete checkout with the approved toolchain, compile/test the changed
native crates and existing reviewer/tool tests; run fmt; build matching CLI and
app-server; commit the engine source before genuine `generate:protocol`; run all
three desktop TypeScript checks/build/full suite; run the isolated seeded smoke.
Run the combined limit-refusal mounted smoke with the isolated debug fixture binary,
without paid calls or production fixture endpoints. Fix any compiler/test findings before marking this story done.
Story 1.21–1.23 gates remain independently open; no real-data eligibility changed.
