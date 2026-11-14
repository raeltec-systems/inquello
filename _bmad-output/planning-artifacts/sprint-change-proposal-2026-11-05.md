---
title: "Inquello sprint change proposal"
status: approved-planning-applied-validated
approved: "2026-11-05"
created: "2026-11-05"
workflow: bmad-correct-course
mode: batch-proposal
implementation_authorized: false
---
# Inquello planning course correction

## Owner approval
On 5 November Israel approved applying the course-correction direction through BMAD workflows: retain all compatible Codex capabilities, inventory reuse/exposure/adaptation/external dependencies, add risk-based coverage planning and a supported recurring check to the full internal-audit V1, and preserve Epic 1 and the existing record architecture. His response to the proposal was: “Yes..use the bmad workflows to do just that”. This approves planning reconciliation, not code implementation, new services or data transmission.

## 1. Issue summary
The approved 5 November PRFAQ now makes one internal audit team's complete journey explicit: organisational setup and context, risk-based coverage planning, engagement planning and work, review/reporting, and management-action follow-up, including a supported recurring check. Significant-risk coverage leads, with conclusion quality and business relevance next. Completed five-report research establishes bounded professional obligations and corrects unsupported universal templates, sample counts, personal-CAE clicks and software mandates.

The October PRD/SPEC still defer coverage planning and require external-audit-specific V1 examples. Existing journeys focus on engagement work/review, account onboarding does not yet define audit-context readiness, and recurrence sits behind a broad later automation programme. These are planning conflicts and gaps, not evidence that Epic 1 must be discarded.

### Evidence and precedence
- [Approved PRFAQ](prfaq-inquello.md), especially Internal FAQ 6/9 and Customer FAQ 1–10; [detail pack](prfaq-inquello-distillate.md).
- [Completed research](research/domain-internal-audit-work-lifecycle-and-judgme-2026-11-04/research.md), [contradictions](research/domain-internal-audit-work-lifecycle-and-judgme-2026-11-04/contradictions.md) and [glossary](research/domain-internal-audit-work-lifecycle-and-judgme-2026-11-04/glossary.md). Its selected synthesis claims are not certification of every imported assertion.
- Current [PRD](prds/prd-inquello-2026-10-26/prd.md), [SPEC](../specs/spec-inquello/SPEC.md), [epics](epics.md), architecture/UX and latest [engineering handoff](../implementation-artifacts/handoff/HANDOFF-2026-11-05.md).
- Latest decisions govern their actual scope. Historical inputs and reviews remain evidence of earlier decisions, not superior authority over the PRFAQ. Do not infer a new decision where the later discussion was silent.

## 2. Impact analysis
### Preserve the current foundation
No Epic 1 code, story, acceptance criterion, test, status or completed work is changed by this proposal. Retain the Codex-derived foundation, bounded desktop transport, local execution/files, shared identity/permissions/collaboration, creator-private Tasks, explicit granular sharing, revocation, source/decision provenance, human professional authority and existing record-phase decisions.

Native authoritative audit records, lifecycle and migration remain V2 unless the owner explicitly changes that decision. The full V1 journey can be supported through working artifacts and designated external formal authority. First map each deliverable's working location, approval evidence and export/handoff; do not invent a database replacement.

### Affected artifacts
- PRD purpose, audience, journeys, vocabulary, FR-39, scope/non-goals, validation priorities and readiness gates; compatible FR/NFR refinements identified below.
- SPEC Why/CAP-20/Non-goals plus capability applicability, glossary and scope/gate companions.
- UX organisational readiness, coverage-planning and full-cycle flows; preserve the existing private review loop and visual system.
- Architecture lifecycle/capability and provenance mapping, supported recurrence/availability contract, stale identity/bootstrap/source-path wording. No new stack or record schema is selected.
- Epics 2–6 need focused lifecycle/verification mapping; current late recurrence dependencies need a bounded supported-check path. The wider roadmap needs explicit retained/deferred/excluded applicability without renumbering or silent acceptance loss.
- Historical readiness documents must stay dated. A revised planning assessment must distinguish specification readiness, authored code, tested fixtures, actual provider/Windows evidence and real-use authority.

Detailed analyses: [PRD/SPEC](course-correction-2026-11-05/prd-spec-analysis.md), [architecture/UX](course-correction-2026-11-05/architecture-ux-analysis.md), [epic impacts](course-correction-2026-11-05/epic-impact-analysis.md).

