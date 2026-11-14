#!/bin/sh
set -eu
umask 077
ulimit -c 0
test "$(id -u)" = 1000
test ! -e /mnt/c
test ! -e /mnt/d
if grep -E ' /(mnt/wsl|mnt/wslg|usr/lib/wsl|tmp/\.X11-unix|proc/sys/fs/binfmt_misc)(/| )' /proc/self/mountinfo; then exit 1; fi
export RUSTUP_HOME=/opt/inquello/toolchains/rustup
export CARGO_HOME=/opt/inquello/toolchains/cargo
export CARGO_TARGET_DIR=/opt/inquello/build/offline-20261105-1752/target
export CARGO_INCREMENTAL=0
export CARGO_PROFILE_DEV_DEBUG=0
export CARGO_PROFILE_TEST_DEBUG=0
export TMPDIR=/tmp
export PATH="$CARGO_HOME/bin:/usr/bin:/bin"
source_id=87a50bf6654c32b6eb703e825a40e31f28c734274133f85733201969350c4f41
test "${#source_id}" = 64
case "$source_id" in *[!0-9a-f]*) exit 1;; esac
cd "/opt/inquello/build/sources/$source_id/engine/codex-rs"
printf 'source-sha256:%s\n' "$source_id"
# Deterministic archive mtimes are epoch zero. Refresh once after extraction so
# Cargo cannot mistake a new snapshot for an older cached workspace artifact.
python3 - <<'PY'
import os, pathlib
root = pathlib.Path.cwd().parent.parent
marker = root / '.cargo-source-timestamps-refreshed'
if not marker.exists():
    for name in ['engine', 'desktop']:
        for file in (root / name).rglob('*'):
            if file.is_file() and not file.is_symlink():
                os.utime(file, None)
    marker.write_text('1')
PY
sha256sum Cargo.lock
rustc --version
cargo --version
# Build the platform sandbox first so isolation can be proved before desktop
# integration. The CLI includes the exec-server entry point.
cargo test --offline --locked -j 4 -p codex-linux-sandbox --lib
cargo build --offline --locked -j 4 -p codex-bwrap -p codex-linux-sandbox
cargo build --offline --locked -j 4 -p codex-cli --bin codex
python3 - "$source_id" <<'PY'
import hashlib, json, pathlib, subprocess, sys
target = pathlib.Path('/opt/inquello/build/offline-20261105-1752/target/debug')
record = {'version': 1, 'sourceArchiveSha256': sys.argv[1], 'cargoLocked': True,
          'rustc': subprocess.check_output(['rustc', '--version'], text=True).strip(),
          'cargoLockSha256': hashlib.sha256(pathlib.Path('Cargo.lock').read_bytes()).hexdigest(),
          'binaries': {}}
for name in ['codex', 'codex-linux-sandbox', 'bwrap']:
    with (target / name).open('rb') as binary:
        record['binaries'][name] = hashlib.file_digest(binary, 'sha256').hexdigest()
receipt = pathlib.Path('/opt/inquello/build/offline-20261105-1752/merged-usr-build-receipt.json')
receipt.write_text(json.dumps(record, indent=2))
print(json.dumps(record))
PY
printf '%s\n' 'guest-execution-binaries-built'
