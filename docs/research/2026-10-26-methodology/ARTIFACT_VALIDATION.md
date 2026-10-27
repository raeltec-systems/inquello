# Artifact handling and reviewable writeback

Checked October 26, 2026 using primary Microsoft documentation. **All validation cases below are proposed and unexecuted.** No Office application, audit platform or connector was operated. No implementation/library has been selected. These findings preserve the accepted shared-saved-file baseline.

## Findings and boundaries

| Finding | Evidence | Audit implication / remaining proof |
| --- | --- | --- |
| Formula text and cached calculated values are different saved fields. | [SpreadsheetML formulas](https://learn.microsoft.com/en-us/office/open-xml/spreadsheet/working-with-formulas) | Reading a cached number does not prove recalculation against current inputs. Record formula/value/input version and calculation status. |
| Live Office APIs use proxies and asynchronous synchronization with the running document. | [Office API model](https://learn.microsoft.com/en-us/office/dev/add-ins/develop/application-specific-api-model) | Saved-file access does not establish visibility into unsaved edits or live selections. Editor integration is an additional mechanism. |
| File formats preserve different capabilities: `.xlsx` cannot contain VBA; `.xlsm` can. | [Office formats](https://learn.microsoft.com/en-us/office/compatibility/office-file-format-reference) | Preservation and execution of macros are separate. Formulas, pivots, links, protection, signatures and macros need format-specific round-trip evidence. |
| Tracked changes carry author/date/type/location and accept/reject operations; turning tracking off leaves existing revisions. | [Word tracked changes](https://learn.microsoft.com/en-us/office/dev/add-ins/word/manage-tracked-changes) | Preserve review semantics as well as visible text. Platform requirements and the documented “Unknown” attribution on a web insertion path need explicit testing. |
| Comments and tracked revisions are distinct feedback channels. | [Word feedback](https://support.microsoft.com/en-us/word/give-and-receive-feedback-in-word) | Resolving a comment, accepting a revision and approving an audit workpaper are different actions. |
| SharePoint list-item updates support `If-Match`; an outdated eTag produces 412 without updating the item. | [Update listItem](https://learn.microsoft.com/en-us/graph/api/listitem-update?view=graph-rest-1.0) | Concrete precedent for detecting a stale reviewed change. Verify each audit destination's own contract; this is not evidence of Diligent support or exactly-once creation. |
| Graph workbook sessions can persist or not persist changes; operations without a session header still persist changes. The documented create-session endpoint does not support application permissions. | [Workbook sessions](https://learn.microsoft.com/en-us/graph/api/workbook-createsession?view=graph-rest-1.0) | A session is not automatically a draft/approval transaction. Check identity support for each attended/unattended route; do not generalise this endpoint's limitation to all Graph. |
| Excel asynchronous operations can return HTTP 200 with a failed operation body; some conflicts need resolution and some sessions must be discarded. | [Excel API errors](https://learn.microsoft.com/en-us/graph/workbook-error-handling) | Inspect work status and resulting state, not transport success alone. |
| A failed response can follow a successful non-idempotent action. | [Retry pattern](https://learn.microsoft.com/en-us/azure/architecture/patterns/retry) | Correlate and reconcile uncertain outcomes before retry; choose a destination-supported idempotency or uniqueness strategy. |
| Resumable uploads distinguish transferred ranges from final completion. | [Upload sessions](https://learn.microsoft.com/en-us/graph/api/driveitem-createuploadsession?view=graph-rest-1.0) | Upload progress does not prove a committed destination file or accepted audit record. Inspect endpoint-specific conditional-write and sensitivity-label restrictions. |

These sources establish mechanisms and risks to test. They do not demonstrate this future product's file fidelity, performance, identity eligibility or audit quality.

## W1 — Reconciliation and continued work in Excel

**Synthetic inputs:** ledger `R1=1000, R2=1500, R3=500, R4=900, R5=700` (five rows, total 4,600); bank `R1=1000, R2=1500, R3=500, R3=500, R4=950, R6=300` (six rows, total 4,750). Match one-to-one by reference and amount; preserve repeated references. Include a workbook template with total formulas, a named range, a comment and an unrelated formatted sheet.

Assign stable source IDs L01–L05 and B01–B06 in the listed order. For this fixture, match equal reference/amount candidates by ascending source ID: L03 matches B03, leaving B04 as the extra R3 entry. This tie-break rule is a fixture choice, not a universal matching policy.

**Known result:** three exact matches; R4 has a 50 difference; one extra R3 bank entry is 500; bank-only R6 is 300; ledger-only R5 is 700. Explained bank excess is `500 + 50 + 300 - 700 = 150`. Every exception must identify its source row, including which duplicate remained unmatched.

**Change/failure cases:**

1. Auditor changes saved R5 to 800: identify the previous output as stale, obtain ledger total 4,700 and bank excess 50.
2. Formula cache remains 4,600: do not represent that cached result as newly calculated.
3. Another editor changes an unrelated sheet before saving the agent's output: preserve the edit or report a conflict, rather than overwriting silently.

**Evidence to collect:** reopened workbook; source row counts/totals; formula and calculated-value comparisons; named-range/comment/format inspection; clear input versions; no operational transaction updates. Also record human correction time and tool/model/compute usage without setting arbitrary cost targets.

## W2 — Procurement workpaper and human review

**Synthetic inputs:** policy v1 requires two approvals before orders above 5,000. Order is 7,800. Approval A predates the order; approval B follows it. Existing `.docx` includes a comment, tracked deletion, footnote, table and evidence bookmark.

**Known result:** describe one evidenced prior approval and one later approval. A claim that no approval existed is wrong. The criterion, dates and supporting references must be inspectable; this fixture is illustrative, not a universal audit criterion.

**Change/failure cases:**

1. Reviewer rejects wording: revise it while preserving unrelated tracked changes and comments.
2. Policy v2 raises the threshold to 10,000: establish its effective period before reassessing; do not silently substitute it for v1.
3. Another editor moves the cited passage: retain a valid reference or identify it as broken.
4. A host route cannot preserve revision author attribution: surface the limitation; do not invent authorship.

**Evidence to collect:** reopened document, intended-change comparison, retained review metadata, functioning references and applicable policy version. Human professional approval stays pending until the authorised reviewer acts. Record correction effort and unsupported document features.

## W3 — IT access review with approved remote update

**Synthetic inputs:** HR has E01–E05; E02 was terminated before the test date and the other four remain active. Seven accounts: A1/E01 enabled; A2/E02 enabled; A3/E03 disabled; A4/E04 enabled; A5/E99 enabled; A6/service account owned by E05 enabled; A7/E01 enabled. Fixture rules permit multiple accounts per person and owner-approved service accounts. The fixture includes E05's documented approval for A6, effective before and valid through the test date.

**Known result:** flag A2 for enabled access after termination and A5 as unmatched to HR for investigation. Do not automatically flag A6 or discard A7. Preserve the seven-account population and distinguish evidence from a confirmed final finding.

**Writeback/failure cases:**

1. Prepare a proposed update to an existing finding, displaying destination identity, fields, evidence and reviewed version.
2. Another reviewer changes that record before submission: detect the stale proposal where the destination supports it and return it for review.
3. The destination applies the update but the response is lost: reconcile remote state before retrying; leave unresolved outcomes explicit.
4. Credentials are revoked: preserve local work and report that changes were not confirmed delivered.

**Evidence to collect:** only the approved changes applied; unrelated fields preserved; destination IDs and versions; read-back confirmation; operation correlation and no duplicate effects. Endpoint support and authorisation need an actual named target before execution.

## Applying the accepted record-mode decision

Run the external-record cases for V1. Built-in-record and mode-migration cases are V2 validation and do not gate V1 acceptance. Q3 A chooses authority at organisation/workspace level when V2 introduces the built-in alternative; individual engagements do not silently switch the selected mode. The mode concerns audit records, not replacing the ledger/HR/ERP source of transactional facts.

For V1, validate workbench-held material and delivery/sign-off confirmation in the external authority. V2 additionally validates native record retention/sign-off, organisation/workspace mode precedence and migration. These fixtures are validation specifications, not an implemented record-state model.

## Still needed

- Actual team walkthroughs and permitted example artifacts across contrasting practices, including advisory/external-audit cases beyond these initial fixtures.
- PowerPoint-specific checks for themes, charts, speaker notes, linked objects and review metadata; none were run here.
- Named audit-system contracts for versions, retries, identities, updates, deletes, exports and permissions.
- Supported Office versions and file features; preserved originals and independent expected outputs.
- Change/cancellation/recovery trials, scale measurements and actual processing policy.

U3/U5/U6/U10 remain partially answered. This pass establishes what to test and why; it does not claim that any candidate tool passed.
