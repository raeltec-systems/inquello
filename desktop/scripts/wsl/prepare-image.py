"""Create a deterministic first-boot-safe WSL image without host extraction.

This is trusted distro image preparation, never the Task file-transfer broker.
The source is the pinned, signature-verified Canonical archive. Both artifacts
stay on D:. No guest or host command from the archive is executed.
"""
import argparse
import hashlib
import io
import json
import os
import shutil
from pathlib import Path, PurePosixPath
import tarfile


def d_path(value: str) -> Path:
    result = Path(value)
    if result.drive.lower() != 'd:' or not result.is_absolute():
        raise ValueError('Image paths must be absolute D: paths')
    for item in [result, *result.parents]:
        if item.is_symlink() or (hasattr(item, 'is_junction') and item.is_junction()):
            raise ValueError('Redirected image paths are forbidden')
    return result


def sha256(file: Path) -> str:
    with file.open('rb') as source:
        return hashlib.file_digest(source, 'sha256').hexdigest()


def prepare(source: Path, output: Path) -> dict:
    if shutil.disk_usage('D:\\').free < 32 * 1024 ** 3:
        raise ValueError('Image preparation needs at least 32 GiB free on D:')
    root = Path(__file__).parent
    manifest = json.loads((root / 'build-manifest.json').read_text())
    if sha256(source) != manifest['image']['sha256']:
        raise ValueError('Source image differs from pinned verified image')
    if output.exists():
        raise ValueError('Output already exists; preserve it and choose another path')
    replacements = {
        'etc/wsl.conf': (root / 'wsl.conf').read_bytes().replace(b'\r\n', b'\n'),
        'etc/wsl-distribution.conf': b'[oobe]\ncommand=/bin/true\ndefaultUid=1000\ndefaultName=Inquello-Engine\n',
        'etc/fstab': b'# Inquello does not mount host filesystems.\n',
        'usr/local/sbin/inquello-guest-init': (root / 'guest-init.sh').read_bytes().replace(b'\r\n', b'\n'),
    }
    additions = {
        'etc/passwd': b'inquello:x:1000:1000:Inquello executor:/home/inquello:/bin/bash\n',
        'etc/group': b'inquello:x:1000:\n',
        'etc/shadow': b'inquello:!:20000:0:99999:7:::\n',
        'etc/gshadow': b'inquello:!::\n',
    }
    directories = ['home/inquello', 'var/lib/inquello', 'var/lib/inquello/tasks', 'var/lib/inquello/executor']
    seen = set()
    # 'x' creates without replacement. Uncompressed tar keeps deterministic
    # metadata and avoids a timestamp-dependent gzip wrapper; WSL accepts tar.
    with source.open('rb') as compressed, tarfile.open(fileobj=compressed, mode='r:gz') as incoming, output.open('xb') as target, tarfile.open(fileobj=target, mode='w', format=tarfile.PAX_FORMAT) as outgoing:
        for member in incoming:
            name = str(PurePosixPath(member.name))
            if name.startswith('/') or '..' in PurePosixPath(name).parts or name in seen:
                raise ValueError(f'Unsafe or duplicate distro archive entry: {name}')
            seen.add(name)
            if name in replacements or name in directories:
                continue
            data = incoming.extractfile(member) if member.isfile() else None
            if name in additions:
                if data is None:
                    raise ValueError(f'Account database is not regular: {name}')
                previous = data.read()
                if b'inquello:' in previous or any(line.split(b':')[2:3] == [b'1000'] for line in previous.splitlines()):
                    raise ValueError('Executor account collides with base image')
                content = previous.rstrip(b'\n') + b'\n' + additions.pop(name)
                member.size = len(content)
                data = io.BytesIO(content)
            # No inherited setuid/setgid executables in the initial image.
            member.mode &= ~0o6000
            outgoing.addfile(member, data)
        if additions:
            raise ValueError('Base image account databases missing')
        for name, content in replacements.items():
            member = tarfile.TarInfo(name)
            member.mode = 0o755 if name == 'usr/local/sbin/inquello-guest-init' else 0o644
            member.size = len(content)
            outgoing.addfile(member, io.BytesIO(content))
        for name in directories:
            member = tarfile.TarInfo(name)
            member.type = tarfile.DIRTYPE
            member.mode = 0o700
            member.uid = member.gid = 1000
            outgoing.addfile(member)
    return {
        'sourceSha256': manifest['image']['sha256'],
        'preparedSha256': sha256(output),
        'preparedBytes': output.stat().st_size,
        'automount': False,
        'mountFsTab': False,
        'interop': False,
        'defaultUid': 1000,
        'launched': False,
    }


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('source', type=d_path)
    parser.add_argument('output', type=d_path)
    args = parser.parse_args()
    for name in ['TEMP', 'TMP', 'TMPDIR']:
        d_path(os.environ[name])
    result = prepare(args.source, args.output)
    args.output.with_suffix('.receipt.json').write_text(json.dumps(result, indent=2) + '\n')
    print(json.dumps(result, indent=2))
