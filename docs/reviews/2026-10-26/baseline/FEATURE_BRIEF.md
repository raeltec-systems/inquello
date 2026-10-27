# ChatGPT Work + Codex study: auditor workflow adaptation

## Scope and evidence quality

This is a documentation-led study of ChatGPT Work and Codex, using OpenAI's public Work and Codex documentation plus the public `openai/codex` repository. We did not operate a signed-in Work or Codex client or observe a live audit workflow. Claims about each product are limited to documented behavior and public source; undocumented implementation details remain unknown.

The study has two primary evidence streams. Work documentation describes its task-oriented workflows and reviewable outputs. Codex documentation and the public repository describe Codex's user-facing capabilities and its open agent harness: execution, tools, state, context, clients, integrations, and controls. OpenAI's Enterprise/Edu Work Overview says Work and Codex share some core execution, isolation, and permission mechanisms, but the repository is not the implementation of ChatGPT Work.

The user's hypothesis is to combine ideas from both: Work's task workflows with Codex's powerful agent capabilities, then adapt or extend them into a general auditor's tool. It should adjust to how practitioners work across internal audit, external audit, advisory, IT/IS audit, industries, and methodologies. The IIA crosswalk below is one illustrative internal-audit lens, not the product's boundary or a universal workflow. This is a research lens, not a selected design or architecture. The Work inventory is in [FEATURE_CATALOG.md](FEATURE_CATALOG.md); the broader Codex capability and public implementation map is in [CODEX_CAPABILITY_CATALOG.md](CODEX_CAPABILITY_CATALOG.md).

## Documented ChatGPT Work behavior

OpenAI presents Work as a task-oriented experience for substantial work with a clear outcome, sources, constraints, and review criteria. A user can follow progress, answer questions, change direction, and approve important actions. Work can use available files, connected apps, plugins, and tools to produce reviewable outputs. Projects provide a place to keep related chats, files, and instructions together. Some tasks can be scheduled or triggered by supported events, subject to access and workspace controls.

Execution and access vary by task mode and permissions. Work may run locally or in the cloud; local access, connected apps, browser actions, and network access have distinct permissions. A cloud task does not automatically inherit local files or logged-in browser sessions. The public materials also distinguish conversation storage, files, connected-app data, and audit visibility. These are product-specific behaviors, not assumptions about any future auditor-focused tool.

## Illustrative internal-audit workflow basis

This example engagement lifecycle is adapted from the IIA's 2024 Global Internal Audit Standards. It illustrates one practice area only; it does not constrain the product to internal audit, the IIA, or a single industry/methodology, and the Standards do not prescribe a particular app design:

1. **Plan:** establish engagement type, objectives, scope, timing, risk assessment, evaluation criteria, and resources.
2. **Approve work program:** connect risks and controls to procedures, methods, tools, ownership, and criteria; retain CAE approval before fieldwork and approval of changes.
3. **Perform and document:** collect evidence and record how each test was performed. Keep source, date, scope, population/sample, and workpaper references visible so another auditor can retrace the work.
4. **Analyze and evaluate:** assess whether information is relevant, reliable, and sufficient; compare criteria with condition; distinguish source facts, calculations, auditor evaluation, and AI suggestions. If further analysis is needed, update the work program and obtain CAE approval. Evaluate finding cause, effect, likelihood, impact, and significance.
5. **Conclude, review, and report:** summarize results against engagement and management objectives, work with management on recommendations/actions, use the established process to hear both parties' positions and rationale and determine resolution if they disagree, then prepare final communication for CAE approval.
6. **Follow up:** inquire about progress, perform risk-based verification, update action status, and document/escalate overdue actions under the CAE's methodology.

