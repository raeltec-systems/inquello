---
title: 'Story 1.21: Discover current tools and connection states honestly'
type: 'feature'
created: '2026-10-29'
status: 'in-progress'
route: 'dispatch'
review_loop_iteration: 1
baseline_commit: '3c7b4e9931e14ebb692f3f93f55fa396cf2941f4'
context:
  - '{project-root}/_bmad-output/implementation-artifacts/epic-1-context.md'
  - '{project-root}/_bmad-output/implementation-artifacts/spec-1-13-keep-provider-credentials-separate.md'
  - '{project-root}/_bmad-output/implementation-artifacts/spec-1-18-inspect-effective-managed-policy.md'
  - '{project-root}/_bmad-output/implementation-artifacts/spec-1-19-bound-tool-reads-writes-network.md'
  - '{project-root}/_bmad-output/implementation-artifacts/spec-1-20-authorize-specific-actions.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** S07 shows policy and sandbox reach, but not which tools, apps, MCP servers and plugins exist. It does not show whether each is installed, enabled and callable now, or why not. Users cannot manage them, so missing access looks like missing functionality (FR-21, C33–C36, OQ-4, UX-DR40).

**Approach:**
- Build an honest capability inventory in S07 from the runtime's own state: `plugin/list|installed|read`, `app/list|read`, `mcpServerStatus/list`, `skills/list`, built-in tools and `account/read`.
- Each entry is combined with the Story 1.18 effective policy, so it shows:
  - its source and version;
  - its dependencies;
  - its effective permission;
  - whether it is installed, enabled and callable, with the reason when it is not;
  - the next action.
- Add full management through the runtime's existing methods: install and uninstall plugins, enable and disable, add and remove MCP servers, and start or cancel runtime-owned MCP connection sign-ins. Provider-hosted apps use an explicit browser handoff and status re-read, not a false remote-cancellation guarantee. Every change is gated by Workspace policy.
- Show the provider session separately from the Inquello identity.

**Owner decisions (2026-10-29):**
- **Scope:** full management. Install plugins, add MCP servers and start connection sign-ins from S07, as well as discovery and enable/disable.
- **Marketplace sync:** leave the runtime's automatic curated-marketplace sync on. S07 lists marketplace plugins as available and shows their policy state.

## Boundaries & Constraints

**Always:**
- **Inventory entry:** `{kind: built_in | app | mcp_server | plugin | skill, id, display_name, source (marketplace name, URL or local), version, dependencies (required apps or MCP servers, connections), installed, enabled, callable_now, reason_not_callable?, effective_permission, next_action?}`.
  - "Callable now" is true only when all of these hold:
    - it is installed;
    - it is enabled;
    - the Workspace policy allows that kind (`tools` for MCP and apps, `extensions` for plugins and skills);
    - its required connections are authenticated;
    - for remote endpoints, the host is on `allowed_domains`.
  - Reasons are specific, for example "Blocked by Workspace policy (extensions not allowed)", "Needs connection: GitHub (not signed in)", "Connection expired — sign in again", or "Host api.example.com is not on this Workspace's allowed list".
