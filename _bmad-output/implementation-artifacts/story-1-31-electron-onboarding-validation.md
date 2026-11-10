# Story 1.31 — actual synthetic Electron onboarding checkpoint

2026-11-02 05:19 UTC. Bounded actual journey PASS; not whole-story acceptance or hosted Auth0 proof.

## Frozen source/runtime
Engine commit 1bfda602ffa31dbe09d0362aba792bc2fed678cd; tree fd5063db10c2ed7df39cef5df0148552f09530ed.
Matched launcher .tmp/story131-onboarding-matched/build-native.ps1, PID18908 exit0. Manifest in that directory.
Runtime SHA256 3834661FA1E00052BB314CA307050E897C2778224FEC6FC719896D530F1DBE60.
CLI SHA256 E66BAF63BA0F5EFD84420CEE2ADF0CE8AC74AF6AA804CE9BBCC5A4105AADF87C.

## Desktop validation
.tmp/story131-onboarding-desktop-validation.ps1 PID21000 exit0:
protocol0, build0, **556 tests passed / 21 files**, one Windows symlink test explicitly skipped (557 total). Logs/status share story131-onboarding-desktop prefix.
Owned profile gate requires unpackaged exclusive mode, exact realpaths/regular marker/config SHA/run, EMPTY profile, fixed loopback synthetic issuer/client, no inherited provider credentials/other fixture authorities. Callback must match requested loopback origin/path, without userinfo/hash. No renderer identity selector RPC. Default/production auth unchanged.

## Actual Electron
.tmp/story131-onboarding-electron.ps1 PID12860 exit0, 38.69s.
Logs: .tmp/story131-onboarding-electron.log and D:\Inquello\tmp\inquello-seeded-smoke-XrINXD\onboarding\smoke.stdout.log.
Seven actual capturePage PNGs and manifest: D:\Inquello\tmp\inquello-seeded-smoke-XrINXD\onboarding\captures.
All seven 1502x1003 PNGs inspected: readable controls, no overlap or clipped actionable controls in these captures.
Visible controls and explicit dialogs, through normal named IPC/service:
1. Chanda Mwansa signs in with no Workspace membership, OS-backed storage.
2. Creates Mupeta & Partners and becomes Owner.
3. Invites elias.ndlovu@mupeta.invalid as Member; UI truthfully says email delivery unconfigured.
4. Explicit reauthentication selects distinct Elias Ndlovu, with invitation but no membership before acceptance.
5. Elias accepts through UI and sees Workspace, without manager metadata/controls.
6. Chanda reauthenticates and changes Elias to Reviewer at observed revision; refreshed team shows result.
7. Renderer DOM/storage/URL scan finds no recorded identity secret.
No seed membership/helper acceptance, real email, live inference, or hosted Auth0. Eleven checks PASS. Owned cleanupErrors empty; post-run no Electron/app-server remained. Unknown pre-existing topology PID28340 untouched.

## Honest remaining findings
Recipient screenshot05 retains a stale identity-changed warning after successful intentional account switch; narrow generation-scoped notice repair and recapture required before clean preview. Recipient screenshot06 correctly denies manager metadata but uses generic membership-change-unavailable copy; clearer read-only capability messaging remains desirable.
Windows symlink negative not executed. Narrow/mobile layouts, keyboard/modal capture matrix, interruption/restart/private-task journey and scoped pending journal still pending. Hosted Auth0 browser switching/signup/recovery and maintained real-issuer HTTP launcher remain separate unfinished work. Story remains in-progress. No builder remote publication.

## Corrected refresh notice checkpoint — 2026-11-02 05:30 UTC
Separated refresh-read notices from mutation notices. Only a successful current epoch/sequence signed-in state read clears the refresh notice; current read denial, discovery/team denial and mutation rejection are not swallowed.
Three focused renderer regressions pass. .tmp/story131-onboarding-notice-validation.ps1 PID18000 exit0: protocol/build0, **559 tests PASS +1 explicit Windows symlink skip, 21 files**.
Full actual journey rerun .tmp/story131-onboarding-notice-electron.ps1 PID20416 exit0 in34.03s, all11checks PASS, cleanupErrors empty.
New seven captures/manifest: D:\Inquello\tmp\inquello-seeded-smoke-2MyPay\onboarding\captures.
Inspected corrected recipient05 and owner07: no stale identity-changed warning; correct Elias identity/pending invitation and Chanda Owner/Elias Reviewer remain readable. Original seven captures preserved separately. Generic nonmanager read-denial wording remains a known copy refinement, not authority leakage.
Post-run only unknown pre-existing topology28340 remained; no owned Electron/app-server. Existing native engine fd5063db unchanged. No full-story, live Auth0, external delivery or scoped-journal completion claim.
