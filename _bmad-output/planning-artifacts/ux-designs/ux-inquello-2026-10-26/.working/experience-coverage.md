# EXPERIENCE coverage ledger

Updated 2026-10-27 for the confirmed privacy/sharing/memory/revocation/reviewer-agent decisions; see [decision reconciliation](../reconcile-confirmed-decisions-2026-10-27.md).

Source: [final PRD](../../../prds/prd-inquello-2026-10-26/prd.md) and companion. Destination: [EXPERIENCE.md](../EXPERIENCE.md). This is a traceability and mechanical coverage aid, not validation of a running product.

## Functional requirements

| Exact source requirement | Phase | Surface | Flow / interaction location |
| --- | --- | --- | --- |
| FR-1 — Organise work | V1 | S01, S05 | UJ-1 step 1; UJ-2 step 1 |
| FR-2 — Find and distinguish work | V1 | S05 | UJ-1 step 5; SP2 |
| FR-3 — Access the same work through supported surfaces | V1 | S12 | SP6; UJ-1 step 5 |
| FR-4 — Preserve session and context controls | V1 | S12 | SP6 |
| FR-5 — Make work location explicit | V1 | S07, S09 | SP1; UJ-5 step 1; distinct execution/inference/browser and connector routes |
| FR-6 — Isolate and promote changes | V1 | S08, S11 | UJ-5 steps 2–3; SP2 |
| FR-7 — Perform and explain scoped work | V1 | S01, S02 | UJ-1 steps 2–3 |
| FR-8 — Continue, interrupt and recover | V1 | S02 | UJ-1 failure/recovery; UJ-8 failure/recovery |
| FR-9 — Understand permitted material | V1 | S01, S02 | UJ-1 steps 1–3 |
| FR-10 — Capture contextual input accurately | V1 | S01, S12 | SP6 |
| FR-11 — Produce checkable analysis | V1 | S02, S11 | UJ-3 step 2; UJ-5 step 3 |
| FR-12 — Represent population and sampling honestly | V1 | S02, S11 | Workbook; UJ-3 step 2; UJ-5 step 3; population/sample scope, exclusions, sampling parameters, duplicates and examined coverage |
| FR-13 — Create, edit and continue supported artifacts | V1 | S02, S03, S12 | UJ-3; UJ-4 |
| FR-14 — Generate and deliver visual or hosted outputs | V1 | S02, S10 | UJ-6 steps 3–5; SP4 |
| FR-15 — Research with attributable sources | V1 | S02 | UJ-6 step 2 |
| FR-16 — Use browser, site and computer actions | V1 | S02, S12 | UJ-1 step 3; SP6 |
| FR-17 — Review, correct and recheck work | V1 | S02, S03, S10 | UJ-2 steps 2–7; UJ-4 steps 2–4; reviewer-private tool reperform, human-issued notes, preparer-agent revisions and changed/impacted rechecks |
| FR-18 — Retain actual technical and security capabilities | V1 | S11 | UJ-5 steps 1–3 |
| FR-19 — Turn guidance into reusable work | V1 | S06 | UJ-7 steps 1–4 |
| FR-20 — Preserve method authority and departures | V1 | S06, S02, S03 | S06 responsibility/state; UJ-7 steps 2–4 and recovery; Task-specific departure records retain Method/version, rationale and affected scope/outputs for review separately from maintained Method changes and action authority |
| FR-21 — Discover and use permitted capabilities | V1 | S07 | UJ-7 step 2; SP1 |
| FR-22 — Extend and integrate execution | V1 | S07, S11 | SP5 |
| FR-23 — Run programmatic work | V1 | S11, S12 | SP5 |
| FR-24 — Run bounded schedules and events | V1 | S04 | UJ-8 steps 1–3 |
| FR-25 — Delegate and consolidate bounded work | V1 | S02, S11 | UJ-5 steps 2–4 |
| FR-26 — Explore without losing origin | V1 | S08 | UJ-5 step 3; SP2 |
| FR-27 — Resume with scoped knowledge | V1 | S08 | UJ-1 step 5; UJ-7 step 3; SP2; automatic eligibility for issued/explicitly team-shared work across auditors/engagements, privacy/admission/current-access bounds |
| FR-28 — Control activity recall | V1 | S08 | SP2 |
| FR-29 — Use permitted processing routes | V1 | S07, S09 | SP1; Information Architecture route paragraph; effective provider/deployment/service identity, gateways/local models and named provider breadth |
| FR-30 — Control reasoning, speed and consumption | V1 | S07, S04 | SP1; UJ-8 step 1 and recovery |
| FR-31 — Retain interaction and attention aids | V1 | S02, S12 | S12 responsibility/state; SP6; voice correction, notification attention/completion and optional-companion Task state |
| FR-32 — Migrate setup and share scoped snapshots | V1 | S05, S08, S10 | SP2; SP4 |
| FR-33 — Enforce effective action authority | V1 | S07, S09, S10 | SP1; SP3; SP4 |
| FR-34 — Treat evidence as data | V1 | S02, S06 | UJ-7 failure/recovery |
| FR-35 — Assign work and human review | V1 | S03, S09 | UJ-2 steps 2–3; SP3 |
| FR-36 — Reassign and revoke access | V1 | S02, S04, S05, S08, S09, S10 | Basic revocation in first team-enabled increment: State Patterns, UJ-2 recovery, SP3/SP4; advanced unattended-job reassignment UJ-8 step 5/recovery |
| FR-37 — Govern V1-held material | V1 | S09 | SP3 |
| FR-38 — Govern native audit records — V2 | V2 | S13 | SP7 — V2 |
| FR-39 — Coordinate practice workflows using external records | V1 | S02, S03, S04 | UJ-2; UJ-8 |
| FR-40 — Carry workflows through native records — V2 | V2 | S13 | SP7 — V2 |
| FR-41 — Review and verify external updates | V1 | S03, S10 | UJ-4 step 5; UJ-8 step 4; SP4 |
| FR-42 — Select and migrate record authority — V2 | V2 | S13 | SP7 — V2 |
| FR-43 — Preserve meaning across boundaries | V1 | S02, S03, S08, S12 | UJ-1 step 5; UJ-3 steps 3–5; SP2; SP6 |
| FR-44 — Make scope and completion claims inspectable | V1 | S02, S03, S04, S10 | All eight UJ climax/recovery outcomes; State Patterns |

