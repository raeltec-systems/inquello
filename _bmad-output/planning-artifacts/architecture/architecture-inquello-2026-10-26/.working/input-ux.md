---
title: Inquello architecture input — final UX constraints
created: 2026-10-26
status: source-extract
sources:
  - ../../../ux-designs/ux-inquello-2026-10-26/DESIGN.md
  - ../../../ux-designs/ux-inquello-2026-10-26/EXPERIENCE.md
  - ../../../ux-designs/ux-inquello-2026-10-26/.memlog.md
---

# Architecture input from final UX

This is a source extraction for the coaching discussion, not an architecture draft or selection of alternatives. Sources are the final [DESIGN](../../../ux-designs/ux-inquello-2026-10-26/DESIGN.md), [EXPERIENCE](../../../ux-designs/ux-inquello-2026-10-26/EXPERIENCE.md) and [UX decisions](../../../ux-designs/ux-inquello-2026-10-26/.memlog.md). The current architecture intake reaffirms the public `openai/codex` fork as the foundation. That intake direction does not establish which particular upstream components or hosted services are available or sufficient; repository verification is separate from this UX extraction.

## Adopted constraints and authority

- The selected Inquello visual system governs appearance; EXPERIENCE governs behavior; both outrank conflicting imported mocks. The PRD retains product scope and authority. The supplied React/CSS kit is a visual/implementation reference, not a production framework or desktop-host choice.
- Preserve the full V1 workbench across desktop, CLI/session controls, application-adjacent assistance, mobile/remote steering and optional physical controls. Four imported routes do not define the product boundary. The user accepted four references plus written specifications for nine additional surface groups.
- Workspace → optional Assignment → Task remains the working hierarchy. Ad hoc Tasks need no invented engagement setup. Practice terminology may vary; a universal control/finding workflow is not selected.
- V1 uses supported working files and external authoritative audit systems. V1 still needs useful local work/history/review records and applicable retention controls. V2 adds native authoritative records and their lifecycle; it cannot become a prerequisite for V1.
- Treat execution permission, proposed/applied edits, Human Review, Professional Approval and attempted/confirmed/uncertain Delivery as separate meanings. An agent review, Keep action, green chip, companion or completed automation is not professional acceptance. Formal V1 acceptance comes from the designated external authority when required by the Method.
- Audit-record writeback does not authorize posting or altering ledger, HR or other operational transactions. The configured permission or explicit preauthorized mandate governs external actions; the prototype's “always asks first” language does not impose a new universal checkpoint.

