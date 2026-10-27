---
title: Inquello experience contract
status: final
created: 2026-10-26
updated: 2026-10-26
sources:
  - ../../prds/prd-inquello-2026-10-26/prd.md
  - ../../prds/prd-inquello-2026-10-26/addendum.md
  - imports/inquello-design-system.zip
visual_identity: DESIGN.md
---

# Inquello — Experience Spine

## Foundation

Inquello is a multi-surface auditor workbench. The supplied **Inquello component library** is the UI system for this contract: its React/CSS kit is an implementation reference, not a production-framework decision. [DESIGN.md](DESIGN.md) owns visual identity, tokens and component appearance; this document owns interaction, information architecture, states and journeys. **These two spines take precedence over conflicting mocks, wireframes or imports; the imported files remain unchanged.**

The [final PRD](../../prds/prd-inquello-2026-10-26/prd.md) and [companion](../../prds/prd-inquello-2026-10-26/addendum.md) retain product scope and decision authority. V1 is the full researched Codex-derived workbench using supported working files and external authoritative audit systems. V2 adds native authoritative audit records; it is not a prerequisite for V1. Desktop, CLI, application-adjacent assistance, mobile/remote steering and optional physical controls remain in scope. No first release, deployment model or guest policy is selected here.

The user-selected [archive](imports/inquello-design-system.zip), [package readme](imports/inquello-design-system/readme.md) and [workspace kit](imports/inquello-design-system/ui_kits/workspace/README.md) supply the visual/interaction baseline. The [import manifest](imports/IMPORT-MANIFEST.md) inventories retained files. Four routed desktop examples demonstrate composition, not functioning integrations or complete V1 coverage. Prototype names, amounts and statuses are illustrative; use the PRD's fixtures for validation.

**Fast-path assumptions:** **[ASSUMPTION AS-UX1]** groups unprovided capabilities into logical surfaces S05–S13 using the supplied primitives; these are proposed placements, not new scope or a route/architecture commitment. **[ASSUMPTION AS-UX2]** defines content-fit responsive arrangements where the import supplies only desktop. **[ASSUMPTION AS-UX3]** defines keyboard, focus and recovery behaviour absent from prototype handlers. **[ASSUMPTION AS-UX4]** applies stronger existing design-system tokens to meaningful text, essential controls and focus where source pairs are insufficient. These assumptions require design validation and do not resolve the PRD's open product choices. The [coverage ledger](.working/experience-coverage.md) maps every FR/NFR/UJ to its surface and flow.

## Information Architecture

Keep the source hierarchy: Workspace → optional Engagement → Task (Engagement replaces Assignment, decided 2026-10-27). Ad hoc Tasks remain first-class. The source **Inbox** entry is a route to work needing review or attention, not a claim of professional approval. Surface IDs below are stable design references; related capabilities can share a screen. S05–S13 are AS-UX1 arrangements, not additional branded components.

| Surface | Reached from and responsibility | Journeys and phase | Reference classification |
| --- | --- | --- | --- |
| **S01 — Start work** | New thread; accept an outcome, files/context and optional procedure before starting. Preserve chosen Workspace, text, attachments and method when entering work. | UJ-1, UJ-2, UJ-3, UJ-6, UJ-7; V1 | **mocked-by-import:** [StartScreen](imports/inquello-design-system/ui_kits/workspace/StartScreen.jsx); input handoff remains to implement. |
| **S02 — Active work** | Start or reopen Task; conversation, plan, sources, specialists and artifact views; steer/stop/resume and inspect analysis. | All UJs; V1 | **mocked-by-import:** [ActiveScreen](imports/inquello-design-system/ui_kits/workspace/ActiveScreen.jsx) and its Workbook composition. |
| **S03 — Review and decisions** | Inbox, finding, changed artifact or review request; inspect evidence, rationale, changes and human decisions. Open the selected item, not a fixed demo item. | UJ-2, UJ-3, UJ-4, UJ-5, UJ-6, UJ-8; V1 | **mocked-by-import:** [ReviewScreen](imports/inquello-design-system/ui_kits/workspace/ReviewScreen.jsx); source review/save provenance is illustrative. |
| **S04 — Automations** | Sidebar Automations; inspect schedules/event mandates, run history and attention; configure permitted triggers or disable future runs. | UJ-8; V1 | **mocked-by-import:** [AutomationsScreen](imports/inquello-design-system/ui_kits/workspace/AutomationsScreen.jsx); configuration and execution are not functioning services. |
| **S05 — Search and workspace navigation** | Sidebar/Search; find accessible Tasks, files and Engagements; pin/archive/reopen and inspect origin. | UJ-1, UJ-2 and entry/return for every UJ; V1 | **spine-only:** source [Sidebar/NavRow](imports/inquello-design-system/ui_kits/workspace/Shell.jsx) affordances; search and organisation flows unprovided. |
| **S06 — Skills and procedures** | Source Skills & procedures entry or Task's applied method; inspect/create/refine examples, instructions and skills, versions and dependencies; record permitted Task-specific departures separately from maintained Method changes. | UJ-7, supports UJ-2; V1 | **spine-only:** source navigation/procedure affordance; full library and authoring flow unprovided. |
| **S07 — Capabilities and processing** | Task capability/environment controls or account/settings; discover tools/apps/plugins, inspect permissions, effective provider/deployment and acting service identity, distinct execution/inference/browser or connector routes, model choices and configured consumption. | UJ-1, UJ-5, UJ-7, UJ-8; V1 | **spine-only:** source Composer chips/settings affordance; provider, connection and policy interactions unprovided. |
| **S08 — History, alternatives and memory** | Task history/alternative actions and memory settings; resume/fork/compare, inspect source context and separate memory contribution/use/activity recall. | UJ-1, UJ-5, UJ-7; V1 | **spine-only:** existing history icon vocabulary; full history/memory/branch interactions unprovided. |
| **S09 — Team, policy and retained material** | Workspace/account settings or work/review assignment; responsibilities, access, reassignment and jobs; inspect applicable policy separately for working files/evidence, history/logs/telemetry, backups and unattended work. | UJ-2, UJ-4, UJ-8; V1 | **spine-only:** account/settings context; no selected guest portal, reviewer hierarchy or tenancy architecture. |
| **S10 — Sharing and delivery** | Artifact, review package, conversation snapshot or prepared communication; inspect destination/audience/content, permitted action and verified outcome. | UJ-4, UJ-6, UJ-8; V1 | **spine-only:** source share/send/export affordances and toasts are references only. |
| **S11 — Technical investigation** | Specialist work, analysis details or console action within S02/S03; queries/scripts/configuration/security results, isolated alternatives and programmatic evidence. | UJ-5; also analysis in UJ-3/UJ-8; V1 | **spine-only:** source console guidance and specialist rows; no working runtime/scan or console implementation. |
| **S12 — Secondary clients and context capture** | Supported CLI, application-adjacent context, mobile/remote session, voice or physical control; continue the same permitted Task and capture the stated source state. Supported notifications and optional task companions expose attention/status and return to the identified Task in S02. | UJ-1, UJ-3, UJ-5, UJ-8; V1 | **spine-only:** no secondary-client or companion mock; the source Excel action is only a toast. |
| **S13 — Native records and migration** | Organisation/Workspace configuration and native record context when V2 is enabled; mode selection, migration and native lifecycle/history. | V2 continuation of UJ-2, UJ-4, UJ-8 | **spine-only:** PRD FR-38/FR-40/FR-42; no imported native-record screen. |