### Engineering truth that this planning must not overwrite
The latest handoff reports 2,169 passing Linux desktop tests, but final-head full smoke was 17/18; visual-conversation later passed alone. That is not a cumulative final-head full pass. Windows/real WSL, actual-provider and relevant owner acceptance remain distinct. OAuth-cancel listener leakage remains unresolved. Do not update status from planning prose or weaken a valid test to obtain green results.

## 3. Recommended approach and alternatives
**Approved approach: direct adjustment with reuse-first capability qualification.** Retain the foundation, introduce missing lifecycle outcomes and evidence, and reorganise only the necessary later dependencies. Do not restart the product or substitute a tiny technical demonstration for the approved journey.

| Option | Assessment | Effort and risk |
|---|---|---|
| Direct adjustment | Viable and preferred. Existing architecture, privacy and artifact/review machinery remain useful; add/clarify lifecycle outcomes and supported-check sequencing. | Planning effort medium. Delivery effort remains unestimated until concrete support bounds and proof criteria are selected; integration/verification risk is material. |
| Roll back completed stories | Not justified by present evidence. Research contradicts some planning claims, not the validity of Epic 1's security foundation. | Likely unnecessary rework and regression risk. No rollback proposed. |
| Replace V1 with a reduced proof | Rejected as a substitute for the approved end-to-end journey. Focused proofs remain useful engineering checkpoints. | Would violate approved intent unless separately changed by the owner. |
| Preserve compatible breadth and sequence integration | Approved. Reuse inherited capabilities, adapt protected integration, qualify exact routes/services and retain unmet acceptance. Full V1 is not a partial qualified subset. | Source/integration/evidence gaps drive dependency order; no generic cut or date commitment. |

Classification: **moderate planning/backlog reorganisation with approved direction**, not an approved architectural reset. If the owner requests earlier native records or unattended operation independent of local availability, assess that separately as a potentially major change.

No delivery date or numerical estimate is supported yet. Resolve release obligations, dependencies and representative verification work before promising a timeline.

## 4. Detailed change proposals
The following before/after proposals were approved as planning direction and are now applied through the owning workflows. Existing IDs remain stable; FR-45, CAP-26, UJ-9/10 and Stories 6.6/6.7 supply missing lifecycle outcomes. Source-grounded precision refinements preserve approval boundaries; completion checks are recorded in the application report.

### CP-1: Lead with the user's outcome
**Before:** PRD §1 leads with “broad working experience Codex gives developers” and reducing total effort. SPEC Why follows that framing.
**After:** “Inquello gives internal audit teams connected, source-backed organisational understanding and an agent that performs supported audit work alongside them. It helps teams cover more significant risks and develop defensible, business-relevant conclusions without repeatedly rebuilding context. Auditors retain direction, judgment and approval. The Codex-derived foundation supports this experience; benefits remain to be demonstrated.”
Preserve generic capability ambition and existing effort measures. Add risk coverage, quality/relevance and comfortable direction/review measures ahead of efficiency, with no invented numerical targets. Counts of processed records alone do not establish coverage of significant business risks.

### CP-2: Apply the approved V1 audience and exclusions
**Before:** PRD §1 serves internal/external/advisory/IT audit; FR-39/CAP-20 require external-audit examples; §6.1 broadly binds every non-native FR to V1.
**After:** “The current V1 journey serves one organisation and one internal audit team, with an auditor and manager plus admin responsibilities. External-audit-specific workflows/standards, audit-firm multi-client switching, complex large-team resource management, a broad integration marketplace, automatic migration of every historical system and autonomous report issuance are outside this V1.”
Keep compatible technical and internal-audit advisory work. Preserve historical external-audit acceptance and OQ-15 as future activation scope, not an internal-audit blocker. Retain cross-organisation negative-access tests: excluding a workflow does not weaken isolation.
D1 below retains every compatible generic capability and documented route. Practice-specific exclusions do not silently remove compatible mechanisms.

### CP-3: Make coverage planning explicit
**Before:** PRD §6.2: “Broader audit-universe/annual or portfolio planning ... remain unprioritised candidates.” SPEC Non-goals similarly excludes prioritising audit-universe/portfolio planning.
**After:** “V1 helps the manager assess priorities and prepare, review and change an audit plan using available strategy, objectives, risk information, past findings and outstanding actions. Follow-up results and unresolved matters inform subsequent planning. Complex staffing/capacity/budget suites, broader assurance-map administration, quality-programme administration and a general workflow builder remain outside the approved scope.”
Add a separately testable coverage-planning outcome to FR-39/CAP-20 or a new linked requirement, retaining all existing identifiers. Add the missing lifecycle journey without overwriting UJ-2's review flow.
Manager review of a proposal does not substitute for actual plan/significant-change approval under applicable governance. Do not introduce a board portal or universal personal-CAE click.

