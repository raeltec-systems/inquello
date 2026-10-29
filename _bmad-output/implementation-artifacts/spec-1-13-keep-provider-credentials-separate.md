---
title: 'Story 1.13: Keep provider credentials separate and protected'
type: 'feature'
created: '2026-10-28'
status: 'in-progress'
route: 'dispatch'
review_loop_iteration: 0
baseline_commit: '31617fa03bf6bb73b37217f7487bccb0c022c9dc'
context:
  - '{project-root}/_bmad-output/implementation-artifacts/epic-1-context.md'
  - '{project-root}/_bmad-output/planning-artifacts/architecture/architecture-inquello-2026-10-26/claude-access-routes-2026-10-27.md'
  - '{project-root}/_bmad-output/implementation-artifacts/spec-1-10b-desktop-sign-in-and-https-topology.md'
  - '{project-root}/_bmad-output/implementation-artifacts/spec-1-12-govern-local-data-held-by-first-route.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Provider credentials have no governed home today. Two gaps follow:
- The runtime inherits whatever `OPENAI_API_KEY` or `ANTHROPIC_API_KEY` the user's shell holds, which is an uncontrolled credential path.
- There is no place to hold the selected Claude API key.

Nothing proves that connecting or losing a provider leaves Inquello identity untouched, or that keys stay out of logs, exports and child processes (AD-7, AD-8, AD-23, C53–C57, UX-DR40).

**Approach:** Keep two provider routes, each separate from Inquello identity:
- **Claude API key:** held in a desktop main-process provider vault (OS-backed `safeStorage`, memory-only otherwise), with an optional free verification call.
- **Inherited Codex login:** API key or ChatGPT, driven through the app-server `account/*` methods and stored by the runtime in the OS keyring.

Both appear in one provider status, separate from identity. The runtime child gets no inherited provider keys.

**Owner decisions (2026-10-28):**
- **Routes:** cover the Claude API key and the inherited Codex login now.
- **Claude key storage:** the desktop main vault. Story 1.22 hands the key to the Messages adapter over a private channel, never the environment.
- **Verification:** a free check is allowed: `GET https://api.anthropic.com/v1/models` with the user's key, run only when the user asks.

## Boundaries & Constraints

**Always:**
- **Claude key vault:** `<userData>/providers/claude.bin`, mode 0600. It uses the same backend rules as the identity vault (OS-backed, else memory-only, with the status saying so).
  - The key is submitted once through `provider.setClaudeKey(key)`. Main validates it: an `sk-ant-` prefix, a length bound and printable characters.
  - After that the renderer only ever sees the state: `not-configured`, `stored-unverified`, `verified`, `rejected` or `unreachable`, plus the storage kind. It never sees the key or any fragment of it.
  - `provider.verifyClaudeKey()` calls `/v1/models` with `x-api-key` and `anthropic-version: 2023-06-01`, a 10 s timeout and no retries. A 401 or 403 gives `rejected`; a network error gives `unreachable`. The base URL is overridable only by the dev config, so tests use a local fake. No Messages request is ever sent.
  - `provider.removeClaudeKey()` deletes the key.
- **Inherited Codex login:**
  - The desktop writes `cli_auth_credentials_store = "keyring"` into `<runtime-home>/config.toml` before the runtime starts. Keyring unavailable means login fails with a stated reason; there is no `auth.json` fallback.
  - The operations are `provider.codexLogin({type:'apiKey', apiKey} | {type:'chatgpt'})`, `provider.codexLogout()` and status from `account/read` and `account/updated`.
  - ChatGPT login opens the system browser only through `identity/browser.ts`.
- **Separation:**
  - Provider states live in a `providers` status that is never merged into `identity`.
  - Connecting, expiring, revoking or removing either route changes only that route's state and the inference-route authorization (a pure `inferenceRoutes(status)` function). The Inquello session, membership and grants are unchanged.
  - Inquello sign-out does not remove provider credentials, and provider removal does not sign out.
