# Approved epic reconciliation structure — story review pending

Baseline: df5b14f73f4742afbd66d3ad633ca9d8d84988c7, 89 stories, 55 tagged I1 / 29 I2 / 5 V2. This inventory is a proposal for workflow discussion, not an adopted epic sequence or validated implementation plan. Prepared through installed epic-workflow Step 2. Owner approved the presented structure with “this structure makes sense” (Sentinel_36c7981e56488191829acb20a782001e, 2026-10-27 17:02 UTC), answering the structure question in Sentinel_d6af056737548191a30803dff21351fe. This is explicit continuation, not a literal typed C. Detailed story review and final validation remain pending. The existing epics document remains the prior story baseline plus confirmed requirement corrections until this structure is approved.

## Findings

- 1.4–1.8 depend on own identity/authority from 2.1–2.7; membership cannot expose every member's private Tasks.
- 1.5 assumes a runnable selected Method supplied only in 7.1–7.3; 3.6 similarly assumes Method parameters.
- 3.5 writes W1 and preserves workbook features and external edits before 4.1/4.4 deliver them.
- 4.5 explicitly derives inference facts from Epic 8 (8.5).
- 5.3/5.5 require actual Method identity/version/change-impact from 7.3/7.4.
- 2.7 cross-engagement memory succeeds before 9.4 exists. Its unrestricted success case also violates the newly confirmed admission/access boundary.
- 2.7 route proof, 8.5 eligibility and multiple earlier stories require the register only built in 14.3. Split register infrastructure from per-capability population, and seed test runners early; run tests when the corresponding route exists.
- 14.4 promises first-increment revocation while 12.1 postpones it entirely; 12.3 postpones all retained-data controls despite extracts/index/history already held.
- Whole-Task privacy, granular file/folder/package shares, accessible recipient content and private reviewer agent Tasks are not delivered by old 11.8 conversation snapshots or old 5.1 alone. Add explicit stories/acceptance, not label old dashboard stories as sufficient.
- V2 15.2 migration precedes native record/link/lifecycle capability in 15.3/15.4. Reorder those before migration. 15.5 is a planning revisit, not ready-for-dev implementation.

## Candidate groups with exhaustive old-ID coverage

Split suffixes designate acceptance subsets, not proposed final story IDs. Each group must be sequenced internally by dependencies; do not preserve the numeric order of its listed old IDs automatically.

