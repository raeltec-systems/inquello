---
title: "Report 4 extraction: internal audit lifecycle and judgment"
type: domain
intent: process-extraction-only
created: 2026-11-05
import_created: 2026-11-04
status: imported-unverified
decision: "A sourced map of internal audit work, separating standards from guidance, practice and local mandates, to ground future product specification"
via: imports/report-4-gemini-antigravity/research.md
---

# Report 4 decision-relevant digest

## Findings first

The import is a detailed candidate map, not a verified compliance baseline. Its useful structure is the distinction between organizational planning, engagement planning/program design, evidence work, findings, communication and follow-up, with iteration and cross-cutting supervision, judgment, documentation, communication and objectivity. All externally attributed propositions below remain **unverified in this extraction**. Exact quotations inside the report have not been compared with the original documents.

The report repeatedly promotes practice or author interpretation into mandatory software behavior. Hold out universal 25/40 sampling, mandatory RCM/5Cs/root-cause completion, personal CAE approval of every event, all-change board gates, No Open Notes locks, automatic retesting/closure windows, ranking claims about EQA defects, and four-layer architecture from any normative product baseline. Regulatory claims, especially SR 26-2/OCC 2026-13, topical effective dates and jurisdictional scope, require current primary-source verification.

## Provenance and reading scope

- Read the preserved research.md (1,266 lines), claims.json, memlog.md, and the three supplied supporting digests: d1-iia-guidance-and-topical-r1-1.md; d3-practice-software-and-redteam-r1-1.md; d4-regulatory-and-industry-r1-1.md.
- All are inside imports/report-4-gemini-antigravity/. Short names d1/d3/d4 in pointers refer to these exact files. Report pointers (§/Stage/subheading) refer to research.md within that import.
- Producer label: Gemini/Antigravity, supplied by the parent assignment/import folder; report frontmatter dates creation/update 2026-11-04. No independent provenance of its research execution is asserted.
- Standalone local domain-internal-audit-methodology report is reported by parent to be the same text after newline normalization: not an independent fifth source. No independent confirmation counted from duplication.
- Import source register claims source access 2026-11-04. **This extraction accessed the import on 2026-11-05; did not access the cited websites.** Publication dates, publishers, titles, quotations and URLs are imported attributions, not independently authenticated.
- The supplied claims.json contains eight broad categories; memlog contains nineteen claims labeled verified. Those labels are not inherited. A source-list row with two publisher names is not proof of two-source corroboration.
- No canonical memlog edits, raw import modifications, PRD/code/test/git changes, installation, downloads or outreach were performed. Only this digest is written.
- Standing rule: Never conclude from training data alone. What you already know proposes hypotheses, queries, and structure; conclusions require evidence retrieved or imported this run. A claim you cannot evidence is stated as an unverified belief or not at all.
- Standing rule: The research firewall. Project context — briefs, PRDs, code, memory, {workflow.persistent_facts} — shapes what to ask, never what is true. It is inadmissible as evidence: every claim in a research artifact traces to a digest or import file with a source. Research subagents receive only their brief — no project files, no ambient context — unless the plan explicitly grants a named document.

## Claim register

Repeated passages are consolidated by proposition family, not counted as corroboration. Every row has exact import pointer and source reference. A source reference resolves to full title/URL in the source register below. Confidence measures support for the external proposition, not fidelity of transcription: moderate for specific imported standards quotations, low for practice/quantitative/regulatory composites or inferred software rules. Status for **every row** is imported-unverified; classifications are analytical, not legal conclusions.

### R4-01 — Framework
- claim: IPPF has mandatory Standards and applicable Topical Requirements plus nonmandatory Global Guidance; 2024 GIAS published 2024-01-09, effective 2025-01-09, replaces 2017 framework, with 5 domains, 15 principles, 52 standards.
- source: [1], [2] via imports/report-4-gemini-antigravity/research.md; exact pointer: §1.1–1.2; d1 claims 1.1–1.4.
- publisher: The Institute of Internal Auditors (The IIA) (as attributed by import).
- pub_date: [1] 2024-01-09 (Effective 2025-01-09); [2] 2025-02.
- accessed: import inspected 2026-11-05; source access asserted by import 2026-11-04, not independently checked.
- class: structure; confidence: moderate (import-only); status: imported-unverified.
- qualification / decision use: Imported structural account; exact official text not independently retrieved.

### R4-02 — Normative force
- claim: Requirements use must; implementation considerations use should/may; evidence examples are illustrative, not required or exhaustive; glossary usage matters.
- source: [1] via imports/report-4-gemini-antigravity/research.md; exact pointer: §1.3, GIAS Fundamentals p.8, Glossary pp.12–13.
- publisher: The Institute of Internal Auditors (The IIA) (as attributed by import).
- pub_date: [1] 2024-01-09 (Effective 2025-01-09).
- accessed: import inspected 2026-11-05; source access asserted by import 2026-11-04, not independently checked.
- class: standards; confidence: moderate (import-only); status: imported-unverified.
- qualification / decision use: Do not promote example artifacts or implementation advice to universal requirements.

### R4-03 — Conformance exceptions
- claim: Report quotes 4.1 requiring other provisions and disclosure when law prevents conformance, and CAE documentation of circumstances, alternative actions, impact and rationale; Domain III permits documented compensating essential conditions.
- source: [1] via imports/report-4-gemini-antigravity/research.md; exact pointer: §1.3, GIAS pp.8,30,38.
- publisher: The Institute of Internal Auditors (The IIA) (as attributed by import).
- pub_date: [1] 2024-01-09 (Effective 2025-01-09).
- accessed: import inspected 2026-11-05; source access asserted by import 2026-11-04, not independently checked.
- class: compliance; confidence: low (import-only); status: imported-unverified.
- qualification / decision use: Exceptional alternative actions are not unrestricted configuration; verify applicability and exact obligations.

### R4-04 — Hypotheses and architecture
- claim: H1 is refined to a control-assurance judgment chain with substantive, fraud, performance, design-only and advisory variants; H2 iterative work; H3 six stages with five themes; H4 proposed four layers: professional foundation, external/topical obligations, methodology, context.
- source: [1], [25], [31], [32] via imports/report-4-gemini-antigravity/research.md; exact pointer: Executive takeaways 1–3; §2 H1–H4; d3 1.3.1–1.3.4.
- publisher: The Institute of Internal Auditors (The IIA); Public Company Accounting Oversight Board (PCAOB), ACCA, & Enterslice; Diligent; Wolters Kluwer, World Intellectual Property Organization (WIPO), & PwC (as attributed by import).
- pub_date: [1] 2024-01-09 (Effective 2025-01-09); [25] 2016-12 / 2024-03 (import alleges in force 2026-11-04); [31] 2024-06; [32] 2023-09 / 2024-05.
- accessed: import inspected 2026-11-05; source access asserted by import 2026-11-04, not independently checked.
- class: inference; confidence: low (import-only); status: imported-unverified.
- qualification / decision use: Six stages, dual modes and four software layers are author synthesis, not mandated architecture. External-auditor standards are not automatically internal-audit obligations.

### R4-05 — Iteration and approval
- claim: Report quotes p.92 on overlapping/iterative engagement work and cites scope/objective approval 13.3, work-program initial and subsequent approval 13.6/14.2, significant plan changes 9.4, and timely communication 13.1.
- source: [1] via imports/report-4-gemini-antigravity/research.md; exact pointer: §2 H2 detailed analysis; §8 L1–L10; GIAS pp.67,92–106.
- publisher: The Institute of Internal Auditors (The IIA) (as attributed by import).
- pub_date: [1] 2024-01-09 (Effective 2025-01-09).
- accessed: import inspected 2026-11-05; source access asserted by import 2026-11-04, not independently checked.
- class: standards; confidence: moderate (import-only); status: imported-unverified.
- qualification / decision use: H2 table says every plan alteration needs board approval, but quoted 9.4 says significant changes. Separate CAE accountability, authorized delegation, and actual approval timing.

### R4-06 — Mandate and governance
- claim: CAE develops charter/mandate, strategy and methodologies; report assigns board charter/plan/budget approval, functional independence, annual independence confirmation, and safeguards for non-audit roles.
- source: [1] via imports/report-4-gemini-antigravity/research.md; exact pointer: §3 Stage 1 items 1–7; §5.5; GIAS 6.1–7.2,9.2–9.3,10.1.
- publisher: The Institute of Internal Auditors (The IIA) (as attributed by import).
- pub_date: [1] 2024-01-09 (Effective 2025-01-09).
- accessed: import inspected 2026-11-05; source access asserted by import 2026-11-04, not independently checked.
- class: standards; confidence: moderate (import-only); status: imported-unverified.
- qualification / decision use: Board essential conditions and CAE duties must be distinguished; annual charter review claimed as failure-mode remedy is not independently evidenced as a universal interval.

### R4-07 — Organizational risk planning
- claim: CAE understands governance, risk and controls; documented strategy/objectives/risk assessment informed by board and senior management at least annually supports a dynamic plan considering IT governance, fraud, ethics/compliance and high-risk areas.
- source: [1] via imports/report-4-gemini-antigravity/research.md; exact pointer: §3 Stage 1 Understand/Do 3,5; GIAS 9.1,9.4 pp.61,66–68.
- publisher: The Institute of Internal Auditors (The IIA) (as attributed by import).
- pub_date: [1] 2024-01-09 (Effective 2025-01-09).
- accessed: import inspected 2026-11-05; source access asserted by import 2026-11-04, not independently checked.
- class: standards; confidence: moderate (import-only); status: imported-unverified.
- qualification / decision use: Does not establish one scoring formula or a mandatory rotational universe.

### R4-08 — Planning escalation
- claim: Report quotes CAE communication of resource constraints, omitted high-risk assurance work rationale, conflicting stakeholder requests and access/scope limits; board approval covers plan and significant changes.
- source: [1] via imports/report-4-gemini-antigravity/research.md; exact pointer: §3 Stage 1 Do 6; GIAS 8.2,9.4 pp.54,67.
- publisher: The Institute of Internal Auditors (The IIA) (as attributed by import).
- pub_date: [1] 2024-01-09 (Effective 2025-01-09).
- accessed: import inspected 2026-11-05; source access asserted by import 2026-11-04, not independently checked.
- class: standards; confidence: moderate (import-only); status: imported-unverified.
- qualification / decision use: Do not make all replanning events a board approval gate.

### R4-09 — Assurance coordination
- claim: CAE coordinates internal/external assurance, escalates insufficient coordination, documents reliance basis and retains conclusion responsibility; competence, objectivity and work quality are proposed reliance considerations.
- source: [1], [6] via imports/report-4-gemini-antigravity/research.md; exact pointer: §3 Stage 1 Decide/Do 4; GIAS 9.5 pp.69–71; d1 3.1.
- publisher: The Institute of Internal Auditors (The IIA) (as attributed by import).
- pub_date: [1] 2024-01-09 (Effective 2025-01-09); [6] 2020-07.
- accessed: import inspected 2026-11-05; source access asserted by import 2026-11-04, not independently checked.
- class: standards/guidance; confidence: moderate (import-only); status: imported-unverified.
- qualification / decision use: Combined assurance map is an example format. Three Lines guidance is not itself law.

### R4-10 — Planning tools
- claim: Audit universes, weighted risk scores/heatmaps, entity/process/risk-pillar taxonomies, annual/rolling/backlog plans, resource budgets and contingency capacity are reported methods.
- source: [1], [6], [30], [31], [32] via imports/report-4-gemini-antigravity/research.md; exact pointer: §3 Stage 1 Do 2–5, artifact table, variations; d3 1.1.1–1.1.3.
- publisher: The Institute of Internal Auditors (The IIA); Protiviti, Deloitte, KPMG, ISACA, Hyperproof, & Vanta; Diligent; Wolters Kluwer, World Intellectual Property Organization (WIPO), & PwC (as attributed by import).
- pub_date: [1] 2024-01-09 (Effective 2025-01-09); [6] 2020-07; [30] 2024-07 / 2025-01; [31] 2024-06; [32] 2023-09 / 2024-05.
- accessed: import inspected 2026-11-05; source access asserted by import 2026-11-04, not independently checked.
- class: practice; confidence: low (import-only); status: imported-unverified.
- qualification / decision use: Example weights 25/25/20/15/15, 3x3/5x5 matrices and refresh cadences are choices, not empirical requirements.

### R4-11 — Engagement understanding
- claim: Information on activity strategy, objectives, risks, risk tolerance, plan assessment, governance/risk/control processes and frameworks supports engagement risk assessment; review intended process operation and prioritize significant/fraud risks; prior assessment may be updated.
- source: [1] via imports/report-4-gemini-antigravity/research.md; exact pointer: §3 Stage 2 Understand/Do 3–4; GIAS 13.2 pp.95–97.
- publisher: The Institute of Internal Auditors (The IIA) (as attributed by import).
- pub_date: [1] 2024-01-09 (Effective 2025-01-09).
- accessed: import inspected 2026-11-05; source access asserted by import 2026-11-04, not independently checked.
- class: standards; confidence: moderate (import-only); status: imported-unverified.
- qualification / decision use: Formal documented risk assessment may be unnecessary for advisory per stakeholder agreement.

