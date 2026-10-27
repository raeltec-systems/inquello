# Cross-feature compatibility review

**Verdict: changes required before feature-level handoff.** Two initiative-level semantic gaps permit independently compliant feature units to disagree about which authority applies to the same work. Both have small rule-level fixes; neither calls for a new service, a full schema, or a different adopted architecture.

- Review date: 2026-10-27 UTC.
- Lens: configured BMad Architecture Reviewer Gate adversarial cross-unit compatibility.
- Reviewed file: `ARCHITECTURE-SPINE.md`.
- Reviewed SHA-256: `1AB973BF8336883C72F9DD74CB04C59A5E602220C0CC0BEA50246C8880C82D02`.
- Read-only inputs: spine, `.memlog.md`, `.working/input-product.md`, `.working/input-ux.md`, `.working/upstream-architecture.md`, governing PRD/addendum and EXPERIENCE.
- Fixed constraints: adopted AD-1–4, full 41-FR V1 scope, V2 only FR-38/40/42, no selected new shared service. This is a document-level review, not an implementation or test result.

## C-1 — High: the reviewed basis has no common revision/applicability contract

**Location:** AD-6 Rule, line 91; AD-9 Rule, line 109; AD-10 Rule, line 115; AD-11 Rule, line 121; AD-13 Rule, line 133; identifier convention, line 145.

**Gap:** The spine requires versions, affected-output identification, stale-result handling and attributed approval, but leaves each feature to decide what constitutes the relevant version of reviewed work. An artifact's saved-file revision, an analysis revision, a Method revision and a reviewable evidence package are not necessarily the same thing. No common owner or rule establishes whether a historical decision applies to a changed analysis basis when the saved artifact is unchanged. This is a semantic contract gap, not a request for specific fields or version encodings.

**Concrete compliant pair:**

1. The analysis/Method feature records source `S@1`, Method `M@1` and artifact `A@7`. After a source or applicable Method change it identifies affected work and recomputes the result, as AD-9/10 require. The displayed numbers and artifact bytes happen to stay identical, so its saved-file identity remains `A@7`; its provenance now records a different analysis basis. It preserves the previous basis and the external approval reference as history.
2. The review/delivery feature records the authorised person's decision against `A@7` and its stated item scope. It uses artifact revision equality to determine whether that decision is still applicable, verifies the designated external authority and checks the destination/version before an effect. Another equally literal implementation uses equality of the complete reviewed analysis basis instead. The first reports the current result as covered by the existing decision; the second reports only the historical result as covered and requires the applicable review rule to resolve the changed basis.

Both preserve separate run/review/approval/delivery states, the actual human and recorded scope/version, old approval evidence, changed-input handling and destination checks. Their disagreement is the undefined meaning of **applicable** scope/version; current-state eligibility cannot be composed reliably between them. Merely sharing Rust modules does not settle which reference their interfaces exchange.

**Impact:** The same result can appear eligible for current review/delivery in one feature and pending reassessment in another. The problem also appears when a branch is promoted or a departure changes while the saved document remains byte-identical. It does not require native V2 record authority.

**Minimal rule fix:** Give the shared domain ownership of the identity/revision of a reviewable work basis and of decision applicability. Analysis, artifact, review and delivery features must reference that common basis, including the relied-on source/Method/departure scope needed by the applicable Method. A dependency or branch change cannot silently carry a prior decision onto a new basis; apply the shared Method-specific applicability rule or expose applicability as unresolved. Preserve the historical external decision and its authority separately. Exact representation, change-significance policy and external mappings remain at their existing gates; no universal new sign-off step is implied.

**Source support:** PRD concepts at lines 64–69 define analysis inputs and approval about specified work/version; FR-20 requires changed-Method impacts; FR-35 identifies the reviewed version; FR-41 covers proposed changes and supporting evidence; NFR-7 covers decision provenance. EXPERIENCE UJ-3/4/7 and Authority and Delivery require reviewable changed work without conflating saved edits with professional acceptance. The product extraction explicitly notes that changed relied-on content can affect prior approval. AD-6/9/10/13 preserve these concerns individually but do not bind their shared applicability semantics.

**Disposition:** Tighten AD-6/9/13 with the common basis/applicability invariant; leave schema and policy details deferred.

## C-2 — High: a run can mix revisions of its automation mandate

**Location:** AD-8 Rule, line 103; AD-11 Rule, line 121; AD-12 Rule, line 127. Related governing memlog entry: AD-12 explicitly calls for **versioned** mandates, while the distilled Rule omits mandate-version binding.

**Gap:** Retaining mandate fields and actual run outcomes does not say which mandate revision binds a running execution, a resumed job or its eventual delivery. The spine distinguishes disablement from running work but supplies no common rule for other mandate edits. Current authority checks and a run's approved instruction snapshot serve different purposes and can change independently.

**Concrete compliant pair:**

1. The trigger/execution feature starts run `R` from mandate `M` with input scope `I1`, Method `V1`, execution identity `E1` and destination `D1`. It retains those facts in the run and continues bounded work. While it runs, an authorised administrator edits `M` for future work to scope `I2`, Method `V2`, identity `E2` and destination `D2`.
2. The delivery feature receives `R` plus the stable mandate identity `M`. It resolves the latest permitted mandate, rechecks current authority, records the exact generated content and destination `D2`, and verifies any effect. It treats the current mandate as the preauthorisation AD-11 names. The execution feature instead considers the original mandate the authority for the run. A third implementation could freeze destination but refresh budget or identity. All retain the specified mandate fields, run outcomes and operation identities; none needs to bypass a permission check, invent a service or retry an uncertain effect.

