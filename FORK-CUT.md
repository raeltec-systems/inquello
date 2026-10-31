# Inquello engine cut

Inquello's engine is our own fork of the public `openai/codex` repository: we modify and extend it. It lives under `engine/`, which was named `fork/` until 2026-10-28 (see "Directory rename" below).

This file records which upstream Codex revision Inquello is built on, how it was imported, how to set up the toolchain, and what the first build verification found. It is the record for Story 1.1 (AC 1.1.1 and AC 1.1.2).

## Selected cut

| Field | Value |
|---|---|
| Upstream repository | `https://github.com/openai/codex` (public) |
| Release tag | `rust-v0.165.0` |
| Tag object SHA | `e374836b2728d9b7aa981c2902649e640a2edaa8` |
| Commit SHA | `360319d8dee62d87e2d59fc0c21805d79519cfed` |
| Commit tree SHA | `307e4fa207fe563a11f3f7af09cee6fccd2d8376` |
| Commit date | 2026-10-27T15:19:19-03:00 (2026-10-27T18:19:19Z) |
| Tag date | 2026-10-27T15:19:20-03:00 (tagger Felipe Coury, message "Release 0.165.0") |
| Selected on | 2026-10-28 |
| Licence | Apache-2.0. Upstream `engine/LICENSE` and `engine/NOTICE` are kept unchanged. |

**Why this cut.** `rust-v0.165.0` was the newest non-prerelease release when we selected it. Its pins match the planned stack: Rust 1.99.1, edition 2024, pnpm 10.34.5 and TypeScript 5.9.2. A release tag also stays fixed, while `main` and the snapshots inspected during planning keep moving. Those planning snapshots are evidence only and were not used as the cut.

## Import method

The upstream tree was imported under `fork/` (now `engine/`) as a squashed git subtree:

```sh
git subtree add --prefix=fork --squash https://github.com/openai/codex rust-v0.165.0
```

This created two commits on `feat/1-1-codex-fork-setup`:

- `86c177429bbc13bc689650667d2ac9dca5e716cc` is the squash commit "Squashed 'fork/' content from commit 360319d8d". It carries the trailers `git-subtree-dir: fork` and `git-subtree-split: 360319d8dee62d87e2d59fc0c21805d79519cfed`.
- `5aceac53db54c6f1a4413a7dc909b38b8dfde345` is the merge commit that adds `fork/` to the Inquello history.

**Merge rule:** merge this branch into `main` with a true merge commit, never a squash or rebase merge. A squash or rebase merge would drop the subtree squash commit and every SHA cited here, which breaks `git subtree pull`.

We chose a squashed subtree over a submodule for four reasons. It matches the architecture seed layout (`fork/codex-rs/...` at the time, now `engine/codex-rs/...`, beside `desktop/`). It keeps one repository, so we don't host a separate fork. It keeps upstream history out of Inquello history. And it still supports upgrades. A submodule would need a separately hosted fork.

**Upgrade command** (for a later, deliberately selected cut):

```sh
git subtree pull --prefix=engine --squash https://github.com/openai/codex <new-tag>
```

### Directory rename (`fork/` to `engine/`, 2026-10-28)

The owner renamed `fork/` to `engine/` so the directory says what it holds: Inquello's modified copy of Codex. The rename commit moves the files only; their content and the tree hash `307e4fa207fe563a11f3f7af09cee6fccd2d8376` are unchanged.

`git subtree` finds the previous import by searching commit messages for `git-subtree-dir: <prefix>`, and the original squash commit says `fork`. So a marker commit follows the rename, titled "Rejoin engine/ subtree after rename from fork/". It is an empty merge commit whose second parent is the squash commit `86c177429bbc13bc689650667d2ac9dca5e716cc`, with these trailers:

```text
git-subtree-dir: engine
git-subtree-mainline: <the rename commit>
git-subtree-split: 360319d8dee62d87e2d59fc0c21805d79519cfed
```

git-subtree reads a commit carrying `git-subtree-mainline` as a rejoin and uses its second parent as the latest squash. So `git subtree pull --prefix=engine --squash` merges against the original squash commit exactly as it would have under `fork/`. The merge rule above keeps both commits in `main`'s history.

Earlier records (the Story 1.1–1.3 specs, the planning documents and "Build verification" below) still say `fork/`. They describe paths as they were at the time.

### Checking that `engine/` matches the imported cut

Run these from a fresh clone of this branch:

```sh
git log -1 --format=%B 86c177429bbc13bc689650667d2ac9dca5e716cc     # shows git-subtree-split: 360319d8dee62d87e2d59fc0c21805d79519cfed
git rev-parse 86c177429bbc13bc689650667d2ac9dca5e716cc^{tree}         # 307e4fa207fe563a11f3f7af09cee6fccd2d8376
git rev-parse 5aceac53db54c6f1a4413a7dc909b38b8dfde345:fork           # must print the same tree hash (fork/ as imported)
git rev-parse HEAD:engine                                             # same hash while engine/ is unpatched
git status --porcelain -- engine                                      # must print nothing (no uncommitted edits, e.g. an un-restored Cargo.lock)
git fetch https://github.com/openai/codex refs/tags/rust-v0.165.0
git rev-parse FETCH_HEAD                                              # tag object: e374836b2728d9b7aa981c2902649e640a2edaa8
git rev-parse FETCH_HEAD^{commit} FETCH_HEAD^{tree}                   # 360319d8dee62d87e2d59fc0c21805d79519cfed and 307e4fa207fe563a11f3f7af09cee6fccd2d8376
```

At import, all three tree hashes matched (`307e4fa207fe563a11f3f7af09cee6fccd2d8376`): the squash commit tree, `fork/` in the import merge commit, and the upstream commit's tree. So `fork/` is git tree-identical to upstream at the cut. "Tree-identical" means the committed content: this repository runs with `core.autocrlf=true` (set in the system gitconfig), so the files under `fork/` that the builds below used had CRLF line endings in the working copy.

Later stories may patch `engine/` on purpose. To review those patches against the imported cut, run `git diff 5aceac53db54c6f1a4413a7dc909b38b8dfde345:fork HEAD:engine`. Since Story 1.4, `HEAD:engine` no longer equals the imported tree hash; see "Inquello patches to `engine/`" below.

## Inquello patches to `engine/`

Each deliberate change to `engine/` is listed here. Upstream crates' code stays unedited unless an entry says otherwise.

### Patch 1: Inquello working-store crates (Story 1.4, 2026-10-28)

The first deliberate engine patch. It adds code beside upstream and changes no upstream crate's code.

- **New crates** in `engine/codex-rs/`:
  - `inquello-domain`: the rules, commands (`InitializeStore`, `get_store_info`) and ports (`WorkingStore`, `Clock`) for local working metadata. It depends only on `thiserror` and `uuid`; `inquello-domain/tests/dependency_direction.rs` fails if it reaches sqlx, tokio, any `codex-*` crate or `inquello-adapters`.
  - `inquello-adapters`: `SqliteWorkingStore` (sqlx SQLite, WAL, full sync, busy timeout, embedded migration `0001_store_info_and_receipts.sql`) and `SystemClock`. Its only SQLite connect calls live in `src/sqlite.rs`, which carries the `clippy::disallowed_methods` expectation the same way `state/src/sqlite.rs` does.
  - Neither crate has a `BUILD.bazel`; Bazel is not used in this repository.
- **Workspace manifest** `engine/codex-rs/Cargo.toml`: both crates added to `[workspace] members` and as `inquello-domain` / `inquello-adapters` path entries under `[workspace.dependencies]`. No external dependency or version pin changed; the crates use existing workspace pins only (`sqlx`, `sqlx-macros`, `thiserror`, `uuid` with its `v4` feature, and `tokio`, `tempfile`, `pretty_assertions` for tests).
- **Lockfile** `engine/codex-rs/Cargo.lock`: committed as cargo regenerates it. That adds the two new packages and rewrites the 167 upstream workspace members from `0.0.0` to `0.165.0` (deviation 4). No external package changed. `cargo build --locked` now succeeds, and builds no longer leave `Cargo.lock` dirty, so the `git checkout -- Cargo.lock` step in the setup script is no longer needed.

After a future `git subtree pull`, expect conflicts only in `Cargo.toml` members and `Cargo.lock`; regenerate the lock with cargo rather than merging it by hand.

### Patch 2: Capability register (Story 1.9, 2026-10-28)

Adds code inside `inquello-domain` only; no upstream crate changes.

- **`inquello-domain/src/capability/`**: the register entry types, validation, `CapabilityRegister::load_embedded()` and the fail-closed `enablement(id)` query, plus the C/E `InventoryMap`.
- **`inquello-domain/register/`**: `capabilities.json` (the reviewed register, compiled in with `include_str!`) and `inventory-map.json` (one row per C/E item, generated and proved by `tests/inventory_map.rs`).
- **Dependencies**: `inquello-domain` now also uses the workspace pins `serde` (with `derive`) and `serde_json`. `Cargo.lock` gains only those two entries under `inquello-domain`; no external package or pin changed.

