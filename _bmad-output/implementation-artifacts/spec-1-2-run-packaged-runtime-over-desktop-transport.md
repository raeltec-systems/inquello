---
title: 'Story 1.2: Run the packaged runtime over a bounded desktop transport'
type: 'feature'
created: '2026-10-28'
status: 'done'
route: 'dispatch'
review_loop_iteration: 0
baseline_commit: 'dba4441837427c5fb4b8d2a330f1dc7a3930636c'
context:
  - '{project-root}/_bmad-output/implementation-artifacts/epic-1-context.md'
  - '{project-root}/FORK-CUT.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** The fork builds, but no Inquello desktop exists to run it. Later stories need a main-process client that starts `codex-app-server`, completes the protocol handshake and stops it without corrupting the protocol stream.

**Approach:** Create `desktop/`, an Electron 45 TypeScript app whose main process owns `codex-app-server` as a stdio child with newline-delimited JSON-RPC, the `initialize`/`initialized` handshake, and explicit backpressure, disconnect and shutdown handling. Generate protocol types from the cut, stamp their version, and refuse a mismatched runtime. Enable only stdio and record the upstream "experimental" wording as bootstrap transport evidence.

**Owner authorization (2026-10-28):** install Electron 45.0.0, TypeScript 5.9.2 and needed dev/test packages into `desktop/`, with Electron and package caches on D:.

## Boundaries & Constraints

**Always:** Spawn with `--listen stdio://` only. Never parse stderr as protocol. No `jsonrpc` field. Fail closed on schema/runtime version mismatch. Report disconnects with exit code and recent stderr; no silent restart. Pin exact dependency versions. Keep caches on D:.

**Never:** No edits under `fork/`. No WebSocket or unix listener, even disabled-by-default code paths. No preload bridge, IPC, React or renderer features (Stories 1.3+). No installer build. No login, credentials or model calls; `initialize` needs none.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Handshake | Runtime starts | `initialize` result received, `initialized` sent, state `ready` | N/A |
| Request before ready | Caller sends a request while `starting` | Rejected locally with not-ready error | Never forwarded |
| Version mismatch | `userAgent` version differs from schema stamp | State `failed`, runtime stopped | Error names both versions |
| Slow writer | `stdin.write()` returns false | Further writes wait for `drain`; bounded outbound queue | Queue full rejects new requests |
| Overloaded | Server returns error `-32001` | Pending request rejected with overload error | No automatic retry |
| Oversized or bad line | Line over 64 MiB, or invalid JSON | Bad JSON logged and skipped; oversize fails the connection | Runtime stopped, state `failed` |
| Server request | Server sends a request (e.g. approval) | Answered with error `-32601` | Never left unanswered |
| Unexpected exit | Child exits while `ready` | All pending rejected; state `disconnected` with exit code and last stderr lines | No restart |
| Graceful stop | App quits | stdin closed; exit awaited | Killed after 10 s grace |
| Stderr noise | Child writes logs to stderr | Captured to a bounded buffer and a log file | Never reaches the parser |

</frozen-after-approval>

## Code Map

All under `fork/codex-rs/` unless noted; read-only.
- `app-server-protocol/src/rpc.rs` -- Request `{id,method,params?}`, Notification, Response `{id,result}`, Error `{id,error:{code,message}}`.
- `app-server-protocol/src/protocol/v1.rs:27-84` -- `initialize` params `{clientInfo:{name,title,version}}`; result `{userAgent,codexHome,platformFamily,platformOs}`.
- `app-server-transport/src/transport/{stdio,mod}.rs` -- stdin EOF is the only shutdown signal, no Windows watchdog; `-32001` overload.
- `app-server/src/lib.rs:728-745` -- logs on stderr, `RUST_LOG`.
- `codex.exe app-server generate-ts -o DIR` -- schema output, no version stamp.
- `fork/sdk/python/src/openai_codex/client.py` -- reference `start`/`initialize`/`close`.
- Experimental wording: `cli/src/main.rs:176`, `app-server-daemon/README.md:3`, and the upstream docs cited in the architecture technology evidence.

## Tasks & Acceptance

