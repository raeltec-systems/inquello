## Epic 1: Secure private desktop work

Increment 1. 30 stories. Owner-approved group structure; detailed stories are the consolidated review proposal, not individually approved or ready-for-development statuses. Each acceptance criterion is a requirement, not executed test evidence.

### Story 1.1: Set up the initial Inquello fork from the selected public Codex cut

As the Inquello implementation team,
I want a recorded upstream fork cut and verified build-tool compatibility,
So that later work uses an identified, reproducible foundation.

Increment 1. Origin: old Story 1.1. Requirements/inventory: AD-1, AD-3, AD-4, AD-5, C41, C77.

**Prerequisites:** none; actual fork/toolchain selection remains required.

**Gate:** Select the actual upstream cut and verify toolchain versions; historical version seeds are not current compatibility evidence.

**Acceptance Criteria:**

**AC 1.1.1**
**Given** the inspected upstream revisions are evidence snapshots only
**When** the team selects the delivery fork cut
**Then** the chosen commit SHA, upstream tag/date and the reason for the choice are recorded in the repository (for example `FORK-CUT.md`)
**And** compiler, package and driver compatibility is verified at that cut against Rust 1.99.1 (edition 2024), pnpm 10.34.5, TypeScript 5.9.2, React 19.3.1 and Electron 45.0.0, with any deviation recorded with its reason.

**AC 1.1.2**
**Given** the implementation team has selected the fork cut
**When** the initial project is established during implementation
**Then** the public upstream revision is checked out reproducibly, required configuration/dependency installation is recorded under applicable authority, and the build is verified
**And** this planning story does not itself authorize a current implementation or installation action.

### Story 1.2: Run the packaged runtime over a bounded desktop transport

As the Inquello implementation team,
I want the packaged Rust app-server to start, initialise and shut down predictably over stdio,
So that the desktop can use the selected runtime without protocol corruption.

Increment 1. Origin: old Story 1.1. Requirements/inventory: AD-1, AD-3, AD-4, AD-5, C41, C77.

**Prerequisites:** Story 1.1.

**Acceptance Criteria:**

**AC 1.2.1**
**Given** the fork builds
**When** the desktop application starts
**Then** Electron main launches the packaged Rust app-server as an owned child over stdio, performs protocol initialisation, and handles backpressure, disconnect and shutdown explicitly
**And** child stderr is captured separately and never parsed as protocol output
**And** the generated protocol schema in the client matches the runtime version of the selected cut.

**AC 1.2.2**
**Given** upstream marks the app-server command and WebSocket transport experimental for the remote Code Mode host context
**When** transports are configured
**Then** only the stdio child route is enabled in this story and the warning is recorded as bootstrap transport evidence for import into the capability register once that register exists; no production eligibility is claimed.

### Story 1.3: Isolate desktop renderers from host privilege

As the Inquello implementation team,
I want sandboxed renderers and narrowly validated host operations,
So that untrusted content cannot obtain arbitrary host authority.

Increment 1. Origin: old Story 1.1. Requirements/inventory: AD-1, AD-3, AD-4, AD-5, C41, C77.

**Prerequisites:** Story 1.2.

**Acceptance Criteria:**

**AC 1.3.1**
**Given** the renderer is loaded
**When** its privileges are inspected
**Then** the renderer runs sandboxed and context-isolated without Node authority, the preload exposes only named operations, main validates payload shape and sender, and no general IPC, shell or `child_process` bridge exists
**And** navigation and content boundaries are enforced by main.

### Story 1.4: Keep local working metadata behind domain-owned commands

As the Inquello implementation team,
I want a separate protected working repository implementing domain-owned ports,
So that local state is recoverable without coupling audit semantics to the UI.

Increment 1. Origin: old Story 1.1. Requirements/inventory: AD-1, AD-3, AD-4, AD-5, C41, C77.

**Prerequisites:** Story 1.1, Story 1.3.

**Acceptance Criteria:**

**AC 1.4.1**
**Given** the local domain repository is introduced
**When** its first working metadata is stored
**Then** domain code imports neither Electron nor concrete runtime/storage adapters; adapters implement domain-owned ports
**And** only the entities required by this story exist; general agent tools cannot write the domain store, and the SQLite runtime includes the documented WAL-reset fix (3.51.3+ or a verified fixed backport). No full future record schema is pre-created.

### Story 1.5: Apply the selected typography, tokens and icon semantics

As an Internal Auditor,
I want the exact DESIGN tokens, self-hosted fonts and accessible icons,
So that the workbench has a consistent readable foundation.

Increment 1. Origin: old Story 1.2. Requirements/inventory: NFR-5, UX-DR1, UX-DR26, UX-DR31, UX-DR49, UX-DR8, UX-DR9.

**Prerequisites:** Story 1.1.

**Acceptance Criteria:**

**AC 1.5.1**
**Given** the DESIGN frontmatter token set
**When** the token module is built
**Then** every colour, typography, radius, spacing, layout, shadow and motion value resolves to the exact DESIGN value, source aliases such as `text-faint` and `status-accepted-fg` keep their original values, and `pill` is the literal 999px
**And** the five IBM Plex WOFF2 files are self-hosted with `font-display: swap` and the declared fallbacks.

**AC 1.5.2**
**Given** the 40 Lucide icons
**When** an icon is decorative
**Then** it is hidden from assistive technology; informative icons carry text equivalents.

