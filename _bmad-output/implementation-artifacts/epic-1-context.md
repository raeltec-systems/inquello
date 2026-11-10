# Epic 1 Context: Secure private desktop work

<!-- Compiled from planning artifacts. Edit freely. Regenerate with compile-epic-context if planning docs change. -->

## Goal

Provide a usable creator-private auditor workbench: organise work, run a permitted plain-text Task, inspect its real progress and results, steer or interrupt it, then find and continue retained work safely. The outcome is an auditor reliably achieving the promised workflow, not merely passing technical tests. Available inputs cover the epic breakdown, design and experience contracts, and identity/provider architecture companions; the referenced PRD, product brief and full architecture spine are absent locally.

## Stories

- Story 1.1: Set up the initial Inquello fork from the selected public Codex cut
- Story 1.2: Run the packaged runtime over a bounded desktop transport
- Story 1.3: Isolate desktop renderers from host privilege
- Story 1.4: Keep local working metadata behind domain-owned commands
- Story 1.5: Apply the selected typography, tokens and icon semantics
- Story 1.6: Operate core action and input primitives
- Story 1.7: Navigate and identify work with accessible primitives
- Story 1.8: Inspect progress and proposed actions with accessible primitives
- Story 1.9: Register capability limits before enablement
- Story 1.10: Authenticate an Inquello identity independently of inference
- Story 1.11: Enforce internal-company memberships without disclosing private Tasks
- Story 1.12: Govern the local data actually held by the first private route
- Story 1.13: Keep provider credentials separate and protected
- Story 1.14: Organise private Workspaces, Engagements, folders and Tasks
- Story 1.15: Distinguish execution, checks, review and delivery states
- Story 1.16: Navigate the desktop shell with keyboard and responsive layout
- Story 1.17: Compose a plain private request without claiming later inputs
- Story 1.18: Inspect effective managed policy and explicit broader modes
- Story 1.19: Bound initial tool reads, writes and network access
- Story 1.20: Authorize specific actions without granting professional approval
- Story 1.21: Discover current tools and connection states honestly
- Story 1.22: Configure initial processing routes without silent fallback
- Story 1.23: Show local execution separately from inference
- Story 1.24: Choose reasoning and inspect attributable usage
- Story 1.25: Start a real plain-text private Task on a configured route
- Story 1.26: Follow actual basic progress and truthful results
- Story 1.27: Reject untrusted instructions in initial tool output
- Story 1.28: Gate current-route real-data use on negative authorization evidence
- Story 1.29: Steer, stop and recover the same private Task
- Story 1.30: Find and reopen only permitted saved work

## Requirements & Constraints

- Tasks are creator-private, including inside an Engagement. Membership, administration or moving work never grants another person's conversation or drafts. Ad hoc Tasks require no Engagement. Initial participation is internal-company teams; no guests or inferred external-client/independence policy.
- Execution, checks, analytical review, Professional Approval and Delivery are separate. A finished turn, permission decision, badge or green state proves none of the others. Report actual supported results, incomplete work and missing evidence truthfully.
- Capabilities require explicit ownership, versions, identity, processing, limits and evidence. Real-data eligibility requires current negative evidence and current organisational approval. Unknown or stale evidence blocks protected use; no operator toggle or unrun fixture promotes eligibility.
- Access, retention, deletion, export and recovery cover every held category. Do not invent retention durations or V2 authoritative-record obligations. Export transfers no permissions; external copies cannot be recalled. Revalidate protected use and disclosure, including cached results, search snippets and reopened history.
- Local policy bounds tool reads, writes and network destinations. Most-restrictive rules win; automated permission review cannot widen them. Evidence and tool output are data, not authority. Keep credentials outside renderer, model, arbitrary tools, logs and exports.
- Mirror the Codex agent baseline for auditors: ordinary steering makes the agent adapt its plan, redo affected analysis, revise or withdraw affected findings, preserve unaffected work and explain changes. Admission or blanket warnings are not that outcome. Stop is not rollback or universal termination; retain confirmed effects and uncertainty. Explicit Resume rechecks authority and continues identified history, never silently replaces or replays unlinked work.

## Technical Decisions

- Use an identified public Codex fork and verified toolchain. Electron main owns a bounded stdio Rust app-server child; isolate stderr and handle backpressure, disconnect and shutdown. Generated client protocol must match the runtime.
- Sandboxed, context-isolated renderers have no Node authority. Expose named sender/payload-validated operations, not general IPC or shell access. Shared Rust domain rules own commands; adapters isolate runtime, storage and UI concerns.
- Working SQLite is separate from runtime storage and needs the verified WAL-reset fix. Preserve stable entity/thread identities, operation receipts and expected versions; introduce only needed entities, not future schemas.
- Shared authority uses a versioned HTTPS service, transactional PostgreSQL metadata and Rust domain rules—not replicated desktop grants. External-browser OIDC PKCE maps immutable issuer/subject identity. Current session, membership and authorization revisions govern protected operations; caches cannot mint authority. Durable receipts reconcile uncertain mutations without duplicate effects.
- Inquello identity is separate from inference credentials. Inspection and organisation do not require provider sign-in; actual inference requires its selected available route. Native Claude Messages API-key access is distinct from conditional officially permitted subscription integration. No silent provider, model, environment or harness fallback.
- Execution location and inference processing are separate facts. Local execution does not imply offline AI; affected work pauses when required model or authority dependencies disappear. Preserve supported work and offer the applicable reconnect, not an invented offline grace period.
- Realistic fictional audit data supports genuine product validation with normal UX, not synthetic banners or gibberish. Deterministic contracts, actual model usefulness and Windows/Electron acceptance require distinct evidence. Published in-progress stories and authored native fixtures do not erase unrun integration or production-service gates.

## UX & Interaction Patterns

- Honour the selected light, compact workbench, exact tokens, self-hosted IBM Plex fonts and accessible icons. Compose S05–S13 from existing primitives; do not invent a new visual system. Verify contrast, keyboard, focus, zoom and reduced-motion states rather than assuming prototype conformance.
- Preserve Workspace → optional Engagement → Task context, reachable Composer and unsent text. Responsive collapse keeps selection. Background updates never steal focus. Escape dismisses the top overlay and returns focus; it never stops work. Visible controls accompany keyboard shortcuts.
- Search retains its term on failure, distinguishes no Workspaces, no matches and unavailable service, and reauthorizes selection before disclosure. Pin/archive affect navigation only, not authoritative deletion. Reopening inspection is distinct from execution. Inbox shows actual current attention with named categories; later review/Delivery fixtures never become demo production items.
- Do not simulate unavailable files, Methods, artifacts or sharing. Permission cards name the exact action, content, destination and consequences. Results distinguish calculation, observation, suggestion, decision and gap in words, not colour alone.

## Cross-Story Dependencies

Runtime isolation, protected persistence, identity/membership and design primitives precede the shell and execution. Current policy, provider configuration and route evidence precede protected continuation. Actual execution and progress precede lifecycle recovery; retained identity, status and fresh authority underpin search/reopen. Story 1.30 closes Epic 1's navigation loop without completing earlier unrun gates. Epic 2 adds files and Methods; Epic 3 adds artifacts and recomputation; Epics 4–5 add sharing and review. Each new route extends authorization and recovery evidence before enablement. Final local end-to-end validation must trace realistic auditor outcomes across the whole epic.
