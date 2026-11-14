# Architecture rubric review — 2026-11-05

## Verdict
Pass for this bounded planning correction, with one cross-referenced medium documentary correction and one low traceability improvement; no critical/high architectural gap identified.

## Good-spine checklist
- Real divergence points: AD-1–5 fix retained engine, UI/domain/adapter ownership and privileged host boundaries. AD-6–13 fix identities, mutation ownership, reviewed basis, effects and V1/V2 authority. AD-15–22 and SC-1–7 fix shared identity/grants, transfer, revocation and recovery. The new lifecycle extends those boundaries rather than creating competing owners.
- Enforceable rules: current-access checks, immutable versions/mandates, exact operation receipts and distinct human authority are concrete obligations. Actual host isolation and service qualification remain prerequisites, not assertions that code already meets them.
- Deferral: lifecycle procedures/readiness, trigger/host/session/missed-run behavior and export/link preservation remain gated before dependent commitments or reliance. This is appropriate at initiative altitude; it does not allow downstream units to ignore common ownership and security semantics.
- Brownfield ratification: engine/ and rust-v0.165.0 replace timeless fork/ assumptions; reuse precedes exposing/adapting and qualification. Existing private-route restrictions are not a reason to replace the runtime or bypass domain protections.
- Spec coverage: FR-45/CAP-26 and UJ-9/10 link setup, coverage planning, programme/evidence/report, action follow-up and later planning. Recurrence stays V1. FR-38/40/42 remain V2. Optional Engagement and ad hoc Tasks survive.
- Operating envelope: deployment/data eligibility, local-host availability, scheduler supply, shared coordination, recovery and operations have explicit owners/gates. No production service guarantee or always-on host is invented.
- Technology: the stack table explicitly labels its pins historical. See the separate reality review for the remaining stale-current-code sentence in the companion.

## Findings
### Medium R1 — Historical absence statement reads as current
Location: shared-service-contract-proposal-2026-10-27.md §11. The statement that no executable product code exists conflicts with current source/evidence. Disposition: autofix by explicitly dating it as the October snapshot, or replace with this update's lack of runtime verification. Detailed finding in review-reality-course-correction-2026-11-05.md.

### Low R2 — Link lifecycle gate summaries to stable OQ IDs
Location: ARCHITECTURE-SPINE.md Deferred / Lifecycle reliance; EXPERIENCE Open Items. Current SPEC/lifecycle-and-readiness.md names OQ-17–20. The summaries preserve substance but do not reference those stable gate IDs. Disposition: optional autofix to link the existing canonical gates; do not create duplicate policy decisions.

## Sources
ARCHITECTURE-SPINE.md AD-1–24, Stack, Operating Envelope, Deferred and lifecycle diagram; shared-service companion SC-1–7; ../../../../specs/spec-inquello/SPEC.md and lifecycle-and-readiness.md; capability-reuse-inventory-2026-11-05.md.

## Scope and evidence limits
Independent documentary review on 2026-11-05. Read repository AGENTS.md and the architecture reviewer gate; reviewed the current spine and shared-service companion, DESIGN/EXPERIENCE, current PRD, SPEC-inquello and lifecycle-and-readiness, customer-onboarding SPEC, capability inventory, course-correction architecture/UX analysis, FORK-CUT.md and the UX coverage ledger. No main planning document was edited. No code, build, test, install, download, push, service call or runtime acceptance was performed. Existing mechanical-check outcomes are parent-reported, not rerun here. Named version seeds were checked for truthful historical framing, not freshly certified against upstream release sites. Catalog-only inventory rows remain unverified, never absent.

## Final recheck — 2026-11-05 13:50 UTC
Final verdict: PASS for the bounded documentary correction. Directly reread the changed sources after the author's fixes. Shared-service §11 now explicitly dates the no-code observation to 2026-10-27 and disclaims new runtime acceptance; T1/R1 closed. Architecture Deferred now names OQ-17–20; UX Open Items enumerates their scope; R2/U2 closed for traceability. EXPERIENCE UJ-2 now uses step 7 as the review milestone and step 9 as the lifecycle climax; U1 closed. AD-10 retains applicable annual/dynamic planning, reliance responsibility and programme/change approval. No critical/high finding remains.

This was one independent reviewer applying the rubric, source/technology, adversarial and UX structure-then-prose lenses under constrained agent capacity, not four independently sampled reviewers. Historical reports remain unchanged. Parent-reported source-derived checks, unchanged token data and baseline import hashes are supplementary evidence, not execution by this reviewer. The minor UJ-2 “identifies an identified” wording remains an optional nonblocking copy edit. Actual rendered accessibility, host isolation, service/onboarding, procedure/recurrence, external-export and runtime qualification remain open before their respective reliance points.