### Story 1.6: Operate core action and input primitives

As an Internal Auditor,
I want the documented Icon, Button, IconButton, TextField, Switch and Choice variants and keyboard states,
So that each interaction is usable without a mouse.

Increment 1. Origin: old Story 1.2. Requirements/inventory: NFR-5, UX-DR1, UX-DR26, UX-DR31, UX-DR49, UX-DR8, UX-DR9.

**Prerequisites:** Story 1.5.

**Acceptance Criteria:**

**AC 1.6.1**
**Given** the DESIGN and EXPERIENCE contracts for Icon, Button, IconButton, TextField, Switch and Choice
**When** each variant is implemented and rendered
**Then** visual values and interaction semantics match those contracts, including named states, roles, focus, keyboard and announcements
**And** apply muted informative text, ink-900 attention badge text, green-800 accepted chip text, ink-600 essential boundaries and blue-600 focus edge where applicable; no control simulates its later business operation.

**AC 1.6.2**
**Given** a rendered primitive
**When** its text and essential boundaries are measured against adjacent colours
**Then** normal text reaches 4.5:1, large text and non-text indicators 3:1, and the measurement is recorded per adjacent pair and state (AS-UX4 evidence)
**And** `prefers-reduced-motion` removes spin and pulse while a textual running state remains.

### Story 1.7: Navigate and identify work with accessible primitives

As an Internal Auditor,
I want the documented Avatar, Badge, SegmentedControl, Tabs, Menu and StatusChip variants and keyboard states,
So that each interaction is usable without a mouse.

Increment 1. Origin: old Story 1.2. Requirements/inventory: NFR-5, UX-DR1, UX-DR26, UX-DR31, UX-DR49, UX-DR8, UX-DR9.

**Prerequisites:** Story 1.5.

**Acceptance Criteria:**

**AC 1.7.1**
**Given** the DESIGN and EXPERIENCE contracts for Avatar, Badge, SegmentedControl, Tabs, Menu and StatusChip
**When** each variant is implemented and rendered
**Then** visual values and interaction semantics match those contracts, including named states, roles, focus, keyboard and announcements
**And** apply muted informative text, ink-900 attention badge text, green-800 accepted chip text, ink-600 essential boundaries and blue-600 focus edge where applicable; no control simulates its later business operation.

**AC 1.7.2**
**Given** a rendered primitive
**When** its text and essential boundaries are measured against adjacent colours
**Then** normal text reaches 4.5:1, large text and non-text indicators 3:1, and the measurement is recorded per adjacent pair and state (AS-UX4 evidence)
**And** `prefers-reduced-motion` removes spin and pulse while a textual running state remains.

### Story 1.8: Inspect progress and proposed actions with accessible primitives

As an Internal Auditor,
I want the documented JudgmentTag, FileChip, PlanStep, ApprovalCard, DiffLine and Toast variants and keyboard states,
So that each interaction is usable without a mouse.

Increment 1. Origin: old Story 1.2. Requirements/inventory: NFR-5, UX-DR1, UX-DR26, UX-DR31, UX-DR49, UX-DR8, UX-DR9.

**Prerequisites:** Story 1.5.

**Acceptance Criteria:**

**AC 1.8.1**
**Given** the DESIGN and EXPERIENCE contracts for JudgmentTag, FileChip, PlanStep, ApprovalCard, DiffLine and Toast
**When** each variant is implemented and rendered
**Then** visual values and interaction semantics match those contracts, including named states, roles, focus, keyboard and announcements
**And** apply muted informative text, ink-900 attention badge text, green-800 accepted chip text, ink-600 essential boundaries and blue-600 focus edge where applicable; no control simulates its later business operation.

**AC 1.8.2**
**Given** a rendered primitive
**When** its text and essential boundaries are measured against adjacent colours
**Then** normal text reaches 4.5:1, large text and non-text indicators 3:1, and the measurement is recorded per adjacent pair and state (AS-UX4 evidence)
**And** `prefers-reduced-motion` removes spin and pulse while a textual running state remains.

### Story 1.9: Register capability limits before enablement

As an Internal Audit Manager,
I want a protected capability register with disabled, synthetic-only and real-data-eligible states,
So that an unverified capability cannot appear ready.

Increment 1. Origin: old Story 14.3. Requirements/inventory: AD-14, FR-44, NFR-9, OQ-9.

**Prerequisites:** Story 1.4.

**Acceptance Criteria:**

**AC 1.9.1**
**Given** a capability or route is described
**When** its register entry is created
**Then** the entry records owner, supply, versions, limits, identity, formats, processing scope, eligibility and evidence references
**And** no entry or failed/missing evidence means not enabled; synthetic fixture evidence is not real-data eligibility.

**AC 1.9.2**
**Given** the complete C/E inventory
**When** the register is inspected
**Then** every item maps to an enabled capability, a planned delivery group or an explicit unmet deferral
**And** entries and capability-specific acceptance are updated with each enabled route, not postponed until Epic 15.

### Story 1.10: Authenticate an Inquello identity independently of inference

As an Internal Auditor,
I want a trusted Inquello sign-in/session bound to current service-held identity,
So that provider credentials never determine my product permissions.

Increment 1. Origin: old Story 2.1. Requirements/inventory: AD-6, AD-7, C71, OQ-1, OQ-14.

**Prerequisites:** Story 1.4.

