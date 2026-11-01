$ErrorActionPreference = 'Stop'
$owner = [System.Security.Principal.WindowsIdentity]::GetCurrent().User
$allowed = @($owner.Value, 'S-1-5-18', 'S-1-5-32-544')
function Assert-PrivateDirectory([string]$target, [bool]$protected = $false) {
    $acl = [IO.Directory]::GetAccessControl($target, [System.Security.AccessControl.AccessControlSections]'Access, Owner')
    if ($allowed -notcontains $acl.GetOwner([System.Security.Principal.SecurityIdentifier]).Value) { throw 'Private D storage owner is unexpected' }
    if ($protected -and !$acl.AreAccessRulesProtected) { throw 'Private profile DACL must be protected' }
    $ownerAccess = $false
    foreach ($rule in $acl.GetAccessRules($true, $true, [System.Security.Principal.SecurityIdentifier])) {
        if ($rule.AccessControlType -eq 'Allow') {
            if ($allowed -notcontains $rule.IdentityReference.Value) { throw 'D storage grants another principal access' }
            if ($rule.IdentityReference.Value -eq $owner.Value -and ($rule.FileSystemRights -band [System.Security.AccessControl.FileSystemRights]::FullControl) -eq [System.Security.AccessControl.FileSystemRights]::FullControl) { $ownerAccess = $true }
        }
    }
    if (!$ownerAccess) { throw 'Private D storage ownership is unavailable' }
}
foreach ($target in @('D:\Inquello','D:\Inquello\tmp','D:\Inquello\runtime','D:\Inquello\wsl','D:\Inquello\wsl\Inquello-Engine','D:\Inquello\wsl\Inquello-Engine\ext4.vhdx','D:\Inquello\wsl\swap.vhdx','D:\Inquello\runtime\storage-proof.json')) {
    $item=Get-Item -LiteralPath $target -Force
    if ($item.Attributes -band [IO.FileAttributes]::ReparsePoint) { throw 'Redirected D storage is unavailable' }
    if ($item.PSIsContainer) { Assert-PrivateDirectory $target }
}
if ($env:INQUELLO_WSL_SCOPE -notmatch '^[0-9a-f]{64}$') { throw 'Invalid private execution scope' }
foreach ($target in @('D:\Inquello\profiles', ('D:\Inquello\profiles\' + $env:INQUELLO_WSL_SCOPE), ('D:\Inquello\profiles\' + $env:INQUELLO_WSL_SCOPE + '\bindings'))) {
    if (Test-Path -LiteralPath $target) {
        $item = Get-Item -LiteralPath $target -Force
        if (!$item.PSIsContainer -or ($item.Attributes -band [IO.FileAttributes]::ReparsePoint)) { throw 'Private profile storage redirected' }
        Assert-PrivateDirectory $target $true
    } else {
        # Apply a protected DACL atomically at creation. Never rewrite an
        # existing shared parent: Windows may propagate that change to children.
        $acl = New-Object System.Security.AccessControl.DirectorySecurity
        $acl.SetOwner($owner)
        $acl.SetAccessRuleProtection($true, $false)
        foreach ($id in $allowed) {
            $sid = New-Object System.Security.Principal.SecurityIdentifier($id)
            $rule = New-Object System.Security.AccessControl.FileSystemAccessRule($sid, 'FullControl', 'ContainerInherit, ObjectInherit', 'None', 'Allow')
            $acl.AddAccessRule($rule)
        }
        [void][IO.Directory]::CreateDirectory($target, $acl)
        Assert-PrivateDirectory $target $true
    }
}
if ([IO.DriveInfo]::new('D:\').AvailableFreeSpace -lt 34359738368) { throw 'D storage requires 32 GiB free' }
$proof=Get-Content -LiteralPath 'D:\Inquello\runtime\storage-proof.json' -Raw | ConvertFrom-Json
if ($proof.version -ne 1 -or $proof.distribution -ne 'D:\Inquello\wsl\Inquello-Engine' -or $proof.diskVirtualBytes -ne 137438953472) { throw 'Storage proof incomplete' }
if ((Get-FileHash -LiteralPath (Join-Path $env:USERPROFILE '.wslconfig') -Algorithm SHA256).Hash.ToLowerInvariant() -ne $proof.configSha256) { throw 'Shared WSL configuration changed' }
$swap=Get-Item -LiteralPath 'D:\Inquello\wsl\swap.vhdx'
if ($swap.CreationTimeUtc.ToString('yyyy-MM-ddTHH:mm:ss.fffZ') -ne ([DateTime]$proof.swapCreatedAt).ToUniversalTime().ToString('yyyy-MM-ddTHH:mm:ss.fffZ')) { throw 'Swap identity changed' }
$registered=@(Get-ChildItem 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Lxss' | ForEach-Object {Get-ItemProperty $_.PSPath} | Where-Object DistributionName -eq 'Inquello-Engine')
if ($registered.Count -ne 1 -or $registered[0].Version -ne 2 -or $registered[0].BasePath.TrimEnd('\') -ne 'D:\Inquello\wsl\Inquello-Engine') { throw 'Dedicated guest registration changed' }
[Guid]::Parse($proof.bootId).ToString()
