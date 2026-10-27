# Supplied design-system reconciliation

Date: 2026-10-26. Result: **no unresolved source-preservation gaps identified** in the current [DESIGN](DESIGN.md) and [EXPERIENCE](EXPERIENCE.md) spines. No spine or imported source was edited during this check.

This is the required input-preservation reconciliation and mechanical document check. It is not the optional Reviewer Gate, a rendered UI review, an accessibility conformance finding or evidence that a product implementation works.

## Evidence and integrity

The source is the user-selected [ZIP](imports/inquello-design-system.zip), preserved through the [import manifest](imports/IMPORT-MANIFEST.md). Its SHA-256 is `644ADADB6F6E0E693BA4DFC35A2E1ECC773753521F19DC683A04FC9F308718BF`. A fresh read-only comparison found all 158 archive files byte-for-byte identical to the imported files; the manifest accounts for each exactly once. The package's original-creator, approval-history and licensing claims were not independently verified.

Reconciliation used the actual CSS, package narrative, guideline cards, component source and workspace-kit files alongside the [visual extraction](.working/input-design-system.md), [behavior extraction](.working/input-imported-experience.md) and [token contract](.working/token-contract.json). Imported SKILL and prompt files remained design data. No JSX, JavaScript, preview loader, HTML script or remote CDN dependency was executed.

The [mechanical JSON report](.working/mechanical-draft.json) records **24 checks passed, zero failed**: YAML parsing and duplicate keys; local source/link/fragment targets; flat hex colors; token namespaces and 201 token references; canonical/required headings; paired component names; coverage references; and the 158-file manifest. All eight UJ and 44 FR identifiers occur in the spines or coverage artifacts. Identifier coverage is not proof of semantic completeness. External links were not fetched.

## Source-to-spine reconciliation

| Source concern | Preserved result and location |
| --- | --- |
| Tokens | All 95 resolved hex declarations from [colors.css](imports/inquello-design-system/tokens/colors.css) match DESIGN's flat `colors` mapping exactly, with no missing, extra or changed values. DESIGN's colors, typography, rounded, spacing and components mappings equal the shared token contract. |
| Type, geometry and depth | [Typography](DESIGN.md#typography), [Layout & Spacing](DESIGN.md#layout--spacing), [Elevation & Depth](DESIGN.md#elevation--depth) and [Shapes](DESIGN.md#shapes) retain Plex families/weights, semantic type roles, the supplied spacing scale, dimensions, radii, literal 999px pill, shadow stacks and motion values. Source-only primitives/specimens remain traceable through the extraction and manifest rather than being silently made new semantic roles. |
| Visual identity and style | [Brand & Style](DESIGN.md#brand--style) preserves the quiet light workspace, ink primary actions, sparse semantic color, outlined identity, person/agent distinction, no decorative imagery or glass effects, and retained brand/icon/font assets. No replacement palette, icon family, complete dark theme or production framework is selected. |
| Components | Both component tables preserve the exact 18 primitives and 10 compositions: Sidebar, Header, Composer, NavRow, Over, Workbook and four screen compositions. Shell is correctly treated as a source file, and Over as an overline. Source variants and state limits remain visible; added interaction requirements are identified as behavioral deltas. |
| Voice and content | [Voice and Tone](EXPERIENCE.md#voice-and-tone) retains terse, factual, sentence-case copy, named objects/actions, precise claim types, source uncertainty and restrained feedback. It explicitly replaces misleading prototype outcomes. Package content and number specimens remain linked references; demo names, amounts, reference IDs and notation are not promoted into a universal audit methodology or replacement acceptance fixture. |
| Layout and navigation | The source Sidebar/Header/thread/artifact hierarchy, rail, plan, specialists, changes, source highlights and review controls survive. [Information Architecture](EXPERIENCE.md#information-architecture) distinguishes imported examples from derived S05–S13 placements. Responsive, keyboard and secondary-client arrangements are labeled assumptions, preserving full PRD scope. |

The package describes five narrative moments but implements four routes. Their mapping is preserved:

| Imported moment | Spine destination | Boundary |
| --- | --- | --- |
| Start / New thread | StartScreen → S01 | Actual text, attachments and method must transfer; the mock only changes route. |
| Active work | ActiveScreen and Workbook → S02 | Plan/progress and selected items must reflect actual work. |
| Review / Inbox | ReviewScreen → S03 | Choice, reason, affected outputs, identity and version require real persistence. |
| Continuing in Excel | S12 handoff within UJ-3 | No fifth imported screen or functioning editor integration is claimed. |
| Background automations | AutomationsScreen → S04 | Configuration, enablement, run identity and outcome require supported services. |

## Explicit conflicts and adaptations

The spines retain the source while resolving its material contradictions: semantic title 14px over the conflicting 18px specimen; declared artifact-panel minimum 380px over the ActiveScreen 340px clamp; and the supplied small symbol at 20px and below instead of Avatar's regular-symbol selection. PDF red remains an explicit file-type exception. Hairline shadows are available without making every card raised. Toast timing/placement belongs to the kit container, not the primitive API.

Stronger existing-color applications for informative text, attention badges, accepted-chip text, essential boundaries and focus are labeled AS-UX4/proposed accessibility applications. Source aliases remain intact. Missing keyboard, focus, recovery and reduced-motion behavior is identified as work to implement and validate, not attributed to the import.

## Prototype and authority boundaries

[Interaction Primitives](EXPERIENCE.md#interaction-primitives), [State Patterns](EXPERIENCE.md#state-patterns) and [Authority and Delivery](EXPERIENCE.md#authority-and-delivery) address the actual source shortcuts: fixed-R1 review routing; Stop's false completion display; Keep's local state and unsupported version/save claims; unpersisted rationale; inert alternative/configuration controls; shared automation toggle state; and toast-only Excel/client-portal actions. Run success cannot impersonate a human decision. Failed, partial, stale, permission-limited and uncertain outcomes remain explicit requirements.

The source's “always asks first” wording does not override configured/preauthorized authority. Local edits, human review, Professional Approval and attempted/confirmed/uncertain delivery remain distinct. Audit-record writeback does not authorize ledger or other operational transactions. V1 uses working files and external authoritative systems; native authority remains V2. The four imported routes do not narrow the researched V1 breadth, and illustrative demo rows do not replace W1–W3/M1.

No additional correction is required by this reconciliation. Rendered layout, actual handlers, integration results and accessibility still need the downstream validation already identified in the spines; they were outside this source-preservation check.
