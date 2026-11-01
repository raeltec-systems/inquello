#!/usr/bin/python3
"""Trusted fixed-function broker. No shell, archive extraction, or host mounts.

Installed root-owned. Runs as uid 1000. Transport is bounded JSON on stdin;
workload execution has a separate stdio stream and mandatory Rust sandbox.
"""
import base64
import ctypes
import errno
import fcntl
import hashlib
import json
import os
from pathlib import Path
import re
import resource
import signal
import shutil
import stat
import subprocess
import sys
import time
import unicodedata
import uuid

BASE = Path('/var/lib/inquello')
BIN = Path('/opt/inquello/runtime/bin')
LIMIT = 256 * 1024 * 1024
MAX_FILES = 10000


def directory(path):
    path.mkdir(mode=0o700, exist_ok=True)
    info = path.lstat()
    if not stat.S_ISDIR(info.st_mode) or info.st_uid != 1000 or info.st_mode & 0o077:
        raise ValueError('private guest directory is unsafe')


def lock_scope(descriptor, exclusive):
    if exclusive:
        # Inventory/export must not wait for a model or command to finish.
        fcntl.flock(descriptor, fcntl.LOCK_EX | fcntl.LOCK_NB)
        return
    # A trusted scope snapshot can briefly exclude a new Task operation. Wait
    # for that snapshot to release its lock instead of failing a fresh transfer
    # halfway through its journal. Active Tasks use shared scope locks, so this
    # does not wait for, or bypass, the exclusive per-Task execution lock.
    deadline = time.monotonic() + 10
    while True:
        try:
            fcntl.flock(descriptor, fcntl.LOCK_SH | fcntl.LOCK_NB)
            return
        except BlockingIOError:
            if time.monotonic() >= deadline:
                raise ValueError('Scope maintenance is still active; source retained')
            time.sleep(0.05)


def live(expected_boot):
    if os.getuid() != 1000 or os.geteuid() != 1000:
        raise ValueError('unprivileged executor required')
    if Path('/proc/sys/kernel/random/boot_id').read_text().strip() != expected_boot:
        raise ValueError('WSL boot changed; active D-drive swap must be proven again')
    # Boot hooks are asynchronous. A fresh mount snapshot, not a saved marker,
    # decides whether the current distribution is isolated.
    for _ in range(100):
        mounts = Path('/proc/self/mountinfo').read_text()
        if not any(x in mounts for x in [' /mnt/', ' /tmp/.X11-unix ', ' /usr/lib/wsl/', ' /proc/sys/fs/binfmt_misc ']):
            break
        time.sleep(0.1)
    else:
        raise ValueError('host/control mounts are still present')
    if any(os.environ.get(x) for x in ['WSL_INTEROP', 'WSLENV', 'DISPLAY', 'WAYLAND_DISPLAY', 'PULSE_SERVER']):
        raise ValueError('host transport environment is present')
    if 'enabled=false' not in Path('/etc/wsl.conf').read_text():
        raise ValueError('guest configuration is not hardened')
    swaps = Path('/proc/swaps').read_text().splitlines()[1:]
    if len(swaps) != 1 or int(swaps[0].split()[2]) != 4194304:
        raise ValueError('unexpected active shared swap')
    volume = os.statvfs(BASE)
    if volume.f_bavail * volume.f_frsize < 8 * 1024 ** 3:
        raise ValueError('guest storage is low')
    manifest_file = Path('/opt/inquello/runtime/manifest.json')
    info = manifest_file.lstat()
    if not stat.S_ISREG(info.st_mode) or info.st_uid != 0 or info.st_mode & 0o022:
        raise ValueError('runtime manifest is mutable')
    manifest = json.loads(manifest_file.read_text())
    binaries = manifest.get('binaries')
    if manifest.get('version') != 1 or not isinstance(binaries, dict) or set(binaries) != {'codex', 'codex-linux-sandbox', 'bwrap'}:
        raise ValueError('runtime binary manifest is incomplete')
    components = {**{BIN / name: digest for name, digest in binaries.items()},
                  Path('/usr/local/libexec/inquello-broker.py'): manifest.get('inquello-broker.py'),
                  Path('/usr/local/libexec/inquello-executor'): manifest.get('inquello-executor')}
    for file, digest in components.items():
        if not isinstance(digest, str) or not re.fullmatch('[0-9a-f]{64}', digest):
            raise ValueError('runtime component digest is missing')
        info = file.lstat()
        if not stat.S_ISREG(info.st_mode) or info.st_uid != 0 or info.st_mode & 0o022:
            raise ValueError('runtime component is mutable')
        with file.open('rb') as source:
            if hashlib.file_digest(source, 'sha256').hexdigest() != digest:
                raise ValueError('runtime component digest changed')


