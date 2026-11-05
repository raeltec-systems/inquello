# Messages warm-policy change: proposal

Date: 2026-11-05
Status: **Implemented 2026-11-05 (option A, owner-approved 2026-11-05).** See §5 and the FORK-CUT entry "Messages warm policy change: native mid-conversation system message". The original proposal text below is kept as written.
Builds on: `validation/messages-warm-policy-representation-gap-20261101.md` (the Codex root-cause review). Its source chain is still accurate and is not repeated here.

## 1. What the test expects

`messages_lifecycle_warm_policy_change` (`app-server/tests/inquello_authorization_runtime.rs`; the driver is `tests/common/inquello_authorization_driver.rs`, scenario `lifecycle-warm-policy-change`) runs one Task on the `claude-api-key` route:

1. The first turn runs under the original policy and writes its confirmed marker.
2. In the same process and on the same retained thread, the host raises `policyRevision` and `authorizationEpoch` to 2 and sets `execution.sandbox = read_only`. It then sends `inquello/tasks/resume` with that policy.
3. The resumed turn must actually sample the provider. Provider request index 1 is admitted within the after-resume budget.
4. `retained_sandbox_modes` must show the prior turn with a mode other than `read-only` (the positive control) and the new turn with `read-only`. A warm thread may not keep its obsolete profile (Story 1.29, Approach 3 and finding B5).

The Responses twin (`responses_lifecycle_warm_policy_change`) passes. On Messages, the resumed turn fails before dispatch with `Selected processing route refused: late system instructions cannot be reordered; no retry or provider fallback`. That refusal is correct today: no fallback, no retry, and the turn is not reported as completed. But the gate stays open.

## 2. Why the Messages shape conflicts

- When the policy changes, core records a new developer-role permissions fragment (`PermissionsState::render_diff`). `record_context_updates_and_set_reference_context_item` runs **before** the resume input is recorded. The native history is therefore `… assistant (end of turn 1), developer (new permissions), user (resume request)`.
- `core/src/inquello_inference.rs::request` maps every `system`/`developer` history item to `Role::System` / `Origin::TrustedInstruction`, in retained order.
- `inquello-adapters/src/anthropic/request.rs::encode_request` puts every System message into the top-level `system` array. It refuses a System message that appears after any non-system message (line 60), because hoisting the message would change its chronology. That guard is right for the encoder as written.
- **The new evidence.** Anthropic's Messages API now accepts mid-conversation `{"role": "system"}` entries in `messages[]` on the bound model, `claude-sonnet-5-5`, on the Claude API. There is no beta header, the content is text only, and the entry is the non-spoofable operator channel. They are not available on Claude Sonnet 5, and on Bedrock only through InvokeModel passthrough. (Source: the Claude API reference bundled with this session, cached 2026-10, "Mid-conversation system messages". Check it against the live docs before implementing.) The 2026-11-01 review assumed only a top-level `system` existed. That is no longer the whole picture.
- **What remains a conflict:** the placement rules. A mid-conversation system message must follow a `user` message (or an `assistant` message that ends in server-tool use), and it must be the last entry or be followed by an `assistant` turn. Native Codex places the permissions fragment after a plain assistant message and before the user's resume message, which is exactly the position the API rejects. An unsupported placement or model returns a 400. The API's suggested fallback, putting the text into a user-turn `<system-reminder>`, is a role downgrade. The 2026-11-01 review rightly forbids it.

So we can now represent the history almost exactly. One question is left: the fragment has to move one position, after the user message it currently precedes.

## 3. Options

### A. Native mid-conversation system message, moved one position (recommended)

The encoder emits a late trusted instruction as `{"role":"system","content":[text]}` in `messages[]` instead of refusing it, under these narrow rules:

- It applies only when a System run sits at a turn boundary: just after an assistant message and just before the next user message of the new turn, with no tool results in between. The run is emitted immediately **after** that user message, which satisfies "follows a user message" and "followed by the assistant turn being sampled".
- Every other late System placement still fails closed with the current error. That covers mid tool loops, consecutive turns without a user message between them, and any shape that would need more than this one move.
- The original top-level `system` and every earlier message keep their bytes. Historical late system messages are re-emitted in the same relative position on every later request. The history is append-only, so prompt caching and preserved thinking are not disturbed: no edit to history and no lost thinking blocks.
- The encoder accepts this only for the pinned `CLAUDE_MODEL` and `CLAUDE_API_VERSION` it already checks. A future model without support (for example Sonnet 5) or a 400 `role 'system' is not supported` ends the turn as failed. There is no downgrade, retry or fallback.

Trade-offs:
- **Truthfulness:** high. The new permissions carry system authority, and historical policy stays in history as its own record. The only difference from native order is that the instruction comes after the user's resume text and not before it. Both come before any model output under the new policy, so no old action reads as authorised by the new policy. This move should be recorded as a deliberate projection rule.
- **Security:** no new trust is granted beyond today's. The same core mapping already sends first-turn developer fragments to top-level `system`. The rule must keep the review's limits: a user or tool payload that looks like permissions never becomes system content (the role comes from native history, not from the payload), and only the boundary shape is accepted. We also need to confirm that no client-inject path reaches a private Task thread. `guard_retained_request` already refuses generic turn mutations, and a test should prove that `thread/inject`-style ingress cannot add a developer item. Native sandbox enforcement still governs either way: the resumed turn runs read-only even if the model misreads its instructions.
- **User experience:** best. Resume on the same Task works after a policy change, as it does on Responses. Nothing is required of the auditor.
- **Cost:** small. The change is in `anthropic/request.rs`, plus tests and a fixture that accepts `role: system`. Core and Responses are unchanged.