Desktop inherits Sidebar, Header, the centred thread and the optional artifact area from [Shell.jsx](imports/inquello-design-system/ui_kits/workspace/Shell.jsx). Dimensions come from `{spacing.sidebar-width}`, `{spacing.rail-width}`, `{spacing.header-height}`, `{spacing.thread-max-width}`, `{spacing.panel-min-width}` and `{spacing.panel-default-width}`. Keep task identity and selected item visible when an artifact expands. Preserve source selection and return focus when switching between thread and artifact; changing a tab never silently authorises or saves a remote update.

S07 retains allowed organisational gateways, local-model routes and service identities alongside Bedrock, Azure Foundry/Azure OpenAI and the named GCP/Vertex delta. Show the effective route and its capability limits; inclusion does not establish organisational approval or universal compatibility. Local execution must not imply local inference. S09 exposes the applicable retained-data and unattended-work policies alongside these route facts; OQ-9 still governs their selection and eligibility.

## Voice and Tone

Microcopy inherits the supplied system's terse, factual language; brand voice belongs to DESIGN.md. Use sentence case, an action verb, a named object and a truthful outcome. Distinguish a source observation, calculation, suggestion, human decision and missing evidence with JudgmentTag. Do not fill gaps with confidence, celebrate completion or imply an audit conclusion from agent activity.

| Situation | Use | Avoid |
| --- | --- | --- |
| Start | “What should we work on?” | A mandatory engagement wizard for a standalone question. |
| Missing source | “The October statement isn't in this workspace.” Offer the permitted next action. | “Everything looks good” when a source is absent. |
| Stop | “Work interrupted. 3 steps completed; 2 remain. The saved workbook is available.” Only use actual counts. | Source mock's completed-step display or “Paused after the current step” without evidence. |
| Proposed edit | “Keep proposed change” / “Revert proposed change”; identify affected outputs. | Generic “Approve” that merges file editing with professional sign-off. |
| Execution permission | “Send this request to [named recipient]” with exact content and configured authority. | “Contacting clients always asks first” as an invented universal policy. |
| Uncertain delivery | “The request was sent, but the destination has not confirmed it. Check the outcome before retrying.” | “Delivered” based only on an attempted call or toast. |
| External editing | “Open this saved workbook in Excel.” Show a handoff failure when unsupported. | “Changes come back as v5” before the file change and version are actually observed. |
| Automation | “Run completed; no exceptions reported in the examined population.” | “Accepted” or “Nothing needs you” when no human decision or complete coverage is established. |
| Permission failure | “This account cannot read the selected source.” Preserve safe context and show an available remedy. | Revealing inaccessible source content or presenting missing access as missing data. |

Bracketed names in these examples are runtime content, not promises of a particular integration. Use `{colors.text-primary}` for load-bearing statements and `{colors.text-muted}` for meaningful supporting information; faint colour alone must not carry a required status or instruction.

## Component Patterns

The 18 primitives and 10 source compositions below match DESIGN.md.Components exactly. No new component API is introduced for S05–S13. Their arrangements reuse these parts; required semantics are behavioural deltas to the supplied prototype, not evidence that its handlers already work.

