---
title: Inquello PRD reconciliation against the product definition
status: review-findings
created: 2026-10-26
updated: 2026-10-26
---

# Product-definition reconciliation

Input: the complete [root product-definition addendum](../../../../docs/addendum.md), including P01–P22, J1–J8, A01–A18, accepted decisions, qualitative intent and open recommendations. Compared with [prd.md](prd.md) and its [companion](addendum.md). Fixture detail was checked against the linked [artifact specifications](../../../../docs/research/2026-10-26-methodology/ARTIFACT_VALIDATION.md) and [methodology M1](../../../../docs/CODEX_METHODOLOGY_STUDY.md). This is a documentation reconciliation, not runtime validation. Line references describe the files read during this pass.

## Outcome

All 22 source P groups have named PRD sections and corresponding FRs. All eight source journeys are represented as UJ-1–UJ-8. All 18 A criteria are retained in the companion, which explicitly treats summaries as non-replacement summaries and links the complete original wording. The PRD's scope-authority clause preserves the detailed source inventory, including smaller capabilities and the GCP/Vertex delta.

No native-record scope leaked into V1, no whole source capability group or journey was dropped, no open recommendation was promoted to an accepted decision, and no fixture-result drift was found. Two source details remain included only through the broad incorporation clause rather than being stated adequately in the operational FR text. Those explicitness gaps are actionable before handoff.

## Actual gaps

### G1 — Separate memory-use and contribution controls are not explicit in the new FRs

- **Source:** root addendum line 144, P14, calls for understandable memory-use/contribution controls, separately from application/site activity recall controls.
- **PRD location:** FR-27, lines 263–266, covers history, compaction, accessible references and cross-Assignment policy. FR-28, lines 268–271, explicitly limits its controls to application/site activity recall. The companion's method distinctions and governance handoff do not restore separate memory-use and memory-contribution controls.
- **Why it matters:** a downstream story author could implement activity capture controls and cross-Assignment policy while omitting the user's ability to control whether retained task context contributes to memory and whether memory is used. These are distinct from the still-open cross-Assignment policy choice.
- **Minimal correction:** add an explicit consequence or clause to FR-27 for understandable, policy-governed controls over memory use and contribution. Keep activity recall in FR-28 and keep OQ-3 open. No new default memory policy is required.

### G2 — Blocked work is absent from the PRD's explicit completion-state list

- **Source:** root addendum line 201 explicitly distinguishes work that is blocked or interrupted from work that is running or completed.
- **PRD location:** FR-44, lines 380–383, lists planned/running/interrupted and later completion/review/delivery meanings but omits blocked work. FR-7 exposes input needs and FR-2 identifies work awaiting input, yet neither says that work unable to progress must be represented distinctly from running/interrupted work. The companion's A13 incomplete/failed distinctions concern scheduled runs and do not fully restore the general Task meaning.
- **Why it matters:** UX/state stories could use the enumerated FR-44 list and misrepresent a task waiting on a missing dependency, permission or input as still running or interrupted. The source deliberately avoided collapsing those meanings.
- **Minimal correction:** include blocked/awaiting dependency or input in FR-44's semantic distinctions, retaining the existing statement that this is not a mandatory universal state machine. No new blocking policy or workflow topology is needed.

These are elaboration omissions, not authorised scope cuts: PRD section 0 already keeps the original source requirements in force. No other actionable reconciliation gap was found in the reviewed source.

## P01–P22 coverage

