#!/bin/sh
# One-time upgrade of the initial imported guest; the same init is embedded in
# newly prepared images. Keep this content identical to guest-init.sh.
set -eu
test "$(id -u)" = 0
umask 077
cat > /usr/local/sbin/inquello-guest-init <<'INQUELLO_INIT'
#!/bin/sh
set -eu
umask 077
ulimit -c 0
test "$(id -u)" = 0
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
INQUELLO_INIT
chmod 0755 /usr/local/sbin/inquello-guest-init
cat > /etc/wsl.conf <<'INQUELLO_CONFIG'
[automount]
enabled=false
mountFsTab=false
ldconfig=false
[interop]
enabled=false
appendWindowsPath=false
[gpu]
enabled=false
appendLibPath=false
[boot]
systemd=false
command=/usr/local/sbin/inquello-guest-init
[user]
default=inquello
INQUELLO_CONFIG
chmod 0644 /etc/wsl.conf
if test -r /etc/resolv.conf; then /usr/local/sbin/inquello-guest-init; fi
