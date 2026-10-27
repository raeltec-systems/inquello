# Final PRD → architecture input reconciliation

Date: 2026-10-27. Input: [final PRD](../../prds/prd-inquello-2026-10-26/prd.md). Destination: [ARCHITECTURE-SPINE.md](ARCHITECTURE-SPINE.md), draft, 238 lines. The [product extraction](.working/input-product.md) was used as a navigation aid; the original FRs, NFRs, qualitative direction and decision gates were checked directly in the PRD.

**Result: zero actual PRD-preservation gaps.** All 22 requirement groups, 44 FRs, 10 NFRs and eight source journeys remain governing. The phase split is **41 V1 FRs plus three V2 FRs: FR-38, FR-40 and FR-42**. Missing implementation or service supply is explicitly owned and gated, without becoming a product-scope cut.

This is mandatory input reconciliation, **not the optional reviewer gate**, a general architecture-quality approval, stack-version verification or a runtime test. Only the PRD was reconciled here; separate input reconciliations own companion, UX and upstream-evidence details. No source, spine or memlog was edited.

## Source and draft snapshot

Both hashes were checked again after reading and before writing this report. The architecture draft was unchanged during this reconciliation. Later substantive changes require checking their effects before reusing this conclusion.

| File | SHA-256 |
| --- | --- |
| `prds/prd-inquello-2026-10-26/prd.md` | `dc2f625a0c47c25046e8bb9713010cf894c15a478a8eefe11da034d32a385dcf` |
| `architecture/architecture-inquello-2026-10-26/ARCHITECTURE-SPINE.md` | `63c33b62f1d33629e7ce6bfa8607d71088f9cd431547497b42c600350d4423f5` |

## Qualitative direction, authority and adopted choices

| PRD input | Architecture treatment | Result |
| --- | --- | --- |
| Broad Codex-derived workbench: bring existing work, request an outcome, steer, inspect and continue; all detailed source cards remain inputs (PRD lines 17–29). | Lines 29–31, AD-1/2/4 and lines 189–214 preserve the retained engine/app-server, separate audit modules, complete inventory and continuous work. The map supplies logical ownership, not replacement requirements. | Preserved. |
| Internal/external audit, advisory and IT/IS audit; first-team validation is not a market limit; ad hoc work need not become an engagement; no universal control schema (PRD lines 25, 35–43, 47–56, 63 and 347–350). | AD-6 keeps Assignment optional and rejects a universal state machine; line 145 retains practice-specific labels; P20 retains practice workflows; line 189 retains the final experience flows. No new practice restriction, mandatory engagement field or control/deficiency schema appears. | Preserved by reference and compatible boundaries. |
| Same-file work, real technical execution, accessible ordinary review and cross-client continuity (PRD lines 93–117, 149–201, 375–378 and 393). | AD-4/5/6/9, P02/P03/P06/P07/P09/P22 and the adopted UX retain supported clients, technical tools, artifact identity and independent presentation. Sandboxing the renderer in AD-5 constrains the desktop bridge; it does not remove the engine's permitted shell/code/security capabilities. | Preserved. |
| Full V1, automation, continuous assurance and approved unattended work; only native authority/lifecycle is V2 (PRD lines 27, 233–243 and 404–420). | Line 31 and AD-12/13 preserve the split. P19/P20/P21 explicitly distinguish FR-37/39/41 V1 from FR-38/40/42 V2. AD-11 applies configured permissions or preauthorised mandates. | Preserved; no universal extra approval. |
| Formal authority differs from tool permission, local edits, agent review and delivery (PRD lines 68–70, 305–308, 319–322 and 361–369). | AD-6/7/11/13 distinguish trusted human attribution, working records, actual effects, external acceptance and phase-specific authority. No source-transaction authority follows from audit writeback. | Preserved. |
| The PRD left architecture/database/framework choices open at that time (PRD lines 450–452); the user subsequently adopted the fork, retained runtime/app-server with separate audit modules, Electron React/TypeScript, shared Rust and separate working SQLite. | AD-1–4 explicitly mark those later choices adopted. Lines 29, 67, 73, 79, 127 and 165–185 avoid deriving a new central/shared service from them. Exact seeds, drivers, integration seams and compatibility remain implementation gates. | Legitimate later decisions, not accidental PRD drift. |
| Organisational policy governs routes, retained evidence, memory, review and budgets; no default topology or provider eligibility is implied (PRD lines 29, 266–285 and 466–479). | AD-8/10/12/14 and the complete OQ table preserve these distinctions. A local working database does not select evidence retention or native authority; local execution does not establish local inference. | Preserved. |

