"""Freeze tracked and untracked measured sources, excluding ignored build output.

The deterministic archive records the working tree, including pending changes;
its digest, not HEAD, identifies the guest build. Text CRLF is normalized to LF.
"""
import hashlib
import io
import json
from pathlib import Path
import subprocess
import tarfile

repo = Path(__file__).resolve().parents[3]
output = repo / '.tmp' / 'wsl-source.tar'
assert output.drive.lower() == 'd:'
tracked = subprocess.check_output(['git', 'ls-files', '--stage', '-z', 'engine', 'desktop'], cwd=repo).split(b'\0')
files = {}
for entry in tracked:
    if entry:
        metadata, name = entry.split(b'\t', 1)
        mode, _, stage = metadata.split()
        if stage != b'0':
            raise ValueError('Unmerged engine source')
        files[name.decode()] = int(mode, 8)
for name in subprocess.check_output(['git', 'ls-files', '--others', '--exclude-standard', '-z', 'engine', 'desktop'], cwd=repo).split(b'\0'):
    if name:
        files[name.decode()] = 0o100644
manifest = {}
with tarfile.open(output, 'w', format=tarfile.PAX_FORMAT) as archive:
    for name, mode in sorted(files.items()):
        source = repo / name
        if not source.exists() and not source.is_symlink():
            continue  # tracked deletion
        data = source.read_bytes()
        info = tarfile.TarInfo(name)
        info.mode = mode & 0o777
        if source.is_symlink():
            info.type = tarfile.SYMTYPE
            info.linkname = data.decode().strip()
            if info.linkname.startswith('/') or '..' in Path(info.linkname).parts:
                raise ValueError('Source link escapes archive')
            archive.addfile(info)
        else:
            if mode == 0o120000:
                # Windows git checkouts store link text as a regular file.
                # Preserve the actual measured checkout representation.
                info.mode = 0o644
            if b'\0' not in data:
                data = data.replace(b'\r\n', b'\n')
            info.size = len(data)
            archive.addfile(info, io.BytesIO(data))
        manifest[name] = hashlib.sha256(data).hexdigest()
with output.open('rb') as source:
    digest = hashlib.file_digest(source, 'sha256').hexdigest()
final = output.with_name('wsl-source-' + digest + '.tar')
output.replace(final)
record = {'version': 1, 'sourceSha256': digest, 'archive': str(final),
          'head': subprocess.check_output(['git', 'rev-parse', 'HEAD'], cwd=repo, text=True).strip(),
          'files': manifest}
final.with_suffix('.json').write_text(json.dumps(record, indent=2))
print(json.dumps({key: value for key, value in record.items() if key != 'files'}))
