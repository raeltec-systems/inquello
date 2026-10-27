---
title: Inquello architecture input — product constraints
status: source-extract
created: 2026-10-26
sources:
  - ../../../prds/prd-inquello-2026-10-26/prd.md
  - ../../../prds/prd-inquello-2026-10-26/addendum.md
  - ../../../prds/prd-inquello-2026-10-26/.memlog.md
  - ../.memlog.md
---

# Inquello architecture input — product constraints

This is source extraction for the **Coaching** path, not an architecture draft, selected stack, topology or alternative. It starts from the PRD memlog and existing UX input extract, then verifies the relevant original PRD and companion passages. The latest user direction recorded in the [architecture memlog](../.memlog.md) settles the foundation: **fork the public `openai/codex` repository and inherit substantial architecture**. Do not reopen a greenfield-runtime choice. Inspect the actual upstream code before presenting major remaining choices, one at a time.

References below use **PRD** for [final prd.md](../../../prds/prd-inquello-2026-10-26/prd.md), **companion** for [final addendum.md](../../../prds/prd-inquello-2026-10-26/addendum.md), and their current line numbers. The [PRD memlog](../../../prds/prd-inquello-2026-10-26/.memlog.md) records accepted direction and downstream deferrals. Product concepts and the implications extracted here do not prescribe services, schemas or storage technology.

## Binding constraints

1. **Full scope remains binding.** There are 44 FRs: **41 V1; only FR-38, FR-40 and FR-42 V2**. All 10 NFRs apply to the relevant enabled capability and phase. The 22 P groups, eight journeys, 18 acceptance criteria, 79 C entries, 20 expanded behaviours, 270 subfeature mappings and 93 proposed enhancements remain source inputs; grouped requirements do not erase smaller capabilities. No initial release increment or narrower MVP is selected. A deferral stays explicit unmet scope (PRD 17, 75, 404–410).
2. **V1 uses supported working files and external authoritative audit records.** Local work/history, review assistance and evidence context remain necessary, but Inquello is not the native authoritative audit-record system. V2 adds its attributable record lifecycle and deliberate organisation/Workspace mode selection/migration. A Task/Assignment cannot silently change authority; operational ledgers, HR and source transactions remain separate in both phases (PRD 27, 62–70, 338–369, 416–420).
3. **Forking public Codex does not establish access to every desktop/hosted component.** The prior foundation study inspected commit `970111f6cb62cc02fe36a82ea7d71b37a2889c97`; it identified core/CLI, app-server and TypeScript SDK reuse candidates. The SDK wraps CLI execution and does not provide desktop UI. Reusable desktop UI and complete hosted connector/tool/scheduler implementations were not established. Current documentation can differ from that pinned snapshot. These are evidence limits to reconcile against actual source, not permission to drop capabilities or reopen the fork decision (companion 14–18; latest architecture memlog).
4. **Work is multi-surface and continuous.** Desktop, CLI/session, application-adjacent assistance, mobile/remote steering and optional physical controls retain the same Task identity and effective authority. Saved files, live application selections/unsaved state and remote records are distinct integration contracts. Same-file Excel/Word/PowerPoint continuation, supported feature fidelity, external-edit detection and conflict treatment are required (PRD 93–117, 165–168, 375–378, 448).
5. **Actual execution breadth survives audit adaptation.** Analysis, queries, scripts, shell/code orchestration, code/configuration/security investigations, browser/site/computer actions, generated/hosted outputs, extensions, SDK/batch work, parallel agents, alternatives, memory/recall and smaller interaction aids remain. Ordinary review need not require coding; this does not remove technical capability (PRD 147–201, 217–299).
6. **Execution and professional authority are separate.** Default work is scoped and user-started; broader/no-prompt and unattended modes need explicit permitted configuration. Tool permission, applied edits, agent review, human review, Professional Approval and actual external delivery cannot collapse into a single success state. No universal approval checkpoint, review hierarchy or audit Method is imposed (PRD 29, 68–70, 305–313, 319–322, 383).
7. **Methods and evidence have different authority.** Instructions, examples, skills, tools, agents, configuration and memory are retained mechanisms, not a selected workflow engine. Relevant Method/version, Task-specific departures and affected outputs must remain inspectable. Evidence/page/tool-result instructions cannot change the mandate; a skill, agent title or hook configuration does not itself confer access or prove enforcement (PRD 207–229, 310–313; companion 30, 57).
8. **Processing follows the organisation's actual policy.** Files, execution, inference, browser/connector traffic, history/logs, backups and unattended work are evaluated separately. Allowed models, organisational gateways, local-model routes and service identities retain Bedrock, Azure Foundry/Azure OpenAI and the named GCP/Vertex delta. Inclusion is not approval or universal compatibility; unsupported operations cannot silently change route. No exclusive provider, deployment, database, SSO or tenancy choice is selected (PRD 29, 277–285, 396, 450–452).
9. **Consequential mutations must be bounded and inspectable.** Retain source/input/artifact identity, applicable versions, action scope, acting identity, proposed/applied effects and verification. Preserve unrelated user edits/remote fields. Stale proposals and uncertain effects require comparison/reconciliation, not blind retries; cancellation is not rollback. Missing destination conditional-update/deduplication support must be disclosed with the appropriate review or export route (PRD 114–131, 361–364, 448; companion 18, 28).
10. **Evaluation remains unexecuted.** First validation uses one organisation's audit team without restricting the eventual internal/external audit, advisory or IT/IS market. Real participants, quantitative thresholds and operating commitments remain gates. Measure total effort through accepted delivery, traceable acceptance, cost and recovery alongside wrong/missed results, reviewer burden, authority failures and artifact loss (PRD 23–25, 427–442). Final planning documents do not approve rollout.

