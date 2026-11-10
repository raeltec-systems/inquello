"""Real bounded executor matrix; only synthetic files, no model/provider calls."""
import base64
import hashlib
import json
import os
from pathlib import Path
import queue
import subprocess
import threading
import time
import uuid

system = os.environ['SystemRoot']
proof = json.loads(Path(r'D:\Inquello\runtime\storage-proof.json').read_text())
scope = hashlib.sha256(('runtime-matrix-' + str(uuid.uuid4())).encode()).hexdigest()
task, sibling = str(uuid.uuid4()), str(uuid.uuid4())
root = f'/var/lib/inquello/tasks/{scope}/{task}'
env = {'SystemRoot': system, 'WINDIR': system, 'TEMP': r'D:\Inquello\tmp', 'TMP': r'D:\Inquello\tmp'}
prefix = [str(Path(system) / 'System32/wsl.exe'), '-d', 'Inquello-Engine', '--user', 'inquello', '--cd', '/',
          '--exec', '/usr/bin/env', '-i', 'PATH=/usr/bin:/bin', 'LANG=C.UTF-8']


def passed(name):
    print(json.dumps({'probe': name, 'passed': True}), flush=True)


def entry(name, content):
    return {'path': name, 'kind': 'file', 'data': base64.b64encode(content).decode(),
            'sha256': hashlib.sha256(content).hexdigest()}


def broker(request, selected=task, operation='transfer', succeeds=True):
    result = subprocess.run(prefix + ['/usr/bin/python3', '-I', '/usr/local/libexec/inquello-broker.py',
                            operation, scope, selected, proof['bootId']], input=json.dumps(request),
                            env=env, cwd=r'D:\Inquello\tmp', text=True, capture_output=True, timeout=45)
    if succeeds:
        assert result.returncode == 0, result.stderr
        return json.loads(result.stdout)
    assert result.returncode != 0, 'unsafe broker operation unexpectedly succeeded'
    return result.stderr


class Executor:
    def __init__(self, access='write'):
        self.access = access
        self.counter = 0
        self.responses = queue.Queue()
        self.errors = Path(r'D:\Inquello\logs\runtime-matrix-stderr.log').open('a')
        self.child = subprocess.Popen(prefix + ['/usr/local/libexec/inquello-executor', scope, task, proof['bootId'], access],
                                     stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=self.errors,
                                     env=env, cwd=r'D:\Inquello\tmp', text=True)
        def reader():
            for line in self.child.stdout:
                self.responses.put(line)
            self.responses.put(None)
        threading.Thread(target=reader, daemon=True).start()
        assert 'result' in self.rpc('initialize', {'clientName': 'inquello-runtime-matrix'})
        self.child.stdin.write(json.dumps({'jsonrpc': '2.0', 'method': 'initialized'}) + '\n')
        self.child.stdin.flush()

    def rpc(self, method, params):
        self.counter += 1
        self.child.stdin.write(json.dumps({'jsonrpc': '2.0', 'id': self.counter, 'method': method, 'params': params}) + '\n')
        self.child.stdin.flush()
        deadline = time.monotonic() + 40
        while True:
            line = self.responses.get(timeout=max(0.01, deadline - time.monotonic()))
            assert line, 'executor disconnected'
            response = json.loads(line)
            if response.get('id') == self.counter:
                return response

    def start(self, command, proxy=False):
        entries = [{'path': {'type': 'special', 'value': {'kind': 'minimal'}}, 'access': 'read'},
                   {'path': {'type': 'path', 'path': 'file://' + root}, 'access': self.access}]
        for binary in ['codex', 'codex-linux-sandbox', 'bwrap']:
            entries.append({'path': {'type': 'path', 'path': 'file:///opt/inquello/runtime/bin/' + binary}, 'access': 'read'})
        process = str(uuid.uuid4())
        params = {'processId': process, 'argv': command, 'cwd': 'file://' + root,
                  'env': {'PATH': '/usr/bin:/bin', 'HOME': root, 'LANG': 'C.UTF-8'}, 'tty': False, 'arg0': None,
                  'sandbox': {'permissions': {'type': 'managed', 'file_system': {'type': 'restricted', 'entries': entries}, 'network': 'restricted'},
                              'cwd': 'file://' + root, 'workspaceRoots': ['file://' + root], 'windowsSandboxLevel': 'disabled', 'useLegacyLandlock': False}}
        if proxy:
            params['enforceManagedNetwork'] = True
            params['networkProxy'] = {'proxy': {'enabled': True, 'enableSocks5': False, 'enableSocks5Udp': False,
                'allowUpstreamProxy': False, 'dangerouslyAllowAllUnixSockets': False, 'mode': 'full',
                'domains': {'example.com': 'allow'}, 'unixSockets': {}, 'allowLocalBinding': False}}
        response = self.rpc('process/start', params)
        assert response.get('result', {}).get('sandboxType') == 'linuxSeccomp', response
        return process

    def drain(self, process):
        seq = None
        output = b''
        deadline = time.monotonic() + 45
        while time.monotonic() < deadline:
            response = self.rpc('process/read', {'processId': process, 'afterSeq': seq, 'maxBytes': 65536, 'waitMs': 1000})
            assert 'result' in response, response
            result = response['result']
            seq = max(0, result['nextSeq'] - 1)
            for chunk in result['chunks']:
                output += base64.b64decode(chunk['chunk'])
            assert len(output) < 1024 * 1024, 'unexpected output volume'
            if result['closed'] and not result['chunks']:
                return result['exitCode'], output
        raise AssertionError('process did not finish')

    def run(self, script, proxy=False):
        return self.drain(self.start(['/bin/sh', '-c', script], proxy))

    def wait_for_growth(self, relative):
        # process/start acknowledges launch, not the descendant's first write.
        # Prove the detached writer is running before exercising cancellation.
        deadline = time.monotonic() + 20
        previous = None
        observed = None
        while time.monotonic() < deadline:
            observed = self.rpc('fs/readFile', {'path': 'file://' + root + '/' + relative})
            encoded = observed.get('result', {}).get('dataBase64')
            if encoded:
                current = base64.b64decode(encoded)
                if previous is not None and len(current) > len(previous):
                    return
                previous = current
            time.sleep(0.05)
        raise AssertionError(('detached writer did not produce a growing heartbeat', observed))

    def close(self):
        self.child.stdin.close()
        try:
            self.child.wait(timeout=20)
        except subprocess.TimeoutExpired:
            self.child.kill()
            raise
        finally:
            self.errors.close()


