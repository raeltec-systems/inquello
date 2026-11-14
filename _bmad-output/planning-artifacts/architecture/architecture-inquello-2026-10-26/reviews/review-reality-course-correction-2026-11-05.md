# Architecture source and technology reality review — 2026-11-05

## Verdict
Changes required: one medium documentary contradiction; no new technology choice or fresh version certification is needed for this correction.

## Finding
### Medium T1 — Companion retains a false present-tense checkout claim
Location: shared-service-contract-proposal-2026-10-27.md §11 Evidence and limitations.
Evidence: “No executable product code exists in this checkout to ratify the new service; it contains planning/research artifacts.”
This reads as current despite the document's explicit 2026-11-05 reconciliation. AGENTS.md identifies the actual engine fork, FORK-CUT.md records implemented changes, and current SPEC/lifecycle-and-readiness.md distinguishes authored implementation and dated tests from outstanding Windows/provider/final-head acceptance. The spine now correctly delegates actual implementation status to dated engineering evidence.
Impact: a downstream reader can mistake implemented capabilities for greenfield work, undermining the approved reuse-first correction.
Disposition: autofix. Date the sentence explicitly as the 2026-10-27 snapshot, or say that this documentary update did not independently execute or qualify the current service. Do not replace it with a claim that present implementation passes acceptance.

## Verified framing
- Current source root engine/ and rust-v0.165.0 agree with AGENTS.md and FORK-CUT.md.
- The historical Electron/React/TypeScript/Rust/pnpm table is explicitly a historical seed, with actual lockfile/fork compatibility required before dependent implementation. It is not represented as freshly current.
- PostgreSQL 18 evidence is explicitly dated 2026-10-27 and exact driver/patch compatibility stays gated. No replacement supplier or datastore was introduced.
- Auth0 hosted OIDC and eligible self-service creation match spec-customer-onboarding/SPEC.md. Exact issuer/subject, fresh verified-email proof, intended-identity invitation, receipts, private-content independence and the operator path survive.
- Queue/mailbox/sleep existence is separated from qualified recurrence: trigger supply, protected invocation, host/session, missed runs and recovery remain open before enablement.
- Capability inventory limitations are honest: catalog-only is unverified, not absent; source/wiring is not hosted entitlement or all-feature usability.

## Sources
Repository AGENTS.md and FORK-CUT.md; ARCHITECTURE-SPINE.md Stack/AD-1/18/24; shared-service companion §§2/7/10/11; current customer-onboarding SPEC; SPEC-inquello/lifecycle-and-readiness.md; capability-reuse-inventory-2026-11-05.md.

## Scope and evidence limits
Independent documentary review on 2026-11-05. Read repository AGENTS.md and the architecture reviewer gate; reviewed the current spine and shared-service companion, DESIGN/EXPERIENCE, current PRD, SPEC-inquello and lifecycle-and-readiness, customer-onboarding SPEC, capability inventory, course-correction architecture/UX analysis, FORK-CUT.md and the UX coverage ledger. No main planning document was edited. No code, build, test, install, download, push, service call or runtime acceptance was performed. Existing mechanical-check outcomes are parent-reported, not rerun here. Named version seeds were checked for truthful historical framing, not freshly certified against upstream release sites. Catalog-only inventory rows remain unverified, never absent.

## Final recheck — 2026-11-05 13:50 UTC
Final verdict: PASS for the bounded documentary correction. Directly reread the changed sources after the author's fixes. Shared-service §11 now explicitly dates the no-code observation to 2026-10-27 and disclaims new runtime acceptance; T1/R1 closed. Architecture Deferred now names OQ-17–20; UX Open Items enumerates their scope; R2/U2 closed for traceability. EXPERIENCE UJ-2 now uses step 7 as the review milestone and step 9 as the lifecycle climax; U1 closed. AD-10 retains applicable annual/dynamic planning, reliance responsibility and programme/change approval. No critical/high finding remains.

This was one independent reviewer applying the rubric, source/technology, adversarial and UX structure-then-prose lenses under constrained agent capacity, not four independently sampled reviewers. Historical reports remain unchanged. Parent-reported source-derived checks, unchanged token data and baseline import hashes are supplementary evidence, not execution by this reviewer. The minor UJ-2 “identifies an identified” wording remains an optional nonblocking copy edit. Actual rendered accessibility, host isolation, service/onboarding, procedure/recurrence, external-export and runtime qualification remain open before their respective reliance points.
