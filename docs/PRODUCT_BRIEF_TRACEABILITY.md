# Inquello product brief — scope traceability

> **2026-10-27 planning supersession:** The current [SPEC and its companions](../_bmad-output/specs/spec-inquello/SPEC.md), especially [collaboration, institutional memory and review](../_bmad-output/specs/spec-inquello/collaboration-and-memory.md), govern later confirmed decisions: hybrid local execution/shared Inquello authority; private Tasks and explicit granular sharing; team-wide admitted internal-company memory; first-team-increment revocation; and agent-assisted human-controlled review. Earlier unselected-topology, all-retained-extract visibility, personal-only recall or manual-only review implications are superseded, not current defaults. External-audit client/independence boundaries and detailed service choices remain open. The original research/inventory below is preserved; its coverage is not runtime acceptance.


**Date:** October 26, 2026. This appendix links the researched inventory to proposed requirements in the [product definition addendum](addendum.md), accompanying the [product brief](PRODUCT_BRIEF_V0_1.md). It verifies reference coverage, not implementation, service eligibility or passing acceptance.

**Accepted phasing:** V1 is the full Codex-derived workbench using external record systems and working files. V2 adds built-in authoritative audit records and their lifecycle. The domain-mode deferral removes no Codex capability from the V1 mirror inventory.

All 79 existing C entries are assigned a primary requirement: 76 capability groups and three composition lenses. All 20 E behaviors are assigned. The 270 subfeature mappings and 93 proposed enhancements remain scope inputs through their detailed feature cards; this group-level check is not a separate validation of every subfeature. Cross-cutting requirements may apply in addition to the primary assignment.

## Existing capability inventory