### R4-12 — Walkthrough and RCM
- claim: Interviews, surveys, observation, prior records, process walkthroughs, preliminary analytics and narrative/flowchart/RCM documentation are reported ways to understand processes and design adequacy.
- source: [1], [7], [31], [32], [33] via imports/report-4-gemini-antigravity/research.md; exact pointer: §3 Stage 2 Do 3–4 and artifact table; d1 3.2; d3 1.1.4–1.1.6.
- publisher: The Institute of Internal Auditors (The IIA); Diligent; Wolters Kluwer, World Intellectual Property Organization (WIPO), & PwC; AuditBoard (Optro) & Workiva (as attributed by import).
- pub_date: [1] 2024-01-09 (Effective 2025-01-09); [7] 2020-01; [31] 2024-06; [32] 2023-09 / 2024-05; [33] 2024-08 / 2025-02.
- accessed: import inspected 2026-11-05; source access asserted by import 2026-11-04, not independently checked.
- class: guidance/practice; confidence: low (import-only); status: imported-unverified.
- qualification / decision use: RCM is called required in some tables but optional elsewhere; no imported quote mandates an RCM, flowchart or one-transaction walkthrough.

### R4-13 — Criteria
- claim: 13.4 is quoted to require relevant criteria and assessing existing criteria adequacy; use adequate criteria, otherwise identify criteria through discussion with board and/or senior management; policies, law, contracts, KPIs and frameworks are examples.
- source: [1], [7] via imports/report-4-gemini-antigravity/research.md; exact pointer: §3 Stage 2 Decide/Do 5; GIAS 13.4 pp.100–101.
- publisher: The Institute of Internal Auditors (The IIA) (as attributed by import).
- pub_date: [1] 2024-01-09 (Effective 2025-01-09); [7] 2020-01.
- accessed: import inspected 2026-11-05; source access asserted by import 2026-11-04, not independently checked.
- class: standards/guidance; confidence: moderate (import-only); status: imported-unverified.
- qualification / decision use: Absence of criteria as automatic design deficiency is an interpretive assertion; stakeholder agreement does not by itself establish adequacy.

### R4-14 — Scope and limitations
- claim: Document engagement purpose/goals and boundaries; consider assurance/advisory type; CAE approves objectives/scope and changes; discuss limitations with management and elevate unresolved limits to board under methodology.
- source: [1] via imports/report-4-gemini-antigravity/research.md; exact pointer: §3 Stage 2 Decide/Do 6; GIAS 13.3 pp.98–99.
- publisher: The Institute of Internal Auditors (The IIA) (as attributed by import).
- pub_date: [1] 2024-01-09 (Effective 2025-01-09).
- accessed: import inspected 2026-11-05; source access asserted by import 2026-11-04, not independently checked.
- class: standards; confidence: moderate (import-only); status: imported-unverified.
- qualification / decision use: Stage 2 also permits delegated director approval. Do not turn the report into a CAE-personally-clicks-every-change requirement.

### R4-15 — Engagement communication
- claim: Report quotes effective communication throughout, objectives/scope/timing communicated to management and subsequent changes timely; announcement/opening meeting/terms-of-reference memo and PBC portal are practice formats.
- source: [1], [7], [31], [32] via imports/report-4-gemini-antigravity/research.md; exact pointer: §3 Stage 2 Do 2,7 and artifacts; GIAS 13.1 pp.93–95.
- publisher: The Institute of Internal Auditors (The IIA); Diligent; Wolters Kluwer, World Intellectual Property Organization (WIPO), & PwC (as attributed by import).
- pub_date: [1] 2024-01-09 (Effective 2025-01-09); [7] 2020-01; [31] 2024-06; [32] 2023-09 / 2024-05.
- accessed: import inspected 2026-11-05; source access asserted by import 2026-11-04, not independently checked.
- class: standards/practice; confidence: low (import-only); status: imported-unverified.
- qualification / decision use: Communication is not management veto over assurance scope; meeting/memo format is not mandated by the quoted requirement.

### R4-16 — Staffing and competence
- claim: Identify resources by nature, complexity and timeframe; assess financial/human/technical sufficiency, discuss shortages with CAE; undertake services only with obtainable competencies.
- source: [1] via imports/report-4-gemini-antigravity/research.md; exact pointer: §3 Stage 3 Understand/Do 4; GIAS 3.1,13.5 pp.26,101–102.
- publisher: The Institute of Internal Auditors (The IIA) (as attributed by import).
- pub_date: [1] 2024-01-09 (Effective 2025-01-09).
- accessed: import inspected 2026-11-05; source access asserted by import 2026-11-04, not independently checked.
- class: standards; confidence: moderate (import-only); status: imported-unverified.
- qualification / decision use: A specific certification, roster form, specialist marketplace or software gate is not established.

### R4-17 — Work program
- claim: Develop documented program based on planning; identify criteria per objective, tasks, methodologies/analytical procedures/tools and assigned auditors; CAE review/approval before implementation and promptly on changes.
- source: [1] via imports/report-4-gemini-antigravity/research.md; exact pointer: §3 Stage 3 Do 5, Evidence; GIAS 13.6 pp.103–104.
- publisher: The Institute of Internal Auditors (The IIA) (as attributed by import).
- pub_date: [1] 2024-01-09 (Effective 2025-01-09).
- accessed: import inspected 2026-11-05; source access asserted by import 2026-11-04, not independently checked.
- class: standards; confidence: moderate (import-only); status: imported-unverified.
- qualification / decision use: Exact quoted elements do not impose a particular RCM hierarchy, sampling template or irreversible stage lock.

### R4-18 — Control and substantive procedures
- claim: Report distinguishes design adequacy and operating effectiveness; uses inquiry, observation, inspection, analysis and reperformance; design failures may avoid unnecessary operating tests; substantive procedures can test objectives without control entities.
- source: [1], [7], [8], [25], [31], [33] via imports/report-4-gemini-antigravity/research.md; exact pointer: §2 H1; §3 Stage 3 Do 1–2; d3 1.3.1.
- publisher: The Institute of Internal Auditors (The IIA); Public Company Accounting Oversight Board (PCAOB), ACCA, & Enterslice; Diligent; AuditBoard (Optro) & Workiva (as attributed by import).
- pub_date: [1] 2024-01-09 (Effective 2025-01-09); [7] 2020-01; [8] 2021-01; [25] 2016-12 / 2024-03 (import alleges in force 2026-11-04); [31] 2024-06; [33] 2024-08 / 2025-02.
- accessed: import inspected 2026-11-05; source access asserted by import 2026-11-04, not independently checked.
- class: guidance/practice; confidence: low (import-only); status: imported-unverified.
- qualification / decision use: A fixed lowest-to-highest reliability ladder and always-highest reperformance are unsupported generalizations; reliability depends on context.

### R4-19 — Sampling principles
- claim: Report discusses full-population versus sample testing, statistical and nonstatistical methods, population completeness, selection rationale and sample identifiers for repeatability.
- source: [1], [8], [34] via imports/report-4-gemini-antigravity/research.md; exact pointer: §3 Stage 3 Do 3 and Evidence; d1 3.3.
- publisher: The Institute of Internal Auditors (The IIA); PwC Viewpoint, SOXLayer, & University of Kentucky Internal Audit (as attributed by import).
- pub_date: [1] 2024-01-09 (Effective 2025-01-09); [8] 2021-01; [34] 2024-04.
- accessed: import inspected 2026-11-05; source access asserted by import 2026-11-04, not independently checked.
- class: guidance/practice; confidence: low (import-only); status: imported-unverified.
- qualification / decision use: Statistical classification of stratified sampling and universal error projection require checking. A risk-based sample is not automatically statistically extrapolatable.

### R4-20 — Sampling numbers
- claim: Imported tables assert annual 1; quarterly 2; monthly 2–5; semi-monthly 3–7; weekly 5–15; daily 25–60, including PwC 25/40/60 by risk, and automated test of one conditional on effective ITGCs.
- source: [34] via imports/report-4-gemini-antigravity/research.md; exact pointer: §3 Stage 3 Do 3; d3 1.2.1; memlog ref [34].
- publisher: PwC Viewpoint, SOXLayer, & University of Kentucky Internal Audit (as attributed by import).
- pub_date: [34] 2024-04.
- accessed: import inspected 2026-11-05; source access asserted by import 2026-11-04, not independently checked.
- class: quantitative-practice; confidence: low (import-only); status: imported-unverified.
- qualification / decision use: Low confidence. Generic homepage citations do not substantiate these tables. Do not treat 25/40, 25–60 or test-of-one as IIA/PCAOB universal minimums.

### R4-21 — PBC collection
- claim: Two-wave requests first obtain population extracts then auditor-selected item support, with IDs, linked procedures, owners, due dates and requested/submitted/returned/accepted states.
- source: [31], [32], [33] via imports/report-4-gemini-antigravity/research.md; exact pointer: §3 Stage 3 Do 6 and artifact table; d3 1.1.7–1.1.8.
- publisher: Diligent; Wolters Kluwer, World Intellectual Property Organization (WIPO), & PwC; AuditBoard (Optro) & Workiva (as attributed by import).
- pub_date: [31] 2024-06; [32] 2023-09 / 2024-05; [33] 2024-08 / 2025-02.
- accessed: import inspected 2026-11-05; source access asserted by import 2026-11-04, not independently checked.
- class: practice; confidence: low (import-only); status: imported-unverified.
- qualification / decision use: Useful workflow hypothesis, not verified current product behavior or required status vocabulary.

### R4-22 — Evidence quality
- claim: 14.1 is quoted as relevant, reliable and sufficient: consistent with objectives/scope, factual/current, strengthened by independent/direct sourcing, corroboration and effective systems; repeatable conclusions; seek more information or consider finding if evidence unavailable.
- source: [1] via imports/report-4-gemini-antigravity/research.md; exact pointer: §3 Stage 4 Do 1; GIAS 14.1 pp.104–105.
- publisher: The Institute of Internal Auditors (The IIA) (as attributed by import).
- pub_date: [1] 2024-01-09 (Effective 2025-01-09).
- accessed: import inspected 2026-11-05; source access asserted by import 2026-11-04, not independently checked.
- class: standards; confidence: moderate (import-only); status: imported-unverified.
- qualification / decision use: Three attributes are supported as an imported quotation only. Report explanation that useful was folded into relevant remains interpretation.

### R4-23 — Skepticism and care
- claim: Report quotes 4.2 assessing complexity/significance, errors/fraud/noncompliance, cost/benefits, resources and appropriate tools, and 4.3 inquisitiveness, reliability challenge and seeking evidence for inconsistent/misleading statements.
- source: [1] via imports/report-4-gemini-antigravity/research.md; exact pointer: §3 Stage 4 Do 1,5; §5.2; GIAS pp.31,33.
- publisher: The Institute of Internal Auditors (The IIA) (as attributed by import).
- pub_date: [1] 2024-01-09 (Effective 2025-01-09).
- accessed: import inspected 2026-11-05; source access asserted by import 2026-11-04, not independently checked.
- class: standards; confidence: moderate (import-only); status: imported-unverified.
- qualification / decision use: Preserve professional judgment rather than reducing it to completion checkboxes.

### R4-24 — IPE and analytics
- claim: Completeness/accuracy checks of entity extracts, SQL parameters/control totals and source records support reliability; scripts may test whole digital populations and flag duplicates, threshold splitting or access anomalies.
- source: [1], [8], [31], [34] via imports/report-4-gemini-antigravity/research.md; exact pointer: §3 Stage 4 Do 1–2; d1 3.3–3.4.
- publisher: The Institute of Internal Auditors (The IIA); Diligent; PwC Viewpoint, SOXLayer, & University of Kentucky Internal Audit (as attributed by import).
- pub_date: [1] 2024-01-09 (Effective 2025-01-09); [8] 2021-01; [31] 2024-06; [34] 2024-04.
- accessed: import inspected 2026-11-05; source access asserted by import 2026-11-04, not independently checked.
- class: guidance/practice; confidence: low (import-only); status: imported-unverified.
- qualification / decision use: Full-population coverage does not prove all risks addressed or remove data/model/non-sampling risk; no universal IPE checklist is evidenced.

### R4-25 — Exceptions and further work
- claim: Compare criteria with condition; differences are potential findings requiring evaluation; validate false positives, assess sufficient evidence and additional analysis, revise program with approval.
- source: [1], [8], [34] via imports/report-4-gemini-antigravity/research.md; exact pointer: §3 Stage 4 Decide/Do 3–4; GIAS 14.2 p.106; §8 L5–L6.
- publisher: The Institute of Internal Auditors (The IIA); PwC Viewpoint, SOXLayer, & University of Kentucky Internal Audit (as attributed by import).
- pub_date: [1] 2024-01-09 (Effective 2025-01-09); [8] 2021-01; [34] 2024-04.
- accessed: import inspected 2026-11-05; source access asserted by import 2026-11-04, not independently checked.
- class: standards/practice; confidence: low (import-only); status: imported-unverified.
- qualification / decision use: Report's add-15–25 after one exception or immediate failure after 2+ exceptions is an unsupported methodology-specific example, not standard.

