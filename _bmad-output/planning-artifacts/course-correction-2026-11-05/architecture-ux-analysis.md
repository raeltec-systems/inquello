# Architecture and UX course-correction analysis
Date: 5 November 2026
Status: proposal only; no changes to existing planning documents, code, deployment or record schemas.

## Executive finding
The approved V1 is a connected internal-audit journey across coverage planning, engagement planning/performance/review/reporting and management-action follow-up, including a supported recurring check. The existing hybrid architecture already provides useful enforcement boundaries for this journey. Its central shortfall is missing explicit lifecycle coverage and acceptance mapping, not evidence that a replacement database, native V1 audit-record platform or universal workflow engine is required.

The current UX gives strong detail for private work, artifact editing, agent-assisted review, sharing and automation. UJ-2 begins with engagement scope/evidence and concludes with review/export; UJ-8 contains response/retest and closure boundaries. Neither presently specifies the whole organisational context → risk-based audit plan → engagement → follow-up → later-plan loop. Existing account onboarding is security/membership onboarding, not complete audit-context readiness.

Three high-impact corrections:
1. Make the approved three-cycle V1 explicit and traceable in architecture, UX and SPEC. A workbook engineering checkpoint is necessary evidence, not the entire product.
2. Preserve existing authority/privacy controls while specifying evidence continuity, faithful execution, incomplete coverage and recovery across those cycles.
3. Reconcile stale source precedence. Current onboarding selects Auth0 and eligible self-service workspace creation; older SC-1 still says operator-only bootstrap and unselected identity supplier.

## Evidence and interpretation
Read in full: repository AGENTS.md; architecture ARCHITECTURE-SPINE.md; UX EXPERIENCE.md and DESIGN.md; prfaq-inquello.md and prfaq-inquello-distillate.md; completed lifecycle research/research.md; spec-inquello/SPEC.md, scope-and-gates.md and collaboration-and-memory.md; spec-customer-onboarding/SPEC.md, brownfield-and-acceptance.md and service-desktop-handoff.md. Relevant current architecture shared-service and architecture/UX confirmed-decision companions were also read.
All paths below are relative to _bmad-output unless otherwise stated. No implementation was inspected or tested; implementation-status statements are attributed to the read documents, not independently verified.

Source precedence for this proposal:
- Latest approved product scope and sequencing: planning-artifacts/prfaq-inquello.md, Internal FAQ 6 and 9. The distillate indexes these; the full approved text governs.
- Existing adopted architectural/privacy/record-phase choices remain unless the latest decision actually changes them.
- Completed research supplies bounded professional outcomes and contextual qualifications, not product authorisation or a schema mandate.
- Current onboarding SPEC and dated handoff continuations refine earlier architecture bootstrap wording. Historical reports remain historical.
- Broad historical scope inventories require explicit mapping to current V1, deferred target, superseded requirement or unresolved detail. Do not delete IDs or treat mentioning every old ID as proof of current scope.

## Preserved boundaries
- Public Codex foundation, Electron/React/TypeScript, shared Rust audit domain, separate local working SQLite and shared Inquello service remain.
- Local execution/files and shared identity/membership/grants/coordination remain separate. Provider authentication is not organisation authority; local tools do not imply offline inference.
- Tasks, drafts and conversations are creator-private, including inside Engagements. Administrators cannot read private work by virtue of their role.
- Sharing is deliberate and granular. Recipient-ready immutable artifact/basis and permitted context are required; sender-local paths are insufficient. No blanket source upload or automatic conversation disclosure.
- Shared-memory admission remains issued or explicitly team-shared eligible work, subject to current grants/lineage. A private planning draft does not become organisational knowledge merely because it concerns the organisation.
- Current-access checks, active-run revocation, derivative protection, receipt reconciliation, immutable reviewed bases and separate execution/review/approval/delivery states remain.
- V1 working artifacts and external formal authority remain the default proposal. Native authoritative lifecycle/records/migration stay V2. Supporting the full journey does not itself approve native V1 records.
- The chosen visual tokens/components, accessibility floor and imported-source provenance remain. No new palette, design system, implementation stack, mocks or component API is proposed.