## All 44 FR dimensions

These are architecture-relevant consequences to preserve, not selected mechanisms. All rows are **V1 unless explicitly V2**. Exact FR names are retained; source locations cover the requirement and its consequences.

| Requirement | Contract or boundary to retain | PRD lines |
| --- | --- | --- |
| FR-1 — Organise work | Optional Assignments, folders, Tasks and concurrent workstreams; permitted references and supplied entity/client/period survive organisation changes. | 81–84 |
| FR-2 — Find and distinguish work | Access-aware search, pin/archive/reopen and retained progress/artifacts; archive is not authoritative deletion. | 86–89 |
| FR-3 — Access the same work through supported surfaces | Stable Task identity and effective authority across clients; declared capability limits. | 95–98 |
| FR-4 — Preserve session and context controls | CLI/session/context/physical controls have observable effects; saved-file access does not imply live unsaved-state access. | 100–103 |
| FR-5 — Make work location explicit | Approved local/isolated/remote execution is distinct from inference; source/artifact availability across environment changes is explicit. | 109–112 |
| FR-6 — Isolate and promote changes | Preserve origins and promotion history; compare alternatives, detect concurrent edits and resolve conflicts or leave unapplied. | 114–117 |
| FR-7 — Perform and explain scoped work | Plan where useful, execute, verify and expose progress/limits; parallel independent reads do not authorise unrelated effects. | 123–126 |
| FR-8 — Continue, interrupt and recover | Long-running/background work can be steered/interrupted/resumed; retained state and applied effects remain truthful. | 128–131 |
| FR-9 — Understand permitted material | Heterogeneous file/folder/document/data/image context retains origin/version/access/limits; missing inputs remain explicit. | 137–140 |
| FR-10 — Capture contextual input accurately | Selections, annotations and snapshots retain source association, saved/live scope and freshness. | 142–145 |
| FR-11 — Produce checkable analysis | Calculations/query/transformation/scripts/shell/code retain inputs, parameters, derivations, outputs/errors; changed inputs recalculate or mark stale. | 151–154 |
| FR-12 — Represent population and sampling honestly | Full-population/sample distinction, counts, exclusions, sampling parameters, duplicate treatment and examined Coverage remain inspectable under the chosen Method. | 156–159 |
| FR-13 — Create, edit and continue supported artifacts | Spreadsheets/documents/presentations/datasets/scripts/visuals remain editable saved files; supported features and unrelated external edits survive. | 165–168 |
| FR-14 — Generate and deliver visual or hosted outputs | Generated/edited visuals, shared/published/hosted output and verified delivery are distinct; audience/content/destination authority applies. | 170–173 |
| FR-15 — Research with attributable sources | Public/permitted research retains retrieval context and usable citations; retrieved text is not execution authority. | 179–182 |
| FR-16 — Use browser, site and computer actions | Acting account, destination, context limits and outcome are observable; browser visibility is not blanket permission. | 184–187 |
| FR-17 — Review, correct and recheck work | Evidence/scope/uncertainty/revision context survive correction; agent checking does not grant closure or Professional Approval. | 193–196 |
| FR-18 — Retain actual technical and security capabilities | Code/configuration/security analysis, scans/findings/backlog and follow-ups retain provenance and specialist/service eligibility limits. | 198–201 |
| FR-19 — Turn guidance into reusable work | Standing instructions, skills/templates/references/helpers and eligible demonstration-to-skill retain versions/dependencies; no unauthorised case-evidence promotion. | 207–210 |
| FR-20 — Preserve method authority and departures | Distinguish task guidance, maintained Methods, memory and policy; record Task departures against baseline/version; identify changed-Method impacts. | 212–215 |
| FR-21 — Discover and use permitted capabilities | Built-in tools, apps, MCP and plugin/marketplace packages expose identity/dependencies/permissions; installation is not credential grant. | 221–224 |
| FR-22 — Extend and integrate execution | Hooks, app-server and client-supplied tools have supported versioned contracts and observable failures/enforcement. | 226–229 |
| FR-23 — Run programmatic work | Batch/SDK/non-interactive work and structured streaming preserve Task identity, errors, Coverage and declared output contract under policy. | 235–238 |
| FR-24 — Run bounded schedules and events | Trigger/input/Method/identity/limits/destination/escalation are explicit; missing/unrun/partial/failed/no-exception outcomes and duplicate effects remain distinct. | 240–243 |
| FR-25 — Delegate and consolidate bounded work | Delegated source/scope and incomplete/disagreeing outputs remain visible; shared writes are coordinated or isolated. | 249–252 |
| FR-26 — Explore without losing origin | Side chats/forks/references/branches retain origin/context; consolidation cannot silently overwrite another agent or human. | 254–257 |
| FR-27 — Resume with scoped knowledge | History/compaction retain accessible references; memory contribution and use are controlled separately; preferences/reusable knowledge/client evidence stay distinct. | 263–266 |
| FR-28 — Control activity recall | Application/site capture and use are separate from history/Methods; original references, scope and revocation policy persist. | 268–271 |
| FR-29 — Use permitted processing routes | Allowed gateways/local models/named providers/service identities expose effective deployment and compatibility; execution/inference/connector flows stay distinct. | 277–280 |
| FR-30 — Control reasoning, speed and consumption | Available reasoning/speed selection, cost attribution and configured task/team limit enforcement with explicit stop/escalation. | 282–285 |
| FR-31 — Retain interaction and attention aids | Voice/dictation can be inspected/corrected; notifications and optional companions distinguish attention/run state from professional completion. | 291–294 |
| FR-32 — Migrate setup and share scoped snapshots | Report import content/losses and selected snapshot audience; no silent credential copy, access grant or authority-mode change. | 296–299 |
| FR-33 — Enforce effective action authority | Sandbox/permission profiles, command rules, approvals, managed policy and source identity govern action scope, including automatic-review/prompt-inspection/specialist limits. | 305–308 |
| FR-34 — Treat evidence as data | Trusted task/policy instructions remain distinct from instructions in Sources/pages/tool results/examples; no universal detection claim. | 310–313 |
| FR-35 — Assign work and human review | Actual human responsibility, Workspace/Assignment access and reviewed version are attributable; overlapping roles follow policy. | 319–322 |
| FR-36 — Reassign and revoke access | Effective revocation prevents subsequent prohibited use; retained work and unattended-job ownership are handled separately from membership. | 324–327 |
| FR-37 — Govern V1-held material | Working files/history/evidence references/logs/telemetry have applicable access/retention/deletion/export/recovery; losses explicit; not native record authority. | 333–336 |
| FR-38 — Govern native audit records — V2 | **V2:** attributable retention/deletion/hold/amendment/recovery preserves records, relationships/history or declares limitations. | 338–341 |
| FR-39 — Coordinate practice workflows using external records | Planning, procedures, evidence requests/receipt, analysis, workpapers, review/reporting/responses/follow-up and approved communications without a universal control schema. | 347–350 |
| FR-40 — Carry workflows through native records — V2 | **V2:** stable linked native records; human/scope/version approval; amendments identify affected prior approvals; no implied guest portal. | 352–355 |
| FR-41 — Review and verify external updates | Review destination/version/fields/evidence, authorise and verify; preserve unrelated fields; stale/unknown effects reconcile; import/export fallback remains. | 361–364 |
| FR-42 — Select and migrate record authority — V2 | **V2:** organisation/Workspace mode and verified migration retain record/artifact relationships/history and report losses; precedence is unresolved. | 366–369 |
| FR-43 — Preserve meaning across boundaries | Task/artifact identity, Sources, Method, decisions and actual status survive delegation/editors/environments/resume or disclose transfer gaps. | 375–378 |
| FR-44 — Make scope and completion claims inspectable | Capability Contracts and route-specific acceptance cover full inventory; execution/production/checks/review/approval/delivery are separate meanings, not a mandated global state machine. | 380–383 |