### R4-26 — Fraud escalation
- claim: Legal/regulatory violations are reported to authorized recipients under applicable laws/policies; report advises preserve evidence, notify supervisor/CAE and involve legal/security/board as appropriate for suspected fraud.
- source: [1], [25] via imports/report-4-gemini-antigravity/research.md; exact pointer: §3 Stage 4 Do 5; GIAS 1.3 p.19,4.2–4.3; d3 1.3.1.
- publisher: The Institute of Internal Auditors (The IIA); Public Company Accounting Oversight Board (PCAOB), ACCA, & Enterslice (as attributed by import).
- pub_date: [1] 2024-01-09 (Effective 2025-01-09); [25] 2016-12 / 2024-03 (import alleges in force 2026-11-04).
- accessed: import inspected 2026-11-05; source access asserted by import 2026-11-04, not independently checked.
- class: standards/guidance; confidence: moderate (import-only); status: imported-unverified.
- qualification / decision use: Do-not-confront is operational advice, not established verbatim mandatory GIAS rule; avoid universalizing external financial-audit fraud standards.

### R4-27 — Supervision
- claim: CAE establishes supervision/quality/competency methodologies; CAE or supervisor guides staff, verifies complete programs and supported results; evidence of supervision retained, performance feedback provided.
- source: [1] via imports/report-4-gemini-antigravity/research.md; exact pointer: §3 Stage 4 Do 6; §5.1; GIAS 12.3 pp.90–91.
- publisher: The Institute of Internal Auditors (The IIA) (as attributed by import).
- pub_date: [1] 2024-01-09 (Effective 2025-01-09).
- accessed: import inspected 2026-11-05; source access asserted by import 2026-11-04, not independently checked.
- class: standards; confidence: moderate (import-only); status: imported-unverified.
- qualification / decision use: Responsibility does not prove all actions require personal CAE performance.

### R4-28 — Documentation and retention
- claim: 14.6 quoted: document information/evidence for repeatable results, auditor/supervisor review accuracy/relevance/completeness, CAE review/approval, retention per law and organizational/function policies; protect confidential information.
- source: [1] via imports/report-4-gemini-antigravity/research.md; exact pointer: §3 Stage 4 Do 6; §5.3; GIAS 14.6 pp.111–112,5.2 p.35.
- publisher: The Institute of Internal Auditors (The IIA) (as attributed by import).
- pub_date: [1] 2024-01-09 (Effective 2025-01-09).
- accessed: import inspected 2026-11-05; source access asserted by import 2026-11-04, not independently checked.
- class: standards; confidence: moderate (import-only); status: imported-unverified.
- qualification / decision use: Fixed two-level software states, locked files, 5/7/10-year periods and retaining raw PII are not universal requirements.

### R4-29 — Review software locks
- claim: Report attributes threaded coaching notes, reviewer acceptance, permanent note audit trails and No Open Notes finalization to WIPO/TeamMate+, and review chains to AuditBoard/Workiva.
- source: [32], [33] via imports/report-4-gemini-antigravity/research.md; exact pointer: Executive takeaway 4; §3 Stage 4 Do 6; §8 L7; d3 1.1.12–1.1.13.
- publisher: Wolters Kluwer, World Intellectual Property Organization (WIPO), & PwC; AuditBoard (Optro) & Workiva (as attributed by import).
- pub_date: [32] 2023-09 / 2024-05; [33] 2024-08 / 2025-02.
- accessed: import inspected 2026-11-05; source access asserted by import 2026-11-04, not independently checked.
- class: player; confidence: low (import-only); status: imported-unverified.
- qualification / decision use: Unverified product/implementation assertions from generic URLs; one institution cannot establish all product defaults. Hard pre-report locks are proposed design, not standards mandates.

### R4-30 — Root cause and finding attributes
- claim: Report quotes 14.3 collaboration with management to identify root causes when possible, determine effects, assess likelihood/impact and prioritize; 5 Cs mnemonic is criteria/condition/cause/consequence/corrective action.
- source: [1], [15], [26] via imports/report-4-gemini-antigravity/research.md; exact pointer: §3 Stage 5 Do 1–2; GIAS 14.2–14.4 pp.106–110; d3 1.2.2.
- publisher: The Institute of Internal Auditors (The IIA); Chartered Institute of Internal Auditors (UK & Ireland); Qualityze & ComplianceQuest (as attributed by import).
- pub_date: [1] 2024-01-09 (Effective 2025-01-09); [15] 2024-03; [26] 2024-05 / 2024-08.
- accessed: import inspected 2026-11-05; source access asserted by import 2026-11-04, not independently checked.
- class: standards/guidance; confidence: moderate (import-only); status: imported-unverified.
- qualification / decision use: Preserve when possible. Mandatory seven-field template, completed 5-Whys/Fishbone/8D or known ultimate cause for every finding is not evidenced.

### R4-31 — Finding significance and ratings
- claim: Significant risk is documented/communicated as finding; other risk reporting is circumstances/methodology dependent; prioritize each finding under CAE methodology. Three/four-tier rating scales and aggregation thresholds are reported practice.
- source: [1], [35] via imports/report-4-gemini-antigravity/research.md; exact pointer: §3 Stage 5 Decide/Do 3; §3 Stage 6 Do 1; d3 1.2.3.
- publisher: The Institute of Internal Auditors (The IIA); MIT Audit Division, UNOPS Internal Audit, & Richard Chambers & Associates (as attributed by import).
- pub_date: [1] 2024-01-09 (Effective 2025-01-09); [35] 2024-02.
- accessed: import inspected 2026-11-05; source access asserted by import 2026-11-04, not independently checked.
- class: standards/practice; confidence: low (import-only); status: imported-unverified.
- qualification / decision use: High/medium/low, automatic unsatisfactory if one high, and equivalence to MRIA/ICFR categories are not universal standards.

### R4-32 — Action choices and ownership
- claim: 14.4 quoted allows auditor recommendations, requested management plans, or collaborative agreement addressing gap/risk/root cause; management owns implementation; final communication names responsible individuals and dates.
- source: [1] via imports/report-4-gemini-antigravity/research.md; exact pointer: §3 Stage 5 Do 5; GIAS 14.4,15.1 pp.109,113.
- publisher: The Institute of Internal Auditors (The IIA) (as attributed by import).
- pub_date: [1] 2024-01-09 (Effective 2025-01-09).
- accessed: import inspected 2026-11-05; source access asserted by import 2026-11-04, not independently checked.
- class: standards; confidence: moderate (import-only); status: imported-unverified.
- qualification / decision use: Recommendations AND action plans need not always both exist. Claim that one individual rather than multiple is universally mandatory conflicts with quoted individuals plural.

### R4-33 — Disagreement and courage
- claim: Discuss differences and seek mutual understanding; auditors need not change valid results without reason; use methodology to express both positions on results/actions; no concealment or misleading omission.
- source: [1] via imports/report-4-gemini-antigravity/research.md; exact pointer: §3 Stage 5 Do 4,6; GIAS 1.1,13.1,14.4 pp.17,93,109.
- publisher: The Institute of Internal Auditors (The IIA) (as attributed by import).
- pub_date: [1] 2024-01-09 (Effective 2025-01-09).
- accessed: import inspected 2026-11-05; source access asserted by import 2026-11-04, not independently checked.
- class: standards; confidence: moderate (import-only); status: imported-unverified.
- qualification / decision use: Exit meetings, auditee finding portals and prescribed dual-position report fields are implementation choices.

### R4-34 — Risk acceptance
- claim: CAE discusses management acceptance beyond appetite/tolerance with senior management and escalates unresolved matter to board; CAE is not responsible for resolving risk.
- source: [1] via imports/report-4-gemini-antigravity/research.md; exact pointer: §3 Stage 5 Do 6; Stage 6 Do 6; GIAS 11.5 p.84,15.2 p.115.
- publisher: The Institute of Internal Auditors (The IIA) (as attributed by import).
- pub_date: [1] 2024-01-09 (Effective 2025-01-09).
- accessed: import inspected 2026-11-05; source access asserted by import 2026-11-04, not independently checked.
- class: standards; confidence: moderate (import-only); status: imported-unverified.
- qualification / decision use: Not every disagreement or overdue task automatically equals unacceptable risk or automatic board escalation.

### R4-35 — Engagement conclusion
- claim: Conclusion relates results to engagement and management objectives and overall significance of aggregated findings; assurance includes effectiveness judgment and acknowledgment of effective processes.
- source: [1], [10], [35] via imports/report-4-gemini-antigravity/research.md; exact pointer: §3 Stage 6 Do 1; GIAS 14.5 p.110.
- publisher: The Institute of Internal Auditors (The IIA); MIT Audit Division, UNOPS Internal Audit, & Richard Chambers & Associates (as attributed by import).
- pub_date: [1] 2024-01-09 (Effective 2025-01-09); [10] 2020-01; [35] 2024-02.
- accessed: import inspected 2026-11-05; source access asserted by import 2026-11-04, not independently checked.
- class: standards; confidence: moderate (import-only); status: imported-unverified.
- qualification / decision use: Overall rating or numeric aggregation algorithm is optional methodology, not the same as required conclusion.

### R4-36 — Final communication
- claim: Report quotes each engagement communication includes objectives, scope, recommendations/actions if applicable and conclusions; action owners/dates and already-started actions; assurance adds findings/significance/priority, scope limitations and effectiveness conclusion.
- source: [1] via imports/report-4-gemini-antigravity/research.md; exact pointer: §3 Stage 6 Do 2; GIAS 15.1 pp.113–114.
- publisher: The Institute of Internal Auditors (The IIA) (as attributed by import).
- pub_date: [1] 2024-01-09 (Effective 2025-01-09).
- accessed: import inspected 2026-11-05; source access asserted by import 2026-11-04, not independently checked.
- class: standards; confidence: moderate (import-only); status: imported-unverified.
- qualification / decision use: Do not require findings or action plans where inapplicable; Word/PDF/slides format not mandated.

### R4-37 — Approval distribution and corrections
- claim: Final communication reviewed/approved before issue; CAE decides recipients/channel with delegation retaining responsibility, seeks legal/senior advice for external release as required; promptly sends significant corrections to original recipients.
- source: [1] via imports/report-4-gemini-antigravity/research.md; exact pointer: §3 Stage 6 Decide/Do 3–4; GIAS 11.3–11.4 pp.81,83,15.1.
- publisher: The Institute of Internal Auditors (The IIA) (as attributed by import).
- pub_date: [1] 2024-01-09 (Effective 2025-01-09).
- accessed: import inspected 2026-11-05; source access asserted by import 2026-11-04, not independently checked.
- class: standards; confidence: moderate (import-only); status: imported-unverified.
- qualification / decision use: Explicit delegation appears in quoted 11.3. Significant error criteria agreed with board; correction need not imply one mandatory software reissue flow.

### R4-38 — Conformance and other standards reporting
- claim: Report quotes disclosure of nonconforming standards, reasons and impact; accurate/objective/clear/concise/constructive/complete/timely communication; cite other authoritative requirements when jointly used as appropriate.
- source: [1] via imports/report-4-gemini-antigravity/research.md; exact pointer: §3 Stage 6 Do 2; GIAS 4.1,11.2,15.1 pp.29,79,114.
- publisher: The Institute of Internal Auditors (The IIA) (as attributed by import).
- pub_date: [1] 2024-01-09 (Effective 2025-01-09).
- accessed: import inspected 2026-11-05; source access asserted by import 2026-11-04, not independently checked.
- class: compliance; confidence: low (import-only); status: imported-unverified.
- qualification / decision use: Do not turn as appropriate into blanket reporting of every framework.

### R4-39 — Follow-up
- claim: 15.2 quoted: inquire on implementation, risk-based follow-up assessment, update tracking system, extent reflecting significance; obtain/document delays and discuss with CAE.
- source: [1], [18], [20], [31], [32] via imports/report-4-gemini-antigravity/research.md; exact pointer: §3 Stage 6 Do 5–6; GIAS 15.2 pp.114–115.
- publisher: The Institute of Internal Auditors (The IIA); Office of the Comptroller of the Currency (US Department of the Treasury); Board of Governors of the Federal Reserve System; Diligent; Wolters Kluwer, World Intellectual Property Organization (WIPO), & PwC (as attributed by import).
- pub_date: [1] 2024-01-09 (Effective 2025-01-09); [18] 2014-09 / 2019-07 (import alleges in force 2026-11-04); [20] 2013-01-23 (Updated 2025/2026; import alleges in force 2026-11-04); [31] 2024-06; [32] 2023-09 / 2024-05.
- accessed: import inspected 2026-11-05; source access asserted by import 2026-11-04, not independently checked.
- class: standards/practice; confidence: low (import-only); status: imported-unverified.
- qualification / decision use: Universal independent retesting, 30–90-day evidence window, closed/verified states, or allowing every low finding attestation-only are not established.

