# Lessons from Epic 1

Read this before planning, implementing or verifying a story. Each item cost real time once. Verify a detail against the repository if it matters; this file records what was true on 2026-11-11.

## Before you design anything

- **Ask how Codex already does it.** `engine/` is a fork of Codex, which already reads files, runs tools in a sandbox, attaches images and loads skills. The first Story 2.1 draft specified hand-written document parsers before anyone had checked what the engine and the sandbox guest already provide. Find the existing mechanism, reuse it, then add what an auditor needs on top.
- **Design for the auditor, from the research.** The domain research on the internal audit lifecycle and the glossary say how auditors handle evidence, references and review. Read them before specifying a feature.

## Before you run anything

- **Environment.** In PowerShell, dot-source `.tmp/story121-env.ps1` from the repository root. It sets the toolchain paths, `CARGO_INCREMENTAL=0` and the test database URL. Add `D:\Toolchains\cargo\bin` to `PATH`, and set `COREPACK_ENABLE_NETWORK=0` and `ELECTRON_SKIP_BINARY_DOWNLOAD=1`. Work offline with `--offline --locked -j4`.
- **Check the sandbox first.** The Linux sandbox refuses to start when D: has under 32 GiB free ("WSL storage needs at least 32 GiB free on D:") or when the WSL virtual machine has restarted since its storage proof was sealed ("WSL boot changed; active D-drive swap must be proven again"). Either one fails the same five test files (`permissions-integration`, `tool-bounds-integration`, `policy-integration`, `wsl-backend-integration`, `wsl-data-integration`) and the seeded smoke, often as "Local sandbox unavailable on this device" or as timeouts. Check both before blaming code or machine load. Renewing the proof uses `desktop/scripts/wsl/seal-live-storage-proof.ps1` and replaces a file under `D:\Inquello\backups`, so it needs the owner's go-ahead.
- **The WSL machine is shared with Docker** and other projects' containers. Do not stop or restart them.
- **Close the Inquello app** before native builds or the smoke: Windows locks the binaries it runs.

## Builds and binaries

- **A fixtures build overwrites the default app-server binary.** After `--features inference-fixtures`, copy the fixtures binary somewhere else and rebuild the default `codex-cli`, `codex-app-server` and `inquello-service` before any desktop test or smoke.
- **Fixture suites need `INQUELLO_FIXTURE_APP_SERVER_BIN`.** `inquello_authorization_runtime`, and the quota and visual smoke phases, fail at once without it. `story121-env.ps1` does not set it.
- **`inquello_messages_runtime` is Linux-only.** On Windows it compiles to zero tests and reports "ok". Run it in the `Inquello-Engine` guest: freeze source with `desktop/scripts/wsl/freeze-source.py`, stage with `stage-source.py` (then restore `/opt/inquello/build/sources/selected-source`), wait for the guest's own initializer before the isolation guard, and put the built `bwrap` beside the fixtures binary.
- **Any change under `engine/` or `desktop/`, including `desktop/data-policy.json`, changes the build digest** that real-data qualification evidence is bound to. Re-qualify once, on the pilot release candidate, not per story.

## Tests

- **Two type checks.** `pnpm run build` does not type-check tests. Run `pnpm exec tsc -p tsconfig.json --noEmit` as well; it regressed to 55 errors once without anyone noticing.
- **Never change the working tree while a suite is running.** That includes `git stash`. Run "does the new test fail on old code" checks before or after, not during.
- **A healthy full desktop suite takes about 7 minutes.** Much longer means the sandbox is degraded.
- **A regression test must fail on the old code.** Prove it once, then restore.
- **Tests that only match source text prove nothing about behaviour.** Prefer a behavioural test.

## The seeded smoke and Electron probes

- **Credential-shaped environment variables make the onboarding gate refuse.** Remove any variable ending in `_TOKEN`, `_API_KEY` or `_SECRET` that names CLAUDE, ANTHROPIC, OPENAI, CODEX or CHATGPT before `run-seeded-smoke.cjs --onboarding`. A refused gate leaves Electron open until a ten-minute deadline.
- **The launcher starts Electron hidden.** A probe that needs real key events, focus rings or screenshots must show and focus its window explicitly.
- **Probes hide their errors.** They record only the failing stage. When one fails, capture the actual error before guessing; when writing a new probe, record a short cause.
- **Wait for settled state.** Controls briefly show a "busy" reason while a failed request settles; a probe that checks once will flake.

## Specifying and recording

- **Read the product's actual behaviour before specifying a test of it.** A spec assumed a pending request stays until the user acts; the app reconciles it automatically on every state read, so two approved test rows were impossible.
- **Check before you write that something does not exist.** A record said the onboarding journey was "unwritten"; it existed under a different name.
- **Unchecked task boxes and tracker notes go stale.** Write results back into the spec the same day, with the commit and what was not run. Treat old "unrun" text as a claim to verify.
- **Distinguish passed, failed, blocked and not run.** "Zero tests ran" is not a pass.

## Code and repository habits

- **Many files are written as long, dense single lines.** Keep that style and make minimal edits.
- **Commit only your own changes.** The working tree often holds the owner's uncommitted planning edits.
- **The renderer cannot import main-process constants.** User-facing strings are duplicated between main, renderer and probes; change them together.
- **Desktop has zero runtime npm dependencies.** Adding one is an owner decision. Node built-ins (`zlib`, `crypto`, `fs`) cover a lot.

## Review and the pull request

- **Codex reviews automatically** when a pull request is marked ready or on a comment "@codex review". Reply to an inline finding through the review-comment replies API.
- **Findings from reviewer agents are claims.** Verify each against the code; about a third were false in Epic 1's passes.
- **A reviewer agent that fails to return its report twice** should be re-run on the next model up.