## All 10 quality dimensions

| Requirement | Architecture-relevant acceptance obligation | Source |
| --- | --- | --- |
| NFR-1 — Artifact fidelity | Supported feature/version round trips, intervening edits/conflicts and pre-destructive disclosure of unsupported macros/links/signatures/formulas/cache/revisions/charts/notes. | PRD 389 |
| NFR-2 — Analytical reliability | Known-result populations including boundaries/duplicates reconcile; retained permitted derivations support review; wrong/missed results and correction effort remain measurable. | PRD 390 |
| NFR-3 — Confidentiality and access | Negative tests span clients/Workspaces/Sources/delegation/memory/artifacts/sharing and ongoing/unattended revocation; folder labels do not prove isolation. | PRD 391 |
| NFR-4 — Recovery and duplicate effects | Cancel/resume/session loss/crash/events/stale/uncertain outcomes preserve usable work and applied effects without blind repeated delivery; recovery/loss targets remain open. | PRD 392 |
| NFR-5 — Usability and accessibility | Non-coders inspect progress/evidence/change/review; each declared client needs keyboard-accessible core actions and understandable states; conformance target remains OQ-8. | PRD 393 |
| NFR-6 — Performance and cost | Representative small/large workloads measure elapsed time, interruptions, tool/model/resource cost and total effort; visible limits; no invented latency/concurrency/budget values. | PRD 394 |
| NFR-7 — Evidence and decision provenance | Origin/version/input scope/Method/derivations/uncertainty/human decision and impact of changes remain accessible; external V1 versus attributed native V2 authority. | PRD 395 |
| NFR-8 — Processing transparency | Declared file/execution/inference/browser/connector/history/log/backup/unattended routes match observed routes; no silent substitution. | PRD 396 |
| NFR-9 — Portability and compatibility | Supported integration/client/provider versions and export/migration need reopen/reimport or equivalent outcome tests and declared losses. | PRD 397 |
| NFR-10 — Operational visibility | Operators/responsible users can distinguish absent triggers, partial/failing work, identity/access faults, uncertain delivery and recovery; diagnostics obey data policy. | PRD 398 |