def safe_name(value):
    if not isinstance(value, str) or not value or len(value.encode('utf-8')) > 1024:
        raise ValueError('invalid transfer name')
    parts = value.split('/')
    for part in parts:
        if not part or part in ['.', '..'] or part[-1] in '. ' or unicodedata.normalize('NFC', part) != part:
            raise ValueError('unsafe transfer name')
        if re.search(r'[\\<>:"|?*\x00-\x1f\x7f]', part) or len(part.encode('utf-8')) > 240:
            raise ValueError('unsupported transfer name')
        if re.match(r'^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)', part, re.I):
            raise ValueError('Windows reserved transfer name')
    return parts


def snapshot(root):
    result = []
    seen = set()
    total = 0
    def visit(folder, prefix=''):
        nonlocal total
        before = folder.stat()
        for entry in sorted(os.scandir(folder), key=lambda x: x.name):
            name = prefix + entry.name
            safe_name(name)
            if name.casefold() in seen:
                raise ValueError('case-colliding transfer names')
            seen.add(name.casefold())
            info = entry.stat(follow_symlinks=False)
            if len(seen) > MAX_FILES:
                raise ValueError('transfer file quota exceeded')
            if stat.S_ISDIR(info.st_mode):
                result.append({'path': name, 'kind': 'directory'})
                visit(Path(entry.path), name + '/')
            elif stat.S_ISREG(info.st_mode) and info.st_nlink == 1:
                total += info.st_size
                if total > LIMIT:
                    raise ValueError('transfer byte quota exceeded')
                fd = os.open(entry.path, os.O_RDONLY | os.O_NOFOLLOW | os.O_NONBLOCK)
                with os.fdopen(fd, 'rb') as source:
                    opened = os.fstat(source.fileno())
                    if (opened.st_dev, opened.st_ino) != (info.st_dev, info.st_ino):
                        raise ValueError('source changed during transfer')
                    data = source.read(LIMIT + 1)
                    after = os.fstat(source.fileno())
                if len(data) != info.st_size or (after.st_mtime_ns, after.st_size) != (info.st_mtime_ns, info.st_size):
                    raise ValueError('source changed during transfer')
                result.append({'path': name, 'kind': 'file', 'data': base64.b64encode(data).decode('ascii'),
                               'sha256': hashlib.sha256(data).hexdigest()})
            else:
                raise ValueError('links, devices and special files cannot be transferred')
        if folder.stat().st_mtime_ns != before.st_mtime_ns:
            raise ValueError('source directory changed during transfer')
    if root.exists():
        if root.is_symlink() or not root.is_dir():
            raise ValueError('unsafe Task root')
        visit(root)
    return result


def publish(root, entries, transaction):
    if not isinstance(entries, list) or len(entries) > MAX_FILES:
        raise ValueError('transfer file quota exceeded')
    transaction.mkdir(mode=0o700)
    staging = transaction / 'staging'
    staging.mkdir(mode=0o700)
    seen = set()
    total = 0
    # Validate the entire manifest before creating any payload file.
    validated = []
    for entry in entries:
        parts = safe_name(entry['path'])
        key = entry['path'].casefold()
        if key in seen:
            raise ValueError('duplicate or case-colliding transfer name')
        seen.add(key)
        kind = entry['kind']
        if kind not in ['file', 'directory']:
            raise ValueError('unsupported transfer kind')
        data = base64.b64decode(entry['data'], validate=True) if kind == 'file' else None
        if data is not None:
            total += len(data)
            if total > LIMIT or hashlib.sha256(data).hexdigest() != entry['sha256']:
                raise ValueError('transfer quota or digest failure')
        validated.append((parts, kind, data))
    for parts, kind, data in sorted(validated, key=lambda x: (len(x[0]), x[0])):
        target = staging.joinpath(*parts)
        if kind == 'directory':
            target.mkdir(mode=0o700)
        else:
            with target.open('xb') as file:
                file.write(data)
                file.flush()
                os.fsync(file.fileno())
    (staging / 'output').mkdir(mode=0o700, exist_ok=True)
    # The journal precedes publication. Interrupted work retains both source
    # and staging/previous snapshots for recovery; nothing overwrites them.
    journal = transaction / 'journal.json'
    journal.write_text(json.dumps({'state': 'prepared', 'task': str(root)}))
    with journal.open('rb') as file:
        os.fsync(file.fileno())
    if root.exists():
        root.rename(transaction / 'previous')
    staging.rename(root)
    journal.write_text(json.dumps({'state': 'published', 'task': str(root)}))
    return {'published': True, 'transaction': transaction.name}


