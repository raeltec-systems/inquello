# Public-fork boundary audit
Date: 2026-11-05. Repository: D:\Projects\inquello. Read-only source inspection; no builds, tests, downloads, installs, commits or status changes.

## Decision
The owner's reuse premise is supported: Inquello owns a substantial Codex engine fork, not a blank implementation. Preserve the complete compatible capability/model-route goal and Epic 1 work. However, owning public engine source is different from owning every branded application surface, hosted service deployment, or service entitlement. Plan integration/qualification for each boundary rather than infer automatic product parity or cut scope.

## Baseline and evidence limits
- AGENTS.md:11-14 identifies engine/ as the public openai/codex subtree and requires explicit story scope for engine changes.
- FORK-CUT.md:7-20 records rust-v0.165.0, commit 360319d8dee62d87e2d59fc0c21805d79519cfed, imported 2026-10-28, Apache-2.0. FORK-CUT.md:23-75 records import/tree provenance and the later deliberate patches.
- The evidence below is the local pinned import plus its documented Inquello modifications, inspected on the authorized device. No claim that current upstream main matches it, and no live-service entitlement or production-provider test was performed.
- Actual engine/ top-level listing includes codex-cli, codex-rs, sdk, docs, tools and supporting build directories. sdk/ includes typescript, python and python-runtime. No branded desktop renderer or mobile application project was established from the inspected roots/manifests. This is source-scoped evidence, not an exhaustive proof that no related UI code exists anywhere.
- Existing capability/comparative catalogs are not treated as authority for the findings below.

## Five concrete planning implications

### 1. Reuse the runtime and interfaces, then expose them in Inquello
engine/codex-rs/Cargo.toml:16-22 lists app-server, transports, daemon, client and protocol; :38-62 lists CLI, core, skills, execution and policy; :85-115 includes sandbox, model management, MCP client and TUI. These are actual workspace members, not merely marketing promises.
engine/sdk/typescript/README.md:1-5 says the SDK embeds the agent by spawning the CLI and exchanging JSONL; engine/sdk/python/README.md:1-4,15-16,31-41 documents thread/turn/streaming APIs and reuse of Codex authentication.
Implication: start with those inherited components and APIs. Inquello UI/workflow wiring, permissions and acceptance evidence remain work, but implementing a second runtime from scratch is not justified.

### 2. Separate app launcher from the branded desktop application
engine/README.md:1-8 identifies the CLI and directs desktop/cloud users to separate entry points.
engine/codex-rs/cli/src/app_cmd.rs:15-23 dispatches the app command to an open-or-install helper.
engine/codex-rs/cli/src/desktop_app/mac.rs:8-42 searches for the OpenAI application and otherwise downloads a separate installer from persistent.oaistatic.com; :177-182 verifies the bundle before installation.
engine/codex-rs/cli/src/desktop_app/windows.rs:6-16 contains a Microsoft Store installer URL and installed-app check.
desktop/package.json:2-8 identifies Inquello's own Electron main process owning the app-server runtime over stdio; :27-37 declares Electron/React/Vite.
Implication: the public fork includes substantial desktop integration/launch support, but these inspected paths do not supply the separately distributed branded renderer. Continue building Inquello's presentation layer around inherited runtime functionality. Do not equate a codex app command or desktop-named module with possession of all shipped application source.

### 3. Cloud clients are reusable; hosted execution is a separate dependency
engine/codex-rs/cloud-tasks/src/lib.rs:48-80 constructs an HTTP backend, defaulting to https://chatgpt.com/backend-api; :88-117 requires authentication using the Codex backend and installs its auth provider. A debug-only mock is a different branch (:49-71).
engine/codex-rs/Cargo.toml:34-37 lists cloud-config, cloud-tasks, client and mock-client. That proves reusable client code, not possession/provisioning of OpenAI's hosted execution infrastructure.
Implication: preserve cloud capability scope, but identify for each flow whether it uses an eligible authorized service or an Inquello-owned implementation. A source build alone cannot establish hosted account entitlement, deployed environments, quotas, browser provisioning or service reliability.

### 4. Scheduling, memory and browser capability need layer-specific mapping
Scheduling is not absent. engine/codex-rs/ext/queue/src/service.rs:30-33,40-45,65-113 implements a user-message queue over QueueStore and a SQLite revision watcher with independent dispatch. core/src/session/handlers.rs:80-99 wakes idle sessions for mailbox work; core/src/tasks/mod.rs:442-470 recognizes durable-sleep extension state and pending-work wake paths. core/src/tools/handlers/sleep.rs:26-35,102-135 implements interruptible clock.sleep through an injectable time provider (up to 12 hours).
These are valuable runtime/durable queue primitives. They do not alone establish a recurring unattended host scheduler that launches work after application shutdown; process lifecycle, recurrence, missed-run semantics and wake/resume behavior need their own implementation/evidence mapping.
engine/codex-rs/features/src/lib.rs:302-343 explicitly describes in-app browser, local automation and browser-use entries as requirements-only gates. A gate is neither proof of a complete browser implementation nor proof that none exists.
Cargo.toml:75,89-90 contains memory extension/read/write components. Runtime memory is not itself evidence of ambient desktop activity capture.
Implication: retain all desired capabilities, credit these primitives, and separately verify the needed app/host/service layer. No blanket claim that scheduler, memory or browser support is missing is warranted by this audit.

### 5. Model routing and service eligibility are not interchangeable
engine/codex-rs/model-provider-info/src/lib.rs:543-582 configures OpenAI Responses/auth/websocket/web-search capability; :585-622 configures Bedrock with different auth/support fields; :635-672 configures GCP and restricts Codex-backend-route eligibility to the OpenAI provider plus the appropriate endpoint.
engine/codex-rs/features/src/lib.rs:610-612 requires both the Apps feature and ChatGPT auth for apps_enabled_for_auth.
engine/codex-rs/app-server/README.md:89-96 documents startup-provider managed-requirement checks for model listing, even with cached catalogs.
Implication: preserve each compatible model route, but qualify capabilities per provider/auth/endpoint/policy combination. Supporting model inference does not automatically grant hosted connector, browser, catalog or other Codex-service parity. Inquello's added provider adapters must be assessed as modifications, not retroactively attributed to pristine upstream.

## Open evidence questions, not scope cuts
- Which exact browser primitives/adapters are reusable in the pinned engine, and which browser runtime/provisioning/UI remains to be supplied?
- Which unattended schedule/resume guarantees can the inherited daemon/time-provider/queue stack prove on each target OS?
- What mobile-facing source or service contract is actually present and intended for Inquello? The inspected workspace does not establish a mobile application.
- Which service/provider routes are authorized and production-qualified for Inquello, versus represented only by client code, schemas, flags or synthetic tests?

Only this audit document was written. No capability scope, implementation, approval state, sprint status or Epic 1 acceptance was changed.