Sources: EXPERIENCE [Foundation](../../../ux-designs/ux-inquello-2026-10-26/EXPERIENCE.md#foundation), [IA](../../../ux-designs/ux-inquello-2026-10-26/EXPERIENCE.md#information-architecture), [Authority and Delivery](../../../ux-designs/ux-inquello-2026-10-26/EXPERIENCE.md#authority-and-delivery).

## Responsibilities that architecture must account for

These are required capability and interface responsibilities inferred from the UX contract. They need explicit ownership in Inquello's architecture, whether satisfied by verified fork reuse, adaptation or new implementation. They are **not** proposed service boundaries, database entities, APIs or a deployment topology.

| Responsibility | Required observable contract / UX delta | Source surfaces and flows |
| --- | --- | --- |
| Work identity and navigation | Preserve Task, Workspace, optional Assignment, artifact and selected-item identity across reopen, search, branching and client changes. Search respects effective access; unavailable scope is not reported as searched. Archive navigation is not authoritative-record deletion. | S01/S05/S08/S12; UJ-1/2; SP2/SP6 |
| Task execution and status | Start carries actual text, context and Method. Expose current work, completed effects, remaining work, gaps and actual checks. Stop requests interruption, not rollback; resume rechecks context/access. State updates cannot convert pending work into done. | S01/S02; Composer, PlanStep; all UJs |
| Sources and analytical provenance | Preserve origin/version, saved versus supported live state, source association, input population, counts, exclusions, sampling parameters, duplicate treatment, derivations and actual examined coverage. Changed evidence or Method identifies affected outputs; missing access is distinct from missing data. | S02/S03/S11/S12; Workbook/JudgmentTag; UJ-3/5 |
| Artifact editing and editor handoff | Preview, proposed diffs, local application and delivery are distinct. Same-file Excel/Word/presentation continuation checks versions, respects unrelated edits and supported features, recomputes or marks stale, and exposes conflicts or unsupported conversion before destructive changes. | S02/S03/S10/S12; DiffLine/Workbook; UJ-3/4/6 |
| Method identity and departures | Inspect chosen Method/version/parameters/dependencies. Retain permitted Task-specific departure, rationale and affected scope/outputs separately from maintained-Method changes; show it with relied-on work to an applicable reviewer. Denied departures remain unapplied, with draft rationale retained; they grant no authority. | S06 → S02/S03; UJ-7, S06 failure state |
| Review and attributed decisions | Retain selected treatment, rationale, responsible person, scope and reviewed version. Check the current version before committing; preserve drafts on failure. A local decision record remains distinguishable from confirmed external Professional Approval. | S03/S09/S10; ReviewScreen/Avatar/StatusChip; UJ-2/4 |
| External operations and reconciliation | Before an authorized action expose destination, acting identity, exact content/field changes and relevant version; afterwards retain operation identity and verification evidence. Preserve unrelated fields. Stale proposals return to review; an unknown remote result requires reconciliation before retry. | S10 and relevant S02/S03/S04 actions; UJ-2/4/6/8; SP4 |
| Automation mandates and ownership | Persist trigger/input/Method/identity/limits/destination/escalation and effective enablement. Expose missing/not received, not run, running, incomplete, failed and no-exceptions outcomes distinctly. Disable affects future eligibility; running work is handled separately. Duplicate events and departed owners cannot silently cause repeated or unauthorized effects. | S04/S09/S10; UJ-8 |
| Delegation, alternatives and technical execution | Carry bounded scope and sources into specialist work; retain progress, errors, disagreements, incomplete coverage and origin when forking/rejoining. Coordinate or isolate conflicting writes and protect concurrent edits on promotion. Queries, scripts, configuration/security work and structured programmatic results remain real capabilities. | S02/S08/S11/S12; UJ-5; SP2/SP5 |
| Capability, route and consumption visibility | Show effective provider/deployment/service identity and supported limits; distinguish execution, inference and browser/connector routes. Preserve allowed gateways/local-model routes and named Bedrock, Azure Foundry/Azure OpenAI and GCP/Vertex breadth without assuming eligibility. Explain missing/revoked access, incompatible route or limits; no silent fallback or purchase. | S07/S09; SP1; UJ-5/7/8 |
| Scoped retained knowledge and policy | Keep history, memory contribution, memory use and optional activity capture/recall distinct; client evidence does not become shared guidance by default. Make applicable policy inspectable for working files/evidence, history/logs/telemetry, backups and unattended work. Revocation, reassignment, deletion and retained history are different outcomes. | S06/S08/S09; UJ-7/8; SP2/SP3 |
| Client continuity and attention | Every supported client preserves Task identity, authority, source context and actual outcome while declaring unavailable actions. Voice instructions are reviewable/correctable. Notifications distinguish attention from completion; optional companions return to the named Task, and their absence cannot hide Task controls/status. | S12 with S02; UJ-1/3/5/8; SP6 |
| Native-record continuation — V2 | Preserve attributed human/scope/version decisions, relationships/history, affected approvals and declared migration losses. Show hold conflicts, partial migration and destination failures; existing authority stays explicit until a verified migration outcome. | S13; SP7; FR-38/40/42 only |

The eight source UJs, required states and supporting paths are canonical in [EXPERIENCE Key Flows](../../../ux-designs/ux-inquello-2026-10-26/EXPERIENCE.md#key-flows); the [coverage ledger](../../../ux-designs/ux-inquello-2026-10-26/.working/experience-coverage.md) maps their existing FR/NFR relationships. This table adds no requirement IDs or phase cuts.

## State, persistence and client consistency

The UX commits to semantic distinctions, not a universal state machine. Run state, artifact existence, check completeness, review/revision, professional acceptance and delivery outcome must be independently understandable where applicable. Coverage is examined scope, not a count of Tasks, agents or tokens.

Keep unsent input and review rationale in the current session where possible; preserve confirmed saved artifacts and identifiable versions. Durable work/decision/operation history must support the declared resume, review and reconciliation behaviors, but storage location, retention duration and recovery guarantees are not selected. A cached preview cannot bypass revoked authority. Lost connection must identify the unavailable capability without promising universal offline operation, local persistence, automatic sync, queued external writes or reconnect resend.

Interaction state also has continuity requirements: selected artifact/item, available draft and source context survive ordinary view changes; tabs do not save or authorize writes. Background activity does not steal focus. Critical failures, evidence gaps, stale work and uncertain delivery remain in persistent context rather than a disappearing Toast. These requirements apply to whichever client and event/update mechanisms are later chosen. Sources: [State Patterns](../../../ux-designs/ux-inquello-2026-10-26/EXPERIENCE.md#state-patterns), [Interaction Primitives](../../../ux-designs/ux-inquello-2026-10-26/EXPERIENCE.md#interaction-primitives), [Responsive & Platform](../../../ux-designs/ux-inquello-2026-10-26/EXPERIENCE.md#responsive--platform).

## Expected reuse boundary and supplied gaps

**Fork foundation:** inspect the actual public source for reusable agent execution, sessions, context, tool/extension contracts, permissions, programmatic access, delegation and continuity behavior needed by the UX. Preserve verified compatible behavior rather than replacing it by analogy. The UX files do not establish source availability or parity for a desktop host, proprietary frontend, hosted execution, connected services, authentication entitlement or a particular provider route. Those need independent evidence and deliberate decisions.

**Inquello responsibility:** the provenance, Method/departure, human-review, artifact fidelity, delivery verification, scoped retention and phase-specific record-authority contracts above must be satisfied even if the fork supplies useful lower-level mechanisms. It is not yet determined which require extensions versus new modules. A module's existence upstream would not by itself prove these audit semantics.

**Selected visual source:** preserve DESIGN's token names/values, identity assets, Plex typography, Lucide vocabulary and explicit visual reconciliations. The 18 supplied primitives are `Icon`, `Button`, `IconButton`, `Avatar`, `Badge`, `TextField`, `Switch`, `Choice`, `SegmentedControl`, `Tabs`, `Menu`, `StatusChip`, `JudgmentTag`, `FileChip`, `PlanStep`, `ApprovalCard`, `DiffLine`, `Toast`. The 10 supplied compositions are `Sidebar`, `Header`, `Composer`, `NavRow`, `Over`, `Workbook`, `StartScreen`, `ActiveScreen`, `ReviewScreen`, `AutomationsScreen`. `Shell.jsx` groups compositions; `Over` is an overline. No named component is missing from the final paired tables.

**Behavior not supplied by those components:** complete keyboard/focus semantics for custom controls/rows; full disabled/loading/error/recovery variants; actual Start-to-Task input handoff; real item selection; truthful interruption; persisted review choices/rationale/diffs/attribution; automation configuration and enablement; verified sends/saves/editor handoffs; or a functioning technical console. PlanStep's pending/running/done and StatusChip's source taxonomy cannot cover all product states by themselves. React callbacks, local state, hard-coded workbook figures and toasts are not these contracts. Follow the [paired component rules](../../../ux-designs/ux-inquello-2026-10-26/EXPERIENCE.md#component-patterns) rather than copying mock behavior.

**No supplied full layouts for S05–S13:** search/navigation; skills/procedures; capabilities/processing; history/alternatives/memory; team/policy/retained material; sharing/delivery; technical investigation; secondary clients/context/companions; and native records/migration. These remain the accepted spine-only groups. Their screen arrangements are proposed, not a demand for nine independent routes/modules. No complete responsive, internationalization, dark-theme or reduced-motion implementation is supplied. The [manifest](../../../ux-designs/ux-inquello-2026-10-26/imports/IMPORT-MANIFEST.md) preserves all 158 source files and their roles; imported scripts were not executed in this extraction.

## Visual and interaction constraints on implementation

Use DESIGN as the appearance contract, not new numeric defaults: sidebar/rail 264/52px, Header 48px, thread maximum 720px, artifact panel default/minimum 560/380px, semantic title 14px, and small agent symbol at 20px or below. Content-fit rearrangement must preserve usable text and independent artifact overflow instead of compressing desktop columns. No desktop host or numeric responsive breakpoints are chosen by these dimensions.

All clients need named/keyboard-operable actions, meaningful focus, status announcements, preserved source/table semantics, zoom/text resizing and non-color state cues. Escape closes the top transient layer without also stopping work; advertised shortcuts must match the chosen host and remain supplemental to visible controls. Reduced motion retains a named running state. DESIGN's stronger existing-color applications and stated 4.5:1 normal-text/3:1 qualifying large-text or meaningful non-text screening floors are requirements to validate in rendered contexts, not a completed conformance assessment. OQ-8 still selects applicable commitments.

## Choices and AS-UX gates to carry into coaching

| Gate | Preserved status and decision dependency |
| --- | --- |
| AS-UX1 — Derived placements | Product/design lead with practitioner/reviewer representatives should walk S05–S13 before committing navigation/layouts. Relevant collaboration, recall, method and integration choices remain OQ-1/3/4/6. Accepting spine-only references does not settle those choices. |
| AS-UX2 — Responsive arrangements | Design/client/architecture leads must test content fit, zoom, overflow and handoff on selected clients before client/layout commitments. OQ-6/8 remain authoritative for support and conformance targets. |
| AS-UX3 — Interaction completion | Design/implementation/accessibility review must verify real host handlers, semantics, focus, draft retention and recovery. Mock callbacks and shortcut labels are insufficient. |
| AS-UX4 — Existing-token accessibility applications | Design/accessibility review must check actual adjacent pairs and states before shipping; preserve the selected palette and original imports. No global compliance conclusion follows from static ratios. |

No production UI stack, desktop host, rendering toolkit, backend topology, persistence engine, event transport, authentication/tenancy model, editor integration, provider selection or deployment location is selected by this extract. UX also leaves the PRD's guest policy, retained-evidence approach, cross-Assignment recall, method distribution, budget policy, supported clients/formats, validation participants, operational commitments, processing eligibility, release sequencing, native-mode policy and name clearance open. The existing role owners/revisit gates remain in [Open Items and Validation Boundaries](../../../ux-designs/ux-inquello-2026-10-26/EXPERIENCE.md#open-items-and-validation-boundaries); native policy gates apply to V2, not V1.

Final UX static reviews resolved the Method-departure omission and verified mechanical/reference consistency; that is evidence of documentation quality, not runtime conformance. Architecture validation should retain W1–W3/M1, editor round trips, permission/revocation, keyboard/focus, conflict and uncertain-delivery cases without substituting the imported demo fixtures.

Source snapshot: DESIGN SHA-256 `BFCF9BE0A13C474B017FD5CD5971655162C83D1361DEBB4E611577D8E1F109E3`; EXPERIENCE SHA-256 `6CE184C470887382F80B9A2668D9B3518C55C1A550984F0A1665D29F4F06003B`. Both have `status: final`. No spine, imported source or memlog was modified.
