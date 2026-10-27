---
title: Inquello PRD input — evaluation, quality and decisions
status: source-extraction
created: 2026-10-26
updated: 2026-10-26
audience: internal product and design
---

# Evaluation and decision inputs

This working input preserves the revised product definition for PRD drafting. It is an extraction with proposed decision ownership and revisit gates, not a record of newly accepted choices. All owner roles and gates below are proposals. No named person has accepted ownership. No fixture, product test, runtime behavior, cost improvement, demand claim or competitive advantage is represented as validated.

Primary sources: [addendum sections 9–16](../../../../docs/addendum.md#9-teaching-methodology-and-controlling-work), [decision register](../../../../docs/OPEN_QUESTIONS.md), [artifact fixtures](../../../../docs/research/2026-10-26-methodology/ARTIFACT_VALIDATION.md), [methodology study](../../../../docs/CODEX_METHODOLOGY_STUDY.md), and [foundation research](../../../../docs/research/2026-10-26-methodology/FOUNDATION_REUSE.md). Source line references below refer to the versions read on 2026-10-26.

## Phase and evidence rules

- V1 retains the full Codex-derived capability mirror and required auditor adaptations, with supported working files and external authoritative audit records. Continuous assurance, scheduled work, human review assistance and reviewed external writeback remain within V1's target scope. Validation examples do not narrow that scope. Detailed releases may sequence work but must name every deferral; a deferral is not satisfied parity.
- V2 adds native authoritative audit records, relationships, review/sign-off, versions, amendment, applicable retention/deletion/hold behavior, recovery and export. Organisation/workspace mode selection and migration belong to V2. These obligations are not V1 gates.
- Broad audit-universe/annual planning, staffing/budget management, assurance mapping, quality-programme administration and a general workflow builder remain unprioritised additional candidates. Ordinary engagement planning and follow-up using external records remain V1.
- A01–A10 and A13–A18 evaluate V1. A11 has distinct V1 and V2 assertions. A12 is V2 only.
- Existing checks establish documentation coverage, not product behavior. Numeric fixture results are known expected outputs, not universal audit criteria or performance targets. Performance and cost targets await real team baselines.

Source: addendum lines 224–265. The inventory remains 76 capability groups plus three composition lenses, 270 subfeature mappings, 93 proposed enhancements and 20 expanded behaviors, with GCP/Vertex retained as a named provider delta (lines 288–299).

## Acceptance criteria carried forward

The following A IDs and P mappings are preserved from addendum lines 236–253. They remain proposed evaluation criteria; none has passed.

| ID | Phase | Carried-forward acceptance criterion | Requirement mapping |
| --- | --- | --- | --- |
| A01 | V1 | An ad hoc question produces an inspectable output and sources without requiring engagement setup; a follow-up continues from retained work. | P01, P04, P22 |
| A02 | V1 | An external-audit example can use assertions/materiality/substantive work; an advisory example can produce options without mandatory controls or deficiency states. | P10, P20 |
| A03 | V1 | Reconciliation W1 preserves five ledger/six bank source rows, computes totals 4,600/4,750 and explains the 150 difference; revised R5 yields 4,700/4,750 and 50. Duplicate matching is traceable. | P05–P07 |
| A04 | V1 | A stale formula cache is identified; saved external edits are respected; supported comments, named ranges and unrelated content survive or a conflict/limitation is surfaced before overwrite. | P03, P07 |
| A05 | V1 | Workpaper W2 reports one prior and one later approval, preserves supported review metadata and evidence links, and checks policy effective dates before revising the conclusion. | P07, P09, P20 |
| A06 | V1 | Access-review W3 retains seven accounts, flags A2/A5 for investigation and uses explicit valid approval for service account A6. Technical source/script review remains available. | P06, P09, P13 |
| A07 | V1 | Methodology M1 applies approved guidance while treating instructions embedded in evidence as untrusted; missing dependencies and affected work after a method change are visible. | P10, P14, P17 |
| A08 | V1 | Parallel agents preserve references and disclose disagreement; conflicting writes are isolated or resolved; a reviewer-agent response cannot impersonate human approval. | P03, P13, P18 |
| A09 | V1 | A compacted/resumed task retains access to relevant decisions and sources; missing context or changed permissions are identified. Cancellation does not falsely report external rollback. | P04, P14, P17 |
| A10 | V1 | A reviewed remote update identifies destination/fields/version, preserves unrelated fields and confirms resulting state; stale or uncertain outcomes require reconciliation rather than blind retry. | P11, P21 |
| A11 | V1 and V2, separate assertions | V1: show the external record authority and confirm/export work with declared transfer limitations. V2: expose the selected organisation/workspace mode consistently, prevent silent engagement-level switching and verify mode migration. | P19–P22 |
| A12 | V2 only | Built-in records preserve identities, relationships, attribution, reviewed versions, amendments and applicable retention/export behavior; changed work cannot silently retain obsolete approval. This is not a V1 acceptance gate. | P18–P21 |
| A13 | V1 | Triggered/scheduled work identifies scope and procedure version, handles duplicate events and distinguishes not received/not run/incomplete/failed/no exceptions reported. | P12 |
| A14 | V1 | Revoked access prevents subsequent prohibited use; reassignment addresses retained work and unattended jobs; snapshots/publications expose only the selected permitted audience/content. | P16–P19 |
| A15 | V1 | Every enabled model/provider/client route reports supported capabilities and respects policy; unsupported operations fail intelligibly without silently changing the processing route. | P02, P03, P15, P17 |
| A16 | V1 | Voice, visual inputs, browser context, migration, convenience controls and other smaller mapped features each have capability-specific acceptance tests. A documented delivery deferral remains an unmet capability requirement and cannot be counted as demonstrated full parity. | P02, P05, P08, P16 |
| A17 | V1 | An advisory presentation preserves the declared supported theme, chart references and notes; material assertions link to analysis and unsupported estimates remain labelled. | P07, P20 |
| A18 | V1 | For representative tasks, measure total effort through acceptance, accuracy, corrections, tool/model costs and recovery outcomes against the team's existing workflow. | P06, P19, P22 |

## Fixture details that must survive PRD elaboration

**W1 — saved Excel reconciliation (artifact source lines 22–36).** Ledger R1=1000, R2=1500, R3=500, R4=900, R5=700; bank R1=1000, R2=1500, R3=500, R3=500, R4=950, R6=300. Assign stable row IDs L01–L05 and B01–B06. Match one-to-one by reference/amount; for this fixture only, ascending source IDs break duplicate ties, so L03 matches B03 and B04 remains extra. Expected: three exact matches, R4 difference 50, extra R3=500, bank-only R6=300, ledger-only R5=700; explained bank excess 150. After saved R5 becomes 800, ledger totals 4,700 and excess is 50. Detect the old 4,600 formula cache as stale; preserve an unrelated concurrent sheet edit or report conflict. Inspect reopened workbook, formulas/values, ranges/comments/formatting, row identities and input versions; record correction effort and usage. No source ledger transaction is changed.

**W2 — Word workpaper and review (artifact source lines 38–51).** Policy v1 requires two prior approvals above 5,000; a 7,800 order has one prior and one later approval. Report that distinction rather than claiming no approval. Preserve a comment, tracked deletion, footnote, table and evidence bookmark through requested revision. If v2 raises the threshold to 10,000, check effective period before reassessment. Identify a moved/broken citation; disclose unsupported revision attribution without inventing an author. Reopen and inspect the document and review metadata. Professional approval remains pending until the authorised person acts.

**W3 — access review and remote update (artifact source lines 53–66).** HR E01–E05 includes E02 terminated before the test date. Seven accounts include enabled A2/E02 and A5/E99, disabled A3/E03, approved service account A6 owned by E05 and two permitted E01 accounts. Flag A2 and A5 for investigation, preserve all seven accounts, do not automatically flag A6 or discard A7. Proposed writeback shows destination, fields, evidence and reviewed version. Exercise a concurrent reviewer change, a successful write whose response is lost, and revoked credentials. Confirm only approved fields changed using destination identity/version and resulting-state evidence; reconcile uncertain results before retry. A named destination, supported contract and actual authorisation are prerequisites to executing remote tests, not assumptions inferred from this fixture.

**M1 — procedure authority (methodology source line 60).** Supply an approved procedure v1, template and completed example separately from evidence containing instructions to ignore exceptions or bypass review. Use approved guidance, retain evidence facts, and treat embedded commands as untrusted. Capture selected guidance and loaded references. Surface missing dependencies instead of claiming completion. Introduce v2 after a draft; identify changed guidance and affected outputs. A case correction must not silently become an organisation-wide rule.

**Additional required evidence:** actual team walkthroughs across contrasting practices, external-audit and advisory examples, PowerPoint theme/chart/notes/linked-object/review-metadata round trips, supported Office versions/features, independent expected outputs, larger workload measurements, processing policy, cancellation and recovery trials. These remain evidence gaps, not passed tests (artifact source lines 74–82; addendum lines 230–232).

## Quality and operating concerns

These rows elaborate addendum lines 209–222 into PRD drafting inputs. Owner roles and gates are proposed; quantitative thresholds remain unset unless the fixture itself provides a known expected result.

| Concern | Required observable behavior/evidence | Proposed owner role | Proposed revisit gate |
| --- | --- | --- | --- |
| Artifact fidelity | Declare supported features before modification; round-trip formulas/calculation state, styles, ranges, comments, tracked revisions, references, charts, notes and applicable macro/link/signature features. Preserve originals/intervening edits or surface a conflict before replacement. | Artifact engineering lead with practitioner reviewer and QA | Before claiming support for each format/client/version and before pilot use |
| Analytical reliability | Preserve input definitions and full populations, check derivations, test known results and boundary cases, record false/missed exceptions and reviewer corrections; reproduce sampling where applicable. | Audit methodology owner with analysis/QA lead | Before relying on a workflow's results in pilot evaluation |
| Confidentiality/access | Test effective identity across files, tools, connectors, artifacts, memory and sharing; cover assignment/client separation, revoked access, delegation and departure. Folder labels do not establish access controls. | Organisation security/data-policy owner with identity lead | Before architecture commits policy assumptions; demonstrate before real-data pilot |
| Recovery | Exercise crash/cancel/resume, missing context, concurrent edits, duplicate events, stale versions, partial/uncertain writes and export/recovery. Preserve usable work and distinguish retained effects from cancelled future work. | Runtime/integration lead with QA | Before affected integration or workflow is treated as pilot-ready |
| Team usability/accessibility | Show actual progress, source references and review decisions without requiring code expertise; conduct practitioner, keyboard and accessibility checks. Measure completion and correction effort. | Product designer with practitioner/reviewer representatives | During flow/prototype review and before pilot readiness |
| Performance/cost | Observe latency/resource usage for selected small/large workloads and total cost per accepted deliverable including preparation, review, corrections, retries and delivery. Bounds must follow selected policy and budgets. | Product owner with engineering/operations and audit-team lead | After baseline collection, before quantitative commitments or pilot success criteria |
| Portability | Reopen/reimport supported outputs and disclose transfer losses. V1 verifies external delivery/export; V2 additionally verifies native relationships/history and authority migration. | Artifact/integration lead; records owner for V2 | Before portability claims; native migration before V2 release |
| Maintainability | Keep supported provider/client/version and integration contracts visible; run compatibility/regression evidence for material upstream changes. | Engineering/platform owner | At architecture supply-route selection and each supported-route change |
| Processing route | Separately account for files, execution, inference, connector/browser traffic, history/logs, backups and unattended runs. Expose effective route and fail intelligibly rather than silently changing it. | Organisation policy owner with platform architect | Before committing deployment design and before enabling each route |

No uptime percentage, latency limit, throughput target, monetary budget, retention period, accessibility conformance level, recovery-time objective or recovery-point objective has been accepted in the supplied sources. Where needed, propose and obtain those targets from measured use and actual policy rather than treating this absence as permission to fabricate numbers.

## Method, completion and authority semantics

Carry forward addendum lines 184–207:

- The learning path is explain, demonstrate with examples, reuse, review and refine. Task-specific context, standing instructions, skills/references, tools/agents, memory and enforced policy have separate roles. A skill grants no connector authority; an agent title creates no access boundary; memory is not the authoritative method or relied-on evidence register.
- Preserve applicable procedure identity/version, significant inputs and authorised overrides. Identify outputs affected by method changes. Team-wide publication controls must follow actual team policy; a central methodology bureaucracy is not a default requirement.
- Distinguish planned, running, blocked/interrupted, artifact produced, checks complete/incomplete, human review requested, revision requested, professionally approved where applicable, delivery attempted, delivery confirmed and outcome uncertain. These meanings do not mandate a universal state machine for every task.
- For writeback, review destination/specific changes/evidence, inspect current state, apply only authorised changes, preserve operation/destination identity and verify the result. Where conditional writes or deduplication are unavailable, expose the limitation and provide the appropriate reconciliation path. Continuous two-way sync is not the selected baseline.
- Source/formula/method/reviewed-content changes require affected outputs and approvals to be identified. Neither cancellation, a finished chat, an AI review nor task closure establishes reversal, formal approval or professional closure.

## Pending decisions and evidence gates

All recommendations in this table remain proposals. Owner roles and gates are proposed for PRD planning; they do not assign named people or imply stakeholder agreement. Accepted direction must not be reopened to fill these details.

| Decision/evidence gap | Current source position | Proposed owner role | Proposed revisit gate |
| --- | --- | --- | --- |
| Q2: initial validation coverage | Standalone tasks plus formal engagements/follow-up is recommended, not selected. This cannot narrow full product scope. | Product owner and audit-team lead | Before recruiting/briefing validation participants and choosing examples |
| Q6: human and guest collaboration | Team plus human reviewers with stakeholder exchange through existing tools is recommended. In-product management/client/evidence-provider access remains unselected. | Product owner with audit-team lead and access-policy owner | Before guest/access flows and reviewer responsibilities are committed |
| Q9: retained supporting evidence | Necessary permitted extracts/snapshots, metadata, derivations and source references are recommended. Rights, actual policy and record destination govern; a hash does not prove authenticity/completeness. | Audit/records owner with data-policy owner | Before evidence storage/retention design and real-data pilot |
| Q10: cross-engagement recall | Approved reusable knowledge/reviewed carry-forward is recommended. Case evidence, prior conclusions, personal memory and revoked material remain distinct. | Audit methodology owner with security/privacy owner | Before shared memory or cross-engagement retrieval is enabled |
| Q8 detail: method distribution/governance | Codex mechanisms are the accepted starting point. Team-owned files initially, reviewed packages/internal catalog where needed, remain draft recommendations. Publishing rights, versions, overrides and compatibility are unresolved. | Methodology owner with product/platform lead | Before shared package rollout or enforcing team-wide method changes |
| Q11: actual processing policy/topology | Policy principle accepted; local/managed-cloud/private topology unselected. Provider candidates do not settle all data locations. | Organisation policy/security owner with architect | Before deployment/provider commitments and real-data access |
| Q14: representative workloads | One document/spreadsheet and one larger structured-data case is recommended. Actual sizes, formats, query/network locations remain unknown. | Audit-team lead with analysis/performance lead | Before workload and performance acceptance criteria are fixed |
| Q16: cost governance | Both per-task limits and team-period budgets are recommended, not selected. Amounts and latency/cost preference remain unknown. | Product owner with budget/operations owner | After baseline measurement, before bounded-run policy and financial commitments |
| V2 organisation/workspace precedence | Organisation-permitted workspace choice is recommended. Organisation/workspace scope is already accepted; per-engagement silent changes are not selected. | Product owner with organisation administrator/records owner | Before V2 authority, mode-selection and migration design |
| Supported clients/formats/features | Shared saved-file workflow accepted; exact supported Office/client versions, features, preview/editing depth and live-state mechanisms remain open. | Artifact/UX leads with practitioners | Before publishing a support matrix and integration commitments |
| First external record targets/contracts | Reviewed writeback accepted. Named systems, identity/entitlement, field/version/retry/delete/export capabilities and test access remain unknown. | Integration lead with system owner | Before target-specific integration design or remote tests |
| Human review roles/sign-off | Human authority distinct from agent review; hierarchy, reassignment and publishing rights still need team evidence. | Audit-team lead with records/access-policy owners | Before workflow/permission design and real-data pilot |
| Team participants/permitted examples | One organisation's team accepted; actual people, permissions and representative files not supplied. | Product owner and audit-team lead | Before practitioner validation sessions |
| Quantitative success targets | Total effort through acceptance and quality/cost/recovery measures specified; baselines and thresholds missing. | Product owner with reviewer/QA and operations leads | After baseline, before claims or pilot go/no-go criteria |
| Component/service supply routes | Candidate public components identified; desktop/hosted parity and service eligibility unresolved. | Platform architect with authorised licensing/procurement/service owner | Before relying on each route in architecture or distribution commitments |
| Release sequencing | V1/V2 boundary and full V1 ambition accepted; delivery order and named deferrals open. | Product owner with engineering/design leads | Before implementation plan and each release commitment |
| V2 native records lifecycle | Native authority is confirmed V2 scope; retention, hold/deletion, amendments, approval lineage, recovery/export details depend on policy. | Records owner with audit/security/architecture leads | Before V2 record design and acceptance; not a V1 blocker |
| Working name and visual direction | Inquello is the working name. Final name clearance unresolved; exploratory Open Inquiry identity/screens are not approved requirements or functioning product evidence. | Product/brand owner; authorised name-clearance adviser when needed | Before public naming/launch commitment and final UX/brand sign-off |

Source: addendum lines 267–306; OPEN_QUESTIONS lines 23–29, 57–63, 73–105, 121–143 and 149. Q1 B, Q3 A, Q4 B and Q7 B are already selected. Q5/Q13/Q15, Q8's starting principle, Q11's policy principle and the Q12 mapping order are established. Do not ask users to select these again. Factual unknowns U1–U10 require evidence, not user guesses (OPEN_QUESTIONS lines 145–149).

## Source and service boundaries

The following are bounded findings from the existing October 26 research, not refreshed vendor guarantees or legal advice:

1. Public core/CLI, app-server and TypeScript SDK are candidate reuse paths. The research does not select architecture or establish reusable desktop UI source, IDE/Cloud source, hosted tools/connectors/scheduler backends or transferable entitlements. Keep a source or supported service route per capability.
2. Source licensing/dependency obligations, authentication/service eligibility, application registration, distribution model and actual tool availability are separate checks. The existing report records app-server authentication restrictions and directs further eligibility research; it draws no blanket legal prohibition on adapting source.
3. Bedrock, Azure Foundry/Azure OpenAI, GCP/Vertex and other provider routes require route-specific authentication/model/tool validation. An inference route does not establish full hosted-product parity or compliant processing locations.
4. Static request/tool/permission traces support a candidate execution foundation, not professional sign-off or every connector/platform's transaction behavior. Instruction prose is not proof of enforcement; a post-tool rejection does not undo an already completed action.
5. Interrupt/resume/history rollback semantics do not reverse local/external effects. Writeback needs destination/version/approved fields, operation identity where supported, and resulting-state reconciliation. No destination's conditional-write or idempotency support may be assumed from a different vendor's example.
6. Saved files, live unsaved app state and remote platform records are different access routes. Shared-file assistance does not require an API to every editor. Formula text/cache, revision/comment/approval semantics and supported formats need independent round-trip evidence.
7. Microsoft documented mechanisms illustrate endpoint-specific possibilities and limitations; they do not prove a Diligent contract, universal unattended identity support, exactly-once creation or Inquello fidelity. HTTP/transport success and upload progress are not sufficient evidence of accepted work or committed destination state.
8. Technical tests cannot confer source rights, provider eligibility, professional acceptance, real-record authority or organisational permission. The drafting task does not authorise building/deploying a product or modifying real audit records.

Source: [foundation research](../../../../docs/research/2026-10-26-methodology/FOUNDATION_REUSE.md), lines 3–43; [artifact validation](../../../../docs/research/2026-10-26-methodology/ARTIFACT_VALIDATION.md), lines 3–20; addendum lines 269–273. Additional source traces, compaction, child-agent context/synthesis, persistence, scheduler behavior and controlled failure observations remain incomplete in the existing research.