## Architecture section-by-section proposals
Each “before” describes the current contract; “after” is proposed wording or bounded addition, not an applied edit.

### A1. Design Paradigm; Capability → Architecture Map; Dependency and delivery evidence
Before: “full target retains 41 V1 FRs and three V2 FRs”; all 22 groups/eight source journeys; workbook-through-review/export engineering path.
After: “Current V1 serves one organisation and one internal-audit team through coverage planning, engagement planning/performance/review/reporting, management-action follow-up and a supported recurring check. Existing capability IDs remain traceable; their current-V1 applicability follows the 5 November PRFAQ. The workbook checkpoint verifies an engineering path, not complete lifecycle acceptance.”
Add a lifecycle-to-capability map rather than new mandatory objects:
- Organisational context and coverage planning: P01/P05/P10/P14/P18/P20/P22.
- Engagement work design: P05/P09/P10/P18/P20/P22.
- Performance and review: P04–P07/P09/P13/P17/P18/P22.
- Reporting/external handoff: P07/P09/P18/P19/P20/P21/P22.
- Action follow-up and recurring check: P04/P12/P14/P17/P18/P20/P21/P22.
Classification: compatible implementation of approved scope. Exact FR/story reclassification belongs to PRD/epic reconciliation; blanket old breadth must not override explicit new exclusions.

### A2. AD-6 Stable work linkage; AD-9 Artifact identity; Consistency Conventions
Before: stable Workspace/Engagement/Task/Source/Artifact identity, common reviewed basis, relevant changes stale applicability; no universal state machine.
After addition: “Across supported lifecycle work, preserve inspectable references from organisational strategies/objectives and risk context to planned coverage, engagement objectives/scope/criteria/programme, performed procedures and evidence, findings/conclusions/report, agreed actions and follow-up. Identify source version, effective period, gaps, uncertainty and known change impact. Unknown impact triggers further review rather than assuming unchanged validity.”
These are semantic/provenance obligations. Representing them in supported artifacts, manifests or existing references is possible; do not infer a graph database, new canonical entity taxonomy or all-at-once schema.
Classification: compatible clarification. Concrete representation and authority per artifact are design decisions before reliance.

### A3. AD-10 Method departures; AD-6/17 professional authority
Before: Method/version/departures separate from shared guidance; no universal workflow engine; human review tied to scope/version.
After addition: “Distinguish applicable professional requirements, topical/external obligations, organisation methodology and engagement context. Preserve applicable approval timing and authorised delegation without treating every obligation as a mandatory personal CAE click or a universal software lock.”
Research examples to encode in requirements, not hard-coded architecture:
- Work programme approval before implementation and prompt approval of changes.
- Risk-based audit plan and significant changes have applicable board approval; manager review in-product does not replace governance approval.
- Evidence adequacy, findings significance and conclusions retain professional judgment.
- Assurance/advisory qualifications, optional RCM/five-Cs formats and defensible sampling limits remain explicit.
Classification: compatible clarification. Select actual method/roles/applicability and enforceable transitions before the dependent workflow. Board/external involvement can use authorised existing tools; this does not introduce V1 guest access.

### A4. AD-9/12/14; Structural Seed and Operating Envelope; acceptance references
Before: inspectable actual coverage/exclusions/duplicates, uncertain recovery, immutable mandates, missing/failed outcomes and scheduler supply gate.
After addition: “For each selected supported procedure, establish evidence that actual processing matches the agreed population/scope, accounts for exclusions, completed, failed and unfinished work, and supports safe interruption recovery without silent omissions or duplicate effects. A completed model turn, output narrative or human spot check alone is not proof of faithful full-population execution.”
Keep a simple auditor-facing status with inspectable processing evidence beneath it. Do not select chunk/checkpoint architecture, benchmark, population size, numerical threshold or exactly-once guarantee in this proposal.
Classification: outcome clarification supported by PRFAQ Internal FAQ 1/9; detailed proof design is still a proposal/decision before real use. Basic dependable recovery is a real-use blocker, even though later operating SLA targets remain open.

