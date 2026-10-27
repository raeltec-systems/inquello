"""Log accepted decisions, then derive the draft contract without editing adopted sources.

The current-run data below mirrors records written through memlog.py. Receipts permit
resuming an interrupted append without rereading or rewriting the canonical memlog.
Later substantive edits require additional memlog decisions and full rederivation.
"""
from pathlib import Path
import json
import os
import re
import subprocess
import sys

ROOT = Path("D:/Projects/inquello")
WORKSPACE = ROOT / "_bmad-output/specs/spec-inquello"
WORKING = WORKSPACE / ".working"
MEMLOG = ROOT / "_bmad/scripts/memlog.py"

PRODUCT = "../../planning-artifacts/prds/prd-inquello-2026-10-26/prd.md"
EVIDENCE = "../../planning-artifacts/prds/prd-inquello-2026-10-26/addendum.md"
DESIGN = "../../planning-artifacts/ux-designs/ux-inquello-2026-10-26/DESIGN.md"
EXPERIENCE = "../../planning-artifacts/ux-designs/ux-inquello-2026-10-26/EXPERIENCE.md"
ARCH = "../../planning-artifacts/architecture/architecture-inquello-2026-10-26/ARCHITECTURE-SPINE.md"
ADOPTED = [
    (PRODUCT, "Final PRD", "Product behavior, phases, vocabulary, FR/NFR consequences, eight journeys, metrics and open product gates."),
    (EVIDENCE, "Final PRD addendum", "Exact W1–W3/M1 fixtures, A01–A18 evidence summaries and evidence/reuse limitations."),
    (DESIGN, "Final DESIGN", "Selected visual system, exact tokens/assets, 28 components, source reconciliations and accessibility applications."),
    (EXPERIENCE, "Final EXPERIENCE", "Interaction/state/authority contracts, 13 logical surfaces, all eight journeys, seven supporting paths and AS-UX1–4."),
    (ARCH, "Final Architecture Spine", "Adopted implementation contract: AD-1–AD-4 choices, AD-5–AD-14 derived rules, consistency, stack, supply and implementation gates."),
    ("../../../addendum.md", "Product-definition addendum", "Full P01–P22 behavior and J1–J8/A01–A18 wording, interpreted through the final product/UX/architecture decisions."),
    ("../../../PRODUCT_BRIEF_TRACEABILITY.md", "Scope traceability", "Full-scope mappings and inventory accounting; grouped capabilities do not replace mapped requirements."),
    ("../../../CODEX_AUDITOR_FEATURE_MIRROR.md", "Detailed capability mirror", "79 C entries, 270 mapped subfeatures and 93 proposed enhancements retained under their original status and final phase rules."),
    ("../../../CODEX_AUDITOR_FEATURE_MAP.md", "Expanded feature map", "20 expanded capability definitions and their detailed behaviors, read with final scope and phase decisions."),
]

