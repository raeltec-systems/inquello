# Inquello scope and gates

This companion indexes the adopted contract; it does not replace source consequences, detailed cards, UX states/tokens or architecture rules. All linked adopted documents are mandatory through `SPEC.md` frontmatter.

## Source roles and decision order

| Adopted artifact | Contract role |
|---|---|
| [Final PRD](../../planning-artifacts/prds/prd-inquello-2026-10-26/prd.md) | Product behavior, phases, vocabulary, FR/NFR consequences, eight journeys, metrics and open product gates. |
| [Final PRD addendum](../../planning-artifacts/prds/prd-inquello-2026-10-26/addendum.md) | Exact W1–W3/M1 fixtures, A01–A18 evidence summaries and evidence/reuse limitations. |
| [Final DESIGN](../../planning-artifacts/ux-designs/ux-inquello-2026-10-26/DESIGN.md) | Selected visual system, exact tokens/assets, 28 components, source reconciliations and accessibility applications. |
| [Final EXPERIENCE](../../planning-artifacts/ux-designs/ux-inquello-2026-10-26/EXPERIENCE.md) | Interaction/state/authority contracts, 13 logical surfaces, all eight journeys, seven supporting paths and AS-UX1–4. |
| [Final Architecture Spine](../../planning-artifacts/architecture/architecture-inquello-2026-10-26/ARCHITECTURE-SPINE.md) | Adopted implementation contract: AD-1–AD-4 choices, AD-5–AD-14 derived rules, consistency, stack, supply and implementation gates. |
| [Product-definition addendum](../../../docs/addendum.md) | Full P01–P22 behavior and J1–J8/A01–A18 wording, interpreted through the final product/UX/architecture decisions. |
| [Scope traceability](../../../docs/PRODUCT_BRIEF_TRACEABILITY.md) | Full-scope mappings and inventory accounting; grouped capabilities do not replace mapped requirements. |
| [Detailed capability mirror](../../../docs/CODEX_AUDITOR_FEATURE_MIRROR.md) | 79 C entries, 270 mapped subfeatures and 93 proposed enhancements retained under their original status and final phase rules. |
| [Expanded feature map](../../../docs/CODEX_AUDITOR_FEATURE_MAP.md) | 20 expanded capability definitions and their detailed behaviors, read with final scope and phase decisions. |

Source roles are explicit: final PRD/addendum govern product behavior, phases and evaluation; DESIGN governs appearance and EXPERIENCE behavior, both over conflicting prototypes; final Architecture Spine governs adopted implementation. Older scope cards retain every detailed behavior under these later explicit decisions; historical unselected-framework/architecture wording does not reopen AD-1–14.

Vocabulary decided 2026-10-27 ([glossary](glossary.md)): Engagement replaces Assignment; the final PRD, EXPERIENCE and Architecture Spine were updated on 2026-10-27; older scope artifacts that still say Assignment are read as Engagement. Final UX and selected visual kit supersede earlier pending-UX wording. OQ-12 retains final name/public-brand clearance and validation. Prototype imports are references, not implemented integrations, and do not narrow full V1 breadth.

Read relevant linked UX assets when implementing their contract. Inspect cited technology evidence when choosing the fork/protocol/toolchain/driver. Working ledgers, review history, memlogs and research provenance are not extra top-level scope; no adopted file is rewritten or treated as fully absorbed.

## Scope and phase coverage

The full target retains **P01–P22, 79 C entries, 20 expanded behaviours, 270 subfeature mappings, 93 proposed enhancements under their original status, the named GCP/Vertex delta, J1–J8/UJ-1–UJ-8 and A01–A18**. Their detailed behavior remains in the nine adopted artifacts; grouping is not a scope reduction.

**V1: CAP-1–CAP-22, 41 FRs. V2: CAP-23–CAP-25, FR-38/40/42 only.** P19/P20/P21 each contributes one V1 requirement and one V2 addition. Scheduled work, approved unattended execution, continuous assurance and ordinary external-record engagement/follow-up remain V1. A first shipping increment or validation slice does not redefine the target.

