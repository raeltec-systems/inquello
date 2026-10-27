# UX source and scope fidelity review

Date: 2026-10-26. Reviewed draft: DESIGN.md and EXPERIENCE.md, with the three source extracts, experience coverage ledger, and PRD/companion reconciliation reports. The final PRD and its companion were read directly to check scope, requirements, fixtures and decision gates. Imported material was inspected only as source data; no imported code or instructions were executed.

**Verdict: one bounded source-to-UX omission needs correction.** The broad product direction, phase boundary, supplied visual reference and unresolved decisions remain intact. The omission concerns explicit task-specific Method departures in FR-20. It is the same issue identified by the parallel rubric review and must be counted once in the combined findings.

| Severity | Count |
| --- | ---: |
| Critical / P0 | 0 |
| High / P1 | 0 |
| Medium / P2 | 1 |
| Low / P3 | 0 |

## Finding

### SF-1 — Record task-specific Method departures without turning them into Method changes — Medium / P2

**Exact destination locations:** EXPERIENCE.md line 36 (S06 responsibility), line 117 (S06 states), lines 252–255 (UJ-7 steps 2–5), and `.working/experience-coverage.md` line 28 (FR-20 mapping to S06/S03 and UJ-7).

**Authoritative source:** [final PRD](../../prds/prd-inquello-2026-10-26/prd.md), FR-20 at lines 212–215, requires users to distinguish task guidance, maintained Methods, memory and enforced policy, with relevant versions and explicit departures recorded for relied-on work. The requirement is correctly retained in [input-prd-ux.md](.working/input-prd-ux.md), FR-20, but the destination treatment only describes refining instructions/skills, inspecting versions/parameters/dependencies and reusing the Method. It does not give the user a way to record and later inspect a departure for the particular Task separately from revising the reusable Method.

**Why it matters:** a practitioner can legitimately follow a case-specific departure while the maintained Method remains unchanged. The current flow can make that appear to be a Method refinement, or leave the reviewer unable to identify that the relied-on work departed from the selected Method. A mapping to the FR title does not itself supply this interaction.

**Suggested bounded correction:** in the existing S06/UJ-7 treatment, let the practitioner identify a permitted Task-specific departure, its rationale and affected scope/output, retaining the selected Method/version. Make the recorded departure inspectable in S02/S03 alongside the relied-on work and applicable review. Keep a departure distinct from publishing a new Method version or promoting a case correction into a team rule. Apply the actual selected policy; do not add a mandatory catalogue, reviewer hierarchy or universal approval checkpoint. Update the FR-20 coverage row to point to this explicit treatment.

Method-change impact is already present at EXPERIENCE.md lines 204 and 257. That part of FR-20 is preserved and is not a second finding. The correction can extend the existing treatment without replacing it.

## Category verdicts and supporting evidence

References below identify the reviewed versions' line locations. “Preserved” is a document-fidelity finding, not implementation or acceptance evidence.

| Category | Verdict | Exact destination and source evidence |
| --- | --- | --- |
| Full workbench scope and phase boundary | Preserved | EXPERIENCE lines 17–23, 31–43 and 282 retain the broad workbench and V2 S13 continuation. PRD lines 17, 27 and 404–410 retain the full inventory: **44 FRs total, 41 V1 and three V2 (FR-38/40/42)**. Four imported references do not limit the product to four screens. |
| Functional/quality/journey coverage | One bounded omission | The ledger maps all 44 FRs, 10 NFRs and eight exact UJ names. EXPERIENCE lines 189–268 preserve the eight source journeys from PRD lines 49–56. FR-20's mapped location needs SF-1; no other material source-to-UX omission was found in this review. |
| Existing files and same-file continuation | Preserved | EXPERIENCE lines 165, 209–227 retain saved/live distinctions, Excel/Word continuation, changed-input detection, supported content and explicit conflict. PRD FR-4/6/13, lines 103, 115–117 and 165–168; companion W1/W2, lines 24–26, remain governing. |
| External authority, human decisions and delivery | Preserved | EXPERIENCE lines 173–177 and 279 separate execution permission, local edits, human decisions, Professional Approval and attempted/confirmed/uncertain delivery. PRD lines 68–70, 361–369 and 395 require these distinctions. Audit-record writeback does not confer source-transaction authority. |
| Automation and approved unattended work | Preserved | EXPERIENCE lines 59, 88, 175 and 259–268 retain configured mandates, already-authorised actions, explicit run outcomes, duplicate handling and ownership. PRD lines 27–29, 240–243 and 305–308 govern. The imported “Contacting the client always asks first” at ActiveScreen.jsx line 43 is explicitly rejected as universal policy in EXPERIENCE line 59. |
| Technical work, processing routes and smaller capabilities | Preserved | EXPERIENCE S07–S12, lines 37–47, 118–123, 164–167, 229–237 and 276–281 retain technical/security work, programmatic continuation, alternatives, memory/activity recall, provider distinctions, notifications and optional companions. PRD FR-3–6/18/21–32 and NFR-8 remain authoritative; service compatibility is not assumed. |
| Method, memory and input authority | Partial: SF-1 only | EXPERIENCE lines 251–257 retain approved guidance, dependency/version inspection, client evidence boundaries and Method-change impacts; SP2 separates memory contribution/use and activity recall. PRD FR-20/27/28/34 and companion M1 line 30 govern. The task-specific departure interaction remains absent as described above. |
| Fixture and evaluation fidelity | Preserved | EXPERIENCE line 211 explicitly uses companion W1, not imported demo rows; lines 217, 227, 237, 247, 257 and 268 retain key failure/recovery consequences. The companion's exact W1–W3/M1 data at lines 24–30 and A01–A18 at lines 36–53 stay binding by reference. No runtime acceptance, numerical improvement or full parity is claimed. |
| Visual-source selection and import authority | Preserved | DESIGN lines 405–411 identifies the later user-selected package, preserves product authority and treats embedded prompts as source data. EXPERIENCE lines 17–23 establishes the spines' precedence over conflicting imports without displacing PRD/companion authority. Import readme line 10's “approved identity” does not become name clearance or general product approval. |
| New promises or silently resolved gates | None found | EXPERIENCE lines 23, 286–299 and DESIGN lines 407, 434, 480 and 559 label AS-UX1–4, unrendered surfaces, interaction completion and accessibility applications. All OQ-1–12 remain carried forward from PRD lines 466–479, with only the user's later visual-source selection advanced. No framework, topology, guest policy, memory policy, budget, release cut or production accessibility claim is introduced. |

