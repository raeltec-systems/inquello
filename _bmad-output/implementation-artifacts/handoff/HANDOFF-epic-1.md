# Handoff: Inquello Epic 1 (written 2026-10-29)

**Read this first, then `CLAUDE.md`, `FORK-CUT.md` and `_bmad-output/implementation-artifacts/sprint-status.yaml`.**

## Where things stand

| Item | Value |
|---|---|
| Branch | `feat/epic-1-secure-private-desktop` (pushed to `origin`) |
| Last pushed commit | `75e531e` docs: approve the story 1.21 spec |
| Done and verified | Stories 1.1–1.20 (each has `spec-1-*.md` with Implementation Notes) |
| Next | Story 1.21: spec approved, implementation **not started** apart from a partial patch (see below) |
| Remaining | Stories 1.21–1.30 (10 stories) |
| Pull request | None yet. Open **one** PR when all of Epic 1 is done; merge with a true merge commit, never squash or rebase |

**Story 1.21 partial work.** `handoff/story-1-21-partial.patch` is about 100 untested lines. It adds `execution.allow_local_mcp_servers` to the domain, the service wire, a fixture and a memberships test. It was saved as a patch rather than committed, so the branch stays green. Apply it with `git apply`, then finish the story. The engine changed, so regenerate the protocol stamp (see below).

## How each story is built (the owner's process)

1. **Plan:** write `spec-1-NN-*.md`, using the template of the existing specs: frontmatter, a frozen Intent/Boundaries/Matrix block with owner decisions, then Code Map, Tasks and Verification. Story sources are in `_bmad-output/planning-artifacts/epics.md`.
2. **Ask:** put the genuinely open product decisions to the owner, two at most, each with a recommended option. Then stop at the spec checkpoint for approval.
3. **Implement**, then run the spec's Verification commands yourself. Never trust a sub-report.
4. **Close out:** tick the spec's Tasks, add Implementation Notes outside the frozen block, set `status: 'done'`, set the story to `done` in `sprint-status.yaml`, then commit and push.
5. **No review layers:** a separate reviewer covers the PR.
6. **Ask before any install or download** that the approved spec does not authorize.

## Repository rules

- **`engine/`** is Inquello's fork of `openai/codex` (`rust-v0.165.0`). Edit it only where a story needs it.
  - Record each engine patch in `FORK-CUT.md`. Patches 1–12 exist; the next is **13**.
  - Inquello crates: `inquello-domain` (pure rules), `inquello-adapters` (SQLite working store; migrations 0001–0005), `inquello-protocol`, `inquello-service` (axum + PostgreSQL shared service), and the app-server `inquello/*` methods in `app-server/src/request_processors/inquello_processor.rs`.
- **Protocol stamp:** `desktop/src/protocol/schema-stamp.json` holds `forkTreeHash` = `git rev-parse HEAD:engine`. After any engine change:
  1. commit the engine;
  2. run `pnpm generate:protocol` in `desktop/`;
  3. fold the regenerated files into the commit (amend).

  The desktop tests fail if the stamp is stale.
- **Desktop** (`desktop/`):
  - Electron 45, with a sandboxed, context-isolated renderer.
  - Every renderer capability is a named operation in `src/main/security/operations.ts`, with sender and payload validation.
  - Main mediates everything; the renderer never sees credentials or absolute paths.
- **Never** print environment dumps (this machine has real provider keys in its environment).
- **Never** pass `--no-sandbox` to Electron.
- **Never** label permission, broad modes or automated review as review, approval or Professional Approval (FR-44, UX-DR51).

## Build and verify

**Engine** (from `engine/codex-rs`):
- Always set `CARGO_INCREMENTAL=0` and use `-j 4`. Disk is tight, so delete `target/debug/incremental` and the test binaries in `target/debug/deps` between heavy builds.
- Build these **separately**, because a combined build hits an sqlx feature clash:
  - `cargo build --locked -p codex-cli -p codex-app-server`
  - `cargo build --locked -p inquello-service --features test-issuer --bin inquello-dev-topology`
- The Linux sandbox needs the bundled bubblewrap: `cargo build --locked -p codex-bwrap` puts `target/debug/bwrap` next to `codex-app-server`. This needs `libcap-dev`, which is installed here and approved by the owner.
- Tests:
  - `inquello-domain`, `inquello-adapters`, `inquello-protocol`;
  - `inquello-service --features test-issuer` (needs PostgreSQL);
  - `codex-app-server --lib inquello`.
- Clippy `-D warnings`: one upstream `let_and_return` warning in the app-server is pre-existing.

**Database:** PostgreSQL 18. Start it with `pg_ctlcluster 18 main start`, then set `INQUELLO_TEST_DATABASE_URL=postgres://inquello_test:inquello_test@127.0.0.1:5433/inquello_test`.

**Desktop:** `pnpm run build`, then `pnpm test` with the database URL. The count was 945 passing at Story 1.20.
- Don't run vitest suites in parallel; they deadlock on the keyring.
- If a run hangs with no CPU activity, kill its vitest, dbus and gnome-keyring processes by PID and rerun once.

**Smoke** (the acceptance gate for every story):
1. `chmod -R o+rX desktop/dist`
2. `rm -f /home/smoke/smoke114/{hold,config.json,seed.json}`
3. `runuser -u smoke -- dbus-run-session -- /home/smoke/smoke114/run.sh`

The script starts the seeded dev topology, then runs Electron `--smoke` under xvfb as a non-root user. It must exit 0, with these 12 reports `ok`: renderer-privileges, design, identity, data, providers, organise, states, shell-layout, composer, policy, tool-bounds, permissions. Each new story adds its own report in `desktop/src/main/smoke-probe.ts`.

## Owner decisions already made (keep these)

| Story | Decision |
|---|---|
| 1.15 | Seven separately stored, versioned states. Only Task and run states have writers. Approval and Delivery are local markers only, until OQ-15. |
| 1.16 | Artifact area built but kept closed; Ctrl/Cmd+K unbound until Search (Story 1.30). |
| 1.17 | Drafts are in memory only; Send is disabled with a reason until Story 1.25. |
| 1.18 | Policy is the Workspace policy plus device-managed Codex requirements, and the stricter rule wins. Broad modes are per Task with an explicit confirmation. The user's own config narrows standard settings but cannot block a broad mode. |
| 1.19 | Private per-Task working and output folder. Network denied by default, opened only by an admin `allowed_domains` list. |
| 1.20 | Admin command rules plus user rules that can only be stricter. The automatic permission reviewer is a policy switch, off by default. |
| 1.21 | **Full management** in S07: install plugins, add MCP servers, connection sign-ins. The marketplace sync is **left on**. Local stdio MCP servers need `allow_local_mcp_servers` plus a confirmation. |
| — | The owner waits for Story 1.25 (the first real model Task) before testing on Windows. Don't build interim test-only features. |

## Known follow-ups (see `deferred-work.md`)

- D01–D03 from the Story 1.11/1.13 review stay deferred.
- **Draft clearing (Story 1.17)** detects a principal change from the display name and issuer. Replace this with an opaque principal reference by Story 1.25.
- **Thread start (Story 1.25)** must go only through `effectiveThreadSettings`. It must also wire escalations and model-originated permission requests to the Story 1.20 mediator, which is currently exercised only via `inquello/tools/exec`.
- **Linux packaging** must ship the bundled `bwrap` beside `codex-app-server`.
- **Not yet verified on macOS or Windows:** sandbox and policy.
