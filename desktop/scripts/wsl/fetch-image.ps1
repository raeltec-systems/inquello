# Downloads only the image and authentication material pinned by the approved
# inventory. Does not import, extract, launch, or install anything.
[CmdletBinding()]
param(
    [string]$Cache = 'D:\Inquello\cache\images',
    [string]$Gpg = 'C:\Program Files\Git\usr\bin\gpg.exe'
)
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'private-storage.ps1')
if ($Cache -notmatch '^D:\\' -or $Cache.Substring(2).Contains(':') -or $Cache -match '[\x00-\x1f]' -or
    @($Cache.Substring(3).Split('\') | Where-Object { $_ -eq '..' -or $_ -eq '.' -or $_ -match '[. ]$' }).Count -gt 0) { throw 'Image cache must be an explicit D: path' }
$candidate = [IO.Path]::GetFullPath($Cache)
while ($candidate) {
    if ((Test-Path -LiteralPath $candidate) -and ((Get-Item -LiteralPath $candidate -Force).Attributes -band [IO.FileAttributes]::ReparsePoint)) { throw 'Reparse point in image cache path' }
    $parent = [IO.Directory]::GetParent($candidate)
    if ($null -eq $parent) { break }
    $candidate = $parent.FullName
}
if (([IO.DriveInfo]::new('D:\')).AvailableFreeSpace -lt 32GB) { throw 'Image fetch needs at least 32 GiB free on D:' }
if (-not (Test-Path -LiteralPath $Gpg -PathType Leaf)) { throw 'Existing GPG verifier missing; installation needs separate approval' }
$manifest = Get-Content -Raw -LiteralPath (Join-Path $PSScriptRoot 'build-manifest.json') | ConvertFrom-Json
$fingerprint = '843938DF228D22F7B3742BC0D94AA3F0EFE21092'
Set-InquelloPrivateDirectory $Cache
$stage = Join-Path $Cache ('verification-' + [Guid]::NewGuid().ToString('N'))
Set-InquelloPrivateDirectory $stage
$env:TEMP = $stage
$env:TMP = $stage
$env:TMPDIR = $stage
$gpgDirectory = Join-Path $stage 'gnupg'
Set-InquelloPrivateDirectory $gpgDirectory
$env:GNUPGHOME = $gpgDirectory
$curl = Join-Path $env:SystemRoot 'System32\curl.exe'
function Get-PinnedFile([string]$Uri, [string]$Destination) {
    & $curl --fail --silent --show-error --location --proto '=https' --proto-redir '=https' --connect-timeout 20 --max-time 180 --output $Destination $Uri
    if ($LASTEXITCODE -ne 0) { throw "Download failed; recoverable staging: $stage" }
}
$checksums = Join-Path $stage 'SHA256SUMS'
$signature = Join-Path $stage 'SHA256SUMS.gpg'
$key = Join-Path $stage 'ubuntu-cdimage.asc'
Get-PinnedFile $manifest.image.checksumUrl $checksums
Get-PinnedFile $manifest.image.signatureUrl $signature
Get-PinnedFile "https://keyserver.ubuntu.com/pks/lookup?op=get&search=0x$fingerprint" $key
# Git's bundled GPG uses MSYS paths for its home, even when invoked by PowerShell.
function Get-GpgPath([string]$Target) {
    if ($Gpg -match '[/\\]usr[/\\]bin[/\\]gpg\.exe$') { return '/d/' + $Target.Substring(3).Replace('\', '/') }
    return $Target
}
$gpgOptions = @('--no-options', '--homedir', (Get-GpgPath $gpgDirectory), '--no-autostart', '--batch', '--no-auto-key-retrieve')
& $Gpg @gpgOptions --import (Get-GpgPath $key)
if ($LASTEXITCODE -ne 0) { throw 'Cannot import Ubuntu verification key' }
$verification = (& $Gpg @gpgOptions --status-fd 1 --verify (Get-GpgPath $signature) (Get-GpgPath $checksums) | Out-String)
if ($LASTEXITCODE -ne 0 -or $verification -notmatch "(?m)^\[GNUPG:\] VALIDSIG $fingerprint ") { throw 'Ubuntu signature/fingerprint verification failed' }
$expected = "$($manifest.image.sha256) *$($manifest.image.filename)"
if (-not (([IO.File]::ReadAllLines($checksums)) -ccontains $expected)) { throw 'Signed checksum does not match the pinned image manifest' }
# Authentication precedes the image download. Never silently refresh a digest.
$receipt = [ordered]@{
    imageFilename = $manifest.image.filename
    imageSha256 = $manifest.image.sha256
    signerFingerprint = $fingerprint
    checksumsSha256 = (Get-FileHash -LiteralPath $checksums -Algorithm SHA256).Hash.ToLowerInvariant()
    signatureSha256 = (Get-FileHash -LiteralPath $signature -Algorithm SHA256).Hash.ToLowerInvariant()
    signatureVerifiedAt = [DateTime]::UtcNow.ToString('o')
    imageVerifiedAt = $null
}
$receiptPath = Join-Path $stage 'verification.json'
$receipt | ConvertTo-Json | Set-Content -LiteralPath $receiptPath -Encoding utf8
$image = Join-Path $stage $manifest.image.filename
Get-PinnedFile $manifest.image.url $image
if ((Get-FileHash -LiteralPath $image -Algorithm SHA256).Hash.ToLowerInvariant() -cne $manifest.image.sha256) { throw 'Downloaded image checksum mismatch; no publication' }
$published = Join-Path $Cache $manifest.image.filename
if (Test-Path -LiteralPath $published) {
    if ((Get-Item -LiteralPath $published -Force).Attributes -band [IO.FileAttributes]::ReparsePoint) { throw 'Refusing redirected cached image' }
    if ((Get-FileHash -LiteralPath $published -Algorithm SHA256).Hash.ToLowerInvariant() -cne $manifest.image.sha256) { throw 'Existing image collision; source retained in staging' }
} else { Move-Item -LiteralPath $image -Destination $published }
$receipt.imageVerifiedAt = [DateTime]::UtcNow.ToString('o')
$receipt | ConvertTo-Json | Set-Content -LiteralPath $receiptPath -Encoding utf8
[ordered]@{ image = $published; receipt = $receiptPath; sha256 = $manifest.image.sha256; imported = $false } | ConvertTo-Json
