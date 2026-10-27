---
title: Inquello PRD — bounded landscape refresh
created: 2026-10-26
accessed: 2026-10-26
status: research-context
---

# Bounded landscape refresh

Checked four official sources on **2026-10-26 (UTC)** to contextualise the PRD. This supplements the existing research; it does not revise the agreed V1/V2 scope or establish product performance, customer demand or implementation feasibility.

## Vendor statements and documentation

**Diligent Audit.** Diligent currently positions its audit product around agent-assisted engagement setup, evidence requests, control testing, findings, remediation and reporting. Its product page also promotes continuous control monitoring, connected audit/risk information and human approval of consequential actions. These are vendor claims, not independently tested outcomes. This check does not adopt its numerical benefit claims. Source: [Diligent Internal Audit](https://www.diligent.com/products/internal-audit), accessed 2026-10-26; page publication date not stated.

**Claude Cowork — the existing general-work comparable.** Anthropic's current architecture documentation describes cloud execution by default, with the agent loop and code running on its infrastructure. Local files and browser resources are reached through an online desktop app, constrained by connected-folder permissions. It distinguishes existing local deployments from current cloud sessions. This establishes a documented separation between the device used to access work, execution location and local-resource access; it does not demonstrate audit-workpaper fidelity. Source: [Cowork architecture overview](https://support.claude.com/en/articles/14479288-claude-cowork-architecture-overview), accessed 2026-10-26; page displayed “Updated this week.”

**Codex component boundary.** OpenAI documents app-server as an open-source interface for integrating Codex into another product, including conversation history, approvals and streamed agent events. The documentation separately marks the app-server command/WebSocket transport experimental and unsupported for production workloads. Source: [Codex App Server](https://learn.chatgpt.com/docs/app-server), accessed 2026-10-26; redirected from the developers.openai.com Codex documentation.

**Codex hosted execution.** OpenAI describes Codex Cloud as running tasks on OpenAI-managed computers, while remote access to work on a user's own computer depends on that computer and its access settings. Source: [Using Codex with your ChatGPT plan](https://help.openai.com/en/articles/11369540-using-codex-with-your-chatgpt-plan), accessed 2026-10-26; page displayed “Updated: 2 days ago.”

## Interpretation for the existing PRD direction

**Inference:** conversational agent work and review controls already feature in adjacent vendors' positioning. Inquello's proposed value in adaptable methods, shared artifacts and reduced total review effort remains a hypothesis to validate. The Codex sources support treating an integration component and a hosted execution service as distinct implementation dependencies; they do not establish that copying a component reproduces the complete hosted experience. No requirement, release boundary or deployment choice changes as a result of this check.
