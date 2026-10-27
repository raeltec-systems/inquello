---
id: SPEC-inquello
status: final
created: 2026-10-27
updated: 2026-10-27
companions:
  - scope-and-gates.md
  - glossary.md
  - ../../planning-artifacts/prds/prd-inquello-2026-10-26/prd.md
  - ../../planning-artifacts/prds/prd-inquello-2026-10-26/addendum.md
  - ../../planning-artifacts/ux-designs/ux-inquello-2026-10-26/DESIGN.md
  - ../../planning-artifacts/ux-designs/ux-inquello-2026-10-26/EXPERIENCE.md
  - ../../planning-artifacts/architecture/architecture-inquello-2026-10-26/ARCHITECTURE-SPINE.md
  - ../../../docs/addendum.md
  - ../../../docs/PRODUCT_BRIEF_TRACEABILITY.md
  - ../../../docs/CODEX_AUDITOR_FEATURE_MIRROR.md
  - ../../../docs/CODEX_AUDITOR_FEATURE_MAP.md
sources: []
---

> **Canonical contract.** Read this SPEC and every `companions:` file together. The complete scope and adopted decisions are retained; coherence and source-preservation validation passed. Document validation does not establish implementation or runtime acceptance.

# Inquello

## Why

Inquello brings the Codex-style working experience to internal audit, external audit, advisory and IT/IS audit: bring existing material, direct agent work, inspect and revise outputs, and continue in existing tools. The aim is lower total human effort through accepted delivery while preserving accuracy, traceability, confidentiality and judgment. One organisation's audit team supplies first validation; it does not narrow the eventual audience or mandate an Engagement for ad hoc Tasks. Vocabulary: [glossary](glossary.md).

## Capabilities

- **CAP-1** — Organise and recover work (V1)
  - **intent:** Organise, find and resume Engagements, folders, Tasks and concurrent work, including ad hoc Tasks outside any Engagement.
  - **success:** Reopened work retains permitted references, progress and artifacts; supplied client/period/Workspace and attention states remain visible without mandatory Engagement fields.

- **CAP-2** — Continue across access surfaces (V1)
  - **intent:** Start, inspect, steer and continue work through supported desktop, CLI/session, application-adjacent, mobile/remote and optional physical controls.
  - **success:** Surface changes preserve Task identity and authority; controls have declared observable outcomes, and unavailable actions or live-state access are explicit.

- **CAP-3** — Use environments and alternatives (V1)
  - **intent:** Choose approved working environments and compare and promote isolated alternatives while preserving originals.
  - **success:** Execution and inference locations are separately visible; origin and promotion history survive; concurrent edits are preserved, resolved or left unapplied.

- **CAP-4** — Direct scoped work (V1)
  - **intent:** Request, steer, interrupt, continue and resume permitted work, including long-running goals and background work.
  - **success:** Progress and input needs are visible; checked, unchecked and incomplete work differ; recovery exposes retained artifacts and applied effects without inventing rollback.

- **CAP-5** — Use attributable context (V1)
  - **intent:** Provide supported files, folders, documents, data, visuals, selections, annotations and application context.
  - **success:** Relied-on inputs retain origin/version, scope and limits; missing material, snapshot freshness and saved/live state are explicit; incomplete inputs never imply full Coverage.

- **CAP-6** — Produce checkable analysis (V1)
  - **intent:** Perform permitted calculations, queries, transformations, scripts, shell/code work and full-population or sample-based analysis under the chosen Method.
  - **success:** Known-result fixtures reconcile; inputs, parameters, derivations, exclusions, duplicates and actual Coverage are inspectable; changed inputs trigger recalculation or stale marking.

- **CAP-7** — Create and deliver editable artifacts (V1)
  - **intent:** Create, revise, inspect and externally continue supported spreadsheets, documents, presentations, datasets, scripts and visuals, including shared, published or hosted outputs.
  - **success:** Supported features and human edits survive round trips or conflict explicitly; destructive conversion limits are disclosed beforehand; audience and generated/published/verified states remain distinguishable.

- **CAP-8** — Research and use permitted interfaces (V1)
  - **intent:** Research attributable public/permitted sources and use supported browser, site and computer interactions.
  - **success:** Material claims retain references and labelled limits; acting account/destination and outcomes are identifiable; unavailable context and uncertain effects are disclosed.