## Functional coverage and architecture responsibility

Each architecture map row at lines 193–214 was checked against the corresponding original requirement and its consequences. “Preserved” means the requirement remains binding and the architecture supplies a compatible responsibility/boundary; it does not mean its implementation is complete.

| Source group and FRs | Original PRD lines | Destination responsibility and controlling rules | Result |
| --- | --- | --- | --- |
| P01; FR-1–2 | 81–89 | Client navigation/domain identity/runtime references; AD-6/8; optional Assignment and retained context. | Preserved. |
| P02; FR-3–4 | 93–103 | Desktop/CLI/context/remote/physical adapters; AD-3/5/6/9/12; capability limits remain route-specific. | Preserved. |
| P03; FR-5–6 | 107–117 | Environment/artifact adapters; AD-7/8/9; explicit execution/inference, origin and conflict-preserving promotion. | Preserved. |
| P04; FR-7–8 | 123–131 | Retained engine, linkage and progress; AD-1/6/7/14; state/effects/recovery remain separate. | Preserved. |
| P05; FR-9–10 | 137–145 | Source/live-context adapters and provenance; AD-6/8/9; saved/live scope, origin/version and access limits. | Preserved. |
| P06; FR-11–12 | 149–159 | Runtime tools/analysis provenance; AD-8/9; derivations, exclusions, sampling, duplicates, actual coverage and stale marking. | Preserved. |
| P07; FR-13–14 | 165–173 | File/visual/publication adapters; AD-9/11; same files, supported content, bounded publication and verified effects. | Preserved. |
| P08; FR-15–16 | 179–187 | Web/browser/site/computer adapters; AD-8/11; sourced context, identity and outcome limits. | Preserved. |
| P09; FR-17–18 | 193–201 | Domain review and actual code/configuration/security tools; AD-6/8/9/13; agent work cannot establish human approval. | Preserved. |
| P10; FR-19–20 | 207–215 | Shared Rust Method/departure rules plus inherited mechanisms; AD-4/8/10; task departures and changed-Method impacts stay explicit. | Preserved. |
| P11; FR-21–22 | 221–229 | Extension/MCP/plugin/hook/app-server seams; AD-2/5/8/14; supported contracts, authority and capability evidence. | Preserved. |
| P12; FR-23–24 | 235–243 | CLI/SDK/job adapters plus required scheduler supply; AD-7/11/12/14; actual mandate, identity, run outcomes and duplicate controls. | Preserved; supply dependency remains V1. |
| P13; FR-25–26 | 249–257 | Retained subagents/branches, domain origins/promotion; AD-6/7/8/9; coordinated mutations do not prohibit parallel work. | Preserved. |
| P14; FR-27–28 | 263–271 | Runtime continuity/scoped memory/activity adapters; AD-7/8/10; separate contribution, use, history and capture/recall. | Preserved. |
| P15; FR-29–30 | 277–285 | Provider/policy/consumption adapters; AD-8/12/14; named routes, limits and cost evidence under unresolved policy. | Preserved. |
| P16; FR-31–32 | 291–299 | Voice, notifications, companions, import/snapshot adapters; AD-6/8/11; no authority implied by presentation or migration. | Preserved. |
| P17; FR-33–34 | 305–313 | Runtime sandbox plus domain authority; AD-5/7/8/10; trusted instructions, action-specific authority and untrusted evidence. | Preserved. |
| P18; FR-35–36 | 319–327 | Domain attribution/revocation plus required team route; AD-6/7/12/13; ownership and active/unattended revocation. | Preserved; coordination dependency remains V1. |
| P19; FR-37 V1, FR-38 V2 | 333–341 | Working-store policy versus native lifecycle; AD-7/8/13/14 and retention/recovery gates. | Preserved with correct per-FR phase. |
| P20; FR-39 V1, FR-40 V2 | 347–355 | Domain Methods/review/external adapters versus native records; AD-6/10/11/13. | Preserved with correct per-FR phase. |
| P21; FR-41 V1, FR-42 V2 | 361–369 | Bounded external operations versus V2 mode/migration; AD-7/11/13; stale/uncertain reconciliation, fallback and separate authority. | Preserved with correct per-FR phase. |
| P22; FR-43–44 | 375–383 | Shared identity/state/capability contracts across all paths; AD-5–14; full inventory and unmet scope remain explicit. | Preserved. |

