---
title: "Inquello course-correction application report"
date: "2026-11-05"
status: planning-application-complete-dependent-detail-gates-open
workflow: bmad-correct-course
implementation_authorized: false
branch: feat/epic-1-secure-private-desktop
head: c407483170e93ad9bea0f2d1c36e9d32693b0c44
---
# Applied planning correction

Israel approved the reuse-first full internal-audit direction and applying it to the existing plans through BMAD workflows. The [approved change proposal](../sprint-change-proposal-2026-11-05.md) is applied. No new product/architecture decision blocks this planning handoff; the concrete support and real-use gates below remain open.

## What changed
- Retained every compatible Codex capability and documented model route. A [per-feature reuse inventory](../capability-reuse-inventory-2026-11-05.md) separates inherited implementation, current protected integration, expose/adapt work, external dependencies and evidence. It covers all 79 C groups and 20 expanded E entries plus the named GCP route; the original 270 subfeature mappings and 93 proposed enhancements keep their original status.
- Added FR-45/CAP-26 for risk-based coverage planning, UJ-9 organisational setup/context and UJ-10 coverage planning/feedback. Existing FR/CAP/UJ IDs remain stable.
- Connected setup/context, coverage plan, engagement design/work, review/report and actions/follow-up into one V1 journey, including a supported recurring check. Scope now leads with significant-risk coverage, then quality/relevance and capacity/rework benefits, without invented numeric claims.
- Preserved external-authority V1/native-authority V2, private Tasks and explicit sharing, current grants/revocation, human judgment/sign-off, OQ-6 desktop-first Excel/Word/PowerPoint/CSV import/export and every route's eligibility gate.
- Clarified professional distinctions and applicable GIAS 9.4/9.5/13.6 duties without imposing universal templates, fixed sample sizes, software planning cadence, board portal or personal-CAE clicks.
- Added Stories 6.6 organisation/context and 6.7 coverage planning, and 25 additive ACs. All 382 original AC texts remain; current canonical AC count is 407. There are 141 canonical story headings plus preserved tracker/spec Story 1.31, or 142 distinct inventory IDs.
- Bounded recurrence uses current 12.1–12.6/12.8 contracts and the full-journey checkpoint, with actual safety/data dependencies instead of blanket unrelated Epics 7–11 prerequisites. Compatible wider automation remains V1.
- Added eleven backlog story entries and relevant epic entries to the tracker without changing any existing status.
- Reconciled stale Auth0/onboarding, engine/ and no-code/adapter wording as documentary facts, not renewed stack decisions or proof of operational acceptance.

## Applied artifacts
| Area | Existing or new artifact |
|---|---|
| Product | [PRD](../prds/prd-inquello-2026-10-26/prd.md), [addendum](../prds/prd-inquello-2026-10-26/addendum.md) and their scoped input/review/check reports |
| Canonical contract | [SPEC](../../specs/spec-inquello/SPEC.md), scope-and-gates.md, glossary.md and new [lifecycle-and-readiness.md](../../specs/spec-inquello/lifecycle-and-readiness.md) |
| Architecture | [Architecture Spine](../architecture/architecture-inquello-2026-10-26/ARCHITECTURE-SPINE.md), adopted shared-service companion, source reconciliation and scoped rubric/reality/adversarial reviews |
| Experience | [DESIGN](../ux-designs/ux-inquello-2026-10-26/DESIGN.md), [EXPERIENCE](../ux-designs/ux-inquello-2026-10-26/EXPERIENCE.md), existing coverage sheet, source reconciliation and scoped review |
| Backlog | [epics.md](../epics.md), [scope/dependencies](../epic-scope-and-dependencies-2026-11-05.md), [traceability](../epic-traceability-2026-11-05.json), [mechanical checks](../epic-mechanical-checks-2026-11-05.json), [current readiness](../implementation-readiness-2026-11-05.md) and additive sprint-status.yaml entries |
| Reuse evidence | [Markdown inventory](../capability-reuse-inventory-2026-11-05.md), [JSON](../capability-reuse-inventory-2026-11-05.json) and the three bounded source audits in this folder |
| Cross-document verification | [Application checks](application-checks.json), [SPEC preservation review](spec-preservation-review.md), this report and the Correct Course checklist |

