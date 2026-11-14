"""Offline source-matched Linux retained-runtime gates. No install or activation."""
from pathlib import Path
import json, os, subprocess, sys
repo = Path(r'D:\Projects\inquello')
base = repo / '_bmad-output/implementation-artifacts/verification-2026-11-05'
if (base / 'defer-retained-runtime-20261106.flag').exists():
    print('RETAINED_RUNTIME_DEFERRED_FOR_PRIORITY_LENDING', flush=True)
    sys.exit(75)
system = os.environ['SystemRoot']
env = {'SystemRoot': system, 'WINDIR': system, 'TEMP': r'D:\Inquello\tmp', 'TMP': r'D:\Inquello\tmp', 'TMPDIR': r'D:\Inquello\tmp'}
freeze_env = dict(env)
freeze_env['PATH'] = r'C:\Program Files\Git\cmd' + os.pathsep + str(Path(system) / 'System32')
record = json.loads(subprocess.check_output([sys.executable, str(repo / 'desktop/scripts/wsl/freeze-source.py')], cwd=repo, env=freeze_env, text=True))
(base / 'retained-runtime-source-20261106.json').write_text(json.dumps(record, indent=2), encoding='utf-8')
subprocess.run([sys.executable, str(repo / 'desktop/scripts/wsl/stage-source.py'), record['archive'], '--sha256', record['sourceSha256']], cwd=repo, env=env, check=True)
script = (repo / 'desktop/scripts/wsl/build-guest.sh').read_text().split('# Build the platform sandbox first')[0]
assert script.count('export CARGO_TARGET_DIR=/opt/inquello/build/target') == 1
script = script.replace('export CARGO_TARGET_DIR=/opt/inquello/build/target', 'export CARGO_TARGET_DIR=/opt/inquello/build/offline-20261105-1752/target')
script = script.replace('source_id=$(cat /opt/inquello/build/sources/selected-source)', 'source_id=' + record['sourceSha256'])
script += '''
cargo build --offline --locked -j 4 -p codex-bwrap -p codex-linux-sandbox -p codex-cli --bin bwrap --bin codex-linux-sandbox --bin codex
cargo build --offline --locked -j 4 -p codex-app-server --features inference-fixtures --bin codex-app-server
export INQUELLO_FIXTURE_APP_SERVER_BIN="$CARGO_TARGET_DIR/debug/codex-app-server"
sha256sum "$INQUELLO_FIXTURE_APP_SERVER_BIN"
cargo test --offline --locked -j 4 -p codex-app-server --features inference-fixtures --test inquello_messages_runtime real_private_task_retains_publication_question_and_truthful_progress -- --nocapture --test-threads=1
cargo test --offline --locked -j 4 -p codex-app-server --features inference-fixtures --test inquello_messages_runtime -- --nocapture --test-threads=1
printf '%s\\n' 'retained-runtime-gates-complete'
'''
(base / 'retained-runtime-command-20261106.sh').write_text(script, encoding='utf-8', newline='\n')
command = [str(Path(system) / 'System32/wsl.exe'), '-d', 'Inquello-Engine', '--user', 'inquello', '--cd', '/', '--exec', '/usr/bin/env', '-i', 'HOME=/home/inquello', 'PATH=/usr/bin:/bin', 'TMPDIR=/tmp', 'LANG=C.UTF-8', '/bin/sh', '-s']
with (base / 'retained-runtime-gates-20261106.log').open('x', encoding='utf-8') as log:
    result = subprocess.run(command, input=script.encode(), cwd=r'D:\Inquello\tmp', env=env, stdout=log, stderr=subprocess.STDOUT)
print('RETAINED_RUNTIME_EXIT=' + str(result.returncode), flush=True)
sys.exit(result.returncode)
