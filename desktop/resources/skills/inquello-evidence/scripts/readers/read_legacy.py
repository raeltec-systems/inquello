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
import uuid

from .common import Unreadable, TOOL_UNAVAILABLE, check_size, sha256_file, tool

EXTENSIONS = {'.doc', '.ppt'}
TIMEOUT = 120
# LibreOffice needs a local (Unix) socket for its single-instance pipe. The Task
# sandbox does not allow creating one, so conversion cannot run there.
SANDBOX_REFUSED = 'legacy format conversion is unavailable in the Task sandbox (LibreOffice needs a local socket the sandbox does not allow)'
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
    if not tool('soffice'):
        raise Unreadable(TOOL_UNAVAILABLE)
    original = sha256_file(path)
    extension = os.path.splitext(path)[1].lower()
    target = {'.doc': 'docx', '.ppt': 'pptx'}[extension]
    root = work_root()
    outdir = os.path.join(root, 'converted', uuid.uuid4().hex)
    converted = os.path.join(outdir, os.path.splitext(os.path.basename(path))[0] + '.' + target)
    os.makedirs(outdir, mode=0o700)
    profile = os.path.join(root, 'lo-profile-' + uuid.uuid4().hex)
    os.makedirs(os.path.join(profile, 'user'), mode=0o700)
    with open(os.path.join(profile, 'user', 'registrymodifications.xcu'), 'w') as handle:
        handle.write(MACROS_OFF)
    filters = {'docx': 'docx:MS Word 2007 XML', 'pptx': 'pptx:Impress MS PowerPoint 2007 XML'}
    argv = ['soffice', '-env:UserInstallation=file://' + profile, '--headless', '--norestore', '--nolockcheck',
            '--nodefault', '--nologo', '--convert-to', filters[target], '--outdir', outdir, path]
    env = {'PATH': '/usr/bin:/bin', 'LANG': 'C.UTF-8', 'HOME': profile, 'TMPDIR': profile, 'SAL_USE_VCLPLUGIN': 'svp'}
    try:
        log = os.path.join(profile, 'conversion.log')
        with open(log, 'wb') as errors:
            child = subprocess.Popen(argv, stdout=errors, stderr=errors, env=env, start_new_session=True)
        try:
            child.wait(timeout=TIMEOUT)
        except subprocess.TimeoutExpired:
            os.killpg(child.pid, signal.SIGKILL)
            child.wait()
            raise Unreadable('conversion from legacy format timed out')
        finally:
            try:
                os.killpg(child.pid, signal.SIGKILL)
            except (ProcessLookupError, PermissionError):
                pass
        with open(log, 'rb') as errors:
            diagnostics = errors.read(65536)
    finally:
        shutil.rmtree(profile, ignore_errors=True)
    if not os.path.isfile(converted) and b'no valid pipe path' in diagnostics:
        shutil.rmtree(outdir, ignore_errors=True)
        raise Unreadable(SANDBOX_REFUSED)
    if not os.path.isfile(converted):
        shutil.rmtree(outdir, ignore_errors=True)
        raise Unreadable('conversion from legacy format failed (protected, corrupt or unsupported)')
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
