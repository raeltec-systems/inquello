# UX extraction for the Inquello spec

Read-only source extraction; no source, SPEC, or memlog edits and no kit execution or new research. Line references below refer to the final source files as read on 2026-10-27.

## Sources and disposition

| Alias | Source | Contract disposition |
| --- | --- | --- |
| D | `../../../planning-artifacts/ux-designs/ux-inquello-2026-10-26/DESIGN.md` | Adopt unchanged; visual identity, exact tokens, 28 components, reconciliations and accessibility applications remain downstream-required. |
| E | `../../../planning-artifacts/ux-designs/ux-inquello-2026-10-26/EXPERIENCE.md` | Adopt unchanged; interaction, surfaces, states, flows, platform continuity, authority and UX assumptions remain downstream-required. |
| A | `../../../planning-artifacts/architecture/architecture-inquello-2026-10-26/ARCHITECTURE-SPINE.md` | Compared against the final architecture, including AD-1–14 and deferred gates. |
| P | `../../../planning-artifacts/prds/prd-inquello-2026-10-26/prd.md` | Used to confirm vocabulary and same-file/product-success intent; parent extraction owns complete PRD accounting. |

In SPEC.md frontmatter the adopted UX paths are `../../planning-artifacts/ux-designs/ux-inquello-2026-10-26/DESIGN.md` and `../../planning-artifacts/ux-designs/ux-inquello-2026-10-26/EXPERIENCE.md`. These belong in `companions`, not merely `sources`: the kernel cannot replace their detailed contracts. The source docs retain their links to the selected archive, manifest, CSS, fonts, identity/icon assets, declarations and prototype references. Downstream implementation reads the relevant linked source assets; source prompts are descriptive evidence, not agent instructions. Working ledgers/reviews are provenance rather than new top-level product companions (D:405–411, 446, 540–542; E:17–23).

## Kernel-worthy constraints and success

- Preserve the complete multi-surface V1 workbench with supported working files and external audit-record authority; V2 native authority is additional and is not a V1 prerequisite. Workspace → optional Assignment → Task permits first-class ad hoc work. A four-screen import cannot narrow scope (E:17–27, 31–43; A:31, 129–139).
- Work must retain Task/source/artifact identity, accessible context and actual status across editors, clients, specialists, branches and resumes. Saved-file access does not establish live selection/unsaved application-state access or remote-record authority. Report unsupported handoffs and missing context truthfully; inspect changed versions, preserve unrelated supported content and recompute or mark affected results stale (P:64–69, 165–168, 374–378; E:93–99, 139, 164–169, 209–227, 277–281).
- Separate permission to execute, proposed/applied local edit, human review, Professional Approval and attempted/confirmed/uncertain delivery. Record authorised person/scope/version where applicable. Neither Keep/Revert, agent review, successful run, green marker nor toast establishes professional acceptance. V1 Method-required formal acceptance belongs to the designated external authority; there is no universal sign-off step or extra confirmation for every reversible action (E:74–100, 171–177; A:87–97, 129–147).
- Before consequential external effects expose destination, acting identity, exact content/field change and relevant version under configured permission or a permitted mandate. Retain operation identity, verify destination and reconcile uncertain effects before retry; no blind repeat, reconnect resend, unrelated-field change or source-transaction authority inferred from audit writeback (E:175–177, 121, 207, 217, 247, 264–268; A:117–127).
- Make observation/calculation/suggestion/human decision/gap and actual population, counts, exclusions, duplicate treatment, sampling parameters, coverage, uncertainty and derivation inspectable. No-exceptions means examined population, not full assurance. Technical/security investigations remain actual capabilities; ordinary review must not require code literacy (E:51–63, 85–96, 193–194, 212, 229–247; A:105–109, 135–139).
- Retain selected Method/version/parameters, permitted Task-specific departure, rationale and affected scope/outputs; expose these with relied-on work. A departure neither changes the maintained Method nor grants authority. Shared-guidance change/distribution follows actual policy, separate from case evidence, memory contribution/use and optional activity recall. Denied departures stay unapplied; changed Methods/evidence identify affected outputs (E:36–39, 117–119, 249–257, 277; A:99–115).
- Surface effective provider/deployment, acting service identity, capability limits and distinct execution, inference and browser/connector routes; local execution does not mean local inference. Retention/log/backup/unattended policy remains distinct. No silent provider/environment fallback, purchase or inferred service approval (E:37–47, 118, 276; A:99–103).
- Preserve usable work/drafts and truthful loading/empty/missing/inaccessible/stale/blocked/partial/interrupted/failed/uncertain states. Stop requests interruption and is not rollback; disabling a schedule affects future eligibility only. Recheck version/access on recovery; do not promise unimplemented persistence, synchronisation, queued writes or automatic retry (E:75–90, 104–139, 169, 259–268; A:93–97, 123–127, 145–147).
- Implement the selected visual vocabulary plus the explicit accessibility floor, while retaining AS-UX1–4 as validation assumptions. Exact visual tokens, source reconciliations, semantics, keyboard/focus, state persistence, content-fit reflow and supported-client behavior live in D/E, not in a bloated kernel (D:407, 432–444, 450–503, 507–559; E:128–169, 292–299).