## Ownership, authority and mutation implications

The internal team owns product scope/design; the organisation supplies its actual Method, data/access policy and review authority. Practitioner, human reviewer, lead, specialist and administrator/method-owner are responsibilities, not a hard-coded hierarchy; overlap follows policy (PRD 33–43, 446). Named appointments remain to be made.

| Boundary to preserve | Implication to carry into architecture choices |
| --- | --- |
| Task ownership versus execution identity | A person can request/review work while a permitted configured service identity executes it. Cross-client access, delegation, reassignment and departure must preserve effective authority and ownership; unattended jobs cannot continue under stale assumed permission. |
| Guidance versus enforcement | Task instructions, maintained Method/version, recorded departure, memory and effective policy remain separately identifiable. Record a departure without silently changing shared guidance or granting authority. |
| Source versus derived working material | Capture origin/version/scope/limitations and permitted derivations. Evidence-retention choices cannot be inferred from the need for provenance; decide them under OQ-2. |
| Saved file versus live app versus remote record | Each has its own supported state/version/access contract. A successful file save, UI action or transport response does not prove the other two changed. |
| Parallel/alternative work versus accepted content | Retain origin and compare/promote history; preserve concurrent edits or leave conflicts unapplied. No particular lock, merge, version-store or isolation implementation is selected. |
| Local edit versus human decision versus record acceptance | Keep proposal/applied file state, review and Professional Approval distinct. The latter identifies authorised human/scope/version and required record authority; changed relied-on content can affect prior approval. |
| External update versus uncertain effect | Preserve operation/destination identity, exact authorised fields and current-version check. Lost response after success requires reconciliation before retry. No universal exactly-once guarantee is assumed. |
| Cancel/resume versus rollback | Stopping future work does not erase existing file or external effects. Resume requires accessible retained context and rechecking relevant authority/version; missing context is explicit. |
| Access revocation versus deletion/retention | Prevent future prohibited use while separately addressing retained files/history/evidence/logs/backups and active jobs under policy. V2 record holds/amendments are not imported as V1 prerequisites. |