### A5. AD-12 Automation; scheduler/event supply row
Before: schedules/events and continuous work are already V1, production route unproven; no automatic cloud continuation.
After addition: “V1 acceptance includes a supported recurring internal-audit check with defined data/source availability, procedure/Method, authorised identity, recurrence limits, outputs, escalation and visible no-input/not-run/partial/failed/complete outcomes. Its results feed applicable follow-up and future planning under human authority.”
An enabled recurring check must obey current revocation, mandate revision and effect reconciliation. A sleeping/offline desktop is not a completed check.
Classification: existing scope made concrete. Specific procedure, trigger cadence, execution host, source connection and limits remain owner/pilot choices before reliance, not grounds to defer recurrence beyond V1.

### A6. AD-13 Phase-specific record authority; P19/P20/P21; OQ-11
Before: V1 useful working/review records and verified external formal authority; native lifecycle FR-38/40/42 V2.
After addition: “The approved end-to-end V1 may prepare, track, review and connect plans, workpapers, findings, reports and action follow-up using working artifacts/coordination and designated external authority. For every supported deliverable identify its working location, formal acceptance authority, transfer/export path and preserved links. Neither a local record nor a shared coordination event silently becomes an authoritative audit record.”
Classification: compatible reconciliation recommended now. Genuine owner choice only if retaining external authority cannot fulfil a selected pilot need or owner wants native authority earlier. No schema redesign is authorised. Export format and link-preservation contract are unresolved and must be decided before dependence.

### A7. AD-15/16/20 and SC-3/4: context and knowledge
Before: explicit artifact sharing, constrained admission, reviewed basis and lineage.
After clarification: Organisational context supplied during setup is subject to the same declared source/audience/use/retention rules. Broad relevance is not broad permission. Accepted plan/report/action history can inform later work only within eligible admission and current access. Historical finding/action status is a lead, not proof of a current deficiency or implemented remediation.
Classification: compatible; no broader grant or new knowledge architecture.

### A8. AD-18; SC-1 bootstrap paragraph; Deferred OQ-14/OQ-16B; structural seed
Before: unselected identity issuer/vendor and operator-only workspace bootstrap; seed path still fork/; several historical claims say no executable product exists.
After: cross-reference current customer-onboarding contract for Auth0 hosted OIDC selection, eligible verified-user self-service creation, exact issuer/subject and fresh verified-email proof, explicit email invitation acceptance, receipt/revision recovery and independent content authority. Preserve operator path and historical scope, with real-tenant signup/delivery qualification separately gated. Describe issuer selection as decided while deployment/data eligibility stays open.
Mark fork/ as historical seed; current AGENTS.md says engine/ since 28 October. Replace timeless “no executable product exists” claims with dated historical evidence, not fresh verification.
Classification: documentary reconciliation of already recorded decisions, not a new supplier selection, install or code change. Read current build evidence before making acceptance claims.

## UX section-by-section proposals

### U1. EXPERIENCE Foundation; IA; Open Items and Validation Boundaries
Before: full researched Codex-derived V1, broad clients/routes, 13 surfaces/eight journeys; OQ-16 described wholesale open.
After: foreground the approved one-organisation internal-audit lifecycle and explicit exclusions while preserving reusable capabilities and old IDs in a traceability ledger. External-audit-specific workflows/client switching and broad marketplace are outside current V1; technical investigation remains useful within internal audit. Correct OQ-16A adopted/OQ-16B open and onboarding supplier status without claiming deployment.
Do not silently delete secondary surfaces or infer a new narrow client policy not decided by the owner. Identify actual supported pilot surfaces/procedures/connections before reliance.
Classification: approved-scope reconciliation, with exact support matrix still to specify.