## Prior reconciliations and review limits

The three previously recorded PRD reconciliation omissions are present in the current draft: notification/companion semantics at EXPERIENCE lines 42/123/281; population/sample, exclusions and duplicate treatment at lines 96/212/233; and processing/provider/identity distinctions at lines 37/39/47/118/276. They are resolved, not reopened findings.

The reports' earlier general conclusions of complete explicit treatment should be read with SF-1 until its bounded correction is applied and rechecked. Their fixture/phase/source-authority conclusions remain consistent with the reviewed draft. The older companion reconciliation identifies an earlier EXPERIENCE hash; this review records its own snapshot below.

Four imported compositions and nine spine-only surface groups are the accepted level of visual material for this pass. Their lack of rendered implementation is not a scope-fidelity defect. This review does not certify runtime behavior, accessibility conformance, integration eligibility or every detailed feature-card acceptance case. It checks the documented UX against the final PRD/companion and leaves their detailed inventory and gates in force.

Only this review report was written. No source, import, spine, coverage ledger or memlog was edited.

| Reviewed file | SHA-256 |
| --- | --- |
| `DESIGN.md` | `eb25d9df0d52d8c1969c59dc8cabc51ba95b098a2f907b7b07ddf1b05db7941d` |
| `EXPERIENCE.md` | `7a14e4b13e195fb2865128b532aa7293b9a7e2a97d07a82387f7df00142ec84c` |
| `prds/prd-inquello-2026-10-26/prd.md` | `dc2f625a0c47c25046e8bb9713010cf894c15a478a8eefe11da034d32a385dcf` |
| `prds/prd-inquello-2026-10-26/addendum.md` | `fd15c658805c1c506989a1060bdd399e08cb4cc9d21761d5be7ee8237c492cae` |

## Resolution and targeted recheck — 2026-10-26

**SF-1 resolved. Current scope-fidelity verdict: pass, with zero unresolved findings.** The original observation, severity and reviewed snapshot above remain historical evidence; this appendix supersedes their unresolved status. The same Method-departure finding from the parallel rubric review has one shared correction, not two separate fixes.

The authorised correction changed only four existing lines in EXPERIENCE and the FR-20 coverage row:

- EXPERIENCE line 36: S06 now records permitted Task-specific departures separately from maintained Method changes.
- EXPERIENCE line 117: S06 exposes the recorded departure; a denied departure remains unapplied, retaining its draft rationale without treating that rationale as authority to override policy.
- EXPERIENCE line 252: UJ-7 step 2 records what differs, selected Method/version, rationale and affected scope/outputs. Recording a departure neither changes the maintained Method nor grants authority.
- EXPERIENCE line 254: UJ-7 step 4 makes the departure inspectable with the relied-on work in S02/S03 by the practitioner and any applicable reviewer. Maintained-guidance revision/distribution remains a separate action under the actual team policy, with no new mandatory review checkpoint.
- `.working/experience-coverage.md` line 28: FR-20 now maps explicitly to S06 responsibility/state, S02/S03 and the completed UJ-7 treatment.

Targeted rereading against PRD FR-20 (lines 212–215) confirms explicit departure recording and review visibility. Existing Method-change impact remains unchanged at EXPERIENCE lines 204 and 257. The source-policy, no-authority-grant and no-automatic-team-rule distinctions remain intact. Mechanical checks confirm 44 FR rows, 10 NFR rows and eight UJ headings; only FR-38/40/42 carry V2 phase labels. No new component, surface, Method policy, product gate, release cut, mock or production-functionality claim was introduced. No runtime test was needed or claimed for this document correction.

This follow-up edited EXPERIENCE.md, its coverage ledger and this report appendix only. The earlier statement that only the report was written applies to the initial review pass. Other reports, source documents, imports, DESIGN.md and the memlog were not edited by this follow-up.

| Rechecked file | SHA-256 |
| --- | --- |
| `EXPERIENCE.md` | `219a2bfb9a6ed91ae2c66232bbec6bb81197143c37872081c141548cd2a0cc30` |
| `.working/experience-coverage.md` | `88e58aaf52da3b0f22967c2a0a81318c67076cd975204708589eefeb8c6dd7a4` |