| Component | Use | Behavioural rule and accessible operation |
| --- | --- | --- |
| **Icon** | Source Lucide vocabulary in controls/status | Decorative icons are hidden from assistive technology; informative icons have text equivalents. Never encode status solely in shape or colour. |
| **Button** | Primary/secondary/quiet/ghost actions | Use a native action target with an action-specific accessible name. Expose disabled/pending reason; prevent accidental duplicate submission while an operation is unresolved. A button's appearance does not establish permission. |
| **IconButton** | Navigation, send/stop, expand/collapse | Keep the source accessible label; expose toggled/expanded state and keyboard activation. Stop requests interruption, not rollback. Show focus using DESIGN's visible indicator, not only hover. |
| **Avatar** | Human or agent identity and decision marker | Identify person versus agent in accessible text. Human initials indicate an attributed decision only when identity/scope/version are recorded; a local decoration cannot prove approval. Use the small supplied symbol for the specified small agent size. |
| **Badge** | Counts and attention metadata | Count the named category, not generic success. Include text/accessible meaning; dynamic counts do not steal focus. Follow `{components.Badge.attentionForeground}` for readable attention text. |
| **TextField** | Composer-related fields, reasons and settings | Keep a persistent programmatic label, value and associated instruction/error. Retain entered text on validation/save failure; identify the field requiring correction. Focus and disabled/read-only states must be explicit although absent from some source props. |
| **Switch** | Applied procedure, enabled automation or setting | Expose checked state and label; Space toggles when permitted. Display the effective result only after confirmation where an external setting changes. Turning off a schedule affects future eligibility; it does not silently cancel an already-running job. |
| **Choice** | Radio treatment choices and independent checkboxes | Use grouped radio semantics for one option, checkbox semantics for independent options; label/descriptions remain selectable by keyboard. Arrow keys change radio selection; Space activates. Selecting a treatment alone does not commit it. |
| **SegmentedControl** | Summary/reconciling-item or equivalent view selection | One selected view, labelled options and visible active state. Arrow-key movement with focus management; selection changes only the view. Do not discard unsaved edits or imply data recalculation. |
| **Tabs** | Changes/Preview/Summary and related views | Provide tab/tablist/tabpanel relationships, selected state, arrow navigation and clear focus. Activate on focus only when immediate and safe; otherwise Enter/Space activates. Preserve selected source/item across tabs. |
| **Menu** | Context actions and selections | Trigger exposes expanded state; opening moves focus inside; arrows/Home/End navigate, Enter activates, Escape closes and returns focus. Use selection semantics only for actual choices. Unavailable actions retain an understandable reason without exposing protected data. |
| **StatusChip** | Evidence/review/item status | Preserve source states suggested/investigating/open/evidence/waiting/accepted/explained with explicit text. Accepted/explained requires named meaning; neither substitutes for execution completion, formal approval or delivery. Use a separate truthful label for states absent from the source taxonomy. |
| **JudgmentTag** | calculation/observation/suggestion/decision/gap | Pair the classification with its actual content/source; labels remain available to screen readers. A decision tag names the human or policy basis and scope; agent text does not acquire human authority through styling. |
| **FileChip** | Context attachment and file-type tag | Show file name/type and accessible source details. Remove is a labelled keyboard button; removing task context does not delete the original. Failed/unreadable/permission-limited sources remain distinct; PDF colour is a file-type cue, not an error. |
| **PlanStep** | Pending/running/done plan items | Done means that step actually finished. Preserve pending items after Stop; expose blocked/failed/interrupted steps with text and existing semantic indicators rather than coercing them to done. Announce meaningful transitions without streaming every visual pulse. |
| **ApprovalCard** | A scoped execution permission or requested human input | Show context, exact action/content/destination, consequences and permitted alternatives. Replace generic Approve with the actual action. Apply only the configured authority checkpoint; no new universal confirmation. Dismiss/alternative actions have real outcomes and preserve unresolved work. |
| **DiffLine** | Add/delete/change/context and affected outputs | Retain source identity, version and line/row context; +/−/change text supplements colour. Distinguish suggested, applied locally and delivered changes. Inspection or selection does not itself apply an edit. |
| **Toast** | Brief noncritical result feedback | Announce status without moving focus. The source 2.6-second dismissal is for replaceable, nonessential feedback only; errors, required action and uncertain delivery remain in persistent context. Never use toast display as proof of a saved file or external action. |
| **Sidebar** | Workspace navigation and rail | Maintain current surface/task and accessible hierarchy when collapsing. Logo expansion is a keyboard-operable action, not a clickable image alone. Visible labels or accessible names survive rail mode; counts indicate actual attention. |
| **Header** | Task/surface title, Workspace/Engagement context and actions | Preserve the source hierarchy and expose truncated meaningful context in an accessible way. Announce a navigation title after a deliberate surface change, not after every streamed token. |
| **Composer** | Request, attachments, scope/method/environment controls and steering | Carry actual text/files/method to the Task; accessible send and stop; retain unsent text after errors. Show effective scope and configured reasoning/environment. Disabled Send explains missing input; running state keeps steering possible. |
| **NavRow** | Navigation or a hierarchical task entry | Use link semantics for navigation and button semantics for an action; expose current/expanded state. Enter follows the selected item; nested children retain hierarchy. A row must not always route to the fixed R1 demo record. |
| **Over** | Source uppercase overline helper | A text label only, not a menu or interactive heading. Associate it with the labelled content; use meaningful semantic heading structure separately and readable metadata colour. |
| **Workbook** | Artifact preview and selected reconciliation items | Expose actual row/column labels, source/version and horizontal overflow. Make full-population versus sample-based work, counts, exclusions, applicable sampling parameters, duplicate treatment and actual examined coverage inspectable under the chosen Method. Use a semantic table unless full grid editing is implemented; interactive rows/cells are keyboard reachable. Selection identifies the real row/item and links to evidence. Hard-coded demo totals are not validation results. |
| **StartScreen** | S01 context and first task | Start from an outcome with optional method/context. Applied/Not applied reflects actual method inclusion. Starting work transfers all selections and records the Task identity; no automatic assumption of a formal engagement. |
| **ActiveScreen** | S02 thread, plan, specialist work and artifact | Toggle/expand artifact without losing context; inspect the actual selected item. Source stop and send handlers require PRD-correct outcomes. Thread and artifact retain their own scroll positions where supported. |
| **ReviewScreen** | S03 evidence, treatment, rationale and changes | Keep reason/choice in the current session until saved or deliberately discarded; show affected outputs and check version before commit. Keep/Revert operates on the proposed change scope; human decision/professional approval/external authority remain separately recorded. |
| **AutomationsScreen** | S04 mandate list and selected run | Select the actual automation/run; show trigger, scope, method, identity and outcome. Enable/disable/configure actions require supported persistent state; “New automation” and “Open review package” cannot be inert production affordances. |

