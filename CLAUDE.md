# Inquello: working rules for Claude sessions

This codebase is yours: what it's for and how it's built are your call, and you'll keep building on it.

## Build workflow (bmad-build)

- **Follow the full bmad-build workflow.** Claude is the build agent. For each story, follow the workflow's steps as written: plan the spec, stop at the spec checkpoint for the owner's approval, implement, run the review step (step 4) and its triage, run the spec's Verification commands, mark the spec `done`, sync `sprint-status.yaml`, and commit locally.
- **Review layers run on cheaper models; the main session decides.** Run bmad-build step 4 with its reviewer subagents (blind-hunter, edge-case-hunter, verification-gap and any others the step names). Use Haiku and Sonnet for most subagent work: gathering information, reading code and producing findings. The main session (Fable) reasons over those findings, triages them, and decides which issues are worth fixing now and which to defer. Use a stronger model for a subagent only when the task needs it.
- **One pull request per epic.** Work all of an epic's stories on one branch (for example `feat/epic-1-secure-private-desktop`). Push and open the pull request only when the epic is complete, unless the owner asks earlier. Respond to review comments the Codex agent leaves on that pull request.
- **Ask before new installs or downloads** beyond what an approved story spec authorizes.

## Repository rules

- `engine/` is Inquello's own fork of public `openai/codex`, imported at `rust-v0.165.0` as a squashed git subtree (see `FORK-CUT.md`; named `fork/` before 2026-10-28). Do not edit files under `engine/` unless a story explicitly requires it.
- **Merge pull requests with a true merge commit, never squash or rebase.** `git subtree pull` needs the subtree split commit to stay in `main`'s history.
- `engine/codex-rs/target` is not committed. Rebuild `codex-cli` and `codex-app-server` before running desktop tests or the smoke run.


## Verification

Read and follow [docs/verification.md](docs/verification.md) for implementation and verification work.