The following NFR/UJ/A links are relevant verification indexes, not exclusive allocations or replacement acceptance criteria. All applicable NFR-1–NFR-10 remain binding. All eight journeys are V1; SP7 later extends applicable flows into native V2 records.

| Capability | Phase | P / FR coverage | Relevant NFR | Journey | Acceptance index |
|---|---|---|---|---|---|
| CAP-1 | V1 | P01; FR-1, FR-2 | NFR-3, NFR-5, NFR-7 | UJ-1, UJ-2 | A01, A09 |
| CAP-2 | V1 | P02; FR-3, FR-4 | NFR-3, NFR-5, NFR-9 | UJ-1, UJ-3, UJ-5 | A09, A15, A16 |
| CAP-3 | V1 | P03; FR-5, FR-6 | NFR-1, NFR-4, NFR-8 | UJ-3, UJ-5 | A04, A09, A18 |
| CAP-4 | V1 | P04; FR-7, FR-8 | NFR-4, NFR-6, NFR-10 | UJ-1–8 | A01, A09, A13, A18 |
| CAP-5 | V1 | P05; FR-9, FR-10 | NFR-2, NFR-3, NFR-7 | UJ-1, UJ-3, UJ-6 | A01, A03, A05, A17 |
| CAP-6 | V1 | P06; FR-11, FR-12 | NFR-2, NFR-6, NFR-7 | UJ-3, UJ-5 | A03, A06, A18 |
| CAP-7 | V1 | P07; FR-13, FR-14 | NFR-1, NFR-5, NFR-7, NFR-9 | UJ-3, UJ-4, UJ-6 | A03, A04, A05, A17 |
| CAP-8 | V1 | P08; FR-15, FR-16 | NFR-3, NFR-7, NFR-8 | UJ-1, UJ-5, UJ-6 | A01, A02, A06, A10 |
| CAP-9 | V1 | P09; FR-17, FR-18 | NFR-2, NFR-5, NFR-7 | UJ-2, UJ-4, UJ-5 | A05, A06, A08 |
| CAP-10 | V1 | P10; FR-19, FR-20 | NFR-3, NFR-7 | UJ-7 | A07 |
| CAP-11 | V1 | P11; FR-21, FR-22 | NFR-3, NFR-8, NFR-9 | UJ-5, UJ-7 | A07, A15, A16 |
| CAP-12 | V1 | P12; FR-23, FR-24 | NFR-3, NFR-4, NFR-6, NFR-10 | UJ-8 | A13, A14, A18 |
| CAP-13 | V1 | P13; FR-25, FR-26 | NFR-3, NFR-4, NFR-7 | UJ-5, UJ-8 | A08, A09 |
| CAP-14 | V1 | P14; FR-27, FR-28 | NFR-3, NFR-4, NFR-7 | UJ-1, UJ-7 | A07, A09, A14 |
| CAP-15 | V1 | P15; FR-29, FR-30 | NFR-6, NFR-8, NFR-9 | UJ-1, UJ-5 | A15, A18 |
| CAP-16 | V1 | P16; FR-31, FR-32 | NFR-3, NFR-5, NFR-9 | UJ-1, UJ-8 | A09, A14, A16 |
| CAP-17 | V1 | P17; FR-33, FR-34 | NFR-3, NFR-7, NFR-8 | UJ-1–8 | A07, A14, A15 |
| CAP-18 | V1 | P18; FR-35, FR-36 | NFR-3, NFR-7, NFR-10 | UJ-2, UJ-4 | A08, A14 |
| CAP-19 | V1 | P19; FR-37 | NFR-3, NFR-4, NFR-9, NFR-10 | UJ-2, UJ-8 | A09, A11, A14, A18 |
| CAP-20 | V1 | P20; FR-39 | NFR-2, NFR-5, NFR-7 | UJ-2, UJ-4, UJ-6, UJ-8 | A02, A05, A06, A10, A11, A13 |
| CAP-21 | V1 | P21; FR-41 | NFR-3, NFR-4, NFR-7, NFR-9 | UJ-4, UJ-5, UJ-8 | A10, A11 |
| CAP-22 | V1 | P22; FR-43, FR-44 | NFR-1–10 | UJ-1–8 | A01–11, A13–18 |
| CAP-23 | V2 | P19; FR-38 | NFR-3, NFR-4, NFR-7, NFR-9 | UJ-2, UJ-8 via SP7 | A12 |
| CAP-24 | V2 | P20; FR-40 | NFR-3, NFR-7, NFR-9 | UJ-2, UJ-4, UJ-6, UJ-8 via SP7 | A12 |
| CAP-25 | V2 | P21; FR-42 | NFR-3, NFR-4, NFR-7, NFR-9 | UJ-4, UJ-5, UJ-8 via SP7 | A11 V2, A12 |

