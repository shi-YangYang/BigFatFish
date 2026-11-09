$ErrorActionPreference = 'Stop'
$stage = 'INPUT_READ'
try {
    # Hidden PowerShell has a pipe, not a console. InputEncoding calls SetConsoleCP
    # on .NET Framework and fails without a console; decode the pipe directly.
    $reader = [System.IO.StreamReader]::new([Console]::OpenStandardInput(), [System.Text.UTF8Encoding]::new($false, $true), $false)
    try { $request = $reader.ReadToEnd() | ConvertFrom-Json } finally { $reader.Dispose() }
    if ($request.operation -notin @('restrict', 'verify')) { throw 'INVALID_OPERATION' }
    $stage = 'IDENTITY'
    $sidType = [System.Security.Principal.SecurityIdentifier]
    $user = [System.Security.Principal.WindowsIdentity]::GetCurrent().User
    $system = [System.Security.Principal.SecurityIdentifier]::new('S-1-5-18')
    $allowed = @($user.Value, $system.Value) | Select-Object -Unique
    # Elevated Windows accounts can have Administrators as the owner SID.
    $trustedOwners = @($allowed) + @('S-1-5-32-544')
    foreach ($entry in $request.entries) {
        $stage = 'PATH_CHECK'
        $item = Get-Item -LiteralPath $entry.path -Force
        if (($item.Attributes -band [System.IO.FileAttributes]::ReparsePoint) -ne 0) { throw 'REPARSE_POINT' }
        if ([bool]$item.PSIsContainer -ne [bool]$entry.directory) { throw 'WRONG_PATH_TYPE' }
        $stage = 'ACL_READ'
        $acl = Get-Acl -LiteralPath $entry.path
        if ($acl.GetOwner($sidType).Value -notin $trustedOwners) { throw 'UNSAFE_OWNER' }
        if ($request.operation -eq 'restrict') {
            $stage = 'ACL_WRITE'
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
            # Persist only the modified DACL. Set-Acl copies all descriptor
            # sections and can require audit privileges on protected paths.
            if ($entry.directory) { [System.IO.Directory]::SetAccessControl($entry.path, $acl) }
            else { [System.IO.File]::SetAccessControl($entry.path, $acl) }
            $stage = 'ACL_READ'
            $acl = Get-Acl -LiteralPath $entry.path
        }
        $stage = 'ACL_VERIFY'
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
    $reason = $stage
    if ($_.Exception.Message -cin @('INVALID_OPERATION', 'REPARSE_POINT', 'WRONG_PATH_TYPE', 'UNSAFE_OWNER', 'UNSAFE_DACL', 'UNSAFE_INHERITANCE', 'UNPROTECTED_DIRECTORY')) {
        $reason = $_.Exception.Message
    }
    [Console]::Out.Write('WINDOWS_ACL_UNSAFE:' + $reason)
    [Console]::Error.Write('WINDOWS_ACL_UNSAFE')
    exit 1
}
