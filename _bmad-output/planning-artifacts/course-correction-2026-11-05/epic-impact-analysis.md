# Epic impact analysis: preserve Epic 1, reconcile the complete internal-audit journey

Date: 2026-11-05. Status: analysis and proposed amendments only. No existing planning, implementation, source, test, status or handoff file changed. No tests, builds, installs, downloads, commits, pushes or pull requests performed.

## Decision summary

Preserve Epic 1 and its current acceptance obligations. Reconcile the remaining roadmap against the later approved PRFAQ: one organisation and one internal-audit team, connected organisational understanding, organisational coverage planning, engagement planning/performance/review/reporting, management-action follow-up, and a supported recurring check. This is not satisfied by the existing workbook engineering checkpoint alone.

The highest-impact mismatch is scheduling: recurrence is currently in Epic 12 behind the complete Epics 7–11 chain, while organisation-level audit coverage planning has no adequate explicit story. Story 6.1 addresses engagement practice, not the organisational audit plan. Story 6.4 is the follow-up anchor but lacks action owners, due dates, progress, missed-date handling, risk-acceptance distinctions and feedback to planning.

Retain all stable story and acceptance IDs and historical traceability. No new ID is allocated here. A genuinely new coverage-planning deliverable needs an owner-approved home or split during epic reconciliation; do not conceal it inside an already-completed Epic 1 story. Do not delete older external-audit obligations: record them outside the latest V1 with their IDs and unmet acceptance preserved.

## Sources and precedence

Read from D:\Projects\inquello:
- AGENTS.md and docs/verification.md.
- _bmad-output/planning-artifacts/epics.md (4,373 lines; all sections obtained).
- _bmad-output/planning-artifacts/implementation-readiness.md.
- _bmad-output/planning-artifacts/sprint-scope-2026-10-27.json.
- _bmad-output/implementation-artifacts/sprint-status.yaml.
- _bmad-output/implementation-artifacts/handoff/HANDOFF-2026-11-05.md. The requested root-relative handoff/HANDOFF-2026-11-05.md did not exist; the actual file was found by filename search.
- _bmad-output/planning-artifacts/prfaq-inquello.md and prfaq-inquello-distillate.md.
- _bmad-output/planning-artifacts/research/2026-11-04-ui-direction-decision.md.
- _bmad-output/planning-artifacts/research/domain-internal-audit-work-lifecycle-and-judgme-2026-11-04/research.md.

PRFAQ Internal FAQ 6 and 9 are the latest approved product-scope/readiness input. Research supplies bounded professional obligations, not product decisions, architecture mandates or build permission. Existing implementation evidence is historical and scoped; this analysis does not revalidate it. Preserve later owner-approved implementation amendments rather than restoring superseded design literally from the older epics file.

## Epic 1 preservation and evidence fence

All existing Stories 1.1–1.30 remain intact. Tracker-only owner-approved Story 1.31 customer onboarding also remains intact. New organisational-knowledge/onboarding requirements are mapped as future additions, not retroactive evidence that 1.31 delivered them. Reconcile its absence from the canonical epic/scope inventory separately without renumbering or resetting state.

The tracker says epic-1 in-progress, 1.14 review, 1.21–1.31 in-progress, with other earlier stories done. The handoff flags 1.14 as stale for owner attention, which is not authority to change it. Its generic statement that 1.21–1.31 are in-progress must not obscure 1.20 or historical status detail. No status is changed here.

The October scope file is a historical 84-story selection (Epics 1–6), not a current delivery count. It contains 1.1–1.30 but not 1.31. Its old all-backlog counts and hash describe its original snapshot. Do not regenerate it over advanced status or claim a new approved total.

### Unresolved acceptance remains unresolved

