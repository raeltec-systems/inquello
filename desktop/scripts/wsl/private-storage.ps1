function Set-InquelloPrivateDirectory([string]$Target) {
    # Restrict the named directory only. Never recurse into existing payloads.
    if (-not (Test-Path -LiteralPath $Target)) { [IO.Directory]::CreateDirectory($Target) | Out-Null }
    $item = Get-Item -LiteralPath $Target -Force
    if (-not $item.PSIsContainer -or ($item.Attributes -band [IO.FileAttributes]::ReparsePoint)) { throw 'Private storage must be a regular directory' }
    $currentUser = [Security.Principal.WindowsIdentity]::GetCurrent().User.Value
    $allowed = @($currentUser, 'S-1-5-18', 'S-1-5-32-544')
    $acl = Get-Acl -LiteralPath $Target
    $acl.SetAccessRuleProtection($true, $false)
    foreach ($rule in @($acl.GetAccessRules($true, $true, [Security.Principal.SecurityIdentifier]))) { $acl.RemoveAccessRuleSpecific($rule) }
    foreach ($id in $allowed) {
        $sid = [Security.Principal.SecurityIdentifier]::new($id)
        $rule = [Security.AccessControl.FileSystemAccessRule]::new($sid, 'FullControl', 'ContainerInherit,ObjectInherit', 'None', 'Allow')
        $acl.AddAccessRule($rule)
    }
    Set-Acl -LiteralPath $Target -AclObject $acl
    $verified = Get-Acl -LiteralPath $Target
    if (-not $verified.AreAccessRulesProtected) { throw 'Private storage ACL was not protected' }
    $ownerAccess = $false
    foreach ($rule in $verified.GetAccessRules($true, $true, [Security.Principal.SecurityIdentifier])) {
        if ($rule.AccessControlType -eq 'Allow') {
            if ($allowed -notcontains $rule.IdentityReference.Value) { throw 'Unexpected principal in private storage ACL' }
            if ($rule.IdentityReference.Value -eq $currentUser -and
                ($rule.FileSystemRights -band [Security.AccessControl.FileSystemRights]::FullControl) -eq [Security.AccessControl.FileSystemRights]::FullControl) { $ownerAccess = $true }
        }
    }
    if (-not $ownerAccess) { throw 'Private storage owner access missing' }
}