The IIA's 2024 Standards make supervisory review/quality evidence explicit (Standard 12.3), require an approved work program (13.6), relevant/reliable/sufficient information (14.1), CAE approval when additional analyses change the program (14.2), finding evaluation (14.3), a process for resolving disagreements with management (14.4), conclusions (14.5), reperformable documentation with CAE review/approval (14.6), approved final communication (15.1), and risk-based action-plan follow-up (15.2). This study uses those clauses as one workflow example, not as a substitute for the full Standards or as a universal product requirement. Roles, terms, methods, and controls should be adaptable to the practitioner’s audit or advisory setting.

## Auditor-adaptable product lens

The study maps Work and Codex capabilities to auditor workflows without treating those mappings as observed audit-product behavior or settled requirements. The product should let practitioners tailor procedures, terminology, criteria, review roles, outputs, and connections to their practice area, organization, industry, and chosen methodology. The IIA crosswalk is illustrative. The user's product hypothesis now includes two modes: one that works with the practitioner's existing system of record, and one that provides a built-in Diligent-like audit record system. The inventories are [FEATURE_CATALOG.md](FEATURE_CATALOG.md) and [CODEX_CAPABILITY_CATALOG.md](CODEX_CAPABILITY_CATALOG.md).

## Emerging product hypothesis: conversational end-to-end audit work

The user's current direction is to blend the audit capabilities studied in Diligent's Audit and Projects apps with a Codex-like conversational work platform. The auditor should be able to direct and carry work through the full engagement in one conversational environment. This is a product hypothesis for continued research, not a selected interface, architecture, implementation, or promise that every auditor workflow will be automated.

The two reference points contribute different things to the hypothesis:

- **Codex-like work surface and agent capabilities:** conversation to frame outcomes and constraints; task and project context; access to files, data, and tools; analysis and code execution where useful; specialized agents and reusable skills; the ability to steer, review, and resume work; and reviewable output artifacts.
- **Audit-domain workflow coverage:** engagement setup and planning; risk and scope; objectives, controls, and procedures; evidence requests and collection; testing and analysis; workpapers and review; findings and management response; remediation follow-up; conclusions and reporting.

An illustrative end-to-end work cycle is: an auditor describes the engagement and expected output; the platform helps organize the relevant context and work plan; the auditor and agents perform analysis and fieldwork with traceable links to source material; review and approval points appear when the practitioner's process calls for them; and the platform either packages work for transfer to an external record system or carries the work through its built-in audit record objects and workflows. The auditor remains responsible for professional judgments and approvals.

“End to end in the platform” means the practitioner can use the platform to carry out and coordinate the work across those phases. The user has specified two modes: (1) an external-record mode, where the practitioner keeps their own system of record and uses the platform for work and outputs; and (2) a built-in-record mode, where the platform provides a Diligent-like audit record system. In both modes the Codex-like conversational work layer supports the end-to-end activity. Which mode applies, and whether the choice is made per organization, workspace, or engagement, remains open for research. The study should test which Codex capabilities support this work cycle, which Diligent workflows provide useful audit-domain examples, and what other audit products do differently.

## Current phase and open questions

This phase is limited to scouting and evidence review. The Codex inventory now covers the full documented capability scope pursued in this pass—not only execution, analysis, agents, memory, or context, but product surfaces, interaction model, agent harness, clients and protocols, tools and integrations, execution environments, context and persistence, collaboration, customization, review, scheduling, publishing, administration, and security boundaries. The catalog has been reconciled against the public documentation index, relevant product and command references, changelog material, and public repository areas. It contains 75 capability entries plus three product-lens entries. The [Claude Code crosswalk](CODEX_CLAUDE_CODE_CROSSWALK.md) maps all 78 entries against Anthropic's official documentation, while [Claude Cowork](CLAUDE_COWORK_CATALOG.md) is tracked separately as a workflow-layer comparison. The [developer-to-auditor analogy map](DEVELOPER_AUDITOR_ANALOGIES.md) relates the product questions to developer workflows and records how Codex handles them today; it does not narrow the full capability study.

