# Guest runtime activation plan

Status: **not performed; pending successful build and permission assessment**.

Prepared 2026-11-05 from read-only inspection. This is a plan, not passing acceptance evidence. No runtime installation, tests, permission/configuration changes, process stops or downloads were performed by this reviewer.

## Scope and build preconditions

- Repository: D:\Projects\inquello. Dedicated distro: Inquello-Engine.
- Current owned offline build output: /opt/inquello/build/offline-20261105-1752.
- Required frozen source SHA-256: 9e8f47c61315ccf013a4fbb0616418de2d5c7de69c731ce1e855eff8ce4deeb3.
- Wait for the build owner to report successful completion and its exact receipt and binary paths. Independently verify all three binaries are regular nonsymlink files and hash-match that successful receipt; verify source identity, locked dependency identity and completed build provenance.
- Confirm broker/executor payloads match the frozen source, or explicitly reconcile differences before installing. The stock installer takes those scripts from the current host checkout.
- Recheck D-only storage, available capacity, live storage proof and owned workload activity before activation. Do not change shared WSL settings, Docker, distro defaults, swap, mounts or networking.

## Old-path hazards

The checked-in desktop/scripts/wsl/install-runtime.py reads /opt/inquello/build/target/debug/{codex,codex-linux-sandbox,bwrap} and /opt/inquello/build/build-receipt.json. These do not select the new owned offline output. At inspection the default receipt still identified old source a28e505af109663b578cffbfb40ea182821ffafeadacfbc0241687a05cd28ceb.

Do not run the installer unchanged. Prepare a reviewed in-memory adaptation selecting the new build's exact output and receipt, asserting exact replacement counts. Do not overwrite default build files just to satisfy hardcoded paths.

probe-sandbox.sh also selects /opt/inquello/build/target/debug and would test old helpers unchanged. test-guest.sh uses the old target and lacks Cargo --offline. Its execution requires a separately coordinated offline, locked test plan.

## Exact mutation inventory

The installer launches root in Inquello-Engine using a clean environment and stdin payload, with host temporary working directory D:\Inquello\tmp and no host-drive mounts.

| Target | Intended result |
| --- | --- |
| /opt/inquello/runtime/bin/codex | Replace, root-owned, mode 0555 |
| /opt/inquello/runtime/bin/codex-linux-sandbox | Replace, root-owned, mode 0555 |
| /opt/inquello/runtime/bin/bwrap | Replace, root-owned, mode 0555 |
| /usr/local/libexec/inquello-broker.py | Replace from normalized host script, root-owned, mode 0555 |
| /usr/local/libexec/inquello-executor | Replace from normalized host script, root-owned, mode 0555 |
| /opt/inquello/runtime/manifest.json | Replace, root-owned, mode 0444, component hashes and source identity |
| /opt/inquello/runtime and /opt/inquello/runtime/bin | Create if absent; validate root ownership and directory type; reapply 0755 |
| /usr/local/libexec | Create if absent; reapply 0755 and validate root ownership/directory type |
| /var/lib/inquello/tasks, locks, transfers, executor | Create if absent; reject symlinks; apply owner 1000:1000 and mode 0700, nonrecursively |
| D:\Inquello\runtime\build-receipt.json | Replace after successful guest installation |

Sibling .new files are exclusively created before individual replacements. Existing collisions cause failure and require inspection, not blind deletion.

Live inspection found the target files/directories already at the listed ownership and modes, with no symlinks. /var/lib/inquello itself was 1000:1000 mode 0700. Host receipt and guest manifest matched the old source identity.

## Atomicity, concurrency and risk

The stock installer is not an all-or-nothing transaction. Each file rename is individually atomic, but binaries are replaced before their digest is checked against the receipt. It has no runtime-wide lock, quiescence, automatic rollback or directory fsync. A mismatch, interruption, stale staging collision, later script failure or host-receipt failure can leave a partial or mixed runtime.

The broker checks the manifest and component digests/ownership before accepting new operations; mismatches should refuse execution. This is not a substitute for controlled activation. Existing executables may retain old mappings while new invocations load new files.

At approximately 18:03 UTC the guest process list contained only WSL init/transport, the owned build shell/Cargo/rustc processes and inspection processes. No codex/broker workload was present. This is a snapshot and must be checked again before activation. Do not interrupt the active build.

No distro restart is inherently required. Within applicable authorization, quiesce only identified Inquello app/executor workloads and prevent new starts during installation and verification. Never use wsl --shutdown, terminate Docker, unregister the distro or perform a shared restart for this step.

## Backup and activation sequence

1. Establish the successful current-source build and independently validate all input hashes before any live replacement.
2. Reconcile the existing approved implementation scope with the exact action and current metadata. A source-matched update of this existing project runtime with unchanged effective permissions/access and no new terms does not automatically require renewed confirmation. Ask only for an uncovered action, changed effective security setting or materially expanded access. Confirm authority for any necessary scoped workload stop and for the selected tests.
3. Confirm storage proof and free space; quiesce only owned Inquello workloads.
4. Create a unique backup under D:\Inquello\backups containing the five old components, guest manifest and host receipt, with hashes, mode/owner metadata and the four state-directory metadata records. Stream guest files over stdio, without host mounts. Verify backup contents. No Task-content or whole-VHD copy is needed for these listed changes.
5. Review and execute only the narrowly adapted installer after every new component has been prevalidated. Keep launches quiescent across the entire per-file replacement sequence.
6. Independently re-read all installed hashes, ownership, modes, guest manifest and host receipt. Require exact agreement with the successful current-source build and approved script payloads.
7. Resume only after these checks succeed, then run authorized runtime validation. An installation success alone does not pass acceptance.