## Non-functional requirements

| Exact source requirement | Surface | Flow / interaction location |
| --- | --- | --- |
| NFR-1 — Artifact fidelity. | S02, S03, S10, S12 | UJ-3/UJ-4/UJ-6 failure/recovery; Workbook, DiffLine; State Patterns |
| NFR-2 — Analytical reliability. | S02, S03, S11 | Workbook; UJ-3 step 2; UJ-5 step 3; counts/exclusions/sampling/duplicates and actual examined coverage |
| NFR-3 — Confidentiality and access. | All surfaces, particularly S07–S10 | SP1/SP2/SP3/SP4; shared permission/revocation baseline |
| NFR-4 — Recovery and duplicate effects. | S02, S04, S10 | UJ-1/UJ-8 recovery; Authority and Delivery; offline baseline |
| NFR-5 — Usability and accessibility. | All S01–S13 | Component Patterns; Interaction Primitives; Accessibility Floor; Responsive & Platform |
| NFR-6 — Performance and cost. | S02, S04, S07 | SP1; UJ-8; progress/limit states; OQ-5/OQ-7/OQ-8 |
| NFR-7 — Evidence and decision provenance. | S02, S03, S10; S13 V2 | UJ-2/UJ-4/UJ-5; SP4/SP7; Authority and Delivery |
| NFR-8 — Processing transparency. | S07, S09, S12 | SP1/SP6; distinct execution/inference/browser and connector routes; retained-data/backups/unattended policy inspection |
| NFR-9 — Portability and compatibility. | S07, S08, S10, S12; S13 V2 | SP1/SP2/SP4/SP6/SP7; declared transfer losses |
| NFR-10 — Operational visibility. | S02, S04, S07, S09, S10, S11 | UJ-8; SP3/SP5; persistent operational states |

## Source journeys

