$ErrorActionPreference='Stop'
$root='D:\Projects\inquello'
$logs="$root\_bmad-output\implementation-artifacts\verification-2026-11-05"
Set-Location "$root\engine\codex-rs"
$env:RUSTUP_HOME='D:\Toolchains\rustup'; $env:CARGO_HOME='D:\Toolchains\cargo'
$env:TEMP='D:\Toolchains\tmp'; $env:TMP=$env:TEMP; $env:TMPDIR=$env:TEMP
$env:CARGO_INCREMENTAL='0'; $env:CARGO_PROFILE_DEV_DEBUG='0'; $env:CARGO_PROFILE_TEST_DEBUG='0'; $env:CARGO_NET_OFFLINE='true'
$env:PATH='D:\Toolchains\rustup\toolchains\1.99.1-x86_64-pc-windows-msvc\bin;D:\Toolchains\cargo\bin;C:\Program Files\nodejs;'+$env:PATH
if(Test-Path "$logs\settings-usability-native-build-20261107.log"){throw 'Existing evidence'}
cmd /d /c "cargo build --offline --locked -j4 -p codex-cli --bin codex -p codex-app-server --bin codex-app-server > $logs\settings-usability-native-build-20261107.log 2>&1"
$code=$LASTEXITCODE; Write-Output "NATIVE_BUILD_EXIT=$code"; exit $code