**Gate:** OQ-16A direction adopted; AD-18/19 and SC-1/2 define the architect-derived identity/session contract. OQ-16B actual issuer/operator/region and real-data eligibility remain separate; no vendor/spend is chosen here. Synthetic identity conformance is not proof of production issuer integration.

**Acceptance Criteria:**

**AC 1.10.1**
**Given** the OQ-16 identity/session contract has been resolved
**When** a person signs in
**Then** the shared Inquello service supplies authenticated identity, membership/role revisions and session validity; every protected command validates that authority
**And** local metadata caches cannot mint membership or authorize stale access; failed/unavailable validation cannot masquerade as a valid shared-service session.


**AC 1.10.2**
**Given** Wrong issuer/audience/state, matching email on a different subject, and an expired or rotated session are supplied under the adopted SC-1 contract
**When** authentication and refresh are attempted
**Then** no identity merging, stale membership or private disclosure occurs; refresh-family replay is rejected and recovery requires valid sign-in
**And** only current session/principal records and synthetic authority fixtures are required here; later Task/sharing UI is not a prerequisite.


**AC 1.10.3**
**Given** an authenticated session command is interrupted after a potentially committed result
**When** the client retries or queries the same operation ID under SC-2
**Then** the durable receipt resolves the outcome without duplicate mutation; a different payload with the same ID conflicts
**And** credential storage excludes renderer/model/tools/logs and local private work is distinguished from shared-service availability.

### Story 1.11: Enforce internal-company memberships without disclosing private Tasks

As an Internal Audit Manager,
I want Workspace and Engagement membership distinct from private Task grants,
So that team organization does not expose personal work.

Increment 1. Origin: old Story 2.1. Requirements/inventory: AD-6, AD-7, C71, OQ-1, OQ-14.

**Prerequisites:** Story 1.10.

**Gate:** OQ-16A direction adopted; SC-2/3 permission/revision contract applies; OQ-16B before real shared data; OQ-15 before external-audit client/independence routes.

**Acceptance Criteria:**

**AC 1.11.1**
**Given** an internal-audit company Workspace
**When** memberships and roles are applied
**Then** audit function, Engagement memberships and reviewer roles follow configured policy without a hard-coded firm hierarchy
**And** membership alone does not expose another creator’s Task, conversation, drafts or retained private extracts.

**AC 1.11.2**
**Given** a person lacks required membership or an explicit resource grant
**When** the authorization contract is tested with synthetic private-resource references
**Then** the policy result denies access and reveals no protected content; the denial gives only a safe missing-authority explanation
**And** OQ-15 external-audit client relationships and independence attributes remain a separate unresolved route contract, never inferred from the internal-company model.

**AC 1.11.3**
**Given** no guest role exists in V1 (OQ-1)
**When** roles are listed
**Then** only audit-team and reviewer roles are offered and external exchange happens through exports, not guest accounts.


**AC 1.11.4**
**Given** membership removal races with a protected synthetic service command
**When** SC-2 authorization epoch and expected revision are checked in the transaction
**Then** the service establishes one ordering; an operation ordered after removal cannot commit with old membership
**And** administrative membership rights do not create private-resource grants and the current record is not replaced by a stale client revision.

### Story 1.12: Govern the local data actually held by the first private route

As an administrator,
I want explicit access, retention, deletion, export and recovery for local Task history and metadata,
So that the first enabled route does not create ungoverned retained material.

Increment 1. Origin: old Story 12.3. Requirements/inventory: AD-13, AD-14, C75, FR-37, NFR-10, NFR-9, OQ-2, UX-DR42.

**Prerequisites:** Story 1.4, Story 1.9.

**Acceptance Criteria:**

**AC 1.12.1**
**Given** the initial local route holds Task history, working metadata, logs or recovery data
**When** its data policy is inspected
**Then** each enabled category has an effective rule and owner; source extracts, artifacts, shared caches and unattended categories remain disabled until their route controls arrive
**And** unknown policy is a real-data enablement blocker, not an invented retention duration.

**AC 1.12.2**
**Given** an authorized export and reimport of currently held categories
**When** the round trip completes
**Then** declared included content and attribution are reproduced, with omissions/losses explicit
**And** an export is not a transfer of permissions or a claim of authoritative audit-record acceptance.

**AC 1.12.3**
**Given** an authorized deletion of currently held local data
**When** the result is reported
**Then** removed and retained categories are named, including surviving external/exported copies
**And** no V2 hold/native-record lifecycle is silently added to this V1 control.

### Story 1.13: Keep provider credentials separate and protected

As an administrator,
I want provider credential state separate from Inquello identity,
So that connecting or losing inference never grants product authority.

Increment 1. Origin: old Story 2.2. Requirements/inventory: AD-7, AD-8, C53, C54, C54A, C55, C56, C57, OQ-14, UX-DR40.

**Prerequisites:** Story 1.10.

**Gate:** Implement only selected current-route credential adapters; all named provider routes remain in scope, with later adapters gated individually.

**Acceptance Criteria:**

**AC 1.13.1**
**Given** an authenticated Inquello identity and a selected provider adapter
**When** provider credentials connect, expire or are revoked
**Then** the provider adapter changes only inference-route authorization; Inquello identity, membership and grants are unchanged
**And** a contract-level synthetic session test verifies this without requiring a future Task/search surface.

