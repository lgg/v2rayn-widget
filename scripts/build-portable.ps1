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
Invoke-CheckedCommand { npm install }
Invoke-CheckedCommand { npm run test }
Invoke-CheckedCommand { npm run build }

. (Join-Path $PSScriptRoot "rust-env.ps1")

Set-Location (Join-Path $repoRoot "src\tauri")
$toolchainCargo = Join-Path $env:RUSTUP_HOME "toolchains\stable-x86_64-pc-windows-msvc\bin\cargo.exe"

Invoke-CheckedCommand { & $toolchainCargo test }
Invoke-CheckedCommand { & $toolchainCargo build --release }

$releaseExe = Join-Path (Join-Path (Get-Location).Path "target\release") "v2rayn-widget.exe"
if (-not (Test-Path $releaseExe)) {
    throw "Release executable not found: $releaseExe"
}

$portableDir = Join-Path $repoRoot "dist\portable"
New-Item -ItemType Directory -Force -Path $portableDir | Out-Null
$portableExe = Join-Path $portableDir "v2rayn-widget.exe"

try {
    Copy-Item -Path $releaseExe -Destination $portableExe -Force -ErrorAction Stop
    Write-Output "PORTABLE_EXE=$portableExe"
}
catch {
    $stamp = Get-Date -Format "yyyyMMdd-HHmmss"
    $fallbackExe = Join-Path $portableDir "v2rayn-widget-$stamp.exe"
    Copy-Item -Path $releaseExe -Destination $fallbackExe -Force
    Write-Warning "Default portable exe is locked; wrote fallback file instead."
    Write-Output "PORTABLE_EXE=$fallbackExe"
}