NFR families retain artifact fidelity (1), analytical reliability (2), confidentiality/access (3), recovery/duplicate effects (4), usability/accessibility (5), performance/cost (6), provenance (7), processing transparency (8), portability/compatibility (9) and operational visibility (10); their full conditions and phase applicability remain in PRD §5.

## Adopted architecture and UX boundaries

Preserve [Architecture Spine](../../planning-artifacts/architecture/architecture-inquello-2026-10-26/ARCHITECTURE-SPINE.md) **AD-1–AD-4 [ADOPTED]** and **AD-5–AD-14 [DERIVED]** at their original IDs. Their complete rules govern implementation; this index does not copy or weaken them. Later choices of public Codex foundation, Electron/React/TypeScript and shared Rust/separate local working SQLite settle earlier documents' unselected-implementation wording without conferring native V1 authority or proving hosted supply.

Final DESIGN owns appearance and EXPERIENCE owns behavior over conflicting imports. The complete 28-component system, exact supplied assets/tokens and documented reconciliations remain required. S01–S04 have imported desktop references; S05–S13 are written-only placements under AS-UX1; S13 alone is V2. Twelve V1 surfaces, secondary clients and seven supporting paths cannot be reduced to the four imported screens.

## Acceptance and evidence limits

- A01–A10 and A13–A18 assess V1; A11 separates V1 external authority/export from V2 mode selection/migration; A12 assesses only V2. Capability-specific tests cover the full mapped inventory and every enabled route, including smaller capabilities and negative/recovery cases; no deferral counts as demonstrated parity.
- The final PRD addendum preserves exact proposed W1–W3/M1 rules; fixtures are examples, not universal methods. W1 retains five ledger/six bank rows, three exact matches, totals 4600/4750 and excess 150; saved R5=800 changes ledger to 4700 and excess to 50. W2 requires approval timing and effective-policy-period assessment. W3 retains seven accounts, investigates A2/A5, recognises valid A6 and preserves A7. M1 separates approved guidance from evidence instructions and identifies changed-method impacts.
- Preserve SM-1 total human effort through acceptance with wall time separate, SM-2 retrievable evidence/Method/derivation/review/delivery traceability, SM-3 tool/model/resource costs including failed/repeated work and SM-4 usable work/reconciled effects/time/human recovery effort. Report matched task classes, denominators, samples, unaccepted and abandoned work; thresholds follow the validating team's baseline (OQ-7); operating commitments follow first validation (OQ-8).
- SM-C1 wrong/missed results, SM-C2 review/rejection/correction burden, SM-C3 prohibited access/actions/disclosure/false approval or delivery, and SM-C4 content loss/overwrite/duplicate effects/unrecoverable work counterbalance claimed improvement. Negative authority cases pass before enabling affected routes.
- Evidence limits remain: W1–W3/M1 and product runtime acceptance are unexecuted; four imported desktop references cover S01–S04, nine written-only surfaces cover S05–S13, and only S13 is V2. All 28 UX components and linked assets retain requirements; prototype callbacks do not prove keyboard/semantic/focus/recovery behavior. Architecture contract review is not an install/build/runtime/security-conformance or release approval.

Exact fixture setup, duplicate identities, expected values, evidence collections, supported-file features and failure scenarios remain in the final PRD addendum and full A01–A18 wording in the product-definition addendum. Reopen/reimport and actual destination-state checks support compatibility; a transport response, toast, completed turn or green status never substitutes for accepted work.