### R4-40 — Macro conclusions
- claim: Report distinguishes engagement conclusions, timely communication of identified themes and business-unit/organization conclusions when required, supported by information, request, criteria, scope/limits/period and reliance disclosure.
- source: [1], [10], [20], [21], [29] via imports/report-4-gemini-antigravity/research.md; exact pointer: §3 Stage 6 Do 7; GIAS 11.3 p.81.
- publisher: The Institute of Internal Auditors (The IIA); Board of Governors of the Federal Reserve System; Forvis Mazars US; UK Government (HM Treasury / IASAB), CIPFA, & Chartered IIA UK (as attributed by import).
- pub_date: [1] 2024-01-09 (Effective 2025-01-09); [10] 2020-01; [20] 2013-01-23 (Updated 2025/2026; import alleges in force 2026-11-04); [21] 2024-06; [29] 2024-12 / 2025-03 (Effective 2025-04-01; import alleges in force 2026-11-04).
- accessed: import inspected 2026-11-05; source access asserted by import 2026-11-04, not independently checked.
- class: standards/regulatory; confidence: low (import-only); status: imported-unverified.
- qualification / decision use: Universal annual macro opinion is not baseline GIAS; claimed US banking and UK public-sector mandates need direct applicable-text check.

### R4-41 — Objectivity
- claim: Report quotes impartiality and managing biases, avoiding/mitigating actual/potential/perceived impairment; assurance over prior responsibility presumed impaired within 12 months, separate advisory disclosure, prior advisory safeguards and independent oversight of CAE-responsibility functions.
- source: [1] via imports/report-4-gemini-antigravity/research.md; exact pointer: §5.5; §6.2; GIAS 2.1–2.3,7.1 pp.20–24,46.
- publisher: The Institute of Internal Auditors (The IIA) (as attributed by import).
- pub_date: [1] 2024-01-09 (Effective 2025-01-09).
- accessed: import inspected 2026-11-05; source access asserted by import 2026-11-04, not independently checked.
- class: standards; confidence: moderate (import-only); status: imported-unverified.
- qualification / decision use: Do not replace presumed impairment and safeguards with an unqualified cooling-off ban; assigning different auditors is stronger than quoted assign resources to manage objectivity.

### R4-42 — Assurance versus advisory
- claim: Advisory provides advice without assurance or management responsibility, scope agreed with stakeholders; formal risk assessment/criteria/evidence to develop findings may be unnecessary per agreement; program, supervision/documentation and final communication still apply.
- source: [1], [2] via imports/report-4-gemini-antigravity/research.md; exact pointer: §6.1–6.2; GIAS Glossary p.10,13.2,13.4,13.6,14.2,15.1.
- publisher: The Institute of Internal Auditors (The IIA) (as attributed by import).
- pub_date: [1] 2024-01-09 (Effective 2025-01-09); [2] 2025-02.
- accessed: import inspected 2026-11-05; source access asserted by import 2026-11-04, not independently checked.
- class: standards; confidence: moderate (import-only); status: imported-unverified.
- qualification / decision use: Blended services recognized. Advisory exceptions are specific, not an exemption from all governance. Follow-up limitation to agreed action plans needs exact-text validation.

### R4-43 — QAIP and EQA
- claim: Report attributes internal ongoing monitoring/self-assessment and board reporting to 8.3/12.1, and EQA at least every five years with at least one active CIA to 8.4; QA Manual adds templates/maturity assessment.
- source: [1], [11], [12] via imports/report-4-gemini-antigravity/research.md; exact pointer: §5.1; §9 G27/G42; d1 3.6,4.1.
- publisher: The Institute of Internal Auditors (The IIA); The Institute of Internal Auditors (The IIA) & BDO UK (as attributed by import).
- pub_date: [1] 2024-01-09 (Effective 2025-01-09); [11] 2024-07; [12] 2024-06.
- accessed: import inspected 2026-11-05; source access asserted by import 2026-11-04, not independently checked.
- class: standards/guidance; confidence: moderate (import-only); status: imported-unverified.
- qualification / decision use: Check full versus self-assessment/independent-validation options and assessor details before imposing one mechanism.

### R4-44 — EQA failure ranking
- claim: Report claims leading or most frequent failures are QAIP weaknesses, late signoffs, unlinked risks/criteria/procedures, weak root causes, obsolete charters, independence, poor sampling and unverified closure; assigns reasons such as deadline pressure and weak training.
- source: [12], [13], [14], [15] via imports/report-4-gemini-antigravity/research.md; exact pointer: Executive takeaway 4; §3 stages 1–6 Failure Modes; d1 4.1–4.5.
- publisher: The Institute of Internal Auditors (The IIA) & BDO UK; Wolters Kluwer; Ideagen & Sarah Vause Internal Audit Advisory; Chartered Institute of Internal Auditors (UK & Ireland) (as attributed by import).
- pub_date: [12] 2024-06; [13] 2024-09; [14] 2024-08; [15] 2024-03.
- accessed: import inspected 2026-11-05; source access asserted by import 2026-11-04, not independently checked.
- class: quantitative/practice; confidence: low (import-only); status: imported-unverified.
- qualification / decision use: Low confidence: no retrievable study/table/population/methodology in import proves rankings, prevalence or causation. Treat as review-risk checklist hypotheses, not statistics.

### R4-45 — Software workflow landscape
- claim: Diligent is said to provide workplan/control workflows, universe planning, PBC, TOD/TOE, ACL/Robots and issues; TeamMate+ universe/program/RWD/portal; AuditBoard OpsAudit/SOXHub RCM-centric; Workiva connected data, markup and rollover.
- source: [31], [32], [33] via imports/report-4-gemini-antigravity/research.md; exact pointer: §3 artifact tables; d3 1.1.1–1.1.14.
- publisher: Diligent; Wolters Kluwer, World Intellectual Property Organization (WIPO), & PwC; AuditBoard (Optro) & Workiva (as attributed by import).
- pub_date: [31] 2024-06; [32] 2023-09 / 2024-05; [33] 2024-08 / 2025-02.
- accessed: import inspected 2026-11-05; source access asserted by import 2026-11-04, not independently checked.
- class: player; confidence: low (import-only); status: imported-unverified.
- qualification / decision use: Descriptions dated 2023–2025, generic marketing links and bundled publishers. Verify product/version and claimed AuditBoard-to-Optro rebranding independently.

### R4-46 — Coaching note retention tension
- claim: Report contrasts permanent WIPO notes with alleged corporate/Big-4 deletion after review; proposes configurable tenant note-text purge while preserving signoff log.
- source: [1], [32] via imports/report-4-gemini-antigravity/research.md; exact pointer: §10.1 contradiction 2; §5.1; d3 1.1.12.
- publisher: The Institute of Internal Auditors (The IIA); Wolters Kluwer, World Intellectual Property Organization (WIPO), & PwC (as attributed by import).
- pub_date: [1] 2024-01-09 (Effective 2025-01-09); [32] 2023-09 / 2024-05.
- accessed: import inspected 2026-11-05; source access asserted by import 2026-11-04, not independently checked.
- class: inference/practice; confidence: low (import-only); status: imported-unverified.
- qualification / decision use: No evidence supports universal deletion practice or litigation rationale. Preservation/legal-hold/retention obligations must be checked; do not treat purge recommendation as authoritative.

### R4-47 — Banking baseline
- claim: BCBS 223 is described as 20 principles for independence, board oversight, comprehensive risk-based coverage, access and outsourcing constraints.
- source: [16], [17] via imports/report-4-gemini-antigravity/research.md; exact pointer: §7.1 C1; d4 1.1; memlog [16].
- publisher: Basel Committee on Banking Supervision (Bank for International Settlements); Gibraltar Financial Services Commission (as attributed by import).
- pub_date: [16] 2012-06 (import alleges in force 2026-11-04); [17] 2012-06 (import alleges in force 2026-11-04).
- accessed: import inspected 2026-11-05; source access asserted by import 2026-11-04, not independently checked.
- class: regulatory; confidence: low (import-only); status: imported-unverified.
- qualification / decision use: Basel supervisory principles are not automatically directly binding law everywhere; verify national adoption and exact outsourcing restriction.

### R4-48 — OCC and Fed mandates
- claim: Report attributes third-line separation, risk-governance review, dynamic plans, risk-data integrity and MRA/MRIA closure validation to OCC Appendix D/Handbook and SR13-1; also claims continuous risk assessment, risk opinion and external-auditor outsourcing ban.
- source: [18], [19], [20], [21] via imports/report-4-gemini-antigravity/research.md; exact pointer: §7.1 C2–3; d4 1.2–1.3; memlog [18],[20].
- publisher: Office of the Comptroller of the Currency (US Department of the Treasury); The Clearing House; Board of Governors of the Federal Reserve System; Forvis Mazars US (as attributed by import).
- pub_date: [18] 2014-09 / 2019-07 (import alleges in force 2026-11-04); [19] 2020-01 (import alleges in force 2026-11-04); [20] 2013-01-23 (Updated 2025/2026; import alleges in force 2026-11-04); [21] 2024-06.
- accessed: import inspected 2026-11-05; source access asserted by import 2026-11-04, not independently checked.
- class: regulatory; confidence: low (import-only); status: imported-unverified.
- qualification / decision use: Low confidence on composite claim. Scope by institution/threshold, supervisory terminology and current amendments unverified; imported publication dates conflict (OCC 2023-01 memlog vs 2014/2019 source register).

### R4-49 — Bank coverage cycles
- claim: Report repeatedly asserts all banking entities/activities must be covered over a 3–4-year cycle and that high-risk regulatory issues require independent validation before closure.
- source: [16], [18], [20] via imports/report-4-gemini-antigravity/research.md; exact pointer: §3 Stage 1 variations; §4.1; §7.1; d3 1.3.4.
- publisher: Basel Committee on Banking Supervision (Bank for International Settlements); Office of the Comptroller of the Currency (US Department of the Treasury); Board of Governors of the Federal Reserve System (as attributed by import).
- pub_date: [16] 2012-06 (import alleges in force 2026-11-04); [18] 2014-09 / 2019-07 (import alleges in force 2026-11-04); [20] 2013-01-23 (Updated 2025/2026; import alleges in force 2026-11-04).
- accessed: import inspected 2026-11-05; source access asserted by import 2026-11-04, not independently checked.
- class: regulatory; confidence: low (import-only); status: imported-unverified.
- qualification / decision use: No precise clause establishes universal 3–4 years, all banks, or audit ownership of every regulatory closure. Do not encode these numbers/gates.

### R4-50 — Model risk update
- claim: Report claims April 2026 SR26-2/OCC2026-13 updates SR11-7/2011-12, with conceptual soundness, ongoing monitoring, outcomes analysis, independent second-line validation and third-line framework audit.
- source: [24] via imports/report-4-gemini-antigravity/research.md; exact pointer: §7.1 C3; d4 1.5; memlog [24].
- publisher: Board of Governors of the Federal Reserve System, OCC, & Skadden LLP (as attributed by import).
- pub_date: [24] 2011-04 / 2026-04 (import alleges in force 2026-11-04).
- accessed: import inspected 2026-11-05; source access asserted by import 2026-11-04, not independently checked.
- class: regulatory; confidence: low (import-only); status: imported-unverified.
- qualification / decision use: Priority verification: cited URL is SR1107, not exact 2026 instrument; no retrieved primary update supports date, supersession, content or current force. Do not conclude false from absence, but hold out of normative baseline.

### R4-51 — UK/EU banking
- claim: Report combines Chartered IIA code (37 principles, published Sep2024/effective Jan2025) with EBA/GL/2021/05, claiming board reporting and capital/liquidity, conduct, ICT/resilience, AML/CFT coverage.
- source: [22], [23] via imports/report-4-gemini-antigravity/research.md; exact pointer: §7.1 C4; d4 1.4.
- publisher: Chartered Institute of Internal Auditors (UK) & European Banking Authority (EBA); Institute of Chartered Accountants in England and Wales (ICAEW) (as attributed by import).
- pub_date: [22] 2024-09 (Eff. 2025-01) & 2021-07-02 (import alleges in force 2026-11-04); [23] 2024-09.
- accessed: import inspected 2026-11-05; source access asserted by import 2026-11-04, not independently checked.
- class: regulatory; confidence: low (import-only); status: imported-unverified.
- qualification / decision use: Professional code versus regulator guidelines, jurisdiction, applicability and DORA statements are conflated; generic sites insufficient for current mandatory claims.

