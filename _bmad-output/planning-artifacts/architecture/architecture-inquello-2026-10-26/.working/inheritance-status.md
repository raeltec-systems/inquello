# Inheritance status for coaching

This working note records adopted direction and remaining source gaps. It is not the final architecture contract. Sources: [product extraction](input-product.md), [UX extraction](input-ux.md), [pinned source map](upstream-architecture.md) and [current documentation](current-docs.md).

The user adopted a public Codex fork and retention of its runtime/app-server with separate Inquello audit modules and focused core changes. They then asked to translate Codex's existing operating model directly. A generic new shared-service topology was not selected and is no longer the default proposal.

| Area | Starting point | Remaining Inquello responsibility |
| --- | --- | --- |
| Agent execution | Inherit Rust runtime, thread/turn/item model, tool dispatch, permissions, isolation and subagents. | Implement audit capabilities through verified extension seams; retain actual scope, coverage and effects. |
| Rich client interface | Retain app-server and version-matched protocol contracts. | Build the supplied UX against truthful runtime events; keep execution permission distinct from review and Professional Approval. |
| Runtime persistence | Retain upstream local history and metadata mechanisms for supported local execution. | Separate runtime continuity from evidence/provenance, Method departures, attributed decisions and destination authority. Exact new record-store design remains to be fixed or explicitly deferred. |
| Models and connections | Retain configurable provider and tool/MCP/extension mechanisms. | Verify authentication, processing policy, eligibility and capability limits per route. No silent provider or execution-host fallback. |
| Desktop workbench | Use actual Codex local execution as the baseline; local files belong to their execution host. | The complete desktop UI is not established as reusable public source. Build Inquello's selected visual system; desktop host/framework needs a source-backed choice. |
| Scheduling and event-driven work | Reuse verified queue/heartbeat/job-entry mechanisms where applicable. | A complete scheduling/trigger/mandate/ownership/recovery implementation is not established by the public-source pass. Full V1 automation scope remains; do not claim that recognition of scheduled inputs implements the scheduler. |
| Remote/cloud execution | Preserve supported, explicit routes and their declared capabilities. | Public interfaces do not supply every hosted backend. Name the actual implementation/service and operating policy before promising a route or always-on execution. |
| Team work and external records | Preserve PRD collaboration, effective identities and V1 external authority. | Assign ownership and authority for shared working metadata and bounded external operations. A new shared service must be justified by these concrete responsibilities rather than assumed as a general architecture default. |
| Native audit records | V2 remains a separate authoritative-record mode. | Define migration and native lifecycle only within the V2 boundary; V1 is not gated on a native record platform. |

Current official scheduling guidance requires the computer and app to remain running for scheduled work that needs local files. Cloud scheduled work has different accessible context. This is an operating-model observation, not a reduction of Inquello's V1 targets. Source: [Scheduled tasks](https://learn.chatgpt.com/docs/automations?surface=app), checked 26 October 2026.

Remaining coaching should focus on genuine gaps that prevent compatible implementation. Do not re-open the fork, engine/app-server retention, supplied visual system, broad V1 scope or V1/V2 authority boundary.