## Decided gates

Decided by the product owner on 2026-10-27; recorded in the spec memlog. Adopted PRD text that still lists these as open is superseded here.

| Gate | Decision |
|---|---|
| OQ-1 | Team-only participation: Workspace audit-team and reviewer access with external exchange; no guest participation in V1. |
| OQ-3 | No memory isolation between Engagements or clients within a Workspace; isolation between Workspaces. Inquello extends an auditor who already holds knowledge of all their engagements. Not configurable. |
| OQ-4 | Method distribution inherits Codex mechanisms: Workspace, local and plugin-packaged skills, curated or team marketplaces, MCP configuration, Agent Security managed policy. No managed catalogue or approval workflow for first validation. |
| OQ-5 | Cost policy inherits Codex usage handling: plan/workspace limits, model/reasoning/speed selection, usage inspection, enterprise analytics. No Inquello budget values for first validation; FR-30 configured limits are the inherited limits. |
| OQ-2 | Retain references plus relied-on extracts and derivations, as Codex thread history does; no full source copies. Retained extracts are visible across a Workspace's Engagements. |
| OQ-6 | Desktop first, mirroring Codex clients; Excel, Word, PowerPoint and CSV; no named external record system for first validation, import/export only. Full target unchanged. |
| OQ-8 | Single-team scale for first validation, no service promises; workload, availability, latency, recovery/loss and accessibility targets set after first validation. |
| OQ-9 | Every documented processing route stays in scope and must be tested; none excluded or presumed approved. Eligibility verified per route before real data uses it. |
| OQ-10 | Sequencing, first increment and explicit deferrals are decided at story breakdown and recorded there with unmet acceptance. |
| OQ-7 | An internal audit team validates on the task types it picks during validation planning; no numeric thresholds until a baseline exists, measure first. Examples and acceptance owners named at validation planning. |
| OQ-13 | Added 2026-10-27. The agent browser and agent sandbox are local in V1 (Codex desktop built-in browser profile, Computer Use, OS sandbox enforcement); a hosted browser or hosted sandbox is deferred to V2 and must be revisited there. **V2 revisit marker.** |
| OQ-14 | Added 2026-10-27. Inquello owns identity and authorisation through its own auth module covering Workspace membership, audit-team roles, Engagement membership and the differing internal-audit and external-audit models; inference-provider sign-in (ChatGPT subscription, Claude, Azure, Bedrock, Vertex) is separate and only selects and authorises the inference route. Module design and hosting are decided in the architecture update; Claude route reachability to be confirmed there. |

## Open product gates

Owners are inherited proposed roles, not appointments (AS-2). Existing recommendations remain recommendations. A gate blocks its dependent commitment; independent contract/fixture work can continue. Final UX/architecture adoption answers only their explicit choices.

| Gate | Remaining decision | Proposed owner | Revisit before / boundary |
|---|---|---|---|
| OQ-11 | Resolve Organisation/Workspace precedence, review/hold/amendment/retention and migration; workspace choice within organisation policy remains a recommendation. | Product lead, audit lead and data-policy owner | Before native-mode implementation commitments; not a V1 blocker and not a reopening of AD boundaries. |
| OQ-12 | The supplied visual kit and final UX are selected; final name clearance/public-brand validation remain. Research territories do not select launch markets. | Product/design lead | Before public brand commitments; validate inherited UX assumptions before their dependent commitments. |

OQ-11 native-record policy does not block V1; OQ-12 gates public brand commitments. Numeric thresholds follow the validating team's baseline (OQ-7). Decided gates bind through the SPEC constraints. No new product decision, default policy, numerical target or release cut is inferred.

## Inherited assumptions

