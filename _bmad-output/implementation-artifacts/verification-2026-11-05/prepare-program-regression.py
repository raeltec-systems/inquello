from pathlib import Path
root=Path(r'D:\Projects\inquello')
source=root/'_bmad-output/implementation-artifacts/verification-2026-11-05/probe-guest-program-queries.py'
text=source.read_text()
text=text.replace('"""Exact sandboxed filesystem query diagnostic, fresh owned broker scope."""','"""Real sandboxed canonical program identity regression, no model calls."""')
text=text.replace("base=Path(r'D:\\Projects\\inquello\\_bmad-output\\implementation-artifacts\\verification-2026-11-05')","base=Path(r'D:\\Inquello\\logs')")
text=text.replace("stderr=(base/'guest-program-queries-stderr.log').open('x')","stderr=(base/('guest-program-identity-'+scope+'-stderr.log')).open('x')")
text=text.replace("    for path in ['/usr/bin/curl'","    canonical={}\n    for path in ['/usr/bin/curl'")
text=text.replace("            print(json.dumps({'path':path,'method':method,'response':result}),flush=True)","            print(json.dumps({'path':path,'method':method,'response':result}),flush=True)\n            assert 'result' in result,result\n            if method=='fs/canonicalize':canonical[path]=result['result']['path']\n            else:assert result['result']['isFile'] is True,result\n    assert canonical['/usr/bin/curl']==canonical['/bin/curl'],canonical\n    assert len({canonical[p] for p in ['/usr/bin/sh','/bin/sh','/usr/bin/dash','/bin/dash']})==1,canonical\n    print(json.dumps({'probe':'guest-canonical-program-identity','passed':True}),flush=True)")
(root/'desktop/scripts/wsl/probe-program-identity.py').write_text(text, newline='\n')
