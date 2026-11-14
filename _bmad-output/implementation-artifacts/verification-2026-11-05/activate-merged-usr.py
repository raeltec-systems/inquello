"""Source-matched update of existing guest runtime, unchanged ownership/modes."""
from pathlib import Path
import ast,base64,hashlib,json,os,subprocess,sys,time
repo=Path(r'D:\Projects\inquello'); logs=repo/'_bmad-output/implementation-artifacts/verification-2026-11-05'
record=json.loads((logs/'merged-usr-source.json').read_text(encoding='utf-16'))
source=record['sourceSha256']; target='/opt/inquello/build/offline-20261105-1752'
system=os.environ['SystemRoot']
env={'SystemRoot':system,'WINDIR':system,'TEMP':r'D:\Inquello\tmp','TMP':r'D:\Inquello\tmp','TMPDIR':r'D:\Inquello\tmp'}
prefix=[str(Path(system)/'System32/wsl.exe'),'-d','Inquello-Engine','--user']
def call(program,user='inquello',payload=None,timeout=180):
    result=subprocess.run(prefix+[user,'--cd','/','--exec','/usr/bin/env','-i','PATH=/usr/bin:/bin','LANG=C.UTF-8','/usr/bin/python3','-I','-c',program],input=None if payload is None else json.dumps(payload).encode(),capture_output=True,env=env,cwd=r'D:\Inquello\tmp',timeout=timeout)
    if result.returncode: raise RuntimeError(result.stderr.decode(errors='replace'))
    return json.loads(result.stdout)
files=['/opt/inquello/runtime/bin/'+n for n in ['codex','codex-linux-sandbox','bwrap']]+['/usr/local/libexec/inquello-broker.py','/usr/local/libexec/inquello-executor','/opt/inquello/runtime/manifest.json']
dirs=['/opt/inquello/runtime','/opt/inquello/runtime/bin','/usr/local/libexec']+['/var/lib/inquello/'+n for n in ['tasks','locks','transfers','executor']]
probe=r"""
import hashlib,json,os,pathlib,stat
data=json.load(__import__('sys').stdin)
def meta(name):
    p=pathlib.Path(name); s=p.lstat()
    result={'uid':s.st_uid,'gid':s.st_gid,'mode':stat.S_IMODE(s.st_mode),'bytes':s.st_size,'regular':stat.S_ISREG(s.st_mode),'directory':stat.S_ISDIR(s.st_mode)}
    if result['regular']:
        with p.open('rb') as f:result['sha256']=hashlib.file_digest(f,'sha256').hexdigest()
    return result
active=[]
for p in pathlib.Path('/proc').iterdir():
    if not p.name.isdigit() or int(p.name)==os.getpid():continue
    try:args=(p/'cmdline').read_bytes().split(b'\0')
    except (FileNotFoundError,PermissionError):continue
    if args and (args[0] in [b'/opt/inquello/runtime/bin/codex',b'/opt/inquello/runtime/bin/codex-linux-sandbox'] or b'/usr/local/libexec/inquello-broker.py' in args):
        active.append(int(p.name))
assert not active,active
assert not any(pathlib.Path(x+'.new').exists() for x in data['files'])
receipt=json.loads(pathlib.Path(data['target']+'/merged-usr-build-receipt.json').read_text())
assert receipt['sourceArchiveSha256']==data['source'] and receipt['cargoLocked']
new={n:meta(data['target']+'/target/debug/'+n) for n in receipt['binaries']}
for n,m in new.items():assert m['regular'] and m['sha256']==receipt['binaries'][n]
print(json.dumps({'files':{p:meta(p) for p in data['files']},'directories':{p:meta(p) for p in data['dirs']},'receipt':receipt,'new':new,'manifest':json.loads(pathlib.Path('/opt/inquello/runtime/manifest.json').read_text()),'bootId':pathlib.Path('/proc/sys/kernel/random/boot_id').read_text().strip()}))
"""
data={'files':files,'dirs':dirs,'target':target,'source':source}
before=call(probe,payload=data)
proof=json.loads(Path(r'D:\Inquello\runtime\storage-proof.json').read_text())
assert before['bootId']==proof['bootId']
for p,m in before['files'].items():assert m['regular'] and m['uid']==0 and m['gid']==0 and m['mode']==(0o444 if p.endswith('manifest.json') else 0o555),(p,m)
for p,m in before['directories'].items():
    state=p.startswith('/var/lib/inquello/')
    assert m['directory'] and m['uid']==(1000 if state else 0) and m['gid']==(1000 if state else 0) and m['mode']==(0o700 if state else 0o755),(p,m)
