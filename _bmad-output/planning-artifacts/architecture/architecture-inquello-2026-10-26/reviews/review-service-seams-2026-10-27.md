# Shared-service seam review — 2026-10-27

## Verdict

**Pass after contract revisions, at architecture altitude.** All ten concrete seam findings identified in this bounded review are now closed in the proposal. No remaining blocking service/client semantic seam was found on final recheck. Proposal status itself is not a defect, and this review does not adopt the proposal or authorize implementation.

The last four closures distinguish upload workflow/command identity, classify authorization dependencies versus review context, fence delayed authorization replies, and retain command-outcome knowledge across restore. These are proposed technical consistency rules, not a vendor choice or owner policy adoption.

## Scope and method

- Read `ARCHITECTURE-SPINE.md` and `shared-service-contract-proposal-2026-10-27.md` (the **proposal** below).
- Applied the installed BMAD adversarial lens and the architecture reviewer-gate test: construct two units that obey their specified responsibilities but disagree at their seam. Units are hypothetical; no implementation defect or executed-test result is claimed.
- Reviewed authentication, sessions, permission epochs, handoff, active agents, offline behavior, and restore. No product/code changes were made; this review file is the sole authored artifact.
- Reviewed spine SHA-256: `1b215f12dcd24dc8505e421a72b9c971725284c612e1cf6360042629adb4e694`.
- Final rechecked proposal SHA-256: `250fdacbe9d4166b1e8a9b667ac4f62cf44d1f41cfc75a1a8b6b44b304cdda23`. Earlier review checkpoint: `45bd308ecbee81aa265301dfb7d947fe5a011d98c9651250807fa89bc658159b`.
- The author incorporated feedback during review. Ten concrete seam checks are recorded below, all now closed. Original counterexamples and guard suggestions are historical review evidence, not current defects. References use section names and the final rechecked revision's line numbers.
- Vendor details, numeric lifetimes, retention durations, and executable schema generation are legitimately gated/deferred. Their absence is not a finding here.

## Findings closed in the final recheck

### SS-1 — Separate upload workflow identity from command idempotency (closed)

- **Lens:** adversarial
- **Location:** Proposal SC-2, lines 35–36; SC-4 Prepare/Transfer/Commit, lines 63–65; spine AD-19/20.
- **Trigger condition:** Prepare succeeds and the client then commits or resumes that upload using the same logical “operation.”
- **Two compliant units:** The upload client reads “reusing the operation resumes verified bytes” and “query the original operation receipt” as one `operation_id` across Prepare and Commit. The generic command service records the successful Prepare receipt and rejects Commit with the same key and a different typed payload, as SC-2 requires. Conversely, a client inventing unrelated IDs for every stage may create another staging upload after a lost Prepare response. Neither unit has been given a shared distinction between a workflow ID and a command ID.
- **Guard snippet:** Introduce a stable `upload_id` (or transfer ID) for the multistage workflow. Give Prepare and Commit separate stable command `operation_id`s, with immutable canonical payloads and receipts; define which receipt is looked up for each uncertain outcome. Chunk acknowledgments belong to the upload, not the command receipt. Changing selected bytes creates a new upload/version and fresh command identity; restarting an interrupted transfer does not. Specify expiry/cancel/commit terminal transitions and retention of a successful Commit outcome.
- **Potential consequence:** A valid publication conflicts with its own Prepare receipt, an uncertain Commit is confused with a successful Prepare, or a retry produces duplicate staging/publication work.
- **Conformance witness:** Lose Prepare response; retry its original ID; transfer; lose Commit response; retry/lookup Commit's original ID. Exactly one shared registration appears and every consumer identifies the same committed version. Same command ID with changed bytes conflicts.

**Final resolution:** SC-4 now uses `upload_id` for workflow correlation, distinct immutable Prepare/Commit command IDs and receipts, explicit chunk keys, and Commit-specific receipt lookup. The producer/consumer identity disagreement is closed. Detailed upload terminal-state and timeout fixtures belong to the shared schema package.

### SS-2 — Distinguish authorization dependencies from review-completeness context (closed)

- **Lens:** adversarial
- **Location:** Proposal SC-3, lines 49, 51 and 56; SC-4, lines 66–70; SC-5, line 83; spine AD-15/17/20.
- **Trigger condition:** A package contains an authorized artifact but missing, unavailable, or prohibited context.
- **Two compliant units:** A manifest producer treats every evidence/Method/policy reference in the reviewed basis as a conjunctive authorization dependency; the service therefore denies the combined object. A materializer treats a missing context component as a partial-review condition and expects the authorized artifact plus component statuses. Both interpretations respect the document's fail-closed rules, but disagree on which references are authorization dependencies and which only establish review completeness. The text does not define that classification. This is not permission to omit a protected source dependency: SC-3/5 already prohibit that.
- **Guard snippet:** Define per-component immutable manifests with explicit protected-source authorization dependencies, review-required context, and optional contextual references. The producer cannot mark a relied-on protected source optional to escape lineage checks. Missing required authorization denies the dependent component/combined output before bytes are disclosed. Missing review context may permit independently authorized components to be shown as partial, with full review blocked. Specify whether authorized manifest projections preserve an original basis digest plus projection digest, and avoid revealing inaccessible component names/IDs through partial-status metadata.
- **Potential consequence:** Interoperable handoff fails unnecessarily, or a component-only reader exposes a derived artifact after its protected source has been denied while believing “partial” is sufficient protection.
- **Conformance witness:** Test separately an absent optional attachment, missing review-required evidence, and revoked protected source dependency. The client and service must agree on byte visibility, metadata visibility, component status, and full-review eligibility for each.