# id, title, phase, P group, FRs, intent, success, relevant NFRs, UJs, acceptance criteria.
CAPS = [
    (1, "Organise and recover work", "V1", "P01", [1, 2],
     "Organise, find and resume Assignments, folders, Tasks and concurrent work, including ad hoc Tasks.",
     "Reopened work retains permitted references, progress and artifacts; supplied client/period/Workspace and attention states remain visible without mandatory engagement fields.", "3,5,7", "1,2", "01,09"),
    (2, "Continue across access surfaces", "V1", "P02", [3, 4],
     "Start, inspect, steer and continue work through supported desktop, CLI/session, application-adjacent, mobile/remote and optional physical controls.",
     "Surface changes preserve Task identity and authority; controls have declared observable outcomes, and unavailable actions or live-state access are explicit.", "3,5,9", "1,3,5", "09,15,16"),
    (3, "Use environments and alternatives", "V1", "P03", [5, 6],
     "Choose approved working environments and compare and promote isolated alternatives while preserving originals.",
     "Execution and inference locations are separately visible; origin and promotion history survive; concurrent edits are preserved, resolved or left unapplied.", "1,4,8", "3,5", "04,09,18"),
    (4, "Direct scoped work", "V1", "P04", [7, 8],
     "Request, steer, interrupt, continue and resume permitted work, including long-running goals and background work.",
     "Progress and input needs are visible; checked, unchecked and incomplete work differ; recovery exposes retained artifacts and applied effects without inventing rollback.", "4,6,10", "1–8", "01,09,13,18"),
    (5, "Use attributable context", "V1", "P05", [9, 10],
     "Provide supported files, folders, documents, data, visuals, selections, annotations and application context.",
     "Relied-on inputs retain origin/version, scope and limits; missing material, snapshot freshness and saved/live state are explicit; incomplete inputs never imply full Coverage.", "2,3,7", "1,3,6", "01,03,05,17"),
    (6, "Produce checkable analysis", "V1", "P06", [11, 12],
     "Perform permitted calculations, queries, transformations, scripts, shell/code work and full-population or sample-based analysis under the chosen Method.",
     "Known-result fixtures reconcile; inputs, parameters, derivations, exclusions, duplicates and actual Coverage are inspectable; changed inputs trigger recalculation or stale marking.", "2,6,7", "3,5", "03,06,18"),
    (7, "Create and deliver editable artifacts", "V1", "P07", [13, 14],
     "Create, revise, inspect and externally continue supported spreadsheets, documents, presentations, datasets, scripts and visuals, including shared, published or hosted outputs.",
     "Supported features and human edits survive round trips or conflict explicitly; destructive conversion limits are disclosed beforehand; audience and generated/published/verified states remain distinguishable.", "1,5,7,9", "3,4,6", "03,04,05,17"),
    (8, "Research and use permitted interfaces", "V1", "P08", [15, 16],
     "Research attributable public/permitted sources and use supported browser, site and computer interactions.",
     "Material claims retain references and labelled limits; acting account/destination and outcomes are identifiable; unavailable context and uncertain effects are disclosed.", "3,7,8", "1,5,6", "01,02,06,10"),
    (9, "Review and investigate technical work", "V1", "P09", [17, 18],
     "Review, correct and recheck artifacts while retaining actual code/configuration, security analysis, scans/findings and focused specialist investigations.",
     "Findings and source/script results retain evidence, provenance, uncertainty and revisions; eligibility and coverage limits are visible; agent review cannot grant human approval or closure.", "2,5,7", "2,4,5", "05,06,08"),
    (10, "Teach and reuse methods", "V1", "P10", [19, 20],
     "Turn examples and instructions into reusable skills/Methods and distinguish maintained guidance, permitted departures, memory and policy.",
     "Method/version/parameters, departures and missing dependencies are inspectable; changes identify affected outputs; shared guidance never silently absorbs case evidence or grants authority.", "3,7", "7", "07"),
    (11, "Discover and extend tools", "V1", "P11", [21, 22],
     "Discover and use permitted built-in, connected, MCP, plugin/marketplace and supported hook, app-server and client-tool extensions.",
     "Identity, dependencies and limits are visible; missing access differs from missing function; hook outcomes/enforcement and unsupported versions are observable.", "3,8,9", "5,7", "07,15,16"),
    (12, "Run programmatic and continuous work", "V1", "P12", [23, 24],
     "Initiate supported batch/SDK/non-interactive work and bounded schedules/events with declared inputs, Method, identity, limits, destination and escalation.",
     "Versioned structured results/streams are available where supported; actual Coverage and missing/unrun/incomplete/failed/no-exception outcomes differ; duplicates cannot cause uncontrolled repeated effects.", "3,4,6,10", "8", "13,14,18"),
    (13, "Delegate and compare alternatives", "V1", "P13", [25, 26],
     "Delegate focused work, inspect and consolidate results, and explore side chats, forks and alternate analyses without losing origin.",
     "Sources, disagreements, gaps and origins remain inspectable; writes are coordinated or isolated; alternatives remain distinct from accepted changes and human decisions.", "3,4,7", "5,8", "08,09"),
    (14, "Control continuity and memory", "V1", "P14", [27, 28],
     "Resume and compact history while separately controlling memory contributions, memory use and permitted application/site activity recall.",
     "Source/decision references remain accessible; missing context and changed access are visible; preferences, reusable knowledge and client evidence remain distinct under selected capture/use/revocation policy.", "3,4,7", "1,7", "07,09,14"),
    (15, "Select routes and control consumption", "V1", "P15", [29, 30],
     "Use allowed models, gateways, local/service routes and available reasoning/speed choices while inspecting usage under configured limits.",
     "Effective provider/deployment/capabilities and data flows are visible; unsupported operations never silently switch route; limits visibly stop/escalate and costs remain attributable.", "6,8,9", "1,5", "15,18"),
    (16, "Retain convenience and scoped migration", "V1", "P16", [31, 32],
     "Use supported voice/dictation, notifications, optional companions, setup/history import and audience-scoped conversation snapshots.",
     "Voice instructions are correctable; attention differs from completion; imports disclose losses; snapshots contain permitted selected content without silently transferring credentials or authority.", "3,5,9", "1,8", "09,14,16"),
    (17, "Enforce authority and input trust", "V1", "P17", [33, 34],
     "Apply effective action permissions and distinguish authorised instructions from instructions embedded in evidence, pages, examples or tool results.",
     "Negative permission and malicious-evidence cases preserve the mandate; approvals identify action/scope; broader/no-prompt modes require explicit permitted configuration and expose their limits.", "3,7,8", "1–8", "07,14,15"),
    (18, "Assign responsibility and revoke access", "V1", "P18", [35, 36],
     "Assign human Task/review responsibility and manage access, reassignment and departures across retained work and unattended jobs.",
     "Responsible humans and reviewed versions are identifiable; effective revocation prevents subsequent prohibited use; orphaned jobs and retained work receive explicit policy handling.", "3,7,10", "2,4", "08,14"),
    (19, "Govern V1-held material", "V1", "P19", [37],
     "Govern access, retention, deletion, export and recovery for working files/history, evidence references, logs and telemetry held by Inquello.",
     "Held categories remain distinct from external authoritative records; export/recovery declares losses and respects access; usage counts never represent accepted work or Coverage.", "3,4,9,10", "2,8", "09,11,14,18"),
    (20, "Support external-record practice", "V1", "P20", [39],
     "Coordinate planning, procedures, evidence exchange, analysis, workpapers, review, reporting, responses, follow-up and approved stakeholder communication using artifacts and external systems.",
     "External-audit, advisory and technical examples follow their Methods without mandatory control/deficiency objects; agent completion never professionally closes a Finding.", "2,5,7", "2,4,6,8", "02,05,06,10,11,13"),
    (21, "Verify external delivery", "V1", "P21", [41],
     "Inspect, authorise and verify bounded changes at a named external audit-record destination, with import/export fallback.",
     "Current version and approved fields are checked; unrelated fields survive; stale/uncertain outcomes require reconciliation; operation identity and unsupported update/deduplication guarantees remain visible.", "3,4,7,9", "4,5,8", "10,11"),
    (22, "Preserve coherent, inspectable work", "V1", "P22", [43, 44],
     "Continue across delegation, editors, environments and review with preserved Task/artifact identity, actual states and declared capability contracts.",
     "Sources, Method and decisions remain accessible; changed evidence affects outputs/approvals visibly; produced, checked, reviewed, approved and attempted/confirmed/uncertain Delivery remain distinct.", "1–10", "1–8", "01–11,13–18"),
    (23, "Govern native records", "V2", "P19", [38],
     "Govern native audit-record retention, deletion, hold, amendment and recovery with attributable history.",
     "Changes and retention decisions are identifiable; hold/deletion conflicts follow configured policy; recovery preserves records, relationships and history or declares limitations.", "3,4,7,9", "2,8 via SP7", "12"),
    (24, "Use native practice records", "V2", "P20", [40],
     "Link practice workflows to native Assignments, procedures, Sources, workpapers, Findings, decisions, Responses, Actions and Retests.",
     "Identities and relationships survive revision; human approval identifies person, scope and version; amendments identify affected prior approvals.", "3,7,9", "2,4,6,8 via SP7", "12"),
    (25, "Select and migrate record authority", "V2", "P21", [42],
     "Select permitted record mode through Organisation/Workspace configuration and deliberately migrate to an identified destination.",
     "Tasks/Assignments never silently switch authority; transferred records, artifacts, relationships/history and losses are identified and verified; operational systems remain separate.", "3,4,7,9", "4,5,8 via SP7", "11 V2,12"),
]