| Exact source journey name | Key Flow evidence |
| --- | --- |
| UJ-1 — Amina answers an ad hoc question (source J1). | Matching H3 in Key Flows; named protagonist, numbered steps, **Climax**, and **Failure/recovery**. |
| UJ-2 — Amina and Noah carry an engagement through review (J2). | Matching H3 in Key Flows; named protagonist, numbered steps, **Climax**, and **Failure/recovery**. |
| UJ-3 — Amina continues a reconciliation in Excel (J3). | Matching H3 in Key Flows; named protagonist, numbered steps, **Climax**, and **Failure/recovery**. |
| UJ-4 — Amina and Noah revise a Word workpaper (J4). | Matching H3 in Key Flows; named protagonist, numbered steps, **Climax**, and **Failure/recovery**. |
| UJ-5 — Dev reconciles specialist investigations (J5). | Matching H3 in Key Flows; named protagonist, numbered steps, **Climax**, and **Failure/recovery**. |
| UJ-6 — Amina develops advisory options (J6). | Matching H3 in Key Flows; named protagonist, numbered steps, **Climax**, and **Failure/recovery**. |
| UJ-7 — Amina teaches and reuses a procedure (J7). | Matching H3 in Key Flows; named protagonist, numbered steps, **Climax**, and **Failure/recovery**. |
| UJ-8 — Noah follows a triggered procedure through (J8). | Matching H3 in Key Flows; named protagonist, numbered steps, **Climax**, and **Failure/recovery**. |

## Surface state and visual-reference coverage

The shared State Patterns baseline covers cold-load, empty, focus, errors, offline and permission denial for every surface. Each S01–S13 has an additional row for surface-specific failure/recovery. The IA table links every surface to at least one source UJ.

| Surface | Reference classification | Source journey association |
| --- | --- | --- |
| S01 | mocked-by-import | UJ-1/2/3/6/7 |
| S02 | mocked-by-import | UJ-1–UJ-8 |
| S03 | mocked-by-import | UJ-2/3/4/5/6/8 |
| S04 | mocked-by-import | UJ-8 |
| S05 | spine-only | UJ-1/2 and entry/return for all |
| S06 | spine-only | UJ-7/2 |
| S07 | spine-only | UJ-1/5/7/8 |
| S08 | spine-only | UJ-1/5/7 |
| S09 | spine-only | UJ-2/4/8 |
| S10 | spine-only | UJ-2/4/6/8 |
| S11 | spine-only | UJ-5/3/8 |
| S12 | spine-only | UJ-1/3/5/8 |
| S13 | spine-only | V2 continuation of UJ-2/4/8 |

## Component and token contract

All 28 exact supplied names have behavioural rows in EXPERIENCE.Component Patterns and visual rows in DESIGN.Components: Icon, Button, IconButton, Avatar, Badge, TextField, Switch, Choice, SegmentedControl, Tabs, Menu, StatusChip, JudgmentTag, FileChip, PlanStep, ApprovalCard, DiffLine, Toast, Sidebar, Header, Composer, NavRow, Over, Workbook, StartScreen, ActiveScreen, ReviewScreen, AutomationsScreen. No additional component API is named. S05–S13 are logical arrangements of these parts.

The `.working/token-contract.json` mirror is the checkable DESIGN frontmatter contract. All EXPERIENCE token paths must resolve to that mirror and the final DESIGN frontmatter. The spines keep import files unchanged.

## Proactive Pass 1 accounting

- Flow coverage: all 44 FRs, 10 NFRs and eight exact source UJ names mapped; all source journeys have numbered steps, a climax and failure/recovery. Supporting paths SP1–SP7 expose less-visible scope without creating new UJs.
- State coverage: S01–S13 each inherit the six shared baseline states and have specific states/actions.
- Phase coverage: FR-38/FR-40/FR-42 remain V2 in S13/SP7; other requirements remain the full V1 target.
- Reference coverage: four imported routed compositions are identified; remaining arrangements are spine-only. Imports are retained with a manifest; visual values/file inventory are owned by DESIGN.
- Unresolved work: implementation handlers and integration effects are not verified; unprovided placements, responsive arrangements, interaction completion and existing-token accessibility applications are explicit AS-UX1–AS-UX4 design assumptions with proposed owners/revisit conditions. The current EXPERIENCE Open Items section carries decided OQs and remaining OQ-11/OQ-12/OQ-15/OQ-16 gates; earlier blanket statements that all OQs remained open are superseded.
- No new mock generated; no product/runtime test is claimed; no scope cut or production framework selected.
