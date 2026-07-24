param(
    [switch]$Bootstrap,
    [switch]$UseGlobalHomes
)

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

if (-not $env:USERPROFILE) {
    throw "USERPROFILE is unavailable; Rust homes cannot be resolved safely."
}

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$globalCargoHome = Join-Path $env:USERPROFILE ".cargo"
$globalRustupHome = Join-Path $env:USERPROFILE ".rustup"
$isGitHubActions = $env:GITHUB_ACTIONS -eq "true"

if ($Bootstrap -and $isGitHubActions) {
    throw "Automatic Rust installation is forbidden in GitHub Actions. Pre-provision the v2rayn-widget-ci runner instead."
}

if ($UseGlobalHomes) {
    $env:CARGO_HOME = $globalCargoHome
    $env:RUSTUP_HOME = $globalRustupHome

    if (-not (Test-Path -LiteralPath $env:CARGO_HOME -PathType Container)) {
        throw "The pre-provisioned Cargo home is missing. CI will not create or populate it."
    }
    if (-not (Test-Path -LiteralPath $env:RUSTUP_HOME -PathType Container)) {
        throw "The pre-provisioned Rustup home is missing. CI will not create or populate it."
    }
}
else {
    $env:CARGO_HOME = Join-Path $repoRoot ".cargo-home"
    $env:RUSTUP_HOME = Join-Path $repoRoot ".rustup-home"
    New-Item -ItemType Directory -Force -Path $env:CARGO_HOME, $env:RUSTUP_HOME | Out-Null
}

$toolchainBin = Join-Path $env:RUSTUP_HOME "toolchains\stable-x86_64-pc-windows-msvc\bin"
$toolchainCargo = Join-Path $toolchainBin "cargo.exe"
$toolchainRustc = Join-Path $toolchainBin "rustc.exe"
$globalRustup = Join-Path $globalCargoHome "bin\rustup.exe"

if (-not (Test-Path -LiteralPath $globalRustup -PathType Leaf)) {
    throw "rustup.exe is not pre-provisioned. Provision Rust manually before starting the runner."
}

if (-not (Test-Path -LiteralPath $toolchainCargo -PathType Leaf) -or -not (Test-Path -LiteralPath $toolchainRustc -PathType Leaf)) {
    if ($Bootstrap) {
        Invoke-CheckedCommand -FailureMessage "Rust toolchain bootstrap failed." -Command {
            & $globalRustup toolchain install stable --profile minimal
        }
    }
    else {
        throw "The stable x64 MSVC Rust toolchain is missing. Provision it manually; CI will not install or update toolchains."
    }
}

if (-not (Test-Path -LiteralPath $toolchainCargo -PathType Leaf) -or -not (Test-Path -LiteralPath $toolchainRustc -PathType Leaf)) {
    throw "The stable x64 MSVC Rust toolchain remains incomplete after bootstrap."
}

$localCargoBin = Join-Path $env:CARGO_HOME "bin"
if (-not $UseGlobalHomes) {
    New-Item -ItemType Directory -Force -Path $localCargoBin | Out-Null
    Copy-Item -LiteralPath $globalRustup -Destination (Join-Path $localCargoBin "rustup.exe") -Force

    $globalRustupInit = Join-Path $globalCargoHome "bin\rustup-init.exe"
    if (Test-Path -LiteralPath $globalRustupInit -PathType Leaf) {
        Copy-Item -LiteralPath $globalRustupInit -Destination (Join-Path $localCargoBin "rustup-init.exe") -Force
    }
}

$programFilesX86 = ${env:ProgramFiles(x86)}
$vswhere = if ($programFilesX86) {
    Join-Path $programFilesX86 "Microsoft Visual Studio\Installer\vswhere.exe"
}
else {
    $null
}

$vsDevCmd = $null
if ($vswhere -and (Test-Path -LiteralPath $vswhere -PathType Leaf)) {
    $vsInstallPathOutput = & $vswhere -latest -products * -requires Microsoft.VisualStudio.Component.VC.Tools.x86.x64 -property installationPath
    $vswhereExitCode = $LASTEXITCODE
    if ($vswhereExitCode -ne 0) {
        throw "vswhere failed while resolving Visual Studio C++ Build Tools. Exit code: $vswhereExitCode."
    }

    $vsInstallPath = @($vsInstallPathOutput | Where-Object { $_ }) | Select-Object -First 1
    if ($vsInstallPath) {
        $candidate = Join-Path $vsInstallPath "Common7\Tools\VsDevCmd.bat"
        if (Test-Path -LiteralPath $candidate -PathType Leaf) {
            $vsDevCmd = $candidate
        }
    }
}

if (-not $vsDevCmd) {
    $fallbacks = @(
        "C:\Program Files (x86)\Microsoft Visual Studio\2022\BuildTools\Common7\Tools\VsDevCmd.bat",
        "C:\Program Files\Microsoft Visual Studio\2022\Community\Common7\Tools\VsDevCmd.bat",
        "C:\Program Files\Microsoft Visual Studio\2022\Professional\Common7\Tools\VsDevCmd.bat",
        "C:\Program Files\Microsoft Visual Studio\2022\Enterprise\Common7\Tools\VsDevCmd.bat"
    )
    $vsDevCmd = $fallbacks | Where-Object { Test-Path -LiteralPath $_ -PathType Leaf } | Select-Object -First 1
}

if (-not $vsDevCmd) {
    throw "VsDevCmd.bat was not found. Provision Visual Studio 2022 C++ Build Tools manually before starting the runner."
}

$comSpec = if ($env:ComSpec) { $env:ComSpec } else { "cmd.exe" }
$envDump = & $comSpec /d /s /c "`"$vsDevCmd`" -no_logo -arch=x64 && set"
$vsDevCmdExitCode = $LASTEXITCODE
if ($vsDevCmdExitCode -ne 0 -or -not $envDump) {
    throw "Visual Studio x64 environment initialization failed. Exit code: $vsDevCmdExitCode."
}

$importedEnvironmentVariables = 0
foreach ($line in $envDump) {
    if ($line -match "^(.*?)=(.*)$") {
        Set-Item -Path "Env:$($matches[1])" -Value $matches[2]
        $importedEnvironmentVariables += 1
    }
}
if ($importedEnvironmentVariables -eq 0) {
    throw "Visual Studio environment initialization returned no variables."
}

# Put concrete toolchain binaries before rustup proxies so validation cannot trigger implicit toolchain resolution.
$env:PATH = "$toolchainBin;$localCargoBin;$env:PATH"
$env:RUSTC = $toolchainRustc

Write-Output "Rust environment is ready without automatic installation."
Write-Output "RUST_HOME_MODE=$(if ($UseGlobalHomes) { 'global' } else { 'isolated' })"
