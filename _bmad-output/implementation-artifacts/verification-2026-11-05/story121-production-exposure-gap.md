# Story 1.21 production exposure and completion gate

Date: 2026-11-05. Current source inspected while Story1.26 remains the active implementation. This records a demonstrated gap, not passing acceptance or authority to enable every integration.

## Actual current entry points
- `desktop/src/renderer/Settings.tsx:8–21` exposes Account, AI connections, Models and Usage only. It imports neither Capabilities nor CapabilityInventory.
- `App.tsx:22,43–46` routes normal settings hashes to Settings. The Shell's historically named onShowSpecimen callback now opens Settings, not the specimen.
- `Specimen.tsx:461–462` is the only actual mounting caller of Capabilities. `Capabilities.tsx:148` mounts the per-Workspace CapabilityInventory there. Therefore the current tools/connection management component is not discoverable through normal product navigation.
- `CapabilityInventory.tsx:106–149` has real policy-aware entry actions and an Add MCP server form with remote HTTP/local stdio choices. Named preload/main operations and runtime methods exist; these are not proof of normal-UI reachability or end-to-end usable private-Task integration.
- The current private Task runtime explicitly disables plugins/apps/hooks/memories and configured MCP endpoints, and restricts tool invocation to the initial one-shot command/progress/question allowlist. See thread_processor.rs:7360–7398,7483–7490,7624–7635. Inventory/configuration state is distinct from protected Task use.

## Owner clarification and completion gate
During the live discussion the owner requested that the actual tool/plugin/connector gap remain an Epic1 completion gate: discoverable setup, supported plugin/MCP connection/configuration/revocation/readiness, and authorized use in a private Task within the actual approved scope, not inventory-only. This does not infer support for all integrations or permit bypassing current private-Task controls. Reuse the inherited mechanisms, adapt/expose actual gaps and qualify supported paths; do not rebuild existing machinery.

Before implementation, reconcile the selected private-Task integration path with the historical Story1.21 no-model-run boundary and dependent story acceptance. If a genuine scope or architecture decision is necessary, surface it rather than broadening authorization silently. No change to frozen intent is made in this record.

## Required evidence before closing
1. Ordinary Settings navigation reaches the supported tools/connections UI without a specimen or developer-only route; keyboard, focus and current Workspace identity are correct.
2. Existing plugin/MCP management is exercised through that real UI and named host path with appropriate isolated fixtures: actual install/configure/connect/readiness, disable/remove/revoke or cancel where supported, then authoritative re-read. Installation must not grant credentials; hosted browser handoff must not claim remote cancellation.
3. A supported private-Task invocation demonstrates the exact acting connection, scope, current policy, failure handling and revocation boundaries. An enabled configuration alone is not callable evidence; no universal integration claim follows from one passing path.
4. Retain the known Story1.21 callback teardown defect until genuinely repaired and its original regression passes.
5. Current Windows capabilities integration setup was blocked by the earlier C: database exhaustion. Repeat against the isolated D-backed fixture; do not relabel skipped setup as pass. Full-suite/smoke and final-build evidence remain required.

## Correction to earlier report
Earlier source inspection established implemented inventory components and backend methods, but did not trace their current production navigation mount. Saying this alone was usable Settings setup overstated exposure. This note records the distinction so subsequent story/completion reports verify the actual normal-user route. Active Story1.26 work continues; no code, install, credential, source-access or integration enablement action is made here.