**AC 1.13.2**
**Given** provider credentials in trusted facilities
**When** an initial tool/export/log path is exercised
**Then** credentials do not enter model context, tool subprocess environments beyond the trusted credential adapter, artifacts, exports or logs
**And** later tools and material categories must repeat the same negative protection test before enablement.

### Story 1.14: Organise private Workspaces, Engagements, folders and Tasks

As an Internal Auditor,
I want to create Engagements with objectives, scope, period and members, group Tasks and folders under them, and start ad hoc Tasks outside any Engagement,
So that related work is organised the way audit practice names it without forcing every question into an Engagement (FR-1).

Increment 1. Origin: old Story 1.4. Requirements/inventory: AD-6, AD-7, C02, C05, C13, FR-1, UX-DR27, UX-DR37.

**Prerequisites:** Story 1.4, Story 1.11, Story 1.12.

**Acceptance Criteria:**

**AC 1.14.1**
**Given** a selected Workspace
**When** the user creates an Engagement
**Then** it is stored in the working SQLite with a stable Workspace-scoped identity, optional client/entity, period and membership references validated by the shared service, and appears in the Engagements section
**And** no Engagement field is mandatory for a Task: a new Task from New thread can exist with no Engagement.

**AC 1.14.2**
**Given** an Engagement
**When** the user creates folders and Tasks under it or moves a Task between Engagements
**Then** each Task keeps its stable Task identity, its runtime thread reference and its permitted source/artifact references after the move
**And** the Header shows the supplied client/period and effective Workspace for the open Task.

**AC 1.14.3**
**Given** the domain repository owns writes
**When** a Task record is created or changed
**Then** the mutation goes through a domain command that records operation identity and expected version, and no renderer code or agent tool writes to the working SQLite directly.

**AC 1.14.4**
**Given** a new Task is created or moved
**When** its default visibility is evaluated
**Then** it is private to its creator regardless of Workspace/Engagement membership
**And** moving it retains identity and permitted references but never broadens its grants; explicit sharing is delivered in Epic 4, and no nonfunctional Share control is enabled here.

### Story 1.15: Distinguish execution, checks, review and delivery states

As an Internal Audit Manager,
I want every Task to show its real state: planned, running, blocked, interrupted, produced, checks complete or incomplete, review requested, revision requested, approval and Delivery states,
So that "done" never collapses different meanings into one word (FR-44 seed, AD-6).

Increment 1. Origin: old Story 1.9. Requirements/inventory: AD-6, C13, C41, C61, FR-44, UX-DR20, UX-DR51.

**Prerequisites:** Story 1.14.

**Acceptance Criteria:**

**AC 1.15.1**
**Given** the domain model
**When** a Task, run, artifact, check, human review, Professional Approval or Delivery state changes
**Then** each is stored as a separate state with scope and version, not derived from the runtime turn status alone
**And** no universal state machine forces an advisory answer through approval or delivery steps.

**AC 1.15.2**
**Given** a completed runtime turn
**When** the Task is displayed
**Then** completion of the turn is shown as execution finished, distinct from checks, review and approval, and a green chip or toast never states acceptance.

**AC 1.15.3**
**Given** a UI label for a state outside the StatusChip taxonomy
**When** it renders
**Then** a separate truthful text label is used rather than coercing it into suggested/investigating/open/evidence/accepted.

### Story 1.16: Navigate the desktop shell with keyboard and responsive layout

As an Internal Auditor,
I want the documented Sidebar/Header and adaptive keyboard navigation,
So that I retain context at any supported desktop width.

Increment 1. Origin: old Story 1.3. Requirements/inventory: C01, FR-3, UX-DR27, UX-DR30, UX-DR48, UX-DR50, UX-DR55.

**Prerequisites:** Story 1.5, Story 1.6, Story 1.7, Story 1.8, Story 1.14, Story 1.15.

**Acceptance Criteria:**

**AC 1.16.1**
**Given** the shell is open at desktop width
**When** it renders
**Then** the Sidebar is 264px with the 20px lockup, a Workspace selector, an Engagements section, nested Tasks with NavRow hierarchy and bottom person/settings; the Header is 48px with the 14px title and muted Workspace/Engagement context; the thread is centred at up to 720px with the Composer reachable
**And** collapsing to the 52px rail keeps symbol, labelled actions, counts and the current surface/task.

**AC 1.16.2**
**Given** keyboard-only use
**When** the user tabs through the shell
**Then** order follows task navigation, main content, contextual artifact/review actions, Composer; no scroll area traps focus; hover-only actions appear on focus; Ctrl/Cmd+N and Ctrl/Cmd+K are bound only where Electron can do so safely; Escape closes the topmost Menu or overlay, returns focus and never stops a Task
**And** headings and landmarks identify navigation, main work, artifact and contextual review; surface changes are announced once.

**AC 1.16.3**
**Given** the window is narrower than Sidebar plus thread plus 380px artifact minimum
**When** the layout adapts
**Then** navigation collapses to the rail, then the artifact and conversation become explicitly switchable views with the same selected item and unsent text, and no horizontal page overflow occurs
**And** no dark theme is introduced.

### Story 1.17: Compose a plain private request without claiming later inputs

As an Internal Auditor,
I want a reachable Composer that preserves unsent plain text across navigation,
So that I can prepare a request safely.

