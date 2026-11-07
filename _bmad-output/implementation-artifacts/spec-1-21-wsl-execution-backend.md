---
title: 'Story 1.21 prerequisite: strict WSL execution on D:'
type: 'feature'
created: '2026-10-29'
status: 'in-progress'
baseline_commit: '71c77a3ffbe3abdb1f1a9c9308515a40e0e9b143'
route: 'dispatch'
review_loop_iteration: 0
context:
  - '{project-root}/_bmad-output/implementation-artifacts/handoff/WSL-BACKEND-DESIGN.md'
  - '{project-root}/_bmad-output/implementation-artifacts/spec-1-19-bound-tool-reads-writes-network.md'
  - '{project-root}/_bmad-output/implementation-artifacts/spec-1-20-authorize-specific-actions.md'
---

<frozen-after-approval reason="human-owned intent — approved 2026-10-30">

## Intent

Use a dedicated WSL 2 guest and Linux sandbox because the inherited Windows backend cannot enforce bounded reads. Windows retains identity, credentials, policy and approvals. The owner chose strict isolation and D-drive storage. Implementation awaits spec approval.

## Boundaries & Constraints

- Standard/No prompt tools visibly run in Linux: only their Task folders, minimal read-only system resources and Workspace-listed destinations. WSL alone is not the Task sandbox.
- Guest files are authoritative; broker transfers/migration without host mounts. Disable automount, fstab and Windows interop. Unprivileged workloads use namespaces/seccomp; exclude WSL/WSLg control sockets and privilege escalation.
- Keep provider credentials, browser login and model requests on Windows. Do not transfer host environment secrets. Authenticated guest-tool networking stays unavailable until a separate credential broker is approved.
- Preserve Windows Full access: explicitly identify OS changes and synchronize Task data under a lock. Unsupported transfers block switching and preserve the source; never silently substitute guest-only access.
- All Inquello guest disks, swap, images, caches, backups, logs, builds and temporary files reside on D:. Storage/probe/guest failure means unavailable; no native/unrestricted fallback or C-drive spill.
- Use `Inquello-Engine`, separate from Docker. Preserve existing distributions/defaults. Global WSL swap/configuration changes and any required shared restart are previewed before application; no automatic `wsl --shutdown`.
- Approval permits the bounded download/install inventory in the design note. No model runs, unrelated installs, broad Windows read grants, LPAC fallback or review subagents.

## I/O & Edge-Case Matrix

| Given | When | Then |
|---|---|---|
| Ready guest | Allowed write/read | Output persists across restart and export |
| Bounded Task | Outside/cross-Task/host access, link escape or Windows executable | Denied; later permitted command works |
| Read-only policy | Mutation requested | Denied without changes |
| Domain allowlist | Allowed host versus direct IP/DNS/IPv6/loopback/other proxy | Only policy-permitted proxied traffic succeeds |
| Prompt/forbid | Command submitted | Existing approval rules apply to actual Linux argv; authorization is consumed once |
| Transfer | Traversal, links, devices, collisions, quota or interrupted copy | Reject unsafe publication; source remains recoverable |
| Cancellation/disconnect | Workload has descendants | Entire owned workload stops; no orphan or partial success |
| Missing guest/D:/storage/probe | Execution requested | Unavailable; no fallback or C-drive spill |
| Backend switch | Linux/Windows Task files differ | Explicit OS transition and verified transfer; no silent overwrite |

</frozen-after-approval>

## Code Map

See the design note for exact symbols. New `desktop/src/main/runtime/wsl.ts` owns storage preflight/launch. Under `engine/codex-rs/`, app-server request processors need explicit guest routing; reuse `exec-server/`, `exec-server-protocol/`, `file-system/` and `utils/path-uri/` for portable stdio/process/filesystem operations. `linux-sandbox/` and `network-proxy/` enforce guest policy. Desktop `src/main/policy/`, `data/`, `data-policy.json` and `src/renderer/Capabilities.tsx` own binding, transfer, governance and readiness display.

## Tasks & Acceptance

- [ ] `desktop/scripts/wsl/` (new): reproducible image/build manifest, D-only provisioning/preflight and scoped recovery.
- [ ] Runtime/engine paths above: guest bridge, minimal environment, mandatory sandbox context, approval binding and descendant cleanup.
- [ ] Policy/data paths above: safe migration, transfer, mode transitions and export/delete coverage.
- [ ] `desktop/test/wsl-backend-integration.test.ts` (new), existing tool/permission tests and `smoke-probe.ts`: exercise every matrix row against the real guest.
- [ ] `FORK-CUT.md`, parent Story 1.21 spec and handoff: record patches/evidence; close Story 1.21 only after its complete gate passes.