## Quality requirements and source journeys

| Source quality requirement | Original PRD line | Architecture destination | Result |
| --- | ---: | --- | --- |
| NFR-1 Artifact fidelity | 389 | AD-9; P03/P07/P22; compatible-file/version gates in OQ-6. | Preserved. |
| NFR-2 Analytical reliability | 390 | AD-9; P06/P09; acceptance evidence and quality counter-metrics at lines 139/185/189. | Preserved. |
| NFR-3 Confidentiality/access | 391 | AD-5/7/8/10/11/12; explicit authority, revocation and protected working-store paths. | Preserved. |
| NFR-4 Recovery/duplicate effects | 392 | AD-7/9/11/12/14; no cross-store atomicity, blind replay or implied rollback; OQ-8. | Preserved. |
| NFR-5 Usability/accessibility | 393 | Adopted UX at AD-3; client/domain separation; P01/P02/P16/P20/P22; OQ-8 and AS-UX3/4 gates. | Preserved; no conformance claim. |
| NFR-6 Performance/cost | 394 | AD-12/14; P04/P12/P15; measured effort/cost at line 185; OQ-5/7/8. | Preserved; no invented service or budget values. |
| NFR-7 Provenance | 395 | AD-6/8/9/10/13; origins, derivations, Method impacts and human/scope/version attribution. | Preserved. |
| NFR-8 Processing transparency | 396 | AD-8; separate route/data categories; OQ-9 and named route eligibility. | Preserved. |
| NFR-9 Compatibility/portability | 397 | AD-5/9/11/13/14; supported version/contracts, external fallback and V2 migration; OQ-6. | Preserved. |
| NFR-10 Operational visibility | 398 | AD-6/7/11/12/14; run/identity/delivery/recovery evidence and diagnostic data policy. | Preserved. |

All eight journeys at PRD lines 49–56 remain bound at architecture lines 11/31/189. UJ-1's ad hoc continuation uses AD-6/8 and P01/P04/P05; UJ-2's engagement review uses AD-6/10/11/13 and P18/P20; UJ-3's Excel continuation and UJ-4's Word review use AD-9/11/13 and P03/P07/P09/P21; UJ-5's specialist consolidation uses AD-7/8/9 and P06/P09/P13; UJ-6's advisory output uses AD-9/11 and P07/P08/P20; UJ-7's Method reuse uses AD-10 and P10/P14; UJ-8's triggered work uses AD-11/12/13 and P12/P18/P20/P21. The architecture does not replace these with a new journey set or require V2 to complete them in V1.

## Gates, supply gaps and claims

The 12-row gate table at architecture lines 222–233 was compared with PRD lines 466–477. Human/guest access, retained evidence, cross-Assignment recall, Method distribution/review, cost policy, client/integration contracts, validation baselines, operating/accessibility commitments, processing eligibility, release sequencing, V2 policy and final naming/design validation retain their source owners and revisit conditions. Roles remain proposed, not named appointments. The later selected visual/UX inputs do not establish naming clearance or production validation.

Scheduler/event supply, team coordination/ownership transfer and remote/service routes at architecture lines 182–184 are explicit implementation dependencies with owners and relevant OQ gates. AD-12 and line 238 keep them required V1 work. AD-7's cross-host gate prevents unsupported concurrent mutation; it does not defer FR-3/35/36 out of V1. Local SQLite and runtime history are not claimed to implement those capabilities, and no new shared service or automatic cloud continuation is assumed.

The draft does not silently choose source-copy retention, cross-client memory reuse, guest participation, review hierarchy, task/team budget values, initial release scope, provider eligibility, native-mode precedence or a universal audit method. It does not claim that runtime source availability proves hosted-service entitlement. The implementation-seed gate and the express lack of combined-stack build validation keep those promises bounded.

PRD metrics and counter-metrics at lines 433–442 remain binding. Architecture lines 139/185 retain effort, cost, recovery and quality evidence rather than claiming throughput or token counts as assurance. Source acceptance criteria remain unexecuted, and a finished planning document does not authorise rollout.

## Outcome

**Actual gaps: 0. Required corrections from this reconciliation: none.** Mechanical counts independently confirm 22 architecture P-group rows, 22 source groups, 44 source FRs, 10 source NFRs, eight source UJs and 12 architecture OQ rows. The content comparison confirms the required per-FR phase split and compatible ownership/authority boundaries. These counts and document findings are not evidence that a capability or acceptance test has been implemented or passed.
