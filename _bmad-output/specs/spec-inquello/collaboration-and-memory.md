# Collaboration, institutional memory and review contract

Confirmed owner decisions, 2026-10-27. This companion refines existing V1 capabilities; it removes no inventory scope and creates no V1 native authoritative audit records. Older OQ-2/OQ-3 wording that made all retained extracts visible throughout a Workspace, or applied identical recall rules to internal and external audit, is explicitly superseded.

## Local work and shared authority

- The desktop hosts agent tools and works with local files; cloud-model inference still needs its model connection, for private as well as shared Tasks. Local storage/execution does not mean offline AI. A shared Inquello service owns Inquello identity, memberships, effective permissions and shared-work/review coordination. Provider sign-in authorises inference, not team access.
- A Task starts private to its creator, including instructions, drafts and conversation. Membership in a Workspace or Engagement is not a grant to private Tasks.
- A file, folder or review package can be explicitly shared without its entire Task/conversation. Sharing a whole Task is a separate explicit action with audience and included content visible. Neither action silently broadens another grant.
- Sharing names the artifact/version and required supporting context, intended recipients and allowed actions. Recipients must actually retrieve the authorised bytes/context on their own computer through a supported route; a sender-local path or a link without recipient access is not a usable handoff. Missing or prohibited evidence is shown as missing, never as reviewed.
- No automatic upload of all source files. Retain source references and relied-on extracts/derivations under policy; explicit sharing of a selected artifact/version is not blanket source replication. The concrete transfer/storage contract is SC-3/4 in the architecture companion under the adopted OQ-16A direction; actual-route eligibility remains OQ-16B.
- Shared review coordination is not a native authoritative audit-record system. V1 formal acceptance follows the designated external authority; shared coordination history is labelled accordingly.

## Admission and retrieval of institutional memory

| Stage | Required rule |
|---|---|
| Admission eligibility | Formally issued or explicitly team-shared work becomes eligible automatically. Useful shared work from an ongoing engagement qualifies; completion of the audit is not required. |
| Exclusion | Private exploratory drafts, private preparer/reviewer conversations and unshared extracts remain excluded. Retention alone never admits material to shared knowledge. |
| Scope | Knowledge is team-wide across engagements and different auditors of the same internal-audit company Workspace, including prior findings, their status and context. It is not limited to the current auditor's own history. No cross-company Workspace leakage. |
| Controls | Generic memory contribution/use controls remain separate and cannot widen admission eligibility or current grants. Eligible means permitted for admission, not guaranteed indexing/completeness or a finding of present relevance. |
| Provenance | Preserve origin, source/version, relevant period, finding/status history, changes and applicable access. Distinguish issued status from ongoing shared work and superseded material. |
| Retrieval | Check current access to source and derivation lineage at retrieval/use, including already retained summaries and caches. If provenance/access cannot be established, withhold the affected content rather than expose it as unqualified team knowledge. |
| Investigation | Historical recall supports investigation, comparison and locating prior work. It does not establish a current or repeat finding; current evidence and Method must support that conclusion. |
| External audit | Do not assume internal-company team recall defines external-audit client confidentiality or independence boundaries. OQ-15 gates external-audit cross-client use. |

## Minimum revocation in the first team-enabled increment

1. Workspace removal blocks subsequent shared retrieval and recall through that Workspace. Share withdrawal removes that grant route; another current valid grant can still authorise access.
2. Active agents cease use of revoked material. Continued work must re-establish a valid basis or stop the affected activity; cached context is not permission.
3. Retained extracts, derived summaries/embeddings, search indexes, caches, logs and export/recovery paths must not leak revoked content. Provenance-aware restriction, invalidation or removal must cover the actually enabled routes before they ship. Controls must address derivatives, not only source URLs.
4. Already downloaded/exported copies outside service control cannot be magically recalled. Communicate that limit before sharing and on withdrawal; do not claim remote erasure.
5. Advanced unattended-job ownership transfer/reassignment can follow with automation, but a running enabled agent cannot continue using revoked material. Disabled future automation is not an excuse to defer current sharing/review revocation.
6. V1 access/retention/deletion/export/recovery controls apply to held working material. V2 authoritative hold/amendment/native-record policy remains V2.

