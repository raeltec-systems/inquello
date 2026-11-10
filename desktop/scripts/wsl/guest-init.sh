#!/bin/sh
# WSL invokes this as root for this distribution only. Sever mount propagation
# BEFORE removing any shared mount, so Docker/other distributions are untouched.
set -eu
umask 077
ulimit -c 0
test "$(id -u)" = 0
# WSL's generated resolver is a symlink into /mnt/wsl. Retain only its plain
# configuration inside the guest before removing the shared mount.
resolver=$(mktemp /etc/inquello-resolv.XXXXXX)
if test -r /etc/resolv.conf; then
    cat /etc/resolv.conf > /etc/inquello-resolv.conf
    chmod 0644 /etc/inquello-resolv.conf
fi
cat /etc/inquello-resolv.conf > "$resolver"
chmod 0644 "$resolver"
mv -T "$resolver" /etc/resolv.conf
if ! grep -q '^generateResolvConf=false$' /etc/wsl.conf; then
    printf '\n[network]\ngenerateResolvConf=false\n' >> /etc/wsl.conf
fi
mount --make-rprivate /
for target in /tmp/.X11-unix /mnt/wslg /mnt/wsl /usr/lib/wsl/drivers /usr/lib/wsl/lib /proc/sys/fs/binfmt_misc; do
    if mountpoint -q "$target"; then umount -R "$target"; fi
done
if grep -E ' /(mnt/wsl|mnt/wslg|usr/lib/wsl|tmp/\.X11-unix|proc/sys/fs/binfmt_misc)(/| )' /proc/self/mountinfo; then
    echo 'Shared/control mount remains; executor unavailable' >&2
    exit 1
fi
mkdir -p /run/inquello
printf '%s\n' 'isolated-guest-mounts-v1' > /run/inquello/isolated-mounts