- **CAP-9** — Review and investigate technical work (V1)
  - **intent:** Review, correct and recheck artifacts while retaining actual code/configuration, security analysis, scans/findings and focused specialist investigations.
  - **success:** Findings and source/script results retain evidence, provenance, uncertainty and revisions; eligibility and coverage limits are visible; agent review cannot grant human approval or closure.

- **CAP-10** — Teach and reuse methods (V1)
  - **intent:** Turn examples and instructions into reusable skills/Methods and distinguish maintained guidance, permitted departures, memory and policy.
  - **success:** Method/version/parameters, departures and missing dependencies are inspectable; changes identify affected outputs; shared guidance never silently absorbs case evidence or grants authority.

- **CAP-11** — Discover and extend tools (V1)
  - **intent:** Discover and use permitted built-in, connected, MCP, plugin/marketplace and supported hook, app-server and client-tool extensions.
  - **success:** Identity, dependencies and limits are visible; missing access differs from missing function; hook outcomes/enforcement and unsupported versions are observable.

- **CAP-12** — Run programmatic and continuous work (V1)
  - **intent:** Initiate supported batch/SDK/non-interactive work and bounded schedules/events with declared inputs, Method, identity, limits, destination and escalation.
  - **success:** Versioned structured results/streams are available where supported; actual Coverage and missing/unrun/incomplete/failed/no-exception outcomes differ; duplicates cannot cause uncontrolled repeated effects.

- **CAP-13** — Delegate and compare alternatives (V1)
  - **intent:** Delegate focused work, inspect and consolidate results, and explore side chats, forks and alternate analyses without losing origin.
  - **success:** Sources, disagreements, gaps and origins remain inspectable; writes are coordinated or isolated; alternatives remain distinct from accepted changes and human decisions.

- **CAP-14** — Control continuity and memory (V1)
  - **intent:** Resume and compact history while separately controlling memory contributions, memory use and permitted application/site activity recall.
  - **success:** Source/decision references remain accessible; missing context and changed access are visible; preferences, reusable knowledge and client evidence remain distinct under selected capture/use/revocation policy; recall never crosses Workspaces.

- **CAP-15** — Select routes and control consumption (V1)
  - **intent:** Use allowed models, gateways, local/service routes and available reasoning/speed choices while inspecting usage under configured limits.
  - **success:** Effective provider/deployment/capabilities and data flows are visible; unsupported operations never silently switch route; limits visibly stop/escalate and costs remain attributable.

- **CAP-16** — Retain convenience and scoped migration (V1)
  - **intent:** Use supported voice/dictation, notifications, optional companions, setup/history import and audience-scoped conversation snapshots.
  - **success:** Voice instructions are correctable; attention differs from completion; imports disclose losses; snapshots contain permitted selected content without silently transferring credentials or authority.

- **CAP-17** — Enforce authority and input trust (V1)
  - **intent:** Apply effective action permissions and distinguish authorised instructions from instructions embedded in evidence, pages, examples or tool results.
  - **success:** Negative permission and malicious-evidence cases preserve the mandate; approvals identify action/scope; broader/no-prompt modes require explicit permitted configuration and expose their limits.

- **CAP-18** — Assign responsibility and revoke access (V1)
  - **intent:** Assign human Task/review responsibility and manage access, reassignment and departures across retained work and unattended jobs.
  - **success:** Responsible humans and reviewed versions are identifiable; effective revocation prevents subsequent prohibited use; orphaned jobs and retained work receive explicit policy handling.

- **CAP-19** — Govern V1-held material (V1)
  - **intent:** Govern access, retention, deletion, export and recovery for working files/history, evidence references, logs and telemetry held by Inquello.
  - **success:** Held categories remain distinct from external authoritative records; export/recovery declares losses and respects access; usage counts never represent accepted work or Coverage.

- **CAP-20** — Support external-record practice (V1)
  - **intent:** Coordinate planning, procedures, evidence exchange, analysis, workpapers, review, reporting, responses, follow-up and approved stakeholder communication using artifacts and external systems.
  - **success:** External-audit, advisory and technical examples follow their Methods without mandatory control/deficiency objects; agent completion never professionally closes a Finding.

