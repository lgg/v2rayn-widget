param(
    [switch]$RequireNode,
    [switch]$RequireRust,
    [switch]$RequireTauriCli,
    [switch]$RequireNsis,
    [string]$WriteNsisFingerprint
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

if (-not ($RequireNode -or $RequireRust -or $RequireTauriCli -or $RequireNsis)) {
    throw "Specify at least one prerequisite to validate."
}

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$policyPath = Join-Path $PSScriptRoot "ci-toolchain-policy.json"
if (-not (Test-Path -LiteralPath $policyPath -PathType Leaf)) {
    throw "CI toolchain policy is missing."
}
$policy = Get-Content -LiteralPath $policyPath -Raw | ConvertFrom-Json

function Assert-CommandAvailable {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Name,
        [Parameter(Mandatory = $true)]
        [string]$ProvisioningHint
    )

    $command = Get-Command $Name -ErrorAction SilentlyContinue
    if (-not $command) {
        throw "$Name is not available. $ProvisioningHint Validation-only jobs will not install it."
    }
    return $command
}

function Invoke-NativeText {
    param(
        [Parameter(Mandatory = $true)]
        [scriptblock]$Command,
        [Parameter(Mandatory = $true)]
        [string]$FailureMessage
    )

    $output = & $Command 2>&1
    $exitCode = $LASTEXITCODE
    if ($exitCode -ne 0) {
        throw "$FailureMessage Exit code: $exitCode."
    }
    return (($output | Out-String).Trim())
}

function Get-NsisCacheFingerprint {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Root
    )

    $manifestLines = [System.Collections.Generic.List[string]]::new()
    Get-ChildItem -LiteralPath $Root -File -Recurse | ForEach-Object {
        $relativePath = [System.IO.Path]::GetRelativePath($Root, $_.FullName).Replace("\", "/")
        $hash = (Get-FileHash -LiteralPath $_.FullName -Algorithm SHA256).Hash.ToLowerInvariant()
        $manifestLines.Add("$relativePath|$hash")
    }

    if ($manifestLines.Count -eq 0) {
        throw "The Tauri NSIS cache is empty. Provision it manually before running validation."
    }

    $manifestLines.Sort([System.StringComparer]::Ordinal)
    $manifest = $manifestLines -join "`n"
    $bytes = [System.Text.Encoding]::UTF8.GetBytes($manifest)
    return [Convert]::ToHexString([System.Security.Cryptography.SHA256]::HashData($bytes)).ToLowerInvariant()
}

if ($RequireNode) {
    Assert-CommandAvailable -Name "node.exe" -ProvisioningHint "Provision Node.js on v2rayn-widget-ci manually." | Out-Null
    Assert-CommandAvailable -Name "npm.cmd" -ProvisioningHint "Provision npm with Node.js on v2rayn-widget-ci manually." | Out-Null

    $nodeVersionText = Invoke-NativeText -Command { node --version } -FailureMessage "Could not determine the pre-provisioned Node.js version."
    if ($nodeVersionText -notmatch '^v(?<version>\d+\.\d+\.\d+)$') {
        throw "Unexpected Node.js version format: $nodeVersionText"
    }

    $nodeVersion = [version]$Matches.version
    $minimumNodeVersion = [version][string]$policy.node.minimumVersion
    if ($nodeVersion -lt $minimumNodeVersion) {
        throw "Node.js $minimumNodeVersion or newer is required; found $nodeVersion. Update the runner manually."
    }

    $npmVersion = Invoke-NativeText -Command { npm --version } -FailureMessage "Could not determine the pre-provisioned npm version."
    Write-Output "Using pre-provisioned Node.js $nodeVersion and npm $npmVersion"
}

if ($RequireRust) {
    . (Join-Path $PSScriptRoot "rust-env.ps1") -UseGlobalHomes

    Assert-CommandAvailable -Name "cargo.exe" -ProvisioningHint "Provision the stable x64 MSVC Rust toolchain manually." | Out-Null
    Assert-CommandAvailable -Name "rustc.exe" -ProvisioningHint "Provision the stable x64 MSVC Rust toolchain manually." | Out-Null
    Assert-CommandAvailable -Name "rustfmt.exe" -ProvisioningHint "Add rustfmt to the runner manually." | Out-Null
    Assert-CommandAvailable -Name "cl.exe" -ProvisioningHint "Provision Visual Studio 2022 C++ Build Tools manually." | Out-Null
    Assert-CommandAvailable -Name "link.exe" -ProvisioningHint "Provision the MSVC linker manually." | Out-Null
    Assert-CommandAvailable -Name "rc.exe" -ProvisioningHint "Provision the Windows SDK resource compiler manually." | Out-Null

    $cargoVersion = Invoke-NativeText -Command { cargo --version } -FailureMessage "Could not execute the pre-provisioned Cargo binary."
    $rustVersionDetails = Invoke-NativeText -Command { rustc -vV } -FailureMessage "Could not execute the pre-provisioned Rust compiler."
    $rustfmtVersion = Invoke-NativeText -Command { rustfmt --version } -FailureMessage "Could not execute pre-provisioned rustfmt."
    $clippyVersion = Invoke-NativeText -Command { cargo clippy --version } -FailureMessage "Could not execute pre-provisioned Clippy."

    $expectedHost = [string]$policy.rust.host
    $hostLine = $rustVersionDetails -split "`r?`n" | Where-Object { $_ -match '^host:\s+' } | Select-Object -First 1
    if (-not $hostLine -or $hostLine.Trim() -ne "host: $expectedHost") {
        throw "Rust host must be $expectedHost. Provision the correct toolchain manually."
    }

    Write-Output "Using $cargoVersion"
    Write-Output "Using $rustfmtVersion"
    Write-Output "Using $clippyVersion"
}