**Execution:**
- [x] `desktop/package.json`, lockfile, `tsconfig.json`, `vitest.config.ts` -- standalone pnpm project; exact pins electron 45.0.0, typescript 5.9.2, vitest 5.0.5, @types/node 24.19.2; `pnpm.onlyBuiltDependencies: ["electron"]`; scripts `build`, `test`, `generate:protocol`, `smoke`
- [x] `desktop/scripts/generate-protocol.mjs` -- `generate-ts` into `src/protocol/generated/` plus `schema-stamp.json` (runtime version, fork tree hash)
- [x] `desktop/src/main/runtime/` -- binary resolver (dev target, packaged `process.resourcesPath`, override `INQUELLO_APP_SERVER`), line framing, RPC client, process owner with states `starting/initializing/ready/stopping/stopped/disconnected/failed` -- AC 1.2.1
- [x] `desktop/src/main/main.ts`, `desktop/static/index.html` -- start runtime on `ready`, stop on `before-quit`; one window with `contextIsolation`, `sandbox`, no `nodeIntegration`, no preload; `--smoke` prints the handshake and quits
- [x] `desktop/transport-evidence.json` -- stdio enabled, WebSocket and unix disabled, upstream wording with citation, `productionEligibility: false` -- AC 1.2.2
- [x] `desktop/test/` -- matrix tests against a fake Node child; integration test against the real binary with a temp `CODEX_HOME`
- [x] `_bmad-output/implementation-artifacts/sprint-status.yaml` -- advance story 1-2

**Acceptance Criteria:**
- Given the built fork, when `pnpm smoke` runs, then Electron starts, the handshake completes, the version check passes and the runtime exits 0 after quit.
- Given a fresh `generate:protocol`, when compared with the committed schema, then nothing differs.

## Implementation Notes

- **Extra pinned dev dependency:** `vite 8.3.5`, a required (non-optional) peer of `vitest 5.0.5`, so it is pinned explicitly instead of auto-installed.
- **Electron download on install:** Electron 45 has no install hook of its own and downloads lazily on first use into a C: cache. `desktop/scripts/install-electron.mjs` runs as the project `postinstall` and calls Electron's `install.js` with `electron_config_cache` (from `desktop/.npmrc`, which pnpm exposes as `npm_config_electron_config_cache`) and TMP/TEMP pointed at `D:/Toolchains/electron-cache`. `desktop/.npmrc` also sets the pnpm store and cache to D:. `pnpm.onlyBuiltDependencies: ["electron"]` is kept as specified, though Electron 45 declares no install script.
- **Typecheck vs build config:** `tsconfig.json` (used by `tsc --noEmit`, covers `src`, `test`, `vitest.config.ts`) uses `module: preserve`/`bundler` so ESM-only vitest imports and the extensionless imports in generated files typecheck; `tsconfig.build.json` emits CommonJS (`node10`) for the Electron main process into `dist/`.
- **Stamp:** `src/protocol/schema-stamp.json` holds `runtimeVersion` (from `codex-app-server --version`, which must equal `codex --version`), `forkTreeHash` (`git rev-parse HEAD:fork`; the script refuses a dirty `fork/`), and a SHA-256 over the generated files. `desktop/.gitattributes` pins `src/protocol/**` to LF so regeneration is byte-identical under `core.autocrlf=true`.
- **States:** a new runtime reports `stopped` before `start()`; each instance starts once (no restart path). A child exit before `ready` ends in `failed` (handshake error naming exit code and stderr tail); after `ready` it ends in `disconnected`. The handshake is bounded (30 s default) in addition to the 10 s stop grace; both are configurable.
- **Queue bound:** requests and notifications are rejected when 1024 (configurable) messages wait for `drain`. `-32601` replies to server requests bypass the bound so none is left unanswered.
- **Smoke:** uses a fresh temp `CODEX_HOME` (removed after the runtime exits) and a fixed, reused temp Electron profile (`inquello-smoke-user-data`), because Chromium holds the profile open until the process ends.

## Spec Change Log

## Review Triage Log

Pass 1 (2026-10-28). Layers: verification-gap (VG), blind-hunter (BH), edge-case-hunter (EC). No intent_gap or bad_spec entries.