- Final-head full seeded smoke: 17/18. visual-conversation failed with “Held synthetic turn did not render before Stop”; isolated --visual-only rerun passed. Earlier 18/18 before 338fa75 and a later isolated pass do not constitute a cumulative full-suite pass on the final head.
- Latest handoff reports Linux desktop 2,169 passing and build clean. Older section reports 2,135 and native fixture totals. These are reported historical results, not tests rerun by this analysis and not universal or Windows evidence.
- Windows: guest program resolution over actual WSL, extra executor launch for bounded tools/exec, Electron journeys, 120 ms refresh latency and UI work remain unverified.
- Provider: warm-policy mid-conversation native system-message placement has not been tested against real Anthropic; real-model streaming smoothness remains unverified. Synthetic fixtures do not establish live eligibility or authorize paid calls.
- Owner/UI evidence: the 4 November owner decision explicitly approves “Codex-style collapsed per-turn activity, headed by the neutral end-of-turn line.” This supports the handoff's implemented activity-group heading and resolves the placement choice sufficiently for planning; do not ask the owner to repeat it. The residual issue is document wording consistency with the older 1.15 “at the end of that turn” amendment, not a new product decision. No amendment is edited here. Preserve the no-States-panel direction and truthful review/approval semantics. Visual, timing and accessibility acceptance remain open.
- Other open items: 1.21 OAuth-cancel callback leak; nested-disclosure screen-reader behaviour; unexplained startup SSL-handshake log; pre-existing clippy/TypeScript issues reported in handoff. Establish actual impact and evidence before closing, not merely relabel them.
- Owner/provider/Windows/manual and remaining story-specific gates persist. New PRFAQ completeness cannot close any of them.

### Completion and repository rules to retain verbatim in effect

One PR for Epic 1 only when Epic 1 is genuinely complete, unless the owner explicitly requests earlier. A pushed branch or completed analysis is not completion. Merge with a true merge commit, never squash or rebase. Preserve subtree history. Respect spec checkpoints and actual owner approvals; skip the prohibited build review layers. Never weaken, skip or ignore valid tests, loosen the visual probe to obtain a pass, or use Electron --no-sandbox. Ask before unapproved installs/downloads. Rebuild uncommitted engine binaries before desktop testing/smoke; preserve protocol/runtime alignment and final-head evidence. No command in the handoff was executed for this analysis.

## Disposition of every epic and story group

**Governing release-scope qualifier (owner decision D1):** Every suggestion of later timing, optional initial release placement or a narrower delivery slice for generic capabilities in Epics 7–15 is conditional on the owner's explicit D1 release-scope choice. The focused PRFAQ does not by itself cancel or defer existing generic V1 obligations. Until explicit disposition, those obligations and their acceptance remain current; historical Increment 2 scheduling is not exclusion from V1. Rows below identify candidate sequencing options and dependencies, not approved scope cuts. This qualifier also governs the proposed delivery order and generic-capability examples below.