- **CAP-21** — Verify external delivery (V1)
  - **intent:** Inspect, authorise and verify bounded changes at a named external audit-record destination, with import/export fallback.
  - **success:** Current version and approved fields are checked; unrelated fields survive; stale/uncertain outcomes require reconciliation; operation identity and unsupported update/deduplication guarantees remain visible.

- **CAP-22** — Preserve coherent, inspectable work (V1)
  - **intent:** Continue across delegation, editors, environments and review with preserved Task/artifact identity, actual states and declared capability contracts.
  - **success:** Sources, Method and decisions remain accessible; changed evidence affects outputs/approvals visibly; produced, checked, reviewed, approved and attempted/confirmed/uncertain Delivery remain distinct.

- **CAP-23** — Govern native records (V2)
  - **intent:** Govern native audit-record retention, deletion, hold, amendment and recovery with attributable history.
  - **success:** Changes and retention decisions are identifiable; hold/deletion conflicts follow configured policy; recovery preserves records, relationships and history or declares limitations.

- **CAP-24** — Use native practice records (V2)
  - **intent:** Link practice workflows to native Engagements, procedures, Sources, workpapers, Findings, decisions, Responses, Actions and Retests.
  - **success:** Identities and relationships survive revision; human approval identifies person, scope and version; amendments identify affected prior approvals.

- **CAP-25** — Select and migrate record authority (V2)
  - **intent:** Select permitted record mode through Organisation/Workspace configuration and deliberately migrate to an identified destination.
  - **success:** Tasks/Engagements never silently switch authority; transferred records, artifacts, relationships/history and losses are identified and verified; operational systems remain separate.

## Constraints

- Preserve all P01–P22 groups, 41 V1 FRs, three V2 FRs, ten NFRs, eight journeys and the complete mapped inventory. The first increment and deferrals are chosen at story breakdown (OQ-10); deferrals remain unmet scope and cannot establish full parity. See [scope and gates](scope-and-gates.md).
- V1 uses supported working files and external authoritative audit records, including scheduled, approved unattended and continuous work. Only V2 adds native authority/lifecycle/migration; V2 foundations do not gate V1.
- Implement the adopted [Architecture Spine](../../planning-artifacts/architecture/architecture-inquello-2026-10-26/ARCHITECTURE-SPINE.md) AD-1–AD-14 and final [DESIGN](../../planning-artifacts/ux-designs/ux-inquello-2026-10-26/DESIGN.md)/[EXPERIENCE](../../planning-artifacts/ux-designs/ux-inquello-2026-10-26/EXPERIENCE.md) contracts. Detailed implementation, tokens, components and surface/state rules remain binding companions.
- Keep execution permission, local edits, agent checks, human review, Professional Approval and Delivery distinct. Formal V1 acceptance follows the designated external authority and actual Method; no universal extra sign-off applies to reversible actions.
- Retain attributable source/version, input scope, Method/version/parameters/departures, derivations, actual population/coverage and uncertainty. Relevant evidence, Method, policy or output changes stale affected decision applicability, even when output bytes do not change.
- Preserve supported saved-file identity, unrelated content and intervening human edits; distinguish saved, live and remote-record access. Disclose unsupported destructive conversions beforehand; resolve conflicts or leave changes unapplied.
- Before consequential external effects identify destination, acting identity, exact authorised change and relevant version under permission or a permitted mandate. Preserve operation identity, verify outcomes and reconcile uncertainty before retry; audit writeback grants no source-transaction authority.
- Accepted runs/effects remain bound to an immutable authorised mandate revision; changes are prospective unless explicitly rebound with authority/impact checks. Current revocation and restrictive policy apply; stopping or disabling future work never implies rollback.
- Enforce effective access across tools, evidence, delegation, memory, sharing, retained work and unattended jobs. Evidence instructions cannot expand authority; general agent tools cannot access protected domain/credential stores or confer human decisions through untrusted previews.
- Expose execution, inference, connector/browser, retained-file/history/log/backup and unattended routes separately. Preserve gateway/local-model, Bedrock, Azure Foundry/Azure OpenAI and GCP/Vertex scope without silent fallback or presumed service/policy eligibility; every documented route is tested, with eligibility verified per route before real data (OQ-9).
- Maintain separate Method authority, task-specific departures, memory contribution/use and activity recall. Memory and recall are shared across a Workspace's Engagements and clients and isolated between Workspaces; no silent case-to-team Method promotion. Actual policy determines distribution, retention and review rights.
- Keep missing, inaccessible, stale, blocked, partial, interrupted, failed and uncertain states visible; preserve usable work/drafts and disclose unsupported handoffs. No implied synchronisation, offline queue, automatic resend, cloud continuation or exactly-once guarantee.
- Demonstrate accessible core inspection and actions on declared clients without requiring code literacy. The selected visual/accessibility applications and AS-UX1–4 remain subject to rendered-host validation; actual operating targets and route readiness require their gates.

