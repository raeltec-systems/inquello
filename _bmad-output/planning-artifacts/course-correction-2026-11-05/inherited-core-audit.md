# Inherited Codex core: source audit

Date: 2026-11-05. Read-only source investigation; no builds, tests, installs, downloads, service calls, code edits, commits or story-status changes. This new analysis file is the sole write.

## Conclusion

The fork supplies substantial working implementations, not just architectural inspiration: CLI/exec, app-server, SDKs, history/fork/resume/compaction, subagents, MCP, skills, hooks and realtime transport code are present. Preserving every compatible inherited capability is a coherent product requirement. It is not equivalent to proving that every current Codex-branded desktop/cloud feature, model or hosted service is already usable in Inquello. Track source inheritance, Inquello exposure, authorization, external dependencies and measured runtime evidence separately. Do not infer implementation absence from a future story label or silently reduce V1 scope.

## Exact cut and comparison

- Device repository: `D:\Projects\inquello`; verified branch `feat/epic-1-secure-private-desktop`, HEAD `c407483170e93ad9bea0f2d1c36e9d32693b0c44`.
- `FORK-CUT.md:7–19`: public `https://github.com/openai/codex`, tag `rust-v0.165.0`, tag object `e374836b2728d9b7aa981c2902649e640a2edaa8`, upstream commit `360319d8dee62d87e2d59fc0c21805d79519cfed`, upstream tree `307e4fa207fe563a11f3f7af09cee6fccd2d8376`; Apache-2.0.
- Local object checks, without fetch: squash `86c177429bbc13bc689650667d2ac9dca5e716cc^{tree}` and import merge `5aceac53db54c6f1a4413a7dc909b38b8dfde345:fork` both resolve to that exact tree. HEAD engine tree is `36b40fe2ea3f578e2a8a1cd334a809d61aea2b9f`: intentionally patched, not tree-identical today.
- `AGENTS.md` requires preserving engine except approved story changes; `FORK-CUT.md:143` identifies first upstream-crate patch. Its later patch records distinguish Inquello additions from inherited machinery.
- Comparison used local `git diff <import>:fork HEAD:engine` and direct `git show` of imported files. In the inspected paths, CLI, SDKs, feature registry, thread manager, realtime conversation, hook runtime and multi-agent handlers have no committed differences from import. `compact.rs` has one new refusal call; provider-info adds Messages and disables its automatic retries. Other engine files have deliberate integration changes. This is a scoped comparison, not an assertion the whole engine is unchanged.

## Eight concrete source chains

All paths below are relative to repository root. Line anchors refer to inspected working files at the stated HEAD. No fresh runtime test is claimed for any row.

### 1. CLI and noninteractive exec

- Inherited implementation: `engine/codex-rs/cli/src/main.rs:159,171,177,210,231` exposes exec, MCP management, app-server, resume and fork; `:1165–1179` actually dispatches to `codex_exec::run_main`.
- Availability: compiled executable, compatible host execution/sandbox, model credentials and configuration are still needed. CLI existence does not prove the desktop exposes every switch.
- Inquello wiring: desktop primarily uses app-server, not the TypeScript exec wrapper. Direct CLI release packaging and all CLI paths were not qualified in this audit.

### 2. App-server and SDK embedding

- Inherited implementation: CLI app-server dispatch at `engine/codex-rs/cli/src/main.rs:1250–1332`; protocol requests in `engine/codex-rs/app-server-protocol/src/protocol/common.rs`.
- TypeScript SDK: `engine/sdk/typescript/src/codex.ts:25–37` starts/resumes threads; `exec.ts:95,203` launches `exec --experimental-json` and spawns its binary.
- Python SDK: `engine/sdk/python/src/openai_codex/client.py:215,256` is a typed JSON-RPC stdio app-server client; `:485–511` implements resume/fork.
- Inquello actual wiring: `desktop/src/main/main.ts:22,345–354` owns/starts codex-app-server; `desktop/src/main/runtime/process.ts:127–189` owns its child/handshake/error path; `runtime/binary.ts:35–60` selects packaged/dev binary and refuses missing binaries.
- External dependency: local source-matched native binary and supported desktop process environment. Python generated support for added Inquello methods is not implied by inherited SDK presence (`FORK-CUT.md:149` records original schema-generation limitation).

### 3. Resume and fork

