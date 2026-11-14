$ErrorActionPreference='Stop'
$root='D:\Projects\inquello'
$logs="$root\_bmad-output\implementation-artifacts\verification-2026-11-05"
$env:RUSTUP_HOME='D:\Toolchains\rustup'; $env:CARGO_HOME='D:\Toolchains\cargo'
$env:TEMP='D:\Toolchains\tmp'; $env:TMP=$env:TEMP; $env:TMPDIR=$env:TEMP
$env:CARGO_INCREMENTAL='0'; $env:CARGO_PROFILE_DEV_DEBUG='0'; $env:CARGO_PROFILE_TEST_DEBUG='0'; $env:CARGO_NET_OFFLINE='true'
$env:PATH='D:\Toolchains\rustup\toolchains\1.99.1-x86_64-pc-windows-msvc\bin;D:\Toolchains\cargo\bin;D:\Toolchains\npm-global;C:\Program Files\nodejs;'+$env:PATH
Set-Location $root
$deadline=(Get-Date).AddMinutes(45)
while(Get-CimInstance Win32_Process | Where-Object {$_.Name -eq 'node.exe' -and $_.CommandLine -match 'vitest'}){
 if((Get-Date) -gt $deadline){Write-Output 'OTHER_TESTS_ACTIVE_TIMEOUT: suite not started';exit 2}
 Write-Output 'Waiting for unrelated Vitest jobs to finish.'
 Start-Sleep -Seconds 30
}
node "$logs\freeze-provider-recovery-final-20261107.cjs" check
if($LASTEXITCODE -ne 0){exit $LASTEXITCODE}
node "$logs\run-docker-verification.cjs" 'D:\Inquello\tmp\epic1-pg-20261105-d778fa3f\ownership.json' suite provider-recovery-final-20261107
$code=$LASTEXITCODE; Write-Output "SUITE_FINAL_EXIT=$code"; if($code -ne 0){exit $code}
node "$logs\freeze-provider-recovery-final-20261107.cjs" check
if($LASTEXITCODE -ne 0){exit $LASTEXITCODE}
node "$logs\run-docker-verification.cjs" 'D:\Inquello\tmp\epic1-pg-20261105-d778fa3f\ownership.json' smoke provider-recovery-final-20261107
$code=$LASTEXITCODE; Write-Output "SMOKE_FINAL_EXIT=$code"; if($code -ne 0){exit $code}
node "$logs\freeze-provider-recovery-final-20261107.cjs" check
exit $LASTEXITCODE
