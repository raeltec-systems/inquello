from pathlib import Path
import hashlib, os, subprocess, sys, tomllib
repo=Path(r'D:\Projects\inquello')
base=repo/'_bmad-output/implementation-artifacts/verification-2026-11-05'
packages=tomllib.loads((repo/'engine/codex-rs/Cargo.lock').read_text())['package']
system=os.environ['SystemRoot']
env={'SystemRoot':system,'WINDIR':system,'TEMP':r'D:\Inquello\tmp','TMP':r'D:\Inquello\tmp'}
guest_script="""import hashlib,pathlib,sys
target=pathlib.Path('/opt/inquello/toolchains/cargo/registry/cache/index.crates.io-1949cf8c6b5b557f')/sys.argv[1]
expected=sys.argv[2]
data=sys.stdin.buffer.read()
assert target.parent.is_dir()
assert hashlib.sha256(data).hexdigest()==expected
if target.exists():
 assert hashlib.sha256(target.read_bytes()).hexdigest()==expected
else:
 with target.open('xb') as f: f.write(data)
assert hashlib.sha256(target.read_bytes()).hexdigest()==expected
print(target.name+' sha256='+expected+' verified existing locked archive; no network')
"""
with (base/'oauth-cached-crate-reuse-20261106.log').open('x',encoding='utf-8') as log:
 for name in ['tracing-test','tracing-test-macro']:
  package=next(p for p in packages if p['name']==name and p['version']=='0.2.5')
  filename=name+'-0.2.5.crate'
  source=Path(r'D:\Toolchains\cargo\registry\cache\index.crates.io-1949cf8c6b5b557f')/filename
  data=source.read_bytes()
  assert hashlib.sha256(data).hexdigest()==package['checksum']
  command=[str(Path(system)/'System32/wsl.exe'),'-d','Inquello-Engine','--user','inquello','--cd','/','--exec','/usr/bin/env','-i','HOME=/home/inquello','PATH=/usr/bin:/bin','TMPDIR=/tmp','LANG=C.UTF-8','/usr/bin/python3','-c',guest_script,filename,package['checksum']]
  subprocess.run(command,input=data,cwd=r'D:\Inquello\tmp',env=env,stdout=log,stderr=subprocess.STDOUT,check=True)
print('EXISTING_LOCKED_ARCHIVES_REUSED',flush=True)
