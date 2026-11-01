#!/bin/sh
# Regression suites run as the unprivileged guest account, using D-backed VHD
# sources/cache/temp. No model/provider/keyring session is used.
set -eu
umask 077
ulimit -c 0
test "$(id -u)" = 1000
test ! -e /mnt/c
test ! -e /mnt/d
export RUSTUP_HOME=/opt/inquello/toolchains/rustup
export CARGO_HOME=/opt/inquello/toolchains/cargo
export CARGO_TARGET_DIR=/opt/inquello/build/target
export CARGO_INCREMENTAL=0
export CARGO_PROFILE_DEV_DEBUG=0
export CARGO_PROFILE_TEST_DEBUG=0
export TMPDIR=/tmp
export PATH="$CARGO_HOME/bin:/usr/bin:/bin"
source_id=$(cat /opt/inquello/build/sources/selected-source)
test "${#source_id}" = 64
case "$source_id" in *[!0-9a-f]*) exit 1;; esac
cd "/opt/inquello/build/sources/$source_id/engine/codex-rs"
cargo test --locked -j 4 -p codex-linux-sandbox --lib
# Several executor unit tests install process-global tracing subscribers. Keep
# that suite serial so concurrent interest-cache changes cannot erase the span
# asserted by the network-policy tests. Process integration retains concurrency.
cargo test --locked -j 4 -p codex-exec-server --lib -- --test-threads=1
cargo test --locked -j 4 -p codex-exec-server --test process --test exec_process