### CP-4: Extend readiness beyond account setup
**Before:** current customer-onboarding SPEC governs identity, create/join, membership and private work; PRD context/method capabilities are dispersed.
**After:** “Guided setup/settings and agent assistance help establish team access, methodology and permitted connections, organise available strategy/objectives, risk/audit-universe context and useful history, and show what is ready, missing or deferrable for the intended first engagement. If something needs a connection or a setting, Inquello points you there.”
Plan this as an explicit lifecycle extension, not a retroactive claim that Story 1.31 already covers it. Required fields, exact sequence, intake formats and readiness criteria remain detail to specify before reliance. Do not require every historical document before useful work. Private conversations and retained extracts do not become team knowledge automatically.

### CP-5: Preserve professional distinctions without prescribing a rigid workflow
**Before:** FR-39/CAP-20 group plan/scope through follow-up; the current product Finding vocabulary also covers observations/recommendations.
**After:** retain distinct objectives, scope, risks, criteria, work programme, evidence, potential finding/exception, evaluated finding, conclusion, recommendation/management action, implementation confirmation and risk acceptance. Preserve version/change impact and applicable approval/delegation as work iterates.
Source professional outcome details from the verified glossary and clauses. Root cause is pursued when possible; RCM/five-Cs formats and fixed sample counts are not universal mandates. Report issuance, management-reported completion, verified implementation and risk acceptance remain distinct. Method-specific labels do not turn into a compulsory six-step state machine.

### CP-6: Specify faithful execution evidence
**Before:** FR-7/8/11/12, NFR-2/4 and existing fixtures already cover calculations, actual coverage and recovery, but do not fully establish substantial long-running work.
**After:** “For each selected supported procedure, make it possible to establish what ran against the agreed population/scope; reconcile completed, excluded, failed and unfinished work; and demonstrate recovery without silent omissions or duplicate effects. Expose concise, inspectable evidence without requiring the auditor to orchestrate execution machinery or repeat every record.”
Keep faithful execution separate from professional judgment about procedure suitability. Spot checks or a completed model turn alone do not prove coverage. Preserve W1–W3/M1 exact regression checks and add representative lifecycle/scale/recovery cases. No selected chunking/checkpoint architecture, exactly-once guarantee, millions-of-record benchmark or numerical target is implied.

### CP-7: Include bounded recurrence without importing the entire automation programme
**Before:** FR-23/24/UJ-8 already promise broad batch/SDK/scheduled/event-driven work; later Epic 12 sits behind wider capabilities.
**After:** V1 acceptance explicitly includes the approved supported recurring audit check, with defined inputs, Method, acting identity, limits, result/exception handling, retained work and failure visibility. Reassess dependency order by actual prerequisites, retaining existing mandate, revocation, duplication and effect-reconciliation protections.
The compatible starting proposal uses a supported local execution path. Exact trigger supply, session eligibility and missed-run policy remain to specify. A sleeping/offline host is not a successful run; no new cloud execution or always-on availability is selected. Broad compatible SDK/service triggers and other automation remain V1 under D1; the supported recurring check has a dependency-correct path without waiting for unrelated convenience features.

### CP-8: Connect the lifecycle through existing authority boundaries
**Before:** AD-6/9/13 already separate stable working identity, review basis and external/native authority.
**After:** add inspectable linkage from sourced strategy/objectives and risk context to planned coverage, engagement design, procedures/evidence, findings/conclusions/report and actions/follow-up. Preserve period/version, gaps, uncertainty, current grants and known change impact.
For each supported deliverable identify its working artifact/location, formal authority, review/approval evidence and export/handoff. Retain external-record V1/native-authority V2. A local object, shared coordination event or convenient link does not become an authoritative audit record by implication.
Export formats and preserved/lost relationships must be verified before relied on. No blanket complete-migration promise or source-copy expansion.

### CP-9: Reconcile stale documentary state, not history
**Before:** older architecture SC-1 describes operator-only bootstrap/unselected identity supplier; some references still use fork/ or timeless “no executable product exists.”
**After:** cross-reference the later customer-onboarding Auth0/eligible-self-service contract and current engine/ path, while preserving exact issuer/subject, invitation, recovery and private-content boundaries. Label earlier states as historical. Keep real tenant, email, runtime and UI qualification separate; supplier selection is not operational acceptance.
Retain dated prior reviews and test results. Do not rewrite them to pretend they assessed this new scope or every current build.