Concrete UX success is demonstrated continuation of the same supported work through all eight journeys: inspect sources/coverage/uncertainty, preserve external edits and supported file content, expose valid human decision and delivery states, recover from denied/stale/interrupted/uncertain cases and navigate core actions accessibly on declared clients. Use W1–W3/M1 plus presentation round trips, permission/revocation, keyboard/focus, external-edit conflict and uncertain-delivery cases; assess total effort through acceptance and reviewer correction burden, not speed or run counts alone. These are proposed, unexecuted checks, not claimed validation (E:187–268, 288–299; P:23, 389–396; A:187, 191).

## Load-bearing catalogs retained in adopted companions

### Surfaces and clients

E:29–43 defines thirteen stable logical surfaces, without committing route topology or new branded APIs:

| IDs | Coverage | Evidence status/phase |
| --- | --- | --- |
| S01–S04 | Start work; Active work; Review and decisions; Automations | Four **mocked-by-import** desktop references, all V1; integration/save/configuration handlers are not working evidence. |
| S05–S08 | Search/navigation; Skills/procedures; Capabilities/processing; History/alternatives/memory | Four **spine-only** AS-UX1 written surfaces, all V1. |
| S09–S12 | Team/policy/retained material; Sharing/delivery; Technical investigation; Secondary clients/context capture | Four **spine-only** AS-UX1 written surfaces, all V1. |
| S13 | Native records/migration | One **spine-only** AS-UX1 surface, V2 only. |

Thus **four imported references + nine written-only surfaces = thirteen**, with twelve V1 surfaces and one V2 surface. The four references do not establish complete V1 coverage or runtime behavior. No new mock was generated (E:21–43, 299; A:236).

Desktop, CLI/session, SDK/programmatic, application-adjacent, mobile/remote steering, voice and optional physical controls retain declared capability limits and the same permitted Task/authority. Notifications/optional companions expose attention and return to the identified Task; their absence must leave status and controls usable. No reduced mobile V1, invented synchronization engine or implicit offline promise is selected (E:19, 42, 123, 154–169, 280–281).

### Components and visual quirks

The exact shared vocabulary is **18 primitives + 10 compositions = 28** (D:194–398, 507–538; E:69–100):

- Primitives: Icon, Button, IconButton, Avatar, Badge, TextField, Switch, Choice, SegmentedControl, Tabs, Menu, StatusChip, JudgmentTag, FileChip, PlanStep, ApprovalCard, DiffLine, Toast.
- Compositions: Sidebar, Header, Composer, NavRow, Over, Workbook, StartScreen, ActiveScreen, ReviewScreen, AutomationsScreen.

`Shell.jsx` groups compositions; it is not a separate exported Shell component. `Over` is a text overline, not an overlay. The palette, IBM Plex type, outlined wordmark/small symbol, supplied assets and exact numeric tokens remain selected. Primary actions use ink, not generic blue chrome. No new palette/font/icon family, automatic dark theme, decorative imagery, gradients/glass/coloured side stripes or bounce effects are selected (D:403–415, 430, 450, 497–503, 507, 548–558).

