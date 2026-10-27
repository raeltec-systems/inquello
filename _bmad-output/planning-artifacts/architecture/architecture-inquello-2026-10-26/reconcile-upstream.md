# Upstream evidence → architecture reconciliation

Checked 27 October 2026 against the draft [ARCHITECTURE-SPINE.md](ARCHITECTURE-SPINE.md). This is mandatory input reconciliation, separate from the optional reviewer gate. The spine, memlog, source extracts and selected stack were read-only. No repository checkout, imported code, dependency installation, build or runtime test was performed.

## Result

**One bounded evidence clarification is required:** preserve the contextual app-server command/production warning, rather than reducing it to a transport warning. This needs a short spine clarification and correction of two older source-summary statements. It does not change the adopted fork, Electron/React/TypeScript, Rust modules, SQLite or local stdio direction.

## UPR-1 — Carry the complete support caveat through

**Evidence verified directly:** the current [Codex App Server page, “Connect a remote Code Mode host”](https://learn.chatgpt.com/docs/app-server#connect-a-remote-code-mode-host), says: “The app-server command and WebSocket transport are experimental and aren’t supported for production workloads.” The adjacent Protocol section lists stdio as the default and separately marks WebSocket experimental/unsupported. The warning appears in the remote-host context; it must retain that context. Stdio availability alone establishes no blanket production-support conclusion. The documentation also distinguishes the outbound Code Mode host connection from the client listener.

[technology-evidence.md](.working/technology-evidence.md), “Support caveat”, already carries the correct qualification. Two earlier summaries are incomplete:

- `.working/current-docs.md` line 9 characterises the current warning as transport-specific without recording the command wording.
- `.working/upstream-architecture.md` line 10 ends its app-server implication with an assertion that current documentation qualifies WebSocket specifically, “not the entire app-server”. That is too categorical given the contextual warning.

**Exact required spine edit:** after the Stack evidence paragraph at current line 161, add a short statement with the remote Code Mode host context and the warning above, followed by: **“The local stdio choice establishes an integration mechanism, not an upstream production-support guarantee; verify the selected fork/route before production commitment.”** The existing OQ-6/OQ-8/OQ-9 and implementation-seed gates provide the owner/revisit boundary; no new gate or replacement stack is needed.

**Exact required source-summary edits:** replace the categorical transport-only interpretation in the two locations above with a dated clarification that distinguishes default stdio, the separate WebSocket status, and the command warning in the remote Code Mode host section. Link to the page and the newer technology evidence. Preserve the pinned source facts and historical revision provenance. These corrections were not applied during this read-only reconciliation.

## Other evidence reconciled without correction

| Area | Evidence and draft treatment |
| --- | --- |
| Public source versus private/hosted services | AD-1/2/3 and the envelope retain the public fork while leaving desktop implementation, service eligibility and backend supply explicit. No private UI or hosted-service entitlement is inferred. Public-source mechanisms are not claimed as complete product parity. |
| Pinned versus observed revision | The research pin `970111f6cb62cc02fe36a82ea7d71b37a2889c97` and previously observed main `efab30992b28bb8fc5064dbac9c12090b8818e98` remain evidence snapshots. AD-1, Stack and the implementation gate require an actual delivery cut and compatibility checks. No latest-head or tested-fork claim is made. |
| Current ThreadStore and separate domain SQLite | Pinned/current evidence separates canonical rollout history from explicit metadata mutation, with local JSONL plus SQLite metadata. AD-4/7 and the structural seed preserve those runtime responsibilities, introduce the adopted separate domain store, and decline cross-store atomicity, native authority and implicit writable replicas. No custom ThreadStore or driver is silently selected. |
| Actual app-server integration contract | AD-5 matches the evidenced main-owned Rust child/stdio mechanism, version-generated schemas, initialization/stream lifecycle and stderr separation. The dependency diagram is an Inquello contract, not a claim that every domain adapter/handler exists upstream. UPR-1 concerns support wording, not the feasibility of the documented mechanism. |
| Scheduler and collaboration supply | AD-12/14 and the operating-envelope rows preserve complete V1 obligations with owners/gates. Queue/heartbeat recognition is not called a production scheduler. Local history/SQLite is not called team coordination. Host/context availability remains explicit without an assumed shared backend or automatic cloud continuation. |
| Stack and source paths | Electron 45.0.0, React 19.3.1, Rust 1.99.1/edition 2024 and pnpm 10.34.5 match the supplied evidence. TypeScript 5.9.2 is correctly described as the inspected locked seed, not the current 7.0.2 release. The combined toolchain is untested. The older `sdk/typescript` versus current-docs `codex-sdk` path discrepancy remains a revision-specific verification concern; the spine does not hard-code the latter as the inspected source path. |
| Authority and recovery | Domain/professional authority is explicitly additional Inquello responsibility. Runtime permission/history, agent roles, credentials, successful transport responses, cancellation and history changes are not promoted into professional approval, verified delivery, rollback or upstream idempotency. |

## Reviewed snapshots

The primary page was read on 27 October 2026; the browser extraction places the remote-host warning at lines 966–973 and Protocol at 974–995. Local SHA-256 values identify the exact inspected inputs, not a selected delivery revision.

| File | SHA-256 |
| --- | --- |
| `ARCHITECTURE-SPINE.md` | `63c33b62f1d33629e7ce6bfa8607d71088f9cd431547497b42c600350d4423f5` |
| `.working/upstream-architecture.md` | `14e55d03feedbaad721aa4a6555c9f1f0cddeaa7310a6dc13244412c9a564474` |
| `.working/current-docs.md` | `bc53639740eebbafeb322d06380088b1e8271368467079b88107f629accf9c52` |
| `.working/technology-evidence.md` | `de94195d742b0ab1baeea852246bfbd1de6c4c9633947465d1cfc6e817af765b` |
| `.working/upstream-current.json` | `b16cc7c8f8c7ce27f00294917f639fe77e304329f6a4101053fcb038ebcd478e` |
| `.working/inheritance-status.md` | `8695960664e99010d781f3d75a7ebba3d36d45709c14fbb47d7ffb3ca99a78cd` |