Given D-only guest setup, when seeded desktop smoke runs, all 13 reports pass with real guest execution and no skipped security cases. Failed early storage/isolation proofs block integration.

## Verification

- Windows and guest: rebuild required CLI/app-server/sandbox helpers separately from service; `CARGO_INCREMENTAL=0`, `-j 4`, locked dependencies.
- Run domain/adapter/protocol/service tests and required clippy; guest exec-server/Linux sandbox regression suites plus new bridge tests.
- Desktop: `pnpm generate:protocol`, `pnpm run build`, `pnpm test` with the test database; seeded keyring smoke must exit 0.
- Execute setup/restart/cancel/export/delete/storage probes; confirm registered disk and swap paths, no host mounts/interop, no credentials in guest, and no C-drive payload/temp growth from Inquello provisioning or execution.

## Implementation Notes

- 2026-10-30: Owner approved this spec and continuing implementation, reiterating D-drive placement for all temp, caches, swap and VM storage. Existing Story 1.21 changes must be preserved. Use `.tmp/story121-env.ps1` for Windows host commands (D-drive Rust/Cargo/temp paths). No review layers; parent verifies and commits locally after acceptance.
- 2026-10-30: Owner separately approved applying the reviewed shared WSL settings and restarting Docker/WSL. Restart completed at 00:26 UTC; a new D-drive swap file was created afterward and `/proc/swaps` reports 4 GiB active swap. All 15 previously running containers were restored. Receipt: `.tmp/wsl-active-storage-proof.json`. Guest isolation and the complete acceptance gate remain pending.
- Provisioning uses the installed WSL's local-image `--install --from-file` form with explicit D-drive `--location`, `--name Inquello-Engine`, `--vhd-size 128GB`, `--version 2` and `--no-launch`: this host's `--import` form cannot specify the approved disk cap. This is a local verified-image import, with no Store or Windows component download and no default-distribution change.
- Post-restart follow-up: 14 Docker containers became stable/healthy; the existing `supabase_vector_church-app` logging container repeatedly exits because its configured Docker API at `192.168.65.254:2375` refuses connections. All original containers were started, but this logger's recovery is incomplete. No unauthenticated Docker API was enabled and no unrelated container configuration was changed. Diagnostic excerpt is in `.tmp/docker-vector-recovery.log`.
- Initial guest proof: WSL2 registration is exactly `D:/Inquello/wsl/Inquello-Engine`, with the default distribution preserved. DiskPart reports the requested 128 GiB virtual disk. The parent independently ran `guest-preflight.sh` as uid 1000: Task storage, home and `/tmp` share the guest root device, active swap is 4 GiB, and effective/permitted capabilities are empty. Log: `.tmp/wsl-parent-guest-preflight.log`. This is a provisioning check, not proof of workload seccomp, Task boundaries or networking; those acceptance checks remain pending.
- Early real isolation gate passed, including the parent's independent rerun: inside-Task write/read persistence; outside-Task read denial; symlink escape denial; read-only mutation denial; hidden host/control paths; `NoNewPrivs=1`, seccomp filter mode 2 and no effective capabilities; direct IPv4/IPv6/loopback denial; successful permitted command after denials. Evidence: `.tmp/wsl-parent-isolation-proof.log`, produced by `desktop/scripts/wsl/probe-sandbox.sh` using the built helpers. This permits bridge implementation; the full matrix (managed proxy, authorization, transfers, lifecycle, mode transitions) and Story 1.21 gate remain incomplete.
- 2026-11-05 (owner-approved): command rules now resolve the program inside the guest. A bounded command's `argv[0]` and each rule's first word used to be "unresolved" on the Windows host, so every command asked. They are now resolved inside the guest, through the existing guest executor channel, with no new network, port or privilege:
  - The guest answers with read-only `fs/getMetadata` and `fs/canonicalize` queries under the Task's sandbox, using the guest PATH (`GUEST_PATH = /usr/bin:/bin`, now shared with execution) and the guest Task folder, following symlinks there.
  - For `inquello/tools/exec`, resolution opens a short read-only, no-network executor connection and closes it (`close_and_wait`) before the command runs.
  - A private Task resolves over its retained executor connection, which the Task registers at setup and releases at retirement.
  - An unreachable guest, a failed query or a 10 s timeout means unresolved, so the command asks.
  - Verified only by unit tests with a fake guest channel on Linux. The real WSL connection, the queries, and the extra executor launch per `tools/exec` command have not been run on Windows. See FORK-CUT "Command rules resolve the program inside the Windows Linux guest".