if ($RequireTauriCli) {
    $tauriCli = Join-Path $repoRoot "src\frontend\node_modules\.bin\tauri.cmd"
    if (-not (Test-Path -LiteralPath $tauriCli -PathType Leaf)) {
        throw "The locked Tauri CLI is missing from the workspace. Restore dependencies with npm ci --ignore-scripts; validation will not install it globally."
    }

    $tauriVersionText = Invoke-NativeText -Command { & $tauriCli --version } -FailureMessage "Could not execute the locked Tauri CLI."
    $expectedTauriVersion = [string]$policy.tauriCli.version
    if ($tauriVersionText -notmatch "(?i)(?:tauri-cli|tauri)\s+$([regex]::Escape($expectedTauriVersion))(?:\s|$)") {
        throw "Tauri CLI $expectedTauriVersion is required; found '$tauriVersionText'."
    }

    Write-Output "Using locked Tauri CLI $expectedTauriVersion"
}

if ($RequireNsis) {
    if (-not $env:LOCALAPPDATA) {
        throw "LOCALAPPDATA is unavailable; the exact Tauri NSIS cache cannot be validated."
    }

    $nsisRoot = Join-Path $env:LOCALAPPDATA "tauri\NSIS"
    if (-not (Test-Path -LiteralPath $nsisRoot -PathType Container)) {
        throw "The exact Tauri NSIS cache is missing at %LOCALAPPDATA%\tauri\NSIS. Provision it manually; validation will not download it."
    }

    foreach ($relativePath in $policy.nsis.requiredFiles) {
        $requiredPath = Join-Path $nsisRoot ([string]$relativePath)
        if (-not (Test-Path -LiteralPath $requiredPath -PathType Leaf)) {
            throw "The Tauri NSIS cache is incomplete: missing $relativePath. Provision the complete cache manually; validation will not repair or download it."
        }
    }

    $pluginPath = Join-Path $nsisRoot "Plugins\x86-unicode\additional\nsis_tauri_utils.dll"
    $actualPluginHash = (Get-FileHash -LiteralPath $pluginPath -Algorithm SHA1).Hash.ToUpperInvariant()
    $expectedPluginHash = ([string]$policy.nsis.tauriUtilsPluginSha1).ToUpperInvariant()
    if ($actualPluginHash -ne $expectedPluginHash) {
        throw "The Tauri NSIS utility plugin hash is invalid. Replace the cache manually; validation will not download a replacement."
    }

    $makensisPath = Join-Path $nsisRoot "makensis.exe"
    $nsisVersionText = Invoke-NativeText -Command { & $makensisPath /VERSION } -FailureMessage "Could not execute the cached Tauri makensis binary."
    $expectedNsisVersion = [string]$policy.nsis.version
    if ($nsisVersionText -notmatch "(?i)^v?$([regex]::Escape($expectedNsisVersion))(?:\D|$)") {
        throw "NSIS $expectedNsisVersion is required; found '$nsisVersionText'."
    }

    $fingerprint = Get-NsisCacheFingerprint -Root $nsisRoot
    $expectedFingerprint = ([string]$policy.nsis.cacheFingerprintSha256).ToLowerInvariant()
    if ($expectedFingerprint -notmatch '^[0-9a-f]{64}$') {
        throw "The pinned NSIS cache fingerprint in ci-toolchain-policy.json is invalid."
    }
    if ($fingerprint -ne $expectedFingerprint) {
        throw "The Tauri NSIS cache fingerprint is not approved. Expected $expectedFingerprint, found $fingerprint. Replace the complete cache manually; validation will not repair or download it."
    }

    if ($WriteNsisFingerprint) {
        $fingerprintPath = [System.IO.Path]::GetFullPath($WriteNsisFingerprint)
        $fingerprintDirectory = Split-Path -Parent $fingerprintPath
        if ($fingerprintDirectory) {
            New-Item -ItemType Directory -Force -Path $fingerprintDirectory | Out-Null
        }
        Set-Content -LiteralPath $fingerprintPath -Value $fingerprint -Encoding ascii -NoNewline
    }

    Write-Output "Using validated Tauri NSIS $expectedNsisVersion cache (fingerprint $fingerprint)"
}
