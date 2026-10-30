# Epic 1 Context: Secure private desktop work

<!-- Compiled from planning artifacts. Edit freely. Regenerate with compile-epic-context if planning docs change. -->

## Goal

Epic 1 lays the foundation for every later Increment 1 epic. It covers a reproducible Codex fork, a hardened Electron desktop driving the packaged Rust app-server, and the DESIGN token and primitive layer. It adds an Inquello identity separate from provider sign-in, creator-private Workspace/Engagement/Task organisation, and truthful states, permissions and route discovery. The epic delivers one real plain-text private Task on a configured synthetic-approved route, which the user can steer, stop, resume, search and reopen. Files and Methods (Epic 2), artifacts (Epic 3) and sharing (Epic 4) are out of scope. This goal is distilled from the epic’s stories. Evidence gap: the partial checkout lacks the PRD/addendum, product brief, architecture spine, EXPERIENCE and imported design assets; only epics, DESIGN and the two architecture companions were available.

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

- Tasks are creator-private: membership never exposes them, moves never widen grants, ad hoc Tasks need no Engagement; no Share control yet.
- Provider sign-in only authorises inference; it never grants or removes Inquello authority. No guest role in V1; external exchange uses exports.
- Task, run, artifact, check, review, Professional Approval and Delivery states are separate; a completed turn is "execution finished", never acceptance.
- No silent fallback: failures name the limit; execution and inference locations are shown separately.
- Nothing is enabled without a capability-register entry; synthetic evidence is not real-data eligibility. Real data waits for the route's passing negative authorisation suite and current eligibility; unknown fails closed.
- Stop reports actual counts and applied effects, never rollback; resume rechecks authority; unlinkable threads show as uncertain.
- Held local data needs a rule and owner; never invent retention. Deletion/export/recovery disclose retained copies and losses. Revocation blocks subsequent protected use, including stale snippets and resumed context; uncertainty fails closed.
- Untrusted tool content cannot expand authority. Action permission is not analytical review or Professional Approval; the most restrictive command rule wins within the sandbox.
- Contrast 4.5:1/3:1 is recorded per rendered state; core actions remain keyboard-operable and reduced motion retains textual progress.

## Technical Decisions

- **Fork:** record cut SHA/date/reason; verify Rust 1.99.1 (2024), pnpm 10.34.5, TS 5.9.2, React 19.3.1, Electron 45.0.0; record deviations.
- **Layering:** domain-owned ports and adapters; domain imports no Electron or concrete runtime/storage adapters. Introduce only currently needed entities, not future record schemas.
- **Desktop:** sandboxed, context-isolated renderers without Node authority; named preload operations validate payload and sender in main, which enforces navigation/content boundaries. No general IPC/shell bridge. Main owns the packaged stdio Rust child, initialization, backpressure, disconnect and shutdown; stderr stays separate. Generated client schemas match the pinned runtime; no WebSocket production claim.
- **Store:** separate SQLite (WAL-reset fix, 3.51.3+), written only via domain commands with operation ID and expected version.
- **Identity:** external-browser OIDC + PKCE, `(issuer, subject)` principal, no email linking; revocable sessions and rotating refresh. Credentials remain outside renderer/model/tools/logs. Service-owned authority uses versioned HTTPS JSON, operation identity, expected revisions, durable redacted receipts and transactional revocation ordering. Bootstrap/refresh never recover credentials through ordinary receipts. Synthetic topology uses a local service, PostgreSQL 18 and isolated test OIDC; it proves no production issuer eligibility.
- **Inference:** the selected Claude API-key route needs an Inquello-owned Messages adapter behind the retained Codex model client; changing a URL/key is insufficient. Normalize history, tools, events, errors and usage; partial tool JSON never executes. Subscription integration remains conditional, with no token reuse or silent harness replacement. Cloud inference requires connectivity; local execution is not offline inference.
- **Sandbox:** local in V1; label "V2 revisit (OQ-13)".

## UX & Interaction Patterns

- Exact DESIGN tokens, self-hosted IBM Plex, Lucide icons; no dark theme.
- Shell: 264px Sidebar/52px rail (Workspace, Engagements, Tasks), 48px Header, 720px thread, 380px artifact minimum; collapse keeps selection.
- Escape never stops a Task; Composer keeps unsent text; unavailable controls are labelled, not faked; ApprovalCards name the action.
- PlanStep done only when finished; JudgmentTags separate result kinds; S07 shows provider session apart from Inquello identity.

## Cross-Story Dependencies

- 1.1→1.2→1.3→1.4; 1.5→1.6–1.8; 1.10→1.11/1.13; 1.22 needs 1.9, 1.19–1.21; 1.25 needs 1.22–1.24; 1.28 gates 1.29–1.30.
- The selected fork cut/toolchain requires actual verification; production identity/operator/region/data-policy eligibility gates real shared data, not synthetic contract work. External-audit client/independence policy remains unresolved. Story 1.25 requires separately authorised actual inference, not a mocked response; planning criteria are not executed acceptance evidence.
- Extended by Epics 2 (files/Methods), 3 (artifacts), 4 (sharing/revocation) and 10 (delegated usage).