- Collaboration is Workspace audit-team and reviewer access with external exchange; no guest participation in V1.
- Retain references plus the extracts and derivations an analysis relied on, as Codex thread history does; never full source copies. Retained extracts are visible across a Workspace's Engagements.
- First validation ships the desktop client first, mirroring Codex clients, with Excel, Word, PowerPoint and CSV; no named external record system, import/export only. Operate at single-team scale with no service promises; availability, latency, recovery and accessibility targets follow first validation. The full target is unchanged.
- Method distribution, extension management and usage control inherit Codex mechanisms (Workspace/local/plugin skills, plugin marketplaces, MCP configuration, Agent Security managed policy; plan/workspace usage limits, model/reasoning/speed selection, usage inspection, enterprise analytics). No Inquello-specific catalogue, approval workflow or budget values for first validation; add only on usage evidence.
- Inquello owns identity and authorisation through its own auth module: Workspace membership, audit-team roles, Engagement membership and the differing internal-audit and external-audit models. Inference-provider sign-in (ChatGPT subscription, Claude, Azure, Bedrock, Vertex) only selects and authorises the inference route and never stands in for Inquello identity (OQ-14).
- V1 agent browser and sandbox are local: the built-in browser profile, Computer Use and OS sandbox enforcement inherited from Codex (OQ-13).

## Non-goals

- V1 native authoritative records; operational ledger/HR/transaction-source authority in either phase.
- A universal audit methodology, mandatory Engagement membership for Tasks, mandatory control/deficiency model, sampling rule, review hierarchy or workflow state machine.
- Equating agent completion, a generated report, a closed Task, Keep/Revert or a reviewer-agent role with assurance, Professional Approval or remediation.
- A hosted agent browser or hosted sandbox in V1. **Revisit in V2** (OQ-13).
- Presuming continuous two-way synchronisation or a guest portal as accepted baseline; these remain explicit choices rather than permanent prohibitions.
- Prioritising audit-universe/portfolio planning, staffing/capacity/budget suites, organisation-wide assurance mapping, quality-programme administration or a general workflow builder; ordinary Engagement planning/follow-up remain V1.
- Claiming proven demand, savings, final naming clearance, functioning prototype integrations or transferable hosted-service eligibility from document adoption.

## Success signal

- Demonstrate applicable A01–A18 and exact W1–W3/M1 outcomes for enabled routes, including same-file external edits, denial/revocation, interruption, conflict and uncertain Delivery. An internal audit team validates on task types it picks during validation planning, comparing matched task classes through human acceptance for total effort, traceability, cost and recovery; report wrong/missed results, correction burden, authority failures and artifact/effect loss, including failed/abandoned work and denominators. No runtime acceptance is claimed yet; numerical thresholds follow the first baseline.

## Assumptions

Inherited only; owners and revisit triggers remain in [scope and gates](scope-and-gates.md#inherited-assumptions).

- **AS-1:** Journey personas/scenarios are illustrative, not observed practitioner sessions.
- **AS-2:** Gate owners are proposed role assignments, not confirmed appointments.
- **AS-UX1:** S05–S13 placements are derived and require walkthroughs.
- **AS-UX2:** Responsive and secondary-client arrangements require content-fit validation.
- **AS-UX3:** Interaction completion remains unproved on actual hosts/integrations.
- **AS-UX4:** Existing-token accessibility applications require rendered-state checks.

## Open Questions

Existing decision gates, not blockers to adopting this contract; owners and exact triggers are in [scope and gates](scope-and-gates.md#open-product-gates). OQ-1 to OQ-10, OQ-13 and OQ-14 were decided 2026-10-27; see [decided gates](scope-and-gates.md#decided-gates).

- **OQ-11:** What V2 record precedence, lifecycle and migration policy applies?
- **OQ-12:** What name/brand clearance and final validation remain?