broker({'action': 'replace', 'entries': [entry('own.txt', b'own-data')]})
broker({'action': 'replace', 'entries': [entry('secret.txt', b'sibling-data')]}, sibling)
# Simulate the short exclusive lock used by trusted scope inventory/export.
# A new Task operation must wait for its release, preserving both lock owners.
holder = subprocess.Popen(prefix + ['/usr/bin/python3', '-I', '-c',
    "import fcntl,sys,time; f=open('/var/lib/inquello/locks/'+sys.argv[1]+'.lock','r+'); "
    "fcntl.flock(f,fcntl.LOCK_EX); print('locked',flush=True); time.sleep(5)", scope],
    env=env, cwd=r'D:\Inquello\tmp', stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
locked = queue.Queue()
threading.Thread(target=lambda: locked.put(holder.stdout.readline()), daemon=True).start()
try:
    assert locked.get(timeout=10).strip() == 'locked', 'scope lock fixture did not start'
    started = time.monotonic()
    assert broker({'action': 'idle'}) == {'idle': True}
    assert time.monotonic() - started >= 3, 'scope lock was not held through the overlap'
finally:
    holder.wait(timeout=10)
    holder.stdout.close()
    holder.stderr.close()
assert holder.returncode == 0
for entries in [[entry('../escape', b'bad')], [entry('a', b'1'), entry('A', b'2')],
                [entry('CON', b'bad')], [{'path': 'link', 'kind': 'symlink', 'target': '../other'}]]:
    broker({'action': 'replace', 'entries': entries}, succeeds=False)
assert any(e['path'] == 'own.txt' for e in broker({'action': 'snapshot'})['entries'])
passed('transfer-traversal-case-reserved-link-rejected-source-retained')

executor = Executor()
try:
    own = executor.rpc('fs/readFile', {'path': 'file://' + root + '/own.txt'})
    assert base64.b64decode(own['result']['dataBase64']) == b'own-data', own
    outside = executor.rpc('fs/readFile', {'path': f'file:///var/lib/inquello/tasks/{scope}/{sibling}/secret.txt'})
    assert 'error' in outside and outside['error']['code'] != -32602, outside
    passed('filesystem-rpc-positive-control-and-sibling-denial')
    broker({'action': 'snapshot'}, operation='scope', succeeds=False)
    passed('scope-snapshot-refuses-live-executor')
    code, output = executor.run("printf persisted > output/persisted.txt; cat output/persisted.txt")
    assert (code, output) == (0, b'persisted'), (code, output)
    code, output = executor.run("python3 -c \"print('x'*150000,end='')\"")
    assert code == 0 and output == b'x' * 150000, (code, len(output))
    for expected in [0, 7, 0]:
        assert executor.run(f'exit {expected}') == (expected, b'')
    passed('task-write-and-complete-paged-output')
    code, output = executor.run("for p in /init /mnt/c /mnt/wsl /proc/sys/fs/binfmt_misc/WSLInterop /usr/lib/wsl/lib/libdxcore.so; do if test -e \"$p\"; then printf 'unexpected:%s\\n' \"$p\"; exit 1; fi; done; grep -E 'NoNewPrivs:.*1|Seccomp:.*2|CapEff:.*0000000000000000' /proc/self/status")
    assert code == 0 and b'NoNewPrivs:' in output and b'Seccomp:' in output and b'CapEff:' in output, (code, output)
    code, output = executor.run("curl --noproxy '*' --connect-timeout 3 --max-time 4 -fsS https://example.com >/dev/null")
    assert code != 0, output
    passed('host-controls-hidden-and-direct-network-denied')
    code, output = executor.run("ln -s ../" + sibling + "/secret.txt output/escape; cat output/escape")
    assert code != 0 and b'sibling-data' not in output, (code, output)
    assert executor.run('rm output/escape; printf recovered') == (0, b'recovered')
    assert executor.run('cmd.exe /c echo unsafe')[0] != 0
    passed('symlink-escape-and-windows-executable-denied-then-recovery')
    code, output = executor.run("curl --connect-timeout 10 --max-time 20 -fsS https://example.com | head -c 500", proxy=True)
    assert code == 0 and b'Example Domain' in output, (code, output)
    code, output = executor.run("curl --connect-timeout 5 --max-time 8 -fsS https://example.org", proxy=True)
    assert code != 0, output
    passed('managed-proxy-allowed-host-and-denied-host')
    for script in [
        "curl --noproxy '*' --connect-timeout 2 --max-time 3 -fsS https://1.1.1.1",
        "curl --noproxy '*' --connect-timeout 2 --max-time 3 -fsS 'http://[2606:4700:4700::1111]'",
        "curl --noproxy '*' --connect-timeout 2 --max-time 3 -fsS http://127.0.0.1:2375/version",
        "curl --proxy http://127.0.0.1:2375 --connect-timeout 2 --max-time 3 -fsS https://example.com",
        "python3 -c \"import socket; s=socket.socket(socket.AF_INET,socket.SOCK_DGRAM); s.settimeout(1); s.sendto(b'\\0'*12,('1.1.1.1',53)); s.recv(512)\"",
    ]:
        code, output = executor.run(script, proxy=True)
        assert code != 0, (script, output)
    passed('direct-ipv4-ipv6-dns-loopback-alternate-proxy-denied')
    process = executor.start(['/bin/sh', '-c', "setsid /bin/sh -c 'while :; do printf x >> output/heartbeat; sleep 0.1; done' & wait"])
    executor.wait_for_growth('output/heartbeat')
    assert 'result' in executor.rpc('process/terminate', {'processId': process})
    executor.drain(process)
    time.sleep(0.2)
    first = executor.rpc('fs/readFile', {'path': 'file://' + root + '/output/heartbeat'})['result']['dataBase64']
    time.sleep(0.5)
    second = executor.rpc('fs/readFile', {'path': 'file://' + root + '/output/heartbeat'})['result']['dataBase64']
    assert first == second, 'detached descendant survived termination'
    assert executor.run('printf after-cancel') == (0, b'after-cancel')
    passed('cancellation-kills-detached-descendants-and-next-command-works')
finally:
    executor.close()

disconnected = Executor()
disconnected.start(['/bin/sh', '-c', "setsid /bin/sh -c 'while :; do printf x >> output/disconnect-heartbeat; sleep 0.1; done' & wait"])
disconnected.wait_for_growth('output/disconnect-heartbeat')
disconnected.close()
def heartbeat():
    return next(e['data'] for e in broker({'action': 'snapshot'})['entries'] if e['path'] == 'output/disconnect-heartbeat')
first = heartbeat()
time.sleep(0.5)
assert first == heartbeat(), 'detached descendant survived disconnect'
passed('disconnect-kills-detached-descendants-before-transfer')

readonly = Executor('read')
try:
    write = readonly.rpc('fs/writeFile', {'path': 'file://' + root + '/own.txt', 'dataBase64': base64.b64encode(b'changed').decode()})
    assert 'error' in write and write['error']['code'] != -32602, write
    assert readonly.run('printf changed > own.txt')[0] != 0
    assert base64.b64decode(readonly.rpc('fs/readFile', {'path': 'file://' + root + '/own.txt'})['result']['dataBase64']) == b'own-data'
    passed('readonly-server-rpc-and-command-write-denied')
finally:
    readonly.close()
snapshot = broker({'action': 'snapshot'}, operation='scope')
assert set(snapshot['tasks']) == {task, sibling}
assert any(e['path'] == 'output/persisted.txt' for e in snapshot['tasks'][task])
assert snapshot['transfers']
passed('scope-current-files-and-recovery-snapshots')
broker({'action': 'erase'}, operation='scope')
assert broker({'action': 'snapshot'}, operation='scope') == {'tasks': {}, 'transfers': {}}
passed('scope-erasure-confirmed')
