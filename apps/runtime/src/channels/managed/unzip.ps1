$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.IO.Compression.FileSystem
$root = [System.IO.Path]::GetFullPath($env:BFF_DEST) + [System.IO.Path]::DirectorySeparatorChar
$zip = [System.IO.Compression.ZipFile]::OpenRead($env:BFF_ZIP)
try {
  $total = 0L
  if ($zip.Entries.Count -gt 20000) { throw 'entries' }
  foreach ($entry in $zip.Entries) {
    $name = $entry.FullName.Replace('\', '/')
    if ($name.StartsWith('/') -or $name.Contains(':') -or ($name.Split('/') -contains '..') -or (($entry.ExternalAttributes -shr 16) -band 0xF000) -eq 0xA000) { throw 'path' }
    $target = [System.IO.Path]::GetFullPath([System.IO.Path]::Combine($root, $name))
    if (!$target.StartsWith($root, [System.StringComparison]::OrdinalIgnoreCase)) { throw 'path' }
    $total += $entry.Length
    if ($total -gt 1500000000 -or $entry.Length -gt 500000000) { throw 'size' }
  }
  foreach ($entry in $zip.Entries) {
    $target = [System.IO.Path]::GetFullPath([System.IO.Path]::Combine($root, $entry.FullName))
    if (!$entry.Name) { [System.IO.Directory]::CreateDirectory($target) | Out-Null; continue }
    [System.IO.Directory]::CreateDirectory([System.IO.Path]::GetDirectoryName($target)) | Out-Null
    [System.IO.Compression.ZipFileExtensions]::ExtractToFile($entry, $target, $false)
  }
} finally { $zip.Dispose() }
