"""Send a trusted repository source archive into the guest over stdin.

This is provisioning, not the Task file-transfer API. Input must match the
operator-recorded digest of the git archive; no guest archive is ever extracted
on Windows, and no host directory is mounted.
"""
import argparse
import hashlib
import os
from pathlib import Path
import subprocess
import sys
import json
import re

parser = argparse.ArgumentParser()
parser.add_argument('archive', type=Path)
parser.add_argument('--sha256', required=True)
args = parser.parse_args()
if not re.fullmatch('[0-9a-f]{64}', args.sha256):
    raise ValueError('Invalid source digest')
if args.archive.drive.lower() != 'd:' or not args.archive.is_absolute():
    raise ValueError('Source staging must be on D:')
with args.archive.open('rb') as source:
    if hashlib.file_digest(source, 'sha256').hexdigest() != args.sha256:
        raise ValueError('Source archive digest mismatch')
    source.seek(0)
    system = os.environ['SystemRoot']
    env = {name: system for name in ['SystemRoot', 'WINDIR']}
    env.update({name: 'D:\\Inquello\\tmp' for name in ['TEMP', 'TMP', 'TMPDIR']})
    program = '''import hashlib, pathlib, sys, tarfile
digest = sys.argv[1]
root = pathlib.Path('/opt/inquello/build/sources')
root.mkdir(mode=0o700, exist_ok=True)
archive = root / (digest + '.tar')
with archive.open('xb') as target:
    while chunk := sys.stdin.buffer.read(1024 * 1024):
        target.write(chunk)
with archive.open('rb') as source:
    assert hashlib.file_digest(source, 'sha256').hexdigest() == digest
destination = root / digest
destination.mkdir(mode=0o700)
with tarfile.open(archive) as source:
    source.extractall(destination, filter='data')
(root / 'selected-source').write_text(digest)
print('source-staged:' + digest)
'''
    command = [str(Path(system) / 'System32/wsl.exe'), '--distribution', 'Inquello-Engine', '--user', 'inquello', '--cd', '/', '--exec',
               '/usr/bin/env', '-i', 'HOME=/home/inquello', 'PATH=/usr/bin:/bin', 'TMPDIR=/tmp',
               '/usr/bin/python3', '-I', '-c', program, args.sha256]
    result = subprocess.run(command, stdin=source, env=env, cwd='D:\\Inquello\\tmp', creationflags=subprocess.CREATE_NO_WINDOW)
sys.exit(result.returncode)
