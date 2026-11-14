$ErrorActionPreference='Stop'
$op='D:\Projects\inquello\.tmp\epic1-live-acceptance-20261109'
$repo='D:\Projects\inquello'
. "$repo\.tmp\story121-env.ps1"
$env:PATH=$env:SystemRoot+'\System32;C:\Program Files\Git\usr\bin;C:\Program Files\nodejs;'+$env:PATH
$env:RUSTUP_AUTO_INSTALL='0';$env:COREPACK_ENABLE_NETWORK='0'
Set-Location $repo
foreach($name in @('launch-preflight.log','runner.stdout.log','runner.stderr.log','runner-owner.json','runner-exit.json')){if(Test-Path "$op\$name"){throw 'Refuse launch evidence overwrite'}}
$node=(Get-Command node.exe -ErrorAction Stop).Source
& $node "$op\recover.cjs" preflight *> "$op\launch-preflight.log"
if($LASTEXITCODE -ne 0){throw 'Fresh same-profile preflight refused; no launch'}
$hasher=[System.Security.Cryptography.SHA256]::Create()
try{$manifestDigest=[BitConverter]::ToString($hasher.ComputeHash([IO.File]::ReadAllBytes("$op\matched-build.json"))).Replace('-','').ToLowerInvariant()}finally{$hasher.Dispose()}
$runner=Start-Process -FilePath $node -ArgumentList @("$repo\desktop\scripts\run-auth0-pilot.cjs",'--manifest',"$op\matched-build.json",'--resume','D:\Inquello\tmp\inquello-auth0-pilot-20261102') -WorkingDirectory "$repo\desktop" -WindowStyle Hidden -RedirectStandardOutput "$op\runner.stdout.log" -RedirectStandardError "$op\runner.stderr.log" -PassThru
@{pid=$runner.Id;startedUtc=[DateTime]::UtcNow.ToString('o');head='daf2dbae7ff1bc229c0bbc012cb9bc89cb09a7e3';manifestSha256=$manifestDigest;runId='9f9d996b-255c-47f8-9fa2-4fc004cfab03'}|ConvertTo-Json|Set-Content "$op\runner-owner.json"
$runner.WaitForExit();$runner.Refresh()
if($null -eq $runner.ExitCode){throw 'Runner exit unresolved; reconcile without duplicate launch'}
@{exitCode=$runner.ExitCode;completedUtc=[DateTime]::UtcNow.ToString('o')}|ConvertTo-Json|Set-Content "$op\runner-exit.json"
exit $runner.ExitCode
