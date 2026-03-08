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

. (Join-Path $PSScriptRoot "rust-env.ps1")

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
Set-Location (Join-Path $repoRoot "src\tauri")

$toolchainCargo = Join-Path $env:RUSTUP_HOME "toolchains\stable-x86_64-pc-windows-msvc\bin\cargo.exe"
Invoke-CheckedCommand { & $toolchainCargo test }
