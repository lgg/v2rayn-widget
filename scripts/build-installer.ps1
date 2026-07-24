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

if (-not $env:TEMP -or -not $env:LOCALAPPDATA) {
    throw "TEMP and LOCALAPPDATA must be available for isolated installer tooling."
}

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$sourceFingerprint = Join-Path $env:TEMP "v2rayn-widget-nsis-source-$PID.sha256"
$beforeFingerprint = Join-Path $env:TEMP "v2rayn-widget-nsis-before-$PID.sha256"
$afterFingerprint = Join-Path $env:TEMP "v2rayn-widget-nsis-after-$PID.sha256"
$originalLocalAppData = $env:LOCALAPPDATA
$sourceNsis = Join-Path $originalLocalAppData "tauri\NSIS"
$isolatedLocalAppData = Join-Path $env:TEMP "v2rayn-widget-tauri-localappdata-$PID"
$isolatedTauriRoot = Join-Path $isolatedLocalAppData "tauri"

try {
    & (Join-Path $PSScriptRoot "assert-ci-prerequisites.ps1") -RequireNode -RequireNsis -WriteNsisFingerprint $sourceFingerprint

    Remove-Item -LiteralPath $isolatedLocalAppData -Recurse -Force -ErrorAction SilentlyContinue
    New-Item -ItemType Directory -Force -Path $isolatedTauriRoot | Out-Null
    Copy-Item -LiteralPath $sourceNsis -Destination $isolatedTauriRoot -Recurse -Force
    $env:LOCALAPPDATA = $isolatedLocalAppData

    & (Join-Path $PSScriptRoot "assert-ci-prerequisites.ps1") -RequireNsis -WriteNsisFingerprint $beforeFingerprint
    if ((Get-Content -LiteralPath $sourceFingerprint -Raw) -ne (Get-Content -LiteralPath $beforeFingerprint -Raw)) {
        throw "The isolated NSIS cache copy does not match the validated source cache."
    }

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
        throw "The isolated Tauri NSIS cache changed during packaging. Provision bundler tools manually; the build script will not download or repair them."
    }

    $installerScripts = @(Get-ChildItem "target\release\nsis" -Filter "installer.nsi" -File -Recurse -ErrorAction SilentlyContinue)
    if ($installerScripts.Count -ne 1) {
        throw "Expected exactly one generated installer.nsi, found $($installerScripts.Count)."
    }
    $installerScriptText = Get-Content -LiteralPath $installerScripts[0].FullName -Raw
    if ($installerScriptText -notmatch '(?mi)^\s*RequestExecutionLevel\s+user\s*$') {
        throw "Generated NSIS script is not explicitly current-user only."
    }
    if ($installerScriptText -match '(?i)MicrosoftEdgeWebview2Setup\.exe|WebView2Bootstrapper\.exe') {
        throw "Generated NSIS script contains a WebView2 installer payload."
    }

    $bundleDir = Join-Path (Get-Location).Path "target\release\bundle\nsis"
    $installers = @(Get-ChildItem -LiteralPath $bundleDir -Filter "*.exe" -File -ErrorAction SilentlyContinue)
    if ($installers.Count -ne 1) {
        throw "Expected exactly one NSIS installer in $bundleDir, found $($installers.Count)."
    }

    Write-Output "INSTALLER_EXE=$($installers[0].FullName)"
}
finally {
    $env:LOCALAPPDATA = $originalLocalAppData
    Remove-Item -LiteralPath $isolatedLocalAppData -Recurse -Force -ErrorAction SilentlyContinue
    Remove-Item -LiteralPath $sourceFingerprint -Force -ErrorAction SilentlyContinue
    Remove-Item -LiteralPath $beforeFingerprint -Force -ErrorAction SilentlyContinue
    Remove-Item -LiteralPath $afterFingerprint -Force -ErrorAction SilentlyContinue
}