**Final resolution:** SC-4 now defines domain/policy-validated `authorization_dependencies` separately from `review_context`; denied/unknown authorization dependencies block the containing object, while missing authorized review context yields incomplete-review status. An untrusted author cannot select a classification to bypass lineage. The main classification ambiguity is closed. Manifest projection/metadata-redaction fixtures remain implementation checks under the existing non-disclosure rules.

### SS-3 — Fence delayed successful replies after invalidation or connection loss (closed)

- **Lens:** adversarial
- **Location:** Proposal SC-5, lines 76–82; SC-1 principal/session revisions at line 24; spine AD-21.
- **Trigger condition:** A successful authority response or materialization completion is delayed until after the client has processed a newer withdrawal event, disconnected, logged out, or replaced the run.
- **Two compliant units:** The service serializes the check before revocation and returns success for epoch `e`; that response is valid under its ordering contract. The host freezes on the later event/connection loss as required, but its pending success callback subsequently marks the object usable or resumes work because it performed the required service check. A second host discards that callback and requires a fresh check. The proposal describes the individual operations but supplies no response-to-invalidation precedence rule. Its already-transmitted exception must not become a mechanism for resurrecting a locally frozen run.
- **Guard snippet:** Bind every pending check/stream/handle to principal/session revisions, Workspace epoch, a host connection/invalidation generation, and run identity. A client never decreases observed revision floors. Invalidation, channel loss, logout, and run replacement advance the relevant local generation and invalidate pending work. Accept a reply/completion only if those bindings still match and its epochs meet the current floors; otherwise discard/quarantine and revalidate. Treat an invalidation as a demand to reevaluate exact access, not proof that an unrelated or alternate valid grant is revoked.
- **Potential consequence:** Out-of-order callbacks reopen revoked cache entries, reveal buffered output, or resume shared-derived agent work while offline after the freeze already occurred.
- **Conformance witness:** Delay epoch-`e` success; deliver epoch-`e+1` withdrawal first; then release the response. Repeat with disconnect, logout, and a fresh run replacing the old run. No old callback can unfreeze the new state. A currently valid alternate grant can resume only after a new successful check.

**Final resolution:** SC-5 now maintains monotonic principal/session/Workspace revision floors and a local connection/invalidation generation. Old-generation or older-revision responses are discarded; reconnect requires a new snapshot and explicit run revalidation. The delayed-success unfreeze counterexample is closed.

### SS-4 — Preserve idempotency knowledge across a database rollback (closed)

- **Lens:** adversarial
- **Location:** Proposal SC-2, line 36; SC-6, lines 88 and 92–94; spine AD-19/22.
- **Trigger condition:** Restore predates a successfully acknowledged command but the client or a downstream consumer still remembers its result or retries its operation ID.
- **Two compliant units:** The restore unit reconstructs complete current authority/deletion restrictions, revokes old sessions, checks blobs/indexes, and reopens; the restored database nevertheless lacks a later successful command receipt. The command unit sees no receipt and the restored expected revision matches, so it treats the old ID as a new command. A client using the durable receipt contract expects the recorded result or explicit uncertainty, not a new resource/event. The protected restore journal currently proves authority/deletion continuity, not outcome-receipt continuity.
- **Guard snippet:** Explicitly bind restore recovery to command/outcome high-water marks as well as authority restrictions. Either recover committed receipt/outbox identity from a suitably durable record, or expose a new service-incarnation/recovery boundary and classify affected pre-boundary operations as uncertain until reconciled; absence of a receipt from a rolled-back store is not proof that an operation never occurred. Preserve/reconcile resource and event identities before reexecution. The chosen retention/recovery mechanism remains subject to policy; it must not imply exactly-once external delivery.
- **Potential consequence:** A retried submission/note/share produces a second logical event or different resource identity after recipients already observed the first, despite the client obeying the same-operation-ID rule.
- **Conformance witness:** Commit and acknowledge a share or note; let a downstream consumer observe it; restore a snapshot predating the command while replaying a complete authority journal; sign in again; retry the original command ID. Observe the original reconciled outcome or explicit uncertain recovery—not an unnoticed second logical operation.

**Final resolution:** SC-2 adds `command_epoch`; SC-6 reconciles a command receipt/high-water journal, rotates the epoch before reopening, makes old-epoch IDs lookup-only, blocks scopes with missing journal coverage, preserves uncertain operations, and requires tombstones/closed epochs when compacting receipts. A restored absence cannot silently authorize replay. The restore/idempotency counterexample is closed.

## Findings closed in the earlier recheck

