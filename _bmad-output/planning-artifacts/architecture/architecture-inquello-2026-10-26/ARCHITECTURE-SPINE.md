---
name: Inquello
type: architecture-spine
purpose: build-substrate
altitude: initiative
paradigm: Hybrid desktop/shared service with layered Rust domain ports and adapters
scope: Whole Inquello platform and consistency between its features
status: draft
created: 2026-10-27
updated: 2026-10-27
binds: [P01-P22, FR-1-FR-44, NFR-1-NFR-10, UJ-1-UJ-8]
sources:
  - ../../prds/prd-inquello-2026-10-26/prd.md
  - ../../prds/prd-inquello-2026-10-26/addendum.md
  - ../../ux-designs/ux-inquello-2026-10-26/DESIGN.md
  - ../../ux-designs/ux-inquello-2026-10-26/EXPERIENCE.md
  - .memlog.md
  - .working/upstream-architecture.md
  - .working/technology-evidence.md
companions:
  - reconcile-confirmed-decisions-2026-10-27.md
---

# Architecture Spine — Inquello

## Design Paradigm

**Layered modular Rust domain with ports and adapters**, surrounding the retained Codex engine/app-server and an Electron React/TypeScript desktop client. The adopted hybrid extends AD-1–4: local execution/files and domain working metadata coexist with a shared Inquello identity, permission and collaboration service (AD-15). Shared audit modules own consistent domain rules; adapters connect runtime, local persistence, the shared service, files and external systems; clients expose the supplied UX. No shared-service vendor or implementation stack is selected.

This initiative contract binds independently implemented features. The full target retains **41 V1 FRs and three V2 FRs (38, 40, 42)**, all applicable NFRs, eight source journeys and the PRD's detailed inventory. The prior final review is historical; this reconciliation is subject to a fresh gate recorded in reviews/reconciliation-2026-10-27.md. Open hybrid supply/protocol and external-audit-boundary decisions prevent a blanket readiness claim. Nothing here claims implemented capability, runtime validation or release approval.

Arrows below denote allowed dependencies; dashed arrows denote port implementation. The composition host wires implementations. Domain modules do not import Electron or concrete runtime/storage adapters.

```mermaid
flowchart TD
  UI[React renderer] --> PRE[Specific preload operations]
  PRE --> MAIN[Electron main]
  MAIN -->|owned child stdio| HOST[Forked app-server composition]
  OTHER[Supported CLI and job entry points] --> ENTRY[Shared Rust audit commands]
  HOST --> ENTRY
  ENTRY --> DOMAIN[Inquello domain rules]
  DOMAIN --> PORTS[Domain-owned ports]
  ADAPTERS[Inquello adapters] -. implement .-> PORTS
  HOST --> ADAPTERS
  ADAPTERS --> ENGINE[Retained Codex engine and APIs]
  ADAPTERS --> DB[Separate local working SQLite]
  ADAPTERS --> FILES[Saved files and supported live contexts]
  ADAPTERS --> EXT[Permitted external systems]
  ADAPTERS --> SERVICE[Shared Inquello identity grants and review coordination]
  SERVICE --> SHARED[Authorised version and context references]
  SERVICE --> MEMORY[Admitted team knowledge with access lineage]
  HOST --> ENGINE
```

## Invariants & Rules

AD-1–4 and AD-15–17 are user-adopted choices. AD-5–14 derive enforcement rules from those choices and the governing PRD/UX; their rationale and source accounting live in the [memlog](.memlog.md).

### AD-1 — Public Codex fork foundation [ADOPTED]

- **Binds:** All runtime-dependent features.
- **Prevents:** Independent replacement engines and an invented greenfield foundation.
- **Rule:** Derive Inquello from public `openai/codex`; inherit verified runtime/app-server contracts at an identified revision. Establish component availability and service eligibility per capability. The inspected source revision is evidence, not the silently selected delivery fork cut.

### AD-2 — Separate audit semantics from the agent runtime [ADOPTED]

