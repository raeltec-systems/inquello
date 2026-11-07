# No distribution launch, download, termination or unregister operation lives here.
[CmdletBinding()]
param(
    [ValidateSet('Preview', 'Apply')][string]$Action = 'Preview',
    [string]$ExpectedConfigSha256
)
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'private-storage.ps1')

function Assert-DLocation([string]$Target) {
    if ($Target -notmatch '^D:\\' -or $Target.Substring(2).Contains(':') -or $Target -match '[\x00-\x1f]' -or
        @($Target.Substring(3).Split('\') | Where-Object { $_ -eq '..' -or $_ -eq '.' -or $_ -match '[. ]$' }).Count -gt 0) {
        throw "Unsafe D-drive location: $Target"
    }
    $probe = [IO.Path]::GetFullPath($Target)
    while ($probe) {
        if (Test-Path -LiteralPath $probe) {
            $item = Get-Item -LiteralPath $probe -Force
            if ($item.Attributes -band [IO.FileAttributes]::ReparsePoint) { throw "Reparse point refused: $probe" }
        }
        $parent = [IO.Directory]::GetParent($probe)
        if ($null -eq $parent) { break }
        $probe = $parent.FullName
    }
    $drive = [IO.DriveInfo]::new('D:\')
    if (-not $drive.IsReady -or $drive.AvailableFreeSpace -lt 32GB) { throw 'D: needs at least 32 GiB available' }
}

function Get-TextSha256([string]$Text) {
    $hash = [Security.Cryptography.SHA256]::Create()
    try { return ([BitConverter]::ToString($hash.ComputeHash([Text.Encoding]::UTF8.GetBytes($Text)))).Replace('-', '').ToLowerInvariant() }
    finally { $hash.Dispose() }
}

$configPath = Join-Path ([Environment]::GetFolderPath('UserProfile')) '.wslconfig'
if (Test-Path -LiteralPath $configPath) {
    if ((Get-Item -LiteralPath $configPath -Force).Attributes -band [IO.FileAttributes]::ReparsePoint) { throw 'Refusing redirected .wslconfig' }
    $original = [IO.File]::ReadAllText($configPath)
} else { $original = '' }
$originalSha256 = Get-TextSha256 $original
$settings = [ordered]@{
    swap = '4GB'
    swapFile = 'D:\\Inquello\\wsl\\swap.vhdx'
    maxCrashDumpCount = '0'
    crashDumpFolder = 'D:\\Inquello\\logs\\wsl-crashes'
}
$lines = [Collections.Generic.List[string]]::new()
$lines.AddRange([string[]]($original -split '\r?\n'))
$sectionStart = -1
$sectionEnd = $lines.Count
for ($i = 0; $i -lt $lines.Count; $i++) {
    if ($lines[$i] -match '^\s*\[wsl2\]\s*(?:[#;].*)?$') {
        if ($sectionStart -ge 0) { throw 'Duplicate [wsl2] sections require manual reconciliation' }
        $sectionStart = $i
    } elseif ($sectionStart -ge 0 -and $sectionEnd -eq $lines.Count -and $lines[$i] -match '^\s*\[') { $sectionEnd = $i }
}
if ($sectionStart -lt 0) {
    if ($original -eq '') { $lines.Clear() }
    $lines.Add('[wsl2]')
    foreach ($key in $settings.Keys) { $lines.Add("$key=$($settings[$key])") }
} else {
    foreach ($key in $settings.Keys) {
        $found = @()
        for ($i = $sectionStart + 1; $i -lt $sectionEnd; $i++) {
            if ($lines[$i] -match "^\s*$key\s*=") { $found += $i }
        }
        if ($found.Count -gt 1) { throw "Duplicate WSL setting: $key" }
        if ($found.Count -eq 1) { $lines[$found[0]] = "$key=$($settings[$key])" }
        else { $lines.Insert($sectionEnd, "$key=$($settings[$key])"); $sectionEnd++ }
    }
}
$proposed = ($lines -join "`r`n").TrimEnd("`r", "`n") + "`r`n"
$locations = @('D:\Inquello\wsl\Inquello-Engine', 'D:\Inquello\cache\images', 'D:\Inquello\tmp', 'D:\Inquello\backups', 'D:\Inquello\logs\wsl-crashes')
foreach ($location in $locations) { Assert-DLocation $location }
$wslExecutable = Join-Path $env:SystemRoot 'System32\wsl.exe'
$running = (& $wslExecutable --list --running --quiet | Out-String).Replace([string][char]0, '').Trim()
if ($LASTEXITCODE -ne 0) { throw 'Cannot inspect running WSL distributions' }
$registered = @()
$lxss = 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Lxss'
if (Test-Path -LiteralPath $lxss) {
    $registered = @(Get-ChildItem -LiteralPath $lxss | ForEach-Object { Get-ItemProperty -LiteralPath $_.PSPath } | ForEach-Object {
        @{ name = $_.DistributionName; basePath = $_.BasePath; version = $_.Version }
    })
}
if ($Action -eq 'Apply') {
    if (-not $ExpectedConfigSha256 -or $ExpectedConfigSha256 -cne $originalSha256) { throw 'Configuration changed or preview digest missing; generate and approve a new preview' }
    # Apply is an explicit operator action after the shared-change preview. It
    # never shuts down WSL and never claims that a new file affects the active VM.
    Assert-DLocation 'D:\Inquello'
    Set-InquelloPrivateDirectory 'D:\Inquello'
    foreach ($location in $locations) { Set-InquelloPrivateDirectory $location }
    $env:TEMP = 'D:\Inquello\tmp'
    $env:TMP = $env:TEMP
    $env:TMPDIR = $env:TEMP
    $backup = Join-Path 'D:\Inquello\backups' ("wslconfig-$originalSha256.txt")
    if (-not (Test-Path -LiteralPath $backup)) { [IO.File]::WriteAllText($backup, $original, [Text.UTF8Encoding]::new($false)) }
    if ((Get-TextSha256 $(if (Test-Path -LiteralPath $configPath) { [IO.File]::ReadAllText($configPath) } else { '' })) -cne $originalSha256) { throw 'Configuration changed during preparation' }
    [IO.File]::WriteAllText($configPath, $proposed, [Text.UTF8Encoding]::new($false))
}
[ordered]@{
    action = $Action
    configPath = $configPath
    expectedConfigSha256 = $originalSha256
    proposedConfig = $proposed
    runningDistributions = $running
    registeredDistributions = $registered
    storageLocations = $locations
    freeBytes = ([IO.DriveInfo]::new('D:\')).AvailableFreeSpace
    guestLaunchAllowed = $false
    activeSwapVerified = $false
    reason = 'Config text alone does not prove active swap. Shared VM restart and live storage/isolation proof remain required.'
} | ConvertTo-Json -Depth 6
