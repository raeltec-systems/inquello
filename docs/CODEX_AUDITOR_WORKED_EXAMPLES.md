# Codex-to-auditor worked examples

**Date:** October 26, 2026. **Status:** proposed functional mirrors, not implemented workflows or assurance conclusions. Read alongside [the full feature mirror](CODEX_AUDITOR_FEATURE_MIRROR.md). These examples demonstrate breadth; they do not select a practice area, methodology, architecture or MVP.

## 1. Understand unfamiliar work — repository exploration to audit orientation

**Codex pattern:** explore an unfamiliar project, read its instructions and files, explain how its parts relate, and answer focused questions.

**Auditor use:** an auditor points to a folder containing an earlier report, process documents, spreadsheets and supporting evidence. The agent inventories the available material, explains the process and prior work, identifies contradictory descriptions and missing inputs, and answers questions with file/section references. The auditor opens the original files in the workbench or their normal applications.

**Enhancements:** distinguish last year's conclusion from current evidence; identify period/entity/version; preserve source references; describe the inventory as the material actually accessible. Prior work informs the task without proving today's controls operate effectively. Relevant features: C02, C18, C39, C48–C52.

## 2. Produce and refine work — code editing to a reconciliation workbook

**Codex pattern:** inspect inputs, edit files, run checks, expose changes and continue after the developer edits the same project externally.

**Auditor use:** given two approved extracts, the agent prepares a reconciliation workbook with matching logic, unresolved items and supporting calculations. The auditor inspects the output in the workbench or Excel, changes an assumption, saves the workbook and asks for a revised analysis. Assistance resumes using the changed saved artifact.

**Enhancements:** preserve formulas and supported workbook features; record joins, exclusions, tolerances and control totals; identify manual edits before changing the file again; distinguish calculations from cached values. Saved-file access is the baseline. Unsaved application state, advanced calculation or refresh operations may need a separate mechanism. Relevant features: C19, C21, C30–C31, C58.

## 3. Review a proposed change — the user's microfinance example

