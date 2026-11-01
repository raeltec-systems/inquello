"""Real stdio executor filesystem/inner sandbox gate (no provider/model calls)."""
import base64
import hashlib
import json
import os
from pathlib import Path
import subprocess
import uuid
import queue
import threading

system = os.environ['SystemRoot']
proof = json.loads(Path(r'D:\Inquello\runtime\storage-proof.json').read_text())
scope = hashlib.sha256(('executor-proof-' + str(uuid.uuid4())).encode()).hexdigest()
task, other = str(uuid.uuid4()), str(uuid.uuid4())
env = {'SystemRoot': system, 'WINDIR': system, 'TEMP': r'D:\Inquello\tmp', 'TMP': r'D:\Inquello\tmp'}
prefix = [str(Path(system) / 'System32/wsl.exe'), '-d', 'Inquello-Engine', '--user', 'inquello', '--cd', '/',
          '--exec', '/usr/bin/env', '-i', 'PATH=/usr/bin:/bin', 'LANG=C.UTF-8']

def broker(selected, request):
    result = subprocess.run(prefix + ['/usr/bin/python3', '-I', '/usr/local/libexec/inquello-broker.py',
                            'transfer', scope, selected, proof['bootId']], input=json.dumps(request),
                            env=env, cwd=r'D:\Inquello\tmp', text=True, capture_output=True, timeout=45)
    assert result.returncode == 0, result.stderr
    return json.loads(result.stdout)

broker(task, {'action': 'initialize'})
secret = b'synthetic-other-task'
broker(other, {'action': 'replace', 'entries': [{'path': 'secret.txt', 'kind': 'file',
       'data': base64.b64encode(secret).decode(), 'sha256': hashlib.sha256(secret).hexdigest()}]})
root = f'/var/lib/inquello/tasks/{scope}/{task}'
stderr = Path(r'D:\Inquello\logs\executor-proof-stderr.log').open('w')
child = subprocess.Popen(prefix + ['/usr/local/libexec/inquello-executor', scope, task, proof['bootId'], 'write'],
                         stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=stderr,
                         env=env, cwd=r'D:\Inquello\tmp', text=True)
counter = 0
responses = queue.Queue()
def read_responses():
    for line in child.stdout:
        responses.put(line)
    responses.put(None)
threading.Thread(target=read_responses, daemon=True).start()
def rpc(method, params):
    global counter
    counter += 1
    child.stdin.write(json.dumps({'jsonrpc':'2.0','id':counter,'method':method,'params':params})+'\n')
    child.stdin.flush()
    while True:
        try:
            line = responses.get(timeout=30)
        except queue.Empty:
            raise AssertionError('executor RPC timed out')
        assert line, 'executor disconnected; inspect D:/Inquello/logs/executor-proof-stderr.log'
        value = json.loads(line)
        if value.get('id') == counter:
            return value

try:
    initialized = rpc('initialize', {'clientName':'inquello-executor-proof'})
    assert 'result' in initialized, initialized
    child.stdin.write(json.dumps({'jsonrpc':'2.0','method':'initialized'})+'\n'); child.stdin.flush()
    outside = rpc('fs/readFile', {'path':f'file:///var/lib/inquello/tasks/{scope}/{other}/secret.txt'})
    assert 'error' in outside and secret.decode() not in json.dumps(outside), outside
    print(json.dumps({'probe':'executor-filesystem-sibling-denied','passed':True}), flush=True)
    entries = [{'path':{'type':'special','value':{'kind':'minimal'}},'access':'read'},
               {'path':{'type':'path','path':'file://'+root},'access':'write'}]
    for name in ['codex','codex-linux-sandbox','bwrap']:
        entries.append({'path':{'type':'path','path':'file:///opt/inquello/runtime/bin/'+name},'access':'read'})
    process = str(uuid.uuid4())
    response = rpc('process/start', {'processId':process,'argv':['/bin/sh','-c','printf persisted > output/executor.txt; cat output/executor.txt'],
       'cwd':'file://'+root,'env':{'PATH':'/usr/bin:/bin','HOME':root,'LANG':'C.UTF-8'},'tty':False,'arg0':None,
       'sandbox':{'permissions':{'type':'managed','file_system':{'type':'restricted','entries':entries},'network':'restricted'},
                  'cwd':'file://'+root,'workspaceRoots':['file://'+root],'windowsSandboxLevel':'disabled','useLegacyLandlock':False}})
    assert response.get('result',{}).get('sandboxType') == 'linuxSeccomp', response
    seq = None
    output = b''
    while True:
        result = rpc('process/read',{'processId':process,'afterSeq':seq,'maxBytes':65536,'waitMs':1000})
        assert 'result' in result, result
        result = result['result']; seq = max(0, result['nextSeq'] - 1)
        for chunk in result['chunks']: output += base64.b64decode(chunk['chunk'])
        if result['closed'] and not result['chunks']:
            assert result['exitCode'] == 0, (result, output)
            break
    assert output == b'persisted', output
    print(json.dumps({'probe':'nested-task-sandbox-write','passed':True}), flush=True)
finally:
    child.stdin.close()
    try: child.wait(timeout=15)
    except subprocess.TimeoutExpired: child.kill(); raise
    stderr.close()
snapshot = broker(task, {'action':'snapshot'})
assert any(e['path']=='output/executor.txt' for e in snapshot['entries'])
print(json.dumps({'probe':'executor-disconnect-releases-transfer-lock','passed':True}), flush=True)