- **Binds:** Evidence, Methods, review, records, runtime integration and upstream merges.
- **Prevents:** Runtime history or execution permission becoming professional authority, and scattered audit rewrites.
- **Rule:** Retain the Codex runtime/app-server; place audit-specific evidence, Methods, review and record logic in Inquello modules. Make focused core changes where needed. Module separation does not itself prescribe a process, transport or deployment boundary.

### AD-3 — Electron desktop with React/TypeScript [ADOPTED]

- **Binds:** Desktop client, bridge, visual-system implementation and packaging.
- **Prevents:** Incompatible frontend/native-host stacks across desktop features.
- **Rule:** Build the interface with Electron and React/TypeScript, retaining the forked runtime/app-server and supplied DESIGN/EXPERIENCE contract. This host choice assumes no reusable private OpenAI desktop source; AD-15 separately selects the shared-service boundary.

### AD-4 — Shared Rust audit modules and separate working SQLite [ADOPTED]

- **Binds:** Audit semantics, desktop, CLI and automated jobs.
- **Prevents:** Electron-only audit rules and competing writes into upstream runtime tables.
- **Rule:** Implement audit evidence, Methods, review and working records in shared Rust modules within the fork; all supported audit entry paths use them. Store Inquello working metadata in separate local SQLite. Electron owns interface/application lifecycle; V1 formal audit-record authority remains external. This store is not shared-service authority; AD-15 owns shared identity/permissions/coordination. Neither store confers native V2 record authority.

### AD-5 — Directed dependencies and constrained desktop privilege [DERIVED]

- **Binds:** Client, runtime integration, domain and adapters.
- **Prevents:** Privileged renderer operations and client-specific domain implementations.
- **Rule:** Follow the dependency diagram. Use sandboxed, context-isolated renderers without Node authority. Preload exposes specific operations; main validates payloads and senders, controls navigation/content boundaries, and owns the packaged Rust child and its stdio lifecycle. Expose no general IPC, shell or `child_process` bridge. Render source and artifact previews in a distinct sandboxed security context without the trusted workbench's preload/domain bridge, privileged-origin navigation or inherited authority. Preview content cannot submit human decisions; these require trusted workbench interaction and effective human authority. Match generated protocol schemas to the actual runtime version; keep stderr outside protocol output and handle initialization, backpressure, disconnect and shutdown explicitly.

### AD-6 — Stable work linkage and separate state authorities [DERIVED]

- **Binds:** Navigation, clients/jobs, provenance, review and delivery.
- **Prevents:** Conversation IDs, model claims or UI status becoming professional identity or acceptance.
- **Rule:** Keep stable Workspace, optional Engagement, Task, Source and Artifact identity with explicit runtime thread/turn/item/branch references and origin. The shared Inquello identity/authorisation service supplies authenticated acting/reviewer identity, membership and current permitted scope; the trusted host validates that scoped authority and fails closed for shared use when it cannot establish it. Model output cannot mint a human decision. Provider/connector credentials are not organisation review authority. Preserve separate run, artifact, checks, human-review, Professional Approval and delivery states with applicable scope/version. The shared domain owns a common reviewed-basis revision covering decision-relevant outputs, Sources/evidence, Method/departures and policy versions; review and delivery use that same reference. Retained historical decision attribution is immutable and distinct from current applicability. No universal audit state machine is imposed.

### AD-7 — Owned mutations and cross-store recovery [DERIVED]

- **Binds:** Working SQLite, runtime linkage, review/provenance and artifact operations.
- **Prevents:** Multiple writable authorities, direct tool mutation and false cross-store atomicity.
- **Rule:** Each Task/working record has one logical domain mutation owner. Local domain commands own private/local working state; the shared service owns membership, grants, shared coordination and registered/shared version references (technical publication, not Professional Approval). A published version is immutable; revision is a new version, not mutation of the submitted basis. Local replicas/caches are not independently writable shared authority. Domain commands validate authority, relevant expected versions and operation identity; the domain repository owns writes/migrations. Deny general agent tools and their subprocesses direct reads/writes of the protected domain store and privileged credential storage; expose permitted working records through scoped domain commands. Keep privileged credentials within trusted runtime credential facilities or adapters, allowing scoped authentication without exposing raw secrets to model context, arbitrary tools/subprocesses, artifacts, exports or logs. Enforce these boundaries in every enabled execution mode or gate that route. Agent-driven interactions cannot establish human reviewer decisions. Persist required intent/outcomes. Across SQLite, runtime history and files, reconcile using supported IDs/status or expose uncertain/unlinked work; never blindly replay thread creation or claim a shared transaction. Cross-host ownership/version transfer must be explicit and verified; otherwise that route remains gated, without independently writable replicas or implied synchronisation.

