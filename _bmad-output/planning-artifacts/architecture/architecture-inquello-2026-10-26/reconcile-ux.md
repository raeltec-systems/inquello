# UX input reconciliation — architecture draft

Date: 2026-10-27. Result: **0 unresolved input-preservation gaps.**

This mandatory input reconciliation compares the final [DESIGN](../../ux-designs/ux-inquello-2026-10-26/DESIGN.md) and [EXPERIENCE](../../ux-designs/ux-inquello-2026-10-26/EXPERIENCE.md) with [ARCHITECTURE-SPINE](ARCHITECTURE-SPINE.md), using the [UX extraction](.working/input-ux.md) as an aid. It checks architecture-level ownership, boundaries and obligations. It is not the optional Reviewer Gate, a rendered accessibility review, a Mermaid compile, or evidence of implemented functionality.

The comparison accepts the user's subsequent architecture choices: a public Codex fork, retained runtime/app-server with separate audit modules, Electron with React/TypeScript, shared Rust audit semantics, separate local SQLite working metadata, and direct Codex operation without an assumed new shared service. These choices legitimately resolve matters the UX left open; they do not make the imported React/CSS prototype production implementation.

## Reviewed versions

SHA-256 values identify the reviewed bytes. Findings apply to these versions.

| File | SHA-256 |
| --- | --- |
| ARCHITECTURE-SPINE.md | `63C33B62F1D33629E7CE6BFA8607D71088F9CD431547497B42C600350D4423F5` |
| DESIGN.md | `BFCF9BE0A13C474B017FD5CD5971655162C83D1361DEBB4E611577D8E1F109E3` |
| EXPERIENCE.md | `6CE184C470887382F80B9A2668D9B3518C55C1A550984F0A1665D29F4F06003B` |
| .working/input-ux.md | `FD350F74D33566102E6AF5B21F2AAB38C0B24116F9146A26ECAEEF3F8658A9D6` |

## Surface contracts

AD-3 expressly retains the supplied DESIGN/EXPERIENCE contract. The capability map retains all source requirements and journeys; the responsibilities below substantiate preservation rather than relying on identifier counts. Logical UX surfaces need not become separate modules, routes or services.

| UX surface | Architecture contract that preserves it | Result |
| --- | --- | --- |
| S01 — Start work | AD-6 retains Workspace, optional Assignment and Task identity; AD-8 carries scoped sources and access; AD-10 retains selected Method/version. Ad hoc work remains first-class. | Preserved |
| S02 — Active work | P04/P06/P13 place execution, analysis and specialists in retained runtime plus domain linkage; AD-6/7/9 preserve actual progress, origin, effects and selected artifacts. | Preserved |
| S03 — Review decisions | AD-6/9/10/13 separate human review, local edits, Method departures, affected outputs and formal acceptance; identity, scope and version are required. | Preserved |
| S04 — Automations | AD-12 owns trigger/input/Method/identity/limits/destination/escalation mandates and actual outcomes; disabling future eligibility is separate from running work. Scheduler supply remains explicit V1 work. | Preserved |
| S05 — Search and workspace | P01 and AD-6/8 preserve identity, navigation and access-scoped reopening. AD-3 retains UX selection, search-state and focus obligations. | Preserved |
| S06 — Skills and procedures | AD-10 distinguishes guidance mechanisms, maintained Method versions, permitted Task departures and memory; missing dependencies do not become permission. | Preserved |
| S07 — Capabilities and processing | P11/P15 and AD-8/14 distinguish providers, service identity, execution/inference/connector routes, limits and eligibility; no silent fallback. | Preserved |
| S08 — History, alternatives and memory | P03/P13/P14 and AD-7/9/10 preserve origins, deliberate promotion, working continuity and distinct memory contribution/use/activity policies. | Preserved |
| S09 — Team, policy and retention | AD-6/8/12/13 retain acting identity, ownership, effective revocation, retained-data boundaries and phase-specific authority; team coordination is an owned supply gap. | Preserved |
| S10 — Sharing and delivery | AD-11 requires exact authorised content, destination, identity, version and persistent attempted/confirmed/uncertain outcomes; reconciliation precedes retry. | Preserved |
| S11 — Technical work | P09/P11/P13 retain actual code/configuration/security tools, integration seams and specialist outputs; AD-8/9/14 preserve permission, coverage and failure evidence. | Preserved |
| S12 — Secondary clients and context | P02/P16 and AD-4/6/8/9/12 retain shared audit semantics, saved/live distinctions, host availability and declared client capability. Remote supply is not inferred from local SQLite. | Preserved |
| S13 — V2 native records | AD-13 keeps native identity, lifecycle, holds, amendments, retention, recovery and deliberate migration in V2; it cannot silently change V1 or operational-system authority. | Preserved |

## Component contracts

All 28 supplied component names remain governed by AD-3's binding to the final pair. Architecture ownership supports their consequential behavior; a new AD per control is unnecessary.