| Assumption | Retained claim | Proposed owner | Revisit trigger |
|---|---|---|---|
| AS-1 | Journey personas/scenarios are illustrative, not observed practitioner sessions. | Audit lead with product lead | Validate the flows with the validating internal audit team (OQ-7) before practitioner-validation or benefit claims. |
| AS-2 | Gate owners are proposed role assignments, not confirmed appointments. | Product lead | Assign named people before affected work begins. |
| AS-UX1 | S05–S13 placements are derived and require walkthroughs. | Product/design lead with practitioner and review representatives | Before navigation/screen-layout commitments; OQ-1/3/4/6 are decided; apply them without narrowing full scope. |
| AS-UX2 | Responsive and secondary-client arrangements require content-fit validation. | Design lead with client/architecture lead | Test fit, zoom, overflow and handoff before responsive/secondary-client commitments; OQ-6 is decided; conformance targets follow OQ-8 after first validation. |
| AS-UX3 | Interaction completion remains unproved on actual hosts/integrations. | Design lead with implementation/accessibility reviewer | Verify semantic/keyboard handlers, focus, draft retention and recovery before supported-interaction claims; labels/callbacks are insufficient. |
| AS-UX4 | Existing-token accessibility applications require rendered-state checks. | Design lead with accessibility reviewer | Check rendered text/control/focus pairs and states before shipping applications; preserve palette/imports, without global conformance or assumed OQ-8 targets. |

## Implementation and supply gates

These are existing commitments from the [Architecture Spine](../../planning-artifacts/architecture/architecture-inquello-2026-10-26/ARCHITECTURE-SPINE.md) Stack, Structural Seed and Operating Envelope, and Deferred sections, not scope deferrals or newly selected services. Detailed package layout/schema can wait for implementation; shared authority, dependency direction and mutation ownership cannot vary by feature.

| Dependency | Proposed owner | Required decision/evidence and trigger |
|---|---|---|
| Scheduler/event/mandate route | Architecture/integration lead with team administrator | Before enablement/promises; OQ-5/6/8/9 decided, production supply still unproven. Prove actual production supply beyond queue/heartbeat primitives; FR-23/24 remain required V1 scope. |
| Sharing, review and cross-host ownership | Product/audit leads with architecture/integration lead | Before permissions/integration commitments; OQ-1/6/9 decided, route still unproven. Local threads/SQLite do not implement team authority or remote continuity; verify explicit ownership/version transfer or gate that route. |
| Remote execution and connected services | Architecture/integration lead with organisation policy/security owner | Before route use; OQ-6/9 decided, every route still needs test and eligibility verification. Name service, identity, context and eligibility; no inferred hosted backend, automatic cloud handoff or fully local inference. |
| Environment and operating envelope | Product/design/operations leads with policy owner | Before real-data/production promises; OQ-2/8/9 decided, operating targets follow first validation. Set workload, support/availability, recovery/loss, deployment/data eligibility and retention; measure total effort/cost/recovery with quality counter-metrics. |
| Local desktop/context availability | Architecture/implementation owners within route commitments | Before promising locally sourced schedules or continuity. Validate computer/app/connection availability and disclose unavailable/interrupted work; local runtime lifecycle does not supply cloud completion. |
| Implementation seed and compatibility | Architecture/implementation leads | Before dependent code. Choose delivery fork cut and concrete facade/extension/protocol seams; verify compiler/package/driver compatibility, migrations, conflicts, secure data paths, packaging/update and ownership-transfer contracts. Keep AD dependency/authority/mutation ownership fixed. The separately linked domain-store SQLite runtime requires the WAL-reset fix: 3.51.3+ or documented fixed backport. |

Inspected source revisions and technology versions are evidence snapshots/seeds, not an implicitly selected delivery cut or validated combined stack. Follow the spine's linked evidence before dependent implementation. Its recorded upstream warning covers the app-server command and WebSocket transport in the remote Code Mode host context: both are experimental/unsupported for production. Default stdio availability establishes neither blanket production support nor Inquello readiness; verify and harden the selected fork/route before release. A separately linked SQLite driver needs independent fix verification; an upstream state-store claim is insufficient.

Source constraints, deferred gates and proposed acceptance retain their evidence status. This spec-creation work performs no installation, fork creation, runtime validation, deployment, production approval or story breakdown.