### AD-8 — Scoped context, permission and processing routes [DERIVED]

- **Binds:** Sources, tools, delegation, models, clients and retained data.
- **Prevents:** Evidence instructions, installation or route changes expanding authority.
- **Rule:** Separate trusted instructions from evidence; retain source origin/version, saved/live scope and access limits. Recheck relevant authority on use, resume and mutation; effective revocation covers active/unattended work. Distinguish execution, inference, browser/connector traffic, files, history/logs, backups and unattended routes. No silent fallback, credential grant from plugin discovery or permission grant from a Method. Preserve gateway/local-model, Bedrock, Azure Foundry/Azure OpenAI and GCP/Vertex scope with route-specific eligibility and capability limits.

### AD-9 — Artifact identity and conflict-preserving changes [DERIVED]

- **Binds:** Analysis, supported editors/files, alternatives and specialist work.
- **Prevents:** Stale overwrites, lost supported content and assumed live-state access.
- **Rule:** Preserve the same supported saved files and unrelated content; distinguish live application and remote-record access. Compare relevant versions before replacement; preserve intervening edits or leave conflicts unapplied. Promote alternatives deliberately with origin history. Retain input/Method/derivation, population, exclusions, duplicate treatment, applicable sampling parameters and actual coverage. Changed inputs recompute or mark affected results stale. Changes to the reviewed basis mark affected decisions' applicability stale; resolve applicability under the actual Method/policy before relying on or delivering affected work. Preserve the historical decision and external authority. Unsupported conversions are disclosed before destructive change.

### AD-10 — Method departures and knowledge boundaries [DERIVED]

- **Binds:** Reusable guidance, analysis/review, history and memory.
- **Prevents:** Case evidence or model memory becoming maintained Method or enforced policy.
- **Rule:** Retain Method/version/parameters and permitted Task-specific departures, rationale and affected scope separately from shared-guidance changes. Expose them with relied-on outputs and identify changed-Method/evidence impacts. Keep memory contribution, memory use, history and optional activity capture/recall distinct under policy. Denied departures remain unapplied; no silent case-to-team Method promotion. Team-wide institutional recall follows AD-16 admission and current access, not unconditional visibility of retained extracts. It is isolated between company Workspaces; external-audit client boundaries remain OQ-15. Preserve instructions, skills, tools, agents and eligible demonstration-to-skill mechanisms without imposing a general workflow engine.

### AD-11 — Bounded external effects and reconciliation [DERIVED]

- **Binds:** Connector/browser/computer actions, publication, sharing and delivery.
- **Prevents:** Repeated effects, unrelated-field mutation and false delivery confirmation.
- **Rule:** Retain operation/destination/acting identity, exact authorised content and relevant version before attempting effects. Apply configured permission or a permitted preauthorised mandate bound under AD-12; execute through the supported adapter and verify the destination. Record attempted/confirmed/uncertain outcomes. Stale proposals return to review; uncertain effects reconcile before retry. Retain logical operation identity, use destination conditional-update/deduplication support where available and disclose its absence. Do not invent upstream idempotency or exactly-once guarantees. Keep import/export fallback; audit writeback grants no source-transaction authority.

### AD-12 — Automation mandates and collaboration ownership [DERIVED]

