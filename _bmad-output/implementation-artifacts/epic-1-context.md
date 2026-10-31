# Epic 1 Context: Secure private desktop work

<!-- Compiled from planning artifacts. Edit freely. Regenerate with compile-epic-context if planning docs change. -->

## Goal

Deliver a genuine creator-private desktop Task: organise work, authenticate independently of inference, execute a permitted plain-text request, inspect truthful progress, interrupt safely, and resume or find retained work without leaking revoked content. Establish the security and accessibility foundations for later analysis, artifacts and collaboration. Available planning inputs include the epic breakdown, design contract and identity/provider architecture companions; the referenced PRD, product brief, architecture spine and interaction companion are absent from this planning directory.

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

- Tasks begin private. Workspace or Engagement membership, administrative roles and moving work never implicitly disclose conversations or drafts. Ad hoc Tasks require no invented Engagement fields. Internal-company membership is the initial scope; external-client/independence routes remain gated and V1 has no guests.
- Distinguish execution, checks, human review, Professional Approval and Delivery; a finished turn, permission decision or green indicator proves none of the others. Show checked, unchecked and incomplete work explicitly.
- Each route needs a capability entry describing ownership, versions, identity, processing, limits and evidence. Missing or failing evidence means disabled; synthetic acceptance does not authorize real data. Current negative authorization tests and current organizational eligibility must pass before real-data enablement, including newly introduced resume/search paths.
- Retention, deletion, export and recovery rules apply to every category actually held. Unknown policy blocks real-data use; invent neither durations nor native-record obligations. Exports do not transfer permissions; surviving external copies cannot be recalled.
- Bound reads, writes and destinations through local enforcement. Most-restrictive command rules win; automatic permission review cannot widen policy. Tool output is untrusted data, never new authority. Credentials must stay outside renderer, model, arbitrary tools, logs and exports.
- Stop prevents future work without claiming rollback; retain confirmed effects and pending steps. Resume revalidates identity, authority and retained context. Unlinkable runtime history stays uncertain rather than silently replaying a new thread. Crash recovery preserves last-confirmed metadata; revoked material cannot leak through caches, search snippets or resumed output.

## Technical Decisions

- Use an identified public Codex fork cut with verified toolchain compatibility, Electron/React/TypeScript desktop and shared Rust audit-domain rules. Electron main owns the packaged Rust app-server over bounded stdio; keep stderr separate, match generated protocol versions, and explicitly handle backpressure, disconnect and shutdown.
- Sandboxed, context-isolated renderers have no Node authority. Expose only named, sender/payload-validated host operations; no general IPC or shell bridge. Domain-owned ports isolate policy from runtime, Electron and storage adapters.
- Separate working SQLite from runtime storage; require a verified WAL-reset fix. Domain commands own writes, operation identity and expected versions. Introduce entities only when needed, retaining stable Task identity and runtime-thread linkage.
- Shared authority is a versioned HTTPS service with Rust domain rules and transactional PostgreSQL metadata, not replicated desktop permissions. OIDC external-browser PKCE authenticates immutable issuer/subject principals; service-held sessions and current membership govern protected commands. Validate authority and revisions atomically; durable operation receipts resolve uncertain mutations without duplicate effects. Local caches cannot authorize stale access.
- Inquello sessions and inference credentials remain independent. The selected additional initial inference route is Claude API-key access through a native Messages adapter, not a changed endpoint URL. Subscription integration remains conditional on official permission. No silent provider, model, environment or harness fallback.
- Show execution location separately from inference processing. Cloud inference requires model connectivity; protected shared-derived work additionally requires live authority. Lost dependencies pause affected work and preserve supported progress, never imply offline AI or automatic local-model fallback.
- Isolated synthetic service/OIDC/database/blob fixtures validate contracts, not production SSO or real-data eligibility. Actual inference must be evidenced separately where required; production issuer, operator, region and data-policy gates remain explicit.

## UX & Interaction Patterns

- Preserve the exact selected design tokens, self-hosted IBM Plex fonts and accessible icon semantics. Use the light, compact workbench; do not invent a dark theme. Measure actual states for 4.5:1 normal-text and 3:1 large-text/essential-indicator contrast; reduce motion without hiding running status.
- Keep navigation, current Workspace/Engagement context and Composer reachable. Responsive collapse preserves selection and drafts. Keyboard focus follows the work, overlays return focus, and background progress never steals it. Escape dismisses overlays, never stops a Task.
- Unavailable files, Methods, sharing and later capabilities must be labelled honestly, not simulated. Permission prompts describe the exact action, content, destination and consequences with action-specific verbs. Results distinguish calculations, observations, suggestions, decisions and gaps in text, not colour alone.

## Cross-Story Dependencies

Fork/runtime isolation and protected persistence precede domain execution; identity/membership, policy, provider configuration and current-route denial evidence precede secure continuation. Design primitives precede shell/composition. Task execution and truthful progress precede interruption/recovery, which precedes protected search/reopen. Epic 2 adds source files and Methods; Epic 3 adds artifact continuity and recomputation; Epics 4–5 add sharing and review. Do not claim those later routes from fixtures or pre-create their full schemas. Each route extends authorization and recovery evidence when introduced.
