"""Exact sandboxed filesystem query diagnostic, fresh owned broker scope."""
import hashlib,json,os,subprocess,uuid,queue,threading
from pathlib import Path
base=Path(r'D:\Projects\inquello\_bmad-output\implementation-artifacts\verification-2026-11-05')
system=os.environ['SystemRoot']
proof=json.loads(Path(r'D:\Inquello\runtime\storage-proof.json').read_text())
scope=hashlib.sha256(('resolver-query-'+str(uuid.uuid4())).encode()).hexdigest()
task=str(uuid.uuid4())
env={'SystemRoot':system,'WINDIR':system,'TEMP':r'D:\Inquello\tmp','TMP':r'D:\Inquello\tmp'}
prefix=[str(Path(system)/'System32/wsl.exe'),'-d','Inquello-Engine','--user','inquello','--cd','/','--exec','/usr/bin/env','-i','PATH=/usr/bin:/bin','LANG=C.UTF-8']
def broker(operation,selected,request):
    p=subprocess.run(prefix+['/usr/bin/python3','-I','/usr/local/libexec/inquello-broker.py',operation,scope,selected,proof['bootId']],input=json.dumps(request),env=env,cwd=r'D:\Inquello\tmp',text=True,capture_output=True,timeout=45)
    assert p.returncode==0,p.stderr
    return json.loads(p.stdout)
child=None
stderr=None
try:
    print(json.dumps({'scope':scope,'task':task}),flush=True)
    broker('transfer',task,{'action':'initialize'})
    root=f'/var/lib/inquello/tasks/{scope}/{task}'
    stderr=(base/'guest-program-queries-stderr.log').open('x')
    child=subprocess.Popen(prefix+['/usr/local/libexec/inquello-executor',scope,task,proof['bootId'],'read'],stdin=subprocess.PIPE,stdout=subprocess.PIPE,stderr=stderr,env=env,cwd=r'D:\Inquello\tmp',text=True)
    responses=queue.Queue()
    def reader():
        for line in child.stdout: responses.put(line)
        responses.put(None)
    threading.Thread(target=reader,daemon=True).start()
    counter=0
    def rpc(method,params):
        global counter
        counter+=1
        child.stdin.write(json.dumps({'jsonrpc':'2.0','id':counter,'method':method,'params':params})+'\n');child.stdin.flush()
        while True:
            line=responses.get(timeout=30)
            assert line,'executor disconnected'
            value=json.loads(line)
            if value.get('id')==counter:return value
    initialized=rpc('initialize',{'clientName':'inquello-resolver-query-proof'})
    assert 'result' in initialized,initialized
    child.stdin.write('{"jsonrpc":"2.0","method":"initialized"}\n');child.stdin.flush()
    entries=[{'path':{'type':'special','value':{'kind':'minimal'}},'access':'read'},{'path':{'type':'path','path':'file://'+root},'access':'read'}]
    for name in ['codex','codex-linux-sandbox','bwrap']:
        entries.append({'path':{'type':'path','path':'file:///opt/inquello/runtime/bin/'+name},'access':'read'})
    for hidden in ['/usr/lib/modules','/usr/src','/usr/lib/linux-tools','/usr/lib/wsl']:
        entries.append({'path':{'type':'path','path':'file://'+hidden},'access':'deny'})
    sandbox={'permissions':{'type':'managed','file_system':{'type':'restricted','entries':entries},'network':'restricted'},'cwd':'file://'+root,'workspaceRoots':['file://'+root],'windowsSandboxLevel':'disabled','useLegacyLandlock':False}
    for path in ['/usr/bin/curl','/bin/curl','/usr/bin/sh','/bin/sh','/usr/bin/dash','/bin/dash']:
        for method in ['fs/getMetadata','fs/canonicalize']:
            params={'path':'file://'+path,'sandbox':sandbox}
            if method=='fs/getMetadata':params['followSymlinks']=True
            result=rpc(method,params)
            print(json.dumps({'path':path,'method':method,'response':result}),flush=True)
finally:
    if child:
        child.stdin.close()
        try:child.wait(timeout=15)
        except subprocess.TimeoutExpired:child.kill();child.wait();raise
    if stderr:stderr.close()
    result=broker('scope','00000000-0000-0000-0000-000000000000',{'action':'erase'})
    print(json.dumps({'cleanup':result}),flush=True)
    assert result.get('erased') is True,result