- **Binds:** Schedules/events, programmatic work, team review, remote clients and reassignment.
- **Prevents:** Local SQLite or runtime primitives being mistaken for complete shared backends.
- **Rule:** Retain trigger/input/Method/identity/limits/destination/escalation mandates and actual event/run outcomes. Each accepted run and its effects bind to one immutable authorised mandate revision. Configuration changes apply prospectively unless a trusted, explicit domain rebind records the authority and impact checks for running work. Current revocation and restrictive policy always apply. Disabling changes future eligibility; handle running work separately. Enforce ownership/revocation and duplicate-effect controls across supported entry paths using shared domain rules. Observe execution-host/context availability; never assume automatic cloud continuation. Scheduler, team-coordination and hosted-route gaps remain required V1 implementation dependencies with the owners/gates below. AD-15 selects the shared-service responsibility boundary; its implementation and the scheduler supply remain unproven. Basic sharing revocation is mandatory before first team enablement; advanced unattended-job reassignment can follow with automation.

### AD-13 — Phase-specific record authority [DERIVED]

- **Binds:** V1 review/delivery and V2 records/migration.
- **Prevents:** Local metadata, agent completion or silent mode changes conferring formal authority.
- **Rule:** V1 retains useful local working/review records and links any Method-required formal acceptance to verified designated external authority. Preserve authorised human/scope/version attribution and affected approvals. V1-held files, histories, extracts, derived knowledge and shared coordination still require access, retention/deletion and recovery controls for enabled routes. Only V2 adds FR-38/40/42 native authoritative record identity, relationships, lifecycle, hold/amendment/retention, recovery/export and deliberate organisation/Workspace migration. Tasks/Engagements cannot silently change authority; operational source systems remain separate. V2 policy is not a V1 gate.

### AD-14 — Capability evidence and operating commitments [DERIVED]

- **Binds:** All features, operations and release claims.
- **Prevents:** Silent scope cuts, invented service guarantees and activity counts labelled assurance.
- **Rule:** Each enabled route declares owner, actual implementation/service supply, identity/processing/source limits, versions and capability-specific acceptance. Keep missing/partial/failed/uncertain outcomes, diagnostics, recovery and cost evidence inspectable under data policy. Select workload, support, accessibility, budget and recovery commitments at their gates. Deferred or unverified requirements remain unmet scope; a smaller shipping increment cannot claim full parity.

### AD-15 — Hybrid authority and explicit private-to-shared handoff [ADOPTED]

- **Binds:** Desktop/files, Inquello identity, Workspace memberships, permissions, shared work and review coordination.
- **Prevents:** Provider sign-in becoming team identity; local stores posing as shared authority; implicit conversation disclosure and inaccessible handoffs.
- **Rule:** Desktop executes agents and holds local working files; a shared Inquello service owns its own authenticated identities, memberships, grants and shared coordination. Provider sign-in remains separate. Tasks are creator-private by default. Grant file/folder/review-package access independently of conversation/history; whole-Task access requires explicit sharing. Every shared operation binds Workspace, actor, object, immutable version or declared folder scope, recipient/audience and permissions. Sharing selected artifacts/context is deliberate, not automatic upload of all sources. A recipient must actually access the authorised artifact version and relied-on evidence/Method/coverage context through a permitted transfer or materialisation route; sender-local paths alone never satisfy a handoff. Missing/inaccessible/version-mismatched context is blocked or partial, not silently substituted. Shared requests validate current authority and expected revision at the service; local caches cannot grant access. Detailed protocol, service stack and materialisation route remain OQ-16 gates.

### AD-16 — Team-wide knowledge admission and basic revocation [ADOPTED]