WHY = "Inquello brings the Codex-style working experience to internal audit, external audit, advisory and IT/IS audit: bring existing material, direct agent work, inspect and revise outputs, and continue in existing tools. The aim is lower total human effort through accepted delivery while preserving accuracy, traceability, confidentiality and judgment. One organisation's audit team supplies first validation; it does not narrow the eventual audience or mandate an engagement for ad hoc work."

CONSTRAINTS = [
    "Preserve all P01–P22 groups, 41 V1 FRs, three V2 FRs, ten NFRs, eight journeys and the complete mapped inventory. No first increment is selected; deferrals remain unmet scope and cannot establish full parity. See [scope and gates](scope-and-gates.md).",
    "V1 uses supported working files and external authoritative audit records, including scheduled, approved unattended and continuous work. Only V2 adds native authority/lifecycle/migration; V2 foundations do not gate V1.",
    f"Implement the adopted [Architecture Spine]({ARCH}) AD-1–AD-14 and final [DESIGN]({DESIGN})/[EXPERIENCE]({EXPERIENCE}) contracts. Detailed implementation, tokens, components and surface/state rules remain binding companions.",
    "Keep execution permission, local edits, agent checks, human review, Professional Approval and Delivery distinct. Formal V1 acceptance follows the designated external authority and actual Method; no universal extra sign-off applies to reversible actions.",
    "Retain attributable source/version, input scope, Method/version/parameters/departures, derivations, actual population/coverage and uncertainty. Relevant evidence, Method, policy or output changes stale affected decision applicability, even when output bytes do not change.",
    "Preserve supported saved-file identity, unrelated content and intervening human edits; distinguish saved, live and remote-record access. Disclose unsupported destructive conversions beforehand; resolve conflicts or leave changes unapplied.",
    "Before consequential external effects identify destination, acting identity, exact authorised change and relevant version under permission or a permitted mandate. Preserve operation identity, verify outcomes and reconcile uncertainty before retry; audit writeback grants no source-transaction authority.",
    "Accepted runs/effects remain bound to an immutable authorised mandate revision; changes are prospective unless explicitly rebound with authority/impact checks. Current revocation and restrictive policy apply; stopping or disabling future work never implies rollback.",
    "Enforce effective access across tools, evidence, delegation, memory, sharing, retained work and unattended jobs. Evidence instructions cannot expand authority; general agent tools cannot access protected domain/credential stores or confer human decisions through untrusted previews.",
    "Expose execution, inference, connector/browser, retained-file/history/log/backup and unattended routes separately. Preserve gateway/local-model, Bedrock, Azure Foundry/Azure OpenAI and GCP/Vertex scope without silent fallback or presumed service/policy eligibility.",
    "Maintain separate Method authority, task-specific departures, memory contribution/use and activity recall. No silent client-evidence sharing, case-to-team promotion or cross-Assignment reuse; actual policy determines distribution, retention and review rights.",
    "Keep missing, inaccessible, stale, blocked, partial, interrupted, failed and uncertain states visible; preserve usable work/drafts and disclose unsupported handoffs. No implied synchronisation, offline queue, automatic resend, cloud continuation or exactly-once guarantee.",
    "Demonstrate accessible core inspection and actions on declared clients without requiring code literacy. The selected visual/accessibility applications and AS-UX1–4 remain subject to rendered-host validation; actual operating targets and route readiness require their gates.",
]