Increment 1. Origin: old Story 1.3. Requirements/inventory: C01, FR-3, UX-DR27, UX-DR30, UX-DR48, UX-DR50, UX-DR55.

**Prerequisites:** Story 1.16.

**Acceptance Criteria:**

**AC 1.17.1**
**Given** the Composer holds unsent text
**When** the user navigates away and returns
**Then** the text is preserved and Enter/Shift+Enter/input-method behavior follows the documented mode
**And** attachment and selected-Method state preservation is reserved to Epic 2 when those controls work; disabled capabilities are labelled, not simulated.

### Story 1.18: Inspect effective managed policy and explicit broader modes

As an administrator,
I want organisational managed policy to be computed and shown for each Task and environment, with any no-prompt or full-access mode visible only when policy permits it,
So that an action unavailable here is explained and a broad mode is never mistaken for approval (FR-33, C70).

Increment 1. Origin: old Story 2.5. Requirements/inventory: A15, AD-8, C67, C68, C70, FR-33, UX-DR40.

**Prerequisites:** Story 1.11, Story 1.16.

**Acceptance Criteria:**

**AC 1.18.1**
**Given** organisation requirements, environment overrides and user configuration
**When** a Task starts or changes environment
**Then** S07 shows the effective policy for execution, tools, extensions and approval behaviour and names which organisation rule governs a restricted setting.

**AC 1.18.2**
**Given** a full-access or no-prompt mode
**When** it is enabled
**Then** it requires explicit permitted configuration, its effective reach is shown on the Task, and it is never labelled as review or Professional Approval.

**AC 1.18.3**
**Given** prompt inspection or specialist cyber access is configured later
**When** this story is verified
**Then** the Capability Contract lists both as not enabled, with eligibility verification required before enablement.

### Story 1.19: Bound initial tool reads, writes and network access

As an Internal Auditor,
I want a Task's permission profile explained as which evidence it can read, where it can write and which destinations it can contact,
So that I understand its reach without reading sandbox policy syntax (FR-33, C65).

Increment 1. Origin: old Story 2.3. Requirements/inventory: AD-5, AD-8, C65, FR-33, OQ-13.

**Prerequisites:** Story 1.3, Story 1.14, Story 1.18.

**Acceptance Criteria:**

**AC 1.19.1**
**Given** a private Task uses an approved local tool profile
**When** the runtime applies it
**Then** only its explicitly permitted read/write locations and destinations are reachable; source/output-folder permissions are enforced on synthetic paths
**And** the full evidence-folder experience arrives in Epic 2; no real source attachment capability is claimed here.

**AC 1.19.2**
**Given** an operation outside the profile
**When** the agent attempts it
**Then** the operation is denied or escalated per policy, the denial names the boundary, and the Task continues with retained work.

**AC 1.19.3**
**Given** the local OS sandbox inherited from Codex
**When** execution runs in V1
**Then** enforcement is local (OQ-13) and the Capability Contract records that no hosted sandbox exists; this is labelled "V2 revisit (OQ-13)".

**AC 1.19.4**
**Given** a network restriction
**When** a tool contacts an unlisted destination
**Then** the attempt is blocked and reported with the destination named.

### Story 1.20: Authorize specific actions without granting professional approval

As an Internal Auditor,
I want consequential actions presented as what will happen, to which destination, with what content, and command rules that allow, prompt or forbid,
So that permission to act is explicit and never confused with reviewing or approving audit work (FR-33, C66, C69).

Increment 1. Origin: old Story 2.4. Requirements/inventory: AD-11, C66, C69, FR-33, UX-DR24, UX-DR51.

**Prerequisites:** Story 1.8, Story 1.18, Story 1.19.

**Acceptance Criteria:**

**AC 1.20.1**
**Given** the agent proposes an action requiring permission
**When** the ApprovalCard renders
**Then** it names the exact action, content or command, destination and consequences, offers permitted alternatives, and its primary button carries the action verb (for example "Send this request to [recipient]"), never a bare "Approve".

**AC 1.20.2**
**Given** the user denies the action
**When** the Task continues
**Then** the denied action is not performed, no alternative widens scope, and unresolved work is preserved.

**AC 1.20.3**
**Given** command rules allow, prompt or forbid command prefixes
**When** a matching command is attempted
**Then** the most restrictive matching rule wins, the decision and controlling rule are shown with the analysis action and destination described, and an allowed command still runs within the sandbox profile.

**AC 1.20.4**
**Given** the inherited automatic approval reviewer is enabled by policy
**When** it evaluates a request
**Then** it operates under the same sandbox and policy, cannot widen access, and its decision is labelled as an automated permission review, not analytical review or Professional Approval.

### Story 1.21: Discover current tools and connection states honestly

As an Internal Auditor,
I want S07 to list built-in tools, connected apps, MCP servers and installed plugins with identity, dependencies, installed/enabled/callable state and limits,
So that missing access is never mistaken for missing functionality (FR-21, C33 to C36).

Increment 1. Origin: old Story 8.1. Requirements/inventory: C33, C36, FR-21, OQ-4, UX-DR40.

**Prerequisites:** Story 1.9, Story 1.13, Story 1.16, Story 1.18.

**Acceptance Criteria:**

**AC 1.21.1**
**Given** configured capabilities
**When** S07 renders
**Then** each capability shows its source (built-in, app, MCP server, plugin), version, dependencies, effective permission and whether it is installed, enabled and callable now, and an unavailable connection explains the missing route.

