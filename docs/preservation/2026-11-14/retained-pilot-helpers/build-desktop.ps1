param([ValidateSet('first','retry')][string]$Attempt='first')
$ErrorActionPreference='Stop'
$op='D:\Projects\inquello\.tmp\epic1-live-acceptance-20261109'
$suffix=if($Attempt -eq 'retry'){'-retry'}else{''}
if((Get-Content -Raw "$op\native-build-retry-result.json"|ConvertFrom-Json).exitCode -ne 0){throw 'Native build not qualified'}
$env:COREPACK_ENABLE_NETWORK='0';$env:PNPM_CONFIG_OFFLINE='true'
$env:INQUELLO_CODEX_CLI='D:\Projects\inquello\engine\codex-rs\target\debug\codex.exe'
$env:INQUELLO_APP_SERVER='D:\Projects\inquello\engine\codex-rs\target\debug\codex-app-server.exe'
Set-Location 'D:\Projects\inquello\desktop'
foreach($name in @("protocol$suffix.log","desktop-build$suffix.log","desktop-build$suffix-result.json")){if(Test-Path "$op\$name"){throw 'Refuse evidence overwrite'}}
& pnpm.cmd run generate:protocol *> "$op\protocol$suffix.log"
$protocolCode=$LASTEXITCODE
if($protocolCode -ne 0){@{protocolExit=$protocolCode;buildExit=$null}|ConvertTo-Json|Set-Content "$op\desktop-build$suffix-result.json";exit $protocolCode}
& node.exe '..\_bmad-output\implementation-artifacts\verification-2026-11-05\freeze-provider-recovery-final-20261107.cjs' check *> "$op\source-after-protocol$suffix.log"
if($LASTEXITCODE -ne 0){throw 'Generated source drift; build stopped'}
& pnpm.cmd run build *> "$op\desktop-build$suffix.log"
$buildCode=$LASTEXITCODE
@{protocolExit=$protocolCode;buildExit=$buildCode;completedUtc=[DateTime]::UtcNow.ToString('o');offline=$true}|ConvertTo-Json|Set-Content "$op\desktop-build$suffix-result.json"
exit $buildCode
