#!/bin/sh
# Approved guest-only build inventory. Invoke through the minimal-env transport.
set -eu
umask 077
ulimit -c 0
test "$(id -u)" = 0
test "$(cat /run/inquello/isolated-mounts)" = isolated-guest-mounts-v1
test ! -e /mnt/c
test ! -e /mnt/d
if grep -E ' /(mnt/wsl|mnt/wslg|usr/lib/wsl|tmp/\.X11-unix|proc/sys/fs/binfmt_misc)(/| )' /proc/self/mountinfo; then exit 1; fi
export DEBIAN_FRONTEND=noninteractive
export TMPDIR=/tmp
install -d -m 0700 /var/lib/inquello/provisioning
apt-get update -o APT::Update::Error-Mode=any
apt-get install -y --no-install-recommends build-essential pkg-config libssl-dev libcap-dev clang cmake git curl ca-certificates python3 tar gzip xz-utils
dpkg-query -W -f='${binary:Package}\t${Version}\n' > /var/lib/inquello/provisioning/packages.tsv
install -d -m 0755 /opt/inquello
install -d -m 0700 -o inquello -g inquello /opt/inquello/build /opt/inquello/toolchains
# Immutable rustup bootstrap version; record and verify the publisher checksum.
base=https://static.rust-lang.org/rustup/archive/1.28.2/x86_64-unknown-linux-gnu
curl --fail --silent --show-error --proto '=https' --tlsv1.2 "$base/rustup-init.sha256" -o /var/lib/inquello/provisioning/rustup-init.sha256
curl --fail --silent --show-error --proto '=https' --tlsv1.2 "$base/rustup-init" -o /var/lib/inquello/provisioning/rustup-init
(cd /var/lib/inquello/provisioning && sha256sum -c rustup-init.sha256)
install -m 0755 /var/lib/inquello/provisioning/rustup-init /opt/inquello/toolchains/rustup-init
runuser -u inquello -- /usr/bin/env -i HOME=/home/inquello PATH=/usr/bin:/bin TMPDIR=/tmp RUSTUP_HOME=/opt/inquello/toolchains/rustup CARGO_HOME=/opt/inquello/toolchains/cargo /opt/inquello/toolchains/rustup-init -y --no-modify-path --profile minimal --default-toolchain 1.99.1 --component rustfmt --component clippy --component rust-src
printf '%s\n' 'guest-build-prerequisites-installed'