| Source | Extracted intent | PRD destination | Reconciliation |
| --- | --- | --- | --- |
| P01, root line 126 | Assignments/folders/tasks/workstreams; search/revisit/pin/archive; input/review/delivery status; entity/client/period | §4.1, FR-1/FR-2 | Preserved |
| P02, 127 | Desktop, CLI/session, application-adjacent, mobile/remote and optional physical controls with explicit limits | §4.2, FR-3/FR-4 | Preserved |
| P03, 128 | Approved local/remote execution, isolated alternatives, preserved originals, deliberate promotion, concurrent edits and separate processing location | §4.3, FR-5/FR-6 | Preserved |
| P04, 129 | Request/plan/tools/verify/report; steering, interruption, continuation, goals, background work and independent parallel reads | §4.4, FR-7/FR-8 | Preserved |
| P05, 130 | File/document/data/image context, selections/annotations/snapshots/composer support, origin and saved/live distinction | §4.5, FR-9/FR-10 | Preserved |
| P06, 131 | Calculation/query/transformation/script/orchestration; reproducible derivations; full population or method-specific sampling | §4.6, FR-11/FR-12 | Preserved |
| P07, 132 | Supported spreadsheets/docs/slides/datasets/scripts/visuals; preview/change review/external editing; visual/hosted outputs; audience and destructive-conversion limits | §4.7, FR-13/FR-14; NFR-1 | Preserved |
| P08, 133 | Public research and permitted browser/site/computer actions; references, acting identity, input trust and limited authority | §4.8, FR-15/FR-16 | Preserved |
| P09, 134 | Supported review findings, correction/recheck, actual code/config/security analysis, scope/evidence/uncertainty/history; no automatic closure | §4.9, FR-17/FR-18 | Preserved |
| P10, 140 | Examples/instructions/skills/templates/helpers, eligible demonstration-to-skill, visible method/version/departures; no required builder | §4.10, FR-19/FR-20 | Preserved |
| P11, 141 | Built-in/connected/MCP/plugins/marketplaces/hooks/app-server/client tools; permissions/dependencies; guidance versus enforcement and failures | §4.11, FR-21/FR-22 | Preserved |
| P12, 142 | Batch/SDK/structured outputs, scheduled/events, bounded mandate and identity/budget/destination/escalation; missing/partial/failed runs and duplicate control | §4.12, FR-23/FR-24 | Preserved in V1 |
| P13, 143 | Bounded agents, visible progress/consolidation/disagreement, side chats/forks/references, shared-write coordination; no invented human authority | §4.13, FR-25/FR-26 | Preserved |
| P14, 144 | History/compaction/references, scoped knowledge and memory-use/contribution controls; separate optional application/site activity recall | §4.14, FR-27/FR-28 | Group preserved; memory-use/contribution explicitness gap G1 |
| P15, 145 | Model/reasoning/speed/usage, gateways/local routes/service identities, Bedrock/Azure plus GCP delta, visible actual route and limits | §4.15, FR-29/FR-30 | Preserved; route inclusion is not service approval |
| P16, 146 | Voice/dictation, notifications, optional companions, setup migration and audience-scoped snapshots | §4.16, FR-31/FR-32 | Preserved |
| P17, 152 | Sandbox/permissions/approvals/command rules/policy, scoped default and explicit eligible broader modes, prompt/specialist controls, evidence treated as untrusted | §4.17, FR-33/FR-34 | Preserved |
| P18, 153 | Human assignment/review/access/attribution, reassignment/departure/unattended ownership; review hierarchy/guests open | §4.18, FR-35/FR-36; OQ-1/OQ-4 | Preserved; no guest recommendation promoted |
| P19, 154 | V1 working material/history/logs/telemetry governance distinct from external authority; V2 native retention/hold/amendment | §4.19, FR-37 V1 / FR-38 V2 | Correct phase split |
| P20, 155 | V1 full practice assistance with artifacts/external records and stakeholder communication; V2 native lifecycle; guest portal separate | §4.20, FR-39 V1 / FR-40 V2 | Correct phase split |
| P21, 156 | V1 bounded authorised verified writeback and stale/uncertain outcomes; V2 native identity/relationships/history/evidence/decisions/amendment/export | §4.21, FR-41 V1 / FR-42 V2, plus FR-38/FR-40 | Correct phase split; import/export fallback retained |
| P22, 157 | Continuous context and artifacts across delegation/editors/execution/review/resume without reconstruction | §4.22, FR-43/FR-44 | Preserved; source §10 state detail has G2 |

