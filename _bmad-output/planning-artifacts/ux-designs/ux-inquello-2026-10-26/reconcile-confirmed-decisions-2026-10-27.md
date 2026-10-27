# UX reconciliation — confirmed product decisions, 2026-10-27

The UX update preserves the selected visual system, all 13 surfaces, all eight journeys and full V1/V2 scope. It replaces conflicting behavioral assumptions; it does not claim implementation or runtime validation.

## Authority and workflow

- Source: owner conversation supplied to this planning run, approving Inquello continuity, hybrid architecture, creator-private Tasks/explicit sharing, admitted team-wide knowledge, first-increment basic revocation and reviewer-private agent-assisted review; final authorization: “Yes, please proceed. No implementation code at this stage”.
- Baseline: repository main `df5b14f73f4742afbd66d3ad633ca9d8d84988c7`; local isolated clone, no publication.
- Installed workflow: `.agents/skills/bmad-ux/SKILL.md`, Update intent and `references/headless.md`; resolved customization/config. No activation hooks, configured additional reviewers or external handoffs. Creative tools remain off; existing owner decision retains four imported compositions and nine spine-only surface groups.
- Resumed existing `.memlog.md`; appended changes through `_bmad/scripts/memlog.py`; rederived the existing pair from prior decisions plus the supplied overrides. Existing source extracts and older reviews remain historical records, not evidence of this update's validation.
- The default uv cache was read-only; a writable `/tmp/inquello-ux-uv` cache allowed the documented scripts to run. No software installation or user computer access occurred.

## Decision-to-contract mapping

| Confirmed change | Contract locations | Superseded interpretation |
| --- | --- | --- |
| Full scope, dependency-correct delivery checkpoints | EXPERIENCE Foundation; Open Items and Validation Boundaries | An engineering workbook checkpoint must not select the team's eventual validation tasks or narrow scope. Epic reordering belongs to the epic workflow, not a UX-only roadmap. |
| Hybrid local desktop/shared coordination | EXPERIENCE Foundation; S07/S09/S10; UJ-2 | Deployment is no longer entirely unselected; identity, permissions and coordination are shared while execution/files remain desktop-local by default. Provider sign-in is not Inquello identity; a preparer's local path is not a recipient-ready artifact. |
| Private Tasks and scoped shares | EXPERIENCE IA; Header/StartScreen; UJ-1/UJ-2/UJ-4; SP4; DESIGN ReviewScreen and Do's and Don'ts | Workspace membership or a file/review-package share must not expose the whole Task/conversation. Whole Task sharing is separately explicit. |
| Institutional knowledge admission | EXPERIENCE S08; UJ-7; SP2; Open Items | Unconditional sharing of all retained extracts is superseded. Formally issued or explicitly team-shared ongoing/final work qualifies automatically subject to current access; private exploratory drafts/conversations do not. Contribution settings are not admission. Recall spans different auditors and engagements in one internal-audit company Workspace, never companies. |
| Basic revocation with first team sharing | EXPERIENCE S05/S08/S09/S10 states; UJ-2 recovery; SP3/SP4; Open Items | Advanced reassignment/automation cannot postpone blocking revoked shared retrieval, recall, agent use or derived knowledge disclosure. Another current grant may preserve a route; exported copies cannot be recalled magically. V2 native lifecycle remains V2. |
| First-class agent-assisted review | EXPERIENCE S03; ReviewScreen; UJ-2/UJ-4; DESIGN ReviewScreen | A manual dashboard is insufficient. Reviewer private Task uses tools to reperform, checks evidence/Method/coverage/contradictions/history, drafts anchored notes selected by a human, and rechecks changed/impacted work after preparer-agent revision. No silent submitted-version mutation, private-deliberation disclosure or agent-based professional independence. |

## Coverage and validation boundaries

- All original FR-1–FR-44, NFR-1–NFR-10 and UJ-1–UJ-8 remain mapped by the inherited coverage ledger; revised behavior is detailed above. Retention of ID mentions is not proof of semantic or runtime completeness.
- No component names, token values, imported code, source research or image/font assets changed. New behavior composes the existing named primitives and screen references.
- Existing imported review screen is an illustrative composition, not a demonstration of the new reviewer-private workflow. All S05–S13 arrangements remain spine-only. No rendered interaction/accessibility claim is made.
- OQ-15: external-audit client segregation/independence boundaries remain unresolved; internal company-Workspace policy must not be copied there silently.
- OQ-16: shared-service vendor, spending, region, detailed protocol and route supply decisions remain unresolved. UX requires truthful sign-in/permission/recipient-availability states but does not choose those technologies.
- Existing AS-UX1–AS-UX4, native-record policy OQ-11 and final name/design validation OQ-12 remain gates for the affected work. Document completion is not release readiness or a tested service.
- Mechanical checks and editorial/targeted review findings for this run are recorded in `document-checks-2026-10-27.json` and `review-update-2026-10-27.md`, not retroactively assigned to the previous validation report.