- Inherited API: `engine/codex-rs/app-server-protocol/src/protocol/common.rs:562,568` declares thread/resume and thread/fork.
- Implementation: `engine/codex-rs/core/src/thread_manager.rs:1289,1345,1557,1591–1641` resumes rollout/history and forks threads; these inspected implementations are unchanged from import.
- Inquello boundary: `engine/codex-rs/app-server/src/request_processors/inquello_tasks.rs:2300–2339` intercepts generic thread/turn methods when working-store integration is active, rejects arbitrary cold resumes/forks, and directs callers to bound private Task operations. `message_processor.rs:1478` invokes this guard.
- Meaning: retain/reuse these primitives through correct Task ownership and history rules. Generic raw APIs are not automatically equivalent to permitted private-Task UX. Bound private Task lifecycle exists separately; this audit does not declare resume absent.

### 4. Compaction

- Inherited code: `engine/codex-rs/core/src/compact.rs:117,154` implements inline automatic and explicit compaction tasks; protocol `common.rs:757` declares thread/compact/start.
- Exact patch: import-to-HEAD diff adds only `crate::inquello_inference::refuse_unbound_background(&sess.thread_id.to_string())?` at `compact.rs:185`.
- Inquello configuration: `inquello_tasks.rs:695` explicitly says background compaction, memory summarization and model warmup are unavailable for private Tasks; generic compact request is also outside the retained-request allowlist above.
- Meaning: real inherited implementation, deliberately constrained integration. Enabling it requires scoped model authorization/history/receipt treatment, not rebuilding compaction from nothing. Model/service availability still matters.

### 5. Subagents

- Inherited handlers: `engine/codex-rs/core/src/tools/handlers/multi_agents/spawn.rs:31–53` declares and dispatches spawn_agent; `multi_agents/send_input.rs:13–22,98` sends input. `tools/spec_plan.rs:35–51` imports both V1 and V2 handler families.
- Actual gate: `tools/spec_plan.rs:729–744` checks selected multi-agent version, V1 spawn-depth limit, V2 disable_native_tools and model metadata. `features/src/lib.rs:1534–1549` marks V2 stable but default-disabled and V2 dynamic tools under development/default-disabled.
- Inquello exposure: current private Task startup permits only exec_command, inquello_progress and request_user_input through ToolPolicy (`app-server/src/request_processors/thread_processor.rs:7626–7635`). Enforced registry filtering excludes multi-agent tools, regardless of a multi-agent feature being otherwise enabled (see verified enforcement chain in the addendum). Source inheritance is confirmed; private Task subagent invocation is currently restricted, not automatically shipped.
- Dependency: available model route and resources, configured concurrency/depth, tool/sandbox/authorization inherited by children.

### 6. MCP and skills

- Inherited MCP runtime: `engine/codex-rs/core/src/mcp.rs:113–177,517–523` defines McpManager and resolves runtime config/configured servers; protocol `common.rs:1293` exposes resource read; `app-server/src/message_processor.rs:2150` dispatches server-status listing.
- Inherited skills: `core/src/skills.rs:47–73` derives filesystem-owned discovery inputs, plugin roots/snapshots and config layers; protocol `common.rs:917`, processor `message_processor.rs:1979` expose/list skills.
- Inquello additions: `FORK-CUT.md:208–214` documents capability management, copied-content admission and source/transport checks for MCP/plugin install/enable/login, retaining legacy upstream callers when admission is omitted.
- Dependency: actual skill files or MCP servers, credentials, installed tools, network access and approved plugin/admission rules. Inheriting the client does not inherit all third-party servers or commercial connectors. Every connector/private Task invocation was not runtime-qualified here.

### 7. Hooks

- Inherited implementation: `engine/codex-rs/core/src/hook_runtime.rs:129,193,269,315,374,454,498,546,588,1112` implements session start/end, pre/post tool use, permission requests, stop/interrupt, pre/post compact and model-request hooks.
- Gate: `engine/codex-rs/features/src/lib.rs:1403–1407` marks hooks stable/default-enabled. `core/src/session/mod.rs:5747` passes effective CodexHooks enablement; `session/environment.rs:103` checks the feature.
- Inquello invocation/exposure: no comprehensive private Task hook admission or UX qualification made here. Hook definitions, commands/MCP targets, trust and runtime policy are dependencies. Default-enabled infrastructure is not evidence that any particular hook is installed or permitted.

### 8. Provider routes and realtime/voice