def executor(root, scope, task, access):
    # Adopt daemonized descendants, including grandchildren that change their
    # process group. The Task lock is not released until all are reaped.
    if ctypes.CDLL(None).prctl(36, 1, 0, 0, 0) != 0:
        raise ValueError('cannot establish executor descendant ownership')
    state = BASE / 'executor' / scope
    directory(state)
    state = state / task
    directory(state)
    env = {'PATH': '/usr/bin:/bin', 'HOME': str(state), 'CODEX_HOME': str(state),
           'LANG': 'C.UTF-8', 'TMPDIR': '/tmp', 'RUST_LOG': 'error'}
    # The server's filesystem RPCs must be confined too. This outer namespace
    # exposes only this Task, minimal read-only OS resources and private executor
    # state. Each command still receives the stricter inner seccomp/network
    # sandbox. The trusted server alone needs networking for its policy proxy.
    outer = [str(BIN / 'bwrap'), '--unshare-user', '--unshare-pid', '--unshare-ipc',
             '--unshare-uts', '--die-with-parent', '--new-session', '--cap-drop', 'ALL']
    for system in ['/usr', '/bin', '/sbin', '/lib', '/lib64', '/etc']:
        if Path(system).exists():
            outer += ['--ro-bind', system, system]
    for hidden in ['/usr/lib/modules', '/usr/src', '/usr/lib/linux-tools', '/usr/lib/wsl']:
        if Path(hidden).exists():
            outer += ['--tmpfs', hidden, '--remount-ro', hidden]
    outer += ['--proc', '/proc', '--dev', '/dev', '--tmpfs', '/tmp',
              '--ro-bind', str(BIN), str(BIN), '--bind' if access == 'write' else '--ro-bind', str(root), str(root),
              '--bind', str(state), str(state), '--chdir', str(root),
              '--', str(BIN / 'codex'), 'exec-server', '--listen', 'stdio',
              '--linux-sandbox-pid-namespace', 'isolate']
    child = subprocess.Popen(outer, cwd=root,
                             env=env, start_new_session=True)
    try:
        return child.wait()
    finally:
        # Repeatedly reap/kill adopted children. Never signal another scope.
        for _ in range(100):
            children = Path(f'/proc/{os.getpid()}/task/{os.getpid()}/children').read_text().split()
            if not children:
                break
            for pid in children:
                try:
                    os.kill(int(pid), signal.SIGKILL)
                except ProcessLookupError:
                    pass
            while True:
                try:
                    if os.waitpid(-1, os.WNOHANG)[0] == 0:
                        break
                except ChildProcessError:
                    break
            time.sleep(0.01)


def scope_operation(scope):
    request = json.loads(sys.stdin.buffer.read(4097))
    action = request.get('action')
    if action == 'snapshot':
        result = {'tasks': {}, 'transfers': {}}
        total = 0
        count = 0
        for category, base in [('tasks', 'tasks'), ('transfers', 'transfers')]:
            for child in sorted((BASE / base / scope).iterdir()):
                if str(uuid.UUID(child.name)) != child.name:
                    raise ValueError('invalid scoped data identity')
                entries = snapshot(child)
                count += len(entries)
                total += sum(len(entry.get('data', '')) for entry in entries)
                if count > MAX_FILES or total > LIMIT * 4 // 3:
                    raise ValueError('scope export quota exceeded')
                result[category][child.name] = entries
    elif action == 'erase':
        if not shutil.rmtree.avoids_symlink_attacks:
            raise ValueError('safe scoped deletion is unavailable')
        # The caller stopped its runtime and explicitly authorized local Task
        # deletion. Exclusive scope lock excludes all executors and transfers.
        # Lock files remain outside deleted trees so another process cannot
        # acquire a replacement lock while deletion is in progress.
        for category in ['tasks', 'transfers', 'executor']:
            target = BASE / category / scope
            directory(target)
            if target.resolve() != target:
                raise ValueError('unsafe scope deletion path')
            shutil.rmtree(target)
        for marker in (BASE / 'locks' / scope).glob('*.transition'):
            if marker.is_symlink() or not marker.is_file():
                raise ValueError('unsafe transition marker during deletion')
            marker.unlink()
        result = {'erased': True}
    else:
        raise ValueError('unknown scope operation')
    print(json.dumps(result, separators=(',', ':')))
    return 0