### R4-52 — SOX and external reliance
- claim: Report cites SOX404, AS2201/2605 for external auditor competence/objectivity assessment and testing/reperformance of IA work; AS2401 for management-override procedures; ICFR deficiency tiers/disclosure.
- source: [25], [33], [34] via imports/report-4-gemini-antigravity/research.md; exact pointer: §7.2 B/C1; d4 2.1; d3 1.3.1.
- publisher: Public Company Accounting Oversight Board (PCAOB), ACCA, & Enterslice; AuditBoard (Optro) & Workiva; PwC Viewpoint, SOXLayer, & University of Kentucky Internal Audit (as attributed by import).
- pub_date: [25] 2016-12 / 2024-03 (import alleges in force 2026-11-04); [33] 2024-08 / 2025-02; [34] 2024-04.
- accessed: import inspected 2026-11-05; source access asserted by import 2026-11-04, not independently checked.
- class: regulatory; confidence: low (import-only); status: imported-unverified.
- qualification / decision use: Separate external auditor obligations, issuer requirements, internal methodology and contractual reliance expectations. No sourced AS2605 paragraph establishes 25–40 daily samples.

### R4-53 — Manufacturing contexts
- claim: Corporate IA covers ERP/inventory/procurement/CapEx and ICFR; quality/supplier/EHS audits use ISO/IATF contexts, NCR/OFI terminology, CAPA/8D/5-Whys/effectiveness checks; shop-floor work traces BOM/ECO/WIP/scrap/cycle counts/variances.
- source: [26], [27] via imports/report-4-gemini-antigravity/research.md; exact pointer: §7.2 B/C2; d4 2.2–2.3.
- publisher: Qualityze & ComplianceQuest; Coraa AI & USM Supply Chain (as attributed by import).
- pub_date: [26] 2024-05 / 2024-08; [27] 2024-11 / 2025-02.
- accessed: import inspected 2026-11-05; source access asserted by import 2026-11-04, not independently checked.
- class: practice/regulatory; confidence: low (import-only); status: imported-unverified.
- qualification / decision use: Vendor homepages do not establish ISO requirements, mandatory named RCA tools or universal classification as second line. Verify current editions and company/customer scope.

### R4-54 — US public sector
- claim: Report attributes SOQM, peer review three-year cycle, CPE80/2years with24 government-related, compliance statements, independence and fraud/noncompliance reporting to 2024 Yellow Book GAO24-106786; links federal management controls to A123/Green Book17 principles.
- source: [28] via imports/report-4-gemini-antigravity/research.md; exact pointer: §7.3 B/C1; d4 3.1.
- publisher: U.S. Government Accountability Office (GAO), Office of Management and Budget (OMB), & Deloitte (as attributed by import).
- pub_date: [28] 2024-02 (Effective 2025-12-15; import alleges in force 2026-11-04).
- accessed: import inspected 2026-11-05; source access asserted by import 2026-11-04, not independently checked.
- class: regulatory; confidence: low (import-only); status: imported-unverified.
- qualification / decision use: Low confidence on composite mandatory account. Effective-date phrasing differs (periods vs audits beginning Dec15,2025); distinguish financial/attestation/performance applicability, federal vs other government, and current A123/Green Book editions.

### R4-55 — UK public sector
- claim: Report claims Apr1,2025 GIAS/IASAB replacement of PSIAS plus CIPFA local-government governance code, CAE qualification, annual overall opinion, public-interest/VfM duties and Annual Governance Statement links.
- source: [29] via imports/report-4-gemini-antigravity/research.md; exact pointer: §7.3 C2; d4 3.2.
- publisher: UK Government (HM Treasury / IASAB), CIPFA, & Chartered IIA UK (as attributed by import).
- pub_date: [29] 2024-12 / 2025-03 (Effective 2025-04-01; import alleges in force 2026-11-04).
- accessed: import inspected 2026-11-05; source access asserted by import 2026-11-04, not independently checked.
- class: regulatory; confidence: low (import-only); status: imported-unverified.
- qualification / decision use: Different UK public-sector bodies and local-government code scope cannot be collapsed. Verify qualification alternatives, opinion/reporting duty and effective instruments.

### R4-56 — Public-sector governance and disclosure
- claim: Report discusses statute-defined mandate/board equivalents, value for money economy/efficiency/effectiveness, appropriations/grant/procurement constraints and possible FOI/public report duties.
- source: [1], [28], [29] via imports/report-4-gemini-antigravity/research.md; exact pointer: §7.3 A/B; GIAS public-sector pp.116–119,5.2,11.3.
- publisher: The Institute of Internal Auditors (The IIA); U.S. Government Accountability Office (GAO), Office of Management and Budget (OMB), & Deloitte; UK Government (HM Treasury / IASAB), CIPFA, & Chartered IIA UK (as attributed by import).
- pub_date: [1] 2024-01-09 (Effective 2025-01-09); [28] 2024-02 (Effective 2025-12-15; import alleges in force 2026-11-04); [29] 2024-12 / 2025-03 (Effective 2025-04-01; import alleges in force 2026-11-04).
- accessed: import inspected 2026-11-05; source access asserted by import 2026-11-04, not independently checked.
- class: guidance/regulatory; confidence: low (import-only); status: imported-unverified.
- qualification / decision use: Not all public reports must be public or all private reports strictly confidential; jurisdiction and lawful exemptions matter. Equity is not evidenced as definition of effectiveness.

### R4-57 — Cyber topical
- claim: Report claims cyber requirement issued Feb5,2025/effective Feb5,2026, 17 items in governance4/risk6/controls7, applicability in assurance and exclusions documented, with NIST/ISO/COBIT mapping.
- source: [2], [3], [5] via imports/report-4-gemini-antigravity/research.md; exact pointer: §1.1; §7.4 C1; d1 2.1–2.3; d4 4.1.
- publisher: The Institute of Internal Auditors (The IIA); Optro (AuditBoard) & GovernanceDocs (as attributed by import).
- pub_date: [2] 2025-02; [3] 2025-02-05 (Mandatory Effective 2026-02-05); [5] 2025-03.
- accessed: import inspected 2026-11-05; source access asserted by import 2026-11-04, not independently checked.
- class: compliance; confidence: low (import-only); status: imported-unverified.
- qualification / decision use: Verify current official applicability and exact items; report's unconditionally required clashes with documented exclusions, and d1 admits Feb5/Feb15 issue-date ambiguity. Mapping is guidance not substitution.

### R4-58 — Other topical timeline
- claim: Report claims Third-Party effective Sep15,2026; Organizational Behavior effective Dec15,2026; emerging Resilience/Sustainability pipeline and associated coverage topics.
- source: [2], [4] via imports/report-4-gemini-antigravity/research.md; exact pointer: §7.4 C2; §10.2; d1 2.4; claims.json row3.
- publisher: The Institute of Internal Auditors (The IIA); PwC Ireland & The Institute of Internal Auditors (The IIA) (as attributed by import).
- pub_date: [2] 2025-02; [4] 2025-09 (Effective 2026-09-15 & 2026-12-15).
- accessed: import inspected 2026-11-05; source access asserted by import 2026-11-04, not independently checked.
- class: compliance; confidence: low (import-only); status: imported-unverified.
- qualification / decision use: Priority current check. On report date Nov4,2026 its own Dec15 date is future, not presently mandatory. Generic PwC homepage is inadequate support; no claimed pipeline obligation.

### R4-59 — Agile and continuous approaches
- claim: Report describes dynamic backlogs, 1–4-week (elsewhere 2–4-week) sprints, definitions of ready/done and continuous scripts triggering investigations, distinguished from management monitoring.
- source: [9], [30] via imports/report-4-gemini-antigravity/research.md; exact pointer: §2 H3; §7.4 B; d3 1.3.3; d4 4.2.
- publisher: The Institute of Internal Auditors (The IIA); Protiviti, Deloitte, KPMG, ISACA, Hyperproof, & Vanta (as attributed by import).
- pub_date: [9] 2020-11; [30] 2024-07 / 2025-01.
- accessed: import inspected 2026-11-05; source access asserted by import 2026-11-04, not independently checked.
- class: practice/tech_adoption; confidence: low (import-only); status: imported-unverified.
- qualification / decision use: Examples do not establish all SaaS IA teams replace annual plans or bypass program approval. Continuous detection does not cancel governance obligations.

### R4-60 — Technology automation
- claim: Report describes common-control mapping SOC2/ISO27001/NIST/SOX, cloud/identity/CI-CD evidence integrations, engineering issue sync and example critical7/high30-day SLAs.
- source: [3], [5], [30], [33] via imports/report-4-gemini-antigravity/research.md; exact pointer: §7.4 B; d4 4.2.
- publisher: The Institute of Internal Auditors (The IIA); Optro (AuditBoard) & GovernanceDocs; Protiviti, Deloitte, KPMG, ISACA, Hyperproof, & Vanta; AuditBoard (Optro) & Workiva (as attributed by import).
- pub_date: [3] 2025-02-05 (Mandatory Effective 2026-02-05); [5] 2025-03; [30] 2024-07 / 2025-01; [33] 2024-08 / 2025-02.
- accessed: import inspected 2026-11-05; source access asserted by import 2026-11-04, not independently checked.
- class: tech_adoption; confidence: low (import-only); status: imported-unverified.
- qualification / decision use: No independent current adoption data proves screenshots largely replaced, 100% APIs, universal bidirectional integrations or SLAs. Framework mappings do not prove equivalent assurance.

### R4-61 — Analytics and AI statistics
- claim: Report states 92% CAEs see analytics as vital, 41% teams use GenAI and 28% have advanced analytics, attributing IIA Pulse2025, Weaver and Deloitte.
- source: [36] via imports/report-4-gemini-antigravity/research.md; exact pointer: §3 Stage 4 Do 2; §10.2–10.3; d3 1.2.4; claims.json row8; memlog [36].
- publisher: The Institute of Internal Auditors (The IIA), Weaver, & Deloitte (as attributed by import).
- pub_date: [36] 2024-10 / 2025-03.
- accessed: import inspected 2026-11-05; source access asserted by import 2026-11-04, not independently checked.
- class: quantitative/ai_adoption; confidence: low (import-only); status: imported-unverified.
- qualification / decision use: Low confidence and stale beyond6 months: no survey table, denominator, population or field dates; bundled publishers are not two independent corroborations of the same claim.

### R4-62 — Software conclusions
- claim: Report recommends versioned approval loops, hard pre-report locks, mandatory criteria per RCM/work-step, QAIP telemetry, dynamic topical checklist import without schema migration, note-retention configuration and AI prompt/context provenance.
- source: [1], [2], [31], [32], [36] via imports/report-4-gemini-antigravity/research.md; exact pointer: Executive takeaways 1–4; §10.1–10.2.
- publisher: The Institute of Internal Auditors (The IIA); Diligent; Wolters Kluwer, World Intellectual Property Organization (WIPO), & PwC; The Institute of Internal Auditors (The IIA), Weaver, & Deloitte (as attributed by import).
- pub_date: [1] 2024-01-09 (Effective 2025-01-09); [2] 2025-02; [31] 2024-06; [32] 2023-09 / 2024-05; [36] 2024-10 / 2025-03.
- accessed: import inspected 2026-11-05; source access asserted by import 2026-11-04, not independently checked.
- class: inference; confidence: low (import-only); status: imported-unverified.
- qualification / decision use: Product proposals only. Criteria per objective is not necessarily per step; no software can eliminate professional failure by structure alone. Not accepted as specifications.

### R4-63 — Freshness and verification provenance
- claim: Report declares19 verified/0unverified and six stale flags, while claims.json has eight aggregate records and memlog nineteen asserted claims; d1/d3 describe search counts but no raw retrieval trace in provided import.
- source: [1], [2], [4], [16], [18], [20], [24], [28], [29], [30], [31], [32], [33], [36] via imports/report-4-gemini-antigravity/research.md; exact pointer: Frontmatter; claims.json; memlog; d1/d3 headers; §10.3.
- publisher: The Institute of Internal Auditors (The IIA); PwC Ireland & The Institute of Internal Auditors (The IIA); Basel Committee on Banking Supervision (Bank for International Settlements); Office of the Comptroller of the Currency (US Department of the Treasury); Board of Governors of the Federal Reserve System; Board of Governors of the Federal Reserve System, OCC, & Skadden LLP; U.S. Government Accountability Office (GAO), Office of Management and Budget (OMB), & Deloitte; UK Government (HM Treasury / IASAB), CIPFA, & Chartered IIA UK; Protiviti, Deloitte, KPMG, ISACA, Hyperproof, & Vanta; Diligent; Wolters Kluwer, World Intellectual Property Organization (WIPO), & PwC; AuditBoard (Optro) & Workiva; The Institute of Internal Auditors (The IIA), Weaver, & Deloitte (as attributed by import).
- pub_date: [1] 2024-01-09 (Effective 2025-01-09); [2] 2025-02; [4] 2025-09 (Effective 2026-09-15 & 2026-12-15); [16] 2012-06 (import alleges in force 2026-11-04); [18] 2014-09 / 2019-07 (import alleges in force 2026-11-04); [20] 2013-01-23 (Updated 2025/2026; import alleges in force 2026-11-04); [24] 2011-04 / 2026-04 (import alleges in force 2026-11-04); [28] 2024-02 (Effective 2025-12-15; import alleges in force 2026-11-04); [29] 2024-12 / 2025-03 (Effective 2025-04-01; import alleges in force 2026-11-04); [30] 2024-07 / 2025-01; [31] 2024-06; [32] 2023-09 / 2024-05; [33] 2024-08 / 2025-02; [36] 2024-10 / 2025-03.
- accessed: import inspected 2026-11-05; source access asserted by import 2026-11-04, not independently checked.
- class: provenance; confidence: low (import-only); status: imported-unverified.
- qualification / decision use: This is one imported analysis, not independent verification or multiple independent sources. Its fixed12-month regulatory refresh rule fails pack's verify-current-on-every-load-bearing-regulatory-claim requirement.