| Epic / existing IDs | Disposition and precise impact |
| --- | --- |
| 1: 1.1–1.30; tracked 1.31 | Preserve active foundation, all existing tests and gates. 1.9 capability limits, 1.10–1.13 identity/privacy/credentials, 1.18–1.20 authority, 1.21–1.28 routes/execution/truthfulness, 1.29 recovery and 1.30 search support the vision. No lifecycle expansion inside Epic 1. 1.14/1.16 navigation and 1.31 onboarding are extension anchors, not proof of full organisational setup. |
| 2: 2.1–2.18 | Retain all. 2.1–2.4 gain organisational context and provenance examples; 2.5 and 2.10 need faithful execution evidence; 2.6–2.7 and 2.11 distinguish professional foundation, applicable obligations, methodology and departures. 2.8–2.9 retain simple conversational direction/draft continuity. 2.12 must reconcile actual processing coverage, not merely display sample parameters. 2.13–2.15 retain inspectability and fail-to-run checks without making the auditor operate machinery. 2.16–2.18 retain source authority and negative cases; research cannot promote itself into policy. |
| 3: 3.1–3.10 | Retain all artifact contracts and fixtures. 3.1–3.4 support workpapers/report/plan artifacts and same-file continuation; no reduced format-fidelity acceptance. 3.5 alternatives and 3.6 labelled visuals remain safe supporting work. 3.7 previews never approve decisions. 3.8 W1 exactness remains a bounded proof, not population-scale or lifecycle completion. 3.9 adds lifecycle impact links where adopted. 3.10 retains failed/repeated-run cost attribution. |
| 4: 4.1–4.7 | Retain privacy, exact recipient version, live revocation, lineage and human responsibility. Expand 4.5 organisational understanding beyond prior findings to eligible strategy/objectives, risk assessments, actions and plans; none is automatically shared merely because it is useful context. 4.6 adds lifecycle knowledge/revocation scenarios without deleting existing two-user/two-company negative isolation. 4.7 preserves actual delegation, not a mandatory personal CAE button or fixed hierarchy. |
| 5: 5.1–5.14 | Retain every review/revision/export contract. 5.1–5.4 distinguish potential findings, final findings and private review notes. 5.2 execution checks do not substitute for method suitability judgment. 5.5–5.9 retain immutable basis, precise changes, broader recheck under uncertainty and human closure. 5.10 technical audit remains internal-audit optional depth, not external-audit scope. 5.11 export promises need selected usable formats/link preservation before reliance. 5.12 continuity must span the three cycles. 5.13 human conclusions/sign-off/issuance remain distinct from generated/exported/delivered. 5.14 stays engineering checkpoint, not whole V1. |
| 6: 6.1–6.5 | Major refinement. 6.1 anchors internal-audit engagement planning/work programme and contextual advisory variation; its external-audit-only AC 6.1.1 becomes an explicitly retained future obligation rather than a latest-V1 requirement. 6.2 retains evidence request/receipt and communication authority. 6.3 retains W3 fixture writeback; not a mandatory production integration. 6.4 expands action follow-up and feedback to planning. 6.5 must validate the full latest-V1 journey, including organisational plan and recurring check, in addition to all applicable retained fixtures. Organisational coverage planning needs a new approved story boundary or explicit split, not renumbering now. |
| 7: 7.1–7.5 | Retain local browser, site tools, computer use, demonstration and source-trust contracts. The domain research does not add a requirement for every route, but existing V1 obligations remain. If the owner selects a narrower D1 release, keep supported-procedure routes in that release and retain any explicitly deferred routes as unmet obligations. Never make all of Epic 7 a prerequisite for recurrence. |
| 8: 8.1–8.3 | Retain remote execution, worktrees and hosted outputs as later route capabilities unless selected work needs them. Shared identity does not prove remote execution. Publication authority/readback still apply. No implicit hosted infrastructure or cost commitment. |
| 9: 9.1–9.14 | Retain 9.1 host enforcement, 9.2–9.10 independent provider routes, 9.11 specialist access, 9.12 prediction, 9.13 programmatic composition, 9.14 scans. Existing generic V1 route obligations remain unless explicitly changed through D1; the focused PRFAQ alone does not defer them. Record individual routing/scheduling decisions and unmet ACs. A selected pilot-required connector stays in V1. Preserve existing Claude route choice, conditional subscription restrictions and no silent substitution. |
| 10: 10.1–10.5 | Retain bounded delegation, branching, durable continuity, optional activity recall and delegated access/cost controls. 10.3 durable continuation/recovery is relevant to long-running supported work and may need earlier semantic sequencing. 10.4 ambient recall is not needed merely to deliver organisational knowledge. If 10.1 is enabled, 10.5 safety accompanies it, not deferred behind unrelated convenience. No universal requirement for multiple agents. |
| 11: 11.1–11.8 | Retain CLI, application-adjacent, mobile, physical controls, dictation, notifications, imports and snapshots as separately scheduled obligations. 11.7 practical permitted history intake may need an earlier bounded slice for onboarding; automatic all-history migration remains out. Notifications necessary for recurrence must not depend on optional companion/physical-control UI. CLI and all secondary clients are not semantic recurrence prerequisites. |
| 12: 12.1–12.8 | Bring a bounded supported recurring-check slice into the approved V1 end-to-end sequence. 12.1 structured outcomes, 12.2 acting identity, 12.3 credential revocation, 12.4 orphan/reassignment safety, 12.5 mandate, 12.6 outcomes/deduplication and 12.8 negative tests are substantive safety dependencies. 12.7 service-triggered breadth is not necessarily required for one scheduled check. Do not imply unrestricted automation, supplied scheduler or permission to create one. |
| 13: 13.1–13.2 | Retain. Held-data controls in 13.1 travel with whichever newly enabled category needs them, including recurring work, rather than waiting until every earlier epic ships. 13.2 distinguishes activity/usage from accepted work and supports cost measurement; large-team hierarchy, capacity/resource scheduling remain outside latest V1. Do not remove small-team admin or privacy controls. |
| 14: 14.1 | Retain destination-specific delivery as conditional/later unless pilot requires it. The full internal-audit journey does not automatically require a particular external record-system adapter. If chosen, all existing identity, stale version, deduplication and readback tests remain required before real data. |
| 15: 15.1–15.4 | Retain full enabled-route integration. Scope 15.1/15.2 checks to every enabled surface with truthful states; keep 15.3 complete deferral/capability accounting. 15.4 must not make future convenience routes prerequisites for the current internal-audit V1 acceptance nor declare them delivered. Add three-cycle/recurrence coverage to current-V1 validation and preserve wider roadmap acceptance separately. |
| 16: 16.1–16.4 | Preserve explicit V2 native record-mode, lifecycle/holds and migration obligations and OQ-11. Check the latest journey against the existing working-file/external-authority contract: it neither mandates full native replacement nor permits dropping essential linked decisions/actions. If this contract satisfies the journey, retain it without asking for reconfirmation. If selected V1 design truly needs a subset, obtain explicit architecture/scope decision with old-to-new traceability; do not silently move whole native records into V1. Automatic full migration is excluded. |
| 17: 17.1 | Retain V2 hosted-browser/sandbox decision revisit, not implementation commitment. No evidence from PRFAQ or GIAS changes this. |

