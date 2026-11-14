# Tools and connections continuation, 2026-11-06

Baseline branch feat/epic-1-secure-private-desktop, HEAD 42231084e0decdbc11ca23c68326d64f8b17d408. Story 1.21 remains in progress. Frozen intent and original baseline_commit remain unchanged. No install, dependency, real provider request/grant, private-Task integration enablement or publication was performed.

## Ordinary Settings implementation
- App routes #settings-tools to ordinary Settings. The named Tools and connections navigation item mounts existing management for only the current Workspace, not all Workspaces or the specimen. A missing selection never silently selects another Workspace.
- Current Workspace is named. Policy/capability details are collapsed after management. Models is not duplicated. The tools heading receives focus, Back to chat preserves the established navigation, and changing Workspace remounts/clears management forms.
- Pending policy reads show loading, not a false missing-Workspace error. Missing bridge, failed policy, signed-out/identity transitions and authoritative missing Workspace remain distinct. Existing identity epoch invalidation removes prior inventory.
- Integration rows say Runtime configuration ready/not ready; this preserves internal callable rules without promising private-Task invocation. The notice explicitly states configured MCP/apps/plugins remain disabled in private Tasks.
- Provider session remains separate from Inquello identity; Model selection points to Models without inventing an effective model. Removed stale pre-Story1.25 claim that model runs are not enabled.
- Smoke capabilities probe now traverses actual Shell account menu > Settings > Tools and connections > Back to chat, checking heading focus and readiness disclaimer. Visual smoke adds 09-settings-tools-and-connections.png. These new native/UI checks are authored, not yet executed.

## Executed checks
- Initial focused six-file desktop run: 145 passed; log tools-settings-focused-20261106.log.
- After loading/readiness/plain-model wording fixes: 148 passed across settings-tools, settings-route, capabilities-shell, capabilities-units, capabilities-lifecycle, policy-shell; log tools-settings-focused-final-20261106.log.
- Desktop production build passed twice, latest tools-settings-build-final-20261106.log. Existing >500 kB Vite bundle warning only.
- git diff --check passed. Final visual smoke addition still needs build and aggregate execution.

## Parallel native work
- OAuth callback repair worker is reproducing the unchanged RPC cancellation failure offline in existing owned Inquello-Engine build target; runner run-oauth-baseline-20261106.py, PS PID 7972. No duplicate native run.
- Provider independence integration now has a legitimate Windows path using fresh CODEX_HOME-derived keyring keys, synthetic local-save API key and verified logout cleanup. It is not a real provider test. Focused runtime execution is pending; do not count earlier Windows skip as pass.

## Open gates
Current source must receive source-matched native rebuild/protocol handling as needed, full desktop suite, seeded smoke and actual tools capture inspection before publication. Callback teardown is not fixed/verified by this note. No acceptance checkbox has advanced.
Supported private-Task invocation remains an explicit unresolved cross-story scope/architecture gate: existing runtime disables integrations and Story1.21 forbids model runs. Do not enable an integration or claim complete Epic acceptance from inventory/setup alone. Existing real chat history is not denied; current-build provider acceptance remains separate.

## Final desktop source checkpoint (16:39 UTC)
All final UI/smoke source compiles: tools-settings-build-ready-20261106.log passed. Focused source tests now 149 passed/6 files (tools-settings-focused-ready-20261106.log), including Settings identity-transition removal and positive integration readiness wording. git diff --check passed. Actual native smoke/capture remains pending.

Scoped desktop source: src/main/capabilities/service.ts; src/main/smoke-probe.ts (only capabilities production-navigation and visual capture09 hunks); src/renderer/App.tsx, Capabilities.tsx, CapabilityInventory.tsx, Settings.tsx; test/settings-tools.test.tsx (new), capabilities-shell.test.tsx, capabilities-integration.test.ts. No model/composer policy or private-Task invocation changes.

Unchanged native cancellation RPC baseline failed as expected (oauth-baseline-20261106.log; 12.12s after 5m59 compile). Candidate rmcp lib attempt stopped offline because guest lacked two already-locked tracing-test archives; Windows cache has exact archives, and only checksum-verified local cache reuse is authorized. No network fetch.

Focused integration runner run-tools-integration-20261106.cjs stopped before test execution because the old owned Docker container had disappeared after Docker restart. Parent is recovering that exact disposable fixture using preserved owned volume/cached image. No test skip is promoted to a pass.
