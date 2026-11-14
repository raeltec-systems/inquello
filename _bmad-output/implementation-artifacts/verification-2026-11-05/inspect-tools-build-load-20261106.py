import os,subprocess
from pathlib import Path
system=os.environ['SystemRoot']
env={'SystemRoot':system,'WINDIR':system,'TEMP':r'D:\Inquello\tmp','TMP':r'D:\Inquello\tmp'}
command=[str(Path(system)/'System32/wsl.exe'),'-d','Inquello-Engine','--user','inquello','--cd','/','--exec','/usr/bin/env','-i','HOME=/home/inquello','PATH=/usr/bin:/bin','TMPDIR=/tmp','LANG=C.UTF-8','/bin/sh','-s']
script='ps -eo pid,ppid,etimes,rss,pcpu,comm | sort -k4 -nr | head -12; free -m; df -h /opt/inquello/build /tmp\n'
subprocess.run(command,input=script.encode(),env=env,cwd=r'D:\Inquello\tmp',check=True)
