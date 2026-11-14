from pathlib import Path
import hashlib, subprocess
repo=Path(r'D:\Projects\inquello')
base=repo/'_bmad-output/implementation-artifacts/verification-2026-11-05'
paths={
'engine/codex-rs/rmcp-client/src/perform_oauth_login.rs':'f22f5b2ec84a75954e9a537e5ab105ea41b83dc31ba9d11bb8c27437e568e938',
'engine/codex-rs/rmcp-client/src/oauth_callback_transport.rs':'dc1203e43da04cb06c9ae3e6a00bf82c3b5f59ab58d9404c6d030b3ea1b10e34'}
for path,sha in paths.items():
 assert hashlib.sha256((repo/path).read_bytes()).hexdigest()==sha,path+' changed since tested snapshot'
old,new=paths
patch=subprocess.check_output(['git','diff','--no-ext-diff','--binary','HEAD','--',old],cwd=repo)
text=(repo/new).read_text()
lines=text.splitlines(keepends=True)
addition=f'diff --git a/{new} b/{new}\nnew file mode 100644\n--- /dev/null\n+++ b/{new}\n@@ -0,0 +1,{len(lines)} @@\n'+''.join('+'+line for line in lines)
patch+=addition.encode()
target=base/'oauth-callback-final-scoped-20261106.patch'
target.write_bytes(patch)
print(str(target))
print('patch_sha256='+hashlib.sha256(patch).hexdigest())
print('patch_bytes='+str(len(patch)))
log=(base/'oauth-candidate2-20261106.log').read_text()
names=[]
for line in log.splitlines():
 if line.startswith('test ') and any(prefix in line for prefix in ['perform_oauth_login::','oauth_login_cancellation::','enterprise_oauth_login::']):
  names.append(line.split(' ... ')[0][5:])
(base/'oauth-callback-covered-test-names-20261106.txt').write_text('\n'.join(names)+'\n',encoding='utf-8')
print('\n'.join(names))
