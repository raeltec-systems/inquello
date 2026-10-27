---
title: Inquello architecture — coaching decision readiness
status: working-assessment
updated: 2026-10-27
sources:
  - input-product.md
  - input-ux.md
  - ../.memlog.md
---

# Coaching decision readiness

**One ownership/persistence coaching round remains useful at initiative altitude.** The next consequential choice is where Inquello's audit-domain rules and working metadata are owned across clients and execution paths. Shared Rust modules with a separate local SQLite working-metadata store are a reasonable proposal, but neither technology follows automatically from the adopted decisions. All recommendations in this note remain unadopted.

Sources: [product constraints](input-product.md), [UX constraints](input-ux.md), [decision chronology](../.memlog.md). The [upstream extract](upstream-architecture.md) supplies bounded evidence for Rust extension/facade seams and existing runtime JSONL/SQLite storage; it does not establish an Inquello domain store or hosted backends.

## Settled or inherited — carry forward without another choice

| Area | Current status |
| --- | --- |
| Foundation | **AD-1 adopted:** fork public `openai/codex`; inherit verified runtime/app-server contracts at an identified revision. The inspected commits remain evidence snapshots, not a selected implementation base. |
| Domain separation | **AD-2 adopted:** preserve runtime/app-server; evidence, Methods, review and audit-record semantics belong in separate Inquello modules, with focused core changes when needed. This has not selected their language, process, transport or storage. |
| Operating model | User directed translation of verified upstream operation. Local files belong to their execution host; desktop scheduled work has actual host/app availability limits. A generic new shared service was not adopted. Explicit remote/cloud routes retain their own context and eligibility. |
| Desktop client | **AD-3 adopted:** Electron with React/TypeScript. The supplied system governs appearance/behaviour; public source does not supply the complete Inquello UI. Older extracts saying no host/framework was selected are superseded on this point. |
| Product invariants | Preserve 41 V1 and three V2 FRs, all NFRs and eight journeys; V1 external record authority, V2 native authority; optional Assignment; same-file work; effective identity; separate permission/edit/review/approval/delivery meanings; truthful coverage and recovery. |

Earlier pending-question entries in the memlog are history. AD-2, the subsequent direct-inheritance direction and AD-3 establish their current outcomes; they are not contradictory open choices.

## Remaining cross-feature choice

| Decision axis | Why it matters now | Assessment of the proposed direction |
| --- | --- | --- |
| **Logical owner and implementation home for audit-domain mutations** | Method/version/departure recording, provenance, review attribution and external-operation reconciliation affect desktop, CLI/programmatic work, agents and automation. Independent implementations could disagree about authority or state. Assign a reusable owner and access contract before feature teams implement these rules. | Shared Rust Inquello modules fit the adopted Rust runtime/app-server and verified facade/extension seams. The recommendation adds a language choice; AD-2 alone did not choose it. React owns presentation and client interaction; Electron-specific lifecycle code should not be the only place domain rules exist. A TypeScript alternative could still work if the domain package and supported headless/client access are explicit; “Electron-only logic” by itself leaves those paths unresolved. |
| **Owner and authority of durable working metadata** | Resume/review/departure history and uncertain-effect reconciliation need retained identities, versions and operation outcomes. Upstream conversation history and its SQLite metadata mirror do not establish these audit semantics. Fix where that state belongs and who may mutate it. | A separate Inquello local SQLite store is a plausible bounded starting point for working metadata on the execution host. It does not by itself supply multi-user coordination, cross-device synchronisation, always-on execution or native authoritative records. Retain upstream runtime storage for its verified purpose; a custom runtime ThreadStore is a separate decision, not an automatic consequence. |

**Separate “shared code” from “shared data”.** Reusable Rust modules can give clients the same rules without creating a network service. A local database can retain host-owned working state without resolving team access or remote execution. Neither property should be represented as implementing the other.

If the user adopts the proposed bundle, its bounded meaning should cover the following existing needs:

- Audit modules own the relevant domain rules and mutation contracts; supported entry paths reuse them. The logical owner need not be a single process or deployment unit.
- Keep runtime Thread/Task association, source/artifact identity, Method/version/departure, human/scope/version attribution and operation/destination identity traceable. Record authority remains the designated external system in V1.
- Durable records required for review/resume/reconciliation have explicit persistence and recovery behaviour. Transient UI drafts keep their narrower UX guarantees; do not infer universal offline persistence.
- Concurrent file edits, parallel agents and repeated operations use an explicit comparison/conflict/reconciliation contract. A database transaction alone cannot prove an Office save or remote update succeeded.
- Current authority and relevant versions are checked at the applicable mutation boundary. A cached view, recorded rationale or prior execution approval cannot grant new permission; interruption does not imply rollback.
- Domain storage policy separates working metadata from source copies, artifacts, credentials, logs and runtime history. Selecting SQLite does not resolve what evidence may be retained, for how long or across which Assignments.

