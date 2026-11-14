$ErrorActionPreference='Stop'
$root='D:\Projects\inquello'
$logs="$root\_bmad-output\implementation-artifacts\verification-2026-11-05"
Set-Location "$root\engine\codex-rs"
$env:RUSTUP_HOME='D:\Toolchains\rustup'; $env:CARGO_HOME='D:\Toolchains\cargo'
$env:TEMP='D:\Toolchains\tmp'; $env:TMP=$env:TEMP; $env:TMPDIR=$env:TEMP
$env:CARGO_INCREMENTAL='0'; $env:CARGO_PROFILE_DEV_DEBUG='0'; $env:CARGO_PROFILE_TEST_DEBUG='0'; $env:CARGO_NET_OFFLINE='true'
$env:PATH='D:\Toolchains\rustup\toolchains\1.99.1-x86_64-pc-windows-msvc\bin;D:\Toolchains\cargo\bin;C:\Program Files\nodejs;'+$env:PATH
foreach($name in @('tools-windows-fixture-20261106.log','tools-windows-topology-20261106.log','tools-windows-fmt-20261106.log')) { if(Test-Path "$logs\$name"){throw "Existing evidence: $name"} }
cmd /d /c "cargo fmt -p codex-rmcp-client -- --check > $logs\tools-windows-fmt-20261106.log 2>&1"
$code=$LASTEXITCODE; Write-Output "FMT_EXIT=$code"; if($code -ne 0){exit $code}
cmd /d /c "cargo build --offline --locked -j4 --target-dir D:\Inquello\cache\fixture-20261105 -p codex-app-server --bin codex-app-server --features inference-fixtures > $logs\tools-windows-fixture-20261106.log 2>&1"
$code=$LASTEXITCODE; Write-Output "FIXTURE_BUILD_EXIT=$code"; if($code -ne 0){exit $code}
cmd /d /c "cargo build --offline --locked -j4 -p inquello-service --features test-issuer --bin inquello-dev-topology > $logs\tools-windows-topology-20261106.log 2>&1"
$code=$LASTEXITCODE; Write-Output "TOPOLOGY_BUILD_EXIT=$code"; exit $code
