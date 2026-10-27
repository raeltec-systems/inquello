# Codex methodology mechanisms: pinned source traces

Checked October 26, 2026. Repository: `openai/codex`. Revision: `970111f6cb62cc02fe36a82ea7d71b37a2889c97`, returned for `main` during this pass; commit timestamp October 23. Evidence below is **source inspection**, not observed execution or passing tests. The scout stayed read-only; the parent saved these research notes.

## T1 — Standing instructions become attributed context

`load_project_instructions` checks trust, reads through the selected execution environments and applies a shared byte budget. An untrusted project contributes no discovered project instructions. Restricted-filesystem discovery errors propagate. `agents_md_paths` walks root-to-working-directory, considering override, ordinary and configured fallback filenames; loaded entries retain their path/environment/working-directory origin. Budget exhaustion can truncate the material. [Loading and discovery](https://github.com/openai/codex/blob/970111f6cb62cc02fe36a82ea7d71b37a2889c97/codex-rs/core/src/agents_md.rs#L58-L299), [provenance and rendering](https://github.com/openai/codex/blob/970111f6cb62cc02fe36a82ea7d71b37a2889c97/codex-rs/core/src/agents_md.rs#L378-L499)

`AgentsMdManager::refresh` serialises refreshes and checks a coherent snapshot. Environment/trust changes affect repository reload; user/thread providers can refresh separately. Tightened access invalidates the cached repository snapshot before rediscovery. Host-supplied thread guidance has a separate estimated 10,000-token limit. Subagents inherit applied guidance, with explicit control of thread-provider sharing. The text becomes a user-role context fragment. [Snapshot manager](https://github.com/openai/codex/blob/970111f6cb62cc02fe36a82ea7d71b37a2889c97/codex-rs/core/src/agents_md_manager.rs#L68-L203), [context wrapper](https://github.com/openai/codex/blob/970111f6cb62cc02fe36a82ea7d71b37a2889c97/codex-rs/core/src/context/user_instructions.rs#L8-L42)

**Audit inference:** retain the effective instruction snapshot and provenance when a result is relied upon. Instructions are not execution permissions. **Still unverified:** exact refresh timing after an ordinary file edit in each client; interaction with compaction, resumed sessions and changing work environments. Documentation's startup explanation should not be treated as a complete implementation specification.

## T2 — Skills move from discovery to selected context

Root resolution combines repository skill locations with supported user/system/plugin/extra roots and scope metadata. The host loader reads `SKILL.md` and parses its frontmatter plus optional interface/dependency/policy information. [Root resolution](https://github.com/openai/codex/blob/970111f6cb62cc02fe36a82ea7d71b37a2889c97/codex-rs/ext/skills/src/host_roots.rs#L28-L184), [host parsing](https://github.com/openai/codex/blob/970111f6cb62cc02fe36a82ea7d71b37a2889c97/codex-rs/ext/skills/src/loader/host.rs#L346-L393)

Explicit selection resolves structured references, paths and `$name` mentions. A plain name requires an unambiguous match without a connector-name collision; disabled skills are skipped. Turn integration loads selected instructions, surfaces warnings and creates context items. Discovery and execution are therefore separate stages. [Selection](https://github.com/openai/codex/blob/970111f6cb62cc02fe36a82ea7d71b37a2889c97/codex-rs/skills/src/selection.rs#L33-L199), [turn integration](https://github.com/openai/codex/blob/970111f6cb62cc02fe36a82ea7d71b37a2889c97/codex-rs/core/src/session/turn.rs#L1164-L1206)

The catalog budget normally uses 2% of model context, with an 8,000-character fallback when the context window is unknown; configured budgets cap at 10,000 tokens. Descriptions can shorten and catalog entries can be omitted. Relevant plugin/extension main-prompt paths have a separate 8,000-byte truncation; it is not a universal cap on all selected host skill instructions. Read failures become warnings. [Catalog rendering](https://github.com/openai/codex/blob/970111f6cb62cc02fe36a82ea7d71b37a2889c97/codex-rs/ext/skills/src/render.rs#L20-L154), [host prompt loading](https://github.com/openai/codex/blob/970111f6cb62cc02fe36a82ea7d71b37a2889c97/codex-rs/ext/skills/src/host_prompt.rs#L60-L108)

**Audit inference:** expose the selected procedure, its references and omissions; test explicit and implicit triggering. **Still unverified:** model selection reliability, duplicate-name user experience, absent scripts/connectors, changed skills during a task and team distribution/update behavior. Loading a procedure cannot prove that it was followed correctly.

## T3 — Prior work becomes selective memory

Memory startup excludes ephemeral and non-root-agent sessions and depends on feature/state/quota checks. Phase 1 claims bounded eligible rollouts with age, idle, source and lease conditions; it filters and redacts content before model upload. These paths do not imply that every chat contributes or that the entire store stays on-device during processing. [Startup](https://github.com/openai/codex/blob/970111f6cb62cc02fe36a82ea7d71b37a2889c97/codex-rs/memories/write/src/start.rs#L20-L93), [selection](https://github.com/openai/codex/blob/970111f6cb62cc02fe36a82ea7d71b37a2889c97/codex-rs/memories/write/src/phase1.rs#L119-L155), [serialization](https://github.com/openai/codex/blob/970111f6cb62cc02fe36a82ea7d71b37a2889c97/codex-rs/memories/write/src/phase1.rs#L398-L423)

The consolidation worker disables recursive collaboration and memory generation/use. Its restricted memory-root/no-network profile applies when the parent has managed permissions; disabled or externally managed parent permission profiles are preserved. It would be inaccurate to describe every consolidation run as always sandboxed/no-network. [Worker configuration](https://github.com/openai/codex/blob/970111f6cb62cc02fe36a82ea7d71b37a2889c97/codex-rs/memories/write/src/phase2.rs#L310-L369)

Read-side injection independently checks `use_memories`, loads a summary and bounds it to 2,500 tokens. Missing or empty summaries add nothing. [Read extension](https://github.com/openai/codex/blob/970111f6cb62cc02fe36a82ea7d71b37a2889c97/codex-rs/ext/memories/src/extension.rs#L45-L103), [summary loading](https://github.com/openai/codex/blob/970111f6cb62cc02fe36a82ea7d71b37a2889c97/codex-rs/ext/memories/src/prompts.rs#L31-L63), [limit](https://github.com/openai/codex/blob/970111f6cb62cc02fe36a82ea7d71b37a2889c97/codex-rs/ext/memories/src/lib.rs#L16)

**Audit inference:** memory is selective recall, not an authoritative procedure or evidence store. **Still unverified:** multi-client confidentiality boundaries, revoked access, stale conclusions, deletion propagation and reliable exclusion of case evidence from shared methods.

## T4 — Roles and policy take different paths

Custom roles validate descriptions/instructions, tailor model behavior and disable supported capabilities without replacing parent authority. Command policy separately produces forbidden, approval-required or allowed outcomes. [Roles](https://github.com/openai/codex/blob/970111f6cb62cc02fe36a82ea7d71b37a2889c97/codex-rs/core/src/agent/role.rs#L1-L126), [execution policy](https://github.com/openai/codex/blob/970111f6cb62cc02fe36a82ea7d71b37a2889c97/codex-rs/core/src/exec_policy.rs#L399-L465)

**Audit inference:** methodology prose, permission enforcement, calculation checks and human approval require distinct treatment. This is an adaptation finding, not an implemented control.

## Source drift and limits

Current instructions live in `core/src/agents_md.rs` and `agents_md_manager.rs`; skills span `ext/skills` and `skills`; memory writes are in `memories/write`. Older paths such as `project_doc.rs` or the memory README's `core/src/memories` reference must not be used as current implementation evidence. The traces cover representative mechanisms, not all Codex code, client flows or audit suitability.