Smaller inventory features explicitly survive in FR-3/FR-4, FR-10, FR-14, FR-16, FR-18, FR-23, FR-26–FR-32 and FR-44. This review confirms group/source-clause reconciliation; it does not independently re-audit all 270 subfeature cards. The PRD expressly incorporates that full inventory without representing grouping as proof of tested parity.

## J1–J8 coverage

| Source | Outcome preserved | Destination |
| --- | --- | --- |
| J1, root 173 | Sourced ad hoc answer/artifact, uncertainty and continuation without engagement setup | UJ-1, PRD 49 |
| J2, 174 | Team method, scope/procedures/evidence/execution/review/reporting, relied-on results traceable to review, no universal controls | UJ-2, PRD 50; FR-39 |
| J3, 175 | Same saved Excel file, supported formulas/references/comments, changed inputs and stale/recomputed results | UJ-3, PRD 51 |
| J4, 176 | Same Word artifact, human review/revision, evidence/history and approval through designated authority | UJ-4, PRD 52 |
| J5, 177 | Specialist access/configuration/security work, delegation, actual coverage, disagreement and available analysis | UJ-5, PRD 53 |
| J6, 178 | Advisory research/options/presentation, facts versus assumptions/recommendations, estimates labelled and no mandatory deficiency workflow | UJ-6, PRD 54 |
| J7, 179 | Procedure/example to reusable guidance, visible versions/parameters, case evidence separate from shared method/memory | UJ-7, PRD 55 |
| J8, 180 | Bounded supported trigger/schedule, review/delivery/retest, actual coverage and closure authority distinct from completed run | UJ-8, PRD 56; FR-24 |

All remain V1 external-record journeys. The named people are explicitly illustrative AS-1, not invented practitioner evidence. The interest-rate example is not repeated in the new UJ, but its trigger class and full source remain included; no exclusive trigger or industry was substituted.

## A01–A18 coverage and fixture check

| Source | Companion location | Result |
| --- | --- | --- |
| A01, root 236 | Companion 36 | Ad hoc output/continuation and no required engagement preserved |
| A02, 237 | 37 | External-audit/advisory alternatives preserved |
| A03, 238 | 38 plus W1 at 24 | Five/six populations, 4,600/4,750 and difference 150; updated 4,700 and difference 50; duplicate identities preserved |
| A04, 239 | 39 plus W1 | Cache, external edit, comments/ranges/unrelated-content and pre-replacement conflict treatment preserved |
| A05, 240 | 40 plus W2 at 26 | One prior/one later approval, metadata/evidence and effective policy preserved |
| A06, 241 | 41 plus W3 at 28 | Seven accounts, A2/A5 investigation, valid A6 approval and actual technical review preserved |
| A07, 242 | 42 plus M1 at 30 | Approved method/evidence separation, dependencies and method-change reassessment preserved |
| A08, 243 | 43 | References/disagreement/write coordination and no agent impersonation of human approval preserved |
| A09, 244 | 44 | Compaction/resume references, changed access/missing context and no cancellation rollback claim preserved |
| A10, 245 | 45 plus W3; PRD FR-41 | Approved fields/destination/version, unrelated fields, verification and stale/uncertain reconciliation preserved |
| A11, 246 | 46 | V1 external authority/export and V2 selection/migration split preserved |
| A12, 247 | 47 | Native lifecycle only V2; explicitly not a V1 gate |
| A13, 248 | 48 | Scope/method, duplicate events and distinct trigger/run outcomes preserved |
| A14, 249 | 49 | Revocation, reassignment, retained work/unattended jobs and audience-limited sharing preserved |
| A15, 250 | 50 | Declared supported routes/policy and no silent substitution preserved |
| A16, 251 | 51; PRD FR-44 | Individual tests for smaller features and unmet deferral treatment preserved |
| A17, 252 | 52 | Supported slide theme/chart references/notes, analysis links and estimates preserved |
| A18, 253 | 53; PRD SM-1–SM-4/counter-metrics | Total effort through acceptance, quality/corrections/cost/recovery baseline preserved |