| Finding | Verdict | Evidence | Route |
|---|---|---|---|
| BH-1 / EC-1 / VG-4 `start()` sets `initializing` unconditionally after `await spawned` | medium | `process.ts` start: a `stop()` or handshake timeout during `starting` is overwritten; `initialize` goes to ended stdin and the run ends `failed` with a wrong error. | patch P1 |
| BH-2 / EC-2 `StderrCapture` (sync `mkdirSync`) built after spawn, outside the try | low | A throw there leaves the spawned child unowned and state `starting`; direct reorder fixes it. | patch P2 |
| BH-8 / EC-7 throwing `onNotification` or `state` listener escapes the stdout handler | medium | Callbacks run inside `handleChunk`/`setState` with no try/catch; remaining lines in the chunk are lost. | patch P3 |
| EC-5 / EC-16 / BH-16 state decided after the 250 ms stderr settle | low | `handleExit` reads `currentState` after `await settle`; a `stop()` in that window turns a crash into `stopped` and `request()` reports "not ready (state: ready)". | patch P4 |
| VG-1 self-termination in `fail()` never observed | medium | Pre-verified: version-mismatch and oversize tests call `stop()` themselves. | patch P5 |
| VG-2 handshake timeout untested | medium | Pre-verified: no test delays `initialize` past the deadline. | patch P5 |
| BH-6a stamp tree hash never compared with `HEAD:fork`; BH-5 test hash normalises CRLF | low | Schema test checks format only and hashes CRLF-normalised text while the generator hashes raw bytes. | patch P6 |
| BH-14 / EC-14 generator version regex rejects `+build` metadata the runtime accepts | low | Two grammars for one version; one-group fix. | patch P7 |
| BH-11b `MAX_PARTIAL_BYTES` compares characters | low | Name says bytes, comparison uses string length. | patch P8 |
| BH-4 / EC-13 version check is semver only; stale binary can be stamped with current tree | medium | Later fork patches need not bump 0.165.0; a real build identity needs a `fork/` change, forbidden here. | defer D4 |
| BH-10 / EC-4 Windows `child.kill()` ends only the direct process | medium | No grandchildren exist until tools or MCP servers run in later stories. | defer D5 |
| VG-3 generator dirty-fork and version-equality guards untested | medium | Pre-verified; needs git and binary fixtures. | defer D6 |
| BH-3 listens for `exit`, not `close` | low | Stdout data still flows during the settle window; only output later than 250 ms after exit is lost; fix adds a second wait. | reject |
| BH-6b no automated smoke or AC 2 regeneration test | low | Both are spec Verification commands and were run by the orchestrator: smoke exit 0, regeneration 0 differences. | reject |
| BH-7 / EC-9 queue bounded by count; `-32601` bypass unbounded | low | Child is the trusted bundled runtime; flooding requests while not reading stdin is not upstream behaviour; fix adds a second bound. | reject |
| EC-15 queued `-32601` replies dropped by `discardQueued`/`close` | false | Only reachable after stdin EOF, when upstream is tearing down and awaits no reply. | reject |
| BH-9 disconnect report only on console | low | No packaged build exists in this story; the state event carries the report for later UI. | reject |
| BH-11a stderr log file not rotated | low | Default log level is quiet; rotation adds machinery; buffer is bounded as specified. | reject |
| BH-12 committed `.npmrc` pins `D:/Toolchains` | low | One development machine and no CI exist; fix changes setup. Revisit with a second machine or CI. | reject |
| BH-13 / EC-12 non-atomic schema swap, staging left on crash | low | Developer-run script; recoverable with `git checkout`; fix adds backup logic. | reject |
| BH-15 / EC-6 no per-request timeout or cancellation | low | No callers beyond the handshake yet; adding API surface belongs with the first caller. | reject |
| BH-17 spec status and `-o`/`--out` mismatch | low | Fix edits this build's spec. | reject |
| BH-18 integration test throws when the fork is unbuilt | false | Loud `BinaryNotFoundError` naming the build command is correct behaviour; the fork is in this repo. | reject |
| EC-3 / EC-17 no SIGKILL escalation | false | Upstream handles SIGTERM with a 45 s exit watchdog on Unix; Windows `kill` terminates the process. | reject |
| EC-8 malformed error body leaves request pending | low | Upstream error shape always has numeric `code` and string `message`. | reject |
| EC-10 CRLF line at exactly 64 MiB rejected | low | Edge at the limit only; upstream writes LF. | reject |
| EC-11 stderr writes after log `close()` | low | Needs a grandchild holding stderr; none exist yet. | reject |

## Design Notes

**Version check:** the stamp supplies the schema version; the runtime version is parsed from `userAgent` (`…/0.165.0 (…)`). Unparseable counts as mismatch.

**10 s grace:** Windows has no upstream teardown deadline, so the client bounds it; configurable.

**"Packaged":** the resolver handles the packaged resources path; installer building belongs to the spine's packaging gate.

## Verification

**Commands (in `desktop/`, D: caches per FORK-CUT.md):**
- `pnpm install --frozen-lockfile` -- expected: success, Electron binary cached on D:
- `pnpm exec tsc --noEmit` -- expected: no errors
- `pnpm test` -- expected: all matrix and integration tests pass
- `pnpm smoke` -- expected: handshake JSON printed, exit 0
- `pnpm generate:protocol; git status --porcelain src/protocol` -- expected: empty
