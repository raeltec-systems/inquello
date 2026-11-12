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
# The Task profile's hidden paths (`app-server/src/inquello_wsl.rs`), including
# the guest's system socket locations (Story 2.1, owner decision 2026-11-11).
for forbidden in ['/usr/lib/modules', '/usr/src', '/usr/lib/linux-tools', '/usr/lib/wsl', '/run', '/var/run', '/tmp/.X11-unix', '/mnt/wslg']:
    entries.append({'path': {'type': 'path', 'path': forbidden}, 'access': 'deny'})
profile = {'type': 'managed', 'file_system': {'type': 'restricted', 'entries': entries}, 'network': 'restricted'}
# A private Task command's managed network: proxy-routed, with the one grant of
# local (Unix) sockets. The proxy endpoint is a closed loopback port.
MANAGED = {'loopbackPorts': [9], 'allowLocalBinding': False, 'allowUnixSockets': [], 'dangerouslyAllowAllUnixSockets': True}

# Fails when any socket the command did not create is reachable or connectable
# from inside the sandbox, or when the command cannot create and use its own.
# `test/sources-sandbox.test.ts` runs this same text through the real Task path.
SOCKET_CHECK = r'''
import json, os, socket, stat
foreign, connectable, hidden = [], [], []
for location in ['/run', '/var/run', '/tmp/.X11-unix', '/mnt/wslg', '/run/WSL', '/run/dbus/system_bus_socket']:
    try:
        if os.path.exists(location) and (not os.path.isdir(location) or os.listdir(location)):
            hidden.append(location)
    except PermissionError:
        pass  # an empty mask that cannot be listed
def walk(top):
    try:
        names = os.listdir(top)
    except OSError:
        return
    for name in names:
        path = os.path.join(top, name)
        if path in ('/proc', '/sys'):
            continue
        try:
            info = os.lstat(path)
        except OSError:
            continue
        if stat.S_ISSOCK(info.st_mode):
            foreign.append(path)
        elif stat.S_ISDIR(info.st_mode):
            walk(path)
walk('/')
known = []
try:
    for line in open('/proc/net/unix').read().splitlines()[1:]:
        fields = line.split()
        if len(fields) >= 8:
            known.append(fields[7])
except OSError:
    pass
for address in foreign + known:
    try:
        probe = socket.socket(socket.AF_UNIX, socket.SOCK_STREAM)
    except OSError:
        break
    probe.settimeout(1)
    try:
        probe.connect('\0' + address[1:] if address.startswith('@') else address)
        connectable.append(address)
    except OSError:
        pass
    finally:
        probe.close()
own = False
name = 'own-socket-check-%d.sock' % os.getpid()
try:
    server = socket.socket(socket.AF_UNIX, socket.SOCK_STREAM)
    server.bind(name)
    server.listen(1)
    client = socket.socket(socket.AF_UNIX, socket.SOCK_STREAM)
    client.connect(name)
    peer, _ = server.accept()
    client.sendall(b'ping')
    own = peer.recv(4) == b'ping'
    for item in (peer, client, server):
        item.close()
finally:
    if os.path.lexists(name):
        os.unlink(name)
print(json.dumps({'foreign': foreign, 'connectable': connectable, 'hidden': hidden, 'own': own}))
raise SystemExit(0 if own and not foreign and not connectable and not hidden else 1)
'''

def run(argv, readonly=False, managed=False):
    selected = json.loads(json.dumps(profile))
    if readonly:
        for entry in selected['file_system']['entries']:
            if entry['access'] == 'write':
                entry['access'] = 'read'
    network = ['--managed-network', json.dumps(MANAGED)] if managed else []
    env = {'PATH': '/usr/bin:/bin', 'HOME': '/nonexistent', 'TMPDIR': '/tmp', 'LANG': 'C.UTF-8'}
    if managed:
        env.update({'HTTP_PROXY': 'http://127.0.0.1:9', 'HTTPS_PROXY': 'http://127.0.0.1:9', 'ALL_PROXY': 'http://127.0.0.1:9'})
    result = subprocess.run([str(sandbox), '--sandbox-policy-cwd', str(task), '--permission-profile', json.dumps(selected), *network, '--', *argv],
        cwd=task, env=env, capture_output=True, text=True, timeout=120)
    return result

def success(name, argv, readonly=False, managed=False):
    result = run(argv, readonly, managed)
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
for path in ['/mnt/c', '/mnt/d', '/mnt/wsl', '/init', '/proc/sys/fs/binfmt_misc/WSLInterop', '/var/lib/inquello/executor', '/home/inquello/.cargo']:
    assert not os.path.exists(path), path
# Denied by the Task profile: absent, or (when the helper itself sees them) an
# empty mask that cannot be listed.
for path in ['/mnt/wslg', '/tmp/.X11-unix', '/run', '/var/run']:
    if os.path.exists(path):
        try:
            assert os.listdir(path) == [], path
        except PermissionError:
            pass
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
success('socket-isolation', ['/usr/bin/python3', '-I', '-c', SOCKET_CHECK], managed=True)
# The check itself must catch a socket the command did not create: one bound
# from outside the sandbox in the Task folder is found and refused.
import socket
outside = socket.socket(socket.AF_UNIX, socket.SOCK_STREAM)
outside.bind(str(task / 'outside.sock'))
outside.listen(1)
result = run(['/usr/bin/python3', '-I', '-c', SOCKET_CHECK], managed=True)
outside.close()
(task / 'outside.sock').unlink()
assert result.returncode == 1 and str(task / 'outside.sock') in json.loads(result.stdout)['foreign'], f'socket check missed an outside socket: {result.stdout}{result.stderr}'
print(json.dumps({'probe': 'socket-isolation-detects-outside-socket', 'passed': True}), flush=True)
success('continue-after-denials', ['/bin/cat', 'output/allowed.txt'])
print(json.dumps({'earlyIsolationGate': 'passed', 'taskProofPath': str(task), 'completeSpecGate': False}), flush=True)
PY