| Candidate group | Old-story origins | Phase / end-to-end outcome |
|---|---|---|
| G1 Secure private desktop work | 1.1–1.4, 1.5a, 1.6a, 1.7–1.9; 2.1–2.5a, 2.6a, 2.7a; 4.5a; 8.1, 8.5a, 8.6; 14.3a; 12.3a | I1. Selected fork/host, identity, authority, local retained-data floor, capability register and route facts precede first private Task execution. Minimal Task start has no selected Method yet. Synthetic authorization tests precede real data enablement. |
| G2 Attributable analysis with Methods | 3.1–3.4a, 3.6–3.7; 7.1–7.3; 8.2–8.3; 6.1; 1.5b, 1.6b, 2.6b | I1. Actual source provenance and executable analysis, Method selection/departures, research and mandatory checks. Completes full old Task-start and M1 evidence-instruction acceptance. |
| G3 Editable artifacts and same-file recomputation | 4.1–4.4, 4.6a, 4.7; 3.5; 7.4 | I1. Workbook creation before W1; same-file Excel edit/recompute, also preserve original Word/PPT/CSV coverage; Method impact known before review. |
| G4 Accessible team sharing and institutional continuity | NEW granular artifact/folder/package sharing + explicit whole-Task sharing; 9.4; 12.1a, 12.3b; 2.7b; 5.4 | I1. Two different auditors/computers can access exact submitted material, team-wide admitted memory and current grants; membership removal/share withdrawal stop retrieval/recall/active use. No automatic conversation disclosure. |
| G5 Agent-assisted review, revision and export | 5.1–5.3, 5.5, 5.6a; 13.3; 14.1a, 14.2a, 14.4a | I1. Reviewer private Task anchored to submitted version, tool-based reperformance, human-selected notes, preparer-agent resolution, reviewer recheck and human acceptance. Workbook-to-Excel-to-review-to-export is a checkpoint, not reduced eventual validation scope. |
| G6 Full first-increment practice and delivery-contract validation | 13.1–13.2, 13.4–13.5; 14.4b | I1. Practice-neutral planning/evidence requests/responses/retests plus W3 fixture update and full original I1 validation breadth. Fixture delivery is not production adapter proof. |
| G7 Local browser and demonstration capabilities | 6.2–6.4; 7.5; 3.3b browser portion | I2. Local browser/Computer Use supplied before demonstration-to-skill. |
| G8 Additional environments and hosted outputs | 4.5b, 4.6b, 4.8 | I2. Remote/cloud/worktree/hosted output scope retained behind named route eligibility gates. Shared collaboration service does not by itself supply hosted agent execution. |
| G9 Extended routes, tools and specialist capabilities | 8.4, 8.5b; 2.5b; 3.3b composer portion, 3.4b; 5.6b | I2. Remaining providers, dynamic tools, Code Mode, prompt inspection, predictions, scans/backlog/specialist eligibility retained explicitly; each has its own test gate. |
| G10 Delegation, branching and longer continuity | 9.1–9.3, 9.5 | I2. Multi-agent delegation, forks, compaction and optional activity recall extend existing safe Task/memory controls. Reviewer agent work in G5 is not deferred pending this general parallel-delegation epic. |
| G11 Secondary clients, convenience and snapshot sharing | 11.1–11.8 | I2. All eight retained; 11.8 remains explicit read-only conversation snapshot, not the only way of sharing artifacts. |
| G12 Bounded unattended and service-triggered work | 10.1–10.5; 12.1b, 12.2 | I2. Service identity, token revocation and reassignment/orphan control before unattended enablement; duplicate-effects and event tests when route exists. |
| G13 Extended administration and operational reporting | 12.3c, 12.4 | I2. Broader retained-material administration/backup/unattended categories and analytics, without deferring the controls needed by G1/G4. |
| G14 Named external-record delivery | 13.6 | I2. Production adapter selected and validated against earlier W3 contract, distinct from first-increment import/export. |
| G15 Cross-surface integration acceptance | 14.1b, 14.2b, 14.3b, 14.4c | I2/full-V1 closeout. Extends context/state/harness for newly enabled routes. Crucially register/contract population and negative tests ship WITH each earlier enabled route; they must not await G15. |
| G16 Native records and deliberate migration | 15.1, 15.3, 15.4, then 15.2 | V2. Decide record-policy gate before implementations; establish native identity/lifecycle before migration. |
| G17 Hosted browser/sandbox decision revisit | 15.5 | V2 revisit only, no false implementation readiness. |

Every original old ID appears once as a whole or in explicitly disjoint split parts. Final traceability should list all 89 IDs individually and link each acceptance block; group ranges here are compact owner-discussion notation. The I1 count must change because memory/basic revocation/held-data controls move earlier and sharing/reviewer capabilities add/split stories. Do not retain 55/29/5 as a false revised tally.

## Gates and internal-order risks

1. G1 must place 1.1 fork foundation first, identity before membership-bound work, register skeleton before enabled-route contract, and a synthetic local permission test slice before first real-data route. Keep unresolved shared-service technology/identity protocol/deployment choices explicit. A frozen contract can support synthetic local skeleton work without proving production service readiness.
2. 1.5a cannot claim applied-Method acceptance; that belongs to G2. 1.6a cannot claim source-provenance completeness or artifact previews before G2/G3; split those acceptance clauses explicitly. A label-only split is not a dependency fix.
3. Revocation needs held-data protections for caches, indexes, derived memories and resumed active-agent context. G4 delivery must not be a local-path link. Already downloaded/exported copies cannot be recalled.
4. 14.3 and 2.7 are cross-cutting contracts/tests, not single late epics; avoid treating capability-specific future checks as prerequisites for unrelated initial code, or counting not-enabled paths as passed.
5. Broad Method-change/stale-review semantics require conservative unknown-impact handling; do not assert unchanged on inability to calculate impact.
6. External-audit client/independence boundary specifics are unresolved; internal company-wide recall cannot silently become cross-client recall for firms. Gate those routes rather than silently drop external-audit scope.
7. Research/version snapshots are not current toolchain proof. Initial implementation story still needs actual fork cut and compatibility check; document validation cannot satisfy it.
8. First reviewer checkpoint includes old Word/W2 requirements and full I1 still retains PowerPoint/visuals/research/practice workflows. Workbook checkpoint is build integration order, not permission to narrow user validation choices.

