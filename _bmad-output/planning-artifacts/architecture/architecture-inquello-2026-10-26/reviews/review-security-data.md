# Security and data-integrity review

Date: 2026-10-27. Lens: independent final-gate review at initiative altitude.

Reviewed draft: `ARCHITECTURE-SPINE.md`, SHA-256 `1AB973BF8336883C72F9DD74CB04C59A5E602220C0CC0BEA50246C8880C82D02`.

**Verdict: revise two trust-boundary rules before finalization.** No critical finding. Two high-severity architecture omissions could allow independently built preview and runtime-tool features to implement incompatible authority boundaries. These are documentary findings, not demonstrated vulnerabilities in an implementation. No build, exploit, runtime security validation or compliance assessment was performed.

## S1 — High: untrusted previews are not explicitly separated from the trusted application bridge

**Location:** AD-5 (line 85), AD-6 (line 91), AD-8 (line 103).

AD-5 requires renderer sandboxing, context isolation, specific preload operations, sender validation and navigation/content controls. It does not say whether model-generated or imported artifact content can execute inside the trusted application renderer/origin or receive its preload operations. AD-8 separates evidence from instructions, but that does not settle the browser execution boundary. One team can sanitize/isolate preview content; another can run it in the application renderer while still using a sandbox and typed bridge.

**Counterexample:** a generated HTML report is opened in a preview containing active script and the application preload API. The report calls a permitted task/export operation from the expected renderer. Payload shape and sender checks succeed, and the host supplies the signed-in identity. The evidence has acquired application authority without a user choosing that action. The same ambiguity threatens a human-review operation if the trusted UI path does not remain distinct from preview content. Merely displaying a report can also start unapproved network activity.

**Exact minimal fix — append to AD-5:**

> Treat model, evidence, imported and generated artifact content as untrusted. Preview it without the trusted application's privileged bridge or authenticated application origin; active content, navigation and network effects require a separately permitted capability. Only trusted application interaction may submit human decisions; preview content cannot acquire that authority from the signed-in host.

This fixes the cross-feature boundary without selecting a sanitizer, browser-view API, content format, process layout or new approval ceremony. Passive inspection remains available; supported interactive artifacts remain possible through an explicitly constrained route.

**Verification intent:** an artifact attempting a privileged operation or automatic outbound request must not obtain it merely by opening its preview. The trusted application must still perform the intended operation through its declared path.

