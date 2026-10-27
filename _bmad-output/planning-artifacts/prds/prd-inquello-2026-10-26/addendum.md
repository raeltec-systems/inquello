---
title: Inquello PRD — evidence and implementation companion
status: final
created: 2026-10-26
updated: 2026-10-26
---

# Inquello PRD companion

This companion to the [PRD](prd.md) preserves research detail and evaluation evidence. It introduces no new requirements or accepted architecture. The [product-definition addendum](../../../../docs/addendum.md) and [traceability map](../../../../docs/PRODUCT_BRIEF_TRACEABILITY.md) retain the complete original scope. All fixtures and acceptance scenarios below remain proposed and unexecuted.

> **Current-contract precedence (2026-10-27):** The historical evidence and exact fixtures below are preserved. Later adopted UX/architecture and the [collaboration contract](../../../specs/spec-inquello/collaboration-and-memory.md) supersede earlier unselected-design/topology wording. Hybrid sharing, team memory admission, first-increment revocation and agent-assisted review now bind the existing acceptance scenarios; no runtime evidence is implied.

## Source and mechanism constraints

The [foundation study](../../../../docs/research/2026-10-26-methodology/FOUNDATION_REUSE.md) inspected Codex commit `970111f6cb62cc02fe36a82ea7d71b37a2889c97`. Core/CLI, app-server and the TypeScript SDK are candidate reusable components. The SDK wraps CLI execution; it does not supply a desktop interface. Reusable desktop UI source and complete hosted connector, tool and scheduler implementations were not established. Each capability needs a documented component or supported service route and separate operational validation.

Current documentation and pinned source need not describe the same release. The [bounded landscape refresh](research-context.md) records current app-server transport limitations and distinguishes integration components from hosted execution. Its Diligent and Cowork observations are vendor statements, not tested parity or proven differentiation. They do not change scope.

Execution location, inference, connected-service traffic, retained files and logs are separate processing concerns. Provider choice does not settle all of them. Cancellation, resumption and conversation-history changes do not establish rollback of file or remote effects. A successful transport response does not establish successful work or accepted delivery.

## Concrete validation fixtures

Sources: [artifact validation](../../../../docs/research/2026-10-26-methodology/ARTIFACT_VALIDATION.md) and [methodology study](../../../../docs/CODEX_METHODOLOGY_STUDY.md). Fixture rules are illustrative, not universal audit methods.

**W1 — Excel reconciliation.** Ledger: R1=1,000; R2=1,500; R3=500; R4=900; R5=700. Bank: R1=1,000; R2=1,500; R3=500; R3=500; R4=950; R6=300. Preserve five ledger and six bank rows. Assign L01–L05/B01–B06 in order; match equal reference/amount by ascending source ID, so L03 matches B03 and B04 remains unmatched. Expect three exact matches and bank excess `500 + 50 + 300 − 700 = 150` (totals 4,600/4,750). Saved R5=800 changes the ledger to 4,700 and excess to 50. Test stale formula caches, intervening editor changes, named ranges, comments, formatting and an unrelated sheet; collect the reopened workbook and input versions. No source transaction is changed.

**W2 — Word procurement workpaper.** Policy v1 requires two prior approvals above 5,000. An order for 7,800 has approval A before ordering and B afterward. Report one prior and one later approval. Preserve comments, tracked deletion, footnote, table, bookmark and attribution while revising rejected wording. When v2 raises the threshold to 10,000, establish its effective period before reassessment. Detect broken citations; disclose unsupported attribution. Collect the reopened document, change comparison, review metadata and applicable policy version. Professional approval remains pending until the authorised reviewer acts.

**W3 — Access review and external update.** HR contains E01–E05; E02 was terminated before the test date. Accounts: A1/E01 enabled, A2/E02 enabled, A3/E03 disabled, A4/E04 enabled, A5/E99 enabled, A6/service owned by E05 enabled, A7/E01 enabled. Valid E05 approval covers A6; multiple accounts are permitted. Preserve all seven; investigate A2 and A5 without automatically rejecting A6 or dropping A7. Test an approved finding update against a named destination with a record changed after review, a response lost after success and revoked credentials. Collect destination/version identity, approved-field comparison, read-back and operation correlation; reconcile uncertain outcomes before retry.