## Glossary extraction and terminology cautions

These preserve the import's 52 vocabulary candidates, not authenticated official definitions. Each is an imported-unverified terminology claim, confidence low-to-moderate; publisher/pub_date/accessed resolve through its cited source register (import access 2026-11-05; alleged source access 2026-11-04). Exact pointer for each is research.md §9 and its G identifier. Do not conflate a finding with an exception, an audit charter with the audit committee's own charter, internal assurance with external attestation, a review note with mandatory retained evidence, a regulator's finding with a legally binding enforcement action, or professional guidance with statute. These are source-interpretation cautions rather than new external assertions.

- **G1: Activity Under Review.** Imported definition: The specific subject, business unit, process, system, or program being evaluated in an engagement. Source pointer: research.md §9 G1; **Activity under review** (*Glossary*, p. 10) [1] Class: terminology; status: imported-unverified.

- **G2: Advisory Services.** Imported definition: Non-assurance engagements where auditors provide advice, training, or facilitation without taking on management responsibility. Source pointer: research.md §9 G2; **Advisory services** (*Glossary*, p. 10 — replaced 2017 IPPF *"Consulting services"*) [1] Class: terminology; status: imported-unverified.

- **G3: Assurance Services.** Imported definition: Objective examination of evidence by internal auditors to provide an independent assessment and conclusion on governance, risk management, or control processes. Source pointer: research.md §9 G3; **Assurance services** (*Glossary*, p. 10) [1] Class: terminology; status: imported-unverified.

- **G4: Attribute Sampling.** Imported definition: A sampling method used in control testing to estimate the rate of control deviations (pass/fail against defined attributes) in a population. Source pointer: research.md §9 G4; Covered under *Sampling* in Standard 14.1 Considerations (p. 105) [1, 8] Class: terminology; status: imported-unverified.

- **G5: Audit Charter.** Imported definition: The formal Board-approved document defining internal audit's purpose, mandate, authority, reporting lines, and adherence to the Standards. Source pointer: research.md §9 G5; **Internal audit charter** (*Glossary*, p. 12; Standard 6.2, p. 42) [1] Class: terminology; status: imported-unverified.

- **G6: Audit Mandate.** Imported definition: The authority, role, and responsibilities granted to the internal audit function by the Board and/or law. Source pointer: research.md §9 G6; **Internal audit mandate** (*Glossary*, p. 12; Standard 6.1, p. 39) [1] Class: terminology; status: imported-unverified.

- **G7: Audit Opinion (Macro).** Imported definition: A formal conclusion by the CAE on the overall effectiveness of governance, risk management, and control across an entire organization or business unit over a period. Source pointer: research.md §9 G7; **Conclusion at the level of the business unit or organization** (Standard 11.3, p. 81) [1] Class: terminology; status: imported-unverified.

- **G8: Audit Plan.** Imported definition: The Board-approved schedule of assurance and advisory engagements and resource allocations derived from the organization-wide risk assessment. Source pointer: research.md §9 G8; **Internal audit plan** (*Glossary*, p. 12; Standard 9.4, p. 66) [1] Class: terminology; status: imported-unverified.

- **G9: Audit Universe.** Imported definition: The comprehensive catalog of all potentially auditable entities, processes, IT systems, programs, and locations across the organization. Source pointer: research.md §9 G9; **Audit universe** (Standard 9.4 Considerations, p. 67) [1] Class: terminology; status: imported-unverified.

- **G10: Board.** Imported definition: The highest-level governing body charged with overseeing management and to which the CAE reports functionally. Source pointer: research.md §9 G10; **Board** (*Glossary*, p. 10) [1] Class: terminology; status: imported-unverified.

- **G11: CAATs (Data Analytics).** Imported definition: Automated scripts, queries, or software tools used to analyze 100% of a transaction population or detect anomalies during planning and fieldwork. Source pointer: research.md §9 G11; **Analytical procedures / data analysis technologies** (Standard 13.6, p. 103; Standard 14.1, p. 105) [1, 8] Class: terminology; status: imported-unverified.

- **G12: CAPA (Corrective and Preventive Action).** Imported definition: A closed-loop manufacturing/ISO workflow designed to eliminate the root cause of a nonconformity and prevent its recurrence. Source pointer: research.md §9 G12; **Recommendations and/or action plans** (Standard 14.4, p. 109) [1] Class: terminology; status: imported-unverified.

- **G13: Chief Audit Executive (CAE).** Imported definition: The top executive leader responsible for effectively managing all aspects of the internal audit function and ensuring conformance with the Standards. Source pointer: research.md §9 G13; **Chief audit executive** (*Glossary*, p. 10) [1] Class: terminology; status: imported-unverified.

- **G14: Coaching Note (Review Note).** Imported definition: A documented query or challenge raised by an engagement supervisor or CAE on a workpaper requiring preparer rework and resolution before sign-off. Source pointer: research.md §9 G14; **Evidence of supervision / review notes** (Standard 12.3 Examples of Evidence, p. 91) [1] Class: terminology; status: imported-unverified.

- **G15: Combined Assurance Map.** Imported definition: A matrix aligning key organizational risks against coverage by 1st-line management, 2nd-line risk/compliance, 3rd-line internal audit, and external auditors. Source pointer: research.md §9 G15; **Assurance map** (Standard 9.5 Examples of Evidence, p. 71) [1] Class: terminology; status: imported-unverified.

- **G16: Condition.** Imported definition: The factual state of the activity or control as it actually exists during the review, determined from audit evidence. Source pointer: research.md §9 G16; **Condition** (*Glossary*, p. 10; Standard 14.2, p. 106 — *"what actually exists"*) [1] Class: terminology; status: imported-unverified.

- **G17: Continuous Auditing.** Imported definition: Automated, ongoing execution of audit analytics and control tests by internal audit (3rd line) to provide near-real-time risk and control assessments. Source pointer: research.md §9 G17; Covered in *GTAG: Continuous Auditing and Monitoring* [9] Class: terminology; status: imported-unverified.

- **G18: Control.** Imported definition: Any action taken by management, the board, and other parties to manage risk and increase the likelihood that established objectives will be achieved. Source pointer: research.md §9 G18; **Control / Control processes** (*Glossary*, p. 11) [1] Class: terminology; status: imported-unverified.

- **G19: Criteria (Evaluation Criteria).** Imported definition: The standards, policies, measures, frameworks, or expectations used to judge whether the activity under review is achieving its desired state. Source pointer: research.md §9 G19; **Criteria / Evaluation criteria** (*Glossary*, p. 11; Standard 13.4, p. 100 — *"what should exist"*) [1] Class: terminology; status: imported-unverified.

- **G20: Due Professional Care.** Imported definition: Planning and performing internal audit services with the diligence, judgment, and skill expected of a reasonably prudent and competent internal auditor. Source pointer: research.md §9 G20; **Due professional care** (*Glossary*, p. 11; Standard 4.2, p. 31) [1] Class: terminology; status: imported-unverified.

- **G21: Effect (Consequence).** Imported definition: The actual or potential exposure, harm, or impact to the organization resulting from a difference between criteria and condition. Source pointer: research.md §9 G21; **Potential effects / Impact** (*Glossary*, p. 12; Standard 14.3, p. 107) [1] Class: terminology; status: imported-unverified.

- **G22: Engagement.** Imported definition: A specific internal audit assignment or project, comprising multiple tasks to accomplish a defined set of assurance or advisory objectives. Source pointer: research.md §9 G22; **Engagement** (*Glossary*, p. 11) [1] Class: terminology; status: imported-unverified.

- **G23: Engagement Conclusion.** Imported definition: Internal auditors' professional judgment summarizing the overall results of a single engagement and the effectiveness of the activity's governance, risk management, and control processes. Source pointer: research.md §9 G23; **Engagement conclusion** (*Glossary*, p. 11; Standard 14.5, p. 110) [1] Class: terminology; status: imported-unverified.

- **G24: Engagement Planning Memo.** Imported definition: The Stage 2 document setting out the background, approved engagement objectives, scope boundaries, evaluation criteria, timing, and team allocation. Source pointer: research.md §9 G24; **Documentation of engagement objectives and scope** (Standard 13.3, pp. 98–99) [1] Class: terminology; status: imported-unverified.

- **G25: Engagement Risk Assessment.** Imported definition: The Stage 2 identification and prioritization (by likelihood and impact) of the specific risks—including fraud risks—relevant to the activity under review. Source pointer: research.md §9 G25; **Engagement risk assessment** (Standard 13.2, pp. 95–97) [1] Class: terminology; status: imported-unverified.

- **G26: Engagement Supervisor.** Imported definition: The internal auditor (such as an Audit Manager, Director, or Lead) designated by the CAE to supervise staff, review workpapers, and assure quality during an engagement. Source pointer: research.md §9 G26; **Engagement supervisor** (*Glossary*, p. 11; Standard 12.3, p. 90) [1] Class: terminology; status: imported-unverified.

- **G27: External Quality Assessment (EQA).** Imported definition: A mandatory independent evaluation conducted at least once every five years by a qualified external team (including at least one active CIA) to verify conformance with the Standards. Source pointer: research.md §9 G27; **External quality assessment** (Standard 8.4, p. 57) [1] Class: terminology; status: imported-unverified.

- **G28: Finding.** Imported definition: A documented determination that a gap exists between evaluation criteria and the actual condition, exposing the organization to risk. Source pointer: research.md §9 G28; **Finding** (*Glossary*, p. 11; Standards 14.2–14.3, pp. 106–108) [1] Class: terminology; status: imported-unverified.

- **G29: Follow-Up Assessment.** Imported definition: The Stage 6 risk-based inquiry and re-testing process by which internal auditors confirm that management has implemented agreed corrective action plans. Source pointer: research.md §9 G29; **Confirming the implementation of recommendations or action plans** (Standard 15.2, p. 114) [1] Class: terminology; status: imported-unverified.

- **G30: Fraud.** Imported definition: Any intentional act characterized by deceit, concealment, or violation of trust committed by individuals or organizations to secure an unfair or illegal advantage. Source pointer: research.md §9 G30; **Fraud** (*Glossary*, p. 11) [1] Class: terminology; status: imported-unverified.

- **G31: Global Guidance.** Imported definition: Non-mandatory IIA authoritative best-practice publications—consisting of Global Practice Guides and GTAGs—that support implementation of the Standards. Source pointer: research.md §9 G31; **Global Guidance** (*About the IPPF*, p. 6) [1] Class: terminology; status: imported-unverified.

- **G32: Independence.** Imported definition: The freedom from conditions that may impair the ability of the internal audit function to carry out its responsibilities in an unbiased manner via functional reporting to the Board. Source pointer: research.md §9 G32; **Independence** (*Glossary*, p. 12; Principle 7, p. 46) [1] Class: terminology; status: imported-unverified.

- **G33: Information Produced by the Entity (IPE).** Imported definition: Any report, spreadsheet, or data extract generated by the organization's systems or personnel that the auditor must verify for completeness and accuracy before testing. Source pointer: research.md §9 G33; Covered under **Reliable information** (*"Gathered from a system with effective governance, risk management, and control processes"*, Standard 14.1, p. 104) [1] Class: terminology; status: imported-unverified.

- **G34: Information Request List (IRL) / PBC.** Imported definition: The structured tracker of populations, documents, and system access requested from management before and during fieldwork. Source pointer: research.md §9 G34; **Information requests** (Standard 13.1 Considerations, p. 94) [1] Class: terminology; status: imported-unverified.

- **G35: Inherent Risk.** Imported definition: The raw level of risk to an objective before considering the effect of existing internal controls. Source pointer: research.md §9 G35; **Inherent risk** (*Glossary*, p. 12) [1] Class: terminology; status: imported-unverified.

- **G36: IT General Controls (ITGCs).** Imported definition: Pervasive IT controls over logical access, program change management, and computer operations that underpin the reliability of automated application controls. Source pointer: research.md §9 G36; Covered under **Information technology governance and control processes** (Standard 9.4, p. 66; Cybersecurity Topical Requirement [3]) [1, 3] Class: terminology; status: imported-unverified.

- **G37: Management Action Plan (MAP).** Imported definition: Management's documented commitment specifying the concrete corrective steps, accountable owner, and target completion date to remediate an audit finding. Source pointer: research.md §9 G37; **Action plan** (*Glossary*, p. 10; Standard 14.4, p. 109; Standard 15.1, p. 113) [1] Class: terminology; status: imported-unverified.