NONGOALS = [
    "V1 native authoritative records; operational ledger/HR/transaction-source authority in either phase.",
    "A universal audit methodology, mandatory engagement/control/deficiency model, sampling rule, review hierarchy or workflow state machine.",
    "Equating agent completion, a generated report, a closed Task, Keep/Revert or a reviewer-agent role with assurance, Professional Approval or remediation.",
    "Presuming continuous two-way synchronisation or a guest portal as accepted baseline; these remain explicit choices rather than permanent prohibitions.",
    "Prioritising audit-universe/portfolio planning, staffing/capacity/budget suites, organisation-wide assurance mapping, quality-programme administration or a general workflow builder; ordinary engagement planning/follow-up remain V1.",
    "Claiming proven demand, savings, final naming clearance, functioning prototype integrations or transferable hosted-service eligibility from document adoption.",
]

SUCCESS = "Demonstrate applicable A01–A18 and exact W1–W3/M1 outcomes for enabled routes, including same-file external edits, denial/revocation, interruption, conflict and uncertain Delivery. Compare matched practitioner task classes through human acceptance for total effort, traceability, cost and recovery within approved bounds; report wrong/missed results, correction burden, authority failures and artifact/effect loss, including failed/abandoned work and denominators. No runtime acceptance is claimed yet; numerical targets remain gated."

# ID, short kernel text, detail, owner, trigger.
QUESTIONS = [
    ("OQ-1", "Which private/team/guest participation model applies?", "Choose private sharing, audit-team/reviewer access with external exchange, or guests; team-only remains a recommendation.", "Product lead with audit lead", "Before collaboration permissions and guest UX commitments; existing approved communications can proceed."),
    ("OQ-2", "Which supporting evidence may be retained?", "Choose references, necessary permitted extracts/derivations or broader source copies under rights/policy; extracts remain a recommendation.", "Audit method owner and organisation data-policy owner", "Before ingestion/retention design is fixed or real data is used; local SQLite does not choose retained content."),
    ("OQ-3", "What cross-Assignment/client recall is authorised?", "Choose isolation, approved reusable/carry-forward knowledge or broader authorised retrieval; carry-forward remains a recommendation.", "Product lead and data-policy owner", "Before enabling memory retrieval across Assignments/clients."),
    ("OQ-4", "How are Methods distributed and human review rights assigned?", "Choose team files, reviewed versioned packages or managed catalogue; define publishing/approval/reviewer rights while retaining Codex mechanisms.", "Method owner with audit lead", "Before shared Method rollout or approval-workflow commitments."),
    ("OQ-5", "Which task/team budgets, values and stop rules apply?", "Choose task limits, team-period budgets or both, including values, accounting and stop/escalation; both remains a recommendation.", "Product lead with team administrator", "Before unattended work or usage commitments."),
    ("OQ-6", "Which clients, format features/versions and integration contracts ship first?", "Name supported clients/formats/versions and record systems, including read/write, conditional-update, concurrency and result-verification contracts.", "Product lead with integration/architecture lead", "Before first-increment stories and compatibility promises; full target remains unchanged."),
    ("OQ-7", "Who validates which examples against which baselines and thresholds?", "Select team, permitted examples, task classes, baselines, thresholds and acceptance owners.", "Audit lead with product lead", "Before practitioner validation or efficiency/reliability claims; synthetic fixtures can proceed."),
    ("OQ-8", "What workload, service, recovery and accessibility commitments apply?", "Define scales, supported clients, availability/support, latency, recovery/loss tolerance and applicable accessibility targets.", "Product lead with design/operations leads", "Before relevant sizing, rollout or service promises; selected accessibility applications do not close conformance targets."),
    ("OQ-9", "Which processing/service/authentication routes satisfy actual policy?", "Verify policy/eligibility across files, execution, inference, connectors, logs, backups and unattended work; inclusion does not grant provider approval.", "Organisation policy/security owner with architecture lead", "Before selecting dependent deployment/processing routes or using affected data; adopted stack choices remain fixed."),
    ("OQ-10", "What is the first increment and which acceptance remains unmet?", "Select dependency order and explicit release deferrals with unmet acceptance recorded; no implicit MVP cut.", "Product lead", "Before release-bound epic/story commitments."),
    ("OQ-11", "What V2 record precedence, lifecycle and migration policy applies?", "Resolve Organisation/Workspace precedence, review/hold/amendment/retention and migration; workspace choice within organisation policy remains a recommendation.", "Product lead, audit lead and data-policy owner", "Before native-mode implementation commitments; not a V1 blocker and not a reopening of AD boundaries."),
    ("OQ-12", "What name/brand clearance and final validation remain?", "The supplied visual kit and final UX are selected; final name clearance/public-brand validation remain. Research territories do not select launch markets.", "Product/design lead", "Before public brand commitments; validate inherited UX assumptions before their dependent commitments."),
]