- **Binds:** Sharing, retained extracts/derivations, memory/indexing, retrieval, active agents and retained-data recovery.
- **Prevents:** Personal-only institutional knowledge; private work leaking to the team; revoked data surviving in derived recall or across company boundaries.
- **Rule:** Within an internal-audit company Workspace, formally issued or explicitly team-shared work is automatically eligible for shared knowledge admission, including ongoing shared work; private exploratory drafts and conversations are excluded. Admission is distinct from generic contribution/use controls: those controls cannot broaden eligibility or create a grant. This supersedes unconditional Workspace visibility of all retained extracts under earlier OQ-2/OQ-3 language. Knowledge preserves source/version, originating engagement, period, finding/status history and changes, admission basis and access lineage; historical recall aids investigation and is not evidence of a current or repeat finding. Current grants apply on every retrieval and use; no cross-company Workspace leakage. Workspace removal blocks subsequent shared retrieval/recall. Share withdrawal removes that route unless another current valid grant covers the exact content/action. Active agents cease revoked use and dependent actions; revocation reaches task context, caches, indices, summaries and other derived knowledge, including restored state, so these cannot re-expose prohibited content. If current access or derived lineage is unprovable, block shared recall/use. Basic enforcement and necessary retained-data controls ship before first team enablement, not with later automation. Already downloaded/exported copies cannot be magically recalled. Advanced unattended-job reassignment remains with automation. External-audit client/independence boundaries require OQ-15 before enabling those routes.

### AD-17 — Private reviewer-agent work and versioned human handoff [ADOPTED]

- **Binds:** Review Tasks, submitted artifacts, evidence access, review notes, revision and recheck.
- **Prevents:** Manual-dashboard-only review; automatic disclosure of private reviewer reasoning; silent submitted-artifact edits and agent agreement masquerading as independence.
- **Rule:** Reviewer creates a private Task anchored to the immutable submitted version and common reviewed-basis revision. With permitted accessible evidence, the agent uses tools to recalculate/reperform, inspect Method and actual coverage, challenge conclusions and contradictory evidence, and compare admitted historical findings. It drafts notes precisely anchored to artifact/version/location or scoped evidence/Method/coverage. The human chooses notes to issue; private conversation and unissued notes stay private unless explicitly shared. Preparer-agent revisions produce a new version with a handoff summary identifying changes, supporting basis, resolved/unresolved notes and exact known impact. Reviewer agent rechecks changed and impacted work; uncertain impact widens the recheck and never certifies untouched scope as unchanged. No agent silently mutates the submitted artifact or professionally accepts work. Human acceptance remains attributable to person/scope/version under Method and V1 external authority; agent agreement does not establish professional independence.

## Consistency Conventions

| Concern | Convention |
| --- | --- |
| Vocabulary and identifiers | Retain PRD concepts and practice-specific labels; identifiers stay stable and scope-qualified across client/runtime/destination references. Exact formats and schema names belong to implementation. |
| Events and outcomes | Runtime events describe runtime facts; domain commands establish permitted domain outcomes. Errors retain operation identity, known applied effects and recovery status. A UI toast, completed turn or green chip establishes no acceptance. |
| Continuity | Preserve confirmed saved work and accessible review/context references; transient draft retention follows UX guarantees. No universal offline, queued-write, reconnect-resend or rollback promise. |

## Stack

Historical cold-start seeds retained from [technology evidence](.working/technology-evidence.md); this update makes no fresh-current version claim or new stack choice. Code/lockfiles own the detail once implementation exists. Reverify against primary sources and the selected fork before dependent implementation. No install/build has validated the combined stack.

| Name | Version |
| --- | --- |
| Electron | 45.0.0 |
| React | 19.3.1 |
| TypeScript | 5.9.2 |
| Rust | 1.99.1, edition 2024 |
| pnpm | 10.34.5 |

TypeScript 5.9.2 is the inspected locked baseline, not a claim that it is the newest compiler. SQLite is adopted; its driver/runtime revision is a persistence implementation gate. Source pin `970111f6cb62cc02fe36a82ea7d71b37a2889c97` and inspected main `efab30992b28bb8fc5064dbac9c12090b8818e98` are evidence snapshots. Select the actual fork cut and verify API/toolchain compatibility before implementation; source availability does not establish hosted-service entitlement. Current documentation calls the app-server command and WebSocket transport experimental/unsupported for production in its remote Code Mode host section. Default stdio availability establishes neither blanket production support nor Inquello readiness; verify and harden the selected fork/route before release.

Verify the domain store's resolved SQLite runtime includes the WAL-reset corruption fix (3.51.3+ or a documented fixed backport); the inspected upstream check does not verify a separately linked driver. Evidence is recorded in the [technology review](reviews/review-technology.md).

