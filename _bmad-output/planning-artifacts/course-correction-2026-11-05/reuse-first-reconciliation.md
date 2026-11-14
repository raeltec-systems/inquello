---
title: "Reuse-first reconciliation of Codex capabilities"
status: source-audit-adopted-in-planning-2026-11-05
date: "2026-11-05"
branch: "feat/epic-1-secure-private-desktop"
head: "c407483170e93ad9bea0f2d1c36e9d32693b0c44"
scope_change: none
---
# Reuse first, qualify the integration

## Finding
The owner's premise is supported: Inquello forks a substantial working Codex implementation. Do not describe every future roadmap story as a capability to rebuild. Preserve the complete compatible Codex capability goal and the approved internal-audit journey. The relevant planning question is which inherited implementation to retain and expose, what audit-specific integration is required, and what evidence/service dependencies remain.

This source audit does not establish exhaustive parity with every Codex-branded application or hosted service. It verifies representative implementation and integration chains at the current pinned fork; no runtime tests or live service calls were performed.

## Evidence
- [Inherited core audit](inherited-core-audit.md): local Git object checks establish rust-v0.165.0 / upstream commit 360319d8dee62d87e2d59fc0c21805d79519cfed. The imported subtree is real and intentionally patched. CLI/exec, app-server, TypeScript/Python SDKs, resume/fork/compaction, subagent, MCP/skills/hooks and realtime implementations are present.
- [Desktop wiring audit](desktop-capability-wiring-audit.md): actual UI → named IPC → native app-server paths exist for initial task start/steer/stop/same-Task resume, model selection and permission decisions. Capability discovery/configuration calls real inherited APIs.
- [Public-fork boundary audit](public-fork-boundary-audit.md): the app command launches/installs a separately distributed signed application; Inquello supplies its own Electron presentation. Cloud-task HTTP clients do not themselves provision a hosted execution service. Queue/mailbox/sleep primitives exist, but full recurring host lifecycle guarantees remain to be established.

## Concrete reuse and remaining work
| Capability | What exists | What remains to qualify |
|---|---|---|
| Task execution, stop, steer, resume | Inherited thread/turn engine plus actual Inquello private-task call chains. | Current platform/provider/runtime acceptance and required audit continuity. Reuse the existing path. |
| Forks/branches | Inherited thread manager and real fork handler. | Bound private ownership/history path and appropriate UI. Generic thread mutations are intentionally guarded. |
| Subagents | Inherited spawn/input handlers and feature machinery. | The current private tool allowlist is limited to exec_command, inquello_progress and request_user_input. Child authority, scope, lineage, costs and evidence require integration before exposure. |
| MCP/plugins/apps/hooks | Actual inherited components; desktop inventory/configuration is wired. | Private startup disables the relevant invocation features/endpoints. Retain implementation and introduce properly authorized task use with exact connection identity and verification. Management is not task-use availability. Skill text loading was not exhaustively traced; do not infer every skill is disabled. |
| Compaction and memory | Inherited implementations. | Current private-path restrictions must be addressed through scoped model authority, history and evidence contracts, not bypassed. Runtime memory is not equivalent to ambient application capture. |
| Voice/realtime | Inherited protocol plus actual realtime transport/session/audio handlers. | Private-task authorization, audio UI/client integration, consent/retention and an eligible backend. No end-to-end voice claim is established. |
| SDK/programmatic clients | Inherited TypeScript CLI/JSONL and Python app-server clients. | Inquello-aware identity/permissions/context and supported entry points. Current desktop transport is a bounded main-owned stdio child, not automatic secondary-client enablement. |
| Scheduling | Durable user-message queue, idle/mail wakes, durable-sleep state and clock.sleep implementation. | Supported recurrence, host/app availability, missed runs, restart/wake, run identity and protected Task invocation. No blanket claim that scheduling must be invented or that unattended recurrence already works. |
| Models/providers | Real configurable Responses routing, auth/catalog/gateway support and provider constructors; Inquello adds Messages translation. | Exact API/model/provider compatibility and policy/service access. Constructor/config support does not imply every native provider API, hosted feature or entitlement is compatible. |
| Desktop/cloud product surfaces | Open-source runtime/client interfaces; Inquello has its own Electron app. | Presentation/integration and eligible or separately supplied hosted services where the chosen capability needs them. No categorical claim that every marketed UI/backend is included in the public tree. |

## Exact current protection boundary
engine/codex-rs/app-server/src/request_processors/thread_processor.rs:7355–7398 explicitly disables plugins, apps, hooks, memories, unified_exec, web search and inherited MCP endpoints for private Task startup; :7483–7490 checks none remain enabled. Lines 7623–7635 disable fallback and install the three-tool allowlist. This does not remove command execution: core/src/tools/spec_plan.rs:1264–1272 registers the private one-shot executor.

engine/codex-rs/app-server/src/request_processors/inquello_tasks.rs:2300–2339 rejects generic cold resume/fork/new-turn mutations when the Inquello store is active, directing callers to bound private Task operations. The proper integration preserves this boundary rather than letting raw engine APIs bypass it.

## Planning direction adopted on 5 November
1. Keep every compatible Codex capability in the target unless the owner explicitly changes scope. The latest user response emphasizes reuse, not an authorised cut.
2. Replace backlog-only reasoning with a source-backed ledger per capability: inherited source/API, deliberate patch, effective config, Inquello UI/IPC/native path, authority/data adaptation, external dependency, test evidence and remaining acceptance.
3. Rewrite future implementation work as retain/configure/expose/adapt/supply/verify where supported. Do not estimate greenfield rebuild work merely from a future story label.
4. Connect the approved audit lifecycle to those foundations: sourced context and Methods, coverage/engagement planning, calculations and evidence, review and report, actions and recurring checks. Add only the audit-specific semantics and verified controls actually needed.
5. Preserve Epic 1, the existing private/shared and external-V1/native-V2 architecture, OQ-6 and explicit per-route gates. Existing protections are integration requirements, not disposable obstacles.
6. Continue concrete requirements/UX/acceptance planning without repeatedly asking whether to drop generic features. Where a service or capability cannot be qualified, report that exact dependency and decide sequencing explicitly rather than claim parity or silently remove scope.

The earlier D1 proposal asked about broad capability timing before this source check. Israel subsequently approved applying the reuse-first direction through BMAD workflows. D1 is resolved by retaining all compatible capabilities; no earlier draft question authorises a cut. The separate planning application updates the existing PRD, SPEC, architecture, UX, epics and tracker, preserving Epic 1 and current statuses. See application-report.md for exact results and limits; this source audit itself ran no runtime tests.
