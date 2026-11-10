# Retained pilot reopened on current artifacts — 2026-11-09

Operational recovery for `spec-reopen-retained-pilot-for-live-acceptance.md`. The existing Epic 1 branch and local work were preserved. Initial recovery passed, and the approved narrow renderer recovery repair is now built and verified. Actual reload/recovery is pending Windows desktop access; live-provider and Epic acceptance remain pending. No task completion or commit is claimed.

## Preserved identity and scope

- Run: `9f9d996b-255c-47f8-9fa2-4fc004cfab03`.
- Root: `D:\Inquello\tmp\inquello-auth0-pilot-20261102`.
- Existing database identity/context, ports 45443/43821, profile receipt and config/serve digests were verified before mutation.
- Root ACL is protected for the current user only. Descendant ACLs were checked against the app's existing private-path policy: current user, SYSTEM and Administrators only. No ACLs on retained data were changed.
- No profile/database reset, seed, user-data restoration, keyring export, consent change, external OAuth grant or model prompt was performed.

## Recovery and current artifacts

During recovery, the owner separately approved deletion of exactly two generated cache directories: `D:\Projects\inquello\fork\codex-rs\target` and `D:\Projects\inquello\engine\codex-rs\target\debug\incremental`. Canonical paths, ancestry, absence of reparse points and idle Rust build processes were checked before removal. Both are absent; measured free space increased by **24.59 GiB** to **32.42 GiB** immediately afterward. No other cleanup occurred. Current builds explicitly disable incremental compilation.

Private backup: `D:\Inquello\backups\pilot-live-acceptance-20261109`. The profile copy was verified file by file; the existing database was dumped privately and its archive listing validated. Database size was 9,798,159 bytes; profile size measured before recovery was 62,209,447 bytes. Backup receipts and activation journal remain private. No user data was restored from an older backup.

Installed OpenSSL renewed the CA and server certificates with the existing keys, same subjects, same constraints and only `IP:127.0.0.1` as the server SAN. Both certificates have exactly seven-day lifetimes and expire **2026-11-16 20:44:01 UTC**. Only `tls/ca.pem`, `tls/server.pem` and `pilot.json`'s CA digest were activated. Original files were retained in the new private backup. The activation journal's hashes, staged chain, key identities and active chain were verified before startup.

Initial startup source baseline: `daf2dbae7ff1bc229c0bbc012cb9bc89cb09a7e3`; engine tree: `d2e7f259a8110d7e25cfec6b66f679d075cfd72b`. The following table records the initial startup artifacts. The subsequent renderer repair is identified separately below; engine and native artifacts remain unchanged.

| Artifact | SHA-256 |
| --- | --- |
| Default CLI `engine/codex-rs/target/debug/codex.exe` | `ca75a2f119eb7c37741d37a293bdddf7c7056463c18fb938003896786f332fbe` |
| Default app-server `engine/codex-rs/target/debug/codex-app-server.exe` | `f2ec0ad1ed69be4603630642e2689a497451246fcf2abff163927d4d8858dcb7` |
| Default service `engine/codex-rs/target/debug/inquello-service.exe` | `a903ee2e273fb986504fd4600d88c868a315f1c11c822a45188b83efd60b0252` |
| Desktop dist, measured with the unchanged pilot validator | `c3312e1248fa0ac7c79a29564b745eae03864815a117846460a59457c1c50488` |

The version-2 matched manifest lives at `.tmp/epic1-live-acceptance-20261109/matched-build.json`. The historical November 3 scripts and delivery were neither overwritten nor launched.

## Verification

- **Passed before the renderer repair:** `node _bmad-output/implementation-artifacts/verification-2026-11-05/freeze-provider-recovery-final-20261107.cjs check` before build, after protocol generation and after startup: 11,036 measured files unchanged at the baseline. Generated protocol has no diff. This old freeze is historical and does not pass for the changed renderer source.
- **Passed:** offline native rebuild using installed Rust 1.99.1/MSVC and D-drive caches: `cargo build --offline --locked -j4 -p codex-cli --bin codex -p codex-app-server --bin codex-app-server -p inquello-service --bin inquello-service` (retry exited 0, 5m56s).
- **Passed:** `pnpm run generate:protocol`: 816 files, runtime version 0.165.0, matching engine tree. `pnpm run build`: production build succeeded. Existing unused-field/chunk-size warnings remain warnings.
- **Passed:** private disposable fixtures for identity/certificate mismatch refusal, expired-chain refusal, interrupted-activation refusal and restoration of operation-owned TLS/receipt files only, preserving unrelated fixture data.
- **Passed:** fresh preflight, unchanged pilot validator and normal same-profile `PILOT_READY`. Runner PID 12816 owns service PID 15152 and Electron PID 24384; matched app-server PID 18812 is directly owned by Electron. A real TLS handshake to the owned loopback service authenticated the activated server certificate. These establish current-build startup, not live inference.
- **Historical synthetic evidence only:** November 7's 2,265 passing tests (21 skipped) and 19 passing smoke reports were retained byte-for-byte and hash-bound to the unchanged measured source. ANSI escapes were normalized only while parsing the suite summary. No policy/provider qualification or new live-acceptance claim was manufactured.