Primitive source locations are grouped in [core](imports/inquello-design-system/components/core), [forms](imports/inquello-design-system/components/forms), [navigation](imports/inquello-design-system/components/navigation), [status](imports/inquello-design-system/components/status) and [workflow](imports/inquello-design-system/components/workflow). Their exact visual values and source-file links are in DESIGN.md.Components. The four screen references and Shell link above illustrate composition; behavioural requirements fill the gaps in their handlers.

## State Patterns

Use the source semantic language and DESIGN token applications. Agent suggestions/activity, human decisions, attention and integrity failures remain distinguishable with words and icons, not colour alone. `{components.StatusChip.acceptedForeground}` applies to accepted/explained text; it does not change what those labels mean.

**Shared baseline for every S01–S13 surface:** cold loading identifies what is loading without inventing content; empty states describe the actual absence and one relevant available action; focused controls remain visible in reading order; errors name the failed action and retained work; permission denial prevents the prohibited action and avoids disclosure. Offline/lost-connection state identifies which capability is unavailable. Keep unsent input in the current session where possible and preserve confirmed saved artifacts; do not promise local persistence, automatic synchronisation, queued external writes or retries unless that capability is actually supported and verified. Recheck relevant version/authority on recovery.

| Surface | Empty/cold-load and focus | Failure, stale, permission or offline treatment |
| --- | --- | --- |
| S01 | Empty request invites an outcome; files/method load independently. Focus starts at the request after deliberate New thread. | Invalid/unreadable attachment stays identified; preserve draft. Offline remote context does not block available local work or imply the whole product works offline. |
| S02 | Retained Task loads with known progress; no artifact yet is distinct from artifact failed. Focus stays on the user's control while work streams. | Running/blocked/interrupted/partial states preserve completed steps and effects; source change marks affected results stale. Resume checks context/access; Stop never renders unfinished steps done. |
| S03 | No review items is distinct from inaccessible items. Open the selected evidence/version and focus its heading or deliberate choice. | Retain unsaved rationale; conflict blocks only the stale commit, with compare/reload/continue options as supported. External approval unavailable remains unconfirmed; local review can still be identified as local. |
| S04 | No configured automation offers the permitted setup action; loading history is not “no runs.” Focus selected automation then run detail. | Missing/not received/not run/incomplete/failed/no-exceptions remain separate. Disabled schedules, orphaned ownership, duplicate events and uncertain delivery are visible; no automatic resend on reconnect. |
| S05 | No workspaces, no search matches and unavailable search are separate. Search focus returns to the trigger on close. | Reopen only accessible records; stale index does not reveal revoked content. Keep search terms on failure; show unavailable scope without claiming it was searched. |
| S06 | When no reusable Method is available, offer creation or selection from permitted guidance. Focus a chosen method/version, dependency list and any recorded Task-specific departure. | Missing dependency, unpublished change, incompatible version and denied distribution remain distinct. A denied departure remains unapplied; preserve its draft rationale without treating it as permission to override policy. Preserve draft guidance; never import client evidence into shared method by default. |
| S07 | When no connection or provider is available, explain the missing route without implying that the product lacks the capability. Focus the chosen capability's effective provider/deployment, service identity and distinct execution/inference/connector limits. | Expired/revoked access, incompatible route and usage limit each offer the applicable next action. Never silently switch provider/environment or buy access; unknown route facts remain unknown visibly. |
| S08 | Empty history, unavailable history, no retained memory and memory disabled are separate. Focus follows selected version/branch. | Lost context/permission changes are explicit. Contribution/use/capture controls show effective policy; revocation does not falsely claim historic erasure. Preserve original branch context after a failed merge/promotion. |
| S09 | No assignee, no jobs and no retained material are distinct scoped results. Focus on named responsibility/policy before changes. | Denied administration, stale membership, orphaned jobs and hold/deletion restrictions show actual limits. Reassignment does not erase records or grant new access implicitly. |
| S10 | No selected content/destination disables only the relevant send/export action with a reason. Focus on destination and exact change before action. | Failed/local-only/attempted/uncertain/confirmed outcomes are persistent. Reconcile unknown remote result before retry; revocation cannot be bypassed by a cached preview. |
| S11 | No run/query/scan is different from a run with no findings. Focus on selected source, output or error without forcing technical detail on ordinary review. | Runtime failure, interrupted execution, unavailable specialist service, incomplete coverage and conflicting writes remain visible; show retained outputs and safe resume/re-run scope. |
| S12 | Explain the supported surface/context and retain Task identity. Voice capture has explicit recording/transcribing/reviewable-text state. Notifications distinguish attention needed from actual run completion; an optional companion reflects that same Task state, never Professional Approval or audit completion. | Missing live app state, disconnected remote control and unsupported client actions are explicit. Unavailable notifications or an absent/dismissed companion leave Task state and controls accessible in S02. Offer continuation on another permitted surface, without pretending a handoff succeeded. |
| S13 | Unconfigured native mode is a V2 setting, not a V1 error. Focus on selected mode/record/destination before change. | Hold conflict, affected approval, migration failure/partial result or unavailable destination remain explicit. Preserve existing authority until the verified migration contract says otherwise. |

A disabled control must explain what prevents its action. Do not use a disappearing Toast for evidence gaps, stale outputs, uncertain writes or recovery instructions. Retain the task's actual state in its conversation/activity and relevant artifact or run detail.

## Interaction Primitives

**AS-UX3: keyboard and focus completion of the source UI.** The source shows shortcut hints but does not implement them. Provide visible controls for every action; shortcuts are an additional route, subject to supported host bindings. Suggested mappings are New thread (`Cmd+N`/`Ctrl+N`) and Search (`Cmd+K`/`Ctrl+K`) only where the host can safely provide them. Do not intercept browser/system shortcuts without the selected client's supported convention. Enter submits the Composer only when its advertised mode permits it; Shift+Enter inserts a newline, and input-method composition must not trigger Send.

