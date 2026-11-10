[CmdletBinding()]
param(
    [Parameter(Mandatory)][string]$Image,
    [Parameter(Mandatory)][string]$StorageProof
)
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'private-storage.ps1')
$distro = 'Inquello-Engine'
$destination = 'D:\Inquello\wsl\Inquello-Engine'
$config = Join-Path ([Environment]::GetFolderPath('UserProfile')) '.wslconfig'
$proof = Get-Content -Raw -LiteralPath $StorageProof | ConvertFrom-Json
if ($proof.activeSwapVerified -ne $true -or $proof.swapPath -cne 'D:\Inquello\wsl\swap.vhdx' -or
    [DateTime]::UtcNow.Subtract([DateTime]::Parse($proof.verifiedAt)).TotalMinutes -gt 30 -or
    (Get-FileHash -LiteralPath $config -Algorithm SHA256).Hash.ToLowerInvariant() -cne $proof.configSha256) { throw 'Missing, stale or changed active storage proof' }
$source = [IO.Path]::GetFullPath($Image)
if ($source -notmatch '^D:\\' -or -not (Test-Path -LiteralPath $source -PathType Leaf)) { throw 'Prepared image must exist on D:' }
$receiptPath = [IO.Path]::ChangeExtension($source, '.receipt.json')
$receipt = Get-Content -Raw -LiteralPath $receiptPath | ConvertFrom-Json
if ($receipt.automount -ne $false -or $receipt.interop -ne $false -or $receipt.defaultUid -ne 1000 -or
    (Get-FileHash -LiteralPath $source -Algorithm SHA256).Hash.ToLowerInvariant() -cne $receipt.preparedSha256) { throw 'Prepared image verification failed' }
foreach ($target in @($source, $destination, 'D:\Inquello\tmp', $proof.swapPath)) {
    $candidate = $target
    while ($candidate) {
        if ((Test-Path -LiteralPath $candidate) -and ((Get-Item -LiteralPath $candidate -Force).Attributes -band [IO.FileAttributes]::ReparsePoint)) { throw 'Redirected WSL storage' }
        $parent = [IO.Directory]::GetParent($candidate)
        if ($null -eq $parent) { break }
        $candidate = $parent.FullName
    }
}
if (([IO.DriveInfo]::new('D:\')).AvailableFreeSpace -lt 32GB) { throw 'D: needs at least 32 GiB free' }
$lxss = 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Lxss'
$registrations = @(Get-ChildItem -LiteralPath $lxss | ForEach-Object { Get-ItemProperty -LiteralPath $_.PSPath })
if (@($registrations | Where-Object DistributionName -eq $distro).Count -ne 0) { throw 'Owned distribution already exists; inspect it instead of replacing it' }
$previousDefault = (Get-ItemProperty -LiteralPath $lxss).DefaultDistribution
if ((Test-Path -LiteralPath $destination) -and @(Get-ChildItem -LiteralPath $destination -Force).Count -ne 0) { throw 'Destination is not empty; retain it for recovery' }
Set-InquelloPrivateDirectory $destination
$launch = [Diagnostics.ProcessStartInfo]::new()
$launch.FileName = Join-Path $env:SystemRoot 'System32\wsl.exe'
$launch.UseShellExecute = $false
$launch.CreateNoWindow = $true
$launch.WorkingDirectory = 'D:\Inquello\tmp'
$launch.Environment.Clear()
foreach ($pair in @{ SystemRoot = $env:SystemRoot; WINDIR = $env:SystemRoot; TEMP = 'D:\Inquello\tmp'; TMP = 'D:\Inquello\tmp'; TMPDIR = 'D:\Inquello\tmp' }.GetEnumerator()) { $launch.Environment[$pair.Key] = $pair.Value }
foreach ($argument in @('--install', '--from-file', $source, '--location', $destination, '--name', $distro, '--vhd-size', '128GB', '--no-launch', '--version', '2')) { $launch.ArgumentList.Add($argument) }
$process = [Diagnostics.Process]::Start($launch)
$process.WaitForExit()
if ($process.ExitCode -ne 0) { throw "WSL image install failed ($($process.ExitCode)); no automatic cleanup" }
$actual = @(Get-ChildItem -LiteralPath $lxss | ForEach-Object { Get-ItemProperty -LiteralPath $_.PSPath } | Where-Object DistributionName -eq $distro)
if ($actual.Count -ne 1 -or $actual[0].Version -ne 2 -or $actual[0].BasePath.TrimEnd('\') -ine $destination) { throw 'Unexpected distribution registration; guest launch blocked' }
if ((Get-ItemProperty -LiteralPath $lxss).DefaultDistribution -cne $previousDefault) { throw 'Default distribution changed unexpectedly; inspect before continuing' }
[ordered]@{ name = $distro; basePath = $actual[0].BasePath; version = $actual[0].Version; previousDefault = $previousDefault; requestedMaximumBytes = 128GB; diskCapacityVerified = $false; launched = $false } | ConvertTo-Json