**AC 1.21.2**
**Given** a plugin package is installed
**When** its tools are listed
**Then** installation grants no connector credentials; a tool needing a connection shows that connection as unauthenticated until the user connects it.

**AC 1.21.3**
**Given** an expired or revoked connection
**When** it is shown
**Then** the applicable next action is offered without silent fallback.

**AC 1.21.4**
**Given** a provider sign-in completes
**When** its state is displayed
**Then** S07 shows the provider session separately from the Inquello identity, with the effective route and its capability limits, and no Workspace, Engagement or review permission changes.

### Story 1.22: Configure initial processing routes without silent fallback

As an administrator,
I want each documented route (ChatGPT/OpenAI sign-in, API key, Azure Foundry/Azure OpenAI, Bedrock, GCP/Vertex, organisation gateway, local model; Claude API key selected; subscription conditional on official permission and integration eligibility) configurable with its effective provider, deployment and capability limits shown per Task,
So that an unsupported operation never silently switches route (FR-29, C53 to C57, OQ-9).

Increment 1. Origin: old Story 8.5. Requirements/inventory: A15, AD-8, C53, C57, FR-29, NFR-8, NFR-9, OQ-14, OQ-9, UX-DR40.

**Prerequisites:** Story 1.9, Story 1.13, Story 1.19, Story 1.20, Story 1.21.

**Gate:** Owner selected Claude API-key access as the initial additional route (Sentinel_1ee4b9e93af48191bd5a2f035d7b74c6). CR-1 now records the native Messages adapter ownership/normalization contract; Story 1.22 implements it at the selected fork cut. Current inspected Responses-only configuration is not plug-and-play. Actual account/model/processing eligibility remains separate. Subscription access is conditional per AD-23, not an API-key prerequisite. No paid calls, credentials, region, spend or implementation authorized.

**Acceptance Criteria:**

**AC 1.22.1**
**Given** a configured route
**When** a Task uses it
**Then** S07 and the Task show provider, deployment or endpoint identity, region where applicable, and the capabilities available on that route, with execution, inference and connector data flows listed separately.

**AC 1.22.2**
**Given** an operation the route does not support
**When** requested
**Then** the request fails with the limit named and no other route is used.

**AC 1.22.3**
**Given** provider credentials
**When** configured
**Then** they are supplied outside prompts and artifacts (the earlier applicable capability contract) and the route's eligibility status (not verified / verified for synthetic / verified for real data) is recorded in its Capability Contract.

**AC 1.22.4**
**Given** the inherited default and one organisation-approved route are candidates for Increment 1
**When** each is configured
**Then** its capability/identity/processing contract is recorded separately and it stays synthetic-only until its current-route negative and eligibility checks pass
**And** remaining named routes, including conditional Claude subscription integration, remain explicit later supply/eligibility gates.


**AC 1.22.5**
**Given** the owner-selected Claude API-key route and the actual selected fork cut
**When** CR-1 adapter planning is checked before implementation
**Then** exact provider-dispatch, request/history/tool/stream mapping, credential isolation, capability limits and error/retry boundaries are recorded with shared schema fixtures
**And** changing a URL/key is not counted as Messages compatibility; no fixture is mislabelled as a live provider test or real-data eligibility.

**AC 1.22.6**
**Given** Claude subscription login is desired only where Anthropic permits it
**When** available routes and their status are presented
**Then** the selected API-key route is distinct from any conditional official-binary integration or prior-approved custom subscription integration
**And** no Claude.ai token collection/reuse, hidden local-model fallback, silent harness replacement or unapproved paid call occurs.

### Story 1.23: Show local execution separately from inference

As an IT Auditor,
I want to select an approved environment for a Task and see where execution happens separately from where model processing happens,
So that a local window is never taken as proof of local inference (FR-5, NFR-8, C10, C07).

Increment 1. Origin: old Story 4.5. Requirements/inventory: A15, AD-8, C07, C10, FR-5, NFR-8, UX-DR40.

**Prerequisites:** Story 1.16, Story 1.22.

**Acceptance Criteria:**

**AC 1.23.1**
**Given** a Task
**When** its environment panel renders
**Then** it shows execution location (local host) and inference location (configured provider/deployment facts or "no route") as separate facts, and the unavailable remote environments are listed as not enabled with their gate.

**AC 1.23.2**
**Given** an environment becomes unavailable
**When** the user starts work
**Then** the failure names the environment and the Task is not silently moved elsewhere.

### Story 1.24: Choose reasoning and inspect attributable usage

As an Internal Auditor,
I want to choose effort and speed per Task, see consumption across main and delegated work, and have inherited plan or Workspace limits enforced visibly,
So that costs are attributable to deliverables and a stop is explained (FR-30, C53, OQ-5).

Increment 1. Origin: old Story 8.6. Requirements/inventory: C53, FR-30, NFR-6, OQ-5.

**Prerequisites:** Story 1.15, Story 1.22.

**Acceptance Criteria:**

**AC 1.24.1**
**Given** a Task
**When** the user changes reasoning or speed
**Then** the setting is stored with the resulting outputs so two runs can be compared, and the choice is never presented as evidence quality.

**AC 1.24.2**
**Given** an inherited usage limit is reached
**When** work would exceed it
**Then** the Task stops or escalates with the limit and next action explained, and retained work is preserved.