- **No credentials on install:** installing a plugin grants no connector credentials. Its dependent apps and MCP servers show "Not connected" until the user connects each one.
- **Expired or revoked connections:** shown as such, with one applicable next action ("Sign in again" or "Remove"). The runtime never silently falls back to another connection or route.
- **Management:** every action goes through main's validated preload operations to the runtime's own methods, and is refused when the effective policy disallows it, with the rule named. The actions are:
  - plugin install and uninstall (`plugin/install|uninstall`);
  - enable and disable (config writes through the runtime's writer);
  - MCP server add and remove (`config/batchWrite` plus `config/mcpServer/reload`);
  - MCP OAuth sign-in (`mcpServer/oauth/login`) and app connection sign-in.

  Each change shows its result from the runtime's actual state after a re-read, never an optimistic success.
- **Local MCP servers (stdio):**
  - They run a program on this device outside the Task sandbox.
  - They can be added only when a new Workspace policy field `execution.allow_local_mcp_servers` is true (default false).
  - Before adding one, the user confirms text that states it runs outside the Task sandbox.
  - Remote MCP servers are subject to `allowed_domains`.
- **Credentials:**
  - Runtime-owned MCP connection credentials stay in the runtime's own credential store (keyring). Provider-hosted app credentials remain with that provider's connection flow. Neither route exposes credentials to Inquello's stores, logs or renderer.
  - The Story 1.13 provider-environment stripping still applies.
- **Provider session (AC 1.21.4):**
  - S07 shows the provider sign-in (from `account/read`) in a separate block from the Inquello identity: provider, account type, effective route and its capability limits.
  - A provider sign-in or sign-out changes no Workspace, Engagement, membership, review or policy state; this is verified by a test.
- **Owner clarification (2026-10-30 09:34 UTC):** extend the runtime where needed for genuine cancellation of runtime-owned MCP OAuth. Provider-hosted app sign-in remains an explicit browser handoff with status refresh; do not claim local UI cancellation revokes provider authorization. Cancellation tests must cover late completion and cancellation versus credential writes using isolated fixtures, never real account credentials or persistent external grants.
- **Refresh:** S07 updates from the runtime's change notifications (`app/list/updated`, `skills/changed`, `mcpServer/startupStatus/updated`, `mcpServerStatus`), with an explicit Refresh button as well. A stale list is labelled with its time.
- **Accessibility:**
  - The inventory is a table or list with headings by kind.
  - States are shown as text, not colour alone.
  - Actions are buttons that name their target ("Install Linear plugin").

**Never:**
- No runtime-owned MCP credentials outside the runtime credential store; no provider-hosted app credentials copied into Inquello.
- No silent fallback between connections or routes.
- No running stdio MCP servers unless the policy allows them.
- No model runs (Story 1.25).
- No new dependencies.
- No change to the runtime's marketplace sync.
- No Inquello identity or permission changes from provider sign-in.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Default policy | Marketplace synced, extensions not allowed | Plugins listed "Available — blocked by Workspace policy (extensions not allowed)"; install refused with rule named | N/A |
| Built-ins | Any | Built-in tools listed with their Story 1.19 reach; callable state follows the sandbox probe | N/A |
| Install allowed | Policy allows extensions; user installs plugin | Installed (re-read); dependencies "Not connected"; no credentials granted | Runtime error shown verbatim-safe |
| Needs connection | Plugin tool depends on an unauthenticated app | "Needs connection: <app> (not signed in)"; next action "Connect" | N/A |
| Expired | Connection expired or revoked | "Connection expired — sign in again"; no fallback | N/A |
| Remote MCP blocked | Host not on `allowed_domains` | Add refused, or listed not callable, with host named | N/A |
| Local MCP | Policy disallows local servers | Add refused with rule named | N/A |
| Local MCP allowed | Policy allows; user confirms outside-sandbox text | Added; listed "Runs on this device outside the Task sandbox" | Without confirmation: refused |
| Disable | User disables an enabled MCP server | Not callable after re-read; reason "Disabled by you" | N/A |
| Provider sign-in | Codex or ChatGPT sign-in completes | Separate provider block; Workspace and membership state unchanged | N/A |
| Sign-in cancelled | User cancels a runtime-owned MCP OAuth login before completion | Cancellation wins atomically against local credential persistence; late completion cannot store credentials after successful cancellation; if completion already won, report that actual state rather than falsely claiming cancellation | Runtime cancellation failure is explicit |
| Hosted app handoff | User opens provider-hosted sign-in or closes the local handoff | Clearly labelled browser handoff; status re-read from runtime; closing local UI makes no claim that provider authorization was cancelled or credentials removed | Unknown/unavailable status is labelled honestly |
| Runtime unavailable | Runtime stopped | Inventory "Unavailable — runtime not running"; no stale data as current | N/A |

</frozen-after-approval>

## Code Map

- `engine/codex-rs/inquello-domain/src/execution_policy/section.rs` -- the `allow_local_mcp_servers` field and its validation, plus the service wire.
- `engine/codex-rs/app-server/src/request_processors/mcp_processor.rs`, its protocol and runtime OAuth helpers -- runtime-owned cancellable login lifecycle and persistence arbitration; isolated regression tests.
- `desktop/src/main/` -- a new `capabilities/` mediator: inventory assembly, management operations, notification handling and policy gating.
- `desktop/src/main/security/operations.ts` and `preload` -- the operations.
- `desktop/src/renderer/Capabilities.tsx` (S07) -- inventory UI, management controls, provider block.
- `desktop/src/main/smoke-probe.ts` -- a `capabilities` report.

## Tasks & Acceptance

**Execution:**
- [ ] Policy field (domain, service wire, fixtures), with tests.
- [ ] Main capabilities mediator: inventory, callable rules, management through runtime methods with policy gating, and a re-read after each change.
- [ ] S07 inventory and management UI, the provider block, and jsdom tests for every matrix row.
- [ ] Integration tests against the real runtime:
  - the inventory lists;
  - a policy refusal;
  - an MCP server add and remove, using a local fixture HTTP server or a policy-permitted stdio fixture inside the test;
  - an enable and disable round trip;
  - a provider sign-in leaves Workspace state unchanged.
- [ ] Smoke `capabilities` report, with the default seed:
  - the inventory renders by kind;
  - built-in tools are listed;
  - marketplace plugins (if synced) show as blocked by policy, with the rule named;
  - plugin install is refused with the rule named;
  - the provider block is separate from the Inquello identity.
- [ ] `sprint-status.yaml` (1-21).

**Acceptance Criteria:**
- Given the smoke with the seeded topology, when it runs, then `capabilities` and every earlier report are ok, and it exits 0.

## Verification

**Commands:**
- In `engine/codex-rs` (`-j 4`, `CARGO_INCREMENTAL=0`): `inquello-domain` and `inquello-service` tests (with the database URL), clippy; the two builds run separately -- expected: pass, clean
- In `desktop/`: `pnpm generate:protocol` (if the engine changed), `pnpm run build`, `pnpm test` with the database URL -- expected: all pass
- Keyring smoke with the seeded topology -- expected: exit 0, all reports ok

## Resume validation note (2026-10-30)

The owner authorized resuming the next story after publishing the focused review fixes. The baseline above includes those fixes; preserve them. The existing handoff partial patch is prior unfinished work, not an applied or validated implementation. Inspect it against current files before reuse.

The owner explicitly permits recording validations unavailable in this environment for later execution in their environment. Record actual commands/results and every blocked or unrun check; do not count skipped tests as passes, change frozen expectations, or claim all acceptance gates are complete without evidence. No new dependencies. The current workspace is a materialized source snapshot with desktop dependencies but without a built runtime, Rust toolchain, database topology, full Git metadata or every generated/reference asset. Use available local tests and pinned repository source access; document limitations rather than fabricate results.

Implementation remains local in this workflow: no push, merge or deployment. Keep R5–R8/R10 review work outside this story unless an unavoidable dependency is explicitly documented.

## Spec Change Log

- 2026-10-30 09:34 UTC — Owner approved the clarification after pinned source inspection found no MCP cancellation RPC and only provider-hosted app install URLs: genuine cancellation for runtime-owned MCP OAuth; explicit labelled browser handoff plus status re-read for hosted apps, without remote cancellation/credential revocation promises. Corresponding frozen constraints and matrix rows updated narrowly. Owner approval message: Sentinel_ef8515fc8e2c819193fd744f148cf015.

## Local implementation and verification (2026-10-30)

Implementation is **in progress**, not acceptance-complete. No push, merge, deployment, model run, new dependency, or marketplace-sync change was made.

### Authored implementation

- Domain/service execution policy now carries `allow_local_mcp_servers`, denied by default and validated as boolean; enabling requires MCP tools allowed. Effective policy attribution and desktop wire/setting presentation include it.
- Main `capabilities/` projects runtime-owned catalog/config/account state into credential-free entries; policy is reread for each management action. Built-ins use the Story 1.19 probe state and reach, never a fabricated successful probe. MCP status discovery is targeted only at policy-permitted, known transports because discovery itself may launch a process/contact an endpoint. Unknown hosted-app connection identity/endpoint remains explicitly not callable. Plugin metadata is supplemented by targeted runtime status guarded against the actual source and current transport before discovery; unknown remote catalog metadata is never used as an execution grant.
- Named validated preload operations, fixed notification subscription (no IPC event or payload reaches renderer), explicit refresh and 30-second reconciliation; grouped S07 inventory, target-named controls, exact local-program confirmation, separate provider block. Runtime configuration forces MCP OAuth to keyring storage, in addition to existing provider protections.
- Runtime-owned MCP OAuth cancellation API: `mcpServer/oauth/cancel {name, loginId}` -> `cancelled | completed | failed | notFound`. Exact attempt selection and credential-persistence arbitration prevent successful cancellation from being followed by a late write. Hosted app connection is labelled browser handoff, not remote cancellation or confirmed authentication.
- `plugin/install` gains optional `skipAuthentication` and `mcpAdmission`; Inquello sends both. Local/remote automatic or silent OAuth onboarding is not started by installation. Runtime admission inspects the actual private staged bundle before cache activation, configuration enablement and provider installation, closing catalog/download races. Enable uses this same admitted installation path rather than an unchecked config enable write. Local plugin MCP programs require explicit outside-sandbox confirmation.
- Smoke `capabilities` report is wired into the existing all-reports exit gate. Real-runtime integration tests and isolated cancellation race tests are authored, not executed here.

### Executed checks and limitations

- `pnpm run build`: passed. Vite warns five IBM Plex font assets are missing from this materialized snapshot; browser layout/font fidelity is not verified.
- Main/full desktop TypeScript and renderer TypeScript no-emit checks passed.
- Focused desktop policy, wire, provider, capabilities, data-policy and security tests: **412 passed across 8 files** after the startup-persistence and plugin-admission fixes. Log: `validation/story121-focused.log`.
- Full `pnpm test`: **failed**, 34 files passed, 11 failed, 1 skipped; 920 tests passed, 3 failed, 5 skipped in that run. Eight integration suites (including the new capabilities suite) cannot collect without `codex-app-server`; design/reference-logo assets are missing; schema tests require Git metadata and all 816 generated files (snapshot has 48). These are not counted as passes. Log: `validation/story121-full-test.log`.
- `pnpm generate:protocol`: **failed** at `git rev-parse HEAD:engine` because the snapshot has no Git metadata. Generated bindings/schema/stamp have not been fabricated or updated. Log: `validation/story121-generate.log`.
- `cargo` is unavailable. Domain/service tests, Rust formatting/clippy, app-server/rmcp cancellation tests and separate binary builds remain **unrun**. No database topology is available.
- Native/keyring seeded smoke and real-runtime integration remain **unrun**. No real external credentials or authorization grants were used. Real-runtime cancellation/persistence race behavior must be established in the owner's build environment, not inferred from source review.
- Available pnpm is 11.25.0 rather than the repository's pinned 10.34.5; no dependency installation was performed.

### Honest remaining limits

- The pinned hosted-app metadata reports accessibility, not an authenticated connection identity, expiry/revocation, or guaranteed effective endpoint. Those app entries remain not callable with the missing runtime evidence named, even after browser handoff. No connection fallback is attempted.
- Plugin-owned MCP dependencies use composite display IDs and exact runtime names plus `expectedPluginId` and current `mcpAdmission`. Runtime verifies effective source and transport before discovery or OAuth; collisions are shown per entry with no fallback. Remote catalogs that expose only names can be installed through actual-staged-content admission, then resolved through guarded status. HTTP header-helper transports, plugin hooks, malformed/uninspectable bundles and guarded thread-scoped requests are deliberately refused; S07 uses threadless management.
- Restart persistence was repaired after source review: existing regular runtime configuration is preserved, unsafe non-regular files refused, and production startup passes fixed `-c` overrides. A readiness gate reads effective configuration and refuses legacy managed conflicts before provider/tool operations become available. Unit preservation/enforcement tests pass; actual runtime restart persistence remains covered by an authored, unrun integration test.
- No acceptance checkbox or sprint completion status is advanced on the strength of blocked/skipped checks. `sprint-status.yaml` remains `in-progress`.

### Final integration refinements before review

- Access-reducing cancellation remains possible after policy tightens; exact pending-attempt cancellation does not require permission to start/use tools. Disable/remove/uninstall retain Workspace authority checks but do not require an allowed tool/extension kind.
- Identity/provider logout and runtime transitions quiesce capability changes, resolve pending runtime-owned login attempts, and clear connection tracking. Unknown startup outcomes force runtime termination instead of claiming cancellation. Hosted browser handoff is never claimed remotely cancelled.
- Dedicated lifecycle epochs prevent an old delayed policy/RPC result from acting on a replacement runtime or opening a browser. Runtime terminal states invalidate the renderer inventory immediately. Completion before login response and delayed response during logout are regression-tested.
- Remote marketplace requests use the verified `remotePluginId`, not a human-readable name. Structured runtime admission errors map to fixed, named rules without forwarding raw runtime messages or credentials.
- Supplementary prior-fix verification is recorded separately in `validation/story121-prior-fixes-regression.log` (76 tests); it is not added to the focused total.

## Pre-review task and matrix audit

The implementation and authored tests are submitted for independent review, not acceptance completion. Desktop unit/jsdom coverage executes the default-policy, built-in, install/refusal, connection-state display, host/local admission, disable, cancellation projection, hosted handoff and runtime-unavailable rows. Actual credential-write arbitration, real provider independence, staged-plugin native admission and seeded smoke remain unrun because the Rust runtime/topology/keyring prerequisites are unavailable. These missing execution gates are retained under the owner’s explicit permission to document unavailable validation; no unchecked task is represented as completed. Protocol regeneration remains required, not merely an optional test.


## Review Triage Log

Round 1, 2026-10-30. Each finding was graded before grouping. Likelihood is relative to ordinary supported use (low = uncommon preconditions, medium = plausible concurrent/error path, high = readily encountered); impact measures user harm. Source analysis is not an executed native reproduction. Verification-layer gaps are accepted from their cited test inspection, not represented as runtime failures.

| ID | Verdict | Evidence and likelihood / impact | Route |
| --- | --- | --- | --- |
| B1 | high | New cancel/admission protocol declarations have no regenerated bindings/schema/stamp; generator requires clean Git engine tree and matching built binaries, all absent here. Likelihood high when building this revision; impact high: incomplete deliverable/contract verification. | bad_spec; required build work remains blocked, never hand-stamp |
| B2 | medium | service snapshot wraps app/list, app/installed, app/read and plugin catalog reads in a single catch that returns empty unavailable inventory. change requires available snapshot even for disable/remove. Likelihood medium (catalog outage); impact medium (unrelated local management blocked). | bad_spec |
| B3 | high | CapabilityInventory manage has no captured generation comparison on response; its closure checks old workspaceId and can replace current view after a switch. Pending confirmation also retains old Workspace request. Likelihood medium (switch during RPC); impact high (wrong Workspace display/action). | bad_spec |
| B4 | medium | load returns immediately while loading/mutating; notifications and new-Workspace initial load are discarded, not queued. Likelihood medium; impact medium (stale presentation until polling). | bad_spec |
| B5 | high | Every renderer action is disabled when current=false; plugin MCP cancel action is added only inside permitted successful discovery. Exact service cancellation supports policy loss but becomes unreachable. Likelihood medium (policy/outage during login); impact high (cannot stop pending credentials). | bad_spec |
| B6 | medium | unresolvedLoginStarts.add precedes login RPC; only successful loginId removes it. Structured admission refusal returns via catch without removal. Likelihood medium; impact medium (retry falsely requires restart). Preserve truly ambiguous transport outcomes. | patch, moot under loopback |
| B7 | false | Normal identity sign-in errors are caught in IdentitySession.signIn; principal rebinding catches errors; Codex logout and account refresh catch RPC failures and return outcomes. Reviewer did not identify a reachable exceptional rejection beyond these guards. A hypothetical arbitrary throw is not evidence of the claimed normal error-path defect. | reject |
| B8 | medium | rules.ts records blocked from kind-level policy only; local/host refusal changes reason but not effective_permission. Likelihood high for denied entries; impact medium (contradictory policy explanation). | patch, moot under loopback |
| B9 | high | Skill dependency type is discarded; all.find matches first app/MCP ID. Apps are inserted first; plugin MCP IDs are composite. Collision can select another connected capability and misreport callable. Likelihood low-to-medium (collision/plugin dependency); impact high (wrong connection identity). | bad_spec |
| B10 | high | Only remove resolves pending login. Disable and plugin uninstall/disable proceed without cancelling dependent OAuth; persistence gate remains pending and may subsequently write credentials. Likelihood medium (disable during browser login); impact high (authorization outlives removal of capability). | bad_spec |
| E1 | high | Same concrete plugin cancel-placement path as B5; policy refusal skips discovery and leaves actions empty despite tracked pending attempt. Likelihood medium; impact high. | bad_spec |
| E2 | medium | Same concrete dropped notification/load guard as B4. The reviewer guard snippet is proposed correction, not existing code. Likelihood medium; impact medium. | bad_spec |
| E3 | medium | manifest resolver explicitly maps Invalid mcpServers to None; inspect then treats absent .mcp.json as empty. Malformed declaration passes inspection, although it does not itself execute a forbidden server. Likelihood low; impact medium (false successful strict inspection). | bad_spec |
| E4 | medium | Same contradiction as B8, independently checked. Likelihood high; impact medium. | patch, moot under loopback |
| E5 | medium | next_action is null for policy blocks/dependency missing/unknown connection/sandbox unknown despite intent requiring actionable explanations. Likelihood high; impact medium (user cannot determine safe next step). | patch, moot under loopback |
| V1 | high | Filed regression gap: helper cancellation tests and mocked desktop do not traverse actual login/cancel handler wiring; replacing registered control would escape coverage. Likelihood medium of future regression; impact high (false cancellation then credential write). | bad_spec |
| V2 | high | Filed regression gap: runtime install tests pass skipAuthentication=false; true is only tested in helper/mock, so production forwarding is not covered. Likelihood medium of regression; impact high (authentication on install). | bad_spec |
| V3 | high | Filed regression gap: guarded store tested directly; actual local/remote plugin/install tests supply no admission. Dropping forwarding would pass existing tests. Likelihood medium of regression; impact high (forbidden actual bundle activated). | bad_spec |

Groups: B4+E2 (refresh invalidation); B5+E1 (revocation controls); B8+E4 (permission projection). All other claims retain distinct causes. No intent gap: approved frozen intent already settles them. Nontrivial fixes and boundary tests require a bad_spec loopback; lower patch entries are included in the corrected derivation, not independently patched.

## Round 1 corrected implementation plan

Work sequentially from the pinned baseline. The archived reviewed candidate at `/tmp/story121-review-stage-20261030/b` is a local implementation reference only, not an accepted result. After the coordinator reverts code, re-derive from this spec; reuse correct portions as appropriate, but do not blindly restore the known-bad implementation. No remote operations, new dependencies, real credentials or grants. No frozen-intent changes.

KEEP: domain policy defaults/validation and wire attribution; actual staged-bundle admission before publication; explicit no-auto-auth installation; exact-source targeted MCP discovery; runtime cancellation/persistence arbitration; runtime configuration preservation and keyring readiness enforcement; identity/runtime epoch isolation; explicit hosted browser handoff without authentication/revocation claims; existing focused recovery fixes in baseline; safe errors, smoke gates, isolated fixtures, truthful unrun status.

Correct the non-frozen plan as follows:
1. Inventory failures are per source/kind, not blanket loss. Preserve successfully read built-ins/configured servers and access-reducing management. Represent unavailable catalogs honestly; never infer absence or authorize mutations using unknown targets. Cancellation projection comes directly from exact tracked attempts even with policy/catalog failure, without granting a start/use action.
2. Renderer requests are scoped to current Workspace and generation. Never apply obsolete management/load results. Workspace change clears pending confirmations/form authority; dropped invalidations are queued and rerun after current work. Mark known invalidated snapshots stale immediately. Keep exact pending cancellation reachable without current discovery; no stale start/enable/install.
3. Pending OAuth lifetime is explicit: definitive pre-start refusal clears unresolved-start state, ambiguous disconnect keeps it. Disabling/removing a server or disabling/uninstalling its plugin resolves all owned pending attempts first; ambiguous cleanup blocks the access change or uses a documented safe runtime stop, never claims success. Cancellation must not affect another Workspace/attempt. Test late completion and policy-loss UI paths.
4. Dependency resolution retains declared kind and exact identity. App/MCP collisions must not select the first match; plugin-owned MCP dependencies resolve to the exact source or remain unavailable, never silently fall back. Effective permission includes host/local restrictions and dependency policy; next actions are truthful human guidance when a direct button cannot safely act.
5. Strict staged admission rejects malformed declared MCP configuration rather than silently converting it to no dependencies. Inspect runtime manifest semantics and add isolated malformed-field cases; no claim this malformed-input case alone executes a server.
6. Add actual app-server RPC-boundary tests for login/cancel with late callback/no persistence and stale IDs, plugin install skipAuthentication true for local and remote, and restrictive admission forwarded to actual local/remote staged content. Use existing isolated fixtures. Author these even when native execution is unavailable; do not relabel helper-only tests as boundary tests.
7. Protocol regeneration is required remaining build work, not a passing validation. Use real generator only if supported prerequisites exist. Do not manufacture Git tree hashes, generated files, schema counts, or stamps. Record exact commands to build matching binaries, commit reviewed engine changes in owner's environment, regenerate, and verify. If unavailable, report this as an explicit open completion blocker alongside Rust/native gates; do not mark story done.
8. Add focused tests for all reachable corrected paths, run relevant desktop tests/build, report exact results and limitations. Preserve original matrix expectations; do not weaken tests to pass.

## Spec Change Log — review loop 1

2026-10-30 10:38 UTC: all three review layers completed. B2–B5/B9–B10/E3 and V1–V3 exposed insufficient non-frozen lifecycle, failure-isolation, identity-resolution and boundary-test planning. Added explicit derivation constraints above, including protocol-generation prerequisite handling. Known-bad states avoided: cross-Workspace stale UI/actions, lost revocation controls, authorization surviving disable/uninstall, wrong dependency identity, catalog-wide outage, malformed declaration accepted, and helper-only verification mistaken for boundary coverage. KEEP instructions recorded before code reversion. Frozen intent unchanged. Earlier verification evidence describes round 0 only until rerun; it is not evidence for the corrected tree.


## Review loop 1 implementation and verification (2026-10-30)

Corrected source is frozen for independent review, **not acceptance-complete**. Frozen intent and task checkboxes are unchanged; sprint status remains `in-progress`. No push, merge, deployment, model run, dependency installation, real credential use, marketplace-sync change, or generated-artifact fabrication occurred.

### Corrected implementation

- Inventory failures are isolated by source. Successfully read built-ins/configuration/catalogs survive unrelated outages. Unknown install/enablement state is labelled unavailable, never treated as evidence of absence or a successful change. Post-change verification requires a successful read of the authoritative source.
- Exact tracked OAuth attempts remain cancellable despite policy/catalog failure. Definitive start refusals clear unresolved-start tracking; ambiguous transport outcomes do not. Server disable/remove and owning-plugin disable/uninstall resolve pending attempts first; unresolved or other-Workspace attempts block the change.
- Renderer reads, mutations, confirmations and forms are Workspace-scoped. Obsolete results cannot replace a new Workspace. Invalidation immediately marks prior data stale and queues reconciliation after active work. Cancellation remains reachable without enabling stale access-granting actions.
- Dependencies retain kind and exact identity; collisions and unresolved plugin-owned identities never fall back to an app or another server. Effective permission includes host/local/dependency and built-in read-only restrictions; unavailable states offer honest next-step guidance.
- Strict staged admission rejects malformed declared legacy MCP configuration instead of treating it as absent. Actual app-server RPC-boundary tests cover local/remote install authentication suppression, staged-content policy refusal, and OAuth cancellation with delayed callback/token completion, stale IDs and a positive persistence control. These native tests are authored but unrun.
- Inspected KEEP portions retain default-deny local-MCP policy/wire, staged admission, credential arbitration, startup config preservation/keyring enforcement, provider separation, validated preload operations and smoke exit gates.

### Executed checks on corrected tree

- `cd desktop && pnpm run build`: **passed**. Five IBM Plex font assets remain missing in this snapshot; visual/native UI fidelity is not established. [Build log](validation/story121-loop1-build.log).
- `pnpm exec tsc --noEmit -p tsconfig.json`: **passed**; build also includes main and renderer TypeScript checks. [Types log](validation/story121-loop1-types.log).
- Focused `pnpm exec vitest run --configLoader runner` for capabilities unit/shell, provider units, security, policy unit/shell, identity wire and data policy: **443 passed across 8 files**, including 92 capabilities tests. [Focused log](validation/story121-loop1-focused.log).
- `pnpm test`: **exit 1**, 34 files passed, 11 failed, 1 skipped; **951 tests passed, 3 failed, 5 skipped**. Eight integration suites (including capabilities) cannot collect without the runtime; design/reference assets are missing; schema checks require Git metadata and the complete 816-file generated tree (snapshot has 48). Failures/skips are not acceptance passes. [Full-suite log](validation/story121-loop1-full-test.log).
- `pnpm generate:protocol`: **exit 1** at `git status --porcelain -- engine` (not a Git repository). Generated bindings/schema/stamp remain untouched and a required completion blocker. [Generator log](validation/story121-loop1-generate.log).
- Native attempted command failed with **`cargo: command not found`**. Rust domain/service/app-server/rmcp tests, clippy/fmt, builds, real-runtime integration and seeded keyring smoke remain **unrun**. No database topology or matching runtime exists here. [Native prerequisite log](validation/story121-loop1-native.log).
- Available pnpm is 11.25.0, not pinned 10.34.5; no dependency install was attempted. An earlier accidental full-suite invocation during renderer work was interrupted, not counted as verification.

### Required owner-environment completion

Use the exact native/build/commit/regeneration sequence documented under `FORK-CUT.md` → “Story 1.21 remaining native/protocol completion gate” in the complete checkout with pinned toolchain and isolated topology. Regenerate protocol/schema fixtures from the actual reviewed runtime sources using the repository generator, never by hand. Then run full desktop integration and seeded keyring smoke; every earlier report and `capabilities` must pass. Rust compilation and boundary-test behavior are not inferred from source inspection. Remaining hosted-app metadata uncertainty continues to be displayed as not callable rather than guessed authentication.

### Review Triage Log — round 2

All three independent layers completed before triage. Each row below was classified individually before grouping. Ratings use the round-1 likelihood/impact rubric. Existing B1 generation blocker remains open under the owner's documented environment limitation; no generation pass is claimed.

| ID | Verdict | Verified evidence; likelihood / impact | Route |
| --- | --- | --- | --- |
| R2-B1 | high | service converts explicit null admission plus empty declarations to []; later empty dependency every() clears unknown evidence. Runtime protocol defines null as inspection unavailable. Medium likelihood for unreadable plugin; high impact: false callable claim. | patch: preserve explicit null and its refusal |
| R2-B2 | high | SkillMetadata carries pluginId; service ignores it when mapping MCP names, allowing a same-name config registration to satisfy a plugin-owned skill. Low-to-medium likelihood; high impact: wrong dependency identity. | patch: qualify existing dependency reference by known owner |
| R2-B3 | medium | Config enable uses local/host projection only; actual config with http_headers_helper is rejected by discovery but still offers enable and writes true. Medium likelihood for such registrations; medium impact: activation contradicts admission. No model thread is enabled in this story. | patch: refuse enabling concretely unsupported config transports/helpers |
| R2-B4 | false | Frozen intent requires outside-sandbox confirmation before adding local servers, not a second persistent confirmation for every discovery of existing registrations. Add checks confirmation and policy; guarded discovery checks actual transport and current policy. A new confirmation ledger for imported/config-edited registrations is not the approved requirement. | reject |
| R2-B5 | medium | manage rejects its whole response when a notification increments revision in the same Workspace, dropping explanatory outcome alongside obsolete inventory. Medium likelihood because changes emit notifications; medium impact: cancellation/handoff warning hidden. | patch: retain same-scope outcome notice while independently rejecting stale inventory |
| R2-B6 | medium | codexLogout stops runtime after unresolved cleanup, then underlying logout returns runtimeDown without removing credentials. Low likelihood (ambiguous cleanup); medium impact: no actionable provider logout continuation. | patch: give explicit safe recovery continuation and no false credential-removal claim; do not silently restart/re-authorize |
| R2-B7 | medium | identity signOut never resumes after a normal unsuccessful result whose status remains signed-in (prepareLogout service failure). Medium likelihood; medium impact: tools paused until restart despite unchanged identity. This is not round-1 B7's rejected hypothetical throw. | patch: resume only proven unchanged signed-in transition, not pending/uncertain logout |
| R2-B8 | high | obj/list coercion followed by known.add accepts missing config/apps/marketplaces as empty authoritative source; removal/uninstall verification can then return true. Low likelihood for malformed native response; high impact: false confirmation of access removal. | patch: validate required source containers before recording known |
| R2-B9 | medium | skills/list returns per-entry errors which service ignores; RPC success alone presents missing skills without identifying discovery failure. Medium likelihood; medium impact: dishonest completeness. | patch: surface fixed sanitized incomplete-source guidance |
| R2-B10 | low | Local confirmation remains true after command/argument edits. The user explicitly edits the form, but confirmation no longer corresponds to displayed program. Medium likelihood; low impact. Direct reset needs no new state or public surface. | patch: reset existing checkbox on edits |
| R2-E1 | high | Final policy reread checks input.kind=mcp_server but not target.extensionOwned; extensions denial between discovery/login is missed while tools remain allowed. Low-to-medium likelihood; high impact: start under newly denied extension rule. | patch: include existing owner-kind policy in final guard |
| R2-E2 | medium | app projection loops catalog only even when installed apps are successfully returned; installed-only app is omitted and cannot be disabled. Medium likelihood for retired/unlisted apps; medium impact: management missing. | patch: union installed identities with catalog, retain unknown metadata |
| R2-E3 | high | Same source-coercion issue as R2-B8, independently verified at config/apps reads. Low likelihood; high impact. | patch |
| R2-E4 | high | Capabilities.tsx filters policy=null before mounting inventory, so service's cancellation-only fallback is not reachable during per-Workspace policy failure. Medium likelihood; high impact: missing revocation control. | patch: retain inventory for known Workspace, main enforces authority |
| R2-V1 | high | Pre-verified gap: admit_mcp_target helper and fake desktop tests do not prove actual status/login processors invoke admission before side effects. Medium regression likelihood; high impact: prohibited endpoint/process or wrong identity contacted. | patch: extend existing native fixture through both RPC entry points |

Grouping: R2-B8 + R2-E3 share source-response coercion; all other surviving findings have distinct causes. Fixes reuse existing operations, state, fixture boundaries and demonstrated guards; no new public API or uncertain-state guard is needed. They therefore route to patch rather than another derivation loop. Native boundary tests remain authored/unrun until the owner toolchain is available.


## Final local handoff — 2026-10-30

Both independent review rounds completed all three layers. Round-1 corrected derivation and round-2 localized patches are implemented; rejected findings retain their individual rationale above. Patched paths were inspected against the staged diff and rerun. Marketplace-load-error incompleteness was included in R2-B8/E3, preserving positive rows but never inferring successful removal from absent unreadable entries. No new public runtime API was added by the localized patch round.

Final verification: `pnpm run build` and full main/renderer TypeScript passed. Focused tests: **473 passed / 9 files**. Full `pnpm test`: **exit 1; 981 passed, 3 failed, 5 skipped; 35 passing files, 11 failed files, 1 skipped file**. The nine collection failures are eight missing-runtime integration suites and missing design reference icons. The three test failures are missing logo reference SVG, absent Git engine-tree metadata, and 48 generated files versus the stamp's 816. These remain failures, not assumed passes. Logs: `validation/story121-final-{build,types,focused,full-test}.log`. A separate earlier post-derivation regression run passed 168 tests across seven capability/recovery/permission/lifecycle files; it overlaps focused coverage and is not added to the final total.

Round-2 targeted patch verification passed 129 tests across four edited-surface suites. Native guarded status/login, cancellation and plugin-install boundary tests are authored but **unrun**, not verified outcomes. No Rust toolchain, matching binaries, database topology or native/keyring smoke is available. Genuine protocol generation remains a required build-completion blocker.

The BMAD presentation step's automatic done/commit transition is intentionally withheld: the owner accepted documented unavailable validation, not fabricated native success or completed generated artifacts. This snapshot has no Git metadata, so no local story commit was created. Story and tracker remain **in-progress**; no Story 1.21 push/merge/deployment occurred. The previously published focused fixes at 3c7b4e9 are preserved. R5–R8/R10 from the earlier review remain separate work.