Escape closes the topmost Menu or transient overlay and returns focus. It must not also stop a Task. The source “Stop (Esc)” hint is shown only when that binding is implemented, unambiguous and exposed to the user; the labelled Stop IconButton remains reachable. A stopped run retains its effects and is resumable only to the extent supported.

- Tab order follows task navigation → main content → contextual artifact/review actions → Composer, adjusted to visible layout. Do not trap users inside a scroll area or editable table.
- Menu, Tabs, SegmentedControl, Choice and Switch follow their component keyboard rules. Hover-only actions also appear on focus and touch. Nested remove/action targets cannot trigger their containing row.
- Navigation preserves Task identity, selected artifact/item and available drafts. Before an action would discard unsubmitted work, offer an explicit way to retain or discard it; ordinary reversible navigation needs no blanket approval ceremony.
- After a committed user action, focus stays with its result or returns to its trigger; background activity does not steal focus. Changes to relevant state are announced concisely rather than streaming every token.
- Panel collapse/expand uses labelled controls. If resizing is supplied, it needs a keyboard-operable separator and announced value; no resizing ability is claimed by the imported kit. Horizontal Workbook overflow remains independently reachable.
- Open in Excel, publish, send, export and remote record actions show the actual supported effect. A notification alone is not an integration. Use the exact selected file/item/destination, not source demo IDs.

## Accessibility Floor

This is a concrete behavioural design floor, not a claim of full conformance or a resolution of PRD OQ-8. DESIGN.md owns palette/contrast applications; preserve its stronger existing-token uses without inventing colours. Every interactive source div, row and image must acquire the appropriate native or equivalent accessible semantics, name, role, state and keyboard behaviour.

- Heading/landmark structure identifies navigation, main conversation/work, artifact and contextual review. Announce surface/task changes with a concise title; retain source/evidence names and table headers for screen readers.
- Focus is visible and not obscured by the fixed Header/Composer or expanded artifact. Use `{colors.blue-600}` as the meaningful indicator with the source pale ring supplementary; do not rely on hover or faint borders alone.
- Labels, instructions, errors, selected state and status meaning remain perceivable without colour. Meaningful small metadata uses `{colors.text-muted}`; disabled appearance cannot be the only explanation of inability to act.
- Text remains readable when resized and content reflows around controls. Tables, code and diffs may retain horizontal scrolling, with a labelled boundary and keyboard access; surrounding navigation/instructions still reflow.
- Use live status announcements for meaningful run/save/delivery transitions. Urgent failures needing immediate attention are distinguished from ordinary polite updates, without repeatedly interrupting reading.
- Respect reduced-motion preferences: replace decorative spin/pulse with a static named running state and minimise nonessential transitions. No loss of status information when animation is absent.
- Effective targets should meet the [WCAG 2.2 minimum target-size guidance](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html): 24×24 CSS pixels or a documented applicable exception. Small icons/radios can sit in a larger labelled hit area; this is not a rule to make all source controls visually larger. Native client targets follow their chosen platform guidance once OQ-6/OQ-8 are resolved.
- Normal text is screened at 4.5:1 and large text at 3:1 under [contrast-minimum guidance](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html); meaningful non-text indicators/boundaries at 3:1 under [non-text contrast guidance](https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast.html). The source's faint text, white attention badge and green status pairs require DESIGN's explicit token applications. These calculations do not establish complete accessibility validation.

## Responsive & Platform

**AS-UX2:** the import defines desktop sizes, not breakpoints or a complete mobile system. The following arrangements preserve capabilities through content fit; numeric breakpoint/client contracts remain OQ-6/OQ-8. They do not impose a reduced mobile V1 or select a frontend framework.

| Context | Proposed arrangement | Continuity requirement |
| --- | --- | --- |
| Room for navigation, readable thread and artifact minimum | Expanded Sidebar, Header, thread up to `{spacing.thread-max-width}`, optional artifact using the declared panel widths. | Preserve source desktop composition and independently accessible scrolling. |
| Space insufficient for full Sidebar plus active work | Use source rail or user-controlled collapsed navigation. Prioritise the current thread/artifact, not a compressed unreadable sheet. | Navigation remains labelled and keyboard reachable; counts/status survive collapse. |
| Space insufficient for thread plus artifact minimum | Show the selected work area at usable width and switch between conversation/artifact with Tabs or explicit controls; navigation may open transiently. | Same selected source/item and unsent text; return focus; no content hidden solely by hover or assumed desktop access. |
| Expanded review / wide data | Workbook keeps semantic row/column context and horizontal overflow; decision controls can follow in a separate visible section when side-by-side no longer fits. | Evidence and proposed treatment remain linked; change review does not require simultaneous narrow columns. |
| CLI / SDK / programmatic | Preserve existing command/session capability and structured output semantics; do not reproduce a decorative desktop shell in text clients. | Task identity, acting authority, source/coverage, progress/errors and outcome remain accessible. |
| Application-adjacent / Excel handoff | Identify the saved file or actual supported live selection/unsaved state; use declared editor integration. | On return, detect changed inputs/version and retain unrelated edits; no invented synchronisation/versioning engine. |
| Mobile / remote steering | Provide supported inspect/steer/interrupt/continue actions with touch/keyboard semantics and clear capability limits. | The same Task and authority; unavailable action offers a permitted continuation path without claiming execution. |
| Voice / optional physical controls | Review/correct captured instructions; each physical action has a declared effect and outcome. | No hidden scope expansion; status and controls remain available without voice or the device. |