Operation scripts and local evidence are under `.tmp/epic1-live-acceptance-20261109/`: native/protocol/desktop logs and results, `fixture-result.json`, `renewal-result.json`, `qualification.json` (artifact-parity evidence only), launch preflight, runner ownership, public runner output, `ready-evidence.json`, and `wrapper-fix-verification.json`. They contain no exported secret or keyring contents.

Preserved failures and resolutions:

1. The first native build exited 101 with service-linker LNK1104 opening `D:\Toolchains\tmp\lnk{…}.tmp`. A sandbox write probe was refused. The narrowly scoped installed-cache/toolchain retry passed the same temporary-directory probe and completed; its separate log/result preserves the failed attempt.
2. The first pnpm invocation was denied reading the installed Corepack pnpm cache, before generation. Its separate log/result was retained; an offline scoped retry passed.
3. An additional recursive ACL audit initially assumed current-user-only children and refused before backup/mutation. Inspection of `desktop/src/main/runtime/private-paths.ts` established the existing SYSTEM/Administrators grants. The operation audit was corrected to that policy; retained ACLs were untouched.
4. The hidden launch wrapper hit an unavailable `Get-FileHash` command after starting the runner. Exact executable, command line, parent and creation time conclusively identified the existing runner, so ownership was reconciled without a duplicate launch. The helper now computes the hash with .NET before launch; its syntax and hash result were verified using the installed Windows PowerShell. The original error remains recorded. Normal runner lifecycle/cleanup remains unchanged.

## UI and pending authorization

The coordinating agent inspected the actual ordinary app while signed out:

- Account showed **Signed out**, **Shared service available**, and OS credential-store sign-in storage.
- AI connections showed Claude **No key set** and OpenAI **Not connected**. This signed-out view does not establish whether the preserved principal's credentials remain available after sign-in.
- Models truthfully showed unavailable models, retained the selected choice, and disabled Save.
- Usage truthfully requested an open conversation.
- Back returned to chat. Keyboard Tab/Enter opened the organization menu, Down focused Settings, and Enter reopened Account with visible heading focus.

The user subsequently completed sign-in directly. Authenticated UI inspection confirmed the preserved account and workspace, shared service availability, connected OpenAI API-key storage in the OS keyring after explicit status refresh, and retained allowed OpenAI workspace consent. Models showed two independently active saved `gpt-6.1-terra` bindings rendered with indistinguishable names; this ambiguity is recorded separately, without modifying/deleting either binding. Account access was shown as unknown. Usage remained truthful about needing an open conversation.

Saved-work acceptance **failed** on the initial renderer: Chats remained empty with a partial unavailable-authority warning. An explicit saved-work search returned zero matches with unavailable-content coverage, not an authoritative empty result. Read-only aggregate metadata established that both saved real-tier tasks, threads and active binding revisions 1/2 still existed in the active store and new backup. There were zero Engagements in both. No conversation content or credential contents were read for diagnosis.

The likely immediate blocker is native read-session initialization: ordinary post-sign-in navigation only binds the principal; real-tier saved-task authorization needs a current native Task session. Per-task refusal becomes an `ok:true` partial tree, but the renderer offered its existing explicit recovery action only after a whole-tree failure or an unavailable already-open Task. With no open Task, recovery was unreachable. Downstream qualification/route checks remain enforced and were not claimed to have passed.

A harmless new unsent draft survived Account → Usage → Back and was removed afterward by the primary agent. No model was selected; Send stayed disabled. This establishes new unsent navigation continuity, not saved-history reopening.

## Scoped renderer repair — built, actual recovery pending

Under the existing approved Story 1.30, one condition was added in `desktop/src/renderer/Shell/Shell.tsx`: a partial successful tree with unavailable Tasks and no open Task sets the existing recoverable navigation notice. This exposes **Refresh workspace**, retaining authorized rows and drafts, withholding unavailable titles and performing no automatic recovery. It reuses existing fresh-authority recovery unchanged; no main/native/security/credential code changed.

Five added regression cases in `desktop/test/navigation-recovery-shell.test.tsx` cover keyboard recovery/fresh reads with permitted rows and an unsent draft, refused recovery, pending repeat-click suppression, and late identity/Workspace changes. All assert zero execution/mutation calls. Before the source fix, all five failed because Refresh workspace was absent; the existing four cases passed. Initial post-fix failures were preserved and diagnosed as fixture assumptions: Button intentionally retains its accessible name while busy, and the partial-home model picker adds a session subscriber that the old single-listener fixture replaced. The fixture now follows the existing busy-button and multi-subscriber preload contracts; denial/race/no-execution assertions were retained.