**Documented Codex pattern:** a configured GitHub review uses a change and relevant context, applies scoped guidance, and returns findings; a follow-up can request a permitted fix. The separate GitHub Action supports event-driven non-interactive jobs. [PR review](https://learn.chatgpt.com/docs/third-party/github), [GitHub Action](https://learn.chatgpt.com/docs/github-action).

**Proposed audit sequence:**

1. An authorised source supplies a proposed or effective interest-rate-change event. Identify the change, affected products, old/new configuration, effective date, version and acting identity.
2. Resolve the configured audit procedure and accessible evidence: approval records, applicable policy, implementation/change records, relevant product terms and an appropriate transaction/configuration extract.
3. Test the selected questions: whether required approval preceded implementation; whether required role separation is evidenced; whether the authorised and implemented values/effective dates agree; and whether permitted sample or population recalculation agrees with the configured terms. The organisation supplies the criteria—this example asserts no jurisdiction-specific requirement.
4. Return a review package with procedure/version, population and exclusions, work performed, evidence references, exceptions, incomplete tests and proposed next actions. Findings return to the configured review destination.
5. A reviewer requests clarification, accepts or rejects a finding, or asks for a proposed correction/retest. Changed inputs require an identifiable new run; a completed test does not automatically approve the business change or close an issue.

**Enhancements:** reliable event capture, duplicate/retry handling, scope/version binding, evidence-completeness checks, configurable criteria and findings linked to affected records. A pre-change review can examine proposed design/configuration and approvals; post-change testing can examine operation over a defined period. They answer different questions. File exports, change tickets or supported integrations are possible event/evidence sources; no actual microfinance-system access has been established.

This is one event-driven counterpart among the full catalog, not the definition of the product. Relevant features: C28, C37, C43–C45, C59; E01–E05.

## 4. Investigate and verify — debugging to an IT access exception

**Codex pattern:** trace a suspected bug to relevant inputs and execution, reproduce it where permitted, change a proposed fix and rerun a focused check.

**Auditor use:** a user-access listing contains an apparent terminated employee with an active account. The agent traces identifiers through the accessible HR, account and entitlement records, checks effective dates, identifies whether the records actually refer to the same person and separates an exception from stale or incomplete data. It prepares supporting evidence and a proposed management action. A later retest uses new records.

**Enhancements:** population reconciliation, identity matching confidence, effective-date logic and explicit evidence gaps. Direct account disablement requires separate operational authority; analysis permission alone does not grant it. Relevant features: C18–C19, C28–C29, C34–C35, C66, C72; E13–E14.

## 5. Divide a difficult task — subagents to parallel audit work

**Codex pattern:** delegate independent questions, inspect progress and combine results in the main task.

**Auditor use:** for an authorised procurement analysis, separate agents examine policy criteria, transaction exceptions and supporting document references. The lead agent reconciles their identifiers, resolves inconsistent assumptions and produces one reviewable work package. The auditor can interrupt or change scope without losing which work completed.

**Enhancements:** a common period/entity/population definition; source and procedure versions per agent; collision-free outputs; explicit reconciliation of contradictory findings. Three agents agreeing from the same flawed extract is not three independent sources of evidence. Relevant features: C05, C11–C17, C45–C47.

## 6. Explore alternatives — branches and worktrees to analysis variants

**Codex pattern:** use a separate chat or working tree to explore an alternative without replacing the original work immediately, then compare the changes.

**Auditor use:** compare two justified matching approaches or investigate an alternative interpretation of a process. Each variant retains its own assumptions and outputs. The auditor compares how the choice changes exceptions and selects the intended result, keeping the reasons visible.

**Enhancements:** intelligible version/variant labels, meaningful cell/section/result differences, shared immutable input references where practical and detection of stale baselines. Do not assume binary Office files can be merged safely using source-code merge rules. Relevant features: C10, C13, C46–C47, C58.

## 7. Improve a process — planning and hardening to advisory work

**Codex pattern:** analyse the current design and evidence, compare improvement options with tradeoffs, and wait for direction before implementation.

**Auditor use:** review a documented onboarding process and related observations, then prepare options for reducing duplicate checks or strengthening role separation. Draft a process diagram, an options paper and a presentation suitable for discussion. The practitioner can revise the underlying files in Word and PowerPoint.

**Enhancements:** distinguish verified current behavior from a proposed design; preserve stakeholder assumptions, constraints and differing viewpoints; use the practitioner's report style and review process. A polished process diagram does not validate operational effectiveness. Relevant features: C15, C22–C23, C29, C31–C32; E15–E16.

## 8. Reuse good work — skills and instructions to a practitioner's methods

**Codex pattern:** project instructions set durable conventions, skills package repeatable procedures, and memory provides permitted contextual continuity.

**Auditor use:** an auditor applies their organisation's workpaper template, terminology and analytical procedure to a new task while reusing approved general knowledge. The same underlying product supports a different methodology in another engagement. A demonstrated repetitive file workflow can become a reviewed reusable skill where the relevant mechanism is supported.

**Enhancements:** version the procedure and parameters; separate reusable method content from confidential client evidence; show exceptions and overrides; keep prior conclusions out of current evidence unless explicitly justified. Relevant features: C36–C40, C50–C52.

## 9. Manage and complete work — activity, review, export and handoff

**Codex pattern:** inspect active work and results, triage findings, ask for revisions, share permitted outputs and retain resumable context.

**Auditor use:** move between several assignments, attend to tasks waiting on evidence, review a report and its exceptions workbook, request corrections and package the approved outputs for the chosen destination. The destination can be an external audit system or the proposed built-in record mode.

**Enhancements:** show execution progress separately from evidence completeness and professional review; make failed delivery visible; preserve source links and the intended audience when exporting. Formal approval, retention and record authority follow the chosen mode and later domain design. Relevant features: C02, C05, C14, C29–C31, C58–C64, C71–C75; E17.

## What these examples establish

They explain the proposed product experience and the adaptations to investigate. They do not demonstrate runtime feasibility, file fidelity, connector support or audit quality. Those are verification tasks. The full catalog retains additional capabilities—including command-line use, cloud/remote execution, voice, visual inputs, model/provider controls, permissions, administration and optional peripherals—regardless of whether a particular example uses them.
