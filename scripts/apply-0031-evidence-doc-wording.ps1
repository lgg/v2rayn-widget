$ErrorActionPreference = 'Stop'

$path = 'docs/architecture.md'
$text = [System.IO.File]::ReadAllText($path).Replace("`r`n", "`n")
$old = @'
- visible Disconnect action → currently Connected;
- visible Connect action → currently Disconnected;
'@.TrimStart("`r", "`n").Replace("`r`n", "`n")
$new = @'
- reliable Disconnect action → currently Connected;
- reliable Connect action → currently Disconnected;
'@.TrimStart("`r", "`n").Replace("`r`n", "`n")
$matches = ([regex]::Matches($text, [regex]::Escape($old))).Count
if ($matches -ne 1) {
    throw "Expected exactly one architecture wording match, found $matches"
}
[System.IO.File]::WriteAllText(
    $path,
    $text.Replace($old, $new),
    [System.Text.UTF8Encoding]::new($false)
)
Write-Host '0031 final architecture terminology corrected.'