## Exact proposed before/after amendments

These are proposed text changes for a subsequent approved reconciliation. Quoted “before” fragments identify the actual current target. “After” is proposed language, not an assertion that a product decision or implementation passed. Additions do not replace valid existing acceptance.

### A. Product audience and scope

Before, overview: “Inquello is a public-Codex-fork agentic workbench for internal audit, external audit, advisory and IT/IS audit teams”.

After: “Inquello's approved V1 serves one organisation and one internal-audit team across organisational coverage planning, engagements, review/reporting and management-action follow-up, including a supported recurring check. Internal-audit assurance, contextual advisory work and relevant technical audit use configurable methods. External-audit-specific standards/workflows and audit-firm multi-client switching are outside this V1; their existing IDs and unmet acceptance remain in the future roadmap.”

Before, phase rule: “The full V1 target is CAP-1 to CAP-22 (41 FRs) plus the OQ-14 identity and authorisation obligation”.

After: “The legacy CAP/FR inventory and acceptance remain traceable. The 5 November approved V1 journey and exclusions govern delivery scope; mapping each retained capability to current V1, later obligation or unresolved scope is required before a revised count is published. No current capability is represented as delivered by reclassification.”

### B. Organisational coverage planning: explicit gap, no invented ID

Before: Story 6.1 begins “I want to plan and scope an Engagement”; there is no equivalent organisational audit-plan story.

After, proposed unnumbered requirement to allocate during reconciliation: “Using source-backed strategy, objectives, risks, prior findings, outstanding actions and other permitted assurance information, the manager can build, review and revise a risk-based organisational audit plan. Retain the assessment basis, priorities, coverage gaps and omitted significant risks, resource/access constraints and rationale for change. Distinguish proposal, review and applicable plan approval. Preserve the relevant board/management input and approval evidence without requiring board guest accounts or a personal CAE click. The plan and significant changes follow actual governance. The at-least-annual risk assessment and dynamic plan are professional outcomes; an audit-universe file, heat map or fixed six-stage interface is not universally mandatory.”

Evidence: PRFAQ approved V1; research section 2 / GIAS 9.4–9.5. Resource constraints inform plan judgment; this does not add excluded large-team capacity-management software. Coordination/reliance is documented when applicable, with internal audit retaining responsibility.

### C. Strengthen engagement planning while retaining deferred external-audit acceptance

Before, 6.1 user story includes “assertions and materiality for external audit”; AC 6.1.1 begins “Given an external-audit Engagement”.

After, proposed V1 sibling acceptance (no ID yet): “Given an internal-audit engagement and applicable methodology, when work is designed or revised, the reviewable work programme links relevant objectives, scope, risks including fraud, criteria, procedures/methods/tools, expected evidence and assigned auditors. Missing information and scope/access limitations remain visible. Required approval precedes implementation and changes receive prompt approval under actual authority. Agent preparation alone is not authorised work. Advisory differences are represented only where applicable standards and agreed engagement context permit.”

