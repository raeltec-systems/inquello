$root='D:\Projects\inquello'
$logs="$root\_bmad-output\implementation-artifacts\verification-2026-11-05"
if(Test-Path "$logs\fixture-build-progress-final.log"){throw 'Final build log already exists; check the owned run before retrying.'}
Set-Location $root
git diff -- desktop/src/main/identity/session.ts desktop/src/main/policy/service.ts desktop/src/main/tasks/service.ts desktop/src/renderer/Shell/task-observation.ts desktop/test/identity-session.test.ts desktop/test/policy-units.test.ts desktop/test/tasks-progress.test.ts desktop/test/live-conversation.test.tsx > "$logs\progress-repair-final.diff"
Set-Location "$root\engine\codex-rs"
$env:RUSTUP_HOME='D:\Toolchains\rustup';$env:CARGO_HOME='D:\Toolchains\cargo';$env:TMP='D:\Toolchains\tmp';$env:TEMP=$env:TMP
$env:CARGO_INCREMENTAL='0';$env:CARGO_PROFILE_DEV_DEBUG='0';$env:CARGO_NET_OFFLINE='true'
$env:PATH='D:\Toolchains\rustup\toolchains\1.99.1-x86_64-pc-windows-msvc\bin;D:\Toolchains\cargo\bin;D:\Toolchains\npm-global;'+$env:PATH
cmd /d /c "cargo build --offline --locked -j4 --target-dir D:\Inquello\cache\fixture-20261105 -p codex-app-server --bin codex-app-server --features inference-fixtures > $logs\fixture-build-progress-final.log 2>&1"
$code=$LASTEXITCODE;Write-Output "FIXTURE_BUILD_EXIT=$code";if($code -ne 0){exit $code}
Set-Location "$root\desktop"
cmd /d /c "pnpm test test/identity-session.test.ts test/policy-units.test.ts test/tasks-progress.test.ts test/tasks-lifecycle.test.ts test/live-conversation.test.tsx --maxWorkers=1 > $logs\progress-repair-focused-final.log 2>&1"
$code=$LASTEXITCODE;Write-Output "TEST_EXIT=$code";if($code -ne 0){exit $code}
cmd /d /c "pnpm build > $logs\desktop-build-progress-final.log 2>&1"
$code=$LASTEXITCODE;Write-Output "DESKTOP_BUILD_EXIT=$code";if($code -ne 0){exit $code}
Set-Location $root
node _bmad-output/implementation-artifacts/verification-2026-11-05/run-docker-verification.cjs D:/Inquello/tmp/epic1-pg-20261105-d778fa3f/ownership.json visual progress-final-1
$code=$LASTEXITCODE;if($code -ne 0){exit $code}
node _bmad-output/implementation-artifacts/verification-2026-11-05/run-docker-verification.cjs D:/Inquello/tmp/epic1-pg-20261105-d778fa3f/ownership.json visual progress-final-2
exit $LASTEXITCODE