### Patch 3: Shared-service identity crates (Story 1.10a, 2026-10-28)

Adds two crates beside upstream; no upstream crate's code changes.

- **New crates** in `engine/codex-rs/`:
  - `inquello-protocol`: the SC-1/SC-2 wire types (login transaction, bootstrap, refresh, family revoke, session and membership views, the SC-2 envelope, response and error kinds) and the JSON conformance fixtures under `fixtures/`, with round-trip tests. Depends on `chrono`, `serde` and `uuid` only.
  - `inquello-service`: the axum service on sqlx/PostgreSQL with the embedded migration `0001_identity_sessions_receipts.sql`. Its only PostgreSQL connect call lives in `src/postgres.rs`, which carries the `clippy::disallowed_methods` expectation the same way `state/src/sqlite.rs` does. The `test-issuer` feature adds `src/test_issuer.rs` (ephemeral P-256 key via `ring`) and the `SyntheticTest` deployment; the PostgreSQL 18 conformance suite `tests/identity.rs` requires that feature. It depends on `inquello-domain` (never the reverse).
  - Neither crate has a `BUILD.bazel`.
- **Workspace manifest** `engine/codex-rs/Cargo.toml`: both crates added to `[workspace] members` and as path entries under `[workspace.dependencies]`, plus a new `ring = "0.17.14"` workspace entry for a crate already locked through `jsonwebtoken` and `rustls`. No existing pin changed. The service enables extra features on existing pins only: `sqlx` `postgres`, `axum` `http1`/`json`/`tokio`, `uuid` `serde`, and `reqwest` `json` for tests.
- **Lockfile** `engine/codex-rs/Cargo.lock`: gains only the two new package entries. No external package or version changed (`sqlx-postgres` and its dependencies were already locked).

### Patch 4: HTTPS synthetic topology (Story 1.10b, 2026-10-28)

Changes only `inquello-service`; no upstream crate's code changes.

- **HTTPS**: `src/tls.rs` terminates TLS with rustls (aws-lc-rs provider, safe default versions, ALPN `http/1.1`) through an axum `Listener` that completes handshakes off the accept loop. `ServiceConfig.tls` (`TlsConfig`: certificate chain and key, key redacted from `Debug`) enables it; with TLS the service may bind a non-loopback address, without it plain HTTP stays loopback-only.
- **Redirect matching**: `config::redirect_uri_matches` keeps exact matching but lets a registered loopback IP-literal redirect (`http://127.0.0.1/...`, `http://[::1]/...`) match any port with the exact path (RFC 8252 §7.3). Login transactions still bind the exact URI requested.
- **`test-issuer` feature additions**: `src/test_tls.rs` (an ephemeral P-256 CA and loopback server certificates through `rcgen`), `src/test_provider.rs` (the synthetic OIDC provider: discovery, JWKS, `/authorize` with auto-consent, `/token` with PKCE S256, one-use codes and client/redirect checks) and the `inquello-dev-topology` binary (`src/bin/`), which runs the provider and the service on loopback HTTPS against a fresh PostgreSQL 18 database, prints one JSON config line and writes only the CA certificate. The feature now also enables the optional `rcgen`, `time` and `tracing-subscriber` dependencies. New test target `tests/topology.rs` (requires the feature).
- **Workspace manifest**: unchanged. The service adds dependency edges on crates already locked and pinned in the workspace: `rustls`, `tokio-rustls`, `url`, and (optional) `rcgen`, `time`, `tracing-subscriber`; `tokio` gains the `signal` feature, which another workspace crate already enables.
- **Lockfile**: only `inquello-service`'s dependency list gains `rcgen`, `rustls`, `time`, `tokio-rustls` and `url` (`tracing-subscriber` was already listed as a dev-dependency). No package entry, version or checksum changed.

### Patch 5: Internal-company memberships (Story 1.11, 2026-10-28)

Changes only the Inquello crates; no upstream crate's code changes.