ASSUMPTIONS = [
    ("AS-1", "Journey personas/scenarios are illustrative, not observed practitioner sessions.", "Audit lead with product lead under OQ-7", "Validate the flows with the selected team before practitioner-validation or benefit claims."),
    ("AS-2", "Gate owners are proposed role assignments, not confirmed appointments.", "Product lead", "Assign named people before affected work begins."),
    ("AS-UX1", "S05–S13 placements are derived and require walkthroughs.", "Product/design lead with practitioner and review representatives", "Before navigation/screen-layout commitments; resolve relevant OQ-1/3/4/6 dependencies without narrowing full scope."),
    ("AS-UX2", "Responsive and secondary-client arrangements require content-fit validation.", "Design lead with client/architecture lead", "Test fit, zoom, overflow and handoff before responsive/secondary-client commitments; OQ-6/8 choose support/conformance targets."),
    ("AS-UX3", "Interaction completion remains unproved on actual hosts/integrations.", "Design lead with implementation/accessibility reviewer", "Verify semantic/keyboard handlers, focus, draft retention and recovery before supported-interaction claims; labels/callbacks are insufficient."),
    ("AS-UX4", "Existing-token accessibility applications require rendered-state checks.", "Design lead with accessibility reviewer", "Check rendered text/control/focus pairs and states before shipping applications; preserve palette/imports, without global conformance or assumed OQ-8 targets."),
]

SUPPLY = [
    ("Scheduler/event/mandate route", "Architecture/integration lead with team administrator", "Before enablement/promises; OQ-5/6/8/9. Prove actual production supply beyond queue/heartbeat primitives; FR-23/24 remain required V1 scope."),
    ("Sharing, review and cross-host ownership", "Product/audit leads with architecture/integration lead", "Before permissions/integration commitments; OQ-1/6/9. Local threads/SQLite do not implement team authority or remote continuity; verify explicit ownership/version transfer or gate that route."),
    ("Remote execution and connected services", "Architecture/integration lead with organisation policy/security owner", "Before route use; OQ-6/9. Name service, identity, context and eligibility; no inferred hosted backend, automatic cloud handoff or fully local inference."),
    ("Environment and operating envelope", "Product/design/operations leads with policy owner", "Before real-data/production promises; OQ-2/8/9. Set workload, support/availability, recovery/loss, deployment/data eligibility and retention; measure total effort/cost/recovery with quality counter-metrics."),
    ("Local desktop/context availability", "Architecture/implementation owners within route commitments", "Before promising locally sourced schedules or continuity. Validate computer/app/connection availability and disclose unavailable/interrupted work; local runtime lifecycle does not supply cloud completion."),
    ("Implementation seed and compatibility", "Architecture/implementation leads", "Before dependent code. Choose delivery fork cut and concrete facade/extension/protocol seams; verify compiler/package/driver compatibility, migrations, conflicts, secure data paths, packaging/update and ownership-transfer contracts. Keep AD dependency/authority/mutation ownership fixed. The separately linked domain-store SQLite runtime requires the WAL-reset fix: 3.51.3+ or documented fixed backport."),
]

ARCH_IDS = [
    "Public Codex fork foundation", "Separate audit semantics from the agent runtime",
    "Electron desktop with React/TypeScript", "Shared Rust audit modules and separate working SQLite",
    "Directed dependencies and constrained desktop privilege", "Stable work linkage and separate state authorities",
    "Owned mutations and cross-store recovery", "Scoped context, permission and processing routes",
    "Artifact identity and conflict-preserving changes", "Method departures and knowledge boundaries",
    "Bounded external effects and reconciliation", "Automation mandates and collaboration ownership",
    "Phase-specific record authority", "Capability evidence and operating commitments",
]

SOURCE_RULES = [
    "All nine adopted documents retain downstream value and are mandatory companions, unchanged. Linked UX token/font/identity/icon/component source assets are read when implementing their contract. No source is declared fully absorbed; sources is empty. Operational memlogs, reviews, inventories of production work and working extracts are not companions.",
    "Source roles are explicit: final PRD/addendum govern product behavior, phases and evaluation; DESIGN governs appearance and EXPERIENCE behavior, both over conflicting prototypes; final Architecture Spine governs adopted implementation. Older scope cards retain every detailed behavior under these later explicit decisions; historical unselected-framework/architecture wording does not reopen AD-1–14.",
    "Final UX and selected visual kit supersede earlier pending-UX wording. OQ-12 retains final name/public-brand clearance and validation. Prototype imports are references, not implemented integrations, and do not narrow full V1 breadth.",
    "Inventory preservation: P01–P22; 79 C entries; 20 expanded behaviors; 270 subfeature mappings; 93 proposed enhancements retain original status; separate named GCP/Vertex delta; J1–J8/UJ-1–8 and A01–A18. No unsupported promotion of proposed enhancements or implicit removal of smaller/technical capabilities.",
    "Architecture AD-1–AD-4 are user-adopted choices; AD-5–AD-14 remain derived enforcement rules at their original IDs. Preserve implementation security, reviewed-basis revision, owned mutation, immutable automation mandate revision and phase rules by adopting the complete spine, not selectively copying rules.",
    "NFR-1–10 apply to enabled capabilities in their phases; capability mapping lists relevant examples rather than an exhaustive or exclusive allocation. UJ-1–8 remain V1; SP7 extends them into V2, without making native records V1 gates.",
]