| Components | Load-bearing contract and architecture support |
| --- | --- |
| Icon, Avatar, Badge, StatusChip, JudgmentTag, PlanStep, Toast | Truthful, accessible attribution/status cannot manufacture approval, completion or delivery. AD-6 separates state authorities; AD-14 and Consistency Conventions require inspectable outcomes and reject toast/green-chip acceptance. The detailed accessible presentation remains in UX. |
| Button, IconButton, TextField, Switch, Choice, SegmentedControl, Tabs, Menu | Permission, unresolved operations, confirmed setting changes, noncommitting selection, focus and draft retention remain governed by UX. AD-7/11 prevent uncontrolled mutation/repeat; AD-12 separates schedule disabling from interruption; continuity retains UX draft guarantees. |
| FileChip, ApprovalCard, DiffLine, Workbook | Context removal does not delete source files; effects have bounded authority; proposals retain source/version; analysis exposes actual population, exclusions, sampling and coverage. AD-8/9/11 provide the corresponding domain and adapter rules. |
| Sidebar, Header, Composer, NavRow, Over | Stable real Task/item identity, scoped submitted input, accessible navigation and ordinary text-label semantics remain in UX; AD-6/8/10 supply their data and authority contracts. No fixed demo-record navigation is adopted. |
| StartScreen, ActiveScreen, ReviewScreen, AutomationsScreen | Actual selections, progress, review versions, rationale and persistent automation outcomes map to S01–S04 above. AD-3 retains the compositions as visual/interaction requirements; no inert handler is treated as implementation. |

The selected visual system, source palette/token applications, typography, icon/logo vocabulary and composition dimensions remain referenced through AD-3. Architecture introduces no replacement design system. Four imported screen references and nine spine-only arrangements remain distinguished in the deferred AS-UX gates.

## Journey contracts

| Journey | Architecture preservation |
| --- | --- |
| UJ-1 — Ad hoc question | Optional Assignment, scoped context, executable analysis, identified sources and explicit incomplete coverage: AD-6/8/9/14. |
| UJ-2 — Engagement through review | Method-guided work, linked review/corrections, affected outputs and external formal authority when required: AD-6/9/10/13. |
| UJ-3 — Excel reconciliation | Same supported saved workbook, distinct live access, retained unrelated edits, version checks, stale/recomputed results and unapplied conflicts: AD-8/9. |
| UJ-4 — Word workpaper | Same artifact and cited evidence, scoped proposed changes, attributable human review and separately verified delivery: AD-6/9/11/13. |
| UJ-5 — Specialist investigations | Bounded delegation, technical outputs, origins, isolated/reconciled mutations and partial failures: AD-6/7/8/9/14; P09/P13. |
| UJ-6 — Advisory options | Deliberate alternatives, supported artifacts, disclosed conversion limits, retained output and exact-audience verified sharing: AD-9/11. |
| UJ-7 — Teach and reuse | Identifiable Method/version/parameters, explicit permitted departures and affected outputs, denied departures unapplied, scoped reuse without evidence leakage: AD-8/10. |
| UJ-8 — Triggered procedure | Explicit mandate and owner, actual run outcomes, host availability, human review linkage and uncertain-effect reconciliation: AD-6/11/12/14. |

## Cross-feature boundaries and gates

- **Authority and persistence:** AD-4/6/7/13 keep working metadata, runtime history, saved artifacts, human decisions and external V1 authority distinct. The separate SQLite choice grants neither native V2 authority nor shared-server semantics. Domain commands own validated mutations; model/tool output cannot mint reviewer decisions.
- **Continuity and recovery:** AD-7/8/9 plus Consistency Conventions preserve saved work, supported context, versions and explicit uncertainty across clients/stores. Draft retention follows UX. There is no unsupported promise of offline synchronization, queued external writes, automatic resend, rollback or cloud handoff.
- **Interaction and accessibility:** AD-3 retains keyboard, semantics, focus, drafts, visible state, nonessential motion, responsive fit and stronger existing-token applications from the final UX. AD-14 and the deferred AS-UX3/4 gates require actual-host interaction and rendered checks. OQ-8 still selects operating/conformance commitments; it does not erase the concrete UX accessibility floor.
- **Open decisions:** The deferred table preserves OQ-1–12 with owners and timing. AS-UX1/2 retain placement and client-fit validation; AS-UX3/4 retain interaction and accessibility validation. The record-policy gate remains V2-specific. No open guest, evidence-copy, recall, distribution, route, release or native-policy choice is silently decided by the stack.
- **Supply and scope:** Required scheduler, team and hosted/remote capabilities retain owners and gates. Local runtime primitives or prototype screens are not claimed to supply them. Full V1 breadth and the three V2 FRs remain; an implementation increment cannot claim parity by omitting unmet requirements.

## Findings

None. No source conflict or missing architecture-level contract requiring a spine correction was found. Detailed schemas, adapter implementations, renderer behavior and production evidence remain downstream work under the existing gates; their absence in this initiative spine is not a UX preservation defect.