Keep AC 6.1.1 verbatim in future-scope traceability; do not claim the internal-audit criterion tests its external-audit semantics. Preserve 6.1.2 facts/assumptions/recommendations and management-responsibility distinctions; preserve 6.1.3 proposed-plan labelling. No mandatory RCM, universal sample count or universal controls/deficiency object.

### D. Faithful execution and actual coverage

Before, AC 2.12.1: “population count, excluded items with reasons, duplicate treatment, the chosen Method's sampling parameters if sample-based, and examined Coverage as a count and share”.

After, append: “For each supported procedure, reconcile the defined input population to completed, excluded, failed and unfinished work under explicitly defined counting semantics. Preserve source versions, parameters, record/batch identity and evidence sufficient to explain processing and limits. A successful command or spot check does not prove full processing. Interruption/resumption must demonstrate no silent omissions or repeated effects; uncertain outcomes remain unresolved until reconciled.”

Before, AC 2.10.1 ends “produces the declared outputs with verification evidence”.

After, append: “The selected verification contract distinguishes evidence that the procedure executed faithfully from the human judgment that the procedure and interpretation are appropriate. Failure, incomplete coverage and uncertainty remain visible without requiring the auditor to repeat every execution step.”

Before, 5.14 title: “Demonstrate the workbook-to-review-to-export engineering checkpoint”.

After, retain title and all ACs, append: “This bounded checkpoint does not establish the full three-cycle V1, faithful execution at untested scale, real provider behaviour, real-data eligibility or accepted practitioner use. Additional supported-task proofs and the end-to-end journey are required.”

Specific datasets, scale, counting convention, recovery design and numeric thresholds remain selection decisions, not invented approved test criteria.

### E. Source-backed organisational knowledge

Before, 4.5.2 asks “about relevant previous findings and status”.

After, append: “The same provenance/current-access rules apply to eligible organisational strategy, objectives, policies, risk assessments, plans and action history used in coverage planning or engagement work. Expose source period, version, uncertainty, contradictions and changes. Recalled context is not automatically current evidence or a new finding. Missing organisational knowledge is visible, not filled with unsupported assumptions.”

Keep 4.1–4.6 sharing/admission/revocation invariants unchanged. Organisational setup does not grant administrators access to private auditor/reviewer work.

### F. Findings, conclusions and reporting

Before, 5.3.3: “significance follows the Engagement's scheme, not developer severity labels”.

After, append: “Distinguish potential differences from supported findings. Evaluate relevant condition/criteria, evidence sufficiency, significance and limitations under the Method. Seek cause when possible without treating a known root cause or a universal five-Cs template as unconditional. Conclusions address engagement objectives and aggregate significance, with assurance-specific evaluation where applicable. Final communication content, recipients, human approval and issuance follow actual requirements, not a universal report layout or automatic board distribution.”

Before, 5.13.2: “Given Professional Approval recorded in the external authority”.

After: retain AC 5.13.2 exactly: “Given Professional Approval recorded in the external authority / When it is confirmed / Then the Task links the authority, person, scope and version; before confirmation it shows pending.” Propose only an additive lifecycle requirement: “Link the relevant lifecycle deliverables and supporting evidence to that approval under the existing external-authority contract; agent completion, generated reports and local review events do not create formal approval.”

Only a material authority change requires a new architecture decision. If supported files and the existing external authoritative process satisfy the journey, retain that contract without re-asking the owner. This is not permission to implement a different record model.

### G. Follow-up and feedback loop

Before, 6.4: “management responses, agreed actions, completion evidence and retest results recorded against Findings”.

After, expand: “Management responses and agreed actions retain the responsible owner, due date, progress, evidence, relevant finding/objective and change history. Risk-based follow-up confirms implementation using the organisation's methodology. Missed dates retain explanation, discussion and next action. Distinguish reported completion, supported implementation confirmation, effectiveness assessment where required, risk acceptance and authorised closure. Escalation of risk beyond appetite/tolerance is distinct from confirming that an action was implemented. Unresolved items and relevant results inform later coverage planning.”

Retain AC 6.4.1 unchanged: agent retest does not automatically close a Finding. Retain AC 6.4.2: corrected artifact is not proof of an effective operating control. Do not invent a universal reminder cadence, closed-state taxonomy or mandatory autonomous stakeholder outreach.

### H. Bring bounded recurrence into the actual V1 sequence

