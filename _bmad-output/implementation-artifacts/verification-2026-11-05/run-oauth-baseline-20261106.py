from pathlib import Path
import os, subprocess, sys
repo=Path(r'D:\Projects\inquello')
base=repo/'_bmad-output/implementation-artifacts/verification-2026-11-05'
system=os.environ['SystemRoot']
env={'SystemRoot':system,'WINDIR':system,'TEMP':r'D:\Inquello\tmp','TMP':r'D:\Inquello\tmp','TMPDIR':r'D:\Inquello\tmp'}
script=(repo/'desktop/scripts/wsl/build-guest.sh').read_text().split('# Build the platform sandbox first')[0]
script=script.replace('export CARGO_TARGET_DIR=/opt/inquello/build/target','export CARGO_TARGET_DIR=/opt/inquello/build/offline-20261105-1752/target')
script=script.replace('source_id=$(cat /opt/inquello/build/sources/selected-source)','source_id=c7cc44396822ac8b3d9a2e6c6436d5fbbb7510aeea5660764c2b56aae24c805d')
script+='\ncargo test --offline --locked -j 4 -p codex-app-server --test all oauth_cancel_rpc_selects_exact_attempt_and_prevents_late_token_persistence -- --nocapture --test-threads=1\n'
command=[str(Path(system)/'System32/wsl.exe'),'-d','Inquello-Engine','--user','inquello','--cd','/','--exec','/usr/bin/env','-i','HOME=/home/inquello','PATH=/usr/bin:/bin','TMPDIR=/tmp','LANG=C.UTF-8','/bin/sh','-s']
with (base/'oauth-baseline-20261106.log').open('x',encoding='utf-8') as log:
 result=subprocess.run(command,input=script.encode(),cwd=r'D:\Inquello\tmp',env=env,stdout=log,stderr=subprocess.STDOUT)
print('OAUTH_BASELINE_EXIT='+str(result.returncode),flush=True)
sys.exit(result.returncode)
