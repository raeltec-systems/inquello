"""Legacy Word and PowerPoint files (.doc, .ppt): converted, then read.

Headless LibreOffice converts a copy to .docx or .pptx inside the Task folder
(a fresh folder under `.inquello-work/converted/`, removed after reading), with macros disabled, a private throwaway
profile and a time bound. The original is never modified. The reading is the
converted copy's, labelled "converted from legacy format", with the original
file's hash.
"""
import os
import shutil
import signal
import subprocess
import time
import uuid

from .common import Unreadable, TOOL_UNAVAILABLE, check_size, sha256_file, tool

EXTENSIONS = {'.doc', '.ppt'}
TIMEOUT = 120
# LibreOffice's launcher (`soffice`) insists on a writable /tmp for its
# single-instance pipe; the Task sandbox's /tmp is read-only. The office
# program itself (`soffice.bin`) takes the pipe folder from OSL_SOCKET_PATH, so
# the pipe is created inside this conversion's folder in the Task folder. The
# path is relative to the Task folder because a socket path is limited to 107
# bytes. The office program exits with 81 after creating a fresh profile and
# must be started again, which the launcher would otherwise do.
RESTART = 81
FAILED = 'conversion from legacy format failed (protected, corrupt or unsupported)'
MACROS_OFF = '''<?xml version="1.0" encoding="UTF-8"?>
<oor:items xmlns:oor="http://openoffice.org/2001/registry" xmlns:xs="http://www.w3.org/2001/XMLSchema" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
<item oor:path="/org.openoffice.Office.Common/Security/Scripting"><prop oor:name="MacroSecurityLevel" oor:op="fuse"><value>3</value></prop></item>
<item oor:path="/org.openoffice.Office.Common/Security/Scripting"><prop oor:name="DisableMacrosExecution" oor:op="fuse"><value>true</value></prop></item>
<item oor:path="/org.openoffice.Office.Common/Security/Scripting"><prop oor:name="BlockUntrustedRefererLinks" oor:op="fuse"><value>true</value></prop></item>
<item oor:path="/org.openoffice.Office.Common/Misc"><prop oor:name="UseOpenCL" oor:op="fuse"><value>false</value></prop></item>
</oor:items>
'''


def work_root():
    root = os.path.join(os.getcwd(), '.inquello-work')
    try:
        os.makedirs(root, mode=0o700, exist_ok=True)
        probe = os.path.join(root, '.write-check')
        with open(probe, 'w') as handle:
            handle.write('')
        os.unlink(probe)
    except OSError:
        raise Unreadable('conversion needs a writable Task folder')
    return root


def convert(path):
    """Returns (converted path, original sha256), always from a fresh conversion.

    A converted copy is never reused: the Task folder is writable by the agent,
    so an earlier copy could have been replaced. The caller removes it after reading.
    """
    check_size(path)
    launcher = tool('soffice')
    office = os.path.join(os.path.dirname(os.path.realpath(launcher)), 'soffice.bin') if launcher else None
    if not office or not os.path.isfile(office):
        raise Unreadable(TOOL_UNAVAILABLE)
    original = sha256_file(path)
    extension = os.path.splitext(path)[1].lower()
    target = {'.doc': 'docx', '.ppt': 'pptx'}[extension]
    root = work_root()
    outdir = os.path.join(root, 'converted', uuid.uuid4().hex)
    converted = os.path.join(outdir, os.path.splitext(os.path.basename(path))[0] + '.' + target)
    os.makedirs(outdir, mode=0o700)
    # A private throwaway profile with macros disabled; it also holds the pipe.
    profile = os.path.join(root, 'lo-' + uuid.uuid4().hex[:12])
    os.makedirs(os.path.join(profile, 'user'), mode=0o700)
    with open(os.path.join(profile, 'user', 'registrymodifications.xcu'), 'w') as handle:
        handle.write(MACROS_OFF)
    filters = {'docx': 'docx:MS Word 2007 XML', 'pptx': 'pptx:Impress MS PowerPoint 2007 XML'}
    argv = [office, '-env:UserInstallation=file://' + profile, '-env:OSL_SOCKET_PATH=' + os.path.relpath(profile),
            '--headless', '--invisible', '--norestore', '--nolockcheck', '--nodefault', '--nologo',
            '--convert-to', filters[target], '--outdir', outdir, path]
    env = {'PATH': '/usr/bin:/bin', 'LANG': 'C.UTF-8', 'HOME': profile, 'TMPDIR': profile, 'SAL_USE_VCLPLUGIN': 'svp'}
    deadline = time.monotonic() + TIMEOUT
    try:
        log = os.path.join(profile, 'conversion.log')
        for _ in range(3):
            with open(log, 'ab') as errors:
                child = subprocess.Popen(argv, stdout=errors, stderr=errors, env=env, start_new_session=True)
            try:
                code = child.wait(timeout=max(1, deadline - time.monotonic()))
            except subprocess.TimeoutExpired:
                os.killpg(child.pid, signal.SIGKILL)
                child.wait()
                raise Unreadable('conversion from legacy format timed out')
            finally:
                try:
                    os.killpg(child.pid, signal.SIGKILL)
                except (ProcessLookupError, PermissionError):
                    pass
            if code != RESTART:
                break
    finally:
        shutil.rmtree(profile, ignore_errors=True)
    if not os.path.isfile(converted):
        shutil.rmtree(outdir, ignore_errors=True)
        raise Unreadable(FAILED)
    return converted, original


def read(path):
    from . import read_docx, read_pptx
    converted, original = convert(path)
    reader = read_docx if converted.endswith('.docx') else read_pptx
    try:
        reading = reader.read(converted)
    finally:
        shutil.rmtree(os.path.dirname(converted), ignore_errors=True)
    reading.kind = os.path.splitext(path)[1].lower().lstrip('.')
    reading.flags['converted'] = True
    reading.flags['originalSha256'] = original
    reading.notes.insert(0, 'converted from legacy format to %s; the original file is unchanged' % converted.rsplit('.', 1)[1])
    return reading


def select(reading, locator):
    from . import read_docx, read_pptx
    return (read_docx if locator[:1] in 'PFC' else read_pptx).select(reading, locator)
