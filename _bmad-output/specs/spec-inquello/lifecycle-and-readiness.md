# Internal-audit lifecycle and readiness

## Approved scope and boundaries
V1 serves one organisation and internal audit team, with auditor, reviewing manager and admin responsibilities. The three connected cycles are risk-based audit coverage planning, individual engagements through evidence/findings/report, and management-action follow-up. A supported recurring audit check belongs to this journey. Compatible technical and internal advisory work remain available; there is no compulsory six-step state machine.

The [approved PRFAQ](../../planning-artifacts/prfaq-inquello.md), [current PRD](../../planning-artifacts/prds/prd-inquello-2026-10-26/prd.md), [verified research](../../planning-artifacts/research/domain-internal-audit-work-lifecycle-and-judgme-2026-11-04/research.md) and [professional glossary](../../planning-artifacts/research/domain-internal-audit-work-lifecycle-and-judgme-2026-11-04/glossary.md) supply the source. Requirements, considerations and examples retain their distinctions; standards do not prescribe one software architecture, fixed sample size, universal RCM/five-Cs template or personal-CAE click.

Where GIAS applies, preserve Standard 9.4's at-least-annual documented risk assessment and dynamic plan updates, and 9.5's coordination and conditional documented reliance without transferring responsibility. Support applicable work-programme approval before implementation and prompt approval of changes (13.6). These are professional obligations, not a fixed software cadence or a broad assurance-mapping suite.

## Outcome and acceptance map
| Outcome | Stable requirements | Demonstrable acceptance |
|---|---|---|
| Establish useful context | CAP-1/5/10/17/18; UJ-9 | Guided setup/settings and agent assistance organise available strategy/objectives, audit universe/risk picture, useful history, roles and methodology; show ready/missing/deferrable inputs for intended work. Privacy and actual grants remain visible. Account onboarding alone is not this outcome. |
| Plan coverage | CAP-26 / FR-45; UJ-10 | Manager inspects sourced priorities, proposed coverage, omissions and changes using risks, previous findings and outstanding actions. Applicable formal plan/change approval is evidenced separately; no board portal implied. |
| Design an engagement | CAP-20 / FR-39 | Objectives, scope, criteria, risks/controls and work programme connect to organisational context; Method/version and human direction remain inspectable. |
| Perform and investigate | CAP-4/5/6/22 | Supported procedures analyse actual selected inputs, retain sources/derivations and surface exceptions/gaps/uncertainty. Auditor directs naturally and can inspect, question and revise without operating execution machinery. |
| Review and report | CAP-7/9/18/20/22 | Reviewer-owned private work uses submitted versions and permitted evidence; human selects feedback, prepares defensible conclusions/report and controls formal decisions/sign-off. Existing private review/approval contracts remain. |
| Follow up and learn | CAP-12/20/26 | Actions, owners, due dates, progress, confirmation evidence and unresolved items remain connected. Management-reported completion differs from verified implementation and risk acceptance. Carry relevant unresolved/new information into the next coverage plan under current access. |
| Repeat a supported check | CAP-12 / FR-23/24; UJ-8 | Agreed inputs/Method/identity/limits and trigger are explicit; results, failures, missing inputs and retained progress are visible. Revocation, duplication/effect reconciliation and appropriate recovery apply. |

The applicable new stories and dependency sequence are in the [current epic plan](../../planning-artifacts/epics.md), [November scope/dependencies](../../planning-artifacts/epic-scope-and-dependencies-2026-11-05.md) and [traceability artifact](../../planning-artifacts/epic-traceability-2026-11-05.json). Existing W1–W3/M1 and A01–A18 acceptance are retained, with external-audit-specific examples held for their future activation rather than imposed on this internal-audit V1.

## Faithful execution and human judgment
For each supported substantial procedure, define the agreed population/scope and establish what actually ran. Reconcile completed, excluded, failed and unfinished work, including interruptions and resumed work, without silent omission or duplicate effects. Preserve inspectable method, parameters, source/version and result evidence; expose concise conclusions plus drill-down rather than asking the auditor to reperform every record.

