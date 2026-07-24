import { existsSync, readFileSync } from "node:fs";
import { dirname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const PATHS = {
  quality: resolve(ROOT, ".github/workflows/windows-quality.yml"),
  release: resolve(ROOT, ".github/workflows/release-assets.yml"),
  rustEnv: resolve(ROOT, "scripts/rust-env.ps1"),
  prerequisites: resolve(ROOT, "scripts/assert-ci-prerequisites.ps1"),
  installerBuild: resolve(ROOT, "scripts/build-installer.ps1"),
  policy: resolve(ROOT, "scripts/ci-toolchain-policy.json"),
  packageLock: resolve(ROOT, "src/frontend/package-lock.json"),
  installerConfig: resolve(ROOT, "src/tauri/tauri.installer.conf.json"),
};

const SELF_HOSTED_RUNNER = "runs-on: [self-hosted, v2rayn-widget-ci]";
const PREREQUISITES = "scripts/assert-ci-prerequisites.ps1";

function fail(message) {
  throw new Error(message);
}

function read(path) {
  if (!existsSync(path)) fail(`Missing file: ${relative(ROOT, path)}`);
  return readFileSync(path, "utf8");
}

function readJson(path) {
  try {
    return JSON.parse(read(path));
  } catch (error) {
    fail(`Invalid JSON in ${relative(ROOT, path)}: ${error.message}`);
  }
}

function lines(path) {
  return read(path).split(/\r?\n/);
}

function block(sourceLines, key, indent = 0) {
  const header = `${" ".repeat(indent)}${key}:`;
  const start = sourceLines.indexOf(header);
  if (start < 0) fail(`Missing YAML block: ${header}`);

  const result = [];
  for (const line of sourceLines.slice(start + 1)) {
    if (line.trim() && line.length - line.trimStart().length <= indent) break;
    result.push(line);
  }
  return result;
}

function mappingKeys(sourceLines, indent) {
  const prefix = " ".repeat(indent);
  return new Set(
    sourceLines
      .filter((line) => line.startsWith(prefix) && !line.startsWith(`${prefix} `) && line.trim().endsWith(":"))
      .map((line) => line.trim().slice(0, -1)),
  );
}

function listItems(sourceLines, indent) {
  const prefix = `${" ".repeat(indent)}- `;
  return sourceLines.filter((line) => line.startsWith(prefix)).map((line) => line.slice(prefix.length).trim());
}

function requireText(text, needle, label) {
  if (!text.includes(needle)) fail(`${label}: missing ${JSON.stringify(needle)}`);
}

function rejectText(text, needle, label) {
  if (text.toLowerCase().includes(needle.toLowerCase())) {
    fail(`${label}: forbidden ${JSON.stringify(needle)}`);
  }
}

function countText(text, needle) {
  return text.split(needle).length - 1;
}

function sameSet(actual, expected) {
  return actual.size === expected.size && [...actual].every((value) => expected.has(value));
}

function rejectProvisioning(text, label) {
  for (const needle of [
    "actions/setup-",
    "dtolnay/rust-toolchain",
    "rustup toolchain install",
    "rustup component add",
    "rustup update",
    "-Bootstrap",
    "winget install",
    "choco install",
    "scoop install",
    "msiexec",
    "-Verb RunAs",
    "runas.exe",
    "Start-BitsTransfer",
    "Invoke-WebRequest",
    "DownloadFile(",
    "npm config set registry",
    "npm config set cache",
  ]) {
    rejectText(text, needle, `${label} provisioning policy`);
  }
}

function verifyPinnedOfficialActions(text, label) {
  const actionLines = text.split(/\r?\n/).filter((line) => /^\s*uses:\s*actions\//.test(line));
  if (actionLines.length === 0) fail(`${label}: no official actions found to validate`);
  for (const line of actionLines) {
    if (!/^\s*uses:\s*actions\/[^@\s]+@[0-9a-f]{40}(?:\s+#.*)?$/.test(line)) {
      fail(`${label}: official action must be pinned to a full commit SHA: ${line.trim()}`);
    }
  }
}

function verifyCheckoutCredentials(text, expectedCount, label) {
  const checkoutCount = (text.match(/^\s*uses:\s*actions\/checkout@/gm) ?? []).length;
  if (checkoutCount !== expectedCount || countText(text, "persist-credentials: false") !== expectedCount) {
    fail(`${label}: every checkout must set persist-credentials: false`);
  }
}

function verifyQualityWorkflow() {
  const sourceLines = lines(PATHS.quality);
  const text = sourceLines.join("\n");
  const onBlock = block(sourceLines, "on");
  if (!sameSet(mappingKeys(onBlock, 2), new Set(["pull_request", "workflow_dispatch"]))) {
    fail("Release Quality events are invalid");
  }
  const types = listItems(block(block(onBlock, "pull_request", 2), "types", 4), 6);
  if (JSON.stringify(types) !== JSON.stringify(["opened", "reopened", "ready_for_review", "synchronize"])) {
    fail(`Release Quality pull_request types are invalid: ${JSON.stringify(types)}`);
  }
  if (countText(text, SELF_HOSTED_RUNNER) !== 2) fail("Both quality jobs must use v2rayn-widget-ci");
  if (countText(text, "github.event.pull_request.head.repo.full_name == github.repository") !== 2) {
    fail("Fork guard must protect both quality jobs");
  }
  if (countText(text, "github.event.pull_request.draft == false") !== 2) {
    fail("Draft guard must protect both quality jobs");
  }

  for (const [needle, label] of [
    ["cancel-in-progress: true", "quality concurrency"],
    [PREREQUISITES, "prerequisite validation"],
    ["-RequireNode", "Node validation"],
    ["-RequireRust", "Rust validation"],
    ["-RequireTauriCli -RequireNsis", "Tauri/NSIS validation"],
    ["npm ci --ignore-scripts", "locked dependency restore"],
    ['Join-Path $env:RUNNER_TEMP "npm-cache"', "npm cache cleanup"],
    ["Cleanup frontend workspace and cache", "frontend cleanup"],
    ["Cleanup Rust workspace", "Rust cleanup"],
  ]) requireText(text, needle, label);

  rejectText(text, "pull_request_target:", "quality events");
  rejectText(onBlock.join("\n"), "push:", "quality events");
  rejectText(text, "--bundles nsis", "quality installer boundary");
  rejectProvisioning(text, "Release Quality");
  verifyCheckoutCredentials(text, 2, "Release Quality");
  verifyPinnedOfficialActions(text, "Release Quality");
}

function verifyReleaseWorkflow() {
  const sourceLines = lines(PATHS.release);
  const text = sourceLines.join("\n");
  const onBlock = block(sourceLines, "on");
  if (!sameSet(mappingKeys(onBlock, 2), new Set(["release", "workflow_dispatch"]))) {
    fail("Release asset events are invalid");
  }
  const releaseTypes = listItems(block(block(onBlock, "release", 2), "types", 4), 6);
  if (JSON.stringify(releaseTypes) !== JSON.stringify(["published"])) {
    fail("Release assets must run only for release.published");
  }

  const buildBlock = block(sourceLines, "build-windows", 2).join("\n");
  const publishBlock = block(sourceLines, "publish-release", 2).join("\n");
  for (const [needle, label] of [
    [SELF_HOSTED_RUNNER, "Windows release runner"],
    [PREREQUISITES, "release prerequisite validation"],
    ["-RequireNode -RequireRust -RequireNsis", "release toolchain validation"],
    ["-RequireTauriCli", "locked Tauri CLI validation"],
    ["npm ci --ignore-scripts", "release dependency restore"],
    ["--bundles nsis", "installer build"],
    ["cargo build --release --locked", "portable build"],
    ['$env:CARGO_NET_OFFLINE = "true"', "offline Cargo packaging"],
    ["nsis-before.sha256", "pre-build NSIS fingerprint"],
    ["nsis-after.sha256", "post-build NSIS fingerprint"],
    ["NSIS cache changed during packaging", "NSIS immutability failure"],
    ["Expected exactly one NSIS installer", "deterministic installer selection"],
    ["Expected exactly four release distribution files", "distribution allowlist"],
    ['Join-Path $env:RUNNER_TEMP "npm-release-cache"', "release npm cache cleanup"],
    ["Cleanup Windows release workspace and caches", "release cleanup"],
    ["SHA256SUMS.txt", "release checksums"],
    ["cancel-in-progress: true", "release concurrency"],
  ]) requireText(text, needle, label);

  rejectProvisioning(buildBlock, "Windows release build");
  rejectText(buildBlock, "contents: write", "release build permissions");
  for (const needle of ["runs-on: ubuntu-latest", "contents: write", "needs: build-windows", "sha256sum --check", "expected_assets", "actual_count", "gh release upload"]) {
    requireText(publishBlock, needle, "isolated release publisher");
  }
  rejectText(publishBlock, SELF_HOSTED_RUNNER, "publisher isolation");
  rejectText(publishBlock, "actions/checkout", "publisher isolation");
  if (countText(text, "contents: write") !== 1) fail("Only publisher may receive contents: write");
  verifyCheckoutCredentials(buildBlock, 1, "Windows release build");
  verifyPinnedOfficialActions(text, "Release assets");
}

function verifyToolchainPolicy() {
  const policy = readJson(PATHS.policy);
  const requiredNsisFiles = [
    "makensis.exe",
    "Bin/makensis.exe",
    "Stubs/lzma-x86-unicode",
    "Stubs/lzma_solid-x86-unicode",
    "Plugins/x86-unicode/additional/nsis_tauri_utils.dll",
    "Include/MUI2.nsh",
    "Include/FileFunc.nsh",
    "Include/x64.nsh",
    "Include/nsDialogs.nsh",
    "Include/WinMessages.nsh",
    "Include/Win/COM.nsh",
    "Include/Win/Propkey.nsh",
    "Include/Win/RestartManager.nsh",
  ];
  if (policy.node?.minimumVersion !== "22.12.0") fail("Node policy must require 22.12.0+");
  if (policy.tauriCli?.version !== "2.11.2") fail("Tauri CLI policy must be 2.11.2");
  if (policy.rust?.host !== "x86_64-pc-windows-msvc") fail("Rust host policy is invalid");
  if (policy.nsis?.version !== "3.11") fail("NSIS policy must be 3.11");
  if (policy.nsis?.tauriUtilsPluginSha1 !== "75197FEE3C6A814FE035788D1C34EAD39349B860") {
    fail("Unexpected nsis_tauri_utils.dll hash");
  }
  if (JSON.stringify(policy.nsis?.requiredFiles) !== JSON.stringify(requiredNsisFiles)) {
    fail("NSIS required-file policy is incomplete");
  }

  const packageLock = readJson(PATHS.packageLock);
  for (const key of ["node_modules/@tauri-apps/cli", "node_modules/@tauri-apps/cli-win32-x64-msvc"]) {
    if (packageLock.packages?.[key]?.version !== policy.tauriCli.version) {
      fail(`${key} must match the pinned Tauri CLI policy`);
    }
  }
}

function verifyPrerequisiteScript() {
  const text = read(PATHS.prerequisites);
  for (const [needle, label] of [
    ["ci-toolchain-policy.json", "policy source"],
    ['Join-Path $env:LOCALAPPDATA "tauri\\NSIS"', "exact Tauri NSIS cache"],
    ["requiredFiles", "NSIS required files"],
    ["tauriUtilsPluginSha1", "NSIS plugin hash"],
    ["Get-NsisCacheFingerprint", "NSIS cache fingerprint"],
    ["cargo clippy --version", "behavioral Clippy validation"],
    ["link.exe", "MSVC linker validation"],
    ["rc.exe", "resource compiler validation"],
    ["host: $expectedHost", "Rust host validation"],
  ]) requireText(text, needle, label);
  rejectText(text, 'Get-Command "makensis.exe"', "arbitrary NSIS discovery");
  rejectText(text, '-Filter "makensis.exe"', "recursive NSIS discovery");
  rejectProvisioning(text, "prerequisite script");
}

function verifyRustEnvironment() {
  const text = read(PATHS.rustEnv);
  for (const needle of [
    '$isGitHubActions = $env:GITHUB_ACTIONS -eq "true"',
    "Automatic Rust installation is forbidden in GitHub Actions",
    "CI will not install or update toolchains",
    "vsDevCmdExitCode",
    "$toolchainBin;$localCargoBin;$env:PATH",
    "CI will not create or populate it",
  ]) requireText(text, needle, "Rust environment policy");
}

function verifyInstallerConfiguration() {
  const config = readJson(PATHS.installerConfig);
  if (config.bundle?.active !== true || JSON.stringify(config.bundle?.targets) !== JSON.stringify(["nsis"])) {
    fail("Installer config must enable only NSIS bundling");
  }
  if (config.bundle?.windows?.nsis?.installMode !== "currentUser") {
    fail("NSIS installer must explicitly use currentUser mode");
  }
  if (config.bundle?.windows?.webviewInstallMode?.type !== "skip") {
    fail("Installer must skip WebView2 installation");
  }
}

function verifyLocalInstallerBuild() {
  const text = read(PATHS.installerBuild);
  for (const [needle, label] of [
    ["npm ci --ignore-scripts", "locked dependency restore"],
    ["-RequireNode -RequireNsis", "NSIS preflight"],
    ["-RequireTauriCli", "locked Tauri CLI preflight"],
    ["v2rayn-widget-nsis-before.sha256", "pre-build fingerprint"],
    ["v2rayn-widget-nsis-after.sha256", "post-build fingerprint"],
    ["Expected exactly one NSIS installer", "deterministic installer output"],
  ]) requireText(text, needle, label);
  rejectProvisioning(text, "local installer build");
}

verifyQualityWorkflow();
verifyReleaseWorkflow();
verifyToolchainPolicy();
verifyPrerequisiteScript();
verifyRustEnvironment();
verifyInstallerConfiguration();
verifyLocalInstallerBuild();
console.log("Workflow, credentials, pinned actions, validation-only toolchains, NSIS cache, installer and cleanup contracts are valid.");
