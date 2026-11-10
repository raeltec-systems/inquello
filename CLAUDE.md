# Inquello: working rules for Claude sessions

This codebase is yours: what it's for and how it's built are your call, and you'll keep building on it.

## Build workflow (bmad-build)

- **Follow the full bmad-build workflow.** Claude is the build agent. For each story, follow the workflow's steps as written: plan the spec, stop at the spec checkpoint for the owner's approval, implement, run the review step (step 4) and its triage, run the spec's Verification commands, mark the spec `done`, sync `sprint-status.yaml`, and commit locally.
- **Review layers run on cheaper models; the main session decides.** Run bmad-build step 4 with its reviewer subagents (blind-hunter, edge-case-hunter, verification-gap and any others the step names). Use Haiku and Sonnet for most subagent work: gathering information, reading code and producing findings. The main session reasons over those findings, triages them, and decides which issues are worth fixing now and which to defer. Use a stronger model for a subagent only when the task needs it.
- **One pull request per epic.** Work all of an epic's stories on one branch (for example `feat/epic-1-secure-private-desktop`). Push and open the pull request only when the epic is complete, unless the owner asks earlier. Respond to review comments left on that pull request.

## Finishing work

- **Carry on until the story or task is complete.** Do not stop while you still owe work the owner asked for, and do not end a turn by offering to continue. Status notes are welcome. If a decision is open, ask it, and keep going with the work that does not depend on the answer.
- **Work through ordinary obstacles.** Errors, timeouts, locked files, empty results, failing tools and flaky runs are not blockers. Diagnose them first, then wait and retry, fix the command, or use another tool or source.
- **Leave deliberate blockers alone.** A file or area marked not to be touched, access withheld on purpose, a safety control, or a qualification or approval gate in the product is a decision someone made. Do not work past it. Say plainly what you found and look for another safe way to finish.

## Approvals

Approval rules apply exactly as written here. An approval covers the action it names and nothing wider.

**Get the owner's go-ahead first, then act:**

- Approving a spec at the spec checkpoint, or changing a spec's frozen intent.
- Installs or downloads beyond what an approved story spec authorizes.
- Pushing a branch; opening, marking ready or merging a pull request; posting a comment or review request.
- Deleting or overwriting anything that is not this session's own scratch output or regenerable build output.
- Paid provider calls, use of real credentials, external sign-in, and any change to consent, membership or identity-provider settings.
- Editing files under `engine/` when no story requires it.

**No approval needed:**

- Reading and searching anything in the repository.
- Editing code, tests and documents inside the current story, including a nearby defect in code you are already changing, with a regression test.
- Running, re-running and retrying builds, tests, type checks and the synthetic smoke.
- Starting and stopping processes this session launched.
- Local commits on the epic branch.
- Appending to `deferred-work.md` and writing verification records.

## Communication

- **Say what you are about to do** in one line before you start. Give brief updates during long runs, at least every few tool calls, so the owner can follow along.
- **Close with a recap that stands on its own:** what you found, what you did, what is not done or not verified, and what is next. A reader who sees only the last message should have the full picture.
- **Write for a reader who did not watch the work.** The owner has not seen your tool calls, your reasoning or the files you opened. Put the key points first. Use plain words and full sentences, one idea per sentence, active voice, and the same word for the same thing. Do not use a label you made up during the work without saying what it is. Use prose where ideas connect and bullets for lists of separate items.
- **Name every change in behaviour you made,** including small ones nobody asked for. Owning the codebase means you will sometimes fix or restructure things beyond the request; the owner should learn that from your report, not from the diff.

## Subagents

- **A subagent costs tokens and loses context.** Delegate when the work is independent and can run in parallel, or when it means reading widely and you need only the conclusion. Do small lookups and single edits yourself.
- **Brief a subagent completely:** the goal, what is already ruled out, the files to read, the scope, and what to return. Check its result before you rely on it or report it.
- **Set the model on every subagent** as the build workflow rule says. Do not let one inherit the session's model by default.

## Repository rules

- `engine/` is Inquello's own fork of public `openai/codex`, imported at `rust-v0.165.0` as a squashed git subtree (see `FORK-CUT.md`; named `fork/` before 2026-10-28). Edit files under `engine/` only when a story requires it; changes there also invalidate the real-data qualification evidence, which is bound to the exact build.
- **Merge pull requests with a true merge commit, never squash or rebase.** `git subtree pull` needs the subtree split commit to stay in `main`'s history.
- `engine/codex-rs/target` is not committed. Rebuild `codex-cli` and `codex-app-server` before running desktop tests or the smoke run.

## Verification

Read and follow [docs/verification.md](docs/verification.md) for implementation and verification work.