### U2. IA S01/S05/S06/S07/S08/S09; Supporting paths
Before: S09 owns identity/team/policy; S06 methods; S08 history; no complete guided audit-context readiness path. Customer-onboarding SPEC covers account/create/join/team/recovery/private work.
After: add a proposed supporting path “Prepare organisation and first engagement” using existing surfaces:
1. Establish own identity and permitted workspace/team roles with existing secure onboarding.
2. Configure applicable methodology/review responsibilities and permitted connections through settings, with conversational assistance where useful.
3. Bring available strategy/objectives, structure/processes/policies, audit universe/risk picture and useful past work. Label supplied, missing, stale, unverified and inaccessible context.
4. Show what is ready for the intended first engagement, what blocks that work and what may be added later; route a missing setting/connection to its actual control.
5. Start the first scoped engagement in the same conversational workbench; model/options do not confer permissions.
Keep PRFAQ's approved sentence: “If something needs a connection or a setting, Inquello points you there.”
Classification: approved experience direction. Required fields, readiness criteria, sequence and deferrable setup are genuine product choices; do not treat “all sources loaded” as readiness or create an exhaustive mandatory wizard. Extend planning explicitly rather than rewriting completed historical onboarding stories.

### U3. Key Flows UJ-2; S01/S02/S03/S05/S08/S10
Before: UJ-2 starts with Method/scope/evidence in private Task and covers strong private review loop through export.
After: retain that loop unchanged and add an explicit end-to-end internal-audit scenario or named subflows:
- Manager reviews source-backed objectives/risk/prior findings/open actions, challenges priorities and revises a proposed coverage plan; missing context and omitted coverage remain visible.
- Team defines engagement objectives/scope, risks, controls where relevant, criteria and work programme; displays actual required approval/delegation and version.
- Auditor directs supported procedures, analyses evidence, inspects exceptions/gaps and steers revisions.
- Existing private reviewer-agent loop issues only human-selected notes and rechecks successor basis.
- Team develops supported findings/report; final conclusions/sign-off/issuance remain human, with actual external formal authority when applicable.
- Agreed actions, owners/dates and progress are retained; evidence of implementation, risk acceptance and escalation are distinguished.
- Unresolved items and relevant changed context inform later planning under memory eligibility/current access.
Classification: approved lifecycle coverage. Preserve ad hoc Tasks and optional Engagement. The named sequence is an iterative map, not a forced linear wizard or mandatory RCM/five-Cs form.

### U4. UJ-8; S04/S02/S03; State Patterns and Voice and Tone
Before: a generic triggered procedure, response/retest and closure boundary.
After: include the selected supported recurring check within the lifecycle scenario, with expected input, actual run identity, coverage and known interruption cause. Permit review/resume/adjustment within authority; show missing event/input, not run, partial, failed and no-exceptions separately. Link actionable results to follow-up and later plan context without automatically closing actions.
Add visible distinction between “management reports complete,” “implementation evidence reviewed,” “risk accepted under authority” and unresolved status, using methodology-specific labels, not a universal state taxonomy.
Classification: compatible clarification. Exact recurrence and follow-up cadence are unresolved; research does not mandate universal reminders or a closed-state label.

### U5. State Patterns S02/S03/S04; Workbook; PlanStep; Authority and Delivery
Before: actual coverage already inspectable; work completion, review and approval distinct.
After: show a concise “what ran / what remains / what this conclusion covers” summary grounded in actual procedure evidence, expandable to population, exclusions, failures and interruption/recovery record. Keep execution verification separate from professional appropriateness and human acceptance. Explicitly warn against treating a passed sample or completed plan step as full coverage.
Classification: compatible. Select exact evidence and acceptance criteria per supported procedure. Do not force auditors to operate batch machinery, write code or repeat every record.