No complete dark theme is supplied. A dark console or Toast does not establish a global dark mode. Offline availability follows the actual local/remote route; neither this table nor the reference kit promises background synchronisation.

## Authority and Delivery

The same visual language must expose separate meanings: **permission to execute**, **proposed/applied artifact edit**, **human review decision**, **Professional Approval**, and **attempted/confirmed/uncertain Delivery**. V1 local task/history and review records are useful working material; formal external acceptance is established only through the designated record authority when the Method requires it. V2 native records add their own attributed lifecycle. Do not fabricate a universal sign-off step for advisory answers or an extra approval for every reversible action.

Before a consequential external action, make destination, acting identity, exact content/field change and the relevant version inspectable, applying the configured permission or preauthorised mandate. Afterwards, keep operation identity and actual verification visible. Unrelated fields remain untouched. A stale proposal returns to review; a lost response after a possible success enters reconciliation. No blind repeat, automatic reconnect resend or toast-only success.

Keep/Revert on a local proposal is not Professional Approval. An agent's review is not a human signature. Green initials are evidence of attribution only when backed by the recorded person, scope and version. “No exceptions reported” describes the examined population, not complete assurance. Audit-record writeback never implies permission to post or alter ledger/HR/source transactions.

## Inspiration & Anti-patterns

The supplied workspace is the reference: a quiet working area where the artifact, evidence and review are prominent; the source question/plan/agent/diff patterns preserve the Codex-derived experience. Keep its compact factual copy, JudgmentTag distinctions, same-file editor handoff and inspectable proposed changes. Earlier Open Inquiry explorations are historical context, not the selected visual source for this run.

Do not copy prototype shortcuts into false runtime claims: all items opening R1, Stop marking pending steps done, Keep issuing an unsaved version claim, a toast pretending Excel/portal delivery happened, or accepted representing an automated check. Do not treat the four routes as a four-screen product boundary, remove technical/security work, impose a universal audit method or interpret the design system as a new production-framework decision. Decorative confidence, colour-only status and automatic native-record authority would undermine the supplied product intent.

## Key Flows

The following source UJ names are preserved verbatim. Amina, Noah and Dev remain illustrative protagonists (PRD AS-1), not research participants. Each flow is V1 unless explicitly extended through supporting path SP7; named sources and integrations are selected under the PRD gates. Imported screenshots/code are composition examples, not evidence that these outcomes have occurred.

### UJ-1 — Amina answers an ad hoc question (source J1).

1. Amina opens S01 from New thread or finds existing work in S05. She identifies the permitted Workspace, question and relevant files without creating an Engagement unnecessarily.
2. She inspects available source context and any applied Method; S07 exposes a required capability/route only when it affects this task. Send transfers the actual text/files/method to S02.
3. S02 shows progress and accessible source references. Amina steers the task; calculations, observations, gaps and suggestions remain distinguishable. Technical details are available without being required to read an answer.
4. **Climax:** Amina receives a useful response or saved Artifact whose sources, uncertainty and actual coverage she can inspect, then continues with a follow-up in the same Task.
5. She can revisit it from S05/S08 or inspect a supported secondary-client continuation in S12 without reconstructing the context.

**Failure/recovery:** an unreadable/revoked source is identified rather than omitted silently; preserve the request and usable work. Amina supplies a permitted replacement or narrows the request explicitly. If interrupted, report completed effects and remaining work, then recheck access/context before resume.

### UJ-2 — Amina and Noah carry an engagement through review (J2).

1. Amina brings the team's Method, scope and evidence through S01/S06; S05 organises the optional Engagement and Tasks using its practice terminology.
2. In S02 she prepares procedures/results, inspects evidence requests/receipt and actual coverage, and coordinates bounded specialist work as needed. S09 exposes actual work/review responsibility.
3. Noah opens the named review item in S03, traces relied-on results to inputs/derivations and requests a scoped correction or records his permitted review decision.
4. Amina revises the supported artifacts, checks changed evidence/method impacts and returns the relevant version to Noah. An accepted text edit does not silently approve a conclusion.
5. **Climax:** they have an inspectable reporting package with its actual human review state; S10 records authorised delivery and any required formal acceptance through the external authority separately.

**Failure/recovery:** missing evidence remains open; stale reviewed content returns to comparison before a new decision. If an external destination is unavailable or its outcome uncertain, retain the local package and decision context, identify the unresolved delivery and reconcile rather than claim completion. Native records are not required for this V1 flow.

### UJ-3 — Amina continues a reconciliation in Excel (J3).

1. Amina supplies the selected reconciliation inputs/Method in S01 and starts S02. For validation, use W1 from the PRD companion, not the different imported demo rows.
2. She checks full-population versus sample-based work under the chosen Method, then inspects counts, exclusions, applicable sampling parameters, duplicate treatment, actual examined coverage, matching rules, totals, exceptions and derivations in Workbook. Selected rows lead to the corresponding evidence in S03; supported formulas/comments/references remain inspectable.
3. She chooses the real saved-file Open in Excel handoff in S12. Show failure if no supported editor route exists; a Toast does not complete this step.
4. She saves an external edit and asks Inquello to continue. S02 checks the input/file version, respects unrelated changes and either recomputes or marks the previous result stale.
5. **Climax:** the same workbook carries the changed input into a reviewable result with an explained difference and intact supported content, without Amina reconstructing the analysis.

**Failure/recovery:** stale formula caches, concurrent edits or unsupported features surface before replacement. Keep both identifiable versions where the supported environment allows; compare/reconcile or leave the proposed replacement unapplied. An uncertain save/handoff is described truthfully. No ledger transaction is posted by reconciliation.

### UJ-4 — Amina and Noah revise a Word workpaper (J4).

