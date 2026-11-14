---
title: Current course-correction planning readiness
date: 2026-11-05
status: planning-direction-applied-not-runtime-or-release-ready
---
# Scoped readiness after the approved course correction

## Assessment
The approved direction is now mapped to current requirements, story/acceptance and semantic dependencies: source-backed organisational setup, risk-based coverage planning, engagement work, review/report, management-action follow-up and a supported recurring check. Every compatible Codex capability/model route remains V1, except the explicitly retained V2 native-record and hosted-browser/sandbox-revisit boundaries and the PRFAQ's named product exclusions.

This is **not a new global implementation-ready PASS**. Detail specifications and existing owner/runtime gates remain open. The 27 October implementation-readiness and validation documents are unchanged historical assessments, not assessments of this amendment or the current build.

## Document-level evidence
- Canonical story IDs: historical 139; current epics 141 with 6.6/6.7; 142 unique including separately retained owner-approved 1.31.
- All 382 pre-amendment canonical AC IDs/text preserved; 25 additive ACs produce 407. The original 372 count is historical, not the actual pre-amendment count with later conformance additions.
- Frozen Epic 1 full section SHA256: b8a23bda37cfb45f54e43479eeab90609d7e6deb3271a6bde1ef4afa938a0bca. Every existing tracker status remains unchanged, including 1.31. No story files were edited.
- Added backlog entries explicitly identify current lifecycle dependencies, never code or test completion. Earlier scope/traceability/readiness files were not regenerated.
- Current mappings: [scope/dependencies](epic-scope-and-dependencies-2026-11-05.md), [complete story/AC ledger](epic-traceability-2026-11-05.json), [capability reuse](capability-reuse-inventory-2026-11-05.md).

## Before relevant story implementation or reliance
| Gate | Owner role | What must be established |
|---|---|---|
| Supported first-engagement work | Product owner and actual audit/methodology authority | Concrete procedures/populations/inputs, expected results, representative recovery/scale cases, relevant methodology, readiness fields and required versus deferrable context. |
| Audit planning/governance | Actual organisational authority/delegates | Applicable assessment cadence, significant-risk treatment, plan/change approval and evidence; permitted advisory variation, follow-up, risk acceptance and escalation. No universal template or invented actor. |
| Recurring check | Architecture/implementation owner, product owner for material support choices | Exact trigger/timezone/cadence, source freshness, host/app availability, missed-run/restart/cancellation behavior, current identity and mandate revision, limits/results/escalation. Reuse confirmed queue/sleep primitives; prove actual protected invocation and all negative cases. |
| Artifact portability and authority | Product/architecture and actual record owner | Working location, designated external authority, selected exports, intact/lost links and recipient usability. Preserve existing V1 external / V2 native boundary; only material change needs a new decision. |
| Real shared/provider/source use | Organisation/data owner and implementation owner | Current exact-route evidence, legal/policy/service eligibility, actual grants, revocation and held-data controls; OQ-16B operational gates remain. Provider constructor/configuration is not eligibility. |
| Customer/pilot and purchase | Product owner, organisation and commercial owner | Authorised real data/use, baseline/outcome measurement and cost/commercial arrangement before their respective commitments. No outreach, service setup, paid inference or deployment authorised here. |

## Existing engineering evidence remains scoped and open
The latest supplied handoff reports Linux tests and partial smoke history, not a new execution by this workflow. Full final-head smoke was reported 17/18 with visual-conversation failing, followed by an isolated visual pass. That is not a cumulative final-head full pass. Actual Windows/WSL, native executor, owner UI/accessibility, real-provider warm-policy/streaming, OAuth-cancel listener and other handoff gates remain as recorded. Planning does not fix or waive them; failed, blocked, not-run and historical passes remain distinct.

Use the existing build/spec checkpoints and verification policy before code; do not weaken/skip tests, use --no-sandbox, install/download without approval, change merge policy or push early based on this planning. One PR per genuinely complete epic and true merge remain unchanged.

## Stopping condition for this planning handoff
Current source documents and acceptance paths can be reconciled without selecting a new architecture/provider/scheduler or cutting generic scope. Open details are recorded at their reliance points. No further product decision is invented to label these plans production-ready. Source audits, tracker and document checks are different evidence classes.