W1 retains stable L/B source IDs and the specified ascending-ID duplicate tie-break, not a universal matching policy. W2 retains policy v1 >5,000 and the 7,800 order, with policy v2 >10,000 requiring effective-date checks. W3 retains every account including the disabled account, valid service-account approval and permitted duplicate-person accounts; uncertain delivery is reconciled before retry. M1 retains approved procedure/examples separately from hostile instructions in evidence and prohibits a case correction silently becoming a team rule. No numeric or semantic fixture drift was found. Full source wording remains available by explicit companion reference.

## Qualitative intent and decision reconciliation

| Source intent/decision | PRD treatment | Result |
| --- | --- | --- |
| Codex-derived breadth with auditor-adapted terms/tools/review, not a narrowed chatbot | Vision; scope authority; §4; §6 | Preserved |
| Internal/external audit, advisory, IT/IS across industries/methods | Vision, roles, UJs, FR-39 | Preserved |
| One-team validation is not permanent market restriction | PRD 25 and OQ-7 | Preserved |
| Bring existing work, progressive detail and same saved files in existing tools | Vision; UJ-1/3/4; FR-9/11/13; NFR-5 | Preserved |
| Pain/benefit and differentiation are hypotheses | PRD 23, metrics and risks | Preserved; no invented market success |
| Total effort includes preparation/review/corrections/retries/delivery | SM-1 and counter-metrics | Preserved and elaborated without numerical promises |
| Roles are responsibilities, not mandatory hierarchy; control objects optional | PRD roles/vocabulary, FR-35/39 | Preserved |
| Permission, validation, professional approval and actual delivery are distinct | Vocabulary, FR-17/33/35/41/44, NFR-7 | Preserved |
| Scoped user-started default, explicitly enabled unattended scope remains | PRD 27–29, FR-24/33 | Preserved |
| Codex method mechanisms first; no selected workflow builder | FR-19/20; companion method distinctions | Preserved |
| Actual organisational processing policy, no chosen exclusive provider/topology | Vision, FR-29, NFR-8, OQ-9 | Preserved |
| Bedrock/Azure explicit; GCP delta retained | PRD 17/29/278 | Preserved |
| V1 external records, V2 native authority at organisation/workspace scope | §6, FR-37–42 and OQ-11 | Preserved without V1 native leakage |
| Native modes do not replace ledger/HR/operational transactions | Vocabulary, FR-41/42 and boundaries | Preserved |
| Saved-file collaboration differs from live unsaved state and remote records | Vocabulary, FR-4/10, §8 and companion | Preserved |
| Source/service/authentication/hosted capability and model route are separate dependencies | §8, OQ-9 and companion | Preserved; no parity/reuse guarantee invented |
| Guest access, retained evidence, cross-engagement recall, distribution and budget remain open recommendations | OQ-1–OQ-5 with explicit recommendation labels | Preserved; no promotion to accepted decision found |
| V2 mode precedence, concrete support targets, reviewer roles, metrics and sequencing open | OQ-4/OQ-6–OQ-11 | Preserved |
| Inquello working name; clearance/visuals exploratory; naming territories not markets | OQ-12, boundaries and companion | Preserved |
| Requirements and scenarios remain draft intentions, not implemented/tested claims | PRD frontmatter/§0/§7; companion 10/34 | Preserved |

The newly confirmed internal product/design audience is supported by the parent task's user instruction and does not contradict the source's formerly unspecified audience. AS-1 and AS-2 are labelled working assumptions rather than source evidence. No PRD or original addendum was changed in this reconciliation pass.

## Resolution after reconciliation — 2026-10-26

Both identified gaps were corrected before the Reviewer Gate. FR-27 now explicitly separates memory-use and contribution controls; FR-44 explicitly includes blocked Tasks. The independent scope/decision review verified both fixes and reported no outstanding findings. This report retains the original reconciliation observations as history.
