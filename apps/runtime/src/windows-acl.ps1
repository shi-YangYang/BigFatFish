$ErrorActionPreference = 'Stop'
try {
    [Console]::InputEncoding = [System.Text.Encoding]::UTF8
    # The script is constant; paths are JSON on stdin, never executable text.
    $request = [Console]::In.ReadToEnd() | ConvertFrom-Json
    if ($request.operation -notin @('restrict', 'verify')) { throw 'INVALID_OPERATION' }
    $sidType = [System.Security.Principal.SecurityIdentifier]
    $user = [System.Security.Principal.WindowsIdentity]::GetCurrent().User
    $system = [System.Security.Principal.SecurityIdentifier]::new('S-1-5-18')
    $allowed = @($user.Value, $system.Value) | Select-Object -Unique
    # Elevated Windows accounts can have Administrators as the owner SID.
    $trustedOwners = @($allowed) + @('S-1-5-32-544')
    foreach ($entry in $request.entries) {
        $item = Get-Item -LiteralPath $entry.path -Force
        if (($item.Attributes -band [System.IO.FileAttributes]::ReparsePoint) -ne 0) { throw 'REPARSE_POINT' }
        if ([bool]$item.PSIsContainer -ne [bool]$entry.directory) { throw 'WRONG_PATH_TYPE' }
        $acl = Get-Acl -LiteralPath $entry.path
        if ($acl.GetOwner($sidType).Value -notin $trustedOwners) { throw 'UNSAFE_OWNER' }
        if ($request.operation -eq 'restrict') {
            # Start from an empty DACL: no pre-existing explicit Everyone/Users ACE survives.
            if ($entry.directory) {
                $acl = [System.Security.AccessControl.DirectorySecurity]::new()
                $inherit = [System.Security.AccessControl.InheritanceFlags]'ContainerInherit, ObjectInherit'
            } else {
                $acl = [System.Security.AccessControl.FileSecurity]::new()
                $inherit = [System.Security.AccessControl.InheritanceFlags]::None
            }
            $acl.SetAccessRuleProtection($true, $false)
            foreach ($sid in $allowed) {
                $rule = [System.Security.AccessControl.FileSystemAccessRule]::new(
                    [System.Security.Principal.SecurityIdentifier]::new($sid),
                    [System.Security.AccessControl.FileSystemRights]::FullControl,
                    $inherit, [System.Security.AccessControl.PropagationFlags]::None,
                    [System.Security.AccessControl.AccessControlType]::Allow)
                $acl.AddAccessRule($rule)
            }
            Set-Acl -LiteralPath $entry.path -AclObject $acl
            $acl = Get-Acl -LiteralPath $entry.path
        }
        if ($acl.GetOwner($sidType).Value -notin $trustedOwners) { throw 'UNSAFE_OWNER' }
        # Inherited ACEs on new SQLite sidecars are safe only when their SIDs/rights
        # match this same allowlist. Protected ancestors are checked by each reader.
        $rules = @($acl.GetAccessRules($true, $true, $sidType))
        if ($rules.Count -ne $allowed.Count) { throw 'UNSAFE_DACL' }
        foreach ($sid in $allowed) {
            $rulesForSid = @($rules | Where-Object { $_.IdentityReference.Value -eq $sid })
            if ($rulesForSid.Count -ne 1) { throw 'UNSAFE_DACL' }
            $rule = $rulesForSid[0]
            if ($rule.AccessControlType -ne 'Allow' -or
                $rule.FileSystemRights -ne [System.Security.AccessControl.FileSystemRights]::FullControl -or
                $rule.PropagationFlags -ne [System.Security.AccessControl.PropagationFlags]::None) { throw 'UNSAFE_DACL' }
            $expectedInheritance = [System.Security.AccessControl.InheritanceFlags]::None
            if ($entry.directory) { $expectedInheritance = [System.Security.AccessControl.InheritanceFlags]'ContainerInherit, ObjectInherit' }
            if ($rule.InheritanceFlags -ne $expectedInheritance) { throw 'UNSAFE_INHERITANCE' }
        }
        if ($entry.directory -and -not $acl.AreAccessRulesProtected) { throw 'UNPROTECTED_DIRECTORY' }
    }
    [Console]::Out.Write('OK')
} catch {
    # Never send paths, identities or arbitrary PowerShell error text to callers/logs.
    [Console]::Error.Write('WINDOWS_ACL_UNSAFE')
    exit 1
}
