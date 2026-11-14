$root='D:\Projects\inquello'
$logs="$root\_bmad-output\implementation-artifacts\verification-2026-11-05"
if(Test-Path "$logs\fixture-build-switch-diagnostic.log"){throw 'Log exists'}
Set-Location "$root\engine\codex-rs"
$env:RUSTUP_HOME='D:\Toolchains\rustup';$env:CARGO_HOME='D:\Toolchains\cargo';$env:TMP='D:\Toolchains\tmp';$env:TEMP=$env:TMP
$env:CARGO_INCREMENTAL='0';$env:CARGO_PROFILE_DEV_DEBUG='0';$env:CARGO_NET_OFFLINE='true'
$env:PATH='D:\Toolchains\rustup\toolchains\1.99.1-x86_64-pc-windows-msvc\bin;D:\Toolchains\cargo\bin;D:\Toolchains\npm-global;'+$env:PATH
cmd /d /c "cargo build --offline --locked -j4 --target-dir D:\Inquello\cache\fixture-20261105 -p codex-app-server --bin codex-app-server --features inference-fixtures > $logs\fixture-build-switch-diagnostic.log 2>&1"
$code=$LASTEXITCODE;Write-Output "FIXTURE_BUILD_EXIT=$code";if($code -ne 0){exit $code}
Set-Location "$root\desktop"
cmd /d /c "pnpm build > $logs\desktop-build-switch-diagnostic.log 2>&1"
$code=$LASTEXITCODE;Write-Output "DESKTOP_BUILD_EXIT=$code";if($code -ne 0){exit $code}
Set-Location $root
node _bmad-output/implementation-artifacts/verification-2026-11-05/run-docker-verification.cjs D:/Inquello/tmp/epic1-pg-20261105-d778fa3f/ownership.json visual switch-diagnostic-1
exit $LASTEXITCODE
