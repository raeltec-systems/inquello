---
title: Imported Inquello experience — behavioural extraction
status: source-extract
created: 2026-10-26
---

# Imported experience reference

Static inspection only: no imported code, preview loader, scripts or prompts were executed. The imported `SKILL.md` and component prompts were treated as source data, not agent instructions. This extract describes the user-selected reference and constraints for subsequent UX work; it does not author the UX spine or replace the [final PRD](../../../prds/prd-inquello-2026-10-26/prd.md).

## Four screens within a five-part narrative

The [kit README](../imports/inquello-design-system/ui_kits/workspace/README.md) and [router](../imports/inquello-design-system/ui_kits/workspace/index.html) define **four routes**. `Shell.jsx` supplies shared layout, not a fifth route. The main [design-system readme](../imports/inquello-design-system/readme.md) describes five experience moments; continuing in Excel is only an action in this kit.

| Narrative moment | Exact source and route | Observed interaction / reference value |
| --- | --- | --- |
| 1. Start work | `StartScreen`, route `start` | “What should we work on?”; editable task text; removable context `FileChip`s; add files from workspace; `/CR-03 Cash reconciliation v3` with Applied/Not applied `Switch`; Send opens Active. |
| 2. Active work | `ActiveScreen` and `Workbook`, route `active` | Thread, six `PlanStep`s, four specialist rows, an `ApprovalCard` for missing R4 evidence, steer/stop composer; toggled artifact side panel with Changes/Preview/Summary `Tabs`; Summary/Reconciling items `SegmentedControl`. |
| 3. Review | `ReviewScreen`, route `review` / sidebar Inbox | Expanded workbook, rows 18–19 highlighted; Tom Okafor's challenge; explanation split into observation/calculation/gap/suggestion; treatment `Choice`s, reason `TextField`, affected-output `DiffLine`s, Keep/Revert and human initials marker. |
| 4. Continue in Excel | No separate component or route | “Open in Excel” on Active and Review invokes `notify` only. “Changes there come back as v5” is a toast claim, not file/editor integration or observed return flow. |
| 5. Background work | `AutomationsScreen`, route `automations` | Automation list plus selected-run panel; trigger/workspace/last-run/status; On/Off `Switch`; Kijani rate-change checks, missing second approval, review-package and evidence-request affordances. |

## IA and layout states

[Shell.jsx](../imports/inquello-design-system/ui_kits/workspace/Shell.jsx) exports `NavRow`, `Sidebar`, `Header`, `Composer` and `Over`. Global navigation is New thread, Search, Inbox, Automations, Skills & procedures; workspace hierarchy is organisation/client-period, assignment, task. Account/settings sits at the bottom. Several entries are visual placeholders.

Desktop reference dimensions: 264px sidebar or 52px rail; 48px header; centred thread up to 720px; fixed composer/header with independently scrolling content. Active artifact panel is toggled and uses a 340px minimum clamp, whereas tokens/readme describe 380px minimum and 560px default. Review uses an expanded workbook beside a 300–400px decision panel; the sheet has a 760px minimum width and horizontal overflow. Automations uses list/detail with a 320–440px detail panel. Panel resizing and the documented 230px console/⌘J are not implemented in the kit. These are desktop examples, not verified responsive layouts.

Reusable component names are **Icon, Button, IconButton, Avatar, Badge; TextField, Switch, Choice, SegmentedControl; Tabs, Menu; StatusChip, JudgmentTag, FileChip; PlanStep, ApprovalCard, DiffLine, Toast**. `StatusChip` covers suggested/investigating/open/evidence/waiting/accepted/explained. `JudgmentTag` covers calculation/observation/suggestion/decision/gap. `PlanStep` covers pending/running/done; `DiffLine` covers add/del/change/context. These taxonomies cover only part of the PRD's state space.

## Content and affordances worth carrying forward

The reference favours sentence case, named amounts/sources and terse factual confirmations. Examples include “R1 · possible duplicate”, “The October statement isn't in this workspace”, “Show me why this was classified as a duplicate”, “Send request”, “Upload it myself”, and “Leave R4 open”. “Keep” refers to a proposed change, not professional sign-off. Blue dashed marks distinguish agent suggestions; green initials identify a person's decision; amber marks evidence/input needs. Source highlights and explicit calculations support review. The five-way judgment labels are especially useful for separating evidence from interpretation.