## Structural Seed and Operating Envelope

Cold-start package names below are seed, not mandatory permanent directories or separate services. Preserve verified upstream ownership; use demonstrated extension/facade seams before focused core changes.

```text
fork/
  codex-rs/
    core/, core-api/, app-server/, ext/   retained runtime and integration seams
    rollout/, state/, thread-store/      retained runtime continuity
    inquello-domain/                     audit commands, rules and ports
    inquello-adapters/                   runtime, SQLite, file and external adapters
  desktop/                              Electron main/preload and React interface
```

The separate domain store owns working metadata; saved artifacts remain in their supported file locations; upstream JSONL/SQLite retain runtime responsibilities. Physical data paths, migrations and adapter package splits require implementation verification. AD-15 selects logical shared-service ownership without choosing vendor, region, spend, server language, datastore or transport. The local SQLite store is not replicated as shared authority.

| Envelope / supply gap | Required contract and owner/gate |
| --- | --- |
| Local desktop | Main manages the local runtime child; local sources remain tied to that host. Scheduled work needing those files observes actual computer/app availability. Loss of host/connection exposes unavailable or interrupted work, not cloud completion. |
| Scheduler/event supply | Architecture/integration lead with team administrator owns the missing production trigger/scheduler/mandate route. OQ-5/6/8/9 are decided (2026-10-27); the missing production route still gates enablement and promises. Queue/heartbeat support alone is insufficient; FR-23/24 remain V1. |
| Team coordination and cross-host work | Product/audit leads with architecture/integration lead are proposed owners of the AD-15 shared-service route. Identity, grants and coordination authority are decided; interoperable protocol, accessible artifact/context materialisation, current-access invalidation and recovery remain OQ-16 implementation/data-controls. Local threads/SQLite alone do not implement FR-35/36. First team enablement requires AD-16 basic revocation, not later automation. |
| Remote execution and connected services | Architecture/integration lead with organisation policy/security owner names the actual service, identity, context and provider eligibility before use under OQ-6/9. No inferred hosted backend, automatic local-to-cloud handoff or fully local inference. |
| Environments and operations | Product/design/operations leads with policy owner set workload, availability/support, recovery/loss, deployment/data eligibility and retention under OQ-2/8/9. Synthetic fixtures may proceed; real-data and production promises wait for their gates. Collect total effort, costs, recovery and quality counter-metrics, not token/run counts as assurance. |

## Capability → Architecture Map

All 22 source groups and 44 FRs remain; locations are logical responsibilities. **V2 is marked per FR, not per whole group.** UJ-1–8 retain their final EXPERIENCE flows. The original detailed inventory and W1–W3/M1 fixtures remain governing, unexecuted acceptance inputs.