These are derived implications of FR-5/6/8/20/24–28/33–43 and companion 18/28/57; they do not select event sourcing, a database, transport, identity provider, tenancy or synchronisation engine.

## Source journeys and evaluation anchors

The eight exact source UJ names remain V1; Amina, Noah and Dev are illustrative, not observed participants (PRD 47–56). Preserve their existing flows in downstream tracing:

- UJ-1 — Amina answers an ad hoc question (source J1).
- UJ-2 — Amina and Noah carry an engagement through review (J2).
- UJ-3 — Amina continues a reconciliation in Excel (J3).
- UJ-4 — Amina and Noah revise a Word workpaper (J4).
- UJ-5 — Dev reconciles specialist investigations (J5).
- UJ-6 — Amina develops advisory options (J6).
- UJ-7 — Amina teaches and reuses a procedure (J7).
- UJ-8 — Noah follows a triggered procedure through (J8).

Architecture test seams should support the existing, unexecuted fixtures rather than invent narrower validation scope (companion 24–30): **W1** retains five ledger/six bank rows and duplicate identities, computes 4,600/4,750 and excess 150, then 4,700/4,750 and excess 50 after the saved R5 change; **W2** preserves review metadata/citations, prior-versus-later approval timing and effective policy version; **W3** retains all seven accounts, investigates A2/A5 without rejecting valid A6 or dropping permitted A7, then tests stale remote records, lost responses after success and revocation; **M1** distinguishes approved Method from hostile evidence instructions, missing dependencies and changed-method effects. A01–A18 stay binding; A11 separates V1/V2 and A12 is V2 only (companion 34–53).

## Open decisions, proposed owners and exact revisit gates

AS-2 makes these **proposed role assignments, not named appointments or consent**. Recommendations are not accepted defaults. Option analysis can proceed; affected commitments must respect the gate (PRD 464–479).

| ID | Unresolved choice | Proposed owner | Revisit gate |
| --- | --- | --- | --- |
| OQ-1 | Private sharing, audit-team/reviewer access with external exchange, or guest participation; team-only is a recommendation. | Product lead with audit lead | Before collaboration permissions and guest UX are committed; existing approved communications can be designed independently. |
| OQ-2 | References, necessary permitted extracts/derivations, or broader source copies; necessary extracts are a recommendation. | Audit method owner and organisation data-policy owner | Before evidence ingestion/retention design is fixed or real data is used. |
| OQ-3 | Isolation, approved reusable/carry-forward knowledge, or broader authorised retrieval; approved carry-forward is a recommendation. | Product lead and data-policy owner | Before enabling memory retrieval across Assignments/clients. |
| OQ-4 | File-based guidance, reviewed versioned packages, or managed catalogue; publishing rights, required approvals and reviewer roles. | Method owner with audit lead | Before shared Method rollout or approval workflows are committed; preserve Codex mechanisms in every option. |
| OQ-5 | Task limits, team-period budgets or both, with values/accounting/stop/escalation; both is a recommendation. | Product lead with team administrator | Before unattended work or usage commitments are enabled. |
| OQ-6 | Initial client/format/version/features and target record-system contracts, including conditional updates and result verification. | Product lead with integration/architecture lead | Before first-increment stories and compatibility promises are approved; full target remains unchanged. |
| OQ-7 | Team/examples/task classes/baselines/thresholds/acceptance owners. | Audit lead with product lead | Before practitioner validation or efficiency/reliability claims; synthetic fixture work may proceed. |
| OQ-8 | Workload scale, clients, availability/support, latency, recovery/loss tolerance and accessibility targets. | Product lead with design/operations leads | Before relevant architecture sizing, rollout or service promises. |
| OQ-9 | Actual policy and verified component/service/authentication routes across files/execution/inference/connectors/logs/backups/unattended work. | Organisation policy/security owner with architecture lead | Before selecting deployment/processing routes or using affected data; inclusion is not provider approval. |
| OQ-10 | First increment, dependency sequence and explicit deferrals with unmet acceptance. | Product lead | Before release-bound epic/story commitments; no implicit MVP cut. |
| OQ-11 | V2 organisation/Workspace precedence and native review/hold/amendment/retention/migration contracts; Workspace choice within organisation policy is a recommendation. | Product lead, audit lead and data-policy owner | Before native-mode architecture and implementation commitments; not a V1 blocker. |
| OQ-12 | Final visual identity/UX and name checks; Inquello is the working name. | Product/design lead | Before public brand commitments. Later user-selected visual source and final UX documents advance design input, not naming clearance or runtime acceptance. |