The interfaces compose without a technical error, yet the run becomes a mixture no single mandate revision described. The legitimate organisational choice about how changes affect running work has been made independently by two features.

**Impact:** Review, consumption accounting, reassignment and delivery can disagree about what authorised a run. Even where both destinations are currently accessible, permission to access `D2` does not itself settle whether the in-flight work under the old input/Method mandate is authorised for `D2`. Shared revocation enforcement cannot resolve this instruction-version mismatch.

**Minimal rule fix:** Bind every accepted trigger/run and its derived effects to one immutable mandate identity/revision (or equivalent immutable mandate snapshot) owned by the shared domain. The execution, resume, review, budget and delivery paths consume that same binding. A change that alters an in-flight binding must be an explicit, attributed domain rebind with the relevant scope/version checks, rather than independent latest-value resolution. Current access, revocation and restrictive policy remain rechecked and may stop the bound run; a frozen mandate cannot preserve revoked authority. Exact update policy, accounting mechanics and scheduler implementation remain gated.

**Source support:** PRD FR-24 specifies the bounded mandate tuple; FR-33/36 separate permitted configuration from effective revocation; EXPERIENCE UJ-8 carries configured inputs, Method, acting identity, limits, destination and escalation through an identifiable run. The architecture memlog's AD-12 already says “versioned trigger/input/Method/identity/limit/destination/escalation mandates.” Restoring a common version binding implements that recorded intention without selecting new product policy.

**Disposition:** Tighten AD-12, with a short cross-reference from AD-11; preserve OQ-5/9 for actual policy and route choices.

## Attacks rejected or already closed

| Attempted divergence | Why it is not an additional finding |
| --- | --- |
| Desktop and CLI each own competing writable copies of the same Task | AD-4/7 require shared domain commands, one logical owner and verified cross-host ownership transfer; otherwise the route is gated. No new coordinator topology needs to be chosen here. |
| A runtime tool writes audit/reviewer state directly | AD-7 explicitly forbids that path and protects store/credential locations. Concrete sandbox enforcement remains implementation work. |
| A model, connector login or completed runtime turn grants human acceptance | AD-2/6/13 and the event convention prohibit the substitution. Authentication-provider selection can remain OQ-9. |
| File-editor and analysis features intentionally overwrite intervening changes | AD-9 already requires preservation or leaving the conflict unapplied. Lock/CAS/merge mechanics can remain implementation details. |
| Delivery treats a lost response as a safe new attempt | AD-7/11 require retained logical operation identity, uncertain outcome handling and reconciliation before retry. No exactly-once guarantee is assumed. |
| Scheduler or collaboration teams silently drop unmet V1 capabilities | AD-12/14, the owned supply gaps and OQ gates explicitly preserve those obligations. Missing implementations are not an architectural contradiction by themselves. |
| Every feature invents its own complete wire schema | A full schema inventory would exceed this spine's altitude. Only semantic references whose disagreement changes authority or work identity need tightening now, as in C-1/2. |

## Review boundary

No changes were made to the spine, memlog or governing sources. This report does not require selecting a central service, reopening AD-1–4, moving V1 capabilities into V2, imposing universal approval, or claiming execution of any acceptance fixture.

## Targeted closure — 2026-10-27

**Disposition: C-1 and C-2 closed; no remaining blocker in this review lens.** This closure supersedes the initial findings' open disposition for the revision below. It checks the two fixes and their authority/phase interactions, not a fresh full review.

Revised spine SHA-256: `53C139F127D87A440BFB3EF97AC9AADE9D4FCFB7973B50F10DAA8084C89F772B`.

- **C-1 closed:** AD-6, line 91, gives the shared domain ownership of one reviewed-basis revision covering decision-relevant outputs, Sources/evidence, Method/departures and policy versions; review and delivery consume the same reference. AD-9, line 109, marks affected decision applicability stale and requires resolution under the actual Method/policy before current reliance or delivery. Retained historical attribution and external authority remain distinct. The original counterexample can no longer choose file-only versus analysis-basis applicability independently.
- **C-2 closed:** AD-12, line 127, binds a run and its effects to one immutable authorised mandate revision, makes configuration changes prospective unless explicitly rebound with authority/impact checks, and preserves current revocation/restrictive policy. AD-11, line 121, requires delivery to consume that binding. The original counterexample can no longer silently combine old execution scope with a newly resolved destination or identity.

The fixes remain aligned with PRD FR-20/24/35/36/41, NFR-7 and EXPERIENCE UJ-3/4/7/8. They introduce neither a universal review/sign-off workflow nor V1 native record authority: AD-6 still rejects a universal audit state machine; AD-9 delegates applicability to the actual Method/policy; AD-13, line 133, retains designated external formal authority in V1 and reserves FR-38/40/42 native authority/lifecycle for V2. The word “retained” avoids converting historical attribution integrity into an unconditional retention obligation. No regression was found in these interactions.

Only this review file was updated for closure; the spine, memlog and governing sources remained read-only. This is documentation closure, not implementation or acceptance-test evidence.
