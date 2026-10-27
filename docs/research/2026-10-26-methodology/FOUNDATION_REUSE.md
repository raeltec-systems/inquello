# Foundation reuse and execution/recovery evidence

Checked October 26, 2026 against `openai/codex@970111f6cb62cc02fe36a82ea7d71b37a2889c97`. Static source and official documentation review only. No runtime or integration tests were performed.

## Supply-route findings

| Component | Established evidence | Consequence for research |
| --- | --- | --- |
| Core and CLI | Public CLI source, shared core business logic and Apache-2.0 root licence. | Concrete fork candidates; dependency notices and service eligibility remain separate. [README](https://github.com/openai/codex/blob/970111f6cb62cc02fe36a82ea7d71b37a2889c97/README.md), [licence](https://github.com/openai/codex/blob/970111f6cb62cc02fe36a82ea7d71b37a2889c97/LICENSE), [core](https://github.com/openai/codex/blob/970111f6cb62cc02fe36a82ea7d71b37a2889c97/codex-rs/core/README.md) |
| App-server | Public rich-client interface for conversations, settings, streamed events and approvals. Current docs label WebSocket transport experimental/unsupported. | A candidate host interface; selecting it is later architecture work. [Documentation](https://learn.chatgpt.com/docs/app-server) |
| TypeScript SDK | Wraps a CLI subprocess and JSONL events with repeated turns, streaming and resume. | Candidate for scripted jobs; does not itself supply a desktop UI. [SDK](https://github.com/openai/codex/blob/970111f6cb62cc02fe36a82ea7d71b37a2889c97/sdk/typescript/README.md) |
| IDE extension / Codex Cloud | Official inventory labels these products not open source. | Preserve capability ambition while identifying an eligible supply route for each experience. [Open-source inventory](https://learn.chatgpt.com/docs/open-source) |
| Desktop UI | README points to a separately distributed application; this pass did not establish reusable UI source. | UI supply remains unresolved, rather than assumed included with CLI source. [README](https://github.com/openai/codex/blob/970111f6cb62cc02fe36a82ea7d71b37a2889c97/README.md) |
| Hosted tools, connectors, scheduler | This bounded inspection did not establish each backend or entitlement. | Maintain a capability-by-capability supply matrix; interface visibility alone proves neither source availability nor service access. |
| Provider layer | Pinned source includes OpenAI, Bedrock, GCP and OSS construction; Azure has its separate documented route in C54A. | Test authentication and model/tool support per route. Inference choice does not confer hosted product parity. [Provider code](https://github.com/openai/codex/blob/970111f6cb62cc02fe36a82ea7d71b37a2889c97/codex-rs/model-provider-info/src/lib.rs#L536) |

Current app-server documentation restricts its existing authentication route for commercial/hosted services and directs that use toward Sign in with ChatGPT. That concerns authentication/service eligibility; it does not establish that Apache-licensed source cannot be adapted. Sign in with ChatGPT eligibility, application registration and the intended team distribution model still need confirmation. No legal conclusion about the future product is drawn here. [App-server authentication](https://learn.chatgpt.com/docs/app-server#auth-endpoints), [Sign in with ChatGPT](https://developers.openai.com/siwc)

## T5 — Request to execution and result

1. `turn_start_inner` validates the thread, allowed provider and input, resolves workspace/environment settings and calls `start_or_steer_turn`. The initial state is in progress, not completed. [Turn processing](https://github.com/openai/codex/blob/970111f6cb62cc02fe36a82ea7d71b37a2889c97/codex-rs/app-server/src/request_processors/turn_processor.rs#L525-L735)
2. `ToolRouter::build_tool_call` converts model response items to calls. Dispatch creates an invocation containing identity, session, settings and cancellation token. [Router](https://github.com/openai/codex/blob/970111f6cb62cc02fe36a82ea7d71b37a2889c97/codex-rs/core/src/tools/router.rs#L257-L393)
3. `ExecCommandHandler` prepares command, working directory, environment, permissions, justification and limits, then invokes the process manager. [Execution handler](https://github.com/openai/codex/blob/970111f6cb62cc02fe36a82ea7d71b37a2889c97/codex-rs/core/src/tools/handlers/unified_exec/exec_command.rs#L388-L451)
4. `open_session_with_sandbox` derives approval requirements; `ToolOrchestrator` evaluates permission/approval and selects execution isolation. Rejection and sandbox-denial retries have explicit paths. [Process manager](https://github.com/openai/codex/blob/970111f6cb62cc02fe36a82ea7d71b37a2889c97/codex-rs/core/src/unified_exec/process_manager.rs#L1482-L1604), [orchestrator](https://github.com/openai/codex/blob/970111f6cb62cc02fe36a82ea7d71b37a2889c97/codex-rs/core/src/tools/orchestrator.rs#L125-L235)
5. Registry handling records outcomes and returns tool results. A `PostToolUse` block rejects the result, not an already completed operation. [Registry](https://github.com/openai/codex/blob/970111f6cb62cc02fe36a82ea7d71b37a2889c97/codex-rs/core/src/tools/registry.rs#L900-L980)

**Interpretation:** Q7 B has a source foundation for scoped execution. These paths do not supply professional sign-off or demonstrate all tool types, connector transaction semantics or operating systems.

## T6 — Cancellation, resume and history are not rollback

`turn_interrupt_inner` checks the active turn ID and submits an interrupt. Ordinary turn interruption waits for `TurnAborted`; startup interruption follows a different acknowledgement path. [Interrupt](https://github.com/openai/codex/blob/970111f6cb62cc02fe36a82ea7d71b37a2889c97/codex-rs/app-server/src/request_processors/turn_processor.rs#L1622-L1683)

Resume can reattach or rebuild from saved history. Closing threads and some child-agent relationships have additional constraints. SDK cancellation forwards an abort signal and cleans up its subprocess; none of this establishes reversal of remote changes. [Resume](https://github.com/openai/codex/blob/970111f6cb62cc02fe36a82ea7d71b37a2889c97/codex-rs/app-server/src/request_processors/thread_processor.rs#L3929), [SDK subprocess](https://github.com/openai/codex/blob/970111f6cb62cc02fe36a82ea7d71b37a2889c97/sdk/typescript/src/exec.ts#L169-L264)

The documented thread-history revert removes conversation history without reverting local files. Source shuts down the runtime and replaces history/state, rejecting unsupported thread forms. [Documented semantics](https://learn.chatgpt.com/docs/app-server#revert-thread-history), [implementation](https://github.com/openai/codex/blob/970111f6cb62cc02fe36a82ea7d71b37a2889c97/codex-rs/app-server/src/request_processors/thread_processor.rs#L2192)

**Q4 B adaptation:** a reviewed update needs a named destination, the approved fields/change, current record version, operation identity where supported, and verification of resulting state. If outcome is uncertain, reconcile before retry. This is a proposed requirement, not a claim that all destinations support conditional updates or idempotency keys.

## Inventory delta and unresolved evidence

The pinned provider source contains GCP/Vertex project/location settings. This is a newly discovered inventory delta; the frozen inventory and generated map were not silently renumbered. A follow-up should map the route and verify its availability/limits before claiming parity. [Provider settings](https://github.com/openai/codex/blob/970111f6cb62cc02fe36a82ea7d71b37a2889c97/codex-rs/model-provider-info/src/lib.rs#L630-L735)

U1, U5 and U9 are **partially answered**. Still required: per-capability service eligibility, dependency review, complete child-agent/model-loop/persistence/scheduler traces, and controlled failure observations. Source inspection is not a runtime verification result.
