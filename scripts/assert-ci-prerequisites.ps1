param(
    [switch]$RequireNode,
    [switch]$RequireRust,
    [switch]$RequireNsis
)

$ErrorActionPreference = "Stop"

function Assert-CommandAvailable {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Name,
        [string]$ProvisioningHint
    )

    $command = Get-Command $Name -ErrorAction SilentlyContinue
    if (-not $command) {
        throw "$Name is not available. $ProvisioningHint CI is validation-only and will not install it."
    }
    return $command
}

if ($RequireNode) {
    Assert-CommandAvailable -Name "node.exe" -ProvisioningHint "Provision Node.js 22 or newer on v2rayn-widget-ci manually." | Out-Null
    Assert-CommandAvailable -Name "npm.cmd" -ProvisioningHint "Provision npm with Node.js on v2rayn-widget-ci manually." | Out-Null

    $nodeVersionText = (& node --version).Trim()
    if ($LASTEXITCODE -ne 0 -or $nodeVersionText -notmatch '^v(\d+)\.') {
        throw "Could not determine the pre-provisioned Node.js version."
    }
    if ([int]$Matches[1] -lt 22) {
        throw "Node.js 22 or newer is required; found $nodeVersionText. Update the runner manually."
    }

    Write-Output "Using pre-provisioned Node.js $nodeVersionText"
    & npm --version
    if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
}

if ($RequireRust) {
    . (Join-Path $PSScriptRoot "rust-env.ps1") -UseGlobalHomes

    Assert-CommandAvailable -Name "cargo.exe" -ProvisioningHint "Provision the stable x64 MSVC Rust toolchain manually." | Out-Null
    Assert-CommandAvailable -Name "rustc.exe" -ProvisioningHint "Provision the stable x64 MSVC Rust toolchain manually." | Out-Null
    Assert-CommandAvailable -Name "rustfmt.exe" -ProvisioningHint "Add rustfmt to the runner manually." | Out-Null
    Assert-CommandAvailable -Name "cl.exe" -ProvisioningHint "Provision Visual Studio 2022 C++ Build Tools manually." | Out-Null

    & cargo --version
    if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
    & rustc --version
    if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
    & rustfmt --version
    if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
    & cargo clippy --version
    if ($LASTEXITCODE -ne 0) {
        throw "Clippy is not pre-provisioned. Add it to the runner manually; CI will not install components."
    }
}

if ($RequireNsis) {
    $makensis = Get-Command "makensis.exe" -ErrorAction SilentlyContinue
    if (-not $makensis) {
        $tauriToolsRoot = Join-Path $env:LOCALAPPDATA "tauri"
        if (Test-Path $tauriToolsRoot) {
            $candidate = Get-ChildItem $tauriToolsRoot -Filter "makensis.exe" -File -Recurse -ErrorAction SilentlyContinue |
                Select-Object -First 1
            if ($candidate) {
                $env:PATH = "$($candidate.DirectoryName);$env:PATH"
                $makensis = Get-Command "makensis.exe" -ErrorAction SilentlyContinue
            }
        }
    }

    if (-not $makensis) {
        throw "makensis.exe is not pre-provisioned. Install NSIS manually before starting the runner; CI will not download or install bundler tools."
    }

    Write-Output "Using pre-provisioned NSIS compiler at $($makensis.Source)"
}