- **Passed:** the spec's seven focused suites, **90/90 tests**, 7/7 files, no skipped tests.
- **Passed:** offline `pnpm run build` including TypeScript/data-policy checks. The existing chunk-size warning remains.
- **Passed:** measured source comparison against the historical source manifest: exactly `Shell.tsx` and `navigation-recovery-shell.test.tsx` changed; engine source and all three native binary hashes remain unchanged.
- **Current desktop dist SHA-256:** `38c366a51be867a05c6043111afcf0117719981a84f39829132d4a64f2302af8`.
- **Current source manifest SHA-256:** `4abef56e4bfa72a0857512d0fa9013dbed4a8abddd9e419060081b32a23a36cc`.
- **Passed:** current-candidate artifact preflight. Its full retained-pilot mode truthfully refused the already running app/runtime, proving duplicate startup remains blocked. No close/relaunch occurred.

New local evidence under the same operation directory: `renderer-recovery-before.log`, retained intermediate after logs, `renderer-recovery-after-verified.log`, `renderer-recovery-build.log`, `renderer-recovery-source-manifest.json`, `renderer-recovery.diff`, `renderer-recovery-verification.json`, `matched-build-renderer-recovery.json` and `current-candidate-preflight-check.json`. Earlier manifests/logs were not relabeled.

The separate future resume path is `preflight-renderer-recovery.cjs` plus `resume-renderer-recovery.ps1`. It pins the new source/artifact/focused-build evidence, private retained receipt/TLS/database context and current idle ownership. The old `recover.cjs preflight`/initial wrapper still require historical artifacts and must not be reused for this candidate. The new wrapper was syntax-checked; a new launch was deliberately not performed while the healthy runner remains alive.

**Blocked on Windows input access:** the primary agent attempted normal renderer reload, but Ctrl+R could not activate the captured window, and Raise twice returned `GetCursorPos failed: Access is denied (0x80070005)`. No reload or recovery click succeeded. The user has been asked to unlock/reconnect the desktop and bring Inquello forward. Actual new-renderer recovery, any deeper refusal and saved-history reopening remain pending. The current app/runner remain alive. Credential Check, agent secret entry, paid model calls and external integration activation were not performed.

## Later on 2026-11-09: relaunch, actual recovery attempt and deeper refusal

The runner above had stopped cleanly at about 21:32 UTC (`PILOT_STOPPED`, retained, no cleanup errors), so "app/runner remain alive" was stale. The repaired candidate was relaunched once through `resume-renderer-recovery.ps1`; its preflight passed and `PILOT_READY` was reported for the same run and root (runner PID 23720, service PID 20508, Electron PID 18348). Evidence: `renderer-recovery-runner.{preflight.log,stdout.log,owner.json}`. The seven focused suites were re-run first: 90/90 passed.

**Failed (owner-observed):** after Refresh workspace in the actual app, the saved chats remained unavailable. The exact on-screen message was not captured.

**Diagnosis from source and build outputs (runtime refusal log not read):** saved real-tier Tasks are read through `authorize_task_metadata` → `authorize_run_route_disclosure` → `check_real_route` (Story 1.28 gate), which requires reviewed negative-authorization evidence whose identity equals the running build's measured identity. The register entry for `codex-responses` in `engine/codex-rs/inquello-domain/register/capabilities.json` carries `implementation_digest` `8823a541…c9a`, which is the 2026-11-03 18:34 native build. The native build running now (2026-11-09 20:34) embedded `INQUELLO_BEHAVIOR_DIGEST` `27f2bb76…c86`. The digest covers `engine/` and `desktop/` sources, so every source change since November 3 invalidates the evidence. The gate therefore refuses every real-tier saved read on this build with `route_unavailable`, and no session recovery can change that. This is the gate working as designed, not a recovery defect; it was not bypassed. Data policy digest, platform and runtime version still match.

Consequences: saved-history reopening on the current build is blocked on re-qualifying the current build under Story 1.28 (owner decision; may involve provider calls). The renderer repair is correct but, in this state, offers a Refresh action that cannot help; the notice does not distinguish "build not qualified for real data" from "session needs a fresh check". The spec stays `in-progress`; nothing was committed.

The specific live-call request will be recorded after the visible provider/model readiness is identified. It requires separate owner authorization. No paid prompt, real audit-data transmission, Private Task external integration, Epic completion, next epic, push, PR, merge or deployment is authorized by this recovery. Sprint statuses remain unchanged.
