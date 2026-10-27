# Comparative agent-tool study

**Research cut-off:** October 23, 2026  
**Phase:** scouting and feature review only. This document does not select product design, architecture, or implementation.

## Why compare other tools

The study maps Codex and ChatGPT Work capability by capability, compares relevant concepts with other agent products, and now includes commercial audit platforms. The goal is to understand what each product can do, how it is designed and operated, what is documented or inspectable, and which approaches may be useful for an auditor-focused conversational work platform with both external-record integration and a built-in audit record mode. A comparison should surface alternatives and trade-offs; it should not assume Codex is the only reference or that another tool's feature is automatically superior.

Claude Code is the developer-tool comparison: it is a general-purpose coding agent with official documentation for its agent loop, extensions, context, permissions, sessions, and surfaces. The crosswalk of all 78 entries in the current Codex map (75 capability rows plus three product-lens rows) is in [CODEX_CLAUDE_CODE_CROSSWALK.md](CODEX_CLAUDE_CODE_CROSSWALK.md); it distinguishes documented analogues from partial matches and features for which no counterpart was found in the official material reviewed.

Claude Cowork is a separate, closer workflow-layer comparison to ChatGPT Work. Anthropic documents it as a way to delegate multi-step work across files and connected services, produce reviewable outputs, and use skills, plugins, connectors, and subagents. Its current execution model has changed recently: new Pro/Max sessions run in the cloud by default, while some earlier local sessions remain; rollout and availability differ by plan and organization. The product is also being unified with Chat. See [CLAUDE_COWORK_CATALOG.md](CLAUDE_COWORK_CATALOG.md) for a separate feature inventory and current evidence boundaries. This does not imply Cowork and Claude Code share the same implementation, or that either product's internals are public.

Commercial audit platforms are a separate comparison lens: they document audit-specific lifecycle workflows that general agent tools do not necessarily provide. [DILIGENT_AUDIT_STUDY.md](DILIGENT_AUDIT_STUDY.md) is the first market-product study, based on Diligent's official product material, Help Center, release notes, developer resources, and public GitHub repositories. It separates the newer control-testing Audit app from the broader Projects workflow and distinguishes documented behavior from marketing claims. The public GitHub repositories did not expose the audit product implementation; the Developer Portal documents customer-facing APIs, connectors, scripts, and toolkits instead.

## Claude Code: public repository versus product source