ACCEPTANCE_RULES = [
    "A01–A10 and A13–A18 assess V1; A11 separates V1 external authority/export from V2 mode selection/migration; A12 assesses only V2. Capability-specific tests cover the full mapped inventory and every enabled route, including smaller capabilities and negative/recovery cases; no deferral counts as demonstrated parity.",
    "The final PRD addendum preserves exact proposed W1–W3/M1 rules; fixtures are examples, not universal methods. W1 retains five ledger/six bank rows, three exact matches, totals 4600/4750 and excess 150; saved R5=800 changes ledger to 4700 and excess to 50. W2 requires approval timing and effective-policy-period assessment. W3 retains seven accounts, investigates A2/A5, recognises valid A6 and preserves A7. M1 separates approved guidance from evidence instructions and identifies changed-method impacts.",
    "Preserve SM-1 total human effort through acceptance with wall time separate, SM-2 retrievable evidence/Method/derivation/review/delivery traceability, SM-3 tool/model/resource costs including failed/repeated work and SM-4 usable work/reconciled effects/time/human recovery effort. Report matched task classes, denominators, samples, unaccepted and abandoned work; thresholds await OQ-7/8.",
    "SM-C1 wrong/missed results, SM-C2 review/rejection/correction burden, SM-C3 prohibited access/actions/disclosure/false approval or delivery, and SM-C4 content loss/overwrite/duplicate effects/unrecoverable work counterbalance claimed improvement. Negative authority cases pass before enabling affected routes.",
    "Evidence limits remain: W1–W3/M1 and product runtime acceptance are unexecuted; four imported desktop references cover S01–S04, nine written-only surfaces cover S05–S13, and only S13 is V2. All 28 UX components and linked assets retain requirements; prototype callbacks do not prove keyboard/semantic/focus/recovery behavior. Architecture contract review is not an install/build/runtime/security-conformance or release approval.",
]

def frs(values):
    return ", ".join(f"FR-{i}" for i in values)

def compact_ids(prefix, value):
    return ", ".join(prefix + p.strip() for p in value.split(","))

def render_spec():
    front = ["---", "id: SPEC-inquello", "status: draft", "companions:", "  - scope-and-gates.md"]
    front.extend(f"  - {path}" for path, _, _ in ADOPTED)
    front.extend(["sources: []", "---", "", "> **Draft contract.** Read this SPEC and every `companions:` file together. The complete scope and adopted decisions are retained; coherence and preservation validation are pending.", "", "# Inquello", "", "## Why", "", WHY, "", "## Capabilities", ""])
    for number, title, phase, p, fr, intent, success, *_ in CAPS:
        front.extend([f"- **CAP-{number}** — {title} ({phase})", f"  - **intent:** {intent}", f"  - **success:** {success}", ""])
    for heading, entries in [("Constraints", CONSTRAINTS), ("Non-goals", NONGOALS), ("Success signal", [SUCCESS])]:
        front.extend([f"## {heading}", ""])
        front.extend(f"- {item}" for item in entries)
        front.append("")
    front.extend(["## Assumptions", "", "Inherited only; owners and revisit triggers remain in [scope and gates](scope-and-gates.md#inherited-assumptions).", ""])
    front.extend(f"- **{ident}:** {short}" for ident, short, _, _ in ASSUMPTIONS)
    front.extend(["", "## Open Questions", "", "Existing decision gates, not blockers to adopting this contract; owners and exact triggers are in [scope and gates](scope-and-gates.md#open-product-gates).", ""])
    front.extend(f"- **{ident}:** {short}" for ident, short, *_ in QUESTIONS)
    return "\n".join(front).rstrip() + "\n"