def main():
    os.umask(0o077)
    resource.setrlimit(resource.RLIMIT_CORE, (0, 0))
    operation, scope, task, boot = sys.argv[1:5]
    access = sys.argv[5] if len(sys.argv) == 6 else None
    if operation not in ['exec', 'transfer', 'scope'] or not re.fullmatch('[0-9a-f]{64}', scope) or str(uuid.UUID(task)) != task:
        raise ValueError('invalid broker identity')
    live(boot)
    for parent in ['tasks', 'locks', 'transfers', 'executor']:
        directory(BASE / parent)
        directory(BASE / parent / scope)
    scope_lock = os.open(BASE / 'locks' / (scope + '.lock'), os.O_CREAT | os.O_RDWR | os.O_NOFOLLOW, 0o600)
    with os.fdopen(scope_lock, 'r+'):
        lock_scope(scope_lock, operation == 'scope')
        if operation == 'scope':
            return scope_operation(scope)
        return task_operation(operation, scope, task, access)


def task_operation(operation, scope, task, access):
    root = BASE / 'tasks' / scope / task
    marker = BASE / 'locks' / scope / (task + '.transition')
    lock = os.open(BASE / 'locks' / scope / (task + '.lock'), os.O_CREAT | os.O_RDWR | os.O_NOFOLLOW, 0o600)
    with os.fdopen(lock, 'r+'):
        fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        if operation == 'exec':
            if marker.exists():
                raise ValueError('Task file transition requires completion or recovery')
            if access not in ['read', 'write']:
                raise ValueError('explicit Task access required')
            if root.is_symlink() or not root.is_dir():
                raise ValueError('Task transfer not published')
            return executor(root, scope, task, access)
        raw = sys.stdin.buffer.read(LIMIT * 2 + 1)
        if len(raw) > LIMIT * 2:
            raise ValueError('transfer request quota exceeded')
        request = json.loads(raw)
        action = request.get('action')
        transition = request.get('transition')
        if action in ['prepare', 'complete']:
            if not isinstance(transition, str) or str(uuid.UUID(transition)) != transition:
                raise ValueError('invalid transition identity')
        if marker.exists():
            if marker.is_symlink() or not marker.is_file():
                raise ValueError('unsafe transition marker')
            current = marker.read_text()
            if action not in ['snapshot', 'idle'] and transition != current:
                raise ValueError('Task transition is locked for recovery')
        if action == 'prepare':
            if not marker.exists():
                with marker.open('x') as file:
                    file.write(transition)
                    file.flush()
                    os.fsync(file.fileno())
            result = {'prepared': True}
        elif action == 'complete':
            if not marker.exists():
                raise ValueError('Task transition marker missing')
            marker.unlink()
            result = {'completed': True}
        elif action == 'snapshot':
            result = {'entries': snapshot(root)}
        elif action == 'idle':
            result = {'idle': True}
        elif action == 'initialize':
            # Only a newly reserved, empty host Task may use this operation.
            # Existing guest Tasks are never replaced by initialization.
            if not root.exists():
                root.mkdir(mode=0o700)
                (root / 'output').mkdir(mode=0o700)
            directory(root)
            result = {'initialized': True}
        elif action == 'replace':
            result = publish(root, request['entries'], BASE / 'transfers' / scope / str(uuid.uuid4()))
        elif action == 'retire':
            # Recoverable retirement; deletion of data is explicit and separately
            # governed by the desktop account's deletion workflow.
            destination = BASE / 'transfers' / scope / str(uuid.uuid4())
            destination.mkdir(mode=0o700)
            if root.exists():
                root.rename(destination / 'previous')
            result = {'retired': True, 'transaction': destination.name}
        else:
            raise ValueError('unknown broker operation')
        print(json.dumps(result, separators=(',', ':')))
        return 0


if __name__ == '__main__':
    try:
        sys.exit(main())
    except Exception as error:
        print('Inquello guest unavailable: ' + str(error), file=sys.stderr)
        sys.exit(70)