**AC 1.24.3**
**Given** a plain Task has completed or failed runs
**When** consumption is inspected
**Then** tool/model usage including failed and repeated runs is attributable to the Task
**And** artifact attribution extends with artifact delivery in Epic 3; delegated consumption extends with Epic 10 and is not claimed here.

### Story 1.25: Start a real plain-text private Task on a configured route

As an Internal Auditor,
I want a real private request to start on one configured synthetic-approved route without files or a Method,
So that the first increment has working execution rather than a mocked Task.

Increment 1. Origin: old Story 1.5. Requirements/inventory: C01, C02, C11, C33, FR-7, UX-DR22, UX-DR29, UX-DR33, UX-DR47.

**Prerequisites:** Story 1.2, Story 1.14, Story 1.15, Story 1.17, Story 1.19, Story 1.20, Story 1.22, Story 1.23, Story 1.24.

**Acceptance Criteria:**

**AC 1.25.1**
**Given** New thread opens the Start surface
**When** it renders
**Then** focus begins at the request and the prompt is “What should we work on?”; an empty request disables Send with an explanation
**And** applied-Method and file controls remain truthfully unavailable until Epic 2, never decorative promises.

**AC 1.25.2**
**Given** a nonempty plain request and a configured synthetic-approved initial route
**When** the user submits synthetic test content
**Then** the domain creates a creator-private Task, binds its runtime thread to the actual request and acting identity, and opens the Active surface
**And** a missing route, invalid identity or denied policy preserves the draft and performs no unapproved fallback; this does not enable real-data use before the earlier applicable capability contract.

**AC 1.25.3**
**Given** optional remote capabilities are unavailable
**When** a local Task is requested
**Then** execution proceeds only if current identity/policy and the selected inference route are actually available
**And** unavailable dependencies are named; this is not a whole-product offline promise.

### Story 1.26: Follow actual basic progress and truthful results

As an Internal Auditor,
I want to watch what the agent is doing, see its plan, its tool activity and its results with calculations, observations, suggestions, decisions and gaps told apart,
So that I can judge the work while it happens rather than after (FR-7, S02).

Increment 1. Origin: old Story 1.6. Requirements/inventory: AD-5, AD-6, C11, C12, C14, C15, C41, C76, FR-7, UX-DR13, UX-DR21, UX-DR23, UX-DR34.

**Prerequisites:** Story 1.8, Story 1.15, Story 1.25.

**Acceptance Criteria:**

**AC 1.26.1**
**Given** a running Task
**When** runtime events stream
**Then** the thread shows messages, tool activity and edits translated into Task progress, PlanStep items are done only when the step actually finished, running shows the blue state and pending stays neutral
**And** input needs (questions, approval requests) are shown in context with focus staying on the user's control.

**AC 1.26.2**
**Given** the agent produces a result
**When** it is displayed
**Then** calculations, observations, suggestions, decisions and gaps are labelled with JudgmentTag text and a decision names its human or policy basis
**And** the result distinguishes checked, unchecked and incomplete work in words, not colour alone.

**AC 1.26.3**
**Given** no artifact exists yet
**When** the artifact region renders
**Then** "no artifact yet" is distinct from "artifact failed".

### Story 1.27: Reject untrusted instructions in initial tool output

As an Internal Auditor,
I want instructions found inside evidence, retrieved pages, tool results or examples to be recognised as content under examination,
So that a document telling the assistant to ignore an exception cannot change what I authorised (FR-34, C73, M1).

Increment 1. Origin: old Story 2.6. Requirements/inventory: A07, AD-8, C3, C73, FR-34.

**Prerequisites:** Story 1.19, Story 1.25, Story 1.26.

**Acceptance Criteria:**

**AC 1.27.1**
**Given** a permitted synthetic local tool returns content telling the agent to expand its mandate
**When** the Task consumes that output
**Then** the injected instruction is treated as attributed data and cannot widen authorization
**And** this tests the current route, not all future evidence/browser/Method mechanisms.

**AC 1.27.2**
**Given** a blocked or inspected action
**When** it is reported
**Then** the relevant limits are disclosed and the report does not claim that every untrusted input was detected.

### Story 1.28: Gate current-route real-data use on negative authorization evidence

As an Internal Audit Manager,
I want a repeatable suite of negative tests across Workspaces, Engagements, Sources, delegation, memory, artifacts and sharing,
So that no route carries real data until prohibited access and actions are proven blocked (NFR-3, SM-C3, OQ-9).

Increment 1. Origin: old Story 2.7. Requirements/inventory: A14, C3, C65, C70, C72, NFR-3, OQ-9.

**Prerequisites:** Story 1.9, Story 1.11, Story 1.12, Story 1.19, Story 1.20, Story 1.22, Story 1.25, Story 1.27.

**Acceptance Criteria:**

**AC 1.28.1**
**Given** two test Workspaces and two members within one Workspace with distinct private Tasks
**When** one attempts unauthorized reads or tool actions currently supplied
**Then** cross-company access and peer-private disclosure fail without content leakage; current service membership removal denies subsequent current-route protected use
**And** delegation, admitted memory, shared artifacts and unattended tests are reserved to the epics that introduce those routes; disabled routes are not counted as passing.

**AC 1.28.2**
**Given** a route enabled in Increment 1
**When** the suite runs against it
**Then** the results are attached to that route's Capability Contract and the route is marked eligible for real data only after the suite passes and organisational eligibility is confirmed.