## Recovery

If any step fails, keep the runtime unavailable and inspect the actual outcome before retrying. Do not blindly rerun or remove unexplained .new files. While still quiescent, deliberately restore the complete backed-up component set, manifest and host receipt, preserving verified modes/ownership; restore state-directory metadata if it changed. Re-read hashes and metadata before resuming. Backup/rollback must not alter Task contents, disable blocked bindings or weaken sandbox checks.

## Required validation

- Recheck current boot identity, D-backed VHD/swap/temp and free space, forbidden mounts, interop and clean transport. Stale storage proof is not sufficient.
- Run the early sandbox proof against the new owned output or installed helpers, never the old default path. Confirm inside-Task success, outside/cross-Task and symlink denial, read-only enforcement, hidden host/control paths, no privilege escalation, direct network denial and later permitted execution.
- Run probe-executor.py and probe-runtime-matrix.py against the installed runtime and current storage proof. They use synthetic data without model/provider calls.
- Coordinate offline locked sandbox/exec-server regression suites without competing builds or silently fetching missing dependencies.
- Complete actual Windows/guest acceptance: current guest command-rule resolution, authorization, network bypass, transfer/export/delete, descendant cancellation, restart/storage, mode transitions and desktop integration.
- The current verification prerequisite document requires 18 seeded smoke reports; older README/design counts of 13 or 16 are stale. Full acceptance remains separate from successful installation.

## Permission assessment and correction

The earlier blanket recommendation to ask again for installation was overbroad. Privileged execution or repeating chmod/chown calls is not by itself a new effective security-setting change.

Exact checked-in approval evidence:
- spec-1-21-wsl-execution-backend.md:15 marks the intent frozen after approval on 2026-10-30.
- Same spec:29: "Approval permits the bounded download/install inventory in the design note. No model runs, unrelated installs, broad Windows read grants, LPAC fallback or review subagents."
- Same spec:63: "Windows and guest: rebuild required CLI/app-server/sandbox helpers separately from service; `CARGO_INCREMENTAL=0`, `-j 4`, locked dependencies."
- Same spec:70: "Owner approved this spec and continuing implementation, reiterating D-drive placement for all temp, caches, swap and VM storage."
- handoff/WSL-BACKEND-DESIGN.md:73: "Build the fork's Linux CLI, exec-server path and bundled bubblewrap." The same paragraph excludes Docker image pulls, new Windows WSL/kernel installation or update, unrelated packages, model downloads and dependency-version changes.
- Spec:28 preserves distributions/defaults and separately previews global WSL changes/shared restarts. None is required here.

These project records corroborate the approved implementation scope; they are not independent new user authorization. The coordinating parent reports the user's instruction to ask before installs/downloads NOT covered by the approved spec. Subject to the parent checking that actual conversation authority and any later restrictions, updating the existing source-matched project runtime is within that implementation scope rather than an unrelated install.

Current live metadata versus installer effects:
- All three existing binaries and both scripts are root:root 0555; the replacement files use root ownership and 0555.
- Existing manifest is root:root 0444; replacement uses root ownership and 0444.
- Runtime, bin and /usr/local/libexec are root:root 0755; chmod reapplies 0755.
- tasks, locks, transfers and executor are 1000:1000 0700; chown/chmod reapplies those exact values nonrecursively.
- No listed path was a symlink. No new account, credential, persistent access grant, network rule, mount, WSL setting or host privilege is created by this installer.

Thus the inspected installation does not change effective filesystem permissions or ownership and does not itself materially expand access. This does not assert that any unreviewed payload is safe: source matching, receipt verification and the intended runtime changes must still be checked. Recheck immediately before execution; unexpected metadata, new targets, payload differences or access changes invalidate this assessment.

No blanket install confirmation is necessary solely because these existing protected files are being updated. If an uncovered interruption is needed, ask narrowly, for example: "May I briefly stop the Inquello app and its active tasks to replace the guest runtime? Docker and other WSL workloads will keep running." A new effective security-setting change requires its own action-time confirmation explaining the exact change. If no such change or uncovered action exists, proceed only within the already verified authorization after successful build verification.

## Sources

- desktop/scripts/wsl/install-runtime.py, build-guest.sh, run-guest.py, guest-broker.py, guest-executor.sh, probe-sandbox.sh, probe-executor.py, probe-runtime-matrix.py and test-guest.sh.
- _bmad-output/implementation-artifacts/spec-1-21-wsl-execution-backend.md.
- _bmad-output/implementation-artifacts/handoff/WSL-BACKEND-DESIGN.md.
- _bmad-output/implementation-artifacts/verification-2026-11-05/windows-prerequisites.md.
- Narrow live filesystem/process inspection and host/guest runtime/build receipts on 2026-11-05.
