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
source_id=c7cc44396822ac8b3d9a2e6c6436d5fbbb7510aeea5660764c2b56aae24c805d
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

cargo build --offline --locked -j 4 -p codex-bwrap -p codex-linux-sandbox -p codex-cli --bin bwrap --bin codex-linux-sandbox --bin codex
cargo build --offline --locked -j 4 -p codex-app-server --features inference-fixtures --bin codex-app-server
export INQUELLO_FIXTURE_APP_SERVER_BIN="$CARGO_TARGET_DIR/debug/codex-app-server"
sha256sum "$INQUELLO_FIXTURE_APP_SERVER_BIN"
cargo test --offline --locked -j 4 -p codex-app-server --features inference-fixtures --test inquello_messages_runtime real_private_task_retains_publication_question_and_truthful_progress -- --nocapture --test-threads=1
cargo test --offline --locked -j 4 -p codex-app-server --features inference-fixtures --test inquello_messages_runtime -- --nocapture --test-threads=1
printf '%s\n' 'retained-runtime-gates-complete'
