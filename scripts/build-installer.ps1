$ErrorActionPreference = "Stop"

function Invoke-CheckedCommand {
    param(
        [Parameter(Mandatory = $true)]
        [scriptblock]$Command
    )

    & $Command
    if ($LASTEXITCODE -ne 0) {
        throw "Command failed with exit code $LASTEXITCODE"
    }
}

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path

Set-Location (Join-Path $repoRoot "src\frontend")
Invoke-CheckedCommand { npm ci }
Invoke-CheckedCommand { npm audit --audit-level=high }
Invoke-CheckedCommand { npm test }

. (Join-Path $PSScriptRoot "rust-env.ps1")

$tauriCli = Join-Path (Join-Path $repoRoot "src\frontend") "node_modules\.bin\tauri.cmd"
if (-not (Test-Path $tauriCli)) {
    throw "Tauri CLI not found. Run npm ci in src\frontend."
}

$toolchainCargo = Join-Path $env:RUSTUP_HOME "toolchains\stable-x86_64-pc-windows-msvc\bin\cargo.exe"

Set-Location (Join-Path $repoRoot "src\tauri")
Invoke-CheckedCommand { & $tauriCli build --runner $toolchainCargo --bundles nsis --config "tauri.installer.conf.json" --ci -- --locked }

$bundleDir = Join-Path (Get-Location).Path "target\release\bundle\nsis"
if (-not (Test-Path $bundleDir)) {
    throw "Installer output folder not found: $bundleDir"
}

$installer = Get-ChildItem -Path $bundleDir -Filter "*.exe" | Sort-Object LastWriteTime -Descending | Select-Object -First 1
if (-not $installer) {
    throw "NSIS installer not found in $bundleDir"
}

Write-Output "INSTALLER_EXE=$($installer.FullName)"