Before, Epic 12: “Increment 2 / V1”; 12.1 prerequisites: “completed Epic 11 delivery and earlier required contracts; no later epic is required”.

After, proposed sequencing statement: “A selected bounded recurring-check path belongs to the approved end-to-end V1. Its prerequisites are the actual source/Method/execution, current identity/permission, held-data, recovery, outcome and mandate controls it uses. Secondary clients, physical controls, ambient recall and all provider/browser routes are not blanket prerequisites. Retain broader event/service-triggered capabilities as separately scheduled unmet obligations.”

Before, 12.8 prerequisites: “12.7”.

After, proposed scoped wording: “The enabled recurring route must pass its negative authority, missing-input, duplicate-effect, revocation, uncertain-outcome and recovery tests before real-data use. Service-trigger-specific tests remain mandatory when 12.7 is enabled; their absence cannot be presented as event-route acceptance.”

Retain all ACs 12.1–12.8. A revised dependency graph must state which obligations are in the initial recurring slice and which are still unmet, without falsely completing the whole story or allocating new IDs now. Do not weaken service identity, token revocation, orphaned-job or retention controls to accelerate scheduling.

### I. Portability and record authority

Before, AC 5.11.1 names “the external Record Authority” and Story 16 carries native records as V2.

After, proposed mapping note: “Map plans, work programmes, evidence, workpapers, findings, approvals and actions to the adopted V1 external-authority process; distinguish working copies from formal authority. Identify any genuinely unresolved destination-specific detail without reopening the adopted external-V1/native-V2 boundary. Demonstrate usable exported audit work and supporting context in selected formats, with linked identities/review attribution and explicit losses. No local path masquerades as transferred evidence. Neither automatic full historical migration nor a native replacement system is implied.”

Keep existing export/reimport, exact-version, permissions and loss-reporting tests. The adopted V1 external-authority / V2 native-record boundary remains in force and does not require reconfirmation. Seek an architecture decision only if a demonstrated requirement requires a material change; preserve existing authority behaviour unless such a change is explicitly approved. Do not count unresolved portability formats as complete.

### J. Onboarding and practical history

Before: tracker 1.31 customer-onboarding exists, while the 139-story canonical epic file and 84-story scope do not include it.

After, proposed reconciliation note only: “Preserve the implemented/approved scope and current evidence of 1.31. Map additional organisation/context/methodology readiness to later explicit work: guided screens/settings and conversational assistance; available strategy/objectives, structure/processes/policies, risk picture/audit universe and useful prior work; distinguish required first-engagement inputs from deferrable setup and missing sources. Do not require every source before useful work.”

Story 11.7 is a bounded import/history anchor. Preserve credential reauthorisation, import/skipped/attention reporting and unchanged authority. Broader historical migration remains excluded.

### K. Validation and readiness

Before, implementation-readiness: “PASS for scoped synthetic-development implementability”; full roadmap 139, increment 84.

After, retain historical assessment, add: “This PASS covers the recorded 27 October contracts only. It does not certify the 5 November course correction, current implementation, product validation or real engagement use. Reconcile new scope and decisions, then reassess implementability for the resulting bounded delivery plan. Preserve current implementation statuses and separately label passed, failed, blocked and not-run evidence.”

Before, 6.5.5: retained Word/PowerPoint/CSV/research/practice workflows remain eligible.

After, append: “Validate the approved organisational-plan → engagement work programme → evidence/procedures/workpapers → manager review/report → action follow-up → later planning journey, including the supported recurring check and its failure path. Existing applicable fixtures and format/authority tests are additive obligations, not replaced by this journey. Explicitly retain excluded external-audit and later-route acceptance as unmet future work.”

## Proposed dependency and delivery order