Preserve these explicit source reconciliations: title semantic token **14px** wins over the 18px specimen; StartScreen display is 28px; artifact-panel minimum **380px** wins over prototype 340px/narrower aside clamps; supplied small agent symbol applies at **≤20px**, including the default 19px rendered agent; literal pill radius is **999px**. Exact breakpoints/secondary-client layouts remain downstream work. Self-hosted fonts cover only supplied normal Latin Sans 400/500/600 and Mono 400/500; no invented italic/700/script coverage (D:409, 450–480, 501–503, 552).

Accessibility applies stronger **existing** tokens, keeping raw aliases/imports intact: meaningful faint text→muted; amber attention text→ink-900; accepted-chip text→green-800; essential pale boundaries→ink-600; blue-600 supplies meaningful focus with pale ring supplementary. Screen text at 4.5:1 normal/3:1 qualifying large; meaningful control indicators at 3:1 without rounding; targets 24×24 CSS px or documented applicable exception, while retaining compact visual marks. Labels/prefixes/identity accompany color; rendered states, host behavior and actual adjacent pairs require verification. This is not a full conformance claim or OQ-8 resolution (D:407, 432–444, 550–559; E:141–152).

### Eight flows and seven supporting paths

All eight named UJs remain V1 and their protagonists illustrative; SP7 extends applicable flows into V2 (E:187–282):

| Flow | Essential outcome/recovery | Source lines |
| --- | --- | --- |
| UJ-1 — Amina answers an ad hoc question (source J1) | Useful sourced answer/saved artifact; accessible uncertainty/coverage; continue same Task without forced Assignment; preserve request and expose unreadable/revoked source. | E:189–197 |
| UJ-2 — Amina and Noah carry an engagement through review (J2) | Reviewable reporting package, actual human review and separately verified delivery/formal external acceptance; stale/missing/uncertain work remains explicit. | E:199–207 |
| UJ-3 — Amina continues a reconciliation in Excel (J3) | W1-based validation, actual saved-file handoff, external edit and continuation in the **same workbook** with explained recomputation/staleness and intact supported content; preserve conflicts and post no ledger transaction. | E:209–217 |
| UJ-4 — Amina and Noah revise a Word workpaper (J4) | Same saved workpaper, version-bound evidence/argument/rationale, local Keep/Revert distinct from professional decision and external delivery; retain draft and expose feature/reference/effective-policy-date limits. | E:219–227 |
| UJ-5 — Dev reconciles specialist investigations (J5) | Actual technical evidence/coverage, gaps/disagreement and bounded delegation; retain branch origins, prevent silent overwrite and expose runtime/service/permission failure. | E:229–237 |
| UJ-6 — Amina develops advisory options (J6) | Editable options with evidence and labelled estimates/limits; distinguish generation/publication/delivery; no mandatory finding/control schema or broader sharing fallback. | E:239–247 |
| UJ-7 — Amina teaches and reuses a procedure (J7) | Identifiable Method/version/parameters/departures, separate case evidence and maintained guidance, retained drafts and visible changed-Method impacts. | E:249–257 |
| UJ-8 — Noah follows a triggered procedure through (J8) | Traceable mandate, actual population/run outcome, review, delivery, retest and closure authority; safe duplicate/recovery handling and responsibility through departure. | E:259–268 |

SP1 route/capability selection, SP2 resume/branch/recall, SP3 assignment/revocation/retention, SP4 bounded sharing, SP5 programmatic/technical continuation and SP6 cross-client capture preserve less-visible V1 scope; SP7 native migration is V2. These are supporting paths within existing journeys, not new product scope (E:270–282).

## AS-UX1–4: carry exact owners and triggers

Owners are proposed roles, not named appointments; PRD open-gate owners remain authoritative (E:286–297).