- **G38: Material Weakness / Significant Deficiency.** Imported definition: Statutory SOX 404 / PCAOB classifications of ICFR control failures based on the likelihood and magnitude of a potential financial statement misstatement. Source pointer: research.md §9 G38; Covered under **Significance of findings** (Standard 14.3, p. 107) [1] Class: terminology; status: imported-unverified.

- **G39: MRA / MRIA.** Imported definition: Formal supervisory findings issued by US banking regulators (OCC / Federal Reserve) requiring board-overseen remediation and independent internal audit closure validation. Source pointer: research.md §9 G39; Regulatory findings under Standard 6.1 / 9.4 [1] Class: terminology; status: imported-unverified.

- **G40: Objectivity.** Imported definition: An unbiased mental attitude that allows internal auditors to perform engagements without compromise and without subordinating their judgment to others. Source pointer: research.md §9 G40; **Objectivity** (*Glossary*, p. 12; Principle 2, p. 20) [1] Class: terminology; status: imported-unverified.

- **G41: Professional Skepticism.** Imported definition: Questioning and critically assessing the reliability of information without assuming management is either dishonest or infallibly honest. Source pointer: research.md §9 G41; **Professional skepticism** (*Glossary*, p. 12; Standard 4.3, p. 33) [1] Class: terminology; status: imported-unverified.

- **G42: Quality Assurance and Improvement Program (QAIP).** Imported definition: The CAE's comprehensive program of ongoing internal monitoring, periodic self-assessments, and 5-year external assessments covering all aspects of internal audit. Source pointer: research.md §9 G42; **Quality assurance and improvement program** (*Glossary*, p. 13; Standard 8.3, p. 55; Standard 12.1, p. 86) [1] Class: terminology; status: imported-unverified.

- **G43: Residual Risk.** Imported definition: The portion of risk that remains after management's controls and risk responses have been applied. Source pointer: research.md §9 G43; **Residual risk** (*Glossary*, p. 13) [1] Class: terminology; status: imported-unverified.

- **G44: Risk Acceptance.** Imported definition: A conscious or implicit decision by management (including by delay or inaction) to tolerate a risk rather than invest in controls to mitigate it. Source pointer: research.md §9 G44; **Acceptance of risks / Risk acceptance** (Standard 11.5, p. 84; Standard 15.2, p. 115) [1] Class: terminology; status: imported-unverified.

- **G45: Risk Appetite & Risk Tolerance.** Imported definition: The overarching types and amount of risk an organization is willing to accept in pursuit of strategy (appetite), and the acceptable variation in performance relative to objectives (tolerance). Source pointer: research.md §9 G45; **Risk appetite** and **Risk tolerance** (*Glossary*, p. 13) [1] Class: terminology; status: imported-unverified.

- **G46: Risk and Control Matrix (RCM).** Imported definition: The structured grid mapping business objectives to specific risks, key controls, evaluation criteria, control attributes, and test procedures. Source pointer: research.md §9 G46; **Risk and control matrix** (*Glossary*, p. 13; Standard 13.2 Examples of Evidence, p. 97) [1] Class: terminology; status: imported-unverified.

- **G47: Root Cause.** Imported definition: The fundamental underlying reason why a difference occurred between the evaluation criteria and the actual condition. Source pointer: research.md §9 G47; **Root cause** (*Glossary*, p. 13; Standard 14.3, p. 107) [1] Class: terminology; status: imported-unverified.

- **G48: Scope Limitation.** Imported definition: Any assurance engagement condition—such as resource constraints or restricted access to people, data, or facilities—that prevents executing the expected work program. Source pointer: research.md §9 G48; **Scope limitation** (Standard 13.3, p. 98; Standard 15.1, p. 113) [1] Class: terminology; status: imported-unverified.

- **G49: Test of Design (TOD) vs. Test of Operating Effectiveness (TOE).** Imported definition: The two-stage evaluation of a control: first verifying whether the control's design can prevent/detect the risk (TOD), and second testing whether it operated consistently over the audit period (TOE). Source pointer: research.md §9 G49; **Design of control workflow vs. effectiveness of its operation** (Standard 4.2 Considerations, p. 32) [1] Class: terminology; status: imported-unverified.

- **G50: Three Lines Model.** Imported definition: The IIA's governance framework distinguishing 1st-line operational management, 2nd-line risk/compliance oversight, and 3rd-line independent internal audit, all aligned with the Board. Source pointer: research.md §9 G50; **Three Lines Model** (referenced in Standard 6.1/9.5 context; IIA Position Paper [6]) [1, 6] Class: terminology; status: imported-unverified.

- **G51: Topical Requirements.** Imported definition: Mandatory subject-specific IIA requirements (such as Cybersecurity and Third-Party) that internal auditors must apply whenever an assurance engagement's scope includes the topic. Source pointer: research.md §9 G51; **Topical Requirements** (*About the IPPF*, p. 5) [1, 2] Class: terminology; status: imported-unverified.

- **G52: Workpapers (Engagement Documentation).** Imported definition: The complete record of procedures performed, evidence gathered, analyses conducted, coaching notes resolved, and conclusions reached during an engagement. Source pointer: research.md §9 G52; **Engagement documentation / Workpapers** (*Glossary*, p. 14; Standard 12.3, p. 90; Standard 14.6, p. 111) [1] Class: terminology; status: imported-unverified.

## Coverage against the domain pack

- Strong imported coverage: rules/standards hierarchy, actors and approval responsibilities, practitioner vocabulary, six work stages, iterative loops, assurance/advisory distinctions and four illustrative industry contexts.
- Partial coverage: key vendors, adoption and regulatory overlays. Source precision, product versions, regulator/institution applicability and adoption denominators are weak.
- Open: industry economic value chain/margins, cost of compliance for entrants, current technology/adoption evidence, current exact primary regulatory clauses, enforcement evidence, independent practitioner validation and differing local methodologies. No training-data supplementation was used.
- Two-source triggers: all load-bearing regulatory/compliance propositions, quantitative adoption/EQA/sampling claims driving recommendations, and gatekeeper policy claims. Bundled homepage citations and multiple derivative digests do not satisfy independence.
- Freshness: structure ≤3 years, players ≤18 months, technical adoption ≤18 months, AI ≤6 months per pack. Regulatory status must be verified current for every load-bearing claim, not assumed fresh from a claimed 2026 access date or fixed12-month window. Older guidance can be historical background, not silently current baseline.

## Internal contradictions and priority verification queue

1. Personal CAE hard gates vs delegated scope/program/review/final communication described in §3 Stage2, §5.1 and quoted11.3. Check exact delegation allowance and retained accountability per action, not one blanket rule.
2. H2 table says every plan change; quoted9.4 says significant changes. Preserve significance qualifier.
3. RCM is optional/example in Stage2 and dual-mode H1, but labeled required in artifact rows and EQA claims. Preserve risk assessment requirement without forcing RCM.
4. Root cause when possible and recommendations/actions if applicable conflict with seven mandatory filled fields and no-open-issue hard gates. Preserve conditionality and service type.
5. Sampling tables are local practitioner choices in Stage3 but treated as PCAOB25–40 mandates in executive/H4/manufacturing sections. Exact official paragraphs and firm methodology needed before any minimum.
6. No Open Notes, pre-report review timestamp locks and retained/purged note text derive from alleged software/local practice; do not substitute for standard-level evidence of supervision, retention and legal-hold analysis.
7. EQA #1/most-frequent ranking and92/41/28 adoption figures lack identifiable study tables, field dates, denominators and independent corroboration.
8. SR26-2/OCC2026-13 is asserted while URL points to SR1107. Retrieve exact new instrument, current status, scope and supersession before use; absence from this import is not proof of falsity.
9. Basel, OCC, Fed, EBA, Chartered IIA, GAO/OMB, IASAB/CIPFA, SOX/PCAOB, ISO/IATF and IIA topical requirements differ in authority and scope; the report conflates those categories. Claimed mandatory3–4-year banking cycle, universal MRA/MRIA audit closure, SOX samples and plant CAPA tools remain unresolved.
10. Report's own Organizational Behavior Dec15,2026 date is after its Nov4,2026 date. Current versus future obligation must be checked rather than inheriting currently-in-force labels. Cyber issue date differs within support.
11. §3 loop labels and §8 loop labels are not identical (e.g., L6/L7 are reused for different transitions); reference actual transition, not bare loop ID. All conceptual transitions survive: plan reprioritization, design failure, resource/access restriction, evidence expansion, review rework, management challenge, corrected communication and failed remediation.
12. Four-layer architecture, dual execution modes, tenant note purge, dynamic import without migrations and AI prompt provenance are author hypotheses for later design, not accepted requirements.

## Ledger candidates for parent (not appended here)

- source: Process extraction of report4 from preserved research.md, claims.json, memlog and d1/d3/d4; producer Gemini/Antigravity label, report dated2026-11-04, import inspected2026-11-05; standalone duplicate excluded as independent source.
- decision: retain report4 as attributed, imported-unverified candidate domain evidence; do not inherit its19verified/0unverified status or inferred software constraints.
- claim: Report4 contains standards quotations on iterative work, significance-qualified board approvals, CAE responsibilities/delegation, root causes when possible and risk-based follow-up; verify each against primary Standards before normative synthesis.
- question: Verify current topical applicability/effective dates, SR26-2/OCC2026-13, banking coverage/closure scope, PCAOB sampling attribution, public-sector mandates, EQA rankings and adoption statistics.
- assumption: Repeated passages, raw duplicates and supporting digests produced within the same report are not independent corroboration.

## Imported source register (not independent retrieval)

All URLs, titles, publishers and dates below are preserved source attributions from research.md §11. “In force” or similar language inside titles/dates records only the import's allegation. Several rows conflate separate documents/publishers behind one URL; retain that defect rather than inventing exact sources. Status for all: imported-unverified. Accessed by this extraction: import2026-11-05 only.

- **[1]** *Global Internal Audit Standards™* (Attached Primary Source PDF, pp. 1–120; 5 Domains, 15 Principles, 52 Standards, Glossary pp. 10–14, Public Sector pp. 116–119)
  - URL: https://www.theiia.org/en/standards/2024-standards/global-internal-audit-standards/
  - publisher: The Institute of Internal Auditors (The IIA); pub_date: 2024-01-09 (Effective 2025-01-09); source accessed (import claim): 2026-11-04; imported class: `[REQ]` / `[GUIDE]`.

- **[2]** *IIA Topical Requirements Overview and Applicability Rules under the 2024 IPPF*
  - URL: https://www.theiia.org/en/standards/2024-standards/topical-requirements/
  - publisher: The Institute of Internal Auditors (The IIA); pub_date: 2025-02; source accessed (import claim): 2026-11-04; imported class: `[TOPICAL]`.

- **[3]** *Cybersecurity Topical Requirement and User Guide (Global Internal Audit Standards)*
  - URL: https://www.theiia.org/en/standards/2024-standards/topical-requirements/
  - publisher: The Institute of Internal Auditors (The IIA); pub_date: 2025-02-05 (Mandatory Effective 2026-02-05); source accessed (import claim): 2026-11-04; imported class: `[TOPICAL]`.

- **[4]** *IIA Topical Requirements Rollout: Third-Party (Effective September 15, 2026) and Organizational Behavior (Effective December 15, 2026)*
  - URL: https://www.pwc.ie/
  - publisher: PwC Ireland & The Institute of Internal Auditors (The IIA); pub_date: 2025-09 (Effective 2026-09-15 & 2026-12-15); source accessed (import claim): 2026-11-04; imported class: `[TOPICAL]`.

- **[5]** *IIA Cybersecurity Topical Requirement: 17 Mandatory Items across Governance, Risk Management, and Control Processes & NIST CSF 2.0 Mapping*
  - URL: https://www.optro.ai/
  - publisher: Optro (AuditBoard) & GovernanceDocs; pub_date: 2025-03; source accessed (import claim): 2026-11-04; imported class: `[TOPICAL]` / `[PRACTICE]`.

- **[6]** *The IIA's Three Lines Model: An Update of the Three Lines of Defense & Global Practice Guide: Developing a Risk-Based Internal Audit Plan* (pre-2024 IPPF guidance aligned with 2024 Standards 9.4 & 9.5)
  - URL: https://www.theiia.org/en/content/position-papers/2020/the-iias-three-lines-model-an-update-of-the-three-lines-of-defense/
  - publisher: The Institute of Internal Auditors (The IIA); pub_date: 2020-07; source accessed (import claim): 2026-11-04; imported class: `[GUIDE]`.

- **[7]** *Global Practice Guide: Engagement Planning: Establishing Objectives and Scope* (pre-2024 IPPF guidance aligned with 2024 Principle 13)
  - URL: https://www.theiia.org/en/content/guidance/recommended/supplemental/practice-guides/engagement-planning-establishing-objectives-and-scope/
  - publisher: The Institute of Internal Auditors (The IIA); pub_date: 2020-01; source accessed (import claim): 2026-11-04; imported class: `[GUIDE]`.