def render_companion():
    out = ["# Inquello scope and gates", "", "This companion indexes the adopted contract; it does not replace source consequences, detailed cards, UX states/tokens or architecture rules. All linked adopted documents are mandatory through `SPEC.md` frontmatter.", "", "## Source roles and decision order", "", "| Adopted artifact | Contract role |", "|---|---|"]
    out.extend(f"| [{title}]({path}) | {role} |" for path, title, role in ADOPTED)
    out.extend(["", SOURCE_RULES[1], "", SOURCE_RULES[2], "", "Read relevant linked UX assets when implementing their contract. Inspect cited technology evidence when choosing the fork/protocol/toolchain/driver. Working ledgers, review history, memlogs and research provenance are not extra top-level scope; no adopted file is rewritten or treated as fully absorbed.", "", "## Scope and phase coverage", "", "The full target retains **P01–P22, 79 C entries, 20 expanded behaviours, 270 subfeature mappings, 93 proposed enhancements under their original status, the named GCP/Vertex delta, J1–J8/UJ-1–UJ-8 and A01–A18**. Their detailed behavior remains in the nine adopted artifacts; grouping is not a scope reduction.", "", "**V1: CAP-1–CAP-22, 41 FRs. V2: CAP-23–CAP-25, FR-38/40/42 only.** P19/P20/P21 each contributes one V1 requirement and one V2 addition. Scheduled work, approved unattended execution, continuous assurance and ordinary external-record engagement/follow-up remain V1. A first shipping increment or validation slice does not redefine the target.", "", "The following NFR/UJ/A links are relevant verification indexes, not exclusive allocations or replacement acceptance criteria. All applicable NFR-1–NFR-10 remain binding. All eight journeys are V1; SP7 later extends applicable flows into native V2 records.", "", "| Capability | Phase | P / FR coverage | Relevant NFR | Journey | Acceptance index |", "|---|---|---|---|---|---|"])
    for number, _, phase, p, fr, _, _, nfr, uj, acceptance in CAPS:
        out.append(f"| CAP-{number} | {phase} | {p}; {frs(fr)} | {compact_ids('NFR-', nfr)} | {compact_ids('UJ-', uj)} | {compact_ids('A', acceptance)} |")
    out.extend(["", "NFR families retain artifact fidelity (1), analytical reliability (2), confidentiality/access (3), recovery/duplicate effects (4), usability/accessibility (5), performance/cost (6), provenance (7), processing transparency (8), portability/compatibility (9) and operational visibility (10); their full conditions and phase applicability remain in PRD §5.", "", "## Adopted architecture and UX boundaries", "", f"Preserve [Architecture Spine]({ARCH}) **AD-1–AD-4 [ADOPTED]** and **AD-5–AD-14 [DERIVED]** at their original IDs. Their complete rules govern implementation; this index does not copy or weaken them. Later choices of public Codex foundation, Electron/React/TypeScript and shared Rust/separate local working SQLite settle earlier documents' unselected-implementation wording without conferring native V1 authority or proving hosted supply.", "", "Final DESIGN owns appearance and EXPERIENCE owns behavior over conflicting imports. The complete 28-component system, exact supplied assets/tokens and documented reconciliations remain required. S01–S04 have imported desktop references; S05–S13 are written-only placements under AS-UX1; S13 alone is V2. Twelve V1 surfaces, secondary clients and seven supporting paths cannot be reduced to the four imported screens.", "", "## Acceptance and evidence limits", ""])
    out.extend(f"- {item}" for item in ACCEPTANCE_RULES)
    out.extend(["", "Exact fixture setup, duplicate identities, expected values, evidence collections, supported-file features and failure scenarios remain in the final PRD addendum and full A01–A18 wording in the product-definition addendum. Reopen/reimport and actual destination-state checks support compatibility; a transport response, toast, completed turn or green status never substitutes for accepted work.", "", "## Open product gates", "", "Owners are inherited proposed roles, not appointments (AS-2). Existing recommendations remain recommendations. A gate blocks its dependent commitment; independent contract/fixture work can continue. Final UX/architecture adoption answers only their explicit choices.", "", "| Gate | Remaining decision | Proposed owner | Revisit before / boundary |", "|---|---|---|---|"])
    out.extend(f"| {ident} | {detail} | {owner} | {trigger} |" for ident, _, detail, owner, trigger in QUESTIONS)
    out.extend(["", "OQ-2/6/9 gate affected data/integration designs; OQ-6/10 gate release-bound stories; OQ-7/8 gate validation and operating promises. OQ-11 native-record policy does not block V1. No new product decision, default policy, numerical target or release cut is inferred.", "", "## Inherited assumptions", "", "| Assumption | Retained claim | Proposed owner | Revisit trigger |", "|---|---|---|---|"])
    out.extend(f"| {ident} | {short} | {owner} | {trigger} |" for ident, short, owner, trigger in ASSUMPTIONS)
    out.extend(["", "## Implementation and supply gates", "", f"These are existing commitments from the [Architecture Spine]({ARCH}) Stack, Structural Seed and Operating Envelope, and Deferred sections, not scope deferrals or newly selected services. Detailed package layout/schema can wait for implementation; shared authority, dependency direction and mutation ownership cannot vary by feature.", "", "| Dependency | Proposed owner | Required decision/evidence and trigger |", "|---|---|---|"])
    out.extend(f"| {name} | {owner} | {trigger} |" for name, owner, trigger in SUPPLY)
    out.extend(["", "Inspected source revisions and technology versions are evidence snapshots/seeds, not an implicitly selected delivery cut or validated combined stack. Follow the spine's linked evidence before dependent implementation, including experimental/unsupported-production transport limitations. A separately linked SQLite driver needs independent fix verification; an upstream state-store claim is insufficient.", "", "Source constraints, deferred gates and proposed acceptance retain their evidence status. This draft performs no installation, fork creation, runtime validation, deployment, production approval or story breakdown."])
    return "\n".join(out).rstrip() + "\n"