1. Amina drafts from identified evidence in S02 and inspects the same saved workpaper in the workbench or Word through S12.
2. Noah opens S03, challenges the interpretation and links his comment to the actual source/version. The review separates observation, calculation, gap and proposed treatment.
3. Amina selects a treatment, writes a rationale and inspects affected-output DiffLine entries. Keep applies only the declared local change after the relevant version check; Revert leaves the original proposal outcome clear.
4. Noah reviews the resulting argument and evidence. S09/S03 identify the authorised human and reviewed version; a professional decision follows the actual Method rather than a universal UI shortcut.
5. **Climax:** the revised workpaper, sources and review context remain intelligible; S10 confirms any required external approval/delivery separately from the saved edit.

**Failure/recovery:** retain unsaved rationale on validation/save failure. A changed policy requires its effective date before reassessment; a broken reference is exposed. If attribution or a Word feature cannot be preserved, disclose that limit before destructive change and retain a reviewable alternative.

### UJ-5 — Dev reconciles specialist investigations (J5).

1. Dev opens permitted technical sources in S02/S11 and inspects the execution location, specialist capability and acting authority in S07. Actual code/configuration/security tools remain available.
2. He delegates bounded tasks through S02, retaining source/scope references, and opens S11 outputs or isolated alternatives when analysis can run in parallel.
3. He inspects actual population/coverage, exclusions, duplicate treatment and applicable sampling parameters alongside scripts/results, gaps and disagreements. S08 keeps forks/side chats connected to their origin; proposed promotion cannot overwrite concurrent work silently.
4. Dev consolidates supported findings in S03 and requests the appropriate human review. An agent label does not establish independence or professional approval.
5. **Climax:** the consolidated result is traceable to its technical evidence and exposes what disagreed or remained unexamined, rather than a single unsupported confidence score.

**Failure/recovery:** a failed runtime, unavailable scan/service or revoked permission is shown as such. Preserve usable output and exact remaining scope; retry only an identified safe operation or choose another permitted route explicitly. Conflicting shared writes are isolated/reconciled rather than silently merged.

### UJ-6 — Amina develops advisory options (J6).

1. Amina starts an advisory question in S01 with the relevant process material and outcome; no mandatory control/finding schema is imposed.
2. S02 researches permitted sources, retains retrieval context and separates supported observations from estimates and assumptions.
3. She compares options and revises an editable paper/presentation; S03 exposes material assertions, underlying analysis and supported themes/charts/notes for review.
4. In S10 she inspects the audience/content and actual destination before a permitted export, share or publication.
5. **Climax:** the recipient gets the intended editable options output with its evidence and declared limitations; generation, publication and confirmed delivery remain distinguishable.

**Failure/recovery:** missing sources or unsupported estimates stay labelled. An unsupported presentation feature is disclosed before conversion. A failed share/export retains the artifact and selected audience/context; do not publish a broader fallback or claim delivery from a preview.

### UJ-7 — Amina teaches and reuses a procedure (J7).

1. Amina opens S06 from Skills & procedures or the applied Method in S01/S02. She supplies a procedure, worked example and permitted references.
2. She refines task instructions/skills and inspects parameters, version and dependencies. For a permitted Task-specific departure, she records what differs, the selected Method/version, rationale and affected scope/outputs; this record neither changes the maintained Method nor grants authority. S07 shows any missing executable/tool capability separately from the guidance itself.
3. She reuses the selected Method on another Engagement; S08 identifies permitted memory contribution/use; recall is shared within the Workspace and never crosses Workspaces (OQ-3).
4. In S02/S03 she and any applicable reviewer inspect results and recorded departures alongside the relied-on work. Refining or distributing maintained guidance is a separate action under the team's selected policy; no new mandatory catalogue, review checkpoint or workflow builder is imposed.
5. **Climax:** repeat work uses an identifiable procedure/version/parameters that Amina can explain and improve, without silently sharing the first client's evidence.

**Failure/recovery:** keep the draft when dependencies or permissions fail. Evidence containing contrary instructions does not replace the approved Method. A newer Method identifies affected outputs; a case-specific correction does not automatically become a team-wide rule.

### UJ-8 — Noah follows a triggered procedure through (J8).

1. Noah opens S04 and inspects/configures a permitted schedule or supported business event, inputs, Method, acting identity, budget/limits, destination and escalation under the actual mandate.
2. He sees the effective enablement and ownership. A run exposes its received/not-run/running/incomplete/failed outcome, source population and actual coverage; duplicate events cannot silently create duplicate effects.
3. He opens the corresponding S02/S03 work to inspect exceptions or missing evidence, with the real run identity and reviewed version retained.
4. Through S10 he reviews or executes the already-authorised external action as required by policy, then verifies the destination. A source “Request approval evidence” button does not itself prove communication happened.
5. He later reviews responses/retest evidence under the Method, with S09 maintaining responsibility through reassignment/departure.
6. **Climax:** the run's observations, human decisions, confirmed or unresolved delivery and closure authority are traceable; agent completion alone neither grants assurance nor closes remediation.

**Failure/recovery:** missing events, partial work, exhausted limits, lost credentials and uncertain updates remain visible. Disabling the schedule stops future eligibility only; handle any running work separately. Preserve operation identity and reconcile before retry; reassign an orphaned job under policy rather than continue as a departed user.

### Supporting paths within the source journeys

These AS-UX1 arrangements give less-visible requirements an explicit path without inventing new user journeys or product scope.

