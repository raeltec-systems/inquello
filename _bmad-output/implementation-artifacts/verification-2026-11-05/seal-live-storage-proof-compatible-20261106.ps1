# Read-only HCS/guest observations precede replacement of the owned proof.
# No shared WSL shutdown, guest install, or Docker mutation is performed.
$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

$base = 'D:\Inquello\wsl\Inquello-Engine'
$swapPath = 'D:\Inquello\wsl\swap.vhdx'
$runtime = 'D:\Inquello\runtime'
$oldProof = Get-Content -Raw -LiteralPath (Join-Path $runtime 'storage-proof.json') | ConvertFrom-Json
$config = Join-Path $env:USERPROFILE '.wslconfig'
$hash = (Get-FileHash -Algorithm SHA256 -LiteralPath $config).Hash.ToLowerInvariant()
if ($hash -ne $oldProof.configSha256) { throw 'Shared WSL configuration changed' }
$swap = Get-Item -LiteralPath $swapPath -Force
if ($swap.Attributes -band [IO.FileAttributes]::ReparsePoint) { throw 'Swap is redirected' }
if ([Math]::Abs(($swap.CreationTimeUtc - ([DateTime]$oldProof.swapCreatedAt).ToUniversalTime()).TotalMilliseconds) -ge 1) { throw 'Swap identity changed' }
if ([IO.DriveInfo]::new('D:\').AvailableFreeSpace -lt 32GB) { throw 'Insufficient D-drive capacity' }
$guest = @(Get-ChildItem 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Lxss' | ForEach-Object { Get-ItemProperty $_.PSPath } | Where-Object { $_.PSObject.Properties['DistributionName'] -and $_.DistributionName -eq 'Inquello-Engine' })
if ($guest.Count -ne 1 -or $guest[0].Version -ne 2 -or $guest[0].BasePath.TrimEnd('\') -ine $base) { throw 'Dedicated guest registration changed' }
$disk = Get-DiskImage -ImagePath (Join-Path $base 'ext4.vhdx')
if ($disk.Size -ne 128GB) { throw 'Guest disk cap changed' }

$machines = & (Join-Path $env:SystemRoot 'System32\hcsdiag.exe') list -raw | ConvertFrom-Json
if ($LASTEXITCODE -ne 0) { throw 'WSL VM metadata unavailable' }
$vm = @($machines | Where-Object { $_.Owner -eq 'WSL' -and $_.State -eq 'Running' })
if ($vm.Count -ne 1) { throw 'Expected exactly one running WSL VM' }
$output = & python 'D:\Projects\inquello\_bmad-output\implementation-artifacts\verification-2026-11-05\read-live-storage-observation-20261106.py'
if ($LASTEXITCODE -ne 0) { throw 'Live guest storage observation failed' }
$observation = $output | ConvertFrom-Json
$boot = [DateTimeOffset]::FromUnixTimeSeconds($observation.bootTime).UtcDateTime
$events = @(Get-WinEvent -FilterHashtable @{LogName='Microsoft-Windows-Hyper-V-Compute-Operational'; StartTime=$boot.AddMinutes(-2); Id=2007} | Where-Object {
    $_.Message -match [regex]::Escape($vm[0].Id) -and $_.Message -match [regex]::Escape("VirtualMachine/Devices/Scsi/0/Attachments/$($observation.lun)")
})
if ($events.Count -eq 0) { throw 'Current-boot swap attachment event is unavailable' }
$last = $events | Sort-Object TimeCreated -Descending | Select-Object -First 1
if ($last.Message -notmatch 'result 0x00000000' -or $last.Message -notmatch 'settings ''(.+)''\s*, result') { throw 'Last swap attachment was not successful' }
$settings = $Matches[1] | ConvertFrom-Json
if ($settings.RequestType -ne 'Add' -or $settings.Settings.Path -ine $swapPath -or $settings.Settings.ReadOnly) { throw 'Active swap does not match the approved D-drive file' }
$recheck = & (Join-Path $env:SystemRoot 'System32\hcsdiag.exe') list -raw | ConvertFrom-Json
if ($LASTEXITCODE -ne 0 -or @($recheck | Where-Object { $_.Id -eq $vm[0].Id -and $_.Owner -eq 'WSL' -and $_.State -eq 'Running' }).Count -ne 1) { throw 'WSL VM changed during proof' }
$proof = [ordered]@{ version=1; bootId=$observation.bootId; bootTime=$observation.bootTime; configSha256=$hash; swapCreatedAt=$swap.CreationTimeUtc.ToString('yyyy-MM-ddTHH:mm:ss.fffZ'); distribution=$base; diskVirtualBytes=[long]$disk.Size; sourceReceipt='hcs-live-v1'; vmId=$vm[0].Id; swapDevice=$observation.swapDevice; swapLun=$observation.lun; attachmentEventRecordId=$last.RecordId }
$backup = Join-Path 'D:\Inquello\backups' ("storage-proof-" + [guid]::NewGuid().ToString() + '.json')
Copy-Item -LiteralPath (Join-Path $runtime 'storage-proof.json') -Destination $backup
$temporary = Join-Path $runtime ("storage-proof-" + [guid]::NewGuid().ToString() + '.tmp')
[IO.File]::WriteAllText($temporary, ($proof | ConvertTo-Json), [Text.UTF8Encoding]::new($false))
Move-Item -LiteralPath $temporary -Destination (Join-Path $runtime 'storage-proof.json') -Force
$proof | ConvertTo-Json