def records():
    rows = [("direction", "Derive initial draft Inquello SPEC from final product, UX and user-adopted architecture with full scope, 25 stable CAP IDs, nine unchanged adopted companions plus scope-and-gates.md; no elicitation, new assumptions or stories.")]
    for path, title, role in ADOPTED:
        rows.append(("decision", f"Adopt complete {title} at {path}: {role}"))
    rows.extend(("decision", rule) for rule in SOURCE_RULES)
    rows.append(("decision", "Why: " + WHY))
    for number, title, phase, p, fr, intent, success, nfr, uj, acceptance in CAPS:
        rows.append(("capability", f"CAP-{number} [{phase}] {title}; {p}; {frs(fr)}. intent: {intent} success: {success} Relevant verification index NFR {nfr}; UJ {uj}; A {acceptance}; mappings supplement, never replace, adopted source requirements."))
    rows.extend(("constraint", item) for item in CONSTRAINTS)
    rows.extend(("constraint", "Non-goal: " + item) for item in NONGOALS)
    for number, name in enumerate(ARCH_IDS, 1):
        rows.append(("constraint", f"Adopt unchanged Architecture Spine AD-{number} — {name} [{'ADOPTED choice' if number <= 4 else 'DERIVED enforcement rule'}] by reference to {ARCH}; its complete rule remains binding, with no rewritten identifier or new policy choice."))
    rows.append(("decision", "Success signal: " + SUCCESS))
    rows.extend(("constraint", rule) for rule in ACCEPTANCE_RULES)
    for ident, short, detail, owner, trigger in QUESTIONS:
        rows.append(("question", f"{ident}: {short} {detail} Proposed owner: {owner}. Gate: {trigger}"))
    for ident, short, owner, trigger in ASSUMPTIONS:
        rows.append(("assumption", f"{ident}: {short} Proposed owner: {owner}. Revisit: {trigger}"))
    for name, owner, trigger in SUPPLY:
        rows.append(("constraint", f"Inherited implementation/supply gate — {name}. Proposed owner: {owner}. {trigger}"))
    rows.append(("note", "Wrapper-only content not repeated in kernel: source dates/status/titles and production/review history. Adopted files retain provenance; memlogs/reviews/working extracts are process evidence, not companions. No load-bearing product, UX or architecture claim is discarded."))
    rows.append(("event", "Initial draft decisions logged; derive SPEC.md and scope-and-gates.md with 25 capabilities, ten companion references, six inherited assumptions and twelve open questions. Two-pass coherence/preservation validation remains pending; no finalization or runtime acceptance claimed."))
    return rows

def main():
    WORKING.mkdir(parents=True, exist_ok=True)
    accepted = records()
    manifest = [{"type": typ, "text": text} for typ, text in accepted]
    receipt_path = WORKING / "derivation-progress.json"
    if receipt_path.exists():
        receipt = json.loads(receipt_path.read_text(encoding="utf-8"))
        if receipt["manifest"] != manifest:
            raise SystemExit("Current-run decision data changed after logging; append superseding memlog decisions and use a new full derivation revision.")
    else:
        receipt = {"manifest": manifest, "appended": 0, "last_ack": None}
        receipt_path.write_text(json.dumps(receipt, ensure_ascii=False, indent=2), encoding="utf-8")
    env = os.environ.copy()
    env["UV_CACHE_DIR"] = str(Path(env.get("TEMP", str(WORKING))) / "inquello-spec-uv-cache")
    for index in range(receipt["appended"], len(accepted)):
        typ, text = accepted[index]
        result = subprocess.run(["uv", "run", str(MEMLOG), "append", "--workspace", str(WORKSPACE), "--type", typ, "--text", text], capture_output=True, text=True, encoding="utf-8", env=env, check=True)
        receipt["appended"] = index + 1
        receipt["last_ack"] = json.loads(result.stdout)
        receipt_path.write_text(json.dumps(receipt, ensure_ascii=False, indent=2), encoding="utf-8")
    spec = render_spec()
    companion = render_companion()
    (WORKSPACE / "SPEC.md").write_text(spec, encoding="utf-8")
    (WORKSPACE / "scope-and-gates.md").write_text(companion, encoding="utf-8")
    capability_map = [{"id": f"CAP-{n}", "phase": phase, "p": p, "fr": [f"FR-{f}" for f in fr]} for n, _, phase, p, fr, *_ in CAPS]
    (WORKING / "capability-map.json").write_text(json.dumps(capability_map, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({"written": [str(WORKSPACE / "SPEC.md"), str(WORKSPACE / "scope-and-gates.md"), str(WORKING / "capability-map.json")], "new_log_records": len(accepted), "last_ack": receipt["last_ack"], "spec_words": len(re.findall(r"\S+", spec)), "capabilities": len(CAPS), "companions": len(ADOPTED) + 1, "status": "draft"}))

if __name__ == "__main__":
    main()