| Capability / FRs | Lives in | Governed by; quality references |
| --- | --- | --- |
| P01 Workspace/navigation; FR-1–2 | Client navigation, domain identity, runtime references | AD-6/8; NFR-3/5/7 |
| P02 Access surfaces; FR-3–4 | Desktop/CLI/context/remote/physical adapters | AD-3/5/6/9/12; NFR-5/9 |
| P03 Environments/alternatives; FR-5–6 | Runtime/environment and artifact adapters | AD-7/8/9; NFR-1/4/8 |
| P04 Task lifecycle; FR-7–8 | Codex engine, domain linkage, client progress | AD-1/6/7/14; NFR-4/6/10 |
| P05 Rich context; FR-9–10 | Source/live-context adapters, provenance | AD-6/8/9; NFR-3/7 |
| P06 Executable analysis; FR-11–12 | Runtime tools, analysis provenance | AD-8/9; NFR-2/7 |
| P07 Artifacts/publishing; FR-13–14 | File/visual/publication adapters, domain operations | AD-9/11; NFR-1/4/9 |
| P08 Research/application actions; FR-15–16 | Web/browser/site/computer adapters | AD-8/11; NFR-3/7/8 |
| P09 Review/technical investigation; FR-17–18 | Private reviewer Tasks and domain review; actual tool-driven reperformance and technical tools | AD-6/8/9/13/17; NFR-2/3/7 |
| P10 Reusable Methods; FR-19–20 | Rust Method/departure rules, inherited skills/instructions | AD-4/8/10; NFR-3/7 |
| P11 Extensible tools; FR-21–22 | Verified extension/MCP/plugin/hook/app-server seams | AD-2/5/8; NFR-3/8/9 |
| P12 Programmatic/continuous work; FR-23–24 | CLI/SDK/job adapters; required scheduler supply | AD-7/11/12/14; NFR-4/6/10 |
| P13 Delegation/alternatives; FR-25–26 | Codex subagents/branches, domain origins and promotion | AD-6/7/8/9; NFR-3/4/7 |
| P14 History/memory; FR-27–28 | Runtime continuity; admitted team memory/activity adapters | AD-7/8/10/16; NFR-3/7/8 |
| P15 Models/routes/usage; FR-29–30 | Provider/policy and consumption adapters | AD-8/12/14; NFR-6/8/9 |
| P16 Convenience/migration; FR-31–32 | Voice, notifications, companions, import/snapshot adapters | AD-6/8/11; NFR-3/5/9 |
| P17 Permissions/input trust; FR-33–34 | Runtime sandbox plus domain authority boundaries | AD-5/7/8/10; NFR-3/7/8 |
| P18 Human collaboration; FR-35–36 | Shared-service grants/coordination, domain attribution/revocation, private review | AD-6/7/12/13/15–17; NFR-3/7/10 |
| P19 Retention/visibility; FR-37 V1, FR-38 V2 | Working-store policy; native lifecycle only in V2 | AD-7/8/13/14; NFR-3/4/10 |
| P20 Practice workflows; FR-39 V1, FR-40 V2 | Domain Methods/review, external adapters; V2 records | AD-6/10/11/13; NFR-5/7 |
| P21 Delivery/record mode; FR-41 V1, FR-42 V2 | External-operation owner; V2 mode/migration | AD-7/11/13; NFR-4/7/9 |
| P22 Coherent experience; FR-43–44 | Shared identity/state/capability contracts across all paths | AD-5–17; NFR-1–10 |

## Deferred

Open choices retain proposed role owners, not named appointments. Rows marked decided 2026-10-27 record the product owner's decision from spec review; the remaining rows still prevent affected commitments. No new product policy is inferred from this contract.

