# Current-source guest runtime evidence, 2026-11-05

Completed 18:31 UTC. Build, bounded activation and listed synthetic checks passed. This does not complete Epic 1 or the full Windows/guest acceptance gate.

## Build identity

- Source SHA-256: `9e8f47c61315ccf013a4fbb0616418de2d5c7de69c731ce1e855eff8ce4deeb3`.
- HEAD: `c407483170e93ad9bea0f2d1c36e9d32693b0c44`; source archive includes uncommitted measured sources, including the final 11-file desktop candidate.
- Normalized Cargo.lock SHA-256: `da492069dc9ba1dc01932a6ed080c7ad7741c711a28c9b781f1dcc4619581563`.
- Installed Rust/Cargo 1.99.1. Both original build commands retained, with `--offline --locked -j 4`, incremental disabled and development/test debug information disabled.
- `codex-bwrap` + `codex-linux-sandbox`: passed in 3m52s. `codex-cli --bin codex`: passed in 16m32s. RDC process 35452 exited 0.
- Owned reusable build root: `/opt/inquello/build/offline-20261105-1752`; receipt `build-receipt.json`; outputs `target/debug/{codex,codex-linux-sandbox,bwrap}`. Preserve this root and existing caches; no previous target was overwritten.
- Build log: `.tmp/guest-offline-build-20261105-1759.log`.

## Verified output hashes

- codex: `6e1c642e7fa44db6d283121cf39245430a6cb6b4bec8ae9f68ceef532cc2afbd` (832046320 bytes).
- codex-linux-sandbox: `ae28366dcc0c06931f85832b59a1ed0d60dba43153af6302117ea555de5fe363` (52292432 bytes).
- bwrap: `bda71794266ac7c3a105e1cb977b754d5d297d26c6028b46dc2a4e69f0f75f9d` (565336 bytes).
- Broker: `b45569127659f63e3f5afc6abb322f582ec8eddb9cb21244bb9ba2e86a89f69e`. Executor: `9bb7124684fb766fcbb4b6f265e124d8e53a0c17e3b6d15b4be37c023b97f273`.

## Activation and recovery

Independent prevalidation checked source/archive/lock identity, new regular-file hashes, frozen broker/executor payloads, old installed hashes/metadata, no staging collisions and no active runtime workload. Report: `.tmp/guest-activation-preflight-20261105.json`.

Verified recoverable backup: `D:\Inquello\backups\runtime-before-9e8f47c6-20261105-1823`. It contains the five old components plus manifest in `guest-runtime.tar`, host receipt, metadata and verification record. Archive SHA-256: `20e290d2df68a49a40a8f308beac900dc359e1becbf30168b651b76cdc17043e`; 882892800 bytes. Old runtime source: `a28e505af109663b578cffbfb40ea182821ffafeadacfbc0241687a05cd28ceb`.

The reviewed installer was adapted with two exact-count path substitutions to the owned target/receipt and additional pre-replacement assertions. Saved script/diff: `.tmp/install-runtime-owned-20261105.py` and `.diff`; execute in the original install-runtime.py file context because its script payload lookup uses `__file__`. Activation process 13644 exited 0. Log: `.tmp/guest-activation-20261105-1825.log`.

Independent postvalidation passed: all five installed hashes, root ownership and modes, directory ownership/modes, source identity and matching host receipt/guest manifest. No `.new` leftovers. Report: `.tmp/guest-activation-verified-20261105.json`. No effective permissions/access change, shared WSL/Docker change, restart, download or model call was performed.

## Fresh storage proof

The checked-in seal-live-storage-proof checks passed with only its PowerShell 7 ProcessStartInfo transport adapted for existing PowerShell 5.1. All configuration hash, registration, disk-cap, swap identity and HCS event checks stayed intact. Script/diff: `.tmp/seal-live-storage-proof-ps51-20261105.ps1` and `.diff`; helper `.tmp/observe-guest-storage-20261105.py`; log `.tmp/guest-live-storage-proof-20261105-1823.log`.

Current proof: D-backed 128GiB disk, active 4GiB D-backed swap, boot `f9f45cea-9ed4-4f9b-b932-c5ad14dbaba7`, HCS attachment event 1181. Existing proof was backed up before its replacement.

## Executed gates

- Installed-helper early isolation: 7/7 passed, process 19536 exit 0. Log `.tmp/guest-isolation-20261105-1829.log`; saved adapted script `.tmp/probe-sandbox-installed-20261105.sh` changes only old helper path to installed runtime. Covers permitted write, outside/symlink/read-only denials, hidden host controls, NoNewPrivs/seccomp/zero capabilities, direct-network denial and recovery.
- Installed stdio executor: 3/3 passed, process 31492 exit 0. Log `.tmp/guest-executor-20261105-1829.log`; saved adapted script `.tmp/probe-executor-owned-20261105.py` redirects only stderr log location.
- Runtime matrix: 13/13 passed, process 27516 exit 0. Log `.tmp/guest-runtime-matrix-20261105-1830.log`; saved adapted script `.tmp/probe-runtime-matrix-owned-20261105.py` redirects only stderr log location. Covers transfer rejection/source retention, filesystem sibling isolation, live-scope refusal, paged output, host hiding, direct/managed network rules, symlink/Windows-executable denial, cancellation and disconnect descendant cleanup, read-only enforcement, snapshots and confirmed synthetic scope erasure.

## Corrected preliminary blockers and limits

The immediate build guard initially saw transient WSL control mounts. Read-only observation established that the existing asynchronous boot hook naturally removes them; the broker already waits up to 10 seconds. A bounded equivalent readiness wait followed by the original unchanged build guard succeeded. No manual unmount/configuration repair was needed.

Workspace-wide offline metadata encountered uncached alsa 0.11.0, but this is unrelated to the actual selected build graph. Offline locked package-scoped cargo tree succeeded; Cargo.lock reachability excludes ALSA/cpal/voice-host from all three selected packages. No ALSA download was needed. Selected graph also excludes V8. Build-script inspection found no required binary-fetch step; the actual selected builds completed offline.

Full native/desktop verification, current Windows command-rule resolution, additional sandbox/exec-server regression suites, restart/storage scenarios, mode-transition integration and all 18 seeded smoke reports remain separately coordinated. No tests were skipped or weakened, and these synthetic passes must not be described as full-spec acceptance.
