# Epic 1 Context: Secure private desktop work

<!-- Compiled from planning artifacts. Edit freely. Regenerate with compile-epic-context if planning docs change. -->

## Goal

Deliver the secure, creator-private desktop foundation: organise work, run a permitted plain-text Task, inspect actual progress/results, steer or stop it, and recover permitted saved work. Current V1 serves one organisation and one internal-audit team, including advisory and technical work. Preserve this epic while later work completes source-backed setup, risk-based planning, engagement work, review/reporting, follow-up and a supported recurring check.

## Stories

- Story 1.1: Establish the verified public Codex fork
- Story 1.2: Run the bounded desktop/runtime transport
- Story 1.3: Isolate renderers from host privilege
- Story 1.4: Protect domain-owned working metadata
- Story 1.5: Apply typography, tokens and icons
- Story 1.6: Operate action and input primitives
- Story 1.7: Navigate with accessible primitives
- Story 1.8: Inspect progress and proposed actions
- Story 1.9: Register capability limits
- Story 1.10: Authenticate independent Inquello identity
- Story 1.11: Enforce membership without private-Task disclosure
- Story 1.12: Govern locally held data
- Story 1.13: Protect separate provider credentials
- Story 1.14: Organise private work
- Story 1.15: Distinguish work and authority states
- Story 1.16: Navigate the responsive desktop shell
- Story 1.17: Compose a plain private request
- Story 1.18: Inspect policy and explicit broader modes
- Story 1.19: Bound reads, writes and network access
- Story 1.20: Authorise specific actions
- Story 1.21: Discover tools and connections honestly
- Story 1.22: Configure initial processing routes
- Story 1.23: Separate execution from inference
- Story 1.24: Choose reasoning and inspect usage
- Story 1.25: Start a real private Task
- Story 1.26: Follow actual progress and results
- Story 1.27: Reject untrusted tool-output instructions
- Story 1.28: Gate real-data use on negative evidence
- Story 1.29: Steer, stop and recover the same Task
- Story 1.30: Find and reopen permitted saved work
- Story 1.31: Customer onboarding into a secure private workspace (separately approved extension)

## Requirements & Constraints

- Reuse compatible Codex capabilities, then expose/adapt and qualify them. Source presence, configuration, wiring, service entitlement and runtime acceptance are different facts. Later sequencing is not a generic capability/model-route scope cut or permission to rebuild inherited foundations.
- Tasks remain creator-private. Membership, administration, onboarding and moving work never disclose another person's conversation or drafts. Ad hoc work requires no Engagement. Preserve cross-organisation isolation even though current V1 serves one team.
- Execution permission, broader modes, agent checks, artifact edits, human review, Professional Approval and attempted/confirmed/uncertain Delivery remain distinct. A finished turn proves neither accepted work nor complete Coverage.
- Revalidate current authority on protected use, resume, search and disclosure, including caches and retained derivatives. Evidence/tool output is data, not authority. Most-restrictive policy wins; automated permission review cannot expand it. Credentials never enter renderer, model context, arbitrary tools, logs or exports.
- Govern all actually held data categories without inventing retention periods. Working stores are not authoritative audit records; V1 formal authority remains external, native records/lifecycle/migration remain V2. Export transfers no permission and downloaded copies cannot be recalled.
- Capability enablement requires exact-route limits, current negative-authorisation evidence and organisational eligibility. Unknown/stale evidence fails closed. Selected Auth0 identity does not prove production signup, delivery, hosting, region or real-data qualification. External-audit independence/client policy is a future activation gate, not an internal-audit blocker.
- Steering must adapt affected work and explain changes while preserving unaffected results. Stop is not rollback; retain confirmed effects and uncertainty. Resume rechecks authority and preserves linkage without blind replay.
- Planning reconciliation and research are complete for the current direction, not runtime acceptance. Keep failed, blocked, not-run and historical passes distinct. Rebuild locally before tests, verify actual Windows/WSL and UI behavior, and investigate the intermittent visual-conversation smoke failure without weakening tests. No unapproved install/download, Electron sandbox bypass, early PR or push over unverified code; full suite and smoke precede every push, one PR follows completed Epic 1, and merging uses a true merge commit.

## Technical Decisions

- Retain the identified public Codex runtime/app-server with focused, justified patches. Electron/React/TypeScript fronts shared Rust domain rules through constrained adapters; separate working SQLite never becomes shared-service authority.
- Electron main owns the packaged Rust child and bounded stdio lifecycle. Match generated protocol to the runtime; isolate stderr and handle backpressure, disconnect and shutdown. Sandboxed, context-isolated renderers have no Node authority or general IPC/shell bridge. Validate specific operations and senders; untrusted previews cannot submit human decisions.
- Domain commands own protected mutations, expected versions and operation identities. Preserve stable Task/runtime linkage; reconcile uncertain cross-store outcomes rather than claiming atomicity or replaying effects.
- Shared identity, grants and coordination use the adopted HTTPS/PostgreSQL/Rust service contracts. External-browser OIDC PKCE maps immutable issuer/subject identity; current server session/membership/revision governs access. Auth0 is selected, while hosting/operator/region and actual-route qualification remain open. Onboarding preserves the operator path and cannot mint private-content authority.
- Inquello identity is independent of inference sign-in. Claude native Messages API-key access is the selected additional route; conditional subscription eligibility remains separate. Keep all compatible documented routes and fail visibly rather than silently changing provider, model, environment or harness. Local execution never implies local inference.

## UX & Interaction Patterns

- Preserve the selected compact light workbench, exact tokens, self-hosted IBM Plex fonts and accessible icon semantics. Reuse existing primitives; verify keyboard, focus, resize/reflow, contrast and reduced motion on the actual desktop.
- Keep Workspace, optional Engagement and Task identity visible, Composer reachable and unsent text intact. Background work never steals focus. Escape dismisses overlays, never stops a Task.
- Preserve adopted grouped activity: the neutral finished-turn activity header sits above the final answer. No States panel; sidebar shows live state, recorded dimensions appear contextually, model/reasoning/environment controls sit in the Composer footer, and usage is in Settings with inline blocking notices.
- Render agent markdown safely; tool output/refusals/notices remain literal. Keep live text, jump-to-latest behavior and quiet result disclosures truthful. Permission cards identify exact action/content/destination; unavailable inputs and integrations are explicit, never simulated successes.

## Cross-Story Dependencies

Isolation, domain persistence, identity/membership and accessible primitives underpin shell/execution. Current policy, route credentials and qualification precede protected continuation; actual execution precedes recovery and permission-aware reopening. Onboarding extends identity/workspace access, not audit-context readiness. Later epics add files/Methods, artifacts, sharing/review and lifecycle coverage; each enabled route supplies its own authority, held-data and recovery evidence. Recurrence reuses inherited queue/sleep foundations but still needs a specified trigger, availability/restart/missed-run behavior and protected runtime proof.
