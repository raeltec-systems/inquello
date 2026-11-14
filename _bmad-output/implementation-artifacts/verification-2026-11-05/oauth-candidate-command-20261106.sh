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
source_id=ed7081ace5323a12d5face0b940dfc612a7194d43e520d97b370c508f35b7a9a
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

cargo test --offline --locked -j 4 -p codex-rmcp-client --lib -- --nocapture --test-threads=1
