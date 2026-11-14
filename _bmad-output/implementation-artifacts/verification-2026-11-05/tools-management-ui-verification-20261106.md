# Ordinary Settings MCP management verification — 2026-11-06

## Result and scope
The isolated tools-only seeded smoke passed all 17 checks using the source-matched standard Windows app-server. This closes the ordinary Settings form → main service → native durable configuration → visible result/reopen management evidence gap. It does not qualify private-Task tool use, any real provider/grant, or the complete aggregate suite. Parent owns final aggregate acceptance and publication.

## Source changes for this continuation
- desktop/scripts/run-seeded-smoke.cjs: separate tools-only phase with fictional Workspace policy allowing only local HTTP discovery; default refusal policy unchanged. Full aggregate adds tools-management as required report 19.
- desktop/src/main/main.ts: development-only tools management smoke dispatch and runtime restart callbacks in isolated smoke profile.
- desktop/src/main/smoke-probe.ts: ordinary account menu → Settings → Tools navigation and actual labeled Add form, native config/read plus durable config.toml assertions, disable/restart/reopen, enable, remove/reopen, fixture-only identity/membership, bounded cleanup and screenshots.
- desktop/src/main/tools-smoke-fixture.ts (new): owned loopback-only bounded HTTP discovery fixture, no tool execution or auth; unknown/invocation requests rejected and counted.
- desktop/test/tools-smoke-fixture.test.ts (new): fixture discovery and refusal regression.
No dependency, protocol, renderer permission, real-user state, or private-Task integration changes in this continuation. Source edits frozen after capture targeting correction; no commits or pushes performed.

## Verification
- tools-management-focused-20261106.log: 12/12 tests (fixture 1, smoke-phase 5, Settings tools 6).
- tools-management-build-capture-20261106.log: final desktop TypeScript/Vite build passed.
- git diff --check -- desktop: passed, only Git line-ending advisories.
- seeded-smoke-baseline-docker-tools-ui-capture-20261106.log: isolated final phase exit 0, required report 1 present, cleanupErrors empty, overall ok true.
- Final phase stdout: D:\Inquello\tmp\inquello-seeded-smoke-ZkkYAw\tools\smoke.stdout.log.
- Checks: identity-signed-in; fictional-workspace-membership; initial-config-absent; form-add-visible; add-native-and-durable; loopback-discovery-only; disable-visible; disable-native-and-durable; disabled-survives-native-restart; disabled-reopened; enable-visible; enable-native-and-durable; remove-visible; remove-native-and-durable; removed-reopened; removed-still-absent; no-tool-invocations-or-auth.
- Fixture counts: initialize 4, toolsList 4, forbidden 0. No real provider/grants or tool calls.
- Binary: D:\Projects\inquello\engine\codex-rs\target\debug\codex-app-server.exe. SHA256 002865a3eaac4dbb22f82bac652046feab220607f0fc1c3db2c569e429d70bc3, rechecked after final pass. Standard binary selected without weakening any guard; no inference-fixtures binary used.
- Handshake version 0.165.0, forkTreeHash 51fff9c6403eac0f801018153ac1927514bbd3f7. Binary receipt: tools-ui-standard-binary-20261106.json.

## Actual pixel inspection
Individually inspected all final PNGs under D:\Inquello\tmp\inquello-seeded-smoke-ZkkYAw\tools\captures:
- tools-01-added.png: fictional MCP row and 127.0.0.1 URL visible; Installed; Enabled; Runtime configuration ready, with management buttons.
- tools-02-disabled-reopened.png: same row visible after native restart and UI reopen; Disabled by you and Runtime configuration not ready.
- tools-03-removed-reopened.png: ordinary Settings Tools page, named Synthetic tools setup Workspace, provider identity distinction and private-Task-disabled notice visible. Removal itself additionally asserted by DOM, native config and disk.

## Preserved unsuccessful/intermediate evidence
Initial build found missing governedRoots logs parameter; fixed, then build passed. Initial tools-only smoke at inquello-seeded-smoke-aEOChF failed before MCP add because the independently seeded fictional Workspace invitation had not been accepted. Added the same synthetic membership acceptance used by existing phases; did not weaken an assertion. Second run at inquello-seeded-smoke-PcoRQa passed all17 but its added screenshot was scrolled below the row. Corrected capture targeting only and reran final at ZkkYAw. All prior logs/receipts retained. No failed run is counted as acceptance.

## Remaining
Full 19-report aggregate seeded smoke and final full desktop suite remain parent-owned; this note records only focused and isolated acceptance. Existing wider frozen private-Task/real-provider acceptance boundaries remain unchanged.
