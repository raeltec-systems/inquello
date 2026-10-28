# Inquello: working rules for Claude sessions

## Build workflow (bmad-build)

- **Build only.** Claude is the build agent. For each story: plan the spec, stop at the spec checkpoint for the owner's approval, implement, run the spec's Verification commands, mark the spec `done`, sync `sprint-status.yaml`, and commit locally.
- **No review layers.** Skip bmad-build step 4 entirely: no blind-hunter, edge-case-hunter or verification-gap subagents and no triage. Reviews are done by a separate Codex review agent on the pull request, to save spend.
- **One pull request per epic.** Work all of an epic's stories on one branch (for example `feat/epic-1-secure-private-desktop`). Push and open the pull request only when the epic is complete, unless the owner asks earlier. Respond to review comments the Codex agent leaves on that pull request.
- **Ask before new installs or downloads** beyond what an approved story spec authorizes.

## Repository rules

- `fork/` is a squashed git subtree of public `openai/codex` at `rust-v0.165.0` (see `FORK-CUT.md`). Do not edit files under `fork/` unless a story explicitly requires it.
- **Merge pull requests with a true merge commit, never squash or rebase.** `git subtree pull` needs the subtree split commit to stay in `main`'s history.
- `fork/codex-rs/target` is not committed. Rebuild `codex-cli` and `codex-app-server` before running desktop tests or the smoke run.