### CP-10: Use the approved readiness and commercial sequence
**Before:** October readiness/evaluation language lacks the newer PRFAQ sequence and some statements are now historical.
**After:** before real engagement use, demonstrate dependable supported execution/recovery, verify access/data handling, make work/evidence/failures/human review visible, and agree authorised data/use with the organisation. During build, resolve concrete procedures/sources/connections, pilot baseline, cost and exports before the relevant capability is relied on. Broaden support and refine pricing from learning; establish cost/commercial arrangements before purchase.
Preserve per-route policy and provider eligibility, no silent fallback, measure-first thresholds, unknown pricing and no launch date. Existing OQ-6 remains desktop-first with Excel, Word, PowerPoint and CSV, no named external record system for first validation and import/export only; a selected connection that changes that baseline needs explicit reconciliation. Planning approval does not authorise outreach, customer data, service setup, paid inference or deployment.

## 5. Decisions and details
### D1: Resolved — retain all compatible Codex capabilities
Israel reaffirmed the fork/reuse premise and approved a per-feature inventory. Retain the compatible capability/model-route goal. The [source-backed inventory](capability-reuse-inventory-2026-11-05.md) distinguishes inherited implementation, actual protected integration, remaining exposure/adaptation, external service conditions and verification. Source presence is not runtime acceptance; future tracking is not code absence. Do not silently cut features, infer proprietary app/service availability, bypass current private guards or describe full inheritance as a greenfield rebuild.

The inventory covers all 79 C groups and 20 expanded E entries plus the named GCP route. Source auditing is bounded: individually identified evidence exists for 40 C rows, while the other catalog rows explicitly require further source/integration qualification. None is labelled absent merely because it is unverified. The original subfeature/enhancement accounting remains intact.

### Details to resolve at their dependency point, not reasons to stop all planning
- Concrete supported audit procedures/populations and source/file/connection contracts.
- First-engagement readiness and safe context admission.
- Applicable organisation methodology, actors/delegation, topical/law context and governance approval evidence.
- Recurring-check availability, identity, trigger and missed-run behavior.
- Representative expected results, interruption cases and meaningful inspection/acceptance criteria.
- Artifact-authority allocation and usable export/link preservation.
- Pilot authorisation, baseline and commercial arrangement before their respective reliance/commitment gates.

The full journey and supported recurrence are already approved. Do not ask whether to include them again. Do not reopen native records merely because connected work is needed.

## 6. Planning handoff and success criteria
1. D1 and application approval are resolved by the owner's 5 November response. Preserve compatible breadth and exact existing boundaries.
2. Apply only planning changes; current code, Epic 1 content/status, existing local edits and historical evidence remain protected.
3. Use existing bmad-prd Update intent, reconciling the PRFAQ, verified research, prior decisions and exact old-to-new dispositions. Preserve IDs and historical source accounting; scope conflicts cannot disappear into an addendum.
4. Reconcile SPEC/companions, UX, architecture and epic/story dependencies together. Extend acceptance for the approved journey without changing Epic 1 or waiving existing controls.
5. Reassess scoped planning readiness and run relevant document consistency checks. Update sprint tracking only for approved backlog changes, preserving all current implementation states.
6. Before code resumes, the relevant refinements and story specification checkpoints must be complete. One PR per completed epic, true merge, full suite/smoke before pushes, no skipped/weakened tests, no --no-sandbox and no unapproved installation/download remain binding.

Success means every approved lifecycle outcome has a requirement, experience, dependency and acceptance path; every older capability has an explicit retained/deferred/excluded disposition; authority/privacy boundaries and Epic 1 remain intact; open details have owners and reliance gates rather than invented answers. No claim of runtime, production or commercial readiness follows from document approval.

## 7. Workflow status
Correct Course planning application is complete. The PRD Update, bmad-spec derivation, architecture/UX updates and epic reconciliation have been applied and checked. The 286-file baseline shows only 16 expected current planning/log/tracker changes; Epic 1 and existing statuses are preserved. Scoped independent review findings are resolved, with runtime and dependence-point details explicitly open. No runtime test, code change, install/download, commit or push occurred. See [application report](course-correction-2026-11-05/application-report.md) for artifacts, checks, review limitations and the planning handoff.