### B. Current-permissions snapshot plus historical timeline (the Codex design of 2026-11-01)

A typed `CurrentRuntimePermissions` snapshot is carried separately to inference and rendered in top-level `system`. Historical policy fragments become a structured timeline.

- **Truthfulness:** acceptable, but the model sees a reconstructed timeline and not the history. The temporal wording needs its own design approval.
- **Security:** sound if provenance is validated end to end. That is a larger surface: ingress validation, plus behaviour on compaction, restart and retry.
- **User experience:** the same as A, once built.
- **Cost:** large and cross-cutting (core world-state producer, history preparation, the adapter and eight acceptance areas). Changing top-level `system` on every policy change also invalidates the whole prompt cache.

Keep B as the fallback design if A turns out to be unavailable on a platform we need, such as Bedrock without passthrough.

### C. Keep failing closed and make the limit explicit

Leave the encoder unchanged. Native code refuses a Messages Resume after a policy change before dispatch, with a clear, attributable reason, for example: "This model route cannot continue this Task under the changed policy. Start a new Task or use a route that supports it." The test expectation changes from "resume samples" to "resume is refused before dispatch, and the prior turn and confirmed effects stay intact".

- **Truthfulness and security:** maximal. Nothing is reordered and no authority changes.
- **User experience:** poor. Any Workspace policy tightening strands in-progress Claude Tasks.
- **Process:** changing the test's expectation is a product decision, not a test fix. It needs explicit owner approval and a spec update (Stories 1.22, 1.25 and 1.29). Story 1.25 allows disclosing a limit rather than executing outside the binding, so C is consistent with the specs but weaker than Story 1.29's warm-resume intent.

## 4. Recommendation

**Adopt Option A**, with C as the interim state. That interim state is exactly today's behaviour: a fail-closed refusal with no fallback, and the gate reported as open, not passing.

Acceptance for A, in addition to the existing assertions in `lifecycle-warm-policy-change`, which stay unchanged:

1. The Messages warm-policy Resume samples once, the prior turn's mode is not read-only, the new turn's mode is read-only, and the provider request carries the new permissions as a `role: system` entry immediately after the resume user message. The top-level `system` and the prior messages must be byte-identical to the first turn's request.
2. A late System message anywhere other than the single boundary shape (mid tool loop, after a tool result, two late runs without a user message between them) is still refused with the current error, and nothing is dispatched.
3. User or tool content containing permission-looking text, role tags or forged metadata stays user or tool content.
4. An unsupported model or a provider 400 ends the turn as failed. There is no retry, downgrade or fallback, and the run is never reported as completed.
5. Retry, restart and a second Resume re-emit historical system messages in the same positions (append-only), and a stale snapshot is never reused.
6. Responses behaviour and its warm-policy test are unchanged.

Before implementing, confirm against the live Anthropic documentation that mid-conversation system messages and their placement rules apply to `claude-sonnet-5-5` with API version `2026-10-21` on the direct Claude API. Real-provider acceptance still requires its own explicit authorisation.

## 5. Implementation record (2026-11-05)

**Live documentation check (accessed 2026-11-05).**
- https://platform.claude.com/docs/en/build-with-claude/mid-conversation-system-messages and https://platform.claude.com/docs/en/api/messages/create.
- They confirm that mid-conversation `{"role":"system"}` messages are available on Claude Sonnet 5.5, with no beta header, on the Claude API. They are not available on Claude Sonnet 5.
- An entry that carries content must immediately follow a `user` turn (one that carries `tool_result` blocks counts) or an `assistant` turn that ends in a server tool result. It must be last or be immediately followed by an `assistant` turn. Anything else is a 400.
- Two points differ from §2: the live page lists Amazon Bedrock as available, without the InvokeModel-only caveat, and it says a tool-result user turn is a valid predecessor. Neither widens what we implemented.

**What was built.** `inquello-adapters/src/anthropic/request.rs::encode_request` emits a late System run as one native system message directly after the next native user message, in one shape only:
- nothing before the run is an assistant `tool_use` awaiting its result;
- the run is followed only by user-input messages (never tool output);
- those messages are followed by an assistant message or by the end of history.

Every other late shape keeps the existing refusal and dispatches nothing. The top-level `system` and all earlier entries stay byte-identical (append-only).

**Deviation from §3.A, recorded deliberately.** §1–§3 assumed turn 1 ends with a plain assistant message and allowed the run only "with no tool results in between". The actual retained history in `lifecycle-warm-policy-change` is different:

`… assistant(tool_use), user(tool_result), user(<turn_aborted>), developer(permissions), user(<environment_context>), user(resume)`

Under the literal §3.A rule the acceptance test could not pass. The implemented rule keeps every security limit in §3.A and §4:
- tool output is never crossed or merged into: it stays before the instruction, as in native order;
- runs inside a tool loop, before an assistant message, at the end of history, or two runs without an assistant turn between them are refused;
- only the pinned binding is accepted.

The rule keys on what follows the run, not on a plain assistant message before it. The only move is the run going after the new turn's user input, which is the move this proposal intended.

**Acceptance status against §4.**
1. Met by fixture, including the wire-shape assertions now in the driver.
2. Met by unit tests.
3. Met by unit tests.
4. Met for a provider 400 by a loopback test. An unsupported model is refused before dispatch.
5. Re-emission and append-only order are met by unit tests. Restart and a second Resume are covered at the encoder level only.
6. Met: Responses is unchanged and its test passes.

Real-provider acceptance has not been run.
