from pathlib import Path
import os,subprocess
system=os.environ['SystemRoot']
env={'SystemRoot':system,'WINDIR':system,'TEMP':r'D:\Inquello\tmp','TMP':r'D:\Inquello\tmp'}
cmd=[str(Path(system)/'System32/wsl.exe'),'-d','Inquello-Engine','--user','inquello','--cd','/','--exec','/usr/bin/env','-i','HOME=/home/inquello','PATH=/usr/bin:/bin','TMPDIR=/tmp','LANG=C.UTF-8','/bin/sh','-s']
script='''set -eu
id
cat /proc/sys/kernel/random/boot_id
printf "FORBIDDEN MOUNTS\\n"
grep -E ' /(mnt/wsl|mnt/wslg|usr/lib/wsl|tmp/\\.X11-unix|proc/sys/fs/binfmt_misc)(/| )' /proc/self/mountinfo || true
printf "INIT PROCESSES\\n"
ps -eo pid,ppid,user,comm | grep -E 'init|mount|sh|cargo|rustc' || true
printf "CONFIG AND MARKER\\n"
cat /etc/wsl.conf
cat /run/inquello/isolated-mounts || true
sha256sum /usr/local/sbin/inquello-guest-init
'''
subprocess.run(cmd,input=script.encode(),env=env,cwd=r'D:\Inquello\tmp',check=True)
