"""Offline source-identified guest build; no downloads or live activation."""
from pathlib import Path
import json,os,subprocess,sys
repo=Path(r'D:\Projects\inquello')
base=repo/'_bmad-output/implementation-artifacts/verification-2026-11-05'
record=json.loads((base/'merged-usr-final-source.json').read_text(encoding='utf-16'))
system=os.environ['SystemRoot']
env={'SystemRoot':system,'WINDIR':system,'TEMP':r'D:\Inquello\tmp','TMP':r'D:\Inquello\tmp','TMPDIR':r'D:\Inquello\tmp'}
r=subprocess.run([sys.executable,str(repo/'desktop/scripts/wsl/stage-source.py'),record['archive'],'--sha256',record['sourceSha256']],env=env,cwd=repo)
assert r.returncode==0,r.returncode
script=(repo/'desktop/scripts/wsl/build-guest.sh').read_text()
assert script.count('export CARGO_TARGET_DIR=/opt/inquello/build/target')==1
script=script.replace('export CARGO_TARGET_DIR=/opt/inquello/build/target','export CARGO_TARGET_DIR=/opt/inquello/build/offline-20261105-1752/target')
script=script.replace('cargo build --locked','cargo build --offline --locked')
script=script.replace("pathlib.Path('/opt/inquello/build/target/debug')","pathlib.Path('/opt/inquello/build/offline-20261105-1752/target/debug')")
script=script.replace("pathlib.Path('/opt/inquello/build/build-receipt.json')","pathlib.Path('/opt/inquello/build/offline-20261105-1752/merged-usr-build-receipt.json')")
script=script.replace('cargo build --offline --locked -j 4 -p codex-bwrap', 'cargo test --offline --locked -j 4 -p codex-linux-sandbox --lib\ncargo build --offline --locked -j 4 -p codex-bwrap')
script=script.replace('source_id=$(cat /opt/inquello/build/sources/selected-source)',"source_id="+record['sourceSha256'])
(base/'merged-usr-final-build-script.sh').write_text(script,newline='\n')
command=[str(Path(system)/'System32/wsl.exe'),'-d','Inquello-Engine','--user','inquello','--cd','/','--exec','/usr/bin/env','-i','HOME=/home/inquello','PATH=/usr/bin:/bin','TMPDIR=/tmp','LANG=C.UTF-8','/bin/sh','-s']
with (base/'merged-usr-final-guest-build.log').open('x') as log:
    result=subprocess.run(command,input=script.encode(),env=env,cwd=r'D:\Inquello\tmp',stdout=log,stderr=subprocess.STDOUT)
print('GUEST_BUILD_EXIT='+str(result.returncode),flush=True)
sys.exit(result.returncode)