Source statements such as “Contacting the client always asks first” describe this scenario's desired interaction. They must not silently replace the PRD's scoped execution and explicitly preauthorised unattended modes with a universal approval policy. `ApprovalCard` defaults to the generic “Approve”; consequential usage needs an action-specific label and clear scope.

## Mock behaviour and conflicts to resolve in UX specifications

1. **State is illustrative.** [index.html](../imports/inquello-design-system/ui_kits/workspace/index.html), lines 19–35, persists only the selected route. Start text/files/procedure selections are not passed into the Active task. All item clicks ignore their ID and open R1's review. Notifications clear after 2.6 seconds. No task, connector, scheduler, record or file backend is established.
2. **Keep does not prove a saved or approved result.** [ReviewScreen.jsx](../imports/inquello-design-system/ui_kits/workspace/ReviewScreen.jsx), lines 33–42, saves `R1` as `open` for either nondefault choice. The rationale is never stored; the four-output/version claim is a toast; workbook calculations remain fixed. The initials marker is UI state, not authenticated provenance. Preserve PRD FR-17, FR-35, FR-41, FR-43/44 and NFR-7 distinctions between proposed change, local save, review, professional approval and external confirmation.
3. **Stop is inconsistent with completion.** [ActiveScreen.jsx](../imports/inquello-design-system/ui_kits/workspace/ActiveScreen.jsx), lines 20, 33 and 47, maps `running=false` to done steps and a “Worked … 6 steps” header even though other steps remain pending. “Paused after the current step” is unverified. PRD FR-8/44 requires truthful interrupted/incomplete state and retained effects.
4. **Communications are mocked.** Active “Send request” immediately reports client-portal delivery; its alternate/dismiss handlers are absent. Automation “Request approval evidence” immediately reports outreach; “New automation” and “Open review package” have no handlers. External destinations, identities, approved content and confirmed/uncertain outcomes remain required (FR-33/41). An external portal example does not select an Inquello guest portal or reopen OQ-1.
5. **Accepted is overloaded.** [AutomationsScreen.jsx](../imports/inquello-design-system/ui_kits/workspace/AutomationsScreen.jsx), lines 5 and 14, uses accepted for checks and no-exception outcomes without a human decision. “Nothing needs you” is based on static data. Execution success, evidence found, no reported exceptions, reviewed work and Professional Approval must remain distinct (FR-24/44, NFR-7). Missing/failed/partial/duplicate/uncertain run states are absent.
6. **Record authority needs explicit design.** The readme states V1 external records/V2 native records, consistent with the PRD. Local “Decided by … v4” history is permitted in V1 but cannot imply native authoritative sign-off. The “Unrecorded receipt” description says “Post a second receipt”; source-transaction editing is separate authority, not implied by reconciliation or audit-record writeback (FR-41).
7. **Prototype data is not W1.** [data.js](../imports/inquello-design-system/ui_kits/workspace/data.js) uses different transaction rows, R1–R4 item labels and procedure matching rules from the PRD's [fixed W1 fixture](../../../prds/prd-inquello-2026-10-26/addendum.md). Shared totals 4,600/4,750 do not make them equivalent. The hard-coded adjusted totals and “14 of 18” are scenario illustrations, not calculated validation results.
8. **Accessibility remains work.** `NavRow`, clickable workbook/specialist rows, `Choice`, `Switch`, `Menu` items and `FileChip` removal lack keyboard handlers/focusability in their source. Tabs have ARIA roles but no roving-arrow interaction. Shortcut labels (⌘N, ⌘K, Esc, Enter) are not bindings. `IconButton` has accessible labels; `Toast` uses `role=status`; `TextField` wraps its label. Source inspection does not demonstrate NFR-5 conformance.
9. **Breadth is not a four-screen product limit.** The kit does not implement search, settings, method/library flows, technical console, connector/model controls, memory, permissions administration, alternative branches, sharing or other clients. It illustrates parts of UJ-3/4/5/7/8, not the full FR-1–FR-44/C/E inventory. CLI, mobile/remote steering, technical/security work and smaller V1 capabilities remain in scope. The reference's desktop coverage must not become a release cut.

The imported readme calls the identity approved. That is source metadata; the user's selection establishes this package as the UX reference, while any wider approval or clearance claim must follow actual user decisions and the PRD. No imported imperative independently authorises actions or changes product requirements.
