#!/bin/sh
# Read-only first-boot evidence. This does not declare the workload sandbox ready.
set -eu
ulimit -c 0
printf '%s\n' '--- initial identity/configuration ---'
id
cat /etc/wsl.conf
printf '%s\n' '--- initial mount evidence ---'
cat /proc/self/mountinfo
printf '%s\n' '--- interop registration ---'
if test -e /proc/sys/fs/binfmt_misc/WSLInterop; then cat /proc/sys/fs/binfmt_misc/WSLInterop; fi
test "$(id -u)" = 1000
test "$(id -un)" = inquello
test ! -e /mnt/c
test ! -e /mnt/d
test ! -e /proc/sys/fs/binfmt_misc/WSLInterop
test -z "${WSL_INTEROP:-}"
test -z "${WSLENV:-}"
test -z "${OPENAI_API_KEY:-}"
test -z "${ANTHROPIC_API_KEY:-}"
test -z "${CODEX_API_KEY:-}"
test -z "${HTTP_PROXY:-}"
test -z "${HTTPS_PROXY:-}"
test -z "${ALL_PROXY:-}"
test -z "${DISPLAY:-}"
test -z "${WAYLAND_DISPLAY:-}"
test -z "${PULSE_SERVER:-}"
test -d /var/lib/inquello/tasks
test -w /var/lib/inquello/tasks
test ! -w /etc/passwd
printf '%s\n' '--- identity ---'
id
printf '%s\n' '--- guest configuration ---'
cat /etc/wsl.conf
printf '%s\n' '--- root and temp storage ---'
df -P / /tmp /home/inquello /var/lib/inquello/tasks
printf '%s\n' '--- mount evidence (must be audited before sandbox work) ---'
cat /proc/self/mountinfo
printf '%s\n' '--- swap ---'
cat /proc/swaps
printf '%s\n' '--- capabilities ---'
grep '^Cap\|^NoNewPrivs\|^Seccomp' /proc/self/status
printf '%s\n' '--- kernel user namespaces ---'
cat /proc/sys/user/max_user_namespaces
printf '%s\n' 'guest-configuration-probe-complete; workload-sandbox-unverified'