### U6. DESIGN Components; Do's and Don'ts; Layout & Spacing
Before: existing quiet artifact-first system with factual statuses and review/privacy protections.
After: preserve tokens and component inventory. Add usage examples for organisational-context provenance, coverage-plan proposed/changed/externally approved states, programme changes and action follow-up. Compose existing Tabs, StatusChip, JudgmentTag, FileChip, DiffLine and review/automation patterns with explicit text and source/version.
New arrangements remain proposed UX until walkthrough/rendered accessibility checks. No automatic new dashboard, mandatory navigation category or branded component follows.
Classification: compatible visual application; specific layouts require design validation.

## Governing SPEC conflicts requiring coordinated reconciliation
- spec-inquello/SPEC.md Why and CAP-20 currently present internal/external/advisory/IT audit broadly as V1. Reframe current V1 as internal audit; retain appropriate advisory/technical capabilities within that context and move external-audit-specific scope to explicit future target.
- SPEC Non-goals excludes “Prioritising audit-universe/portfolio planning…” together with staffing/capacity/budget suites. Split it: supported risk-based coverage-plan work is approved V1; large-team resource/capacity/budget suite and general workflow builder remain outside. Do not keep the whole exclusion or import the whole suite.
- SPEC Constraints and scope-and-gates.md preserve blanket 41-FR V1/full inventory claims. Keep historical IDs and map applicability against latest approved scope, rather than silently reinstating excluded breadth or deleting detailed behaviors.
- collaboration-and-memory.md needs lifecycle acceptance references added, not a privacy rewrite. Its workbook checkpoint already correctly says it is not reduced product scope.
- Customer onboarding SPEC must remain an honest account/team-access contract. New audit-method/context/readiness work should be planned as an explicit extension; its partial implementation/test notes do not prove end-to-end onboarding.
- Historical “supplier unresolved,” “operator-only,” “no code exists,” and blanket “unexecuted” statements must be dated/reconciled against current onboarding sources. This analysis does not certify live Auth0, email, runtime or UI acceptance.

## Genuine decisions still needed
1. Concrete supported procedures, data/file intake, initial connections and recurring-check limits for the one-team V1. Full journey is already decided; do not ask whether to include it again.
2. First-engagement readiness: minimum context/method/permission inputs, blocked versus deferrable items and safe organisational knowledge admission.
3. Actual organisation methodology, applicable assurance/advisory/topical obligations, delegated approval roles and evidence of external governance approvals.
4. Deliverable-by-deliverable formal authority and export/link preservation. Recommend retaining adopted V1/V2 split unless a specific requirement proves inadequate; do not ask for a speculative wholesale database redesign.
5. Evidence establishing faithful supported execution/recovery, pilot baseline and usable reviewer inspection. No invented sample sizes, throughput targets, performance claims or completion percentages.
6. Actual pilot/data authorisation, security/retained-data/hosting eligibility and current route acceptance. Product approval does not authorise customer-data use or outreach.
7. Concrete navigation/layouts for new lifecycle coverage, validated with the team and selected visual system. Logical surfaces are not implemented screens.

## Proposed acceptance additions, not executed tests
- Trace one approved internal-audit scenario from permitted organisational context and manager-adjusted coverage plan through engagement design, execution, private review, human report decision, action follow-up and later plan reuse.
- Demonstrate programme/objective/scope change and affected evidence/conclusions without silently retaining obsolete applicability.
- Show source-backed competing/contradictory context, stale history, inaccessible evidence and legitimate methodology variation.
- Define a known population/procedure, reconcile actual coverage and interrupt/recover it. Verify no silent omissions or duplicated effects using suitable execution evidence, not only agent narrative or spot checks.
- Run the supported recurring check and exercise no input/not run/partial/failure/revoked permission/host unavailable outcomes; preserve completed work and human closure authority.
- Confirm admin/private separation, deliberate selected-context sharing, recipient access, team-memory admission exclusions and active revocation across planning and follow-up, not just workpapers.
- Export selected supported work with explicitly verified preservation/loss of evidence–finding–workpaper/action references. Do not advertise undecided formats.
- Walk through guided settings plus conversation, with required versus later setup and clear missing-connection handoff; use real UI/host tests when separately authorised.
- Keep synthetic, actual inference, actual integration and real authorised engagement evidence separate. Real-use blockers cannot be waived by a document completion or a pleasant synthetic demo.