Anthropic maintains an official, publicly accessible GitHub repository named [`anthropics/claude-code`](https://github.com/anthropics/claude-code). Its published top-level contents include plugin/command directories, examples, mods, scripts, a changelog, and setup material. The README directs users to the official product documentation. The repository's `LICENSE.md` states that all rights are reserved and use is subject to Anthropic's commercial terms. Therefore:

- There is an official public repository that is useful evidence for released plugins, examples, commands, scripts, and version history.
- The repository is not, on the evidence inspected, a source release of the Claude Code product implementation. Public accessibility alone does not make it open-source software or grant reuse rights.
- Product internals should be studied through Anthropic's official docs, released repository contents, changelog, and, if available, authorized product observation. This research does not rely on unofficial copies or leaked source material.

The product documentation describes Claude Code as available through terminal, IDE, desktop, and web surfaces. It documents a gather-context / take-action / verify-results loop, built-in tools, and extension points. The extension model includes persistent instructions, output styles, skills, code intelligence, MCP, subagents, dynamic workflows, cross-session messaging, hooks, and plugins. Some collaboration capabilities, such as agent teams, are documented as experimental. The row-by-row crosswalk is complete for the current Codex catalog; it is not a hands-on benchmark or exhaustive inventory of every Claude Code behavior.

The same repository does not provide Claude Cowork's implementation source. For Cowork, use Anthropic's official product/help/security documentation, current rollout notes, released plugins and agent templates, and authorized product observation. Keep older engineering descriptions of Cowork's local VM separate from the current cloud-default experience; the two describe different execution paths and points in the product's evolution.

## Comparison coverage

Maintain Codex and Work as the primary references. For each additional tool, compare the same feature families where the evidence supports it:

1. Product surfaces, user entry points, navigation, and supported platforms.
2. Task/session/thread lifecycle, task framing, planning, steering, interruption, resumption, and completion.
3. Agent loop, model/tool orchestration, command execution, file access, and verification behavior.
4. Context construction, project/workspace boundaries, instruction hierarchy, memory, context limits, and compaction.
5. Specialized agents, parallel delegation, agent-to-agent communication, coordination, shared tasks, and result synthesis.
6. Skills, prompts, plugins, hooks, extensions, marketplaces, and project/team customization.
7. External sources, MCP/connectors, browsers, computer use, and identity/authorization boundaries.
8. Local, isolated, remote, hosted, and cloud execution; filesystem/network boundaries; permissions and approvals.
9. Outputs, artifacts, diffs, review surfaces, sharing, publishing, and handoff to external record systems or persistence in a built-in audit record mode.
10. API/SDK/protocol/CLI integration, automation, scheduled or event-triggered tasks, and embedding in another application.
11. Security, privacy, data handling, retention, telemetry, administration, policy, and audit visibility.
12. Accessibility, input modalities, visual/file handling, availability by platform/account, and product-specific workflow conveniences.

For audit-platform comparisons, also track the engagement lifecycle, evidence and workpaper handling, evidence requests, risk/control mapping, reviewer and management approvals, findings and remediation, analytics and monitoring, reusable templates, role boundaries, exports/integrations, availability/pricing evidence, and each product's system-of-record assumptions. These dimensions inform the user's two-mode hypothesis: connect to a practitioner's existing record system, or provide a built-in Diligent-like audit record system. They are research inputs, not a settled design or a requirement to reproduce Diligent exactly.

Codex's current catalog already spans these domains; this comparison extends that coverage rather than replacing or narrowing it. Keep the Claude Code crosswalk focused on developer/runtime capabilities and study Cowork separately for task-oriented product behavior. Features that are absent, experimental, plan-limited, undocumented, or client-specific should be recorded explicitly rather than treated as universal.

## Evidence and comparison method

Prefer primary evidence: official product documentation, official repositories and licenses, release notes, API references, and authorized observation of a product session. Label evidence by type:

- **Documented:** stated in official documentation or an official repository.
- **Observed:** directly reproduced in an authorized product session, with version, platform, account/plan context, and conditions recorded.
- **Inferred:** a reasoned interpretation of documented or observed behavior; explain the basis.
- **Unknown:** not established by available evidence.

For each feature, compare: user problem; entry point; required context and permissions; sequence of actions; agent/tool behavior; user-visible progress; approval and review moments; output; persistence; error/recovery behavior; maturity/availability; and evidence strength. Then assess possible auditor relevance as an open research question, including when a developer-oriented pattern does not map cleanly to audit work.

The October 26 [research review](RESEARCH_REVIEW.md) adds two required research checks: reverse inventories starting from each comparator's own capabilities and actual auditor outcomes, and a reproducible claim ledger with exact sources, checked dates, pinned code revisions where applicable, product/account conditions, evidence class, and residual uncertainty. Workflow similarity, evidence quality, and reuse feasibility are separate assessments. Current choices and recommendations are maintained in [OPEN_QUESTIONS.md](OPEN_QUESTIONS.md); recommendations are not accepted decisions.

## First Claude Code documentation sources

- [Claude Code overview](https://code.claude.com/docs/en/overview) — product surfaces and broad capability framing.
- [How Claude Code works](https://code.claude.com/docs/en/how-claude-code-works) — documented agent loop and built-in tool model.
- [Extend Claude Code](https://code.claude.com/docs/en/features-overview) — extension concepts and their roles in the agent loop.
- [Settings and precedence](https://code.claude.com/docs/en/settings) — user/project/managed settings and configuration precedence.
- [Memory and project instructions](https://code.claude.com/docs/en/memory) — `CLAUDE.md`, `AGENTS.md` support, and auto memory.
- [Custom subagents](https://code.claude.com/docs/en/sub-agents) — custom agents, tool access, isolated contexts, and delegation.
- [Agent teams](https://code.claude.com/docs/en/agent-teams) — session teams, coordination, and current experimental status.
- [Permissions](https://code.claude.com/docs/en/permissions) — fine-grained rules, modes, and managed policies.
- [Hooks](https://code.claude.com/docs/en/hooks) — lifecycle events and hook behavior.
- [Skills](https://code.claude.com/docs/en/skills), [MCP](https://code.claude.com/docs/en/mcp), and [plugins](https://code.claude.com/docs/en/plugins) — reusable workflows, external tools, and packaging.
- [CLI reference](https://code.claude.com/docs/en/cli-reference) — commands, sessions, automation, and integration surface.
- [Official Claude Code repository](https://github.com/anthropics/claude-code) and its [license](https://raw.githubusercontent.com/anthropics/claude-code/main/LICENSE.md) — published project contents and terms.

Related research notes: [Codex capability catalog](CODEX_CAPABILITY_CATALOG.md), [ChatGPT Work feature catalog](FEATURE_CATALOG.md), [Claude Cowork catalog](CLAUDE_COWORK_CATALOG.md), and [developer-to-auditor analogies](DEVELOPER_AUDITOR_ANALOGIES.md).