**Grounding:** PRD FR-13/14/33/34 and NFR-3/8; EXPERIENCE S02/S03/S10 and its separation of execution, edits, human review and delivery. Electron documents that bridge APIs are deliberately exposed to renderer content despite context isolation and advises against exposing Electron APIs to untrusted content. This finding is the inference that the spine must distinguish the privileged app UI from artifact content, not a claim that Electron isolation fails. [Context isolation](https://www.electronjs.org/docs/latest/tutorial/context-isolation), [Electron security](https://www.electronjs.org/docs/latest/tutorial/security).

**Disposition:** autofix the invariant; defer concrete preview implementation and negative tests to the existing implementation/capability gates.

## S2 — High: the protected store/credential rule addresses writes, but leaves raw read access open

**Location:** AD-7 (line 97), with AD-8 (line 103).

AD-7 explicitly keeps store/credential paths outside agent-writable roots. A read-only path remains readable, and a protected credential file can still be exposed through an arbitrary tool's environment. AD-8 requires effective source authority, but the spine does not establish that raw audit-store reads and privileged credential access must cross the same boundary as domain writes. This matters because the retained runtime intentionally supports shell/scripts and extensible tools; a directory placement is not itself the required enforcement.

**Counterexample:** the domain store and connector credential file live outside the writable workspace, satisfying the stated path rule. A generic read/shell tool can read that directory. It obtains another Assignment's records from the raw database, or copies a privileged connector credential into task output. The latter can then authorize direct remote requests without the permitted adapter's destination, version, mandate or reconciliation checks. No database write is necessary for either failure.

**Exact minimal fix — replace the protected-path sentence in AD-7:**

> Agent tools cannot directly read or write the protected audit store or write reviewer state; expose permitted working data and mutations through scoped domain operations. Enforce that boundary for every general tool/subprocess route, not merely by path placement. Broker host-held privileged credential use through permitted adapters without exposing those secrets to model context, general tool reads or inherited subprocess environments.

This applies to Inquello's protected working store and privileged host credentials, not to arbitrary user-authorized analytical databases or credentials deliberately supplied for a separate scoped technical task. It does not choose an operating-system credential store, encryption scheme, identity provider or service topology. Existing AD-8/11/12 still govern the actual permitted operation and its current authority.

**Verification intent:** read-only shell/script access cannot extract the protected store, privileged credential files or host credential environment. Scoped record access succeeds only for the effective Task/Workspace authority. Direct tool requests cannot use those host credentials to bypass the adapter's effect contract.

**Grounding:** PRD FR-33/36/37, NFR-3 and NFR-8; EXPERIENCE SP1/SP2/SP3; adopted separation of shared Rust domain ownership from runtime execution. The gap follows from the narrower writable-root wording, not from an assumed defect in the upstream runtime sandbox.

**Disposition:** autofix the invariant; keep OS isolation, credential-storage details and tool-route enforcement mechanisms under the existing implementation and OQ-9 gates.

## Areas with no additional independent finding

- **Model/evidence authority:** AD-6/8/10 appropriately separate evidence, Method guidance, runtime permission, provider credentials and human authority. S1 supplies the missing preview execution boundary; it does not require a universal professional-approval workflow.
- **Lower-level effects:** AD-8/11/12 already bind supported connector/browser/computer and unattended routes to current authority, permitted effects and reconciliation. S2 closes the explicit credential/store bypass. Actual invocation-level enforcement still requires capability-specific negative evidence; no separate finding is raised merely because detailed adapter mechanics are deferred.
- **Saved/live/remote state:** AD-7/9/11 retain distinct source states, expected versions, conflicts and uncertain outcomes. Cross-store transactions, automatic rollback and exactly-once delivery are correctly not asserted.
- **Revocation and mandates:** ongoing and unattended revocation is required. The parent has separately accepted the compatibility review's mandate-revision/current-revocation correction; it is not repeated here as a new finding.
- **Review applicability:** the parent has separately accepted the compatibility correction for evidence/Method changes invalidating a reviewed basis without artifact-byte changes; it is not repeated here.
- **Retention, recovery and backups:** FR-37 remains V1; AD-8/14, the operating envelope and OQ-2/8/9 cover held material, logs, backups and recovery before real-data/operational commitments. Policy values and concrete deletion/restore mechanics can remain gated at this altitude. No native V2 hold/lifecycle requirement is imposed on V1.
- **Persistence compatibility:** the parent is incorporating the independently identified SQLite WAL-reset fix gate and actual domain-runtime verification. It is not a novel finding in this review.

## Scope and evidence

Read-only review of the spine, memlog, final PRD/addendum, relevant DESIGN/EXPERIENCE contracts, and upstream/technology evidence. Only this report was written. AD-1–4, the full V1 scope, only FR-38/40/42 as V2, and the absence of a selected generic shared service remain unchanged. The two fixes establish minimum shared boundaries; all implementation and release claims remain unverified.

## Targeted closure — 2026-10-27

Revised spine SHA-256: `53C139F127D87A440BFB3EF97AC9AADE9D4FCFB7973B50F10DAA8084C89F772B`.

**Closure verdict: both findings resolved at architecture-contract level; no remaining blocker from this lens.** This section supersedes the initial revise verdict for the identified revised draft. The check was limited to the changed rules and their immediate authority/effect interactions; no broad rereview or runtime test was performed.

- **S1 — closed.** AD-5 now puts source/artifact previews in a distinct sandboxed security context without the workbench preload/domain bridge, privileged-origin navigation or inherited authority. Human decisions require trusted workbench interaction and effective human authority. AD-7 additionally bars agent-driven interactions from establishing human reviewer decisions. AD-8 continues to govern processing and action routes. These rules settle the independent preview/workbench trust boundary without selecting a preview implementation.
- **S2 — closed.** AD-7 now denies general agent tools and subprocesses direct protected-store/privileged-credential access, supplies permitted record access through scoped domain commands, retains credentials in trusted runtime facilities/adapters and requires enforcement in every enabled execution mode or gating of that route. Raw-secret disclosure to arbitrary tools, model context, artifacts, exports and logs is explicitly prohibited.
- **Legitimate capability scope preserved.** AD-7's restrictions concern the protected domain store and privileged credential storage. It expressly permits scoped domain reads and scoped authentication through trusted runtime facilities/adapters. It does not prohibit ordinary authorized working-file access, analytical tools or supported technical work; AD-9 retains supported saved-file behavior. The changes select no new generic service, identity provider or credential-storage technology.
- **Adjacent corrections remain consistent.** AD-6/9 distinguish immutable historical decisions from current reviewed-basis applicability; AD-11/12 bind effects to an authorized mandate revision while preserving current revocation and restrictive policy. Neither correction weakens S1/S2 or turns runtime identity into human acceptance.

Closure confirms the text now requires the necessary boundaries. Concrete isolation, credential handling, negative tests and route eligibility remain implementation/capability gates; this report makes no implemented-security, recovery, certification or release-readiness guarantee. The spine and memlog were not edited.