| Path | Existing journey/surfaces | Steps, value and recovery |
| --- | --- | --- |
| **SP1 — Select capability and work route** | UJ-1/UJ-5/UJ-8; S07/S09/S12 | 1. Inspect requested capability, effective provider/deployment, acting service identity and limits. 2. Distinguish execution, inference and browser/connector routes; inspect related retained-data/unattended policies in S09, then choose an available permitted model/environment/reasoning option or inspect connection setup. 3. **Climax:** the Task shows its effective routes and consumption. Failure retains the request and explains missing access/compatibility; no silent fallback or purchase. |
| **SP2 — Resume, branch and govern recall** | UJ-1/UJ-5/UJ-7; S05/S08 | 1. Find Task/version or inspect a supported setup/history import and its declared losses. 2. Resume or fork while preserving origin. 3. Inspect memory contribution/use and optional activity capture/recall separately. **Climax:** relevant permitted context is available without client evidence leakage. Missing/revoked context remains explicit; a failed merge leaves accepted work intact. |
| **SP3 — Assign, reassign and govern retained work** | UJ-2/UJ-4/UJ-8; S09 | 1. Inspect actual human responsibility/access. 2. Apply a permitted assignment/revocation or retained-material action. 3. Verify effective access, ownership and retention outcome. **Climax:** work and unattended jobs have known responsible people. Stale/denied actions remain unapplied; history is not falsely described as deleted. |
| **SP4 — Inspect or share a bounded output** | UJ-4/UJ-6/UJ-8; S10 | 1. Select artifact/package/snapshot and audience. 2. Inspect destination/content/version and configured authority. 3. Perform supported export/write/share and verify. **Climax:** destination and actual outcome are known. Unknown remote results enter reconciliation; scope is never widened to make delivery succeed. |
| **SP5 — Programmatic and technical continuation** | UJ-5/UJ-8; S11/S12 | 1. Inspect CLI/SDK/hook/tool contract and source inputs. 2. Run permitted work with structured progress/results. 3. Rejoin evidence/coverage to the Task. **Climax:** technical execution remains inspectable in the same work context. Unsupported version/hook failure is reported, not silently skipped. |
| **SP6 — Capture and continue across clients** | UJ-1/UJ-3/UJ-5/UJ-8; S02/S12 | 1. Identify the actual client/file/live context and Task. 2. Inspect/correct voice or selected context; invoke a declared browser/site/computer action or other supported control under the acting identity. 3. Continue on the chosen surface with identity/status intact; a supported notification or optional companion can lead back to the named Task, distinguishing attention needed from actual run completion. **Climax:** assistance follows the same work without companion state implying Professional Approval or audit completion. Unavailable context/action offers a supported continuation, not simulated success; Task status remains accessible without notification or companion. |
| **SP7 — Native-record continuation — V2** | UJ-2/UJ-4/UJ-8 continued in V2; S13 | 1. Inspect permitted organisation/workspace mode and native policy. 2. Select/prepare a deliberate migration or native lifecycle action with identified records/destination. 3. Verify identities, relationships/history and declared losses; preserve attributed human/scope/version decisions. **Climax:** the configured native record authority and outcome are explicit. Hold conflicts, affected approvals and partial migration remain unresolved visibly; V1 work is not blocked by this path. |

## Open Items and Validation Boundaries

Carry forward the PRD gates (§10 of the PRD holds the decision text). Decided 2026-10-27: **OQ-1** team-only participation; **OQ-2** retained extracts; **OQ-3** recall shared within a Workspace, isolated between Workspaces; **OQ-4** Codex Method/extension mechanisms; **OQ-5** Codex usage handling; **OQ-6** desktop first mirroring Codex clients, Excel/Word/PowerPoint/CSV, import/export only for first validation; **OQ-8** single-team scale, commitments after first validation; **OQ-9** all documented routes in scope and tested; **OQ-10** sequencing at story breakdown; **OQ-7** an internal audit team validates on task types it picks, thresholds after a baseline. Added and decided 2026-10-27: **OQ-13** local agent browser/sandbox in V1, hosted revisit in V2; **OQ-14** Inquello identity module separate from inference-provider sign-in. Still open: **OQ-11** native-record policy; **OQ-12** final name/design validation. The supplied visual package is now selected as the source; that does not establish trademark clearance, approved final layouts or production accessibility.

AS-UX1–AS-UX4 require walkthroughs and rendered checks against the selected team's examples and clients. Validate the four imported compositions and the spine-only S05–S13 arrangements; do not report unprovided screens as visually demonstrated. W1–W3/M1, presentation round trips, permission/revocation cases, keyboard/focus traversal, external-edit conflicts and uncertain-delivery recovery remain proposed tests. Check total effort through acceptance and reviewer correction burden, not simply completion speed.

The following are proposed role owners, not named appointments. The PRD's OQ owners and revisit gates remain authoritative for their product decisions; this index identifies the narrower UX assumptions to carry alongside them.

| Assumption | Proposed owner | Revisit condition and boundary |
| --- | --- | --- |
| **AS-UX1 — Derived placements** | Product/design lead with practitioner and review representatives | Walk through S05–S13 before committing navigation or screen layouts; apply the decided OQ-1/OQ-3/OQ-4/OQ-6 choices (2026-10-27) where an implementation depends on them. Full scope remains unchanged. |
| **AS-UX2 — Responsive arrangements** | Design lead with client/architecture lead | Test content fit, zoom, overflow and handoff on selected clients before responsive or secondary-client implementation commitments; OQ-6/OQ-8 select support/conformance targets. |
| **AS-UX3 — Interaction completion** | Design lead with implementation/accessibility reviewer | Verify keyboard/semantic handlers, focus, draft retention and recovery using the actual host and integrations before claiming supported interaction. Shortcut labels and source callbacks are insufficient evidence. |
| **AS-UX4 — Existing-token accessibility applications** | Design lead with accessibility reviewer | Check rendered text/control/focus pairs and interaction states before shipping those applications. Preserve the supplied palette and source files; no global conformance claim or OQ-8 target is inferred. |

No new mock was generated on the fast path. The four source routes are **mocked-by-import** references; all other arrangements are **spine-only** until rendered and reviewed. Architecture and story work should carry surface/flow/FR references and the relevant open gates forward without treating a finished document as a completed product.
