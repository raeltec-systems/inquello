from pathlib import Path
import hashlib,json,os,subprocess,sys
repo=Path(r'D:\Projects\inquello')
base=repo/'_bmad-output/implementation-artifacts/verification-2026-11-05'
path='engine/codex-rs/rmcp-client/src/oauth_callback_transport.rs'
changed=subprocess.check_output(['git','diff','--name-only','--','engine'],cwd=repo,text=True).splitlines()
assert changed==[path],changed
patch=subprocess.check_output(['git','diff','--no-ext-diff','--',path],cwd=repo)
(base/'oauth-callback-clippy-correction-20261106.patch').write_bytes(patch)
subprocess.run(['git','diff','--check','--',path],cwd=repo,check=True)
system=os.environ['SystemRoot']
env={'SystemRoot':system,'WINDIR':system,'TEMP':r'D:\Inquello\tmp','TMP':r'D:\Inquello\tmp','TMPDIR':r'D:\Inquello\tmp','PATH':r'C:\Program Files\Git\cmd'+os.pathsep+str(Path(system)/'System32')}
record=json.loads(subprocess.check_output([sys.executable,str(repo/'desktop/scripts/wsl/freeze-source.py')],cwd=repo,env=env,text=True))
record['changedFile']=path
record['changedFileSha256']=hashlib.sha256((repo/path).read_bytes()).hexdigest()
record['patchSha256']=hashlib.sha256(patch).hexdigest()
(base/'oauth-clippy-correction-source-20261106.json').write_text(json.dumps(record,indent=2),encoding='utf-8')
print(json.dumps(record,indent=2))