## Suggested reconciliation order and stopping boundary
1. Approve/reconcile product scope and vocabulary against PRFAQ 6/9, with explicit old-to-new applicability.
2. Adopt the compatible architecture/UX clarifications and preserve existing decisions; isolate the concrete questions above.
3. Define procedure-level acceptance and authority/export contracts before their dependent stories; update lifecycle traceability and dependency ordering.
4. Apply later approved document updates through their established workflows. Preserve historical contracts and provenance.
This file is the deliverable for the current read-only analysis. No existing file was edited, no code or schema implemented, no installs/downloads/commits performed, and no test or production-readiness outcome is claimed.

## Addendum: smallest supported recurring-check execution boundary
The smallest compatible V1 proposal is one selected bounded procedure triggered on a supported local desktop execution path, using permitted inputs available to that host and an immutable authorised mandate. This is a scope recommendation, not a claim that a scheduler exists or a selection of a new implementation.

Already specified:
- AD-12 binds trigger, inputs, Method, acting identity, limits, destination and escalation to an immutable accepted mandate revision. Current revocation/restrictive policy applies; edits are prospective unless explicit authorised rebind records the impact.
- AD-4 requires supported automated entry paths to use the same Rust audit rules; AD-7 preserves logical mutation ownership; AD-11 requires exact effects/outcome reconciliation.
- The Local desktop envelope explicitly requires actual computer/app availability for local sources. AD-21/SC-5 additionally require the model connection for cloud-model work and live Inquello authority for shared-derived use. No automatic cloud continuation or offline model fallback is selected.
- UJ-8/S04 already distinguish received/not-run/running/incomplete/failed; disabled future scheduling differs from cancellation of a running job. Duplicate events and uncertain deliveries must not silently repeat effects.
- Scheduler/event supply remains a required unproven implementation dependency, not a supplied backend merely because runtime queue/heartbeat primitives exist.

Still to specify before claiming a dependable supported recurring check:
1. What installs/registers and actually invokes the local trigger, and whether it requires the desktop application running or a separately supported local process. No new background service is selected here.
2. Expected computer/app/connection availability for the selected cadence, including how the product detects and displays a missed expected run when the host next becomes observable. It cannot report an offline computer's work as complete.
3. Explicit missed-run policy: skip with notice, ask to catch up, or a bounded preauthorised catch-up. The source documents do not select one. A safe default proposal is visible missed/unrun status plus deliberate recovery, without inventing queued replay.
4. Run identity and unattended credential/session eligibility on the local host, including expiry, reauthentication and lost/revoked owner handling. A configured human owner is not proof of valid unattended execution authority.
5. Duplicate-trigger/run/effect handling, input freshness, partial-run recovery and escalation destination. Existing receipt/mandate rules constrain these decisions but do not supply a full scheduler.
6. The chosen real route's operating/data eligibility and verification. Shared authority may still depend on a service; no production scheduler/hosting supplier or always-on availability is chosen by this analysis.

Recommended owner decision is therefore the concrete check and tolerated local availability/missed-run behavior, not “local versus cloud redesign.” Architecture can propose the local trigger mechanism within the preserved boundary, then qualify it before reliance. If the chosen business need requires execution while the desktop is asleep/offline, that is a material additional availability requirement needing an explicit supported-route decision. It is not permission to silently move files/execution to cloud hosting.

The accepted V1 journey can be supported through working artifacts, external formal records and existing coordination. Do not ask the owner to reopen native V2 authority unless a concrete selected deliverable cannot satisfy its requirement under that arrangement. First specify the artifact, actual external authority and handoff/export contract; only then raise a demonstrated gap.