frozen=json.loads(Path(record['archive']).with_suffix('.json').read_text())['files']
payload={}
for name in ['guest-broker.py','guest-executor.sh']:
    content=(repo/'desktop/scripts/wsl'/name).read_bytes().replace(b'\r\n',b'\n')
    assert hashlib.sha256(content).hexdigest()==frozen['desktop/scripts/wsl/'+name]
    payload[name]=base64.b64encode(content).decode()
backup=Path(r'D:\Inquello\backups')/('runtime-before-merged-usr-'+time.strftime('%Y%m%d-%H%M%S'))
backup.mkdir()
(backup/'metadata.json').write_text(json.dumps(before,indent=2))
host=Path(r'D:\Inquello\runtime\build-receipt.json')
assert json.loads(host.read_text())==before['manifest']
(backup/'host-build-receipt.json').write_bytes(host.read_bytes())
for index,name in enumerate(files):
    destination=backup/(str(index)+'-'+Path(name).name)
    program="import pathlib,shutil,sys; shutil.copyfileobj(pathlib.Path("+repr(name)+").open('rb'),sys.stdout.buffer)"
    with destination.open('xb') as out:
        r=subprocess.run(prefix+['inquello','--cd','/','--exec','/usr/bin/env','-i','PATH=/usr/bin:/bin','/usr/bin/python3','-I','-c',program],stdout=out,stderr=subprocess.PIPE,env=env,cwd=r'D:\Inquello\tmp',timeout=180)
    assert r.returncode==0,r.stderr
    with destination.open('rb') as f:assert hashlib.file_digest(f,'sha256').hexdigest()==before['files'][name]['sha256']
# Recheck quiescence, old metadata and candidate hashes after the backup.
assert call(probe,payload=data)==before
tree=ast.parse((repo/'desktop/scripts/wsl/install-runtime.py').read_text())
program=next(ast.literal_eval(n.value) for n in tree.body if isinstance(n,ast.Assign) and any(isinstance(t,ast.Name) and t.id=='program' for t in n.targets))
for old,new in [('/opt/inquello/build/build-receipt.json',target+'/merged-usr-build-receipt.json'),('/opt/inquello/build/target/debug',target+'/target/debug')]:
    assert program.count(old)==1
    program=program.replace(old,new)
(logs/'merged-usr-install-program.py').write_text(program)
manifest=call(program,user='root',payload=payload)
assert manifest['sourceArchiveSha256']==source and manifest['binaries']==before['receipt']['binaries']
temporary=host.with_suffix('.json.new')
with temporary.open('x') as f:json.dump(manifest,f,indent=2); f.flush();os.fsync(f.fileno())
temporary.replace(host)
after=call(probe,payload=data)
assert after['manifest']==manifest
for p,m in after['directories'].items():
    for key in ['uid','gid','mode','directory']:assert m[key]==before['directories'][p][key]
for p,m in after['files'].items():
    for key in ['uid','gid','mode','regular']:assert m[key]==before['files'][p][key]
    name=Path(p).name
    expected=manifest['binaries'].get(name) or manifest.get(name)
    if expected:assert m['sha256']==expected
assert json.loads(host.read_text())==manifest
(logs/'merged-usr-activation-verified.json').write_text(json.dumps({'status':'PASS','backup':str(backup),'source':source,'before':before,'after':after},indent=2))
print(json.dumps({'activation':'PASS','source':source,'backup':str(backup)}))