The market-product review has started with Diligent. [DILIGENT_AUDIT_STUDY.md](DILIGENT_AUDIT_STUDY.md) maps its documented audit workflows, roles, object lifecycles, review states, automation, AI claims, integrations, and public-source limits. It distinguishes Diligent's newer control-testing Audit app from its broader Projects execution workflow, and separates help-center evidence from vendor marketing. The [Diligent-to-Codex crosswalk](DILIGENT_CODEX_CROSSWALK.md) compares all Codex catalog capabilities with Diligent's documented audit workflows and makes the two record-system modes explicit. This remains a scout-and-review phase; no design, architecture, or implementation is being selected.

Remaining open questions are evidence or future-planning questions: how current UI flows behave in authorized signed-in sessions across different clients and account policies; which features or controls vary by rollout, platform, and workspace; what Work's or Diligent's private implementation does; which Codex, agent-tool, or audit-platform patterns should be adapted, changed, or omitted; what additional market tools should be compared; and which practitioner workflows, authority models, and output destinations should be explored first once planning begins. The public-source inventories are broad capability maps, not verified exhaustive accounts of proprietary internals or screen-by-screen behavior. No interface, architecture, technology stack, implementation, methodology, or system-of-record design is being selected. The product hypothesis includes both integration with the practitioner's existing system of record and a built-in Diligent-like audit record mode; mode selection and scope remain open.

The comparison is documented in [DEVELOPER_AUDITOR_ANALOGIES.md](DEVELOPER_AUDITOR_ANALOGIES.md). The Diligent-to-Codex capability crosswalk is in [DILIGENT_CODEX_CROSSWALK.md](DILIGENT_CODEX_CROSSWALK.md). Both treat audit practice, industry, and methodology as customization dimensions and compare work/output handoff in external-record mode with native records in built-in-record mode.

Product principles captured from the user: support different audit/advisory practice areas, industries, and methodologies through tailoring; provide a Codex-like conversational way to carry audit work end to end; and offer both a mode that uses the practitioner's own system of record and a mode with a built-in Diligent-like audit record system. The IIA reference is an example, not a required default. Public materials do not reveal Work's private implementation.

## Sources

- [Get started with ChatGPT Work](https://learn.chatgpt.com/docs/get-started-with-work)
- [ChatGPT Work and Codex](https://help.openai.com/en/articles/20001275-chatgpt-work-and-codex)
- [ChatGPT Work Overview: execution, access, privacy, retention, and audit visibility](https://learn.chatgpt.com/docs/enterprise/chatgpt-work-overview)
- [Long-running work](https://learn.chatgpt.com/docs/long-running-work)
- [OpenAI Codex repository](https://github.com/openai/codex) (Codex CLI/app-server reference; not ChatGPT Work source)
- [Codex capability catalog](CODEX_CAPABILITY_CATALOG.md) (Codex product surfaces, public harness and integration map, and audit-oriented research lens)
- [Codex as a platform](https://developers.openai.com/blog/codex-as-a-platform) (OpenAI's description of the open agent harness and host-application integration boundary)
- [Codex CLI](https://learn.chatgpt.com/docs/codex/cli)
- [Codex App Server](https://learn.chatgpt.com/docs/app-server)
- [Codex SDK](https://learn.chatgpt.com/docs/codex-sdk)
- [Codex subagents](https://learn.chatgpt.com/docs/agent-configuration/subagents)
- [Codex customization](https://learn.chatgpt.com/docs/customization/overview) and [Codex memories](https://learn.chatgpt.com/docs/customization/memories)
- [Codex core README](https://github.com/openai/codex/blob/main/codex-rs/core/README.md)
- [Codex app-server README](https://github.com/openai/codex/blob/main/codex-rs/app-server/README.md)
- [The IIA: Complete Global Internal Audit Standards](https://www.theiia.org/en/content/standards/complete-global-internal-audit-standards/)
- [The IIA: Global Internal Audit Standard 13.6 Work Program](https://www.theiia.org/globalassets/site/standards/globalinternalauditstandards_2024january9.pdf)
