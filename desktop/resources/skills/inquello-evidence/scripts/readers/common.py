"""Shared bounds, labels and helpers for the Inquello evidence readers.

Every reader returns a Reading: located lines in the file's own terms. Readers
never write to the source file, never run macros or embedded objects, and
report "reading tool unavailable" instead of failing when a tool is missing.
"""
import hashlib
import os
import re
import shutil
import subprocess
import unicodedata
import zipfile

MAX_FILE_BYTES = 64 * 1024 * 1024
MAX_ZIP_ENTRIES = 10000
MAX_ZIP_TOTAL = 512 * 1024 * 1024
MAX_ZIP_ENTRY = 256 * 1024 * 1024
MAX_ZIP_RATIO = 200
MAX_OUTPUT_LINES = 200000
TOOL_TIMEOUT = 120
OCR_LABEL = 'recognised text (OCR)'

TOOL_UNAVAILABLE = 'reading tool unavailable'


class Unreadable(Exception):
    """The file cannot be read; the message is the reason shown to the auditor."""


class Line:
    __slots__ = ('label', 'text', 'meta')

    def __init__(self, label, text, meta=None):
        self.label = label
        self.text = text
        self.meta = meta or {}


class Reading:
    """Located text for one file. `lines` keep their location labels."""

    def __init__(self, kind, lines=None, notes=None, flags=None, counts=None):
        self.kind = kind
        self.lines = lines or []
        self.notes = notes or []
        self.flags = flags or {}
        self.counts = counts or {}

    def add(self, label, text, **meta):
        if len(self.lines) >= MAX_OUTPUT_LINES:
            self.flags['truncated'] = True
            return
        self.lines.append(Line(label, text, meta))


def sha256_file(path):
    digest = hashlib.sha256()
    with open(path, 'rb') as source:
        for block in iter(lambda: source.read(1024 * 1024), b''):
            digest.update(block)
    return digest.hexdigest()


def check_size(path):
    size = os.stat(path).st_size
    if size > MAX_FILE_BYTES:
        raise Unreadable('over the size bound (%d MiB)' % (MAX_FILE_BYTES // (1024 * 1024)))
    return size


def tool(name):
    return shutil.which(name, path='/usr/bin:/bin')


def module_available(name):
    try:
        __import__(name)
        return True
    except Exception:
        return False


def run(argv, input_bytes=None, timeout=TOOL_TIMEOUT, limit=64 * 1024 * 1024):
    """Runs a fixed tool without a shell. Returns (code, stdout bytes, stderr text)."""
    try:
        done = subprocess.run(argv, input=input_bytes, stdout=subprocess.PIPE, stderr=subprocess.PIPE,
                              timeout=timeout, check=False, env={'PATH': '/usr/bin:/bin', 'LANG': 'C.UTF-8',
                                                                  'HOME': os.environ.get('HOME', '/tmp'),
                                                                  'OMP_THREAD_LIMIT': '1'})
    except subprocess.TimeoutExpired:
        raise Unreadable('the reading tool timed out')
    if len(done.stdout) > limit:
        raise Unreadable('tool output over the size bound')
    return done.returncode, done.stdout, done.stderr.decode('utf-8', 'replace')


def safe_zip(path):
    """Opens an Office archive after checking it against the hostile-archive bounds.

    Nothing is extracted to disk; members are read into memory only after these
    checks, so a zip bomb, an escaping entry name or a huge XML part is refused.
    """
    try:
        archive = zipfile.ZipFile(path)
    except zipfile.BadZipFile:
        raise Unreadable('corrupt or not an Office file')
    except RuntimeError:
        raise Unreadable('password-protected')
    infos = archive.infolist()
    if len(infos) > MAX_ZIP_ENTRIES:
        raise Unreadable('archive has too many entries')
    total = 0
    for info in infos:
        name = info.filename
        if name.startswith('/') or '\\' in name or any(part == '..' for part in name.split('/')):
            raise Unreadable('archive entry path escapes the archive')
        if info.flag_bits & 0x1:
            raise Unreadable('password-protected')
        if info.file_size > MAX_ZIP_ENTRY:
            raise Unreadable('archive entry over the size bound')
        total += info.file_size
        if total > MAX_ZIP_TOTAL:
            raise Unreadable('archive expands beyond the size bound')
        if info.compress_size and info.file_size / max(info.compress_size, 1) > MAX_ZIP_RATIO and info.file_size > 1024 * 1024:
            raise Unreadable('archive expansion ratio over the bound')
    return archive


def zip_xml(archive, name):
    """Parses one member as XML. Returns None when it is absent."""
    import xml.etree.ElementTree as ET
    try:
        data = archive.read(name)
    except KeyError:
        return None
    if b'<!DOCTYPE' in data[:4096] or b'<!ENTITY' in data[:65536]:
        raise Unreadable('document declares XML entities; not read')
    try:
        return ET.fromstring(data)
    except ET.ParseError:
        raise Unreadable('corrupt XML inside the file')


def normalise(text):
    """The comparison form used to match a quote with the file's text."""
    text = unicodedata.normalize('NFKC', text or '')
    text = text.replace('‘', "'").replace('’', "'").replace('“', '"').replace('”', '"')
    text = re.sub('[‐-―−]', '-', text)
    return re.sub(r'\s+', ' ', text).strip()


def span(text):
    """Parses `10-14` or `10` into an inclusive (start, end) pair."""
    match = re.fullmatch(r'(\d+)(?:-(?:[A-Z]{1,2})?(\d+))?', text)
    if not match:
        raise ValueError('invalid range')
    start = int(match.group(1))
    end = int(match.group(2) or start)
    if start < 1 or end < start or end - start > 100000:
        raise ValueError('invalid range')
    return start, end
