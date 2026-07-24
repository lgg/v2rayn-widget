param(
    [switch]$Bootstrap,
    [switch]$UseGlobalHomes
)

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
$globalCargoHome = Join-Path $env:USERPROFILE ".cargo"
$globalRustupHome = Join-Path $env:USERPROFILE ".rustup"
$isGitHubActions = $env:GITHUB_ACTIONS -eq "true"

if ($Bootstrap -and $isGitHubActions) {
    throw "Automatic Rust installation is forbidden in GitHub Actions. Pre-provision the v2rayn-widget-ci runner instead."
}

if ($UseGlobalHomes) {
    $env:CARGO_HOME = $globalCargoHome
    $env:RUSTUP_HOME = $globalRustupHome
}
else {
    $env:CARGO_HOME = Join-Path $repoRoot ".cargo-home"
    $env:RUSTUP_HOME = Join-Path $repoRoot ".rustup-home"
}

New-Item -ItemType Directory -Force -Path $env:CARGO_HOME, $env:RUSTUP_HOME | Out-Null

$toolchainBin = Join-Path $env:RUSTUP_HOME "toolchains\stable-x86_64-pc-windows-msvc\bin"
$toolchainCargo = Join-Path $toolchainBin "cargo.exe"
$globalRustup = Join-Path $globalCargoHome "bin\rustup.exe"

if (-not (Test-Path $globalRustup)) {
    throw "rustup.exe not found at $globalRustup. Provision Rust manually before starting the runner."
}

if (-not (Test-Path $toolchainCargo)) {
    if ($Bootstrap) {
        Invoke-CheckedCommand { & $globalRustup toolchain install stable --profile minimal }
    }
    else {
        throw "Stable MSVC Rust toolchain is missing at $toolchainBin. Provision it manually; CI will not install or update toolchains."
    }
}

$localCargoBin = Join-Path $env:CARGO_HOME "bin"
New-Item -ItemType Directory -Force -Path $localCargoBin | Out-Null
if (-not $UseGlobalHomes) {
    Copy-Item -Path $globalRustup -Destination (Join-Path $localCargoBin "rustup.exe") -Force

    $globalRustupInit = Join-Path $globalCargoHome "bin\rustup-init.exe"
    if (Test-Path $globalRustupInit) {
        Copy-Item -Path $globalRustupInit -Destination (Join-Path $localCargoBin "rustup-init.exe") -Force
    }
}

$vswhere = Join-Path ${env:ProgramFiles(x86)} "Microsoft Visual Studio\Installer\vswhere.exe"
$vsDevCmd = $null
if (Test-Path $vswhere) {
    $vsInstallPath = & $vswhere -latest -products * -requires Microsoft.VisualStudio.Component.VC.Tools.x86.x64 -property installationPath
    if ($vsInstallPath) {
        $candidate = Join-Path $vsInstallPath "Common7\Tools\VsDevCmd.bat"
        if (Test-Path $candidate) {
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
    $vsDevCmd = $fallbacks | Where-Object { Test-Path $_ } | Select-Object -First 1
}

if (-not $vsDevCmd) {
    throw "VsDevCmd.bat not found. Provision Visual Studio 2022 C++ build tools manually before starting the runner."
}

$envDump = cmd /c "`"$vsDevCmd`" -arch=x64 && set"
foreach ($line in $envDump) {
    if ($line -match "^(.*?)=(.*)$") {
        Set-Item -Path "Env:$($matches[1])" -Value $matches[2]
    }
}

$env:PATH = "$localCargoBin;$toolchainBin;$env:PATH"
$env:RUSTC = Join-Path $toolchainBin "rustc.exe"

Write-Output "Rust environment is ready without automatic installation."
Write-Output "CARGO_HOME=$env:CARGO_HOME"
Write-Output "RUSTUP_HOME=$env:RUSTUP_HOME"
Write-Output "RUST_HOME_MODE=$(if ($UseGlobalHomes) { 'global' } else { 'isolated' })"
