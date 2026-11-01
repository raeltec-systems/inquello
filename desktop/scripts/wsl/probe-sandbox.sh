#!/bin/sh
# Early real-helper gate. This is not the complete bridge/network/transfer suite.
set -eu
test "$(id -u)" = 1000
ulimit -c 0
python3 - <<'PY'
import json
import os
from pathlib import Path
import subprocess
import tempfile

helpers = Path('/opt/inquello/build/target/debug')
sandbox = helpers / 'codex-linux-sandbox'
assert sandbox.is_file(), 'sandbox helper missing'
base = Path(tempfile.mkdtemp(prefix='isolation-proof-', dir='/var/lib/inquello/tasks'))
task = base / 'task'
other = base / 'other'
(task / 'output').mkdir(parents=True)
other.mkdir()
(other / 'secret.txt').write_text('synthetic other-task content')
(task / 'escape').symlink_to(other, target_is_directory=True)
entries = [{'path': {'type': 'special', 'value': {'kind': 'minimal'}}, 'access': 'read'}]
for helper in ['codex-linux-sandbox', 'bwrap']:
    entries.append({'path': {'type': 'path', 'path': str(helpers / helper)}, 'access': 'read'})
entries.append({'path': {'type': 'path', 'path': str(task)}, 'access': 'write'})
for forbidden in ['/usr/lib/modules', '/usr/src', '/usr/lib/linux-tools', '/usr/lib/wsl']:
    entries.append({'path': {'type': 'path', 'path': forbidden}, 'access': 'deny'})
profile = {'type': 'managed', 'file_system': {'type': 'restricted', 'entries': entries}, 'network': 'restricted'}

def run(argv, readonly=False):
    selected = json.loads(json.dumps(profile))
    if readonly:
        for entry in selected['file_system']['entries']:
            if entry['access'] == 'write':
                entry['access'] = 'read'
    result = subprocess.run([str(sandbox), '--sandbox-policy-cwd', str(task), '--permission-profile', json.dumps(selected), '--', *argv],
        cwd=task, env={'PATH': '/usr/bin:/bin', 'HOME': '/nonexistent', 'TMPDIR': '/tmp', 'LANG': 'C.UTF-8'},
        capture_output=True, text=True, timeout=30)
    return result

def success(name, argv, readonly=False):
    result = run(argv, readonly)
    assert result.returncode == 0, f'{name}: exit {result.returncode}\n{result.stderr}\n{result.stdout}'
    print(json.dumps({'probe': name, 'passed': True, 'stdout': result.stdout.strip()}), flush=True)

success('inside-write', ['/bin/sh', '-c', 'printf persisted > output/allowed.txt'])
assert (task / 'output/allowed.txt').read_text() == 'persisted'
result = run(['/bin/cat', str(other / 'secret.txt')])
assert result.returncode != 0 and 'synthetic other-task content' not in result.stdout
print(json.dumps({'probe': 'outside-read', 'passed': True}), flush=True)
result = run(['/bin/sh', '-c', 'printf escaped > escape/bad.txt'])
assert result.returncode != 0 and not (other / 'bad.txt').exists()
print(json.dumps({'probe': 'symlink-escape', 'passed': True}), flush=True)
result = run(['/bin/sh', '-c', 'printf changed > output/readonly.txt'], readonly=True)
assert result.returncode != 0 and not (task / 'output/readonly.txt').exists()
print(json.dumps({'probe': 'readonly-write', 'passed': True}), flush=True)
success('hidden-host-and-control-paths', ['/usr/bin/python3', '-c', '''
import os
for path in ['/mnt/c', '/mnt/d', '/mnt/wsl', '/mnt/wslg', '/tmp/.X11-unix', '/init', '/proc/sys/fs/binfmt_misc/WSLInterop', '/var/lib/inquello/executor', '/home/inquello/.cargo']:
    assert not os.path.exists(path), path
status = dict(line.split(':', 1) for line in open('/proc/self/status') if ':' in line)
assert status['NoNewPrivs'].strip() == '1', status['NoNewPrivs']
assert status['Seccomp'].strip() == '2', status['Seccomp']
assert int(status['CapEff'].strip(), 16) == 0, status['CapEff']
print('no_new_privs=1 seccomp=2 capabilities=0')
'''])
success('direct-network-denied', ['/usr/bin/python3', '-c', '''
import socket, errno
for family, address in [(socket.AF_INET, ('1.1.1.1', 443)), (socket.AF_INET, ('127.0.0.1', 80)), (socket.AF_INET6, ('::1', 80))]:
    try:
        s = socket.socket(family, socket.SOCK_STREAM)
        s.settimeout(1)
        s.connect(address)
    except OSError as error:
        assert error.errno in (errno.EPERM, errno.EACCES), repr(error)
        continue
    raise AssertionError('unexpected direct network access')
'''])
success('continue-after-denials', ['/bin/cat', 'output/allowed.txt'])
print(json.dumps({'earlyIsolationGate': 'passed', 'taskProofPath': str(task), 'completeSpecGate': False}), flush=True)
PY
