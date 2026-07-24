$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

function Invoke-CheckedCommand {
    param(
        [Parameter(Mandatory = $true)]
        [scriptblock]$Command,
        [Parameter(Mandatory = $true)]
        [string]$FailureMessage
    )

    & $Command
    $exitCode = $LASTEXITCODE
    if ($exitCode -ne 0) {
        throw "$FailureMessage Exit code: $exitCode."
    }
}

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$beforeFingerprint = Join-Path $env:TEMP "v2rayn-widget-nsis-before.sha256"
$afterFingerprint = Join-Path $env:TEMP "v2rayn-widget-nsis-after.sha256"

try {
    & (Join-Path $PSScriptRoot "assert-ci-prerequisites.ps1") -RequireNode -RequireNsis -WriteNsisFingerprint $beforeFingerprint

    Set-Location (Join-Path $repoRoot "src\frontend")
    Invoke-CheckedCommand -FailureMessage "Frontend dependency restore failed." -Command {
        npm ci --ignore-scripts --no-audit --no-fund
    }
    Invoke-CheckedCommand -FailureMessage "Frontend dependency audit failed." -Command {
        npm audit --audit-level=high
    }
    Invoke-CheckedCommand -FailureMessage "Frontend tests failed." -Command {
        npm test
    }

    & (Join-Path $PSScriptRoot "assert-ci-prerequisites.ps1") -RequireTauriCli
    . (Join-Path $PSScriptRoot "rust-env.ps1")

    $tauriCli = Join-Path (Join-Path $repoRoot "src\frontend") "node_modules\.bin\tauri.cmd"
    $toolchainCargo = Join-Path $env:RUSTUP_HOME "toolchains\stable-x86_64-pc-windows-msvc\bin\cargo.exe"

    Set-Location (Join-Path $repoRoot "src\tauri")
    Invoke-CheckedCommand -FailureMessage "Tauri NSIS build failed." -Command {
        & $tauriCli build --runner $toolchainCargo --bundles nsis --config "tauri.installer.conf.json" --ci -- --locked
    }

    & (Join-Path $PSScriptRoot "assert-ci-prerequisites.ps1") -RequireNsis -WriteNsisFingerprint $afterFingerprint
    if ((Get-Content -LiteralPath $beforeFingerprint -Raw) -ne (Get-Content -LiteralPath $afterFingerprint -Raw)) {
        throw "The Tauri NSIS cache changed during packaging. Provision bundler tools manually; the build script will not repair or download them."
    }

    $bundleDir = Join-Path (Get-Location).Path "target\release\bundle\nsis"
    $installers = @(Get-ChildItem -LiteralPath $bundleDir -Filter "*.exe" -File -ErrorAction SilentlyContinue)
    if ($installers.Count -ne 1) {
        throw "Expected exactly one NSIS installer in $bundleDir, found $($installers.Count)."
    }

    Write-Output "INSTALLER_EXE=$($installers[0].FullName)"
}
finally {
    Remove-Item -LiteralPath $beforeFingerprint -Force -ErrorAction SilentlyContinue
    Remove-Item -LiteralPath $afterFingerprint -Force -ErrorAction SilentlyContinue
}
