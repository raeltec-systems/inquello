$ErrorActionPreference='Stop'
$op='D:\Projects\inquello\.tmp\epic1-live-acceptance-20261109'
Set-Location 'D:\Projects\inquello\engine\codex-rs'
$env:RUSTUP_HOME='D:\Toolchains\rustup'; $env:CARGO_HOME='D:\Toolchains\cargo'
$env:TEMP='D:\Toolchains\tmp'; $env:TMP=$env:TEMP; $env:TMPDIR=$env:TEMP
$env:CARGO_INCREMENTAL='0'; $env:CARGO_PROFILE_DEV_DEBUG='0'; $env:CARGO_PROFILE_TEST_DEBUG='0'; $env:CARGO_NET_OFFLINE='true'
$env:RUSTUP_AUTO_INSTALL='0'
$env:PATH='D:\Toolchains\rustup\toolchains\1.99.1-x86_64-pc-windows-msvc\bin;D:\Toolchains\cargo\bin;C:\Program Files\nodejs;'+$env:PATH
if(Test-Path "$op\native-build-retry.log"){throw 'Refuse evidence overwrite'}
$probePath='D:\Toolchains\tmp\inquello-recovery-access-probe-20261109.tmp'
$probe=[System.IO.File]::Open($probePath,[System.IO.FileMode]::CreateNew,[System.IO.FileAccess]::Write,[System.IO.FileShare]::None)
$probe.Dispose(); Remove-Item -LiteralPath $probePath
& cargo build --offline --locked -j4 -p codex-cli --bin codex -p codex-app-server --bin codex-app-server -p inquello-service --bin inquello-service *> "$op\native-build-retry.log"
$buildCode=$LASTEXITCODE
@{exitCode=$buildCode;completedUtc=[DateTime]::UtcNow.ToString('o');jobs=4;offline=$true;locked=$true;toolchainTempAccessVerified=$true}|ConvertTo-Json|Set-Content "$op\native-build-retry-result.json"
exit $buildCode
