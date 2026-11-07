# Strict WSL setup

These scripts provision and verify the approved Story 1.21 execution backend.
The application bridge requires live storage and isolation checks. A configuration file or
downloaded image does **not** mean the backend is ready.

1. Run `prepare.ps1 -Action Preview` from the Windows owner account. It reads
   running distributions, registered paths and D-drive capacity without starting
   a guest. Review the exact global swap/crash configuration and shared restart
   impact. The returned digest binds application to the configuration reviewed.
2. After the owner approves the shared change, run
   `prepare.ps1 -Action Apply -ExpectedConfigSha256 <digest>`. This preserves
   unrelated settings, creates private D storage and retains the old configuration
   in D backups. It never terminates a distribution or restarts WSL. Coordinate
   any shared restart separately and restore the owner's running services.
3. Prove the **active** VM uses the new D swap, rather than trusting config text.
   Record the restart, swap attachment, its actual capacity and its backing path.
   Inspect crash settings and C-temp baseline. Missing evidence blocks launch.
4. `fetch-image.ps1` authenticates Canonical's signed checksum with the published
   full CD-image signing-key fingerprint before downloading the pinned image.
   It uses the existing Git GPG, isolated D verification home and D temp. A failed
   download or collision leaves staging intact. No automatic package install,
   checksum refresh or archive extraction occurs.
5. `prepare-image.py <verified-image> <new-D-output.wsl>` verifies the image digest
   again and streams a deterministic archive. It disables host-drive automount,
   fstab and Windows interop before first boot, creates a locked unprivileged
   executor, and removes initial setuid/setgid bits. It never extracts guest paths
   on Windows. The resulting digest and size are recorded beside the output.
6. After active-storage proof, use the installed WSL's local-file installation
   form with explicit `--location D:\Inquello\wsl\Inquello-Engine`,
   `--name Inquello-Engine --vhd-size 128GB --no-launch --version 2`. The installed
   `--import` command has no disk-cap option; `--install --from-file` is used to
   preserve the approved cap without changing the global `defaultVhdSize`.
   Do not use Store installation, change defaults, overwrite a registered guest,
   or install/update Windows components. Check the registered BasePath, actual
   VHDX location, maximum virtual size and sparse/dynamic allocation before launch.
7. Launch only the owned guest with a minimal environment and no host path cwd.
   Run `guest-preflight.sh` via stdin as uid 1000, using `/usr/bin/env -i`, fixed
   Linux PATH/HOME/TMPDIR and no WSLENV. Audit the complete mount evidence, including
   WSLg and driver/control mounts. This script does not prove workload isolation.
8. Install only the approved guest packages, record resolved versions and build
   the pinned Cargo workspace using `--locked -j 4`, `CARGO_INCREMENTAL=0` and
   reduced debug information. Transfer source by a trusted stdio stream, never a
   drive mount. Then run the real isolation proof before changing desktop routing.

WSL's boot command runs asynchronously. Inspect the live mount table and wait for
its forbidden mounts to disappear before accepting any readiness result; a timeout
means unavailable. The first boot snapshots WSL's generated resolver into regular
guest-owned files and turns off subsequent resolver regeneration, because WSL
otherwise recreates the symlink into the removed shared mount on later invocations.
If Windows/VPN DNS changes, refuse failed networking and deliberately refresh that
snapshot during a scoped guest maintenance restart. Never remount shared control
paths to make a tool request work.

## Current evidence

- Canonical image: `ubuntu-base-24.04.5-base-amd64.tar.gz`.
- SHA-256: `e77b6f10c2590cef872b33ee9f635a0e3fd1f57fb074c0e52b5c7f56147a0c86`.
- Signature verified with fingerprint
  `843938DF228D22F7B3742BC0D94AA3F0EFE21092` on 2026-10-30.
- `build-manifest.json` is the pinned build recipe. `freeze-source.py` includes
  tracked and untracked engine/desktop sources, excludes ignored build output,
  normalizes text line endings and records every file hash. `stage-source.py`
  verifies the archive digest before extracting to a new digest-addressed guest
  directory. `build-guest.sh` uses locked dependencies and records successful
  binary hashes. `install-runtime.py` requires those hashes and installs immutable
  root-owned binaries; its observed receipt is `D:/Inquello/runtime/build-receipt.json`.
  Generated receipts stay outside measured sources to avoid self-referential hashes.
- `probe-sandbox.sh`, `probe-executor.py` and `probe-runtime-matrix.py` exercise
  the actual guest. Logs live under `D:/Inquello/logs`; these do not replace the
  desktop integration/approval/data tests or the full seeded smoke gate.
- Guest scope export takes an exclusive lock. Workloads and transfers hold shared
  scope locks and exclusive Task locks. Export fails while a workload is active;
  it includes current guest files and retained transaction snapshots. Windows
  bindings determine which backend is authoritative after an OS transition.
- Interrupted transfers retain the source manifest, prior directory and journal;
  a `transferring` binding blocks execution and further switching. Recover by
  inspecting those retained snapshots and deliberately republishing the verified
  source through the broker. Never remove the blocked binding to bypass recovery.
  Explicit local Task deletion erases only the matching profile/account scope,
  including its recovery snapshots. No script unregisters the guest or deletes
  its disk; no automatic shared WSL restart is performed.
- Temporary transfer staging stays on D:. A legacy durable Task directory on
  another volume cannot receive an atomic Linux-to-Windows publication and is
  refused with its source retained. The backend does not silently move an
  existing profile or its credential identity to make that transition succeed.

## Seeded desktop verification

After building the desktop, CLI/app-server and the `test-issuer` dev topology,
run `node desktop/scripts/run-seeded-smoke.cjs` from the repository with the
test database URL and D-drive TEMP/TMP environment. The current quota fixture
requires a debug app-server built with `inference-fixtures`; select it through
`INQUELLO_APP_SERVER`. No live provider request is needed. The runner explicitly
adds Export to its fictional administrator's seed policy, leaving the sample
and production policy unchanged. It requires all 16 reports, a matching runtime
handshake and exit 0. Logs and the disposable profile remain on D: on Windows.
The data probe refuses unowned history, then verifies native owned draft metadata
export and recovery using live authority and an immutable service receipt.

For Story 1.30 only, `node desktop/scripts/run-seeded-smoke.cjs --navigation`
requires the saved-navigation and shell-layout reports plus the handshake and
clean exit. It checks actual Task menus, native restart persistence, explicit
archived search/reopen, provider-independent inspection, sign-out denial, real
Chromium shortcuts and responsive navigation. This is a focused check, not a
pass of the 16-report epic suite. Retained conversation hits and authorization
races additionally require the 14 witnesses selected by
`desktop/scripts/run-navigation-native.cjs` and the saved-work renderer suites.

References: [WSL configuration](https://learn.microsoft.com/en-us/windows/wsl/wsl-config),
[Canonical image verification](https://documentation.ubuntu.com/security/software-integrity/image-verification/),
[pinned image directory](https://cdimage.ubuntu.com/ubuntu-base/releases/noble/release/).