These are consequences already present in FR-6/8/20/24–28/33–43 and UX State Patterns/Authority and Delivery. They add no new approval step, audit workflow, record lifecycle or storage guarantee.

## Safe deferrals with owners and gates

Deferral here means leaving an implementation choice open at initiative altitude while retaining the required capability and dependency. It does not authorise removing V1 scope.

| Unresolved detail | Proposed owner and gate | What the initiative contract must still say |
| --- | --- | --- |
| Exact crate/package layout, app-server/extension/facade integration, wire methods and schema details | Architecture lead; verify against the selected upstream revision before dependent implementation stories. | Name logical domain ownership and reuse boundaries; avoid assuming a particular seam satisfies every mutation. |
| SQLite schema, migration/concurrency/recovery details, data placement and retention | Architecture lead with organisation data-policy owner; before durable ingestion and dependent mutations, under OQ-2/8/9. | Declare working-state scope/authority and persistent outcomes. Engine selection can be deferred explicitly if the user only settles ownership; it must not appear adopted meanwhile. |
| Team sharing/reviewer access, cross-host ownership, revocation and unavailable public collaboration backends | Product/audit leads with architecture/integration lead; OQ-1/6/9 before collaboration contracts and affected stories are committed. | FR-35/36, permitted sharing and client continuity remain required. Mark the supply route unresolved and assign fulfilment ownership; neither local SQLite nor upstream threads demonstrate shared collaboration. |
| Scheduler/trigger sources, unattended runner availability and remote/cloud backend supply | Architecture/integration lead with product/team administrator; OQ-5/6/8/9 before enabling or promising the route. | FR-23/24 remain V1. Preserve mandate/identity/limits/duplicates/recovery/ownership and host/context limits. Queue/heartbeat primitives are inputs, not proof of a complete production scheduler. |
| Provider/authentication eligibility, supported Office features and external record-system guarantees | Organisation policy/security owner with integration/architecture lead; OQ-6/9 before route selection or affected data use. | Keep full provider/client/technical breadth, declared capability limits, saved/live/remote distinctions and verified delivery; no silent route substitution. |
| Method distribution, recall/retained evidence, budgets, sizing and validation targets | Existing PRD OQ-2/3/4/5/7/8 owners at their recorded gates. | Keep policies configurable or explicitly unresolved; do not convert recommendations into defaults merely to finish architecture. |
| V2 native lifecycle/mode/migration, first release and package versions | V2 owners under OQ-11; product lead under OQ-10; implementation lead for version compatibility before seed/build. | V2 is not a V1 blocker; deferrals remain named unmet scope. Exact package versions are verified seed details, not another broad stack debate. |

Missing public collaboration or scheduling supply is **a required implementation dependency**, not an optional feature. At initiative altitude it can stay a named, owned gap with a gate. The architecture must not claim full implementation/parity or freeze dependent interfaces on an assumed absent backend. If a concrete invariant later requires shared coordination, raise that evidenced departure then; do not install a generic shared-service topology in advance.

## Smallest remaining coaching agenda

1. **Ask one clear ownership/persistence question:** whether to adopt shared Rust Inquello audit modules plus their separate local SQLite working-metadata store, retaining Electron/React for the desktop experience and upstream runtime storage for runtime continuity. Explain the two axes and the local-store limits above. An answer choosing the bundle settles both; an answer about language alone does not settle persistence.
2. **Ask a second question only if the first answer leaves a load-bearing state-owner choice unresolved.** Otherwise carry the named supply gaps and OQ gates into the initiative contract, with implementation owners and verification triggers. Do not restart a deployment/guest/provider/MVP questionnaire or ask the user to decide schemas and transport mechanics now.

No other documented contradiction currently requires a new top-level architecture choice. The final contract should distinguish adopted decisions, inherited requirements and open implementation dependencies; full V1 collaboration and automation remain visible throughout.

## Resolution — 2026-10-27

The user adopted the recommended bundle, recorded as **AD-4 [ADOPTED]** in the architecture memlog: shared Rust audit modules within the Codex fork, used by supported clients/jobs, plus a separate local SQLite store for Inquello working metadata. Electron owns the interface/application lifecycle; V1 formal audit-record authority remains external. No central server or V2 native authority was selected.

This resolves the remaining ownership/persistence coaching choice described above. The original reasoning and alternatives remain historical context, not current pending decisions. Concrete persistence, integration and supply-route details retain their recorded owners/gates. Distillation may now proceed, followed by source reconciliation and review; this resolution claims no implementation or test result.