**AC 1.28.3**
**Given** an enabled initial route and current OQ-16 authority-validation contract
**When** the route’s synthetic negative tests and organizational eligibility review finish
**Then** real-data eligibility is enabled only if evidence actually passes and approval is current
**And** failure or unknown freshness blocks real-data protected use; this story does not claim fixtures have already run.

**AC 1.28.4**
**Given** membership or current-route authority is revoked while a private Task is running
**When** the runtime would next use protected context, emit a derived answer
**Then** the active agent stops revoked use and affected cached/derived context is invalidated, suppressed or quarantined before further disclosure under OQ-16
**And** current held-category logs, current-category exports and recovery cannot bypass revocation; uncertainty fails closed. Already exported copies cannot be recalled.

### Story 1.29: Steer, stop and recover the same private Task

As an Internal Auditor,
I want to redirect, interrupt and later resume a Task, including long-running goals and background work, and see exactly what was done and what remains,
So that stopping never hides applied effects and resuming never pretends to roll back (FR-8).

Increment 1. Origin: old Story 1.7. Requirements/inventory: AD-7, AD-8, C13, C14, C16, C17, FR-8, UX-DR11, UX-DR23, UX-DR37, UX-DR47.

**Prerequisites:** Story 1.15, Story 1.25, Story 1.26, Story 1.28.

**Acceptance Criteria:**

**AC 1.29.1**
**Given** a running Task
**When** the user sends a steering instruction
**Then** it is queued or applied to the running turn as the runtime supports, and a scope change identifies results it affects.

**AC 1.29.2**
**Given** a running Task with three completed and two pending steps
**When** the user presses Stop
**Then** the message states "Work interrupted. 3 steps completed; 2 remain." with actual counts, pending steps stay pending, effects actually supported and applied on this route (for example confirmed tool-side effects) remain listed and nothing claims rollback
**And** the Stop control requests interruption only; Escape does not trigger it.

**AC 1.29.3**
**Given** a stopped or closed Task
**When** the user resumes it
**Then** the domain rechecks source access and Task authority first, missing context or changed access is stated, and the Task continues from its retained runtime thread with its currently held history and metadata; artifact continuity is tested when artifacts arrive in Epic 3
**And** if the runtime thread cannot be linked to the Task record, the Task is shown as unlinked/uncertain rather than a new thread being replayed silently.

**AC 1.29.4**
**Given** a long-running goal or a background Task
**When** it continues while the user works elsewhere
**Then** its status, completion conditions and requests for input are visible in navigation and it never steals focus
**And** a session loss or crash preserves the last confirmed history and working metadata and reports interrupted work on restart (NFR-4).

**AC 1.29.5**
**Given** access or membership changed before resume
**When** the real resume path revalidates identity and retained context
**Then** revoked private/shared-dependent content is not reused or emitted; affected work stops or is safely rebased
**And** this extends the current-route gate with the resume operation now implemented; it is not presumed covered by earlier command-only tests.

### Story 1.30: Find and reopen only permitted saved work

As an Internal Audit Manager,
I want to search accessible Tasks, files and Engagements, pin and archive work, and see which Tasks await input, review or Delivery,
So that I can find and prioritise work without being shown anything I cannot access (FR-2, S05).

Increment 1. Origin: old Story 1.8. Requirements/inventory: AD-8, C02, C05, C49, C61, FR-2, UX-DR13, UX-DR30, UX-DR38.

**Prerequisites:** Story 1.14, Story 1.15, Story 1.16, Story 1.21, Story 1.28, Story 1.29.

**Acceptance Criteria:**

**AC 1.30.1**
**Given** the Search surface (Ctrl/Cmd+K or Sidebar)
**When** the user searches
**Then** only current private Tasks and Engagements; file results are added when file context exists, and then remain within effective access are returned; no workspaces, no matches and search unavailable are separate states; the term is kept on failure; focus returns to the trigger on close.

**AC 1.30.2**
**Given** a Task
**When** the user pins, archives or reopens it
**Then** pinning and archiving change navigation only, archiving states that no authoritative record is deleted, and reopening exposes saved progress and currently held metadata; artifact reopen is completed with Epic 3.

**AC 1.30.3**
**Given** current Tasks awaiting input and synthetic read-model fixtures for later review/Delivery categories
**When** navigation renders
**Then** each state is shown with text and a count badge that names the category, and the Inbox route lists actual available items only; synthetic fixtures establish the distinct category semantics without claiming review or delivery is enabled without implying approval.

**AC 1.30.4**
**Given** access to a Task was revoked after indexing
**When** the user searches
**Then** the stale index does not reveal the revoked content.

**AC 1.30.5**
**Given** a user signed in to Inquello but not to any provider
**When** they open a Task
**Then** they can organise, search and inspect work, and S07 states that no inference route is available without implying the product lacks the capability.

**AC 1.30.6**
**Given** a provider session expires or is revoked
**When** the user continues
**Then** Inquello authority is unchanged, the Task keeps its retained work, and the user is offered the applicable reconnect action.

**AC 1.30.7**
**Given** a Task was indexed before authority was revoked
**When** the real search/reopen path runs
**Then** the stale index, result snippet and resumed history reveal no revoked content
**And** negative evidence for this newly supplied path is attached to its capability entry before real-data search enablement.