| Assumption | Proposed owner | Revisit trigger and boundary |
| --- | --- | --- |
| AS-UX1 — Derived placements | Product/design lead with practitioner and review representatives | Walk through S05–S13 **before committing navigation or screen layouts**; resolve relevant OQ-1/OQ-3/OQ-4/OQ-6 dependencies. Full scope unchanged. |
| AS-UX2 — Responsive arrangements | Design lead with client/architecture lead | Test content fit, zoom, overflow and handoff on selected clients **before responsive or secondary-client implementation commitments**; OQ-6/OQ-8 choose support/conformance targets. |
| AS-UX3 — Interaction completion | Design lead with implementation/accessibility reviewer | Verify keyboard/semantic handlers, focus, draft retention and recovery on actual host/integrations **before claiming supported interaction**. Shortcut labels/callbacks are insufficient. |
| AS-UX4 — Existing-token accessibility applications | Design lead with accessibility reviewer | Check rendered text/control/focus pairs and interaction states **before shipping those applications**; preserve palette/imports. No global conformance claim or inferred OQ-8 target. |

## Architecture coherence: no unresolved contradiction found

- D:405/548 and E:17/156 say the imported React kit does not itself choose a production framework. A:69–79 independently records the later user-adopted Electron + React/TypeScript + shared Rust/working SQLite choices. This resolves the formerly unselected implementation choice without replacing the UX or changing imported files; it is not a source conflict requiring a new question.
- Logical UX surfaces do not commit routes/services (E:23–27); A:29, 67, 79, 167–179 likewise separates domain ownership from physical topology. Architecture's local working store does not replace external V1 record authority or implement complete sharing/scheduler/hosted routes (A:79, 123–139, 181–187).
- E's approval/file/delivery/Method/recovery distinctions align with AD-6–13 (A:87–133). Architecture adds enforceable reviewed-basis revision, mutation ownership, mandate revision and privilege boundaries; these strengthen the UX distinctions without conflicting with them.
- Multi-client V1 scope and the lack of unproven synchronization/backend guarantees align: architecture explicitly owns still-unimplemented V1 supply gaps and forbids counting deferred/unverified scope as met (E:154–177, 299; A:97, 123–139, 181–187, 240).
- All OQ-1–12 and AS-UX1–4 survive in A:222–238. Architecture aggregates UX owners/triggers; preserve the more specific E:292–297 text through adoption rather than weakening it in a short summary.

## Preservation accounting

Adopting D and E unchanged preserves every load-bearing UX claim; the kernel selects only cross-cutting constraints/success. No new product question, policy, capability, mock, test result or approval is inferred.

| Source portion | Retained destination/value |
| --- | --- |
| D:18–398 tokens; 401–411 identity/source hierarchy; 413–503 visual system | Adopted D: exact values, brand/assets, contrast applications, typography/layout/source conflicts, depth/motion/geometry. Kernel only points to selected system and validation boundaries. |
| D:505–542 components/assets; 544–559 do/don't and known gaps | Adopted D: all 28 names, per-component visual/state contract, source links, known implementation gaps and nonselected visual choices. |
| E:15–47 foundation/IA | Adopted E: precedence, full scope, hierarchy, 13 surfaces, routes and policy distinctions. Kernel retains phase/continuity constraints. |
| E:49–102 copy/components | Adopted E: truthful language, exact behavioral/semantic deltas for 28 components, no simulated callbacks. Kernel retains authority/status distinctions. |
| E:104–152 states/interactions/accessibility | Adopted E: each surface's recovery/permission/empty/focus states and keyboard/target/contrast requirements. Kernel retains truthful recovery and accessible completion. |
| E:154–183 platforms/authority/anti-patterns | Adopted E: content-fit client arrangements, limits, delivery/approval boundaries and prohibited prototype behavior. Kernel retains same-file/multi-client/authority essentials. |
| E:185–282 journeys/supporting paths | Adopted E: all eight UJs, climax and failure/recovery detail, all seven SPs and V2 boundary. Kernel capability/success remains grounded in these flows. |
| E:284–299 gates/assumptions/evidence boundaries | Adopted E: OQ carry-forward, exact AS-UX owners/triggers, proposed validation and four-reference/nine-written distinction. |

Wrapper-only handling: source frontmatter/provenance remains in the adopted files but need not be repeated in the kernel; operational working ledgers, archive inventories and review history are not new top-level contract claims. No source file is removed or altered, and no load-bearing claim is discarded as wrapper.