## Source conflicts, evidence limits and coaching questions

**No unresolved product-direction contradiction blocks architecture exploration.** The PRD says so at line 479. Do not manufacture one from breadth or unanswered downstream gates. The following distinctions prevent stale source language from becoming a new decision:

- The settled public Codex fork supersedes any reading of “candidate reusable components” as an open choice of overall foundation. Which exact upstream revision/components/services satisfy each inherited capability remains to be verified; the source study's pinned commit is evidence history, not the selected architecture baseline.
- Public source reuse, desktop UI availability, hosted service eligibility, authentication and model routing are separate. The full mirror target cannot be equated with automatically inheriting every service from the public repository.
- The companion's older exploratory-branding paragraph (line 61) predates the user's supplied design-system selection and final UX. It cannot displace those later inputs or settle name clearance.
- Stable provenance and review continuity do not themselves choose broad evidence retention, central storage, cross-Assignment memory or two-way synchronisation. Those choices remain gated.
- V1 needs real collaboration, saved-file consistency and external delivery semantics without becoming native audit-record authority. Native lifecycle design is V2; a general workflow engine and wider portfolio/staffing/quality suites remain unprioritised candidates (PRD 412).

Highest-leverage coaching questions, **unanswered and not ranked as a decided architecture sequence**:

1. **What actual organisation/data policy must the first supported environment satisfy?** Establish data classes, allowed storage/processing locations, service identities and provider/service eligibility before choosing execution/inference/connector/retention routes (OQ-2/OQ-9; owner policy/security plus architecture).
2. **Who needs to share, review, resume or steer the same work, from which clients?** Establish practical ownership, access/revocation and unattended-job responsibility without assuming guest participation, SSO, tenancy or a central/local topology (OQ-1/OQ-6/OQ-8).
3. **Which saved-file features and external audit-record contracts are first to be verified?** Name supported versions, read/write authority, version/concurrency checks and uncertain-outcome verification. Preserve the full target while selecting evidence for the first increment (OQ-6/OQ-10).
4. **Which supporting evidence, history, diagnostics and memory may be retained or reused?** Resolve permitted content/categories, retention/deletion/recovery and cross-Assignment boundaries before fixing ingestion and recall designs (OQ-2/OQ-3/OQ-8/OQ-9).
5. **What operating and cost bounds must scheduled/background work meet?** Establish business events, ownership, permitted runtime availability, duplicate/recovery behaviour and task/team limit policy before service or sizing commitments (OQ-5/OQ-8/OQ-9).
6. **How will the organisation maintain/review/distribute Methods and record permitted departures?** Preserve upstream instructions/skills/tools/agents and separate technical enforcement; determine actual publishing/reviewer authority without selecting a mandatory catalogue or workflow engine (OQ-4).

The coaching conversation should combine these answers with the separate actual-upstream-code extraction. This file has selected no stack, topology, provider, guest policy, evidence-retention default, release cut or native-record implementation.
