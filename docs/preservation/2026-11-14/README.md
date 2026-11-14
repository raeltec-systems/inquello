# Worktree preservation checkpoint — 14 November 2026

The owner requested committing and pushing useful work before deleting `D:\Projects\inquello` to recover disk space. This is a preservation checkpoint, not a new implementation, test run, release or acceptance decision.

## Current work

The inspected branch was `feat/epic-2-evidence-and-methods` at `9384cb8703dbbea0b5938697f3a13263f0f6e6fe`. It already includes the later Epic 1 fixes, Story 2.1 work and development-mode work. Preserve that newer history; the November 9 conversation and recovery notes are historical and must not be used to roll it back.

This checkpoint also records previously uncommitted planning/research updates, local working instructions, handoffs and verification material. Existing status and verification claims retain their original scope and dates. No statuses were promoted and no new provider call or verification run was performed for this preservation task.

## Material outside Git

A private backup is being verified at:

`C:\Users\Administrator\Inquello-Preservation\2026-11-14-checkpoint`

It is outside the worktree and on a different drive. Consult its `PRESERVATION-RESULT.json` for final commit/remote verification, artifact hashes and completed backup checks before deleting the checkout.

- `repository.git/` preserves the Git metadata and object store, including local recovery branches, reflogs and the existing stash. Normal branch pushes do not preserve all of these local references.
- `local-working-material.zip` preserves useful ignored source patches, operation scripts, logs, screenshots and local working documents. Its manifest records original paths and SHA-256 values; every archived member is verified. Credential-pattern-bearing fixture helpers are retained only in this private backup, not newly published to GitHub.
- Dependencies, compiler outputs, caches, disposable test databases and generated private fixture keys are excluded from the working-material archive. They are rebuildable rather than unique project work. No OS keyring was exported.

The known retained application profile and private backup are separately located at `D:\Inquello\tmp\inquello-auth0-pilot-20261102` and `D:\Inquello\backups\pilot-live-acceptance-20261109`; deleting only `D:\Projects\inquello` does not delete those locations. They are not uploaded to Git. Any application still using executables inside the checkout must be closed before the checkout is removed.

## Historical pilot helpers

`retained-pilot-helpers/` contains exact copies of the nonsecret top-level scripts, manifests, results and logs from `.tmp/epic1-live-acceptance-20261109/`. These are preservation artifacts tied to their recorded source/build identities, not qualification of the newer Epic 2 build or instructions to run an old launcher blindly. Existing handoffs describe the real-data authorization refusal and incomplete acceptance. Private fixture directories and key material were not copied here.

## Continuing work

Clone `https://github.com/raeltec-systems/inquello.git` and select `feat/epic-2-evidence-and-methods`. Use the final remote commit recorded in the external preservation result. Read the latest story specs, verification notes and `AGENTS.md`; do not treat historical synthetic passes as live-provider acceptance. Reinstalling or downloading dependencies still requires applicable authorization, and real paid inference remains separately authorized.

The external Git backup provides recovery for local-only references and the stash. The ZIP can recover individual ignored files by their original relative paths; inspect them before restoring anything over newer work or live profiles. Keep the external backup until the replacement checkout and needed local-only material are verified.