- **Runtime environment:** `runtimeChildEnv` also strips provider credential variables (`OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `CODEX_API_KEY`, `AZURE_OPENAI_API_KEY`, and any `*_API_KEY`, `*_SECRET` or `*_TOKEN` matching the provider list). The runtime uses only credentials set through Inquello.
- **Data policy:** add or update categories for the provider vault (main only, never exported, deleted by key removal), the runtime `config.toml` (Inquello-written) and the runtime keyring entry (OS store, deleted by Codex logout). `auth.json` stays a disabled, blocking category.
- **Negative protection test:** a sentinel key, set through both routes, must never appear in:
  - the renderer status, logs or the app-server stderr log;
  - exports, `/proc/<app-server pid>/environ` on Linux, or any file under userData except the encrypted vault and keyring.
- **Display:** a Providers block on the specimen page, built from the existing primitives. The key field is a password-type TextField, cleared after submit.

**Never:**
- No Messages or Responses inference requests.
- No subscription OAuth for Claude.
- No key in IPC responses, logs, URLs, environment variables or exports.
- No change to the shared service.
- No new dependencies.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Store Claude key | Valid `sk-ant-…` | `stored-unverified`; vault file encrypted | Invalid format: rejected, nothing stored |
| Verify OK | Fake endpoint returns 200 | `verified` | N/A |
| Verify rejected | Fake endpoint returns 401 | `rejected`; key kept until removed | N/A |
| Verify offline | Endpoint unreachable | `unreachable` | No retry |
| Remove Claude key | `removeClaudeKey()` | `not-configured`; file gone; identity unchanged | N/A |
| Codex API-key login | `codexLogin({type:'apiKey'})` with a fake key | `account/read` shows `apiKey`; stored in keyring; no `auth.json` | Keyring missing: error, nothing stored |
| Codex logout | `codexLogout()` | Route disconnected; identity unchanged | N/A |
| Identity independence | Sign out of Inquello while both routes are connected | Provider states unchanged | N/A |
| Inherited env key | `OPENAI_API_KEY` set in the desktop's environment | Absent from the runtime child env; route shows not connected | N/A |
| Sentinel leak scan | Sentinel set via both routes, then export and logs | Sentinel found nowhere except the vault and keyring | Test fails, naming the location |
| Renderer probe | Renderer inspects `provider.*` results | No key or fragment | Smoke fails if found |

</frozen-after-approval>

## Code Map

- `desktop/src/main/identity/vault.ts` -- the safeStorage backend detection and memory-only pattern to reuse for the provider vault. `identity/browser.ts` is the only `shell` user.
- `desktop/src/main/runtime/env.ts` -- `runtimeChildEnv`; extend the stripping.
- `desktop/src/main/runtime/rpc.ts` and `process.ts` -- the app-server request API, and the server-request handling (`-32601` today). The ChatGPT login may need its `account/login/completed` notification.
- `desktop/src/protocol/generated/v2/{LoginAccountParams,GetAccountResponse,Account,AccountUpdatedNotification}.ts` -- the wire types.
- `engine/codex-rs/config/src/types.rs:136` -- `AuthCredentialsStoreMode` (`file`, `keyring` or `auto`).
- `desktop/data-policy.json` and `desktop/src/main/data/` -- the categories and classifier.
- `desktop/src/main/security/operations.ts`, `preload.ts`, `Specimen.tsx` and `smoke-probe.ts`.

## Tasks & Acceptance

**Execution:**
- [x] `desktop/src/main/providers/` -- `claude-vault.ts`, `claude-verify.ts`, `codex-account.ts`, `status.ts` (with `inferenceRoutes`) and `index.ts`.
- [x] `desktop/src/main/runtime/env.ts` and `main.ts` -- provider-variable stripping, and the `config.toml` keyring setting written before start.
- [x] `desktop/data-policy.json` -- the new and updated categories.
- [x] Preload and operations (`provider.*`), plus the Providers block.
- [x] `desktop/test/providers*.test.ts` -- every matrix row. The Codex rows run against the real app-server with a fake API key and the gnome-keyring D-Bus session. A fake HTTPS Anthropic endpoint uses the test CA.
- [x] `desktop/src/main/smoke-probe.ts` -- a `providers` report: separation, the sentinel scan, the renderer probe and no inherited env keys.
- [x] `sprint-status.yaml` (1-13).

**Acceptance Criteria:**
- Given the smoke with keyring, when it runs, then both routes connect and disconnect without changing identity, the sentinel appears nowhere outside the vault and keyring, and the run exits 0 with `providers.ok: true`.

### Review Findings

Review pass 2026-10-29, HEAD `ace1ca2`, using `bmad-code-review`. Full evidence, ranking and limitations: [completed-story review](reviews/2026-10-29-epic-1/report.md). Owner selected “Leave as action items” on 2026-10-29. All patch findings remain open; no implementation fixes applied. Review status and sprint tracking synchronized.

- [ ] [Review][Patch] R03: Local data deletion leaves a memory-only Claude key usable [desktop/src/main/data/service.ts:285] — BMAD medium; likelihood Medium; impact High; change risk Low–moderate — recommendation: Fix now.
- [ ] [Review][Patch] R06: Offline recheck makes a known-rejected Claude key authorized [desktop/src/main/providers/index.ts:149] — BMAD medium; likelihood Medium; impact Medium; change risk Low — recommendation: Fix now.
- [x] [Review][Defer] D03: Claude action completion waits for an unrelated Codex status request [desktop/src/main/providers/index.ts:91] — BMAD maybe-false; likelihood Unknown; impact Medium (unverified); change risk Moderate — deferred: Leave unless a shipped-runtime stall is reproduced; Reproduce with the shipped runtime and a real keyring failure, recording request completion/termination behavior; a deliberately hung fake alone does not establish production likelihood.

R01 in Story 1.12 also applies to provider-secret exclusion from export; count it once.

#### Rejected

- #24 Malformed Codex account becomes connected — `false`; likelihood Low, impact None demonstrated. The pinned trusted runtime serializes account/read from its typed, tagged Account enum (including apiKey/chatgpt and other provider variants), not arbitrary {}. No current caller emits the alleged malformed state; inventing an untrusted runtime contradicts the accepted transport boundary. There is no demonstrated current authorization bypass.

## Implementation Notes

- **Cloud machine (Linux, root):**
  - **PostgreSQL 18:** start it with `pg_ctlcluster 18 main start`, and export `INQUELLO_TEST_DATABASE_URL=postgres://inquello_test:inquello_test@127.0.0.1:5433/inquello_test` for `pnpm test`.
  - **Keyring session:** gnome-keyring, libsecret and dbus are installed. A working session for the `smoke` user is `runuser -u smoke -- dbus-run-session -- sh -c 'echo -n testpw | gnome-keyring-daemon --unlock --components=secrets >/dev/null; <command>'`. Tests that need the runtime keyring as root can use the same pattern with `dbus-run-session` as root, or be scoped to run under it. Pass Electron `--password-store=gnome-libsecret`.
  - **Smoke:** build with `pnpm run build`, run `chmod -R o+rX dist`, and run the smoke as `smoke` under `xvfb-run`. Never pass `--no-sandbox`.
  - **Network:** no real Anthropic call is needed for tests. Use the local fake HTTPS endpoint with the test CA (see the 1.10b `test_tls` pattern, or generate a CA in the test).
  - **Baseline:** 597 desktop tests pass with the database URL set; the smoke exits 0 with privileges, design, identity and data all ok.

- **As built:**
  - **Providers (`desktop/src/main/providers/`):** `claude-vault.ts` reuses the identity vault's `detectCredentialStorage`; when OS-backed the encrypted file is the only truth (every read decrypts it), so a file deleted through Local data is a removed key. The record holds the key and its last check state. `claude-verify.ts` maps 200 to `verified`, 401/403 to `rejected`, and any other answer, network or TLS error or timeout to `unreachable`; no redirects, no retries, body discarded. `dev-config.ts` reads `INQUELLO_PROVIDER_DEV_CONFIG` (`{ anthropic_base_url, ca_path }`, https origin, certificates only) in unpackaged builds only. `codex-account.ts` maps runtime errors to fixed sentences (keyring unavailable, login refused, and so on) and never passes the runtime's message on. `status.ts` holds the pure `inferenceRoutes` (a Claude key authorizes unless absent or `rejected`; Codex only when `connected`) and the field-by-field renderer rebuild, which adds `routes` and drops everything else (a ChatGPT account shows its plan type, never the email).
  - **Runtime:** `runtime/config.ts` rewrites `<runtime-home>/config.toml` in full (0600) before every start with `cli_auth_credentials_store = "keyring"` and `[features] secret_auth_storage = false`, so the login itself sits in the keyring on every platform (the Windows default would otherwise keep an encrypted file under `secrets/` in the runtime home). `runtimeChildEnv` strips the four named variables and any `*_API_KEY`, `*_SECRET` or `*_TOKEN` with OPENAI, ANTHROPIC, CLAUDE, CODEX or CHATGPT as one of its `_`-separated parts (so `MY_OPENAI_API_KEY` too), plus `INQUELLO_PROVIDER_DEV_CONFIG`.
  - **Operations:** six `provider.*` operations; only `setClaudeKey` (one string up to 4096 characters) and `codexLogin` (exactly `{type:'apiKey', apiKey}` or `{type:'chatgpt'}`) take arguments, and their validator messages never quote a value. Main checks the key form and answers with a reason.
  - **Data policy:** three new enabled categories, `claude-key-vault`, `runtime-config` and `codex-keyring-entry`; `provider-credentials` (`auth.json`, `.credentials.json`, `secrets/**`) stays disabled and blocking. Locations may now be `{ store: "os-credential-store", entry }`: such a category is never inventoried, exported or deleted by Local data (`data.delete` refuses it; `DataService.deletableCategories()` leaves it out) and the category view carries `location: files | os-credential-store`.
  - **Display:** the Providers block sits after Local data on the specimen page; `TextField` gained `type="password"`. Both fields are cleared as the key is submitted, whatever main answers.
  - **Smoke:** the `providers` report types one sentinel into both password fields, requires `stored-unverified` (os-backed, vault 0600 in a 0700 dir, no plaintext) and a Codex `apiKey` login with no `auth.json`, signs out of Inquello (signing in first when the topology is configured) and requires both routes unchanged, removes both routes and requires the identity unchanged. While the sentinel is held it searches every file under userData and logs, an export, the stderr log, main's own log (smoke keeps it), `/proc/<app-server pid>/environ` and the renderer dump for the sentinel and every 8-character fragment of its random part. If no provider variable is set, the smoke sets a synthetic `OPENAI_API_KEY` so the environment check always runs.
- **Results (2026-10-29):**
  - Desktop: both `tsc` checks are clean and 718 tests pass (597 earlier plus 121 new), including the real app-server keyring rows run inside their own `dbus-run-session` with gnome-keyring (the entry read back with `secret-tool` from a second session) and the no-keyring row.
  - Smoke as `smoke` in a D-Bus session with gnome-keyring unlocked, `--password-store=gnome-libsecret` and `xvfb-run`: exit 0, all reports ok, `providers.ok: true` with no leaks over about 5,100 searched items. A second run with the dev topology also exits 0, with the probe's sign-out going from `signed-in` to `signed-out` and both routes unchanged.
  - Step-04 review was skipped by owner rule.

## Verification

**Commands:**
- In `desktop/` (with `INQUELLO_TEST_DATABASE_URL` exported): both `tsc` checks and `pnpm test` -- expected: all pass
- Smoke as `smoke` inside `dbus-run-session` with an unlocked gnome-keyring, `--password-store=gnome-libsecret` and `xvfb-run` -- expected: exit 0, with `providers.ok: true` and all earlier reports ok