That proves faithful execution only to the defined evidence standard, not that a human chose an appropriate procedure or that risk is adequately addressed. Professional judgment remains human. Spot checks, record counts or a completed model turn alone do not prove coverage; more records do not necessarily mean more significant risks covered. Concrete procedures, representative scale and expected-result/recovery cases must be specified before acceptance; no millions-of-record promise, numerical threshold or exactly-once architecture is selected.

## Working records, authority and export
For audit plan, engagement programme, evidence, workpapers, findings, report and actions identify the working artifact/location, designated external formal authority, review/approval evidence, and export/handoff. This is a specification obligation, not a newly selected native schema or record platform. Preserve periods, versions, source provenance, current grants and known change impact across the cycle. Private conversations or retained extracts do not become shared institutional knowledge automatically.

External-authority V1/native-authority V2 remains. First validation is desktop-first with Excel, Word, PowerPoint and CSV and no named external record system, import/export only (OQ-6). Exact supported features and link/history preservation must be tested before reliance. No promise of lossless all-system migration.

## Reuse and recurrence
Use the [capability inventory](../../planning-artifacts/capability-reuse-inventory-2026-11-05.md): retain and qualify existing Codex implementations before creating replacements. The fork supplies durable queue, mailbox and sleep mechanisms; it does not automatically supply a qualified recurring host lifecycle or independently provisioned cloud service. Current private Task restrictions require protected integration, not bypass.

Before enabling the supported check, specify trigger supply, eligible host/app/session, data availability, acting identity/mandate, current grants, limits, missed-run/restart handling and effect reconciliation. A sleeping/offline host or absent input is not a successful run. No always-on hosted execution, silent fallback or automatic retry of uncertain effects is promised. Broader compatible SDK/event/schedule capabilities remain V1 obligations, not removed by this minimal end-to-end acceptance case.

## Dependence-point gates
Israel is product decision owner; other role assignments are proposed until named.

| Gate | Decision/evidence | Proposed participants | Revisit before |
|---|---|---|---|
| OQ-17 | Supported procedures/populations, context/readiness inputs, sources/formats/connections and practical history intake. | Israel, audit and engineering owners | Relevant story specification and use; no universal required-field scheme invented. |
| OQ-18 | Recurrence trigger, identity/session eligibility, limits, host availability and missed-run/recovery contract. | Israel, engineering/security owners | Enabling/promising the check or committing its implementation specifics. |
| OQ-19 | Working/authority allocation, review evidence, export formats and preserved/lost links/history. | Israel, audit/data-policy and engineering owners | Reliance on affected output or handoff. |
| OQ-20 | Pilot authorisation, actual baseline/proof tasks, cost measurements and commercial arrangement. | Israel, pilot organisation and relevant policy owners | Real engagement/data use, benefit claims and purchase respectively. |

Before real engagement use: demonstrate dependable supported execution/recovery, verify access controls and audit-data handling, make evidence/failures/human review inspectable, and agree authorised data/use with the organisation. While building: select the pilot engagement and sources, specify procedures/connections, establish baseline, measure costs and determine exports before their dependent reliance. Refine pricing and broaden support from observed use; understand costs and commercial arrangement before asking a customer to buy. No launch date, price, percentage gain or acceptance of customer data is implied.

## Current evidence, not release approval
Preserve Epic 1 exactly and judge its authored behavior against current story-specific evidence. The [5 November engineering handoff](../../implementation-artifacts/handoff/HANDOFF-2026-11-05.md) reports 2,169 Linux desktop tests but final-head full smoke 17/18 with a later isolated visual pass; these are not a combined full-suite pass. Windows/real WSL, actual provider and applicable owner acceptance remain distinct. Planning validation does not settle them or authorise implementation, unapproved installs/downloads, credentials, paid inference, deployments or outreach.