## Agent-assisted review loop

| Step | Contract and observable result |
|---|---|
| Submit | Preparer explicitly shares a named artifact version plus permitted evidence, Method/version/parameters, actual coverage, limitations, decisions needed and handoff summary. Submission does not expose the preparer conversation by default. |
| Private reviewer Task | Reviewer starts their own private Task anchored to the submitted version and accessible supporting evidence. The agent verifies what it can access and declares missing support before drawing conclusions. |
| Reperform and challenge | Agent uses tools to redo computations from sources; checks Method application and actual coverage; challenges conclusions, omitted or contradictory evidence; compares permitted historical findings with period/status/change context. Repeating the preparer's narrative is not reperformance. |
| Issue human-selected notes | Agent drafts notes anchored to precise cells/ranges/passages/evidence/version, explaining the issue, basis, uncertainty and requested resolution. Human selects what is issued; unselected drafts and private reviewer thoughts stay private. |
| Prepare revision | Preparer agent helps investigate and resolve issued notes. It produces a new candidate version, per-note disposition and clear handoff/change-impact summary, not a silent edit of the submitted artifact. Human controls sharing/resubmission. |
| Recheck impact | Reviewer agent checks changed and consequentially impacted work, including changes to evidence, Method, coverage and conclusions. Uncertain impact widens the recheck; byte equality or missing dependency information is not proof of no impact. |
| Accept | Human retains professional acceptance under actual authority and the applicable external record process. Agent agreement, role separation or two agent passes does not establish professional independence. |

## Delivery checkpoints and planned negative cases

The epic plan must place dependencies before consumers and retain old-to-new traceability. The first end-to-end engineering checkpoint covers local workbook analysis, same-file Excel edits, recomputation/stale detection, explicit accessible review handoff, reviewer-agent challenge, human-selected notes, preparer revision, impact-aware recheck and export. This is a build checkpoint, not a restriction on the team's eventual validation task choices, Word/PowerPoint/CSV support or full V1 capability scope.

Planned checks include private Task exclusion; artifact-only sharing without conversation; recipient-computer retrieval; team recall of another auditor's prior/shared-ongoing engagement; private-draft exclusion; historical/current distinction; Workspace removal; withdrawn grant with and without an alternative valid grant; active-agent revoked context; derived-data/cache/export leakage; unavailable evidence; changed Method with unchanged artifact bytes; contradictory evidence; and uncertain impact causing broader recheck. No runtime test has been run by this planning update.

## Open implementation and policy gates

- **OQ-15:** external-audit client/independence boundaries, before external-audit cross-client memory use. Product/audit/data-policy roles are proposed owners, not appointed people.
- **OQ-16A resolved:** clarified technical direction adopted 2026-10-27; AD-18–22 / SC-1–6 provide architect-derived enforcement details. This is not supplier, region, spending or implementation approval.
- **OQ-16B:** actual issuer, service operator/vendor, spend, region, retained-data policy, backup/recovery and route eligibility remain real-data/deployment gates. Proposal adoption does not authorize these commitments.
- Existing provider eligibility, desktop/fork compatibility, source-format support and operating gates remain. A document check does not pass runtime, security, service or release gates. The readiness workflow must distinguish first-story blockers from later-route prerequisites.

## Connectivity clarification — 2026-10-27

Loss of the cloud-model connection pauses affected agent work regardless of Task privacy. Shared-derived use additionally requires current Inquello authority, so a service outage can block shared work even when inference remains reachable. Preserve supported progress and revalidate on recovery; no silent resend or local-model fallback. Local models are not a current priority. Manual use of independent applications on permitted private files is not a promised Inquello offline editor. The owner subsequently adopted the clarified direction in Sentinel_f111d58b637c8191a30a23234ec55314. A separate eligible private-only Task is distinct from relabelling a shared-derived context; the latter never bypasses current-access checks.