- Exact inherited transport fact: direct inspection of imported `codex-rs/model-provider-info/src/lib.rs:112–140` shows WireApi had Responses only and explicitly rejected chat. Original ModelProviderInfo already supplied base URL/model catalog, env key, command auth, gateway OAuth, AWS SigV4, headers, retry settings and WebSocket capabilities.
- Current anchors: `engine/codex-rs/model-provider-info/src/lib.rs:156–209`; Bedrock/GCP constructors `:586–658` still select Responses. Configuration breadth is real, but it does not prove arbitrary native provider APIs are supported. A provider must implement the compatible route or an adapter/gateway must translate it, with supported auth/model/service access.
- Added by Inquello: import-to-HEAD diff adds WireApi::Messages at `:116–117`, deserialization at `:138`, and zero retry handling at `:512,522`. `FORK-CUT.md:374–382` records CR-1 contracts, native Anthropic Messages request/SSE translation, scoped auth and no Messages prewarm/retry. It is incorrect to attribute this Messages adapter to upstream inheritance.
- Inherited realtime: protocol `common.rs:1104` declares thread/realtime/start (experimental API); audio notification at `:2387`. Unchanged `core/src/realtime_conversation.rs:705–759` creates/connects realtime client, `:858` accepts audio, `:1171` appends speech, `:1354–1435` resolves auth, transport, URLs, session version and voice. Real implementation, not merely a README promise.
- Gating nuance: `features/src/lib.rs:2092–2095` marks old realtime_conversation flag Removed/default true. Do not mistake removal of a compatibility flag for removal of realtime code, nor use it as proof of availability.
- Dependencies: supported realtime backend/auth/session/model/version plus microphone/audio/WebRTC or WebSocket client integration. Raw thread/realtime requests also encounter Inquello's generic-thread guard when the working store is active. Inquello end-to-end voice UX and authorized private-Task realtime path were not demonstrated; hosted service entitlement is not conveyed by the open-source fork.

## Planning consequence

Keep the complete compatible Codex capability goal unless the owner changes it. Replace rebuild estimates with retain/configure/expose/integrate/qualify work against this pinned engine. For each capability record: inherited implementation; deliberate patch; effective configuration; Inquello UI and authorized call chain; external service/host dependency; measured evidence; remaining acceptance gate. Where generic APIs are intentionally guarded, extend the bound private Task path rather than bypassing the guard. Existing Epic 1 protections and built behavior remain assets to preserve.

This audit is source evidence only. Existing test files and historical verification notes are not fresh execution evidence, and no provider access, quota, privacy eligibility or release acceptance is promoted here.

## Confirmed private-start configuration addendum

Further direct source inspection sharpens the integration classification above. `engine/codex-rs/app-server/src/request_processors/thread_processor.rs:7355–7398` sets private Task overrides disabling plugins, apps, hooks (legacy key `codex_hooks`), memories, shell snapshots, unified_exec and web search; it explicitly disables each inherited configured MCP server. Lines `7483–7490` refuse startup if any MCP server remains enabled. `engine/codex-rs/features/src/legacy.rs:49` confirms `codex_hooks` is an alias, with a corresponding registry test at `features/src/tests.rs:565–567`.

Thus the MCP/skills management and default-enabled hook infrastructure discussed above must not be read as proof those capabilities run within private Tasks today. MCP endpoints and hooks have explicit startup restrictions, and plugin loading is disabled. Source has been retained; authorized private Task activation remains integration work. Existing one-shot local tool behavior is not erased by disabling unified_exec: `core/src/tools/spec_plan.rs:1266–1272` selects a private one-shot executor, and `:1308–1316` installs Inquello progress while suppressing the generic plan tool for private Tasks.

Verified subagent restriction: `app-server/src/request_processors/thread_processor.rs:7626–7635` supplies ToolPolicy with exactly exec_command, inquello_progress and request_user_input and requires a managed sandbox. `core/src/tools/spec_plan.rs:138–148` uses the session policy when constructing ToolRegistry. `core/src/tools/registry.rs:498–505,519–522,539–546` rejects disallowed trusted, prepended and external tool registrations before insertion. `ext/extension-api/src/tool_policy.rs:34–42` compares exact tool name and namespace against the allowlist. Thus current private Task multi-agent tools are excluded even without an explicit multi-agent feature override. This is a source-confirmed integration restriction, not missing inherited subagent implementation. Its safe activation requires changing the bound Task integration/authorization design, not merely toggling a feature. Compaction likewise has the explicit private Task restriction and core refusal patch documented above.
