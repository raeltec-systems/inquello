$ErrorActionPreference='Stop'
$root='D:\Projects\inquello'
$logs="$root\_bmad-output\implementation-artifacts\verification-2026-11-05"
Set-Location "$root\engine\codex-rs"
$env:RUSTUP_HOME='D:\Toolchains\rustup'; $env:CARGO_HOME='D:\Toolchains\cargo'
$env:TEMP='D:\Toolchains\tmp'; $env:TMP=$env:TEMP; $env:TMPDIR=$env:TEMP
$env:CARGO_INCREMENTAL='0'; $env:CARGO_PROFILE_DEV_DEBUG='0'; $env:CARGO_PROFILE_TEST_DEBUG='0'; $env:CARGO_NET_OFFLINE='true'
$env:PATH='D:\Toolchains\rustup\toolchains\1.99.1-x86_64-pc-windows-msvc\bin;D:\Toolchains\cargo\bin;C:\Program Files\nodejs;'+$env:PATH
foreach($name in @('tools-windows-rmcp-20261106.log','tools-windows-rpc-20261106.log','tools-windows-build-20261106.log')) { if(Test-Path "$logs\$name"){throw "Existing evidence: $name"} }
cmd /d /c "cargo test --offline --locked -j4 -p codex-rmcp-client --lib -- --nocapture --test-threads=1 > $logs\tools-windows-rmcp-20261106.log 2>&1"
$code=$LASTEXITCODE; Write-Output "WINDOWS_RMCP_EXIT=$code"
if($code -ne 0){exit $code}
cmd /d /c "cargo test --offline --locked -j4 -p codex-app-server --test all oauth_cancel_rpc_selects_exact_attempt_and_prevents_late_token_persistence -- --nocapture --test-threads=1 > $logs\tools-windows-rpc-20261106.log 2>&1"
$code=$LASTEXITCODE; Write-Output "WINDOWS_RPC_EXIT=$code"
if($code -ne 0){exit $code}
cmd /d /c "cargo build --offline --locked -j4 -p codex-cli --bin codex -p codex-app-server --bin codex-app-server > $logs\tools-windows-build-20261106.log 2>&1"
$code=$LASTEXITCODE; Write-Output "WINDOWS_BUILD_EXIT=$code"
exit $code