1. Complete the current Epic 1 contract and its actual remaining gates. Do not expand it to absorb all lifecycle features or use replanning to close failures.
2. Reconcile PRD/SPEC terminology, approved V1 boundaries, authority model and coverage-planning story home. Record exact affected CAP/FR/UX/story/AC mappings before issuing a new count. Resolve only decisions needed to implement the selected slices; no exhaustive-research prerequisite.
3. Build supported context/Methods/execution and artifact work from Epics 2–3. Add explicit coverage/recovery verification in those contracts, rather than postponing all dependable-execution evidence to Epic 15.
4. Enable organisational/team knowledge and manager review using Epics 4–5 with real sharing/revocation gates. Basic private planning can use private permitted sources earlier; cross-auditor knowledge must wait for the sharing controls it needs.
5. Deliver the organisational planning and engagement work-design slice using the refined Epic 6 boundary, with the necessary Method and approval contracts. Work design must be available before its substantive procedures execute in the user journey; numerical story order need not dictate a UI waterfall.
6. Deliver report/action follow-up and a bounded recurring check. Bring the required 12.1–12.6/12.8 safety contracts, 13.1 category controls and 10.3 continuation where actually used into this sequence. A full 12.7 connected-service entry path is optional unless the selected recurring route needs it.
7. Exercise the complete three-cycle journey and all enabled-route negative cases, preserving 5.14/6.5 fixtures. Wider surfaces, provider breadth, marketplace, hosted capabilities and native records retain their separately recorded obligations.
8. Real engagement use only after the PRFAQ readiness gates and applicable source/provider/service/data authorisations are established. After learning, broaden workflows and integrations; do not defer the already-approved end-to-end V1 itself.

This is a proposed semantic order, not an approved dependency rewrite. Remove blanket predecessor-epic chains only after confirming each retained acceptance dependency. If splitting is needed, preserve old-to-new traceability and obtain approval before new IDs or status migration.

## Verification additions to specify before implementation

- Population/execution: known-result representative supported procedures, explicit inclusion/exclusion/duplicate definitions, completed/failed/unfinished reconciliation, corrupted/partial inputs, interruption at consequential boundaries, restart without omission or repeated effects. Scale and thresholds selected with evidence, not implied by small W1.
- Knowledge: changed strategy/policy/risk/action inputs invalidate or qualify dependent plans/conclusions; stale recall does not become current evidence. Private/admin separation, current grants, revoked derived context, cross-company isolation remain tested even though V1 serves one organisation.
- Professional work: trace objectives → risk/criteria → authorised programme → evidence/procedure results → evaluated findings → supported conclusion/report → action/retest; approvals reflect actual authority and timing. Include advisory exceptions, insufficient evidence, disputed findings, revised scope and overdue action/risk-acceptance distinctions.
- Recurrence: define supported trigger, timezone/cadence, input freshness, scope, Method revision, identity, costs/limits, destination, escalation and cancellation. Verify missing/not-received/not-run/incomplete/failed/no-exceptions distinctions, duplicate triggers, revoked/departed identity, lost responses and resumed work. These are specification questions, not a chosen scheduler.
- Experience: actual Windows desktop journeys, keyboard/focus/scrolling, usable progress/review, accessible nested disclosure, source inspection and permission handling. A screenshot or renderer mock is not an end-to-end workflow.
- Portability: recipient machine opens declared export contents and links with permitted evidence; explicit loss manifest, version identity, review attribution and unchanged permissions. Test reimport where promised; export is not delivery or formal acceptance.
- Evidence: tie commands, runtime/route, commit/artifact, expected/actual outcomes and limitations to final tested head. Keep failed, blocked and not-run distinct; recheck invalidated evidence after edits.
- Outcome validation: baseline and actual total effort including preparation, review, correction, retries and delivery; quality/error detection, significant-risk coverage, comfortable direction/review and cost. No numeric improvement, scale or commercial claim is approved.

## Decisions and gates requiring explicit resolution

Product owner (Israel, documented current decision owner): approve reconciled scope/dispositions, coverage-planning home, bounded supported procedures/connections/recurrence, first-engagement readiness and changed delivery order. Do not re-ask already-approved full V1 vision.

Audit/methodology authority (actual organisation/delegation to establish): applicable standards/topical/jurisdiction rules, work-program and plan approval process, finding significance, follow-up and risk-acceptance/escalation arrangements. Research verifies bounded GIAS propositions, not every imported claim or an organisation's compliance.

Architecture/data-policy owners (specific assignees still to establish): demonstrate how the existing authority/working-record boundaries support linked artifacts/actions/decisions; seek a new decision only for a material change or unresolved requirement. Select portable export formats, source lifecycle/current-access details and recurring identity/scheduler supply/recovery contracts. OQ-16B production issuer/operator/region/retention/deletion/recovery remains open before real shared data; OQ-11 native lifecycle is not silently closed.

