"""Operator-only provisioning transport. Never expose this to a renderer/tool.

Scripts travel over stdin; no host drives, inherited secrets or WSLENV are used.
This is deliberately separate from the future mandatory-sandbox exec bridge.
"""
import argparse
import os
from pathlib import Path
import subprocess
import sys

parser = argparse.ArgumentParser()
parser.add_argument('script', type=Path)
parser.add_argument('--user', choices=['inquello', 'root'], default='inquello')
args = parser.parse_args()
root = Path(__file__).resolve().parent
script = args.script.resolve()
if script.parent != root or script.suffix != '.sh':
    raise ValueError('Only checked-in provisioning shell scripts are accepted')
system = os.environ['SystemRoot']
env = {name: system for name in ['SystemRoot', 'WINDIR']}
env.update({name: 'D:\\Inquello\\tmp' for name in ['TEMP', 'TMP', 'TMPDIR']})
command = [str(Path(system) / 'System32/wsl.exe'), '--distribution', 'Inquello-Engine', '--user', args.user, '--cd', '/', '--exec',
           '/usr/bin/env', '-i', f'HOME={"/root" if args.user == "root" else "/home/inquello"}',
           'PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin', 'LANG=C.UTF-8', 'TMPDIR=/tmp', '/bin/sh', '-s']
result = subprocess.run(command, input=script.read_bytes().replace(b'\r\n', b'\n'), env=env, cwd='D:\\Inquello\\tmp', creationflags=subprocess.CREATE_NO_WINDOW)
sys.exit(result.returncode)
