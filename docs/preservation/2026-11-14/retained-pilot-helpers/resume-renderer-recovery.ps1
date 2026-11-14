# Future explicit resume only. This refuses the currently running owned app.
$ErrorActionPreference='Stop'
$op='D:\Projects\inquello\.tmp\epic1-live-acceptance-20261109'
$repo='D:\Projects\inquello'
. "$repo\.tmp\story121-env.ps1"
$env:PATH=$env:SystemRoot+'\System32;C:\Program Files\Git\usr\bin;C:\Program Files\nodejs;'+$env:PATH
$env:COREPACK_ENABLE_NETWORK='0';$env:RUSTUP_AUTO_INSTALL='0'
Set-Location $repo
$prefix="$op\renderer-recovery-runner"
foreach($suffix in @('.preflight.log','.stdout.log','.stderr.log','.owner.json','.exit.json')){if(Test-Path ($prefix+$suffix)){throw 'Refuse current-candidate launch evidence overwrite'}}
$node=(Get-Command node.exe -ErrorAction Stop).Source
& $node "$op\preflight-renderer-recovery.cjs" *> ($prefix+'.preflight.log')
if($LASTEXITCODE -ne 0){throw 'Current-candidate same-profile preflight refused; no launch'}
$manifest="$op\matched-build-renderer-recovery.json"
$hasher=[System.Security.Cryptography.SHA256]::Create()
try{$digest=[BitConverter]::ToString($hasher.ComputeHash([IO.File]::ReadAllBytes($manifest))).Replace('-','').ToLowerInvariant()}finally{$hasher.Dispose()}
$runner=Start-Process -FilePath $node -ArgumentList @("$repo\desktop\scripts\run-auth0-pilot.cjs",'--manifest',$manifest,'--resume','D:\Inquello\tmp\inquello-auth0-pilot-20261102') -WorkingDirectory "$repo\desktop" -WindowStyle Hidden -RedirectStandardOutput ($prefix+'.stdout.log') -RedirectStandardError ($prefix+'.stderr.log') -PassThru
@{pid=$runner.Id;startedUtc=[DateTime]::UtcNow.ToString('o');manifestSha256=$digest;runId='9f9d996b-255c-47f8-9fa2-4fc004cfab03'}|ConvertTo-Json|Set-Content ($prefix+'.owner.json')
$runner.WaitForExit();$runner.Refresh()
if($null -eq $runner.ExitCode){throw 'Runner exit unresolved; reconcile without duplicate launch'}
@{exitCode=$runner.ExitCode;at=[DateTime]::UtcNow.ToString('o')}|ConvertTo-Json|Set-Content ($prefix+'.exit.json')
exit $runner.ExitCode