- **[8]** *GTAG: Data Analysis Technologies & Global Practice Guide: Audit Sampling* (pre-2024 IPPF guidance aligned with 2024 Standards 13.6 & 14.1)
  - URL: https://www.theiia.org/en/content/guidance/recommended/supplemental/practice-guides/data-analysis-technologies/
  - publisher: The Institute of Internal Auditors (The IIA); pub_date: 2021-01; source accessed (import claim): 2026-11-04; imported class: `[GUIDE]`.

- **[9]** *GTAG: Assessing Cybersecurity Risk: The Three Lines Model & GTAG: Continuous Auditing: Coordinating Continuous Auditing and Monitoring to Provide Continuous Assurance* (pre-2024 IPPF guidance)
  - URL: https://www.theiia.org/en/content/guidance/recommended/supplemental/practice-guides/assessing-cybersecurity-risk-the-three-lines-model/
  - publisher: The Institute of Internal Auditors (The IIA); pub_date: 2020-11; source accessed (import claim): 2026-11-04; imported class: `[GUIDE]`.

- **[10]** *Global Practice Guide: Formulating and Expressing Internal Audit Opinions* (pre-2024 IPPF guidance aligned with 2024 Standards 11.3, 14.5 & 15.1)
  - URL: https://www.theiia.org/en/content/guidance/recommended/supplemental/practice-guides/formulating-and-expressing-internal-audit-opinions/
  - publisher: The Institute of Internal Auditors (The IIA); pub_date: 2020-01; source accessed (import claim): 2026-11-04; imported class: `[GUIDE]`.

- **[11]** *Quality Assessment Manual for the Internal Audit Function (2024 Edition)*
  - URL: https://www.theiia.org/en/products/bookstore/quality-assessment-manual-for-the-internal-audit-function-2024-edition/
  - publisher: The Institute of Internal Auditors (The IIA); pub_date: 2024-07; source accessed (import claim): 2026-11-04; imported class: `[GUIDE]`.

- **[12]** *IIA Quality Services: Common EQA Deficiencies, QAIP Non-Conformance Trends, and Independence Findings*
  - URL: https://www.theiia.org/en/quality-services/
  - publisher: The Institute of Internal Auditors (The IIA) & BDO UK; pub_date: 2024-06; source accessed (import claim): 2026-11-04; imported class: `[PRACTICE]`.

- **[13]** *Top Areas of Nonconformance with the IIA Standards in External Quality Assessments*
  - URL: https://www.wolterskluwer.com/en/expert-insights/top-areas-of-nonconformance-with-the-iia-standards
  - publisher: Wolters Kluwer; pub_date: 2024-09; source accessed (import claim): 2026-11-04; imported class: `[PRACTICE]`.

- **[14]** *External Quality Assessment (EQA) Engagement Planning, Sampling, and Untimely Fieldwork Supervision Sign-Off Deficiencies*
  - URL: https://www.ideagen.com/
  - publisher: Ideagen & Sarah Vause Internal Audit Advisory; pub_date: 2024-08; source accessed (import claim): 2026-11-04; imported class: `[PRACTICE]`.

- **[15]** *Writing Audit Findings, Root Cause Analysis (5 Whys & Fishbone), and the 5 Cs*
  - URL: https://www.iia.org.uk/
  - publisher: Chartered Institute of Internal Auditors (UK & Ireland); pub_date: 2024-03; source accessed (import claim): 2026-11-04; imported class: `[GUIDE]` / `[PRACTICE]`.

- **[16]** *The internal audit function in banks (BCBS 223 — 20 Principles)*
  - URL: https://www.bis.org/publ/bcbs223.pdf
  - publisher: Basel Committee on Banking Supervision (Bank for International Settlements); pub_date: 2012-06 (import alleges in force 2026-11-04); source accessed (import claim): 2026-11-04; imported class: `[LOCAL]` (International / BCBS).

- **[17]** *Internal Audit in Banks: Supervisory Expectations and Implementation of BCBS 20 Principles*
  - URL: https://www.fsc.gi/
  - publisher: Gibraltar Financial Services Commission; pub_date: 2012-06 (import alleges in force 2026-11-04); source accessed (import claim): 2026-11-04; imported class: `[LOCAL]` (International / Gibraltar).

- **[18]** *OCC Guidelines Establishing Heightened Standards for Certain Large Insured National Banks (12 CFR Part 30, Appendix D) & Comptroller's Handbook: Internal and External Audits*
  - URL: https://www.occ.gov/publications-and-resources/publications/comptrollers-handbook/files/internal-external-audits/index-internal-external-audits.html
  - publisher: Office of the Comptroller of the Currency (US Department of the Treasury); pub_date: 2014-09 / 2019-07 (import alleges in force 2026-11-04); source accessed (import claim): 2026-11-04; imported class: `[LOCAL]` (United States — OCC).

- **[19]** *The Role of the Board of Directors and Internal Audit under OCC Heightened Standards (12 CFR Part 30 Appendix D)*
  - URL: https://www.theclearinghouse.org/
  - publisher: The Clearing House; pub_date: 2020-01 (import alleges in force 2026-11-04); source accessed (import claim): 2026-11-04; imported class: `[LOCAL]` / `[PRACTICE]` (United States).

- **[20]** *SR 13-1 / CA 13-1: Supplemental Policy Statement on the Internal Audit Function and Its Outsourcing (supplementing SR 03-5)*
  - URL: https://www.federalreserve.gov/supervisionreg/srletters/sr1301.htm
  - publisher: Board of Governors of the Federal Reserve System; pub_date: 2013-01-23 (Updated 2025/2026; import alleges in force 2026-11-04); source accessed (import claim): 2026-11-04; imported class: `[LOCAL]` (United States — Federal Reserve).

- **[21]** *Internal Audit Risk Opinions, MRA/MRIA Validation, and Regulatory Expectations under Federal Reserve SR 13-1*
  - URL: https://www.forvismazars.us/
  - publisher: Forvis Mazars US; pub_date: 2024-06; source accessed (import claim): 2026-11-04; imported class: `[LOCAL]` / `[PRACTICE]` (United States).

- **[22]** *Internal Audit Code of Practice (Effective January 2025) & Final Report on Guidelines on Internal Governance under Directive 2013/36/EU (EBA/GL/2021/05)*
  - URL: https://www.eba.europa.eu/
  - publisher: Chartered Institute of Internal Auditors (UK) & European Banking Authority (EBA); pub_date: 2024-09 (Eff. 2025-01) & 2021-07-02 (import alleges in force 2026-11-04); source accessed (import claim): 2026-11-04; imported class: `[LOCAL]` (UK & European Union).

- **[23]** *New Unified Internal Audit Code of Practice for Financial Services and Private Sector (Effective January 2025)*
  - URL: https://www.icaew.com/
  - publisher: Institute of Chartered Accountants in England and Wales (ICAEW); pub_date: 2024-09; source accessed (import claim): 2026-11-04; imported class: `[LOCAL]` / `[PRACTICE]` (United Kingdom).

- **[24]** *Supervisory Guidance on Model Risk Management (SR 11-7 / OCC Bulletin 2011-12) & April 2026 Interagency Update (SR 26-2 / OCC Bulletin 2026-13)*
  - URL: https://www.federalreserve.gov/supervisionreg/srletters/sr1107.htm
  - publisher: Board of Governors of the Federal Reserve System, OCC, & Skadden LLP; pub_date: 2011-04 / 2026-04 (import alleges in force 2026-11-04); source accessed (import claim): 2026-11-04; imported class: `[LOCAL]` (United States — Fed / OCC).

- **[25]** *PCAOB Auditing Standards AS 2605 (Consideration of the Internal Audit Function), AS 2201 (An Audit of ICFR That Is Integrated with An Audit of Financial Statements), and AS 2401 (Consideration of Fraud)*
  - URL: https://pcaobus.org/oversight/standards/auditing-standards/details/AS2605
  - publisher: Public Company Accounting Oversight Board (PCAOB), ACCA, & Enterslice; pub_date: 2016-12 / 2024-03 (import alleges in force 2026-11-04); source accessed (import claim): 2026-11-04; imported class: `[LOCAL]` (United States — PCAOB / SEC).

- **[26]** *Auditing Management Systems under ISO 19011:2018, ISO 9001:2015 (Clauses 9.2 & 10.2), IATF 16949, and Closed-Loop NCR / CAPA / 8D Effectiveness Verification*
  - URL: https://www.qualityze.com/
  - publisher: Qualityze & ComplianceQuest; pub_date: 2024-05 / 2024-08; source accessed (import claim): 2026-11-04; imported class: `[PRACTICE]` / `[GUIDE]`.

- **[27]** *Internal Audit of Manufacturing Inventory, Bill of Materials (BOM), Engineering Change Orders (ECOs), Cycle Counts, and Standard Cost Variances*
  - URL: https://www.coraa.ai/
  - publisher: Coraa AI & USM Supply Chain; pub_date: 2024-11 / 2025-02; source accessed (import claim): 2026-11-04; imported class: `[PRACTICE]`.

- **[28]** *Government Auditing Standards: 2024 Revision (Yellow Book, GAO-24-106786, Effective Dec 15, 2025) & OMB Circular No. A-123 / GAO Green Book*
  - URL: https://www.gao.gov/yellowbook
  - publisher: U.S. Government Accountability Office (GAO), Office of Management and Budget (OMB), & Deloitte; pub_date: 2024-02 (Effective 2025-12-15; import alleges in force 2026-11-04); source accessed (import claim): 2026-11-04; imported class: `[LOCAL]` (United States — Public Sector).

- **[29]** *Global Internal Audit Standards in the UK Public Sector: IASAB Application Note & CIPFA Code of Practice for the Governance of Internal Audit in UK Local Government*
  - URL: https://www.gov.uk/government/publications/public-sector-internal-audit-standards
  - publisher: UK Government (HM Treasury / IASAB), CIPFA, & Chartered IIA UK; pub_date: 2024-12 / 2025-03 (Effective 2025-04-01; import alleges in force 2026-11-04); source accessed (import claim): 2026-11-04; imported class: `[LOCAL]` (United Kingdom — Public Sector).

- **[30]** *Agile Internal Auditing (Sprint Backlogs) & Automating SOC 2 TSC / ISO 27001 / NIST CSF 2.0 Continuous Control Monitoring in Technology/SaaS Teams*
  - URL: https://hyperproof.io/
  - publisher: Protiviti, Deloitte, KPMG, ISACA, Hyperproof, & Vanta; pub_date: 2024-07 / 2025-01; source accessed (import claim): 2026-11-04; imported class: `[PRACTICE]`.

- **[31]** *Diligent One Platform (HighBond / AuditBond): Audit Universe, Workplan Workflow vs. Internal Control (TOD/TOE) Workflow, PBC Requests, and Issue Management*
  - URL: https://www.diligent.com/products/internal-audit
  - publisher: Diligent; pub_date: 2024-06; source accessed (import claim): 2026-11-04; imported class: `[PRACTICE]`.

- **[32]** *Wolters Kluwer TeamMate+ Internal Audit Workflow, Record of Work Done (RWD), Auditee Portal, and WIPO Coaching Notes / 'No Open Notes' Validation*
  - URL: https://www.wolterskluwer.com/en/solutions/teammate/teammate-audit
  - publisher: Wolters Kluwer, World Intellectual Property Organization (WIPO), & PwC; pub_date: 2023-09 / 2024-05; source accessed (import claim): 2026-11-04; imported class: `[PRACTICE]`.

- **[33]** *AuditBoard (Optro) OpsAudit/SOXHub and Workiva Internal Audit Management: RCM Centrality, Document Markup/Tickmarks, and Review Chains*
  - URL: https://www.auditboard.com/products/opsaudit/
  - publisher: AuditBoard (Optro) & Workiva; pub_date: 2024-08 / 2025-02; source accessed (import claim): 2026-11-04; imported class: `[PRACTICE]`.

- **[34]** *Control Testing Attribute Sampling Tables by Control Frequency and Risk Level (Annual=1 to Daily=25–60 & Automated Test of One)*
  - URL: https://viewpoint.pwc.com/
  - publisher: PwC Viewpoint, SOXLayer, & University of Kentucky Internal Audit; pub_date: 2024-04; source accessed (import claim): 2026-11-04; imported class: `[PRACTICE]`.

- **[35]** *Engagement Conclusion and Finding Severity Rating Scales in Institutional Internal Audit Methodologies*
  - URL: https://vpf.mit.edu/
  - publisher: MIT Audit Division, UNOPS Internal Audit, & Richard Chambers & Associates; pub_date: 2024-02; source accessed (import claim): 2026-11-04; imported class: `[PRACTICE]`.

- **[36]** *2025 Pulse of Internal Audit & Internal Audit Data Analytics (28% Advanced Maturity) and Generative AI Adoption (41%) Benchmarks*
  - URL: https://www.theiia.org/en/content/research/pulse-of-internal-audit/
  - publisher: The Institute of Internal Auditors (The IIA), Weaver, & Deloitte; pub_date: 2024-10 / 2025-03; source accessed (import claim): 2026-11-04; imported class: `[PRACTICE]`.