- **`inquello-domain/src/authorization/`**: the versioned Workspace role policy (roles of kind `audit_team` or `reviewer` only; any other kind, an unknown action, a policy without a `manage_membership` role, or a client/independence attribute is refused, the last as `route_not_available`), and the pure `decide` function over session, Workspace kind, membership role bindings, Engagement memberships and explicit grants, with the fixed `DenyReason` set. A `private_task` is reachable only by its creator. No new dependency: it uses the crate's existing `serde_json` and `uuid`.
- **`inquello-protocol`**: `src/workspace.rs` (Workspace and role views, invite acceptance, the Workspace-scoped SC-2 envelope and commands, access checks, deny reasons) and an optional `reason` on `ErrorDetail` (absent from every existing fixture). The new fixtures sit in `fixtures/workspace/` so the desktop's top-level fixture mirror stays unchanged.
- **`inquello-service`**: migration `0002_workspaces_memberships.sql` (Workspaces, policy revisions, memberships with role bindings, Engagements and their memberships, identity-bound invites, operator receipts, Workspace events, and the fixture-only `resource_registrations` and `grants`; it drops 0001's fixture-only `memberships` table). New routes `GET /v1/workspaces`, `GET /v1/workspaces/{id}/roles`, `POST /v1/invites/{id}/accept`, `POST /v1/workspaces/{id}/commands` and `POST /v1/workspaces/{id}/access-checks`. New `Lifetimes.invite`. New binary `inquello-service` (`admin create-workspace`, `admin update-policy`), which connects to PostgreSQL directly; no HTTP route creates a Workspace. New test target `tests/memberships.rs` (requires `test-issuer`).
- **Workspace manifest and lockfile**: unchanged. No dependency edge was added.

### Patch 6: Local data-policy cross-check (Story 1.12, 2026-10-28)

Test-only change in `inquello-domain`; no library code and no upstream crate changes.

- **`inquello-domain/tests/capability_register.rs`**: reads the desktop's local data-policy register (`desktop/data-policy.json`) by repository path and fails if any capability-register entry is `RealDataEligible` while an enabled data category has an unknown owner, rule owner, retention or export rule. It also checks that the committed register has no such blocker and that the cross-check trips on a synthetic unknown rule.
- **Workspace manifest and lockfile**: unchanged.

### Patch 7: Private Workspace organisation in the app-server (Story 1.14, 2026-10-29)

The first patch to upstream crates' code: the forked app-server now hosts the Inquello working store. The upstream changes are kept to protocol entries, one processor file and its wiring.

- **`inquello-domain/src/organise/`**: Engagement, folder, private Task and Workspace-label records; the commands `CreateEngagement`, `UpdateEngagement`, `CreateFolder`, `CreateTask`, `RenameTask`, `MoveTask`, `AttachThread` and `RememberWorkspace`, each with an operation ID and an expected (record) revision and a record-scoped receipt; the private-listing query; the `OrganiseStore` port. `DomainError` gains `NotFound` (unknown, other Workspace or other creator, indistinguishable) and `WorkspaceMismatch`. No new dependency.
- **`inquello-adapters`**: migration `0002_engagements_folders_tasks.sql` (`engagements`, `folders`, `tasks`, `workspace_labels`, `organise_receipts`; 0001 is unchanged) and `src/organise.rs`, the SQLite `OrganiseStore` (one `BEGIN IMMEDIATE` transaction per commit: revision compare-and-set, record, receipt). It now also uses the workspace pin `serde_json` (Task reference lists).
- **`app-server-protocol`** (upstream crate): `src/protocol/v2/inquello.rs` (the `inquello/*` params and responses) and eleven `ClientRequest` entries in `src/protocol/common.rs` (`inquello/session/setPrincipal`, `inquello/workspace/list|remember|tree`, `inquello/engagement/create|update`, `inquello/folder/create`, `inquello/task/create|rename|move|attachThread`), all stable and serialized in one `global("inquello")` queue. The vendored schema fixtures (`schema/json`, `schema/typescript`, `schema/precomputed/*.json.zst`) were regenerated with `write_schema_fixtures_from_env` (stable and experimental); the script's Python SDK step (`engine/sdk/python`, needs `uv`) was not run, so that SDK's generated types do not list the `inquello/*` methods.
- **`app-server`** (upstream crate): `src/request_processors/inquello_processor.rs` (and its tests). It takes `INQUELLO_WORKING_STORE` out of the process environment at startup (`take_inquello_working_store_env`, called from `src/main.rs`), so no tool or child inherits the path; opens the store lazily, refusing a path inside `CODEX_HOME`; binds the acting principal per connection through `inquello/session/setPrincipal` (unbound: `unauthenticated`; closed connection: unbound); and maps domain refusals to JSON-RPC errors with `data.inquello.kind`. Wiring: `src/request_processors.rs` (module and re-export), `src/message_processor.rs` (field, construction, eleven dispatch arms, `connection_closed`), `src/lib.rs` (re-export) and `Cargo.toml` (`inquello-domain`, `inquello-adapters`).
- **`inquello-service`**: the `inquello-dev-topology` binary (test-issuer only) gains `--seed-workspace NAME --seed-out FILE`, which creates a Workspace with the sample policy and the synthetic subject's first-administrator invite through the operator path (`admin::create_workspace`) and writes `{workspace_id, invite_id}`.
- **Workspace manifest**: unchanged. **Lockfile**: only the dependency lists of `codex-app-server` (`inquello-adapters`, `inquello-domain`) and `inquello-adapters` (`serde_json`) change; no package, version or checksum changed.

After a future `git subtree pull`, expect conflicts in `common.rs` (the `ClientRequest` list), `v2/mod.rs`, `message_processor.rs`, `request_processors.rs`, `main.rs` and the regenerated schema fixtures; regenerate the fixtures rather than merging them by hand.

### Patch 8: Review remediation R10 and R11 (Epic 1 review, 2026-10-29)

Changes only the Inquello crates; no upstream crate's code changes.

- **`inquello-adapters`**: `commit` and `commit_organise` check for the operation's receipt first inside their `BEGIN IMMEDIATE` transaction and return `DuplicateOperation`, so a request that raced an identical one replays it instead of reporting a revision conflict (R10). New test target `tests/concurrent_operations.rs`; the `tokio` dev-dependency gains the `sync` feature (for `tokio::sync::Barrier`), which other workspace crates already enable.
- **`inquello-domain`**: `initialize_store` and the organise commands look the receipt up again when refused after the first lookup (R10). The port docs state the receipt check's precedence.
- **`inquello-service`**: expiry is checked against the clock read after the relevant row locks (refresh, bootstrap, `authenticate` and its callers, invite acceptance); `Authenticated` carries that time (R11). New lock-wait tests in `tests/identity.rs`.
- **Workspace manifest and lockfile**: unchanged.

### Patch 9: Task states (Story 1.15, 2026-10-29)

Changes the Inquello crates and the same upstream points as Patch 7 (protocol entries, the Inquello processor and its dispatch).

- **`inquello-domain/src/state/`**: seven state dimensions (`task`, `run`, `output`, `checks`, `review`, `approval_marker`, `delivery_marker`), each with its exact vocabulary and allowed scope kinds (`task`, `run`, `output`); immutable `StateRecord`s with a per-(dimension, scope) `version`, actor kind (`human`, `runtime`, `system`) and reference, and the Task-state `revision` they created; the `record_task_state` command (operation ID, expected Task-state revision, state receipt, R10 re-lookup) and the creator-only `task_states` query; the `TaskStateStore` port. Writer rules: `review` and `approval_marker` need a human writer (the session's own principal); only `task` and `run` are enabled (`ENABLED_DIMENSIONS`). No transition table spans dimensions. `DomainError` gains `HumanActorRequired`, `DimensionNotEnabled` and `InvalidValue`. No new dependency.
- **`inquello-adapters`**: migration `0003_task_states.sql` (`task_states`, `state_receipts`; the schema also refuses a non-human `review` or `approval_marker` row and any value outside its dimension's vocabulary) and `src/states.rs`, the SQLite `TaskStateStore` (one `BEGIN IMMEDIATE` transaction per write: receipt check first, Task-state revision compare-and-set, record, receipt). New test target `tests/task_states.rs`; `tests/concurrent_operations.rs` gains the state-write races.
- **`app-server-protocol`** (upstream crate): `InquelloStateList*` and `InquelloStateRecord*` types in `src/protocol/v2/inquello.rs`, and two `ClientRequest` entries in `src/protocol/common.rs` (`inquello/state/list`, `inquello/state/record`), stable and in the `global("inquello")` queue. New refusal kinds `human_actor_required`, `dimension_not_enabled` and `invalid_value`. The vendored schema fixtures and precomputed exports were regenerated as in Patch 7 (stable and experimental; the Python SDK step was not run).
- **`app-server`** (upstream crate): `state_list` and `state_record` in `src/request_processors/inquello_processor.rs` (a `human` actor is always the bound principal and takes no reference; `runtime` and `system` need one) and their tests; two dispatch arms in `src/message_processor.rs`.
- **Workspace manifest and lockfile**: unchanged.

### Patch 10: Effective managed policy and broader modes (Story 1.18, 2026-10-29)

Changes the Inquello crates and the same upstream points as Patches 7 and 9 (protocol entries, the Inquello processor and its dispatch). No upstream behaviour changes: `configRequirements/read` and `config/read` are only called, never modified.

- **`inquello-domain`**: the Workspace policy document gains an optional `execution` section (`authorization/policy.rs`; `PolicyError::InvalidExecution`), validated in the new `execution_policy/` module: sandbox ceiling, allowed approval behaviours, network, MCP tools, extensions, `allow_full_access`, `allow_no_prompt`; unknown fields refused, external-audit attributes `route_not_available`. The pure `effective_policy` combines the Workspace layer (or the conservative Inquello default), the device requirements and the user configuration, the strictest value winning, each `Setting` naming its `SettingSource`. A Task's broader mode (`standard`, `no_prompt`, `full_access`) is a versioned creator-only record set by `set_broad_mode` (operation ID, expected revision, receipt `set_broad_mode`, R10 re-lookup; a broader mode needs a human writer, its exact reach statement as confirmation and a permitting policy, otherwise `DomainError::BroadModeNotPermitted { rule }`), read by `task_broad_mode`, and reported `Suspended` when the policy no longer permits it. `thread_settings` derives a thread's sandbox and approval settings. The capability register gains `prompt_inspection` and `specialist_cyber_access`, both `disabled` with no evidence. No new dependency.
- **`inquello-adapters`**: migration `0004_task_broad_modes.sql` (`task_broad_modes`, whose schema also refuses a non-human broader mode; `broad_mode_receipts`) and `src/broad_modes.rs`, the SQLite `BroadModeStore` (one `BEGIN IMMEDIATE` transaction: receipt check first, revision compare-and-set, record, receipt). New test target `tests/broad_modes.rs`; `tests/concurrent_operations.rs` gains the broad-mode races.
- **`inquello-protocol`**: `ExecutionPolicyView` and `ExecutionSection` (with `SandboxCeiling`, `ApprovalBehaviour`, `Access`) and the fixture `fixtures/workspace/execution_policy_view.json`.
- **`inquello-service`**: `GET /v1/workspaces/{id}/execution-policy` (members only; policy revision, authorization epoch and the validated section, or `null`). The policy is still changed only through the operator `update_policy` (new revision, epoch increment, receipt); no HTTP route changes it. The `inquello-dev-topology` binary gains `--seed-execution FILE`, which adds an `execution` section to the seeded policy (tests only).
- **`app-server-protocol`** (upstream crate): the `InquelloPolicy*`, `InquelloBroadMode*`, `InquelloWorkspaceExecutionPolicy`, `InquelloTaskPolicy`, `InquelloTaskBroadMode`, `InquelloThreadSettings`, `InquelloDeviceRequirements` and `InquelloCapabilityContractEntry` types in `src/protocol/v2/inquello.rs`, and three `ClientRequest` entries in `src/protocol/common.rs` (`inquello/policy/effective`, `inquello/broadMode/read`, `inquello/broadMode/set`), stable and in the `global("inquello")` queue. New refusal kind `broad_mode_not_permitted` (with `rule` and `revision`). The vendored schema fixtures and precomputed exports were regenerated as in Patch 7 (stable and experimental; the Python SDK step was not run).
- **`app-server`** (upstream crate): `policy_effective`, `broad_mode_read` and `broad_mode_set` in `src/request_processors/inquello_processor.rs`, with the device layer read from `ConfigRequirementsReadResponse` (allowed sandbox modes and approval policies; a granular policy allows none of Inquello's behaviours) and the user layer from the `User` layers of `ConfigReadResponse`, and their tests. `src/message_processor.rs` gains three dispatch arms and `inquello_policy_layers`, which calls the existing `config_requirements_read` and `read` (with layers) of the config processor.
- **Workspace manifest and lockfile**: unchanged.

### Patch 11: Bounded tool reads, writes and network (Story 1.19, 2026-10-29)

Changes the Inquello crates and the same upstream points as Patches 7, 9 and 10 (protocol entries, the Inquello processor and its dispatch). No upstream behaviour changes: the runtime's own `command/exec` processor, configuration writer (`config/batchWrite`), permission profiles, local sandbox, bundled bubblewrap and network proxy are only called, never modified.

- **`inquello-domain`**: the `execution` section gains `allowed_domains` (host or `*.`/`**.` wildcard patterns, lowercase, no scheme, port, path or user; at most 100, no duplicates; a non-empty list needs `network` allowed). `EffectivePolicy` gains `allowed_domains` (the list while network is allowed, otherwise none). The new `execution_policy/profile.rs` is the only derivation of a Task's tool profile, `tool_profile(policy, status, TaskFolder)`: bounded Standard and No prompt reach the Task's working folder and its `output` folder (read only under a `read_only` ceiling), the read-only system locations and the listed destinations; a permitted Full access mode is unbounded and claims no boundary. `Boundary` labels name each boundary in denials. The capability register gains `execution_sandbox` (`synthetic-only`, synthetic evidence: the desktop integration test and the smoke; first limit "Execution sandbox: local OS sandbox on this device; no hosted sandbox — V2 revisit (OQ-13)"). No new dependency.
- **`app-server-protocol`** (upstream crate): `InquelloToolBoundary`, `InquelloToolReach`, `InquelloRuntimeProfile` and `InquelloToolsExecParams`; `InquelloPolicyEffectiveParams` gains an optional `taskFolder`, `InquelloPolicyEffectiveResponse` a `reach`, and `InquelloTaskPolicy` a `reach` and an optional `runtimeProfile`. One `ClientRequest` entry, `inquello/tools/exec` (stable, `global("inquello")` queue, manual payload conversion), whose response is the runtime's own `CommandExecResponse`. New refusal kind `task_folder_missing`. Schema fixtures and precomputed exports regenerated as in Patch 7 (the Python SDK step was not run).
- **`app-server`** (upstream crate): in `src/request_processors/inquello_processor.rs`, the Task's reach and runtime profile in `inquello/policy/effective`, the `execution_sandbox` contract entry, and `tools_exec_plan`, which derives the profile from the same inputs (creator only, the Task's own Workspace, an existing Task folder) and returns the configuration edits and the runtime's own `CommandExecParams`. A bounded profile is the named permissions profile `inquello-task-<taskId>` (`:minimal` and this runtime's own executable read only, the Task folders as derived, `network.enabled` with only the listed domains through the proxy); `features.network_proxy = true` and `default_permissions = ":read-only"` are written with it (without the feature a profile's network bypasses the proxy; once named profiles exist the runtime requires a default, and the most restrictive built-in keeps everything else read only). A permitted Full access mode runs with `sandboxPolicy: dangerFullAccess`. `src/message_processor.rs` gains one dispatch arm and `inquello_tools_exec`, which writes the edits through the existing `config_processor.batch_write` and runs the command through the existing `command_exec_processor.one_off_command_exec`. Tests cover the profile shapes, the plan and its refusals.
- **Bundled bubblewrap**: `cargo build -p codex-bwrap` places `bwrap` beside `codex-app-server`, where the runtime finds it. Packaging must ship it with the app-server binary (not done in this story).
- **Workspace manifest and lockfile**: unchanged.

### Patch 12: Permission to act and command rules (Story 1.20, 2026-10-29)

Changes the Inquello crates and the same upstream points as Patches 7 and 9 to 11 (protocol entries, the Inquello processor and its dispatch). No upstream behaviour changes: the runtime's exec-policy prefix matching (`codex-execpolicy`, reached through `codex-config`'s `RequirementsExecPolicyToml`), its configuration writer and its `approvals_reviewer` setting are only used, never modified.

- **`inquello-domain`**: the `execution` section gains `command_rules` (`{prefix, decision: allow|prompt|forbid, note?}`; non-empty literal tokens without whitespace, control or shell/glob metacharacters; at most 100 rules, no prefix twice) and `automatic_permission_review` (boolean, off when absent); `EffectivePolicy` carries both. New `execution_policy/command_rules.rs`: `evaluate_command` combines the runtime's prefix matches (forbid over prompt over allow; the Workspace rule named on a tie), falls back to the effective asking behaviour (`untrusted` asks, `on_request` and `never` allow inside the profile), refuses a prompt under a mode that never asks (`cannot_ask`), and returns the decision record (decision, controlling rule, source `workspace_policy(revision)`, `user_rule(version)` or `approval_behaviour`, analysis, destination, consequence). `ReviewerState` (`off`, `not_available`, `active`) maps to the runtime's `approvals_reviewer` (`user` unless active); `bounded_reviewer_verdict` never turns forbid into allow. New `user_rules.rs`: a person's own rules as a per-principal versioned record (`set_user_rules`, operation ID, expected revision, receipt `set_user_rules`, R10 re-lookup); an allow rule is `DomainError::UserRuleCannotAllow`. New `permission.rs`: permission requests (`request_permission`, receipt `request_permission`; a forbidden command is never requested) and decisions (`decide_permission`, receipt `decide_permission`: a person allows or denies, the host only expires or denies, the automatic reviewer is bounded by the rules; a decided or expired request is `DomainError::RequestNotPending`), the creator-only `pending_requests` and `permission_request`, and `use_permission`, which consumes an allowed request once for exactly its command (`DomainError::PermissionNotGranted` otherwise). `PermissionRequestId`. No new dependency.
- **`inquello-adapters`**: migration `0005_command_rules_and_permissions.sql` (`user_command_rules`, `user_rule_receipts`, `permission_requests`, `permission_decisions` with one decision per request and schema checks that only a person or the reviewer allows and only the host expires, `permission_receipts`) and `src/permissions.rs`, the SQLite `UserRuleStore` and `PermissionStore` (one `BEGIN IMMEDIATE` transaction per write: receipt check first, then the version or single-decision check). Nothing here touches `task_states`. New test target `tests/permissions.rs`; `tests/concurrent_operations.rs` gains the user-rule and decision races.
- **`inquello-protocol`** and **`inquello-service`**: the execution-policy wire section gains `allowed_domains` (Story 1.19's field, which the wire had not carried), `command_rules` and `automatic_permission_review`; the fixture covers them.
- **`app-server-protocol`** (upstream crate): `InquelloCommandRule`, `InquelloCommandRuleView`, `InquelloRuleSource`, `InquelloPermissionReviewer`, `InquelloCommandEvaluation`, `InquelloPermissionDecision`, `InquelloPermissionRequest` and the params and responses of five `ClientRequest` entries in `src/protocol/common.rs` (`inquello/permissions/userRules/read`, `inquello/permissions/userRules/set`, `inquello/permissions/request`, `inquello/permissions/pending`, `inquello/permissions/decide`), stable and in the `global("inquello")` queue. `InquelloPolicyEffectiveResponse` gains `commandRules` and `reviewer`; `InquelloToolsExecParams` gains `permissionRequestId` and `sandboxProbeTarget`. New refusal kinds `user_rule_cannot_allow`, `command_forbidden` and `permission_required` (both with the decision record), `request_not_pending` and `reviewer_not_available`. Schema fixtures and precomputed exports regenerated as in Patch 7 (the Python SDK step was not run).
- **`app-server`** (upstream crate): in `src/request_processors/inquello_processor.rs`, `matched_rules` (each rule becomes one `codex-execpolicy` prefix rule through `codex_config::RequirementsExecPolicyToml`, its index carried in the justification; `Policy::matches_for_command` decides which match), the rule check in `tools_exec_plan` (forbid refused; prompt needs an allowed request for exactly that command, used once; allow still runs inside the Task's profile; the sandbox check is a fixed probe the processor builds and rules do not apply to), `approvals_reviewer` written with every run's configuration edits (`user` while no processing route exists, `PROCESSING_ROUTE_AVAILABLE = false`), and `user_rules_read`, `user_rules_set`, `permissions_request`, `permissions_pending` and `permissions_decide` (a `human` decider is the bound principal; the reviewer is refused as `reviewer_not_available`), with tests. `src/message_processor.rs` gains five dispatch arms.
- **Workspace manifest and lockfile**: unchanged.

### Patch 13: Runtime capability management (Story 1.21, 2026-10-30; unverified Rust build)

- Inquello domain/service policy adds `execution.allow_local_mcp_servers`, denied by default, with source attribution and service wire coverage.
- `app-server-protocol` adds `mcpServer/oauth/cancel {name, loginId}` and result status `cancelled | completed | failed | notFound`, serialized per MCP server like login. `plugin/install` gains backward-compatible optional `skipAuthentication` (default false); Inquello sends true.
- `app-server` tracks exact MCP OAuth attempts, exposes cancellation, delegates enterprise cancellation to its existing arbitration, and suppresses automatic/silent local and remote plugin OAuth when requested. Plugin installation no longer implies connector credential acquisition for Inquello callers.
- `rmcp-client` standard OAuth now has a cancellation/persistence gate. A successful cancellation cannot be followed by token persistence; if persistence already won, cancellation reports completed/failed rather than falsely claiming cancellation. Isolated callback/late-write/race tests are authored.
- `core-plugins` and protocol add credential-free MCP admission metadata, strict staged-content admission and structured refusal codes. Both install and enable check actual copied content before activation. Guarded targeted MCP status/login verify the winning config/plugin source and current transport before any process/network discovery; no name-collision fallback. Legacy upstream callers remain compatible when admission is omitted.
- No workspace dependency or lockfile changes; curated marketplace sync remains unchanged. Pinned source was read before extending these paths.
- Round 1 strict admission also checks the selected raw legacy manifest: malformed explicit `mcpServers` (including null), or a declaration discarded by path resolution, is refused rather than treated as no dependencies. Tests cover malformed values with and without a default MCP file. Agent-plugin parser inspection used upstream cut **commit** `360319d8dee62d87e2d59fc0c21805d79519cfed`, file `codex-rs/core-plugins/src/agent_plugin_manifest.rs`, **blob** `4b9d1e6356e803e2c0bb40eabe98f75eafdd5fde`. The recorded full tree for fork baseline **commit** `3c7b4e9931e14ebb692f3f93f55fa396cf2941f4` independently lists the same blob at `engine/codex-rs/core-plugins/src/agent_plugin_manifest.rs`; thus the inspected file matches baseline exactly. Its MCP location is fixed `mcp.json`, not the legacy declaration. The missing file was inspected, not installed into this snapshot.
- Round 1 boundary tests issue real `plugin/install` RPCs for both local and downloaded bundles: `skipAuthentication: true` yields an actual installed cache/config without OAuth requests; blocked host/stdio contents yield a structured refusal without cache publication, config change or provider installation. Fixtures explicitly select temporary file credentials (not a real keyring).
- Round 1 OAuth boundary test issues actual login/cancel RPCs, rejects stale IDs, cancels while a fixture token response is delayed, checks no late persistence, then completes a second isolated flow as a positive credential-store oracle and verifies cancellation reports `completed` after success. These are authored tests, not executed native evidence.
- **Not validated in this snapshot:** Rust tests/build/clippy/fmt, generated bindings/schema/stamp and native/keyring smoke. `cargo` and the built runtime are absent; protocol generation fails without Git metadata. See Story 1.21's validation log. Do not treat this patch as release-ready before those checks.

#### Story 1.21 remaining native/protocol completion gate

In the owner's complete checkout with its pinned toolchain and isolated test database, run these commands (not executed successfully in this materialized snapshot):

```sh
cd engine/codex-rs
CARGO_INCREMENTAL=0 cargo test -j 4 -p inquello-domain -p inquello-service -p inquello-protocol
CARGO_INCREMENTAL=0 cargo test -j 4 -p codex-rmcp-client oauth
CARGO_INCREMENTAL=0 cargo test -j 4 -p codex-core-plugins mcp_admission
CARGO_INCREMENTAL=0 cargo test -j 4 -p codex-app-server plugin_install_rpc
CARGO_INCREMENTAL=0 cargo test -j 4 -p codex-app-server oauth_cancel_rpc
CARGO_INCREMENTAL=0 cargo test -j 4 -p codex-app-server guarded_mcp_rpcs
CARGO_INCREMENTAL=0 cargo clippy -j 4 -p inquello-domain -p inquello-service --all-targets -- -D warnings
cargo fmt --all -- --check
CARGO_INCREMENTAL=0 cargo build -j 4 -p codex-cli -p codex-app-server
CARGO_INCREMENTAL=0 cargo build -j 4 -p inquello-service --bin inquello-dev-topology
cd ../..
# After review: commit the reviewed engine source locally so HEAD:engine is
# exactly the tree built above; review any Cargo.lock version-only changes.
git add engine FORK-CUT.md
git commit -m "Implement reviewed Story 1.21 runtime capability boundaries"
cd desktop
pnpm generate:protocol
pnpm run build
pnpm test
```

For a **Linux** runtime build only, also run `CARGO_INCREMENTAL=0 cargo build -j 4 -p codex-bwrap` alongside the CLI/app-server build. This helper is not part of the native Windows build instructions. The pinned `bwrap/build.rs` returns immediately for non-Linux targets; Linux compilation requires the existing libcap/pkg-config prerequisites. Baseline-tree blobs match the inspected upstream-cut files exactly: `bwrap/Cargo.toml` = `ed7010c8fdaea270f028ceb9a053e60c278d2b4c`, `bwrap/build.rs` = `d9d87932b2db8150e4bdcf663e2de32b7d100f9f`. The shell block above uses POSIX environment-assignment syntax; in Windows PowerShell set `$env:CARGO_INCREMENTAL = '0'` first and run the same cargo commands without their `CARGO_INCREMENTAL=0` prefix. No additional toolchain/package installation is authorized by this handoff.

Set `INQUELLO_TEST_DATABASE_URL` to the isolated topology before tests. This snapshot also lacks portions of the native source/test-support tree. Regeneration must use the real matching binaries and committed engine tree; never hand-write generated schemas, counts or stamps. Then run the specified seeded native/keyring smoke and confirm every report, including `capabilities`, is OK. Story remains in progress until all these gates pass.

## Toolchain setup (Windows, everything on D:)

The owner authorized these installs on 2026-10-28. Toolchains, caches and build output stay on D:. The Microsoft C++ build tools were already present and were not installed.

Run this block top to bottom in Windows PowerShell from any directory. Set `$Repo` to your clone first. The block stops at the first failure.

```powershell
$ErrorActionPreference = 'Stop'
$Repo = 'D:\Projects\inquello'          # root of your clone of this branch
$T    = 'D:\Toolchains'

# 0. Create the D: folders. Point this process at them before any install, and keep the Rust homes for future shells.
New-Item -ItemType Directory -Force "$T\rustup","$T\cargo","$T\downloads","$T\tmp","$T\npm-global","$T\npm-cache","$T\pnpm-store","$T\pnpm-cache" | Out-Null
$env:RUSTUP_HOME = "$T\rustup"; $env:CARGO_HOME = "$T\cargo"
$env:TMP = "$T\tmp"; $env:TEMP = "$T\tmp"
$env:npm_config_cache = "$T\npm-cache"   # nested npm runs (git-hosted deps) otherwise cache on C:
[Environment]::SetEnvironmentVariable('RUSTUP_HOME', "$T\rustup", 'User')
[Environment]::SetEnvironmentVariable('CARGO_HOME',  "$T\cargo",  'User')

# 1. Rust: download rustup-init, check it against the published SHA-256, install with no default toolchain.
$Base = 'https://static.rust-lang.org/rustup/dist/x86_64-pc-windows-msvc/rustup-init.exe'
Invoke-WebRequest $Base -OutFile "$T\downloads\rustup-init.exe"
Invoke-WebRequest "$Base.sha256" -OutFile "$T\downloads\rustup-init.exe.sha256"
$Expected = ((Get-Content "$T\downloads\rustup-init.exe.sha256" -Raw).Trim() -split '\s+')[0]
$Actual   = (Get-FileHash "$T\downloads\rustup-init.exe" -Algorithm SHA256).Hash
if ($Actual -ne $Expected) { throw "rustup-init.exe SHA-256 mismatch: got $Actual, expected $Expected" }
& "$T\downloads\rustup-init.exe" -y --default-toolchain none --profile minimal
if ($LASTEXITCODE -ne 0) { throw "rustup-init failed ($LASTEXITCODE)" }
$env:Path = "$T\cargo\bin;$env:Path"   # rustup-init also adds this to the user PATH for future shells
Push-Location "$Repo\engine\codex-rs"
rustc --version                        # rust-toolchain.toml auto-installs 1.99.1 + clippy, rustfmt, rust-src
if ($LASTEXITCODE -ne 0) { throw "rustc failed ($LASTEXITCODE)" }
Pop-Location

# 2. pnpm 10.34.5, installed with npm into a prefix on D:, ahead of the corepack shim in C:\Program Files\nodejs.
npm install -g pnpm@10.34.5 --prefix "$T\npm-global" --cache "$T\npm-cache"
if ($LASTEXITCODE -ne 0) { throw "npm install pnpm failed ($LASTEXITCODE)" }
$env:Path = "$T\npm-global;$env:Path"
$PnpmSrc = (Get-Command pnpm).Source
if (-not $PnpmSrc.StartsWith("$T\npm-global", [StringComparison]::OrdinalIgnoreCase)) { throw "pnpm resolves to $PnpmSrc, not $T\npm-global" }
pnpm --version                         # expected 10.34.5

# 3. Rust build (see "Build verification" for results).
Push-Location "$Repo\engine\codex-rs"
cargo build -j 4 -p codex-cli -p codex-app-server
$code = $LASTEXITCODE
git checkout -- Cargo.lock             # discard cargo's workspace-version rewrite (deviation 4)
if ($code -ne 0) { throw "cargo build failed ($code)" }
Pop-Location

# 4. TypeScript install and SDK build.
Push-Location "$Repo\engine"
pnpm install --frozen-lockfile --store-dir "$T\pnpm-store" --cache-dir "$T\pnpm-cache"
if ($LASTEXITCODE -ne 0) { throw "pnpm install failed ($LASTEXITCODE)" }
pnpm --filter @openai/codex-sdk build
if ($LASTEXITCODE -ne 0) { throw "SDK build failed ($LASTEXITCODE)" }
Pop-Location
```

In the original run on 2026-10-28 these steps ran as separate commands rather than this single script, and `npm_config_cache` was not yet set (deviation 6). The script itself has not been run end to end. The outcomes of the original run are in "Build verification" below.

Recorded installs:

- rustup-init SHA-256 `00f139da614dced87d3c3d4121c43eebdac3c1bf8a5ee86b9d80dfd71c8d70fd`, which matches the official `.sha256`. It installed rustup 1.29.2 (d8c92c676 2026-10-21).
- The toolchain is `1.99.1-x86_64-pc-windows-msvc`, selected by the override in `engine/codex-rs/rust-toolchain.toml`. Components: cargo, clippy, rust-src, rust-std, rustc, rustfmt.

## Observed versions vs planned stack

| Item | Planned | Pinned at cut | Observed locally | Result |
|---|---|---|---|---|
| Rust | 1.99.1 | `fork/codex-rs/rust-toolchain.toml`: `channel = "1.99.1"` | `rustc 1.99.1 (58cf8f9c3 2026-10-13)`, `cargo 1.99.1 (5f94df478 2026-08-27)` | Match |
| Rust edition | 2024 | `fork/codex-rs/Cargo.toml`: `edition = "2024"` | n/a | Match |
| pnpm | 10.34.5 | `fork/package.json`: `packageManager: pnpm@10.34.5+sha512...`, `engines.pnpm >=10.34.5` | `10.34.5` | Match |
| TypeScript | 5.9.2 | `fork/pnpm-lock.yaml` (lockfile v9): `typescript@5.9.2` | `tsc` reports `Version 5.9.2` | Match |
| Node | Node bundled with Electron 45.0.0 | `fork/package.json`: `engines.node >=22` | `v24.22.0` | Matches. The Electron v45.0.0 release notes (https://github.com/electron/electron/releases/tag/v45.0.0) list Node `v24.22.0` under Stack Upgrades. |
| React | 19.3.1 | Not present upstream (no React dependency in any upstream `package.json` or `pnpm-lock.yaml`) | n/a | Not present upstream; added in a later story |
| Electron | 45.0.0 | Not present upstream | n/a | Not present upstream; added in a later story |
| SQLite (bundled through SQLx) | at least 3.51.3 (WAL-reset fix) | `sqlx =0.9.0` with `sqlite-bundled`; `libsqlite3-sys 0.37.0` in `Cargo.lock` | Read from `D:\Toolchains\cargo\registry\src\index.crates.io-1949cf8c6b5b557f\libsqlite3-sys-0.37.0\sqlite3\sqlite3.h`: `SQLITE_VERSION "3.51.3"`, `SQLITE_SOURCE_ID "2026-03-13 10:38:09 737ae4a34738ffa0c3ff7f9bb18df914dd1cad163f28fd6b6e114a344fe6d618"` | Meets the 3.51.3 floor exactly |

## Deviations from the planned setup

1. **rustup profile `minimal`.** We ran `rustup-init` with `--profile minimal` as well as `--default-toolchain none`, so no docs component is downloaded. The pinned components (clippy, rustfmt, rust-src) still come from `rust-toolchain.toml`. Reason: less disk use and fewer downloads.
2. **pnpm installed into a D: prefix.** We used `npm install -g ... --prefix D:\Toolchains\npm-global --cache D:\Toolchains\npm-cache` instead of the default global prefix, which is `C:\Users\<user>\AppData\Roaming\npm`. Reason: keep toolchains off C:, which had about 6.2 GB free. On this machine the `pnpm` on the machine PATH is the corepack shim in `C:\Program Files\nodejs`. It comes before the user PATH, so a build shell has to put `D:\Toolchains\npm-global` first. We didn't change the persistent PATH for pnpm.
3. **Build-time locations on D:.** Each build shell sets `TMP`/`TEMP` to `D:\Toolchains\tmp`, and pnpm runs with `--store-dir D:\Toolchains\pnpm-store --cache-dir D:\Toolchains\pnpm-cache`. These are per-process settings only. Reason: disk pressure on C:.
4. **`cargo build` rewrites `fork/codex-rs/Cargo.lock`.** At the release tag, `Cargo.toml` sets the workspace version to `0.165.0`, but the committed `Cargo.lock` lists all 167 workspace member crates at `0.0.0`. The upstream release pipeline bumps versions at build time. A plain `cargo build` therefore rewrites those 167 `version = "0.0.0"` lines to `version = "0.165.0"`. No external dependency changes; the diff is exactly those 167 lines. Upstream files must stay unedited, so we discard the rewrite after building (`git checkout -- fork/codex-rs/Cargo.lock`) and don't commit it. `cargo build --locked` would refuse to build for the same reason. Whether to commit a synced lockfile is a later decision.
5. **`cargo build -j 4`.** The first attempt used the default parallelism (16 jobs on this 16-thread, 32 GB host) and failed after 7m44s with `memory allocation of 1048576 bytes failed`. rustc then crashed (`0xc0000409 STATUS_STACK_BUFFER_OVERRUN`), and the dependents of the crashed `codex-core` reported follow-on `E0463 can't find crate` errors. This was resource exhaustion, not a compile error at the cut: the pagefile is on C:, which is nearly full, and other processes were holding memory. A rerun with `-j 4` and no source changes succeeded. Use `-j 4`, or set `CARGO_BUILD_JOBS=4`, on hosts with this memory profile.
6. **Some writes still reached C:.** About 62 MB went into `C:\Users\<user>\AppData\Local\npm-cache`. pnpm runs a nested `npm install` to prepare the git-hosted dependency `@modelcontextprotocol/conformance`, and that npm process doesn't inherit `--cache-dir`. Setting `npm_config_cache` before the install (see setup) should avoid this, but nobody has re-tested it yet. The toolchain itself and the cargo target dir wrote nothing to C:. No `C:\Users\<user>\.cargo` or `.rustup` was created.

## Build verification (AC 1.1.2)

All commands ran on 2026-10-28 on Windows Server 2025 (x86_64-pc-windows-msvc), with Node v24.22.0 and the existing MSVC build tools. No upstream file was patched.

| Step | Command (cwd) | Outcome |
|---|---|---|
| Toolchain selection | `rustc --version` (`fork/codex-rs`) | `rustc 1.99.1 (58cf8f9c3 2026-10-13)`, auto-installed from `rust-toolchain.toml` |
| Rust build, attempt 1 | `cargo build -p codex-cli -p codex-app-server` (`fork/codex-rs`) | Failed with exit 101 after 7m44s: out of memory at 16 jobs (see deviation 5) |
| Rust build, attempt 2 | `cargo build -j 4 -p codex-cli -p codex-app-server` (`fork/codex-rs`) | Exit 0. `Finished dev profile [unoptimized + debuginfo] target(s) in 3m 20s` (incremental on attempt 1) |
| CLI binary | `fork\codex-rs\target\debug\codex.exe --version` | `codex-cli 0.165.0`, exit 0 |
| App-server binary | `fork\codex-rs\target\debug\codex-app-server.exe --help` / `--version` | Help printed, exit 0. `codex-app-server 0.165.0`, exit 0 |
| JS install | `pnpm install --frozen-lockfile --store-dir D:\Toolchains\pnpm-store --cache-dir D:\Toolchains\pnpm-cache` (`fork`) | Exit 0. `Lockfile is up to date, resolution step is skipped`, 549 packages, `Done in 59.2s using pnpm v10.34.5`. The lockfile was honoured unchanged. |
| SDK build | `pnpm --filter @openai/codex-sdk build` (`fork`) | Exit 0. tsup 8.5.0 built `dist/index.js` (16.87 KB) and `dist/index.d.ts` (10.40 KB) |
| TypeScript version | `pnpm --filter @openai/codex-sdk exec tsc --version` (`fork`) | `Version 5.9.2` |
| Upstream untouched | `git rev-parse 5aceac53db54c6f1a4413a7dc909b38b8dfde345:fork` and `git status --porcelain -- fork` after the builds (with `Cargo.lock` restored) | `307e4fa207fe563a11f3f7af09cee6fccd2d8376`, same as the squash commit tree; porcelain output empty |

Build output and disk use:

- The upstream `.gitignore` files cover build output (`target/`, `node_modules/`, `dist/`), and `git status` shows none of it.
- `fork/codex-rs/target` is about 22.5 GB on D:.
- `D:\Toolchains` (rustup, cargo, pnpm store, caches) is about 2.1 GB.
- Free space on C: went from 6,670,249,984 to 6,576,173,056 bytes, a drop of about 94 MB. About 62 MB of that is the nested npm cache (deviation 6). The rest is unrelated system and tooling activity.

AC 1.1.2 status: both binaries build and report a version, and the SDK build exits 0.


## Story 1.22 focused fork patch — authored 2026-10-30, native gates unmet

Canonical source commit: `7cae5f3aceeec3f84b5eca6e3fb57cf774553b8e`, tree
`7b05db4595ea7f20126ba918b06042c2065cd07c`. This materialized workspace has no local
Git metadata (`NO_VCS`). Missing source context was fetched read-only at that exact
commit through the connected repository and checked against Git blob SHA where
materialized; no remote writes, dependencies/toolchains installed, or live inference.

- Additive route domain/store: principal-private candidate configurations, exact
  candidate-revision Task selections, independent route revisions and atomic
  receipts (migration 0006). Compiled route/model/API/deployment evidence gates
  remain fail-closed; **no passing capability evidence was added**.
- Shared versioned CR-1 contracts, Messages request/SSE translation and volatile
  scoped auth live in the Inquello protocol/adapters. `WireApi::Messages` dispatch
  at the retained model client is explicit; no Messages prewarm, automatic retry,
  provider fallback, environment credential or configurable production endpoint.
  Existing Responses WebSocket→HTTP recovery remains on the same route.
- Private stdio credential handoff is bounded and excluded from generic request
  analytics/raw error diagnostics. Key, session and runtime transitions invalidate principal/credential scope;
  Task selection invalidates only that Task, without rebinding unchanged credentials. Codex continues using inherited keyring authentication.
- Scoped reviewer invocations are runtime-created, hidden, one-use and attributed.
  Main refreshes authority/policy and trusted data classification on both sides of inference; `reviewApply` receives
  no verdict/handle and atomically checks pending request, expiry and current local
  revisions with decision/receipt attribution (migration 0007). Public automated
  actor references are refused and the global reviewer remains `user`.
- Desktop configuration/selection and permission mediation use named operations,
  stale-result protection and truthful separate credential/adapter/evidence states.
  Applicable Task data tier defaults to unknown, hence human permission handling;
  only trusted isolated fixtures provide synthetic classification. No UI enablement
  toggle or real-data route was introduced.
- A default-off, debug-only `inference-fixtures` native target invokes actual
  inference inside an app-server child through a private stdio fixture method.
  Emitted tools traverse that same child's real permission/sandbox executor;
  the parent only serves loopback TLS fixtures and checks results. This is not
  production Task-start orchestration (Story 1.25). **Never ship that feature.** See
  `engine/codex-rs/app-server/tests/INQUELLO-MESSAGES-FIXTURES.md` for exact commands,
  assertions and the explicitly required Linux fixture target.

### Verification and release gate

Corrected loop-1 desktop build/types passed; focused tests **494 passed / 12 files**.
Final full suite: **1035 passed, 3 failed, 5 skipped; 38 files passed, 12 failed,
1 skipped**. Runtime-dependent collection, reference assets and generated/Git
metadata are absent. Five font assets remain unresolved. Logs:
`desktop/validation/story122-loop1-*.log`. Seven migrations applied together in
isolated Python SQLite 3.53.1; this validates SQL schema only, not Rust transaction
or concurrency behavior. Round-1 results in the spec remain historical only.

All cargo verification/build attempts failed before execution (`cargo: command not
found`, exit 127). Native API compatibility, fixture behavior, formatting, clippy,
full source exhaustiveness, packaged integration and keyring smoke are **unverified**.
Targeted pinned WireApi consumers were inspected and the remote-config test-helper
match corrected to refuse representing Messages as remote Responses; this is not
an exhaustive complete-checkout compiler result. Genuine protocol generation fails
without Git metadata/runtime; generated files and Cargo.lock were not hand-edited.
Cargo must genuinely resolve the new workspace dependency edges/features; do not
blindly discard its lockfile changes as the older version-only deviation did.

In a complete checkout with the approved pinned toolchain and isolated database:
run the Story 1.22 spec's cargo fmt/tests/clippy commands, the explicit native fixture
runbook, and separate CLI then app-server default-feature builds. Review and retain
genuine lock/schema changes; build and commit the reviewed engine source before
`pnpm generate:protocol`. Then run desktop build/full tests and the sandbox-enabled,
seeded keyring smoke with all earlier reports. The routes smoke here is deliberately
configuration-only, not evidence that inference is verified. Keep Story 1.22
in progress until every required gate is established; no release/merge is implied.

### Corrected lifecycle and continuation contracts

Configuration drafts retain their loaded expected revision until an explicit reload;
refresh cannot turn stale edits into current writes. Task selection epochs are
independent of global principal/credential/runtime epochs. Credentials are checked
against both generation and vault identity after asynchronous invalidation waits.
Unknown or changed Task classification invalidates staged review; current forbid and
cannot-ask rules are checked before permitting human handling.

Responses opaque history has its own exact route/model/API-bound continuation
representation rather than Messages parsing. Native Responses items are reconstructed
without rewriting encrypted content. Messages signed/redacted blocks retain exact
roundtrips. Core/adapter bounded sends and transport headers observe cancellation;
receiver closure cancels local transport. No remote rollback or billing reversal is
claimed. Added native regression sources remain unexecuted until cargo is available.

## Story 1.23 — local execution separately from inference (2026-10-30)

The desktop now has a bounded, private read-only environment operation and Task
panel. Execution is fixed to **This device (local host)**; verified runtime-owned
configuration, cached sandbox-check state, and the Task's explicit inference route
are separate facts. An empty successful route read differs from a failed or stale
read; unknown inference region remains **Unknown**. Refresh/invalidation discards
late Task, identity and runtime responses without changing drafts or selections.

Actual `PolicyService.runTool` dispatch uses a reusable local preflight before
probes/commands and after permission waits. Runtime loss or replacement fails
closed with the named local environment; permitted Full access semantics remain.
The register explicitly disables `execution.remote-cloud`, naming Story 8.1's
service/identity/context-transfer/mutation-ownership/policy/recovery gate;
collaboration hosting is not execution and hosted browser/sandbox remains
**V2 revisit (OQ-13)**. No remote backend, provider fallback, model-start UI or
real-data eligibility has been introduced.

The generated inventory map remains unchanged: its existing planned rows cannot
cite disabled register entries, and it must be regenerated by its native generator,
not manually patched or marked enabled. Cargo, matching native runtime, seeded
identity topology and working Electron binary are unavailable in this partial
non-Git workspace. Native inventory/generation, capability tests/fmt, real Electron
layout and seeded smoke remain owner follow-up, not acceptance evidence. See the
Story 1.23 spec's verification record for exact desktop results. Story stays
**in-progress**; Story 1.21/1.22 native/generation gates remain separate.

Post-dispatch continuity loss is an **uncertain outcome**, not proof that nothing
ran. Effects may already exist; the UI warns against blind retries and withholds
private outputs. Ordinary route polling preserves focused controls, while Task
invalidation clears private facts. Sandbox-probe settlement notifies the panel.
The actual-panel/production-notification seeded smoke is authored but unrun here.


## Story 1.24 — reasoning choices and attributable usage (2026-10-30)

Source now includes private versioned settings, migration 0008 usage history,
native reviewer and actual tool-completion accounting, authoritative selected-model
choices and inherited current-account Codex quota checks. Messages exposes defaults
only. Unknown consumption stays unknown; no budgets, prices, reserve fallback,
automatic credit spending, provider fallback or billing reconciliation were added.
The existing working-store governance/export/deletion boundary covers these records.

The desktop named IPC and Task panel passed build/three TypeScript checks and 250
focused/regression tests. Full suite had 1108 passing, 3 failing and 5 skipped tests;
missing native binaries, design imports, Git metadata and incomplete generated files
remain gates. Cargo/rustfmt are unavailable; native tests are authored but unrun.
The genuine generator was attempted and refused the non-Git snapshot before writes;
all 48 available generated files and schema stamp remain pinned-blob-identical.

Native tool completion persistence precedes its RPC response/desktop notification.
Other-boot unfinished records display uncertain without finalizing a concurrent
owner or replaying work. Combined seeded native-quota-to-mounted-panel smoke and its native child fixture
test are now authored using the existing default-off debug fixture dispatcher,
with zero-provider-dispatch and retained-work assertions. Seeded mounted defaults,
local-tool history and native limit-refusal smoke remain unrun. See `story-1-24-usage-support.md` for precise evidence and owner-run gates.
Story stays **in-progress**; prior 1.21–1.23 eligibility/native gates are unchanged.

## Story 1.25 — private Start-to-retained-turn binding (2026-10-30)

Source now includes a memory-only Start surface, explicit candidate configuration
revision and reasoning/speed acceptance, trusted named preflight/start/reconcile,
and an additive 0009 private Task/run journal. The creator-scoped operation binds
the exact request in governed private history; receipts contain private record references, not
prompt copies. First submission uses a real reserved retained thread and idle-only
turn, with host authorization installed before sampling. Lost acknowledgments
reconcile the same operation and never submit a second turn.

The internal fictional-data setup is default-off: an unpackaged main process must
receive `INQUELLO_FICTIONAL_AUDIT_SESSION` with exact principal/Workspace/profile
root, and the native binary must have the existing debug `inference-fixtures`
feature. The isolated profile contains `.inquello-fictional-audit-session`; native
checks its private store/root and binds the actual connection identity. No renderer
classification, prompt detection, synthetic banner or additional acceptance exists.
This is not production real-data authorization or proof of provider acceptance.

Owned Task inference is fenced from unbound Responses, automatic retry/fallback,
startup prewarm, compaction and memory summarization. Each actual sampling request
and tool continuation must use current native authority and attributable usage.
Only bounded command tools with an exact authorization mapping may execute; unknown
non-command tools remain unavailable. Retained history access is owner-guarded,
not granted by subscription. Submitted prompts/tool content are omitted from the
new receipt/usage/diagnostic paths; governed Task/runtime history retains them.

Native compilation, matching generated bindings, seeded Electron, actual retained
child fixture, and separately authorized live-provider fictional audit acceptance
remain explicit unrun gates. No paid provider call occurred during implementation.
Prior Stories 1.21–1.24 open gates remain unchanged. See
`_bmad-output/implementation-artifacts/story-1-25-start-support.md` for the precise
verification ledger and limitations. Story remains **in-progress**.

### Story 1.25 round 2 retained lifecycle correction (2026-10-30)

Durable private Task completion now follows real core TurnComplete/TurnAborted events, not provider usage receiver termination. The lifecycle integration file `engine/codex-rs/core/src/session/mod.rs` was restored from `ec39248123172de735f80515d12e58a123a23a02` and baseline Git blob verified as `aba497125ce18b608ad2ddeadcd4827ee0214cb5`. Usage accounting and terminal Task state are independent; late terminal rewrites remain refused. Desktop corrections and real PolicyService permission-consumption tests pass the focused matrix. Rust compilation, native fixtures (including allowed one-use action), generated protocol, seeded Electron and separately authorized actual provider acceptance remain open. No generated bindings were manually edited or eligibility promoted.

### Story 1.25 round 3 compatibility note

Bounded corrections add domain-owned reservation validation fences, a sanitized `setup-failed` journal state and a separate retained-terminal observation operation. These remain JSON journal additions under migration 0009, not manually generated protocol bindings. Native debug fixtures now author real retained pre-sampling failure and inter-attempt interrupt checks. Rust build/test/fmt, matching protocol generation and actual retained-child execution remain required and unexecuted here; desktop-only passing checks do not discharge those gates.

### Story 1.25 round 4 native effect boundary (2026-10-30)

Private tool handlers now receive a child of the ordinary invocation cancellation
token; Task authority revocation cancels that child and the registry awaits handler
cleanup instead of dropping the future. There is no detached watcher to dispose.
`ToolOrchestrator::run_attempt` revalidates trusted current authority and required
limits after approval/network waits, immediately before each initial/retry
`tool.run`, retaining existing sandbox and network cleanup. Queued attributable
usage and terminal evidence is drained on cancellation, not replaced with zero.

Regression scaffolding restored from pinned `ec39248123172de735f80515d12e58a123a23a02`
was Git-blob verified before editing: `registry_tests.rs`
`0cf26b084a09832e5bc7b6474babb9af7fd8a6b3`, `sandboxing.rs`
`d49273beb37fadf1dda778ef5ba8a047438dff69`, and `session/turn_context.rs`
`b31eeca5d5a9e20f382f6e4e78c5c5a7c837f64d`. The latter two remain unchanged.
The bound Responses transport test extends hash-verified `client_websockets.rs`
(baseline `288b8e208be27b3fb3a14d6b4a74922950a7d8dd`). No generated bindings,
dependencies, tool grants, eligibility or real-data approval were changed.
Native compilation and all new native regression execution remain explicit open
gates; see the Story 1.25 support ledger for executed desktop checks.

### Story 1.25 round 5 — actual one-shot command integration

The private tool policy now admits pinned `exec_command`, not nonexistent legacy
`shell`. Its one-shot string-`cmd` schema is constrained for private Tasks. Native
`get_command` resolves the shell, and `UnifiedExecRuntime::run` authorizes the
**final** rewritten argv and native Task-root cwd immediately before sandbox
launch. The existing bounded command evaluator and one-use PermissionMediator
are used; native forbidden rules remain effective. An independent native approval
prompt/cache is not reused as a second grant. Private retries/elevation, TTY,
persistent sessions, alternate environments/cwd, implicit skill dispatch,
apply-patch interception, shell snapshots and plugin sidecars are unavailable.
Final authority/limits checks occur after waits and before process spawn. The
one-shot lifecycle awaits startup ownership and reaps a process even when
cancellation races with publication of its process handle.

Additional pinned `ec39248123172de735f80515d12e58a123a23a02` sources restored
read-only and Git-blob verified before editing:
- `core/src/tools/handlers/unified_exec.rs`: `50faf5259ae74c4d81236b681617843ac93bda56`
- `core/src/unified_exec/process_manager.rs`: `0ba92cb486fe0b78413e85b061ae8601063bcd7b`
- `core/src/tools/runtimes/unified_exec.rs`: `44a6ab9b35e30fb7746886ba07aca7536759c09b`
- `core/src/unified_exec/oneshot.rs`: `5136c9139e12d67229ad6e8ed003325622e8afd6`
- `core/src/tools/handlers/unified_exec_tests.rs`: `0881f7eafffcab146fec1c2e23ac745bf677f975`
  Originals are retained in round-5 baselines.

The actual retained fixture now emits string-`cmd` `exec_command`, asserts the
advertised tool/schema, exact permission argv, one appended Task-root effect,
denial/no effect, consumed-permission reuse rejection, no additional inference,
sentinel hook suppression and exact Task/run usage. It also authors actual
one-shot running-process authority-revocation coverage. Native source is **not
execution evidence**: Rust build/fmt/check/clippy/tests, matching protocol
regeneration, sandboxed Electron and separately authorized provider-connected
fictional audit acceptance remain open. No dependency or credentials added.

## Story 1.26 — bounded actual progress and truthful publications (2026-10-31)

Native canonical retained-item progress now has a narrow authorized projection;
versioned plan/result metadata remains model-authored in existing governed history.
Exact action evidence alone can confirm plan work, and exact retained human
instruction scope alone can establish a decision basis. Results remain unchecked
without independent native check records. Questions reuse the native handler with
exact-turn authority before and after waits; they confer no process permission.
Main/preload holds bounded transient projections/questions; renderer composes the
existing progress/judgment/edit/approval primitives and clears stale private views.
No artifact creation, new database, broad tool grant or generated-binding edit.

Native compilation/fmt/tests/clippy, matching supported protocol generation,
retained-child fixture, target Windows Electron and separately authorized provider
useful-output acceptance remain open. Conditional SQLite writer contention and all
prior native/protocol/provider gates carry forward unchanged. See
`_bmad-output/implementation-artifacts/story-1-26-progress-support.md` for exact
verification and the cumulative auditor ledger. Story remains **in-progress**.

Story 1.26 pass-1 correction: canonical publication assembly precedes display
clipping; latest structured findings, terminal/recent work and explicit speakers
are retained preferentially, and ordinary answers are not duplicated as results.
ANSI/control removal is display-only and declares incomplete information. Local
Task hydration failure no longer cancels unrelated Task questions; Workspace and
session failure scopes remain fail-closed. Artifact absence requires actual empty
Task refs. The shared bounded native pagination seam has authored 301-item cursor,
identity and terminal-evidence coverage, still an unexecuted native owner gate.
Cumulative plan omission is not withdrawal; no reset/delete protocol was added.

Story 1.26 pass-2 correction adds read-only exact-operation discovery before Start
acknowledgement; scoped question-consumption fences and coalesced hydration; recent
canonical plan selection; citation/proof separation; diagnostic tails; and a shared
640 KiB native serialized projection ceiling with visible-reference consistency.
Native control parity and terminal-plan regressions are authored but unexecuted.
Desktop focused verification passes 382 tests; full verification retains baseline
native/design/Git failures (1,213 passed / 3 failed / 5 skipped). All native,
protocol, Windows/provider gates and writer-contention residual remain open.

## Story 1.27 — untrusted tool-output boundary (2026-10-31)

Shared source-aware guidance reaches private Messages and Responses routes without
promoting tool text. Review-corrected regressions exercise actual mock HTTP and
WebSocket requests, exact retained/provider source, trusted Task-local fixture
seeding, valid literal command rules, nonempty unchecked findings and genuine
one-use approval followed by changed-command denial. Existing native enforcement
is unchanged. Desktop distinguishes native execution status from untrusted output
and quoted inspection/refusal claims, preserving readable source and focus.

TypeScript/build and 76 focused desktop tests pass. Full suite retains partial
checkout failures (1,235 passed / 3 failed / 5 skipped; 12 failing files). Cargo
is absent, so native tests, builds and formatting remain unverified. No generated
protocol edits. Actual-provider analytical evaluation, Windows Electron and all
prior-story gates remain open; story/tracker stay in-progress. See
`_bmad-output/implementation-artifacts/story-1-27-untrusted-output-support.md`.

### Story 1.27 review correction 2

Native pre-execution `before_command` refusal now emits the existing failed
command-completion event, retaining action and scoped reason for authorized Task
progress without classifying stdout or widening permission. Scripted fixtures
coordinate observer shutdown after replay reconciliation and durable turn/usage
comparisons; exact findings and native/renderer shared refusal shape are asserted.
Desktop typecheck/build and 77 focused tests pass; full suite: 48 files pass,
12 fail, 1 skipped (1,236 tests pass, 3 fail, 5 skipped). Cargo remains absent:
native tests/check/fmt/fixture build are unrun, not passing. Actual model analytical
resistance, Windows and prior eligibility gates remain open. See story support.