| Source ID | Researched feature | Primary brief requirement | Entry type |
| --- | --- | --- | --- |
| [C01](CODEX_AUDITOR_FEATURE_MIRROR.md#c01) | Codex in the ChatGPT desktop app | [P01](addendum.md#7-functional-scope) | Capability group |
| [C02](CODEX_AUDITOR_FEATURE_MIRROR.md#c02) | Projects, chats, and navigation | [P01](addendum.md#7-functional-scope) | Capability group |
| [C03](CODEX_AUDITOR_FEATURE_MIRROR.md#c03) | Codex CLI | [P02](addendum.md#7-functional-scope) | Capability group |
| [C04](CODEX_AUDITOR_FEATURE_MIRROR.md#c04) | CLI command and session controls | [P02](addendum.md#7-functional-scope) | Capability group |
| [C05](CODEX_AUDITOR_FEATURE_MIRROR.md#c05) | Agent Command Center (`codex agents`) | [P01](addendum.md#7-functional-scope) | Capability group |
| [C06](CODEX_AUDITOR_FEATURE_MIRROR.md#c06) | IDE extension | [P02](addendum.md#7-functional-scope) | Capability group |
| [C07](CODEX_AUDITOR_FEATURE_MIRROR.md#c07) | Codex Cloud | [P03](addendum.md#7-functional-scope) | Capability group |
| [C08](CODEX_AUDITOR_FEATURE_MIRROR.md#c08) | Mobile and remote control | [P02](addendum.md#7-functional-scope) | Capability group |
| [C09](CODEX_AUDITOR_FEATURE_MIRROR.md#c09) | Codex Micro hardware controls | [P02](addendum.md#7-functional-scope) | Capability group |
| [C10](CODEX_AUDITOR_FEATURE_MIRROR.md#c10) | Local, worktree, and cloud environments | [P03](addendum.md#7-functional-scope) | Capability group |
| [C11](CODEX_AUDITOR_FEATURE_MIRROR.md#c11) | Agent harness / tool loop | [P04](addendum.md#7-functional-scope) | Capability group |
| [C12](CODEX_AUDITOR_FEATURE_MIRROR.md#c12) | Parallel independent read-only lookups | [P04](addendum.md#7-functional-scope) | Capability group |
| [C13](CODEX_AUDITOR_FEATURE_MIRROR.md#c13) | Threads and turns | [P01](addendum.md#7-functional-scope) | Capability group |
| [C14](CODEX_AUDITOR_FEATURE_MIRROR.md#c14) | Progress, steering, and interruption | [P04](addendum.md#7-functional-scope) | Capability group |
| [C15](CODEX_AUDITOR_FEATURE_MIRROR.md#c15) | Plan mode and task lists | [P04](addendum.md#7-functional-scope) | Capability group |
| [C16](CODEX_AUDITOR_FEATURE_MIRROR.md#c16) | Goals and long-running tasks | [P04](addendum.md#7-functional-scope) | Capability group |
| [C17](CODEX_AUDITOR_FEATURE_MIRROR.md#c17) | Background tasks and parallel work | [P04](addendum.md#7-functional-scope) | Capability group |
| [C18](CODEX_AUDITOR_FEATURE_MIRROR.md#c18) | Repository and file understanding | [P05](addendum.md#7-functional-scope) | Capability group |
| [C19](CODEX_AUDITOR_FEATURE_MIRROR.md#c19) | Code and shell execution | [P06](addendum.md#7-functional-scope) | Capability group |
| [C20](CODEX_AUDITOR_FEATURE_MIRROR.md#c20) | Code Mode | [P06](addendum.md#7-functional-scope) | Capability group |
| [C21](CODEX_AUDITOR_FEATURE_MIRROR.md#c21) | File creation and editing | [P07](addendum.md#7-functional-scope) | Capability group |
| [C22](CODEX_AUDITOR_FEATURE_MIRROR.md#c22) | Images and visual inputs | [P05](addendum.md#7-functional-scope) | Capability group |
| [C23](CODEX_AUDITOR_FEATURE_MIRROR.md#c23) | Image generation and editing | [P07](addendum.md#7-functional-scope) | Capability group |
| [C24](CODEX_AUDITOR_FEATURE_MIRROR.md#c24) | Composer Predictions | [P05](addendum.md#7-functional-scope) | Capability group |
| [C25](CODEX_AUDITOR_FEATURE_MIRROR.md#c25) | Web search, built-in browser, browser extension, and Computer Use | [P08](addendum.md#7-functional-scope) | Capability group |
| [C26](CODEX_AUDITOR_FEATURE_MIRROR.md#c26) | Browser annotations and site integration API | [P05](addendum.md#7-functional-scope) | Capability group |
| [C27](CODEX_AUDITOR_FEATURE_MIRROR.md#c27) | Appshots | [P05](addendum.md#7-functional-scope) | Capability group |
| [C28](CODEX_AUDITOR_FEATURE_MIRROR.md#c28) | Analysis and code review | [P09](addendum.md#7-functional-scope) | Capability group |
| [C29](CODEX_AUDITOR_FEATURE_MIRROR.md#c29) | Codex Security scans and workbench | [P09](addendum.md#7-functional-scope) | Capability group |
| [C30](CODEX_AUDITOR_FEATURE_MIRROR.md#c30) | Desktop editor and PR Chat | [P07](addendum.md#7-functional-scope) | Capability group |
| [C31](CODEX_AUDITOR_FEATURE_MIRROR.md#c31) | Generated outputs and previews | [P07](addendum.md#7-functional-scope) | Capability group |
| [C32](CODEX_AUDITOR_FEATURE_MIRROR.md#c32) | Sites and hosted app outputs | [P07](addendum.md#7-functional-scope) | Capability group |
| [C33](CODEX_AUDITOR_FEATURE_MIRROR.md#c33) | Built-in tools | [P11](addendum.md#7-functional-scope) | Capability group |
| [C34](CODEX_AUDITOR_FEATURE_MIRROR.md#c34) | Connected apps and app catalog | [P11](addendum.md#7-functional-scope) | Capability group |
| [C35](CODEX_AUDITOR_FEATURE_MIRROR.md#c35) | MCP servers and connected tools | [P11](addendum.md#7-functional-scope) | Capability group |
| [C36](CODEX_AUDITOR_FEATURE_MIRROR.md#c36) | Plugins and marketplaces | [P11](addendum.md#7-functional-scope) | Capability group |
| [C37](CODEX_AUDITOR_FEATURE_MIRROR.md#c37) | Skills | [P10](addendum.md#7-functional-scope) | Capability group |
| [C38](CODEX_AUDITOR_FEATURE_MIRROR.md#c38) | Record & Replay | [P10](addendum.md#7-functional-scope) | Capability group |
| [C39](CODEX_AUDITOR_FEATURE_MIRROR.md#c39) | Repository instructions and configuration | [P10](addendum.md#7-functional-scope) | Capability group |
| [C40](CODEX_AUDITOR_FEATURE_MIRROR.md#c40) | Hooks | [P11](addendum.md#7-functional-scope) | Capability group |
| [C41](CODEX_AUDITOR_FEATURE_MIRROR.md#c41) | App-server protocol | [P11](addendum.md#7-functional-scope) | Capability group |
| [C42](CODEX_AUDITOR_FEATURE_MIRROR.md#c42) | Client-supplied dynamic tools (app-server) | [P11](addendum.md#7-functional-scope) | Capability group |
| [C43](CODEX_AUDITOR_FEATURE_MIRROR.md#c43) | Codex SDK, non-interactive execution, and GitHub Action | [P12](addendum.md#7-functional-scope) | Capability group |
| [C44](CODEX_AUDITOR_FEATURE_MIRROR.md#c44) | Task entry points from connected services | [P12](addendum.md#7-functional-scope) | Capability group |
| [C45](CODEX_AUDITOR_FEATURE_MIRROR.md#c45) | Subagents | [P13](addendum.md#7-functional-scope) | Capability group |
| [C46](CODEX_AUDITOR_FEATURE_MIRROR.md#c46) | Side chats, fork, and task references | [P13](addendum.md#7-functional-scope) | Capability group |
| [C47](CODEX_AUDITOR_FEATURE_MIRROR.md#c47) | Worktrees and concurrent tasks | [P03](addendum.md#7-functional-scope) | Capability group |
| [C48](CODEX_AUDITOR_FEATURE_MIRROR.md#c48) | Active context and compaction | [P14](addendum.md#7-functional-scope) | Capability group |
| [C49](CODEX_AUDITOR_FEATURE_MIRROR.md#c49) | Conversation persistence and history | [P14](addendum.md#7-functional-scope) | Capability group |
| [C50](CODEX_AUDITOR_FEATURE_MIRROR.md#c50) | Memory | [P14](addendum.md#7-functional-scope) | Capability group |
| [C51](CODEX_AUDITOR_FEATURE_MIRROR.md#c51) | Computer History | [P14](addendum.md#7-functional-scope) | Capability group |
| [C52](CODEX_AUDITOR_FEATURE_MIRROR.md#c52) | Durable instructions vs memory vs skills | [P10](addendum.md#7-functional-scope) | Capability group |
| [C53](CODEX_AUDITOR_FEATURE_MIRROR.md#c53) | Usage, models, speed, and reasoning controls | [P15](addendum.md#7-functional-scope) | Capability group |
| [C54](CODEX_AUDITOR_FEATURE_MIRROR.md#c54) | Amazon Bedrock provider | [P15](addendum.md#7-functional-scope) | Capability group |
| [C54A](CODEX_AUDITOR_FEATURE_MIRROR.md#c54a) | Microsoft Azure Foundry / Azure OpenAI provider | [P15](addendum.md#7-functional-scope) | Capability group |
| [C55](CODEX_AUDITOR_FEATURE_MIRROR.md#c55) | Organization model gateway | [P15](addendum.md#7-functional-scope) | Capability group |
| [C56](CODEX_AUDITOR_FEATURE_MIRROR.md#c56) | Local open-source model provider (`--oss`) | [P15](addendum.md#7-functional-scope) | Capability group |
| [C57](CODEX_AUDITOR_FEATURE_MIRROR.md#c57) | Programmatic access and service identities | [P15](addendum.md#7-functional-scope) | Capability group |
| [C58](CODEX_AUDITOR_FEATURE_MIRROR.md#c58) | Git and change review | [P09](addendum.md#7-functional-scope) | Capability group |
| [C59](CODEX_AUDITOR_FEATURE_MIRROR.md#c59) | Scheduled tasks | [P12](addendum.md#7-functional-scope) | Capability group |
| [C60](CODEX_AUDITOR_FEATURE_MIRROR.md#c60) | Voice and dictation | [P16](addendum.md#7-functional-scope) | Capability group |
| [C61](CODEX_AUDITOR_FEATURE_MIRROR.md#c61) | Notifications and task visibility | [P16](addendum.md#7-functional-scope) | Capability group |
| [C62](CODEX_AUDITOR_FEATURE_MIRROR.md#c62) | Pets and floating task companion | [P16](addendum.md#7-functional-scope) | Capability group |
| [C63](CODEX_AUDITOR_FEATURE_MIRROR.md#c63) | Import and setup migration | [P16](addendum.md#7-functional-scope) | Capability group |
| [C64](CODEX_AUDITOR_FEATURE_MIRROR.md#c64) | Shared thread snapshots | [P16](addendum.md#7-functional-scope) | Capability group |
| [C65](CODEX_AUDITOR_FEATURE_MIRROR.md#c65) | Sandbox and permission profiles | [P17](addendum.md#7-functional-scope) | Capability group |
| [C66](CODEX_AUDITOR_FEATURE_MIRROR.md#c66) | Approvals and automatic review | [P17](addendum.md#7-functional-scope) | Capability group |
| [C67](CODEX_AUDITOR_FEATURE_MIRROR.md#c67) | Approved cyber model access (Daybreak / Trusted Access) | [P09](addendum.md#7-functional-scope) | Capability group |
| [C68](CODEX_AUDITOR_FEATURE_MIRROR.md#c68) | Prisma AIRS prompt inspection | [P17](addendum.md#7-functional-scope) | Capability group |
| [C69](CODEX_AUDITOR_FEATURE_MIRROR.md#c69) | Command rules | [P17](addendum.md#7-functional-scope) | Capability group |
| [C70](CODEX_AUDITOR_FEATURE_MIRROR.md#c70) | Agent Security and managed policy | [P17](addendum.md#7-functional-scope) | Capability group |
| [C71](CODEX_AUDITOR_FEATURE_MIRROR.md#c71) | Workspace roles, access, and user lifecycle | [P18](addendum.md#7-functional-scope) | Capability group |
| [C72](CODEX_AUDITOR_FEATURE_MIRROR.md#c72) | Source/connector identity | [P17](addendum.md#7-functional-scope) | Capability group |
| [C73](CODEX_AUDITOR_FEATURE_MIRROR.md#c73) | Untrusted inputs and hooks | [P17](addendum.md#7-functional-scope) | Capability group |
| [C74](CODEX_AUDITOR_FEATURE_MIRROR.md#c74) | Enterprise usage analytics and compliance records | [P19](addendum.md#7-functional-scope) | Capability group |
| [C75](CODEX_AUDITOR_FEATURE_MIRROR.md#c75) | Retention, logs, and telemetry | [P19](addendum.md#7-functional-scope) | Capability group |
| [C76](CODEX_AUDITOR_FEATURE_MIRROR.md#c76) | Task workflow | [P22](addendum.md#7-functional-scope) | Composition lens |
| [C77](CODEX_AUDITOR_FEATURE_MIRROR.md#c77) | Agent capability/runtime | [P22](addendum.md#7-functional-scope) | Composition lens |
| [C78](CODEX_AUDITOR_FEATURE_MIRROR.md#c78) | Auditor-tailored workflow | [P22](addendum.md#7-functional-scope) | Composition lens |

## Expanded behaviors

The original definitions, parent C IDs and evidence are in [the expanded behavior inventory](CODEX_AUDITOR_FEATURE_MAP.md#expanded-behaviors-within-the-feature-groups). These rows unpack grouped capabilities and are not additional independent Codex feature counts.

| ID | Behavior retained | Primary brief requirement |
| --- | --- | --- |
| E01 | Requested review of submitted work | P09 |
| E02 | Automatic review after an eligible change event | P12 |
| E03 | Persistent and one-off review criteria | P10 |
| E04 | Follow-up correction and recheck | P09 |
| E05 | Non-interactive event-driven procedure | P12 |
| E06 | Review from alternative source platforms | P12 |
| E07 | Delegation from collaboration threads | P12 |
| E08 | Assignment from an external task system | P12 |
| E09 | Automatic task triage and routing | P12 |
| E10 | Specialist review pass | P09 |
| E11 | Saved scans, findings and history | P09 |
| E12 | Additional focused analysis passes | P09 |
| E13 | Inherited findings/backlog triage | P09 |
| E14 | Propose, inspect, apply and verify changes | P09 |
| E15 | Advisory options grounded in findings | P20 |
| E16 | Self-contained observation/report | P07 |
| E17 | Export and reviewed finding writeback | P21 |
| E18 | Bulk review across entities and resume | P12 |
| E19 | Programmatic structured review results | P12 |
| E20 | Website-exposed actions and page context | P08 |

## Domain requirements and newly discovered source coverage

| Source / requirement basis | Brief requirements | Status |
| --- | --- | --- |
| Accepted two-mode product direction and organisation/workspace scope | P19, P21, P22 | V1 external records; V2 built-in records with organisation/workspace mode selection. Exact policies/lifecycles remain draft requirements. |
| Diligent engagement planning, scope and procedures | P10, P20, P21 | Adapt to practice; do not require a control object in every workflow. |
| Evidence requests, collection and fieldwork | P05, P06, P11, P20 | Retain source scope, access, procedure and coverage. |
| Workpapers, supervisory review and sign-off | P07, P09, P18, P20, P21 | Human authority remains distinct from agent execution and review. |
| Findings, responses, actions, retesting and closure | P09, P12, P20, P21 | End-to-end domain behavior; detailed transitions follow the team's method. |
| Built-in record identity, history, amendment, retention, recovery and export | P18, P19, P21 | V2 foundations, required with built-in mode. V1 retains work history, evidence references, review assistance and external delivery. |
| Diligent audit-universe, annual/portfolio planning and function-management references | [Section 13 V2 candidates](addendum.md#13-v1-functional-mirror-and-v2-built-in-record-mode) | Retained for later additional-domain planning; priority not selected. |
| GCP/Vertex provider route discovered in pinned source | P15 | Named inventory delta; route availability/compatibility still to verify. Not silently added to frozen C counts. |

Domain references: [Diligent study](DILIGENT_AUDIT_STUDY.md), [two-mode crosswalk](DILIGENT_CODEX_CROSSWALK.md), [provider delta](research/2026-10-26-methodology/FOUNDATION_REUSE.md#inventory-delta-and-unresolved-evidence).

## Six public component patterns

These identify research inputs, not a selected implementation architecture or additional user-feature counts.

| Component pattern | Related requirements |
| --- | --- |
| Agent core/context/tool loop | P04, P06, P13, P14 |
| App-server and protocol | P01, P11, P22 |
| Execution server and sandbox | P03, P06, P17 |
| Memory, thread state and retained history | P14, P19, P21 |
| CLI/TUI and SDK | P02, P12 |
| Documentation and protocol schemas | P11, P15, P22 |

## Coverage result

79/79 C entries and 20/20 E behaviors are assigned, with no missing or duplicate C assignments. P20/P21 also capture audit-domain responsibilities beyond a direct one-to-one catalog row. The provider delta is named separately. A later deferral remains an unmet requirement; this appendix cannot be used to claim shipped or tested feature parity.

