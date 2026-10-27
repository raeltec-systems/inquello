# Diligent audit product study

**Research cut-off:** October 23, 2026  
**Phase:** public-source scouting and feature review only. This is not product planning, a design decision, or an implementation proposal.

## Scope and evidence labels

This study starts with the user-supplied [Diligent audit professionals page](https://www.diligent.com/solutions/audit-professionals) and follows Diligent’s public product pages, Diligent One Platform Help Center, release notes, developer portal, GitHub organization, and public repository READMEs. No Diligent tenant or demo was used; no customer data, product APIs, or app endpoints were accessed; no source code was installed or run.

Claims are separated by evidence type:

- **Documented:** a Diligent help page, release note, developer document, or public repository states it.
- **Marketed:** a public product or announcement page claims it. Treat outcomes and broad capability claims as vendor statements unless corroborated by operational documentation.
- **Observed:** directly reproduced in an authorized product session. This study contains no such observations.
- **Inference:** a reasoned interpretation of documented or marketed material, labeled as such.
- **Unknown:** public evidence reviewed here does not establish the answer.

## Summary

Diligent is a useful audit-workflow reference because its official Help Center documents actual audit objects, lifecycle states, assignments, approvals, roles, and reporting. The public GitHub organization is much less useful for understanding the audit application itself: the inspected repositories concern a hiring assessment, a general AI gateway, a document-viewer UI fork, and local-development examples. The public Developer Portal is a stronger technical source for documented APIs, connectors, scripts, and toolkits, but it does not reveal the private audit application’s UI or backend implementation.

The main product-structure finding is that Diligent One contains **more than one audit execution experience**. The newer Audit app has a documented path from auditable entities and risk assessments through audit plans and control tests to findings and remediation actions. The established Projects app documents a broader project/workpaper flow with objectives, risks, procedures, evidence, requests, QA reviews, reports, and issue remediation. A current help page says users can link an Audit record to a Projects record, but there is no data exchange between those apps. We should keep these experiences distinct when comparing Diligent features.

Diligent’s public claims now include AI agents, continuous monitoring, and natural-language analytics. The Help Center gives more bounded details for the agentic capabilities available in Projects and Risk Manager, including the enablement point, model provider, regional processing, session context, and supported tasks. Diligent’s Audit product page makes broader claims about automated audit setup, evidence requests, tests, findings, remediation, and reporting. Those are marketed capabilities; this study did not validate the full workflow in a live account.

For our study, Diligent demonstrates how an audit product can connect risk, scope, controls, fieldwork, evidence, review, findings, remediation, analytics, and executive reporting. Its engagement objects also make it a system for tracking audit records and work. The user's emerging product hypothesis is to bring this audit-domain coverage into a Codex-like conversational work platform; that direction is recorded in [FEATURE_BRIEF.md](FEATURE_BRIEF.md#emerging-product-hypothesis-conversational-end-to-end-audit-work). The user has specified two modes: one that works with the practitioner's existing system of record, and another that provides a built-in Diligent-like audit record system. Diligent is a workflow reference for the second mode; the choice of authority, scope, and mode selection remains open research.

## Product map and boundaries

| Surface | What public material describes | Evidence boundary |
|---|---|---|
| **Diligent Audit / Internal Audit** | Planning, audit universe and risk assessment, audit plans, control-centered scoping, fieldwork, findings, remediation, and reporting. The newer Audit app has its own role-based home page and release notes. | Help Center and release notes provide operational detail. Marketing pages describe broader agentic capabilities. |
| **Projects** | A project-based audit workflow using objectives, risks, procedures, workpapers, requests, review, reporting, and issue remediation. Templates and Frameworks support repeatable work. | Help Center describes this as an established execution route and says it supports other audit types that are not covered by the new Audit app’s control-testing workflow. |
| **ACL Analytics / Connectors** | Data import and analysis across files, databases, ERP/CRM, and cloud sources. Connectors are documented in the Analytics/Marketplace context. | Do not assume every source is directly connected to every Audit screen or included in every subscription. |
| **Robots** | Script containers and scheduled analysis or workflow automation. ACL robots can use ACLScript and run in cloud or supported on-premises configurations; HighBond and Workflow robots use Python/HCL in cloud. | Robot runtime and entitlement are separate from the Audit app’s ordinary review workflow. Help Center notes Workflow Robot event-trigger tasks are still in development. |
| **Shared Diligent One applications** | The wider suite includes risk, controls, issues, reports, dashboards, tasks, and board-facing governance applications. Audit documentation refers to shared objects and linked applications such as Issue Manager. | “Connected platform” is a suite-level statement; it does not prove every app has bidirectional data exchange. |
| **Developer Portal** | APIs, API schemas, scripts, connectors, code samples, and toolkits for integrations and automation. | Documents public integration points; does not expose the private application source or internal orchestration. |

Diligent’s Help Center identifies Diligent One as the new name for Diligent HighBond. Product and module names have shifted over time, so older HighBond/Projects material and newer Audit material should be read in their dated context.

### New Audit app versus Projects

The Audit app’s documented core lifecycle is **auditable entity → audit risk assessment → audit plan → audit → control assessment/test → finding and remediation action**. The overview diagram notes that an audit plan may be created without a risk assessment. The May 2026 release notes describe Audit fieldwork as a control-testing path and the Object Library as its integrated GRC object source.

Projects has a different documented execution model: projects and templates organize objectives, risks, procedures and workpapers; Frameworks can share reusable objectives, narratives, risks, controls, and test plans across projects; fieldwork, QA review, reporting, and issue remediation follow within the project workflow. Diligent’s “Manage audits” help page says a Projects project can be linked to an Audit record, but there is **no data exchange** between the two apps. It describes Projects as an alternative for other types of audits.

This split matters for product research: Diligent’s broad marketing language about “audit management” may refer to capabilities across multiple products and workflows. A feature listed on one page should not automatically be attributed to every Diligent audit module.

## New Audit app: documented workflow

### 1. Audit universe and risk assessment

The audit universe organizes auditable entities, including links to organizational units or processes. A risk assessment scores active entities against configured assessment factors. The scoring table moves from Draft to In progress after scoring begins, and all active entities and factors must be scored before the assessment can be concluded. Scores autosave. Entities and factors can be changed while the assessment is in Draft or In progress, but the scoring scale cannot be changed; completed assessments are no longer configurable.

The release notes describe AI-assisted creation of risk assessments as suggestions of assessment areas and factors based on historical data and “best practices,” which a user can refine. This is an assistive feature claim in release notes; the sources reviewed do not disclose how the suggested factors are derived, validated, or calibrated.

### 2. Audit plan

Audit plans gather audits, timing, budgeted hours, and timeline information. The documented plan path is:

1. Propose the plan for review; the state becomes **Pending approval**.
2. A reviewer may request changes; the plan can return to draft, be revised, and be marked resolved.
3. Mark the plan **Approved**.
4. Launch it into **In progress** when its start and end dates allow.
5. Close it as **Closed** after implementation.

The app checks whether the hours allocated to the audits match the plan budget and warns about timing constraints. Pending and approved plans can be exported as PDFs for feedback and sharing. The timeline gained milestone markers and color-coded categories in August 2026, supporting views such as business unit or risk area.

### 3. Audit scoping and fieldwork setup

An audit record has dates, budgeted hours, linked plans/entities/controls/tests, a status, creator, and modification date. Scoping can connect the audit to auditable entities, controls, control tests, and assessment methods. To move into fieldwork, the documented flow requires at least one entity, one control, one test, and an updated fieldwork scope. Once the audit moves to **In progress**, scope cannot be edited.

The Audit app’s fieldwork page is control-testing centered. It supports design and operational control tests. A control assessment moves through **Draft → Ready for testing → In progress → To be approved → Closed**. Results are entered against the validation rules in the selected assessment method; once testing is in progress, the assessment method can no longer be changed. An Audit Manager or higher role starts the audit.

Auditors and managers can view the testing board as cards or a list, search and filter work, assign or reassign tests, and see progress and pending approvals. The app surfaces sign-offs and related findings within the fieldwork view. CSV export is documented for relevant fieldwork tables.

### 4. Findings, remediation, and closure

The Results tab supports an overall engagement rating and conclusion, plus findings that can be classified as a deficiency or recommendation, assigned an owner and severity, described, and included in the audit report. The audit-level conclusion can use the Writing Assistant.

The documented finding/issue lifecycle is:

**Draft → In review → To be published → Pending acceptance → Remediation planning → In remediation → To be approved → Closed**

Findings may also be **Discarded**. The workflow separates auditor drafting, manager review and publication, owner acceptance and management response, remediation planning, action completion, and final manager approval. This shows a structured review-and-action chain rather than a single “finding status” field.

The Audit app’s home page has role-based views for Head of Audit, Audit Manager, Auditor, and Audit QA. Managers and heads can see plan, audit, finding, and action lists with status and due-date filters; auditors have assignments; QA has its own view. Managers/Heads can export a dashboard as PDF. The Audit app’s activity-log release note says Head of Audit with system-admin rights can download 31-day activity logs; the public source reviewed does not establish longer-term retention or full log export behavior.

## Projects app: broader audit execution flow

The Projects app guide describes a general project/workplan workflow for audit teams:

1. Start from a project template; set project types and contextual tags for entities, assets, owners, or other reporting dimensions.
2. Define objectives, risks, procedures, and test plans. A Framework can sync reusable objectives, narratives, risks, controls, and test plans across related projects.
3. Execute procedures and attach/document workpapers, evidence, discussions, and observations.
4. Request evidence from stakeholders, assign work, and follow due dates and reminders.
5. Route work for supervisory or QA review, with comments, coaching, tasks, and sign-off.
6. Draft interim conclusions and recommendations; record issues and management responses.
7. Assign remediation actions and owners, monitor and retest progress, and prepare project or portfolio reporting.

The docs describe workpapers as the main documentary evidence of testing and observations. A project can use fields and tags to support later reporting. The Framework sync mechanism is useful for repeat audits: a project can sync changes back to its Framework so associated projects can reuse them. This is an explicit reusable-work model, with project templates and Frameworks serving different purposes.

The project/Framework permission model combines app-level privileges and project-specific roles. A user can have read/write access in one project and read-only oversight access in another. Project roles do not imply global app administration. The public docs list privileges for Project Admin and Project Type Admin, among others; access is also provisioned across related Diligent apps.

The Project workflow includes more than the new Audit app’s control-test path. The Diligent help content lists templates for common audit forms such as operational, SOC/SSAE/ISAE, internal financial/control, and SOX work. These are examples of packaged project types, not a claim that every method or industry is supported without configuration.

## AI and automation: documented capabilities versus marketing

### Help Center documented agentic behavior

A Diligent One Help Center page published October 19, 2026 describes a conversational AI agent in Task Manager. For audits, it is enabled under Projects settings; risk-management AI is enabled separately in Risk Manager. The page says the feature uses Claude Sonnet 4.6 through Amazon Bedrock. It evaluates task dependencies, timelines, complexity/blockers, risk descriptions, severity, likelihood, and impact. The conversational session retains context for follow-up prompts.

The documented supported tasks are bounded to project setup and engagement scoping, drafting objectives, surfacing and assessing risks, and mapping risks to controls. Diligent states that users trigger the analysis, review the surfaced insights, and decide whether to apply recommendations. For cross-region inference, prompts and data may travel within the defined AWS geographic profile while stored customer data remains in its primary region; the UK is documented as an in-region exception. These details apply to the described Projects/Risk Manager agentic capability, not automatically to every AI feature or module.

### Release notes and broader audit marketing

The Audit release notes document an AI Writing Assistant in rich text fields and AI-assisted risk assessment creation. Diligent’s Internal Audit product page additionally markets an “orchestrator” and specialist audit/risk/reporting agents. It claims that the audit agent can roll forward prior engagements, draft project structures and evidence requests, send reminders/escalations, perform control tests, flag exceptions, suggest remediation, and create board-ready reports. The page says consequential actions require human approval and recommendations are explainable and overrideable.

These claims are useful to track as product direction, but the public page does not list each approval boundary or demonstrate what is currently enabled for each customer, package, region, or application. A September 2026 newsroom announcement says the GRC brain will become available in select solutions in October 2026; I did not find a public release note confirming rollout by the October 23 research cut-off. A customer demo or authorized account would be needed to verify the actual interface, permissions, action gates, and end-to-end behavior.

### Analytics automation

The Robots app documents three different execution types:

- ACL robots run full-scale data analysis with ACLScript and scheduled tasks; supported configurations can run in cloud or on-premises environments.
- HighBond robots run Python/HCL scripts in cloud.
- Workflow robots are for Diligent One workflow automation or lighter analysis using Python/HCL in cloud. Event-triggered tasks are described as still being developed and not yet available in the reviewed Help Center page.

This is a distinct analytics/automation capability family. It should not be collapsed into conversational agents or ordinary audit task statuses.

## Data access, integrations, and outputs

Diligent documents connectors through the Analytics/Marketplace surface, with sources including databases, cloud data, ERP/CRM, Active Directory, Snowflake, Oracle, Salesforce, and Excel. The Developer Portal describes APIs for Diligent One, Entities, ESG, and Workflow, plus ACLScript and Python/HCL resources, examples, and toolkits. These are documented ways to automate analysis or integrate data and reports; access and entitlements may depend on subscriptions and roles.

Outputs described in product documentation and marketing include PDF audit-plan exports, CSV fieldwork data, dashboard PDFs, audit/board reports, project reports, and data tables or visualizations. Some artifacts are generated within the engagement-management product and remain tied to its workflow. These outputs can inform both product modes: portable work products for a practitioner's external system of record, and exports/reports from the built-in Diligent-like audit record system.

The pricing page is a request-a-demo/quote page rather than a public price list. Diligent’s site advertises a 30-day ACL Analytics trial; trial availability should not be taken to imply that the full audit platform has the same terms.

## Access, security, and deployment evidence

Diligent’s Trust page describes Diligent One as SaaS hosted on AWS under a shared-responsibility model. The page lists regional storage options, encryption in transit and at rest, SAML SSO, session/password controls, IP restrictions, activity tracking, ISO 27001 certification, and annual SOC 2 Type II audits. These are Diligent platform-level statements; any procurement conclusion would require checking which module, hosting region, and account tier are in scope.

AI processing boundaries are feature-specific. The Task Manager agentic AI help article describes Amazon Bedrock cross-region inference within geographic profiles and the UK in-region exception. A separate ACL AI Studio security article has its own model, session, and data-handling statements. Do not transfer ACL AI Studio’s specific controls to AuditAI or all Diligent AI features without confirming scope.

For ACL Robots, supported on-premises execution can reach local/network sources, but requires customer-managed runtime and IT operations. Cloud-only robot types cannot directly access on-premises data. This matters when mapping “integration” claims to real auditor environments; data may require staging, a connector, an on-prem agent, or an API, depending on source and configuration.

## Public GitHub and developer-material review

The [DiligentCorp public GitHub organization](https://github.com/DiligentCorp) is supplementary evidence, not a public release of the Diligent audit application. The public repos reviewed show:

| Repository | Public description/evidence | Relevance to audit-product study |
|---|---|---|
| [rc-tech-assessment](https://github.com/DiligentCorp/rc-tech-assessment) | README calls it an Audit, Risk and Compliance hiring assessment for the Budapest site; it tells candidates to solve the assignment they were given. Public GitHub metadata reports MIT licensing. | Not the audit application. Useful only as a small sample of a technical assessment problem. |
| [bifrost](https://github.com/DiligentCorp/bifrost) | A fork of the Maxim AI Bifrost gateway repository. Its README describes a general LLM gateway and its own configuration/monitoring UI. The repo metadata and README identify the upstream project; the repository includes license material with third-party copyright text. | Not Diligent’s audit UI or runtime. May expose a separately maintained AI infrastructure component, but it cannot establish how Diligent Audit uses AI. |
| [webviewer-ui](https://github.com/DiligentCorp/webviewer-ui) | Fork of Apryse’s generic WebViewer UI. | Document-viewer user interface code is not an audit product implementation. |
| [tilt-rancher-example](https://github.com/DiligentCorp/tilt-rancher-example) | Described as a local-development example built around Helm, Rancher Desktop, and Tilt. | Development tooling example, not an audit workflow. |

The inspected organization listing and repository material did not expose Diligent Audit’s product UI or runtime source. This is a bounded finding about the current public repositories inspected, not a claim about Diligent’s private repositories or internal systems.

The [Diligent Developer Portal](https://developer.diligent.com/) is more useful than GitHub for documented integration surfaces: it links APIs, schemas, scripting guides, code samples, connectors, and toolkits. These documents tell us what customers may be able to call or configure; they do not show the private source code, internal orchestration, or complete data model of the commercial application.

## Relevance to our product study

These are research observations, not design decisions:

1. **Connect the work path:** Diligent’s documented flows tie scope, risks, controls, procedures/tests, evidence, findings, actions, review, and reports together. For our study, this is a useful model for following the auditor’s reasoning from source material to work product.
2. **Keep workflows configurable:** templates, project types, Frameworks, risk factors, assessment methods, tags, and role-specific access let the customer adapt the platform to their existing practice. We should study which of these patterns help a general auditor’s tool adapt across internal audit, external audit, advisory, IT/IS, industries, and methods.
3. **Make review and ownership visible:** the explicit assignment, review, management response, approval, remediation, and retest states show that auditing is collaborative work with several handoffs. These patterns may inform workflows in either operating mode; authority and recordkeeping depend on whether the practitioner connects an existing system or uses the built-in record mode.
4. **Treat data analysis as a workflow capability:** ACL Analytics, connectors, scripts, and Robots suggest a separate but connected lane for repeatable data work. We should learn how auditors move from source data to exceptions, evidence, and narrative without assuming all work must occur inside one product’s database.
5. **Separate evidence from assurance claims:** Diligent’s structured help pages and dated release notes are stronger evidence for workflows than broad marketing pages. AI claims should remain labeled until we can verify the precise actions, approval gates, model context, and rollout in a demo or authorized tenant.
6. **Study both authority models:** Diligent models engagements inside its platform. Our product hypothesis includes both connecting to the practitioner's existing system of record and offering a built-in Diligent-like audit record system. Compare how authority, persistence, export, and outputs differ between those modes.

## Open evidence questions

Public material reviewed here does not establish:

- The exact Audit app and AI-agent screens, interaction details, action-by-action approvals, error paths, and recovery behavior.
- Which agentic claims are generally available versus preview, package-gated, region-gated, or limited to selected customers.
- Whether the announced GRC brain was launched in the promised timeframe and which Audit products currently use it.
- The full permission matrix across Audit, Projects, Issue Manager, Analytics, and Robots, including how permissions combine for every task.
- Full audit-log schema, export controls, long-term retention, and deletion behavior for each application.
- How templates, frameworks, connectors, and APIs behave across multiple practice types and customer deployments.
- Exact Diligent package pricing or implementation costs.
- Whether AI-generated workpapers, requests, control tests, or reports are accepted by auditors in real deployments without substantial adjustment.

These require an authorized product demonstration or tenant, product-specific commercial documentation, or customer-approved observation. No assumptions about Diligent internals should be made from a public repo fork or from API documentation alone.

## Source register

### Diligent audit product and official Help Center

- [Audit professionals solution page](https://www.diligent.com/solutions/audit-professionals) — supplied by the user; product positioning and related solutions.
- [Internal Audit product page](https://www.diligent.com/products/internal-audit) — audit and agentic-AI marketing claims.
- [Getting started with Audit](https://help.diligentoneplatform.com/helpdocs/d1p/en-us/Content/audit/getting_started.htm) — core object lifecycle and role-specific home page.
- [Audit release notes](https://help.diligentoneplatform.com/helpdocs/d1p/en-us/Content/release_notes/release-notes-audit.htm) — dated feature releases.
- [Conducting audit risk assessment](https://help.diligentoneplatform.com/helpdocs/d1p/en-us/Content/audit/Audit%20risk%20assessment/conduct_the_audit_risk_assessment.htm) — risk factor scoring and configuration.
- [Propose, approve, launch, and close audit plan](https://help.diligentoneplatform.com/helpdocs/d1p/en-us/Content/audit/audit%20planning/propose_close_audit_plan.htm) — approval and plan states.
- [Manage audits and link Projects](https://help.diligentoneplatform.com/helpdocs/d1p/en-us/Content/audit/Audit%20fieldwork/audit-fieldwork-detailed-audit-scoping.htm) — scoping and explicit no-data-exchange boundary.
- [Audit fieldwork activities](https://help.diligentoneplatform.com/helpdocs/d1p/en-us/Content/audit/Audit%20fieldwork/audit-fieldwork-control-test-progress.htm) — testing board, assignment, and control-assessment states.
- [Closing audits and sharing results](https://help.diligentoneplatform.com/helpdocs/d1p/en-us/Content/audit/Audit%20fieldwork/audit-fieldwork-close-audit-share-results.htm) — finding states, ratings, and report inclusion.
- [Audit app permissions](https://help.diligentoneplatform.com/helpdocs/d1p/en-us/Content/administration/audit/audit-app-perm.htm) — roles in the newer Audit app.
- [Executing an audit using Projects](https://help.diligentoneplatform.com/helpdocs/d1p/en-us/Content/get_started/solution_guides/audit_management/executing_your_audit.htm) — templates, frameworks, project workflow, fieldwork, QA, and remediation.
- [Projects app permissions](https://help.diligentoneplatform.com/helpdocs/d1p/en-us/Content/administration/projects/roles_privileges/projects_app_permissions.html) — app privileges and project-specific roles.
- [Diligent One agentic AI capabilities](https://help.diligentoneplatform.com/helpdocs/d1p/en-us/Content/task_manager/diligent-one-agentic-ai-capabilities.htm) — published October 19, 2026; documented AI model, session behavior, geography, enablement, and task scope.
- [Creating and managing a robot](https://help.diligentoneplatform.com/helpdocs/d1p/en-us/Content/robots/building_automation/creating_managing_robots.htm) — robot categories and execution locations.
- [Connector overview](https://help.diligentoneplatform.com/helpdocs/d1p/en-us/Content/marketplace/connectors/overview_of_connectors.htm) — connector role in Analytics and Marketplace.

### AI, integration, security, and commercial context

- [Agentic capabilities announcement](https://www.diligent.com/company/newsroom/diligent-unveils-new-agentic-capabilities-in-diligent-one) — published September 15, 2026; orchestrator and GRC brain announcement.
- [AuditAI announcement](https://www.diligent.com/company/newsroom/diligent-debuts-auditai-at-iia-gam-2026) — published March 10, 2026; AuditAI launch claims.
- [Diligent Developer Portal](https://developer.diligent.com/) and [API documentation index](https://developer.diligent.com/docs/) — public integration and scripting reference.
- [Diligent One API reference](https://docs-apis.highbond.com/public.html) — public API behavior and regional endpoint documentation; no API calls were made for this study.
- [Diligent Trust and compliance](https://www.diligent.com/trust) — platform-level SaaS, security, and data handling claims.
- [Pricing](https://www.diligent.com/pricing) — quote/demo request; no public list prices found.

### Public GitHub

- [DiligentCorp public repositories](https://github.com/orgs/DiligentCorp/repositories)
- [rc-tech-assessment repository](https://github.com/DiligentCorp/rc-tech-assessment) and [README](https://raw.githubusercontent.com/DiligentCorp/rc-tech-assessment/main/README.md)
- [bifrost fork](https://github.com/DiligentCorp/bifrost) and [README](https://raw.githubusercontent.com/DiligentCorp/bifrost/main/README.md)
- [webviewer-ui repository](https://github.com/DiligentCorp/webviewer-ui)
- [tilt-rancher-example repository](https://github.com/DiligentCorp/tilt-rancher-example) and [README](https://raw.githubusercontent.com/DiligentCorp/tilt-rancher-example/master/README.md)