These are recorded to preserve the adversarial checks, not to imply current defects. The revised proposal text closes each at architecture altitude; actual conformance remains untested.

### SS-5 — Bootstrap identity proof ownership (closed)

- **Lens:** adversarial
- **Location:** SC-1, revised line 21; SC-2, revised line 34.
- **Trigger condition:** Native OIDC sign-in must mint the first Inquello session before any Workspace/session credential exists.
- **Two-unit counterexample:** Desktop validates a provider token and sends parsed claims; service expects a code or signed token and a server-bound nonce. The original text did not select the exchange boundary.
- **Guard snippet implemented:** A separate pre-Workspace one-use login transaction binds issuer/client/redirect/nonce. Host exchanges the code; service independently validates the ID token and transaction, atomically consumes it and creates a session. Lost credential response requires a fresh sign-in, not a credential-bearing receipt replay.
- **Potential consequence addressed:** Incompatible bootstrap implementations or trusting client-parsed identity rather than service-verified proof.

### SS-6 — Refresh retry conflicts with receipt replay (closed)

- **Lens:** adversarial
- **Location:** SC-1, revised line 24; SC-2, revised lines 34–36.
- **Trigger condition:** Refresh rotates successfully but its response is lost.
- **Two-unit counterexample:** Generic mutation client retries the same ID expecting the recorded result; refresh service treats reuse of the old credential as replay and revokes the family.
- **Guard snippet implemented:** Bootstrap/refresh are explicitly outside ordinary receipt replay. An uncertain refresh discards the family, attempts bounded revocation if possible, and requires fresh sign-in. General receipts never return raw access/refresh credentials. Principal-scoped session management is distinguished from Workspace commands.
- **Potential consequence addressed:** Legitimate retry unexpectedly revokes a session or a generic receipt store becomes a credential-recovery channel.

### SS-7 — Session/principal withdrawal ordering (closed)

- **Lens:** adversarial
- **Location:** SC-1, revised line 24; SC-2, line 37; SC-6, line 92.
- **Trigger condition:** Global logout/disable races with a protected operation in one of multiple Workspaces.
- **Two-unit counterexample:** Session service revokes independently while resource service serializes only Workspace epochs and commits using its previously checked session state.
- **Guard snippet implemented:** Principal and session revocation revisions, a shared principal → session → Workspace epoch → resource lock order, serialization for reads/mutations, durable principal/session invalidations, and restore-journal coverage of those revocations.
- **Potential consequence addressed:** An operation commits from a stale globally revoked session even though its Workspace grant epoch did not change.

### SS-8 — Action-specific dependency rights (closed at this altitude)

- **Lens:** adversarial
- **Location:** SC-3, revised line 56; SC-5, line 83.
- **Trigger condition:** A reader with permission to read or derive requests export or sharing of a mixed-source output.
- **Two-unit counterexample:** One authorization unit interprets “rights to both sources” as read permission; another requires the relevant export/delegation rights.
- **Guard snippet implemented:** Target action plus action-specific dependency permissions are required; export and share do not follow from read, and a missing required dependency action denies the combined object. Exact wire-policy fields/fixtures remain implementation deliverables. SS-2 separately addresses how components are classified as dependencies.
- **Potential consequence addressed:** A derived artifact broadens export/share permissions beyond its sources.

### SS-9 — Lineage arrives too late for basic sharing (closed)

- **Lens:** adversarial
- **Location:** SC-6, revised line 89; SC-4, lines 65 and 70; spine AD-16.
- **Trigger condition:** Sharing and active-agent revocation ship before institutional memory.
- **Two-unit counterexample:** Sharing requires lineage validation while persistence defers every lineage record until the memory story, forcing either blocked sharing or local ad hoc lineage semantics.
- **Guard snippet implemented:** Minimum source-version/dependency lineage is introduced with artifact registration/sharing and revocation; admission/index extensions arrive later with memory.
- **Potential consequence addressed:** The first shared run has no authoritative dependency closure to enforce revocation or determine whether allegedly private offline work is independent.

### SS-10 — Prove restore-journal completeness (closed)

- **Lens:** adversarial
- **Location:** SC-6, revised line 92; spine AD-22.
- **Trigger condition:** A backup and independently protected journal checkpoint have different recovery cutoffs.
- **Two-unit counterexample:** Restore accepts the newest checkpoint available to it while the journal writer has newer committed revocations not present there; no shared definition established proof of “current.”
- **Guard snippet implemented:** An authenticated high-water mark for all committed authority/deletion events, no-gap proof after the restored snapshot, inclusion of principal/session revocations, and write freeze or catch-up to a consistent live boundary. Failure to establish completeness keeps the service unavailable.
- **Potential consequence addressed:** Historical grants or sessions resurrect after a technically successful backup restore. SS-4 separately addresses non-authority command receipts.

## Review limits

No live service, product code, security test, restore exercise, dependency installation, or new policy approval was performed. All ten closure changes remain proposed contract clarifications, not adopted decisions. The same producer/consumer fixtures must be run by the actual independently built units before a capability claim. This review does not certify the implementation, actual host isolation, recovery route, or owner adoption.