## Proposed requirement coverage

| Group | FR coverage (partial rows are completed by later named groups) |
| --- | --- |
| G1 | FR-1, 2, 3 desktop, 7/8 basic private Task, 5 local facts, 21 discovery, 29 initial routes, 30, 33 policy, 34 initial input trust, 37 enabled local data, 44 register; OQ-14 identity |
| G2 | FR-7 full input/Method execution, 9, 10 initial context, 11 analysis, 12 coverage, 15 research, 19/20 Methods, 21 evidence identity, 22 hooks, 34 evidence trust |
| G3 | FR-6 local alternatives, 11/12 W1 completion, 13 all initial formats/external continuation, 14 visuals, 20 Method-change impact |
| G4 | FR-14 granular sharing, 27 admitted team memory, 32 explicit Task-sharing boundary, 33 current grants, 35 responsibility, 36 basic revocation, 37 shared held-data controls |
| G5 | FR-17 agent-assisted human review, 18 initial technical review, 35 human version attribution, 39 review/export, 43/44 first integrated boundaries/states |
| G6 | FR-39 practice workflows, 41 fixture destination, 44 first-increment acceptance |
| G7 | FR-10 browser context, 16 browser/site/computer actions, 19 demonstration |
| G8 | FR-5 remote environments, 6 worktrees, 14 hosted outputs |
| G9 | FR-10 predictions, 11 Code Mode, 18 full scans/backlog, 22 dynamic tools, 29 remaining routes, 33 specialist/prompt inspection |
| G10 | FR-25, 26, 27 compaction, 28 activity recall |
| G11 | FR-3 non-desktop, 4, 31, 32 migration/snapshots |
| G12 | FR-23, 24, 36 unattended revocation/reassignment |
| G13 | FR-37 extended categories/administration/reporting |
| G14 | FR-41 real destination adapter |
| G15 | FR-43, 44 full-V1 cross-surface acceptance; each route's own contracts/tests are earlier, not postponed here |
| G16 | FR-38, 40, 42 V2 only |
| G17 | OQ-13 hosted-browser/sandbox revisit, not promised implementation |

NFR-1–10 and UX-DR1–55 remain binding in every group enabling their associated routes/surfaces. This is a coverage proposal, not evidence that any capability is implemented. The complete per-story acceptance mapping will be derived only after approval; each original acceptance clause, including explicit deferrals, must map to a new story or remain an identified unresolved requirement.

**Completed Step-2 question (answered affirmatively as recorded above):** Do you approve this 17-group structure (six first-increment groups, nine remaining-V1 groups, two V2 groups) for detailed story regeneration, retaining the full scope and explicit original-to-new mapping? Select **[C] Continue**, **[A] Advanced Elicitation**, or **[P] Party Mode**, or request changes. This approval would authorise planning only; it would not approve implementation, technology/vendor/region/spend decisions or publication.

## Story-decomposition constraints for the next step

The group mapping is not a permission to preserve old within-epic order. In G1, old 1.5/1.6 are explicitly split: a plain private Task can run on a verified initial route, but selected Method, attributable file analysis and artifact preview acceptance waits for G2/G3. In G2, old 7.2 must separate Method definition/registration/selection from execution: define before the Method-bearing start extension, execute/check after the Task starts. Old 2.7 divides into current-route checks in G1/G2, admitted-memory/sharing checks in G4, and delegation/unattended checks alongside those later routes. Old 14.3 and capability-specific parts of 14.4 similarly expand with each route; G15 is cross-surface integration, not the first arrival of route contracts or tests. Any acceptance clause requiring an unbuilt capability must be split/reordered, never waived or marked passed.
