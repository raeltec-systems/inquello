# Story1.31 — maintained real-issuer pilot startup checkpoint

2026-11-02, still in progress. No whole-story or live Auth0 authentication acceptance claim.

## Verified service/native
- Maintained Production serve entry local7ed56bd5ca7fb0f0a3d42f92d59c7d234e3f279d, engine4846abe8470db3c1ae45e26d71ad05980a41b348. See story-1-31-serve-validation.md for280 tests,8 targeted rerun,strict clippy and ordinary no-test-feature service binary proof.
- Matched native launcher `.tmp/story131-serve-matched/build-native.ps1`, PID11608 exit0,314.56s. Cargo5m09. Engine checked before/after; no source writes during compile.
- `.tmp/story131-serve-matched/matched-build.json`: app-server SHA57F5478C0624C4305DE517C66A3541463A19D3B327C6F455B23DB1148C3392C4; CLI SHA874351E0766DD722BC81C8EE11D465F278155171E2ECE3ED7373C8BD35121B02.
- Ordinary service frozen SHA9AF80FC7FFD3F19655CC6B15A07435BD3243F8A9133B341F6F42A13F8EF27083; no test-issuer binary used for pilot.

## Desktop qualification
- `.tmp/story131-auth0-profile-validation.ps1`, PID19344 exit0,112.32s: protocol0,build0,583 passed+2 explicit Windows symlink skips across23 files. Existing21-file onboarding/identity/security/privacy/Shell suite plus dev-profile14 (13pass,1skip) and pilot-runner11. Testduration96.52s.
- Exact owned first-empty profile, exclusive initialization proof, explicit same-run/config/nonce resume, partial initialization refusal without deletion, foreign/oversized/symlink gates. Normal system browser; no synthetic hook or identity override.
- Actual governed runtime root is emitted after initialization and used by runtime. Public runtime-ready and normal-dev runtime-exit evidence support owned lifecycle, without tokens/config/session dumps.
- Runner bounds creation to explicit local PostgreSQL authority, new safe DB name/private root ACL/scopedTLS; no OS trust change; sanitized separate child environments. Fixed public Auth0 Native config, stable service port and callback43821. Hash-pinned production/native binaries. No vendor credentials, emails, model calls or membership seeds.
- First launch attempt PID23568 exited1 before root/DB/TLS/process creation: executable256MiB guard was below legitimate frozen runtime283,497,984B and CLI353,479,680B. Read-only metadata confirmed root absent. Narrow executable-only bound512MiB (hash pins unchanged); runner11 tests reranPASS in295ms. First log preserved `.tmp/story131-auth0-pilot-first-failed.log`. No full rebuild needed for this CJS-only correction.
- CodeRabbit portability correction canonicalizes smoke mkdtemp root; source regression included.

## Actual normal pilot startup
- Parent-approved activation, no automated Auth0 clicks/login or account creation.
- Runner PID21008 observed active; actual PILOT_READY read06:33:32. RunId9f9d996b-255c-47f8-9fa2-4fc004cfab03.
- Owned root `D:\Inquello\tmp\inquello-auth0-pilot-20261102`; Production service PID21260, HTTPS127.0.0.1:45443; normal Electron PID21740. Actual listener owner verified. Unknown old topologyPID28340 untouched.
- Public lifecycle records actual app userData `root\profile`, governed runtimeHome `root\profile\runtime-home`, resumedfalse. Readiness additionally required successful matched runtime handshake.
- Public logs `.tmp/story131-auth0-pilot.log` and ownedroot/lifecycle.jsonl. No raw environment, database URL, key or session contents read/printed.
- Window/service remain running for user at checkpoint. Database/TLS/profile retained on stop; no cleanup/delete authorized. Main uses ordinary identity vault. No hosted Auth0 authentication, signup, recovery, verified email or browser-session account-switching success claimed. Normal user-close and actual resumed session remain pending; cleanup failure paths qualified by injected tests only.

## Remaining
- User-driven real Auth0 journey and fixed callback observations; normal-close/resume evidence.
- Approved scoped pending-operation journal (current single pending remains fail-closed), wider restart/private-task/keyboard/narrow layouts, remaining story checks.
- Delivery remains explicitly unconfigured, no actual email. Invitation discovery after verified user login is not a notification grant.
