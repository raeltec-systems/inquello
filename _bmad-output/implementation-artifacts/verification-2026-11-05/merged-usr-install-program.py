
import base64, hashlib, json, os, pathlib, shutil, stat
assert os.getuid() == 0
os.umask(0o077)
payload = json.load(__import__('sys').stdin)
root = pathlib.Path('/opt/inquello/runtime')
root.mkdir(mode=0o755, exist_ok=True)
binary = root / 'bin'
binary.mkdir(mode=0o755, exist_ok=True)
for directory in (root, binary):
    info = directory.lstat()
    assert stat.S_ISDIR(info.st_mode) and info.st_uid == 0
    directory.chmod(0o755)
manifest = {'version': 1, 'binaries': {}}
receipt = json.loads(pathlib.Path('/opt/inquello/build/offline-20261105-1752/merged-usr-build-receipt.json').read_text())
assert receipt['version'] == 1 and len(receipt['sourceArchiveSha256']) == 64
for name in ['codex', 'codex-linux-sandbox', 'bwrap']:
    source = pathlib.Path('/opt/inquello/build/offline-20261105-1752/target/debug') / name
    assert source.is_file() and not source.is_symlink()
    temporary = binary / (name + '.new')
    with source.open('rb') as incoming, temporary.open('xb') as output:
        shutil.copyfileobj(incoming, output)
        output.flush()
        os.fsync(output.fileno())
    temporary.chmod(0o555)
    temporary.replace(binary / name)
    with (binary / name).open('rb') as file:
        manifest['binaries'][name] = hashlib.file_digest(file, 'sha256').hexdigest()
    assert manifest['binaries'][name] == receipt['binaries'][name], 'built binary no longer matches successful build receipt'
manifest['sourceArchiveSha256'] = receipt['sourceArchiveSha256']
destination = pathlib.Path('/usr/local/libexec')
destination.mkdir(mode=0o755, exist_ok=True)
destination.chmod(0o755)
info = destination.lstat()
assert stat.S_ISDIR(info.st_mode) and info.st_uid == 0 and not info.st_mode & 0o022
for source, target in [('guest-broker.py', 'inquello-broker.py'), ('guest-executor.sh', 'inquello-executor')]:
    data = base64.b64decode(payload[source], validate=True)
    temporary = destination / (target + '.new')
    with temporary.open('xb') as output:
        output.write(data)
        output.flush()
        os.fsync(output.fileno())
    temporary.chmod(0o555)
    temporary.replace(destination / target)
    manifest[target] = hashlib.sha256(data).hexdigest()
temporary = root / 'manifest.json.new'
with temporary.open('x') as output:
    json.dump(manifest, output)
    output.flush()
    os.fsync(output.fileno())
temporary.chmod(0o444)
temporary.replace(root / 'manifest.json')
for name in ['tasks', 'locks', 'transfers', 'executor']:
    directory = pathlib.Path('/var/lib/inquello') / name
    directory.mkdir(mode=0o700, exist_ok=True)
    assert not directory.is_symlink()
    os.chown(directory, 1000, 1000)
    directory.chmod(0o700)
print(json.dumps(manifest))