Implementation owner: close current Epic 1 defects and verify agreed acceptance on final head, Windows and actual provider routes under applicable authorisation. No report of synthetic results satisfies these gates.

Pilot organisation/data owner: identify real engagement/team/sources and explicitly authorise data and use before real engagement work. No outreach or customer-data permission comes from PRFAQ/research.

Commercial decision owner: establish total costs and commercial arrangement before purchase; pricing model, margin, buyer and willingness to pay remain unvalidated. Do not invent launch dates, staffing/budget or quantified savings.

## Acceptance preservation ledger rule

For every affected ID, record one of: retained unchanged; retained plus proposed additional acceptance; moved to later scope with original acceptance unmet; split proposed pending approval; architecture decision pending. Never remove an obligation by renaming its story, conflate professional standards with fixed templates, or claim an old proof covers a materially new outcome. Preserve all 372 historical acceptance IDs plus recorded conformance additions and original story traceability; verify counts during actual reconciliation rather than minting a new total here.

No operational gate, story status, implementation permission or launch readiness changed as a result of this document.


## Concrete generic-capability examples and evidence of delivery state

These examples identify the wider legacy inventory for a scope decision; they are not a recommendation to remove useful capabilities indiscriminately. Current authoring/implementation cannot be inferred from filenames or their absence.

| Capability | Existing story IDs and source | Defensible delivery-state statement |
| --- | --- | --- |
| Dictation and optional companion | 11.5 Dictate instructions with a correctable transcript; 11.6 Notify attention needs and offer an optional companion, epics.md | Both are in sprint-scope excluded_future_story_ids and absent from the scoped tracker. Historically planned/deferred Increment 2/V1; current implementation unverified. Notifications needed for the selected recurring check remain necessary even if companion breadth is deferred. |
| Secondary/application-adjacent/mobile/physical surfaces | 11.1 CLI, 11.2 open-workbook/document assistance, 11.3 mobile/remote client, 11.4 physical controls | Explicitly excluded from the 84-story tracked selection. Planned/deferred; not established built or absent. No dedicated web/IDE story is inferred: 11.2 is specifically application-adjacent, and 11.3 mobile/remote. |
| Provider route breadth | 9.2 subscription; 9.3 OpenAI API; 9.4 Azure Foundry; 9.5 Azure OpenAI; 9.6 Bedrock; 9.7 Vertex; 9.8 gateway; 9.9 local; 9.10 Claude extensions | All are in excluded_future_story_ids. Existing initial-route delivery is separate: tracker 1.22 and 1.25 in-progress; handoff documents authored Claude/native work and Linux fixture evidence but untested real Anthropic warm-policy behaviour and open Windows/owner gates. Do not equate route configuration authored with all route acceptance. |
| Programmatic/SDK work and events | 12.1 noninteractive structured execution; 12.5 schedules/events; 12.7 connected-service Tasks/reviews | Excluded future IDs; planned/deferred, implementation unverified. Latest approved V1 explicitly requires a bounded recurring check, not every SDK/event integration. |
| Activity recall | 10.4 optional application/site activity recall | Excluded future ID; planned/deferred, host eligibility and capture scope explicitly gated. Organisational knowledge does not require ambient activity capture. |
| Forks/branches and alternatives | 10.2 side chats/forks/references; 8.2 Git worktrees; 3.5 isolated artifact alternatives | 10.2 and 8.2 excluded future IDs, implementation unverified. 3.5 is explicitly backlog in sprint-status. These are different scopes, not evidence that any one delivers all alternatives. |
| Extensible/specialist breadth | 9.1 client tools, 9.13 Code Mode, 9.14 saved scans/backlog; 7.1–7.5 browser/computer/demonstration | All excluded future IDs; planned/deferred with eligibility/supply gates. 2.4 practical connector evidence and 2.15 hooks are explicitly backlog in scoped tracker. Pilot-required supported connections remain V1; a broad marketplace/every connector does not. |

Stable IDs and original acceptance must survive any agreed scheduling change. Historical “Increment 2 / V1” is the source's earlier roadmap label, not a current approved exclusion from V1 or proof of implementation. Keep negative cross-organisation/unauthorised-access tests even when external-audit product scenarios move outside V1: product applicability and security invariants are distinct.