## Workflows and verification
- Correct Course approval/final routing is recorded. This is a moderate planning/backlog reorganisation, not an architecture reset. The existing epic workflow's historical status is preserved; its document was amended under Correct Course rather than recreated or falsely marked newly completed.
- bmad-prd Update completed source extraction/reconciliation, rubric, structure/prose and open-gate triage. Four high and two medium source-fidelity gaps and two prose issues were corrected. The later OQ-16 supplier clarification was directly checked against adopted onboarding.
- bmad-spec derived the current contract from its acknowledged baseline and appended decisions. Coherence and preservation passes completed; independent stale CR-1 evidence and two low reference/technology-qualification issues were corrected.
- Architecture and UX Update completed source reconciliation, architecture lint and bounded independent review. The architecture rubric/reality/adversarial lenses were combined in one independent reviewer, not three distinct perspectives. No critical/high issue remains in that bounded review.
- Current source-derived checks pass 45 unique contiguous FR IDs, 26 unique CAP IDs each with intent/success, ten complete journeys, all 16 SPEC companion paths and 64 checked local links; the final application report's 19 links also resolve. The complete 99-row catalog plus GCP delta is preserved.
- The historical UX checker was not changed: 22/24 passes, with two failures caused solely by its fixed 44-FR/eight-journey counts. The current source-derived check verifies the approved 45-FR/ten-journey contract. This is a document-version mismatch, not a skipped or weakened runtime test.
- All 286 pre-application files were compared. Only 16 explicitly owned current planning/log/tracker files differ; no unexpected baseline changes. All original tracker values and Epic 1's full body are unchanged. Ten historical root planning artifacts remain unchanged against Git; tokens and imported UX bytes remain unchanged.
- git diff --check passes. No engine/desktop diff. No runtime tests, builds, installs/downloads, commits or pushes were performed.

## Evidence limits
The source inventory is exhaustive for the named catalog, but implementation verification is not: 40 C rows have bounded source-audit overlays; 59 catalog rows (remaining C groups and expanded E entries) explicitly remain unverified, plus separately sourced GCP detail. Unknown is not absent. These need source/API/config/UI/native/service/test evidence at their implementation/enablement gates. No full proprietary application/service parity or automatic entitlement is claimed.

Current private Task restrictions remain protected. Source presence does not authorise raw APIs to bypass ownership/permissions. Existing queue/mailbox/sleep foundations do not establish recurring work through app shutdown, host sleep or missing inputs. Provider constructors/configuration do not prove all native APIs or services.

The [engineering handoff](../../implementation-artifacts/handoff/HANDOFF-2026-11-05.md) reports 2,169 Linux desktop tests and a final-head full smoke of 17/18 with a later isolated visual pass. It is not a cumulative final-head full pass. Windows/real WSL, actual provider/route and relevant owner acceptance remain separate. This task does not resolve those implementation gates.

## Open dependence-point decisions
- **OQ-17:** supported procedures/populations, sources/formats/connections and first-engagement readiness, before the affected story specification and reliance.
- **OQ-18:** recurrence trigger, host/app/session availability, identity/mandate/limits, missed-run/restart and recovery contract, before enabling/promising the check.
- **OQ-19:** each deliverable's working location, designated external authority, approval evidence and export/link preservation, before reliance on that output/handoff.
- **OQ-20:** authorised real pilot work, baseline and representative proof, measured cost and commercial arrangement, before data use, benefit claims or purchase respectively.
- Existing OQ-16B operational/data/route qualification, OQ-11 native V2 policy, OQ-12 brand validation and future external-audit OQ-15 remain at their existing boundaries. New lifecycle layouts need practitioner walkthroughs and rendered/accessibility verification.

Israel remains product decision owner; other role assignments are proposed until named. These details do not reopen the approved scope or block independent work. No numerical targets, release date, new vendor, record schema or pilot organisation was invented.

## Handoff
The updated planning baseline is ready for the parent/owner's next development instruction. Resume only authorised work under applicable story specification checkpoints; do not treat planning approval as new code, paid inference, deployment, customer-data or outreach authority. Preserve Epic 1, never skip/weaken tests or use Electron --no-sandbox, ask before unapproved installs/downloads, run the full suite and smoke before pushes, and keep one PR per completed epic with a true merge.
