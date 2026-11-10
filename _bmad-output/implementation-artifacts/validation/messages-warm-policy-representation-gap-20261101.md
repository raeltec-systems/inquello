# Messages warm-policy representation gap

Date: 2026-11-01
Status: **PROPOSAL ONLY — not an approved implementation, not an accepted validation gate.**
Scope: Read-only root-cause investigation, followed by this documentation-only artifact. No production code changes, tests, builds, installs, provider calls, commits, or pushes were performed by this reviewer.

## Evidence and limits

The initial full native run at `3f9d360560c7f1b9161cb6114eeb3d39798d1b6e` failed the Messages `lifecycle-warm-policy-change` case. Evidence: `.tmp/epic1-validation-20261101/native60.log`, approximately lines 77384–77410. Resume created a new run/turn on the retained thread; policy callbacks carried policy revision 2, authorization epoch 2, and read-only sandbox. The terminal error was:

> Fatal error: Selected processing route refused: late system instructions cannot be reordered; no retry or provider fallback

The equivalent Responses case passed in that run. This identifies a provider-history representation gap, not evidence of a stale authority callback. No independent rerun was performed for this review. The checkout is actively being repaired by the integrator; HEAD observed when creating this artifact was `fde49322ee1c5da81976d4387a3cd002916defa6`. Line numbers below are approximate inspection-time locations; symbols are the stable references.

## Source chain

All paths below are relative to `engine/codex-rs/`.

- `app-server/tests/common/inquello_authorization_driver.rs`, `lifecycle-warm-policy-change` branch: changes policyRevision and authorizationEpoch to 2 and execution sandbox to read_only before Resume. Later assertions require prior-turn permissions to remain distinct and current-turn permissions to be read-only. Preserve these checks.
- `core/src/context/world_state/permissions.rs:92`, `PermissionsState::render_diff`: changed permission instructions produce a new developer fragment. This is expected native context-update behavior.
- `core/src/session/mod.rs:5135`, `record_context_updates_and_set_reference_context_item`: constructs initial context or diffs, records model-visible items, then persists world-state/turn snapshots.
- `core/src/inquello_inference.rs:312–355`, `request`: prepends base instructions, then maps every native system/developer message to provider-neutral System/TrustedInstruction in retained order.
- `inquello-adapters/src/anthropic/request.rs:60`: rejects a System message after any non-system message with `late system instructions cannot be reordered`. The Messages payload uses a separate system prefix. **Keep this guard.**

## Provenance: what survives and what does not

`core/src/context_manager/history.rs:603–617` offers `for_prompt_annotated()`, which retains `ResponseItemEnvelope`, and `for_prompt()`, which unwraps it. `core/src/session/turn.rs:578,1800` uses the latter; `core/src/client_common.rs::Prompt.input` is `Vec<ResponseItem>`.

However, not all typed attribution is lost. `ResponseItem::Message.internal_chat_message_metadata_passthrough` contains per-part content kinds and provenance. `context-fragments/src/annotated_content.rs:146–225`, `message_from_parts`, `to_annotated_content`, and `set_annotated_content`, keep content and positional attribution together. Missing/legacy metadata becomes unknown, not trusted.

`prompts/src/permissions_instructions.rs:262` assigns kind `permissions.instructions` and developer role. `context-fragments/src/fragment.rs:60` supplies default `ContentItemMetadata::harness()`. `protocol/src/models/item_metadata.rs` distinguishes Harness { hook: false }, command-hook context, DeveloperInstructions, Tool, User, and Unknown. The current Inquello inference mapper does not use these distinctions.

**Spoofing concern:** `core/src/session/inject.rs::annotate_client_response_item` preserves the incoming ResponseItem unchanged and only conditionally adds envelope `client_authored` metadata when the corresponding feature is enabled. The envelope is later stripped. Therefore a new normalizer must not treat serialized content kind/provenance alone as a new security boundary without validating all relevant ingress paths. This review did not establish an externally reachable exploit; it identified an insufficient basis for a new trust decision. Neither permission-looking payload tags nor role alone prove host origin.

## Availability of current trusted instructions

`core/src/session/world_state.rs:59`, `build_world_state_for_step`, builds current typed sections from the resolved step. Around lines 225–260, the permission section is derived from the current environment permission profile, approval settings, execution policy, cwd, and capability settings. `core/src/session/turn.rs:557` refreshes the world state before preparing sampling history.

`core/src/context/world_state/mod.rs:492`, `WorldState::render_full`, renders every current section, preserving section update order. `core/src/session/mod.rs:4712`, `build_initial_context_with_world_state`, assembles broader initial context; this is not a narrow permission accessor and should not be called merely to extract permissions without reviewing its wider work and content.

There is **no separate current-runtime-permissions snapshot in Prompt**. `get_prompt_base_instructions()` (`session/mod.rs:1618`) supplies base/model instructions, not a full current runtime/developer-policy snapshot.

## Conclusion

Current Messages encoding cannot exactly preserve interleaved high-priority instruction chronology. Hoisting, deleting historical instructions, or changing their role changes semantics. Typed attribution helps identify origin but does not eliminate this representational constraint. A generic late-system hoist, payload-tag matcher, or developer-to-user downgrade is not an acceptable repair.

If exact native chronology is required, this Messages warm-policy continuation gate must remain unsupported/failing closed. Do not weaken the test or silently switch providers.

## Bounded design for separate approval

The following is a new request-projection contract, not an already approved fix or a claim of exact native equivalence:

1. At the trusted world-state producer, construct a narrow typed `CurrentRuntimePermissions` snapshot carrying full current rendered permissions, policy revision, authorization epoch, and step/turn identity. Carry it separately to inference; do not infer it from retained text.
2. Preserve verified host provenance and section identity through history preparation. Validate/strip client-supplied attribution at ingress as appropriate; unknown/legacy records must never gain authority automatically.
3. Define explicitly that this snapshot governs new execution only. Historical policy remains chronological audit evidence, not a grant for current execution.
4. A Messages-only projection could emit newly generated current-policy system instructions plus a deliberately structured historical policy timeline with stable history positions. Its temporal meaning and model-facing representation need explicit design approval. This is not a simple hoist and must not falsely represent old actions as authorized by the new policy.
5. Apply only to the named permission section. Unknown late developer/system messages, mixed-origin fragments, hook output, unsupported deltas, and inconsistent provenance must continue failing closed. Do not use a broad “all harness content is movable” rule.
6. Keep retained native history unchanged. Keep current admission/authority checks and tool/event-disclosure fences unchanged. Leave Responses behavior unchanged unless separately justified.

## Required acceptance tests before any implementation can be accepted

- Both-provider warm-policy Resume: retained old turn preserves its former mode; actual new execution is read-only, with existing positive controls intact.
- Revision/epoch change after snapshot creation: no stale admission, write, tool execution, or output disclosure.
- User/tool payloads containing permission tags do not gain authority.
- Forged per-part metadata, unknown/legacy provenance, hooks, and unrelated late developer messages remain rejected.
- Mixed-content messages cannot lose, reorder, downgrade, or promote adjacent fragments.
- Conversation, tool-call/result order, and retained transcript remain unchanged; no duplicate policy publication or invented historical authorization.
- Retry, compaction, Resume, and process restart cannot reuse a stale snapshot or promote legacy content.
- Native permission enforcement remains authoritative even if a model misinterprets the historical timeline.
- No provider fallback and no relaxation of the generic late-system guard.

Until an approved design is implemented and these checks pass, keep the warm-policy Messages gate explicitly open.
