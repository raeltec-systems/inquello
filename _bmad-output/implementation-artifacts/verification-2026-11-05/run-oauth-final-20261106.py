from pathlib import Path
import json, os, subprocess, sys
repo=Path(r'D:\Projects\inquello')
base=repo/'_bmad-output/implementation-artifacts/verification-2026-11-05'
system=os.environ['SystemRoot']
env={'SystemRoot':system,'WINDIR':system,'TEMP':r'D:\Inquello\tmp','TMP':r'D:\Inquello\tmp','TMPDIR':r'D:\Inquello\tmp'}
freeze_env=dict(env); freeze_env['PATH']=r'C:\Program Files\Git\cmd'+os.pathsep+str(Path(system)/'System32')
record=json.loads((base/'oauth-clippy-correction-source-20261106.json').read_text(encoding='utf-8'))
with (base/'oauth-final-source-20261106.json').open('x',encoding='utf-8') as f: json.dump(record,f,indent=2)
subprocess.run([sys.executable,str(repo/'desktop/scripts/wsl/stage-source.py'),record['archive'],'--sha256',record['sourceSha256']],cwd=repo,env=env,check=True)
wait='''set -eu
for attempt in $(seq 1 60); do
 if ! grep -Eq ' /(mnt/wsl|mnt/wslg|usr/lib/wsl|tmp/\\.X11-unix|proc/sys/fs/binfmt_misc)(/| )' /proc/self/mountinfo; then break; fi
 sleep 1
done
'''
script=wait+(repo/'desktop/scripts/wsl/build-guest.sh').read_text().split('# Build the platform sandbox first')[0]
script=script.replace('export CARGO_TARGET_DIR=/opt/inquello/build/target','export CARGO_TARGET_DIR=/opt/inquello/build/offline-20261105-1752/target')
script=script.replace('source_id=$(cat /opt/inquello/build/sources/selected-source)','source_id='+record['sourceSha256'])
script+='\ncargo fmt -p codex-rmcp-client -- --check\n'
script+='cargo clippy --offline --locked -j 4 -p codex-rmcp-client --all-targets -- -D warnings\n'
script+='cargo test --offline --locked -j 4 -p codex-rmcp-client --lib -- --nocapture --test-threads=1\n'
script+='cargo test --offline --locked -j 4 -p codex-app-server --test all oauth_cancel_rpc_selects_exact_attempt_and_prevents_late_token_persistence -- --nocapture --test-threads=1\n'
script+="printf '%s\\n' 'oauth-final-native-gates-complete'\n"
(base/'oauth-final-command-20261106.sh').write_text(script,encoding='utf-8',newline='\n')
command=[str(Path(system)/'System32/wsl.exe'),'-d','Inquello-Engine','--user','inquello','--cd','/','--exec','/usr/bin/env','-i','HOME=/home/inquello','PATH=/usr/bin:/bin','TMPDIR=/tmp','LANG=C.UTF-8','/bin/sh','-s']
with (base/'oauth-final-20261106.log').open('x',encoding='utf-8') as log:
 result=subprocess.run(command,input=script.encode(),cwd=r'D:\Inquello\tmp',env=env,stdout=log,stderr=subprocess.STDOUT)
print('OAUTH_FINAL_EXIT='+str(result.returncode),flush=True)
sys.exit(result.returncode)