**M1 — Method authority.** Supply approved procedure v1, template and example alongside evidence containing instructions to ignore exceptions or bypass review. Use approved guidance while retaining facts from the evidence and treating instructions within that evidence as untrusted content. Record guidance identity and loaded references; surface missing dependencies. Introduce v2 after drafting and identify affected outputs. A case correction must not silently become a team rule.

## Acceptance evidence retained from A01–A18

These are concise evidence summaries, not replacement requirements. A01–A10 and A13–A18 assess V1; A11 separates the phases; A12 applies only to V2. Full wording remains in [the original evaluation plan](../../../../docs/addendum.md#12-acceptance-and-evaluation-plan).

- **A01:** sourced ad hoc output and a continuation using retained work, without mandatory engagement setup.
- **A02:** external-audit assertions/materiality/substantive work and advisory options, without mandatory controls or deficiency states.
- **A03:** W1 populations, totals, duplicate-source identity and the changed-input result reconcile exactly.
- **A04:** detect stale caches; preserve saved external edits, supported comments, named ranges and unrelated content, or surface conflicts before replacement.
- **A05:** W2 distinguishes approval timing, preserves review metadata/evidence links and applies the correct effective policy.
- **A06:** W3 preserves seven accounts, investigates A2/A5 and recognises valid A6 approval; technical source/script review remains available.
- **A07:** M1 shows approved-method use, evidence-instruction separation, missing dependencies and reassessment after method changes.
- **A08:** parallel agents preserve sources, expose disagreements and coordinate writes; agent review cannot impersonate human approval.
- **A09:** resumed/compacted work retains accessible decisions and sources; changed permissions and missing context are visible; cancellation does not claim external rollback.
- **A10:** approved remote updates preserve unrelated fields and confirm destination state; stale or uncertain outcomes enter reconciliation.
- **A11:** V1 identifies external authority and transfer limitations; V2 additionally verifies organisation/workspace mode selection and migration without silent engagement switching.
- **A12 — V2 only:** native records preserve identities, relationships, attribution, reviewed versions and amendments, with applicable retention/export behaviour; changes cannot silently retain obsolete approval. This is not a prerequisite for V1 acceptance.
- **A13:** scheduled/event work records scope and method version, handles duplicates and distinguishes missing, unrun, incomplete, failed and no-exception outcomes.
- **A14:** revocation prevents prohibited subsequent use; reassignment covers retained work and unattended jobs; sharing exposes only permitted content/audiences.
- **A15:** enabled model/provider/client routes report capabilities and respect policy without silent route substitution.
- **A16:** smaller mapped capabilities receive individual tests; deferrals remain unmet requirements and do not establish full parity.
- **A17:** presentations preserve supported themes, chart references and notes; assertions link to analysis and unsupported estimates remain labelled.
- **A18:** compare total effort through acceptance, accuracy, corrections, tool/model costs and recovery with the team's baseline.

## Method distinctions

The [methodology evidence](../../../../docs/CODEX_METHODOLOGY_STUDY.md) distinguishes task context, standing instructions, reusable skills, executable tools, delegated agents, memory and enforced policy. Prose guidance does not itself restrict access. Hook failures need observed handling before any enforcement claim. Memory is not an authoritative shared methodology; client evidence must remain scoped. Authoring a skill does not settle distribution, approval or version governance. Calling an agent a reviewer establishes neither independence nor professional approval. No general workflow engine is selected.

## Design inputs and pending technical handoffs

Inquello is the working name. The [Open Inquiry candidate and illustrative screens](../../../../docs/branding/2026-10-26-refined-a/README.md) provide exploratory design inputs, not approved UX or demonstrated functionality. The [name research](../../../../docs/INQUELLO_NAME_CHECK.md) leaves final clearance unresolved.

Subsequent UX and architecture work must resolve supported clients/formats and Office round trips; component/service routes; identity, policy and data flows; named integration contracts; concurrency, cancellation and recovery; method/memory governance; actual reviewer responsibilities; and team baselines for scale, effort and cost. Saved-file access does not imply live unsaved-state access. Remote systems need their own version, retry, identity and verification contracts. V2 additionally needs native-record lifecycle, mode precedence and migration design. These are pending handoffs, not selected technologies, schemas or deployment topology; they introduce no additional V1/V2 cut.