| Gate | Owner; revisit trigger | Decision, or what remains open |
| --- | --- | --- |
| OQ-1 | Product lead with audit lead; decided 2026-10-27 | Team-only participation: Workspace audit-team and reviewer access with external exchange; no guest participation in V1. |
| OQ-2 | Method owner and organisation data-policy owner; decided 2026-10-27 | Retain references plus relied-on extracts/derivations; no blanket full-source capture/upload. Retention alone never makes content shared. Deliberate authorised artifact/context handoff under AD-15 is distinct from automatic source retention; admitted team memory follows AD-16. |
| OQ-3 | Product/data-policy owners; decided 2026-10-27 | Superseded in part by AD-16: team-wide recall across engagements/auditors in the same internal-audit company Workspace, only for formally issued or explicitly team-shared eligible work and current access. Private work excluded; external-client/independence details remain OQ-15. |
| OQ-4 | Method owner with audit lead; decided 2026-10-27 | Inherit Codex mechanisms (Workspace/local/plugin skills, marketplaces, MCP configuration, Agent Security managed policy); no managed catalogue or approval workflow for first validation. |
| OQ-5 | Product lead/team administrator; decided 2026-10-27 | Inherit Codex usage handling; no Inquello budget values for first validation. |
| OQ-6 | Product/integration/architecture leads; decided 2026-10-27 | Desktop first mirroring Codex clients; Excel, Word, PowerPoint, CSV; no named record system for first validation, import/export only. Full target unchanged. |
| OQ-7 | Audit/product leads; decided 2026-10-27, thresholds once a baseline exists | An internal audit team validates on task types it picks during validation planning; no numeric thresholds until a baseline exists. |
| OQ-8 | Product/design/operations leads; decided 2026-10-27, revisit after first validation | Single-team scale, no service promises; workload, accessibility, latency, availability, recovery and loss tolerances set after first validation. |
| OQ-9 | Organisation policy/security owner with architecture lead; decided 2026-10-27 | All documented routes stay in scope and must be tested; none presumed approved. Eligibility verified per route before real data uses it. |
| OQ-10 | Product lead; decided 2026-10-27 | Sequencing, first increment and explicit deferrals are decided at story breakdown and recorded there; full target unchanged. |
| OQ-11 | Product/audit/data-policy leads; before native-mode commitments | V2 mode precedence, lifecycle, review/hold/amendment/retention and migration; not a V1 blocker. |
| OQ-12 | Product/design lead; before public brand commitments | Name clearance and final validation; supplied visual source and final UX remain selected inputs. |
| OQ-13 | Product lead with architecture lead; decided 2026-10-27, revisit at V2 planning | Agent browser and sandbox are local in V1 (built-in browser profile, Computer Use, OS sandbox); hosted browser/sandbox deferred to V2. |
| OQ-14 | Product lead with architecture and security leads; decided 2026-10-27, module design pending | Inquello owns identity/authorisation via its own auth module (Workspace membership, audit-team roles, Engagement membership, internal vs external audit models). Provider sign-in only selects the inference route. Supersedes reliance on trusted host/policy context as identity source; AD-15 now places shared identity/membership/permission authority in the Inquello service, with local execution/files retained. Claude route reachability to be confirmed. |
| AS-UX1/2 | Design with practitioner/reviewer and client/architecture leads; before layouts/client commitments | Validate derived placements and responsive arrangements; four imported references/nine written surfaces are not runtime evidence. |
| AS-UX3/4 | Design/implementation/accessibility reviewers; before supported-interaction/shipping claims | Verify handlers, focus, recovery, rendered contrast and targets on actual clients. |
| OQ-16 shared-service implementation | Architecture/integration and security leads (proposed); before dependent implementation | Resolve authentication/session, permission version/invalidation and client/service protocol, shared persistence, accessible version/context transfer and recovery topology. Vendor, region, spend and service stack are unselected; do not infer approval. |
| OQ-16 (data-controls subgate) | Organisation policy/security and operations leads (proposed); before real shared data | Select actual hosting/operator/region and processing eligibility; validate revocation, derived-data retention/deletion, backups/restore and recovery for enabled V1 routes. No new V2 native lifecycle implied. |
| OQ-15 external-audit boundaries | Audit/independence and data-policy leads (proposed); before external-audit shared recall | Resolve client confidentiality/independence, team/Engagement and item grants. Internal-company Workspace memory is not silently generalised across external clients. |
| Implementation seed | Architecture/implementation leads; before dependent code | Delivery fork cut, concrete facade/extension/protocol seams, compiler/package/SQLite-driver compatibility, schema/migrations, conflict mechanics, secure data paths, packaging/update and ownership-transfer contracts. The AD ownership/direction rules remain fixed. |

Detailed code layout can wait for implementation; shared authority, dependency direction and mutation ownership cannot vary by feature. The relevant OQ-16 interoperable protocol/schema and authentication/revocation contracts must resolve before their dependent service stories, not after conflicting implementations exist. These gates need not block unrelated synthetic local-foundation work, but that work cannot claim team capability. The named V1 supply gaps remain owned delivery work until implemented and verified.

## Dependency and delivery evidence

Epics must preserve the full target with explicit old-to-new story traceability while removing forward dependencies. Shared identity/grants, accessible version/context handoff, basic revocation and necessary held-data controls precede first team-enabled review/recall. Advanced unattended-job reassignment follows with automation; it cannot delay basic removal/withdrawal enforcement. A local workbook analysis → same-file Excel edit → recomputation → accessible human/agent review → export checkpoint proves an end-to-end engineering path, not a restriction on practitioner-selected validation task types or eventual product breadth. No checkpoint has executed.
