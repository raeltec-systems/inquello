import os, subprocess, sys
from pathlib import Path
system=os.environ["SystemRoot"]
env={"SystemRoot":system,"WINDIR":system,"TEMP":r"D:\Inquello\tmp","TMP":r"D:\Inquello\tmp","TMPDIR":r"D:\Inquello\tmp"}
program="import json,pathlib,re\nlines=pathlib.Path('/proc/swaps').read_text().splitlines()[1:]\nassert len(lines)==1\nfields=lines[0].split()\nassert re.fullmatch('/dev/sd[a-z]+', fields[0]) and int(fields[2])==4194304\ndevice=pathlib.Path('/sys/class/block')/pathlib.Path(fields[0]).name/'device'\nmatch=re.fullmatch(r'\\d+:\\d+:\\d+:(\\d+)',device.resolve().name)\nassert match\nprint(json.dumps({'bootId':pathlib.Path('/proc/sys/kernel/random/boot_id').read_text().strip(),'bootTime':int(next(x.split()[1] for x in pathlib.Path('/proc/stat').read_text().splitlines() if x.startswith('btime '))),'swapDevice':fields[0],'lun':int(match.group(1))}))"
result=subprocess.run([str(Path(system)/"System32/wsl.exe"),"-d","Inquello-Engine","--user","inquello","--cd","/","--exec","/usr/bin/env","-i","PATH=/usr/bin:/bin","/usr/bin/python3","-I","-c",program],cwd=r"D:\Inquello\tmp",env=env,text=True,capture_output=True,timeout=30)
if result.returncode: raise RuntimeError("Live guest storage observation failed: "+result.stderr)
print(result.stdout.strip())
