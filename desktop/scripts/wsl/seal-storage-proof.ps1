param([Parameter(Mandatory=$true)][string]$RestartReceipt)
$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'private-storage.ps1')
$prior = Get-Content -LiteralPath $RestartReceipt -Raw | ConvertFrom-Json
if (-not $prior.activeSwapVerified -or $prior.swapPath -ne 'D:\Inquello\wsl\swap.vhdx') { throw 'Approved active D-swap receipt required' }
$config = Join-Path $env:USERPROFILE '.wslconfig'
if ((Get-FileHash -LiteralPath $config -Algorithm SHA256).Hash.ToLowerInvariant() -ne $prior.configSha256) { throw 'Shared WSL configuration changed' }
$swap = Get-Item -LiteralPath $prior.swapPath
if ($swap.CreationTimeUtc -ne ([DateTime]$prior.swapCreatedAt).ToUniversalTime()) { throw 'Swap identity changed' }
$registry = @(Get-ChildItem 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Lxss' | ForEach-Object { Get-ItemProperty $_.PSPath } | Where-Object DistributionName -eq 'Inquello-Engine')
if ($registry.Count -ne 1 -or $registry[0].Version -ne 2 -or $registry[0].BasePath.TrimEnd('\') -ne 'D:\Inquello\wsl\Inquello-Engine') { throw 'Guest registration mismatch' }
$info = [Diagnostics.ProcessStartInfo]::new()
$info.FileName = Join-Path $env:SystemRoot 'System32\wsl.exe'
$info.UseShellExecute = $false
$info.CreateNoWindow = $true
$info.RedirectStandardOutput = $true
$info.RedirectStandardError = $true
$info.WorkingDirectory = 'D:\Inquello\tmp'
$info.Environment.Clear()
foreach ($key in @('SystemRoot','WINDIR')) { $info.Environment[$key] = $env:SystemRoot }
foreach ($key in @('TEMP','TMP','TMPDIR')) { $info.Environment[$key] = 'D:\Inquello\tmp' }
$code = 'import json,pathlib; print(json.dumps({"bootId":pathlib.Path("/proc/sys/kernel/random/boot_id").read_text().strip(),"bootTime":int(next(x.split()[1] for x in pathlib.Path("/proc/stat").read_text().splitlines() if x.startswith("btime ")))}))'
foreach ($arg in @('-d','Inquello-Engine','--user','inquello','--cd','/','--exec','/usr/bin/env','-i','PATH=/usr/bin:/bin','/usr/bin/python3','-I','-c',$code)) { $info.ArgumentList.Add($arg) }
$process = [Diagnostics.Process]::Start($info)
$output = $process.StandardOutput.ReadToEnd()
$errors = $process.StandardError.ReadToEnd()
if (-not $process.WaitForExit(15000) -or $process.ExitCode -ne 0) { throw "Live VM identity unavailable: $errors" }
$guest = $output | ConvertFrom-Json
$earliest = [DateTimeOffset]::Parse($prior.restartAt).ToUnixTimeSeconds() - 2
$latest = [DateTimeOffset]::Parse($prior.verifiedAt).ToUnixTimeSeconds()
if ($guest.bootTime -lt $earliest -or $guest.bootTime -gt $latest) { throw 'The active VM no longer belongs to the approved D-swap restart; repeat coordinated storage proof' }
Set-InquelloPrivateDirectory 'D:\Inquello\runtime'
$proof = [ordered]@{ version=1; bootId=$guest.bootId; bootTime=$guest.bootTime; configSha256=$prior.configSha256; swapCreatedAt=$swap.CreationTimeUtc.ToString('yyyy-MM-ddTHH:mm:ss.fffZ'); distribution='D:\Inquello\wsl\Inquello-Engine'; diskVirtualBytes=137438953472; sourceReceipt=(Get-FileHash -LiteralPath $RestartReceipt -Algorithm SHA256).Hash.ToLowerInvariant() }
$proof | ConvertTo-Json | Set-Content -LiteralPath 'D:\Inquello\runtime\storage-proof.json' -Encoding utf8NoBOM
$proof | ConvertTo-Json
