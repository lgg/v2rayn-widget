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
  if (!existsSync(path)) {
    fail(`Missing file: ${relative(ROOT, path)}`);
  }
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
  if (start < 0) {
    fail(`Missing YAML block: ${header}`);
  }

  const result = [];
  for (const line of sourceLines.slice(start + 1)) {
    if (line.trim() && line.length - line.trimStart().length <= indent) {
      break;
    }
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
  if (!text.includes(needle)) {
    fail(`${label}: missing ${JSON.stringify(needle)}`);
  }
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
  const forbidden = [
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
  ];
  for (const needle of forbidden) {
    rejectText(text, needle, `${label} provisioning policy`);
  }
}

function verifyPinnedOfficialActions(text, label) {
  const actionLines = text.split(/\r?\n/).filter((line) => /^\s*uses:\s*actions\//.test(line));
  if (actionLines.length === 0) {
    fail(`${label}: no official actions found to validate`);
  }

  for (const line of actionLines) {
    const match = line.match(/^\s*uses:\s*(actions\/[^@\s]+)@([0-9a-f]{40})(?:\s+#.*)?$/);
    if (!match) {
      fail(`${label}: official action must be pinned to a full commit SHA: ${line.trim()}`);
    }
  }
}

function verifyCheckoutCredentialPolicy(text, expectedCount, label) {
  const checkoutCount = (text.match(/^\s*uses:\s*actions\/checkout@/gm) ?? []).length;
  const noCredentialCount = countText(text, "persist-credentials: false");
  if (checkoutCount !== expectedCount || noCredentialCount !== expectedCount) {
    fail(`${label}: every checkout must set persist-credentials: false`);
  }
}

function verifyQualityWorkflow() {
  const sourceLines = lines(PATHS.quality);
  const text = sourceLines.join("\n");
  const onBlock = block(sourceLines, "on");
  const events = mappingKeys(onBlock, 2);
  const expectedEvents = new Set(["pull_request", "workflow_dispatch"]);
  if (!sameSet(events, expectedEvents)) {
    fail(`Release Quality events are invalid: ${JSON.stringify([...events].sort())}`);
  }

  const pullRequestBlock = block(onBlock, "pull_request", 2);
  const types = listItems(block(pullRequestBlock, "types", 4), 6);
  const expectedTypes = ["opened", "reopened", "ready_for_review", "synchronize"];
  if (JSON.stringify(types) !== JSON.stringify(expectedTypes)) {
    fail(`Release Quality pull_request types are invalid: ${JSON.stringify(types)}`);
  }

  if (countText(text, SELF_HOSTED_RUNNER) !== 2) {
    fail("Both Release Quality jobs must target [self-hosted, v2rayn-widget-ci]");
  }
  if (countText(text, "github.event.pull_request.head.repo.full_name == github.repository") !== 2) {
    fail("Fork guard must protect both Release Quality jobs");
  }
  if (countText(text, "github.event.pull_request.draft == false") !== 2) {
    fail("Draft guard must protect both Release Quality jobs");
  }

  requireText(text, "cancel-in-progress: true", "Release Quality concurrency");
  requireText(text, PREREQUISITES, "pre-provisioned runner check");
  requireText(text, "-RequireNode", "Node prerequisite check");
  requireText(text, "-RequireRust", "Rust prerequisite check");
  requireText(text, "-RequireTauriCli -RequireNsis", "locked release prerequisite check");
  requireText(text, "npm ci --ignore-scripts", "local dependency restore");
  requireText(text, 'Join-Path $env:RUNNER_TEMP "npm-cache"', "frontend npm cache cleanup");
  requireText(text, "Cleanup frontend workspace and cache", "frontend cleanup");
  requireText(text, "Cleanup Rust workspace", "Rust cleanup");
  rejectText(text, "pull_request_target:", "Release Quality");
  rejectText(onBlock.join("\n"), "push:", "Release Quality events");
  rejectText(text, "--bundles nsis", "Release Quality must not package installers");
  rejectProvisioning(text, "Release Quality");
  verifyCheckoutCredentialPolicy(text, 2, "Release Quality");
  verifyPinnedOfficialActions(text, "Release Quality");
}

function verifyReleaseWorkflow() {
  const sourceLines = lines(PATHS.release);
  const text = sourceLines.join("\n");
  const onBlock = block(sourceLines, "on");
  const events = mappingKeys(onBlock, 2);
  const expectedEvents = new Set(["release", "workflow_dispatch"]);
  if (!sameSet(events, expectedEvents)) {
    fail(`Release asset events are invalid: ${JSON.stringify([...events].sort())}`);
  }

  const releaseTypes = listItems(block(block(onBlock, "release", 2), "types", 4), 6);
  if (JSON.stringify(releaseTypes) !== JSON.stringify(["published"])) {
    fail(`Release assets must run only for release.published: ${JSON.stringify(releaseTypes)}`);
  }

  const buildBlock = block(sourceLines, "build-windows", 2).join("\n");
  const publishBlock = block(sourceLines, "publish-release", 2).join("\n");

  requireText(buildBlock, SELF_HOSTED_RUNNER, "Windows release build runner");
  requireText(buildBlock, PREREQUISITES, "release prerequisite check");
  requireText(buildBlock, "-RequireNode -RequireRust -RequireNsis", "release toolchain preflight");
  requireText(buildBlock, "-RequireTauriCli", "locked Tauri CLI preflight");
  requireText(buildBlock, "npm ci --ignore-scripts", "release dependency restore");
  requireText(buildBlock, "--bundles nsis", "installer build");
  requireText(buildBlock, "cargo build --release --locked", "portable build");
  requireText(buildBlock, '$env:CARGO_NET_OFFLINE = "true"', "offline Cargo packaging");
  requireText(buildBlock, "nsis-before.sha256", "NSIS cache fingerprint before build");
  requireText(buildBlock, "nsis-after.sha256", "NSIS cache fingerprint after build");
  requireText(buildBlock, "NSIS cache changed during packaging", "NSIS cache immutability failure");
  requireText(buildBlock, "Expected exactly one NSIS installer", "deterministic installer selection");
  requireText(buildBlock, "Expected exactly four release distribution files", "distribution allowlist");
  requireText(buildBlock, 'Join-Path $env:RUNNER_TEMP "npm-release-cache"', "release npm cache cleanup");
  requireText(buildBlock, "Cleanup Windows release workspace and caches", "release cleanup");
  requireText(text, "SHA256SUMS.txt", "release checksums");
  requireText(text, "cancel-in-progress: true", "release concurrency");

  rejectProvisioning(buildBlock, "Windows release build");
  rejectText(buildBlock, "contents: write", "release build permissions");
  requireText(publishBlock, "runs-on: ubuntu-latest", "isolated release publisher");
  requireText(publishBlock, "contents: write", "release publisher permission");
  requireText(publishBlock, "needs: build-windows", "release artifact handoff");
  requireText(publishBlock, "sha256sum --check", "release checksum verification");
  requireText(publishBlock, "expected_assets", "release allowlist");
  requireText(publishBlock, "actual_count", "release extra-file rejection");
  requireText(publishBlock, "gh release upload", "release upload");
  rejectText(publishBlock, SELF_HOSTED_RUNNER, "publisher isolation");
  rejectText(publishBlock, "actions/checkout", "publisher isolation");
  if (countText(text, "contents: write") !== 1) {
    fail("Only the isolated release publisher may receive contents: write");
  }

  verifyCheckoutCredentialPolicy(buildBlock, 1, "Windows release build");
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

  if (policy.node?.minimumVersion !== "22.12.0") {
    fail("CI policy must require Node.js 22.12.0 or newer");
  }
  if (policy.tauriCli?.version !== "2.11.2") {
    fail("CI policy must match the locked Tauri CLI 2.11.2");
  }
  if (policy.rust?.host !== "x86_64-pc-windows-msvc") {
    fail("CI policy must require the x64 MSVC Rust host");
  }
  if (policy.nsis?.version !== "3.11") {
    fail("CI policy must require the Tauri NSIS 3.11 toolset");
  }
  if (policy.nsis?.tauriUtilsPluginSha1 !== "75197FEE3C6A814FE035788D1C34EAD39349B860") {
    fail("CI policy contains an unexpected nsis_tauri_utils.dll hash");
  }
  if (JSON.stringify(policy.nsis?.requiredFiles) !== JSON.stringify(requiredNsisFiles)) {
    fail("CI policy must mirror the exact Tauri NSIS required-file list");
  }

  const packageLock = readJson(PATHS.packageLock);
  const lockedCliVersion = packageLock.packages?.["node_modules/@tauri-apps/cli"]?.version;
  const lockedWindowsCliVersion = packageLock.packages?.["node_modules/@tauri-apps/cli-win32-x64-msvc"]?.version;
  if (lockedCliVersion !== policy.tauriCli.version || lockedWindowsCliVersion !== policy.tauriCli.version) {
    fail("The generic and Windows Tauri CLI packages must match the CI toolchain policy");
  }
}

function verifyPrerequisiteScript() {
  const text = read(PATHS.prerequisites);
  requireText(text, "ci-toolchain-policy.json", "prerequisite policy source");
  requireText(text, 'Join-Path $env:LOCALAPPDATA "tauri\\NSIS"', "exact Tauri NSIS cache");
  requireText(text, "requiredFiles", "Tauri NSIS required-file validation");
  requireText(text, "tauriUtilsPluginSha1", "Tauri NSIS plugin hash validation");
  requireText(text, "Get-NsisCacheFingerprint", "Tauri NSIS cache fingerprint");
  requireText(text, "cargo-clippy.exe", "direct Clippy component validation");
  requireText(text, "link.exe", "MSVC linker validation");
  requireText(text, "rc.exe", "Windows SDK resource compiler validation");
  requireText(text, "host:", "Rust target host validation");
  rejectText(text, 'Get-Command "makensis.exe"', "arbitrary NSIS PATH discovery");
  rejectText(text, '-Filter "makensis.exe"', "recursive NSIS discovery");
  rejectProvisioning(text, "prerequisite script");
}

function verifyRustEnvironment() {
  const text = read(PATHS.rustEnv);
  requireText(text, '$isGitHubActions = $env:GITHUB_ACTIONS -eq "true"', "Rust CI guard");
  requireText(text, "Automatic Rust installation is forbidden in GitHub Actions", "Rust CI guard");
  requireText(text, "CI will not install or update toolchains", "missing toolchain failure");
  requireText(text, "vsDevCmdExitCode", "Visual Studio environment exit-code validation");
  requireText(text, "$toolchainBin;$localCargoBin;$env:PATH", "direct Rust binaries before rustup proxies");
  requireText(text, "CI will not create or populate it", "global Rust home fail-closed policy");
}

function verifyInstallerConfiguration() {
  const config = readJson(PATHS.installerConfig);
  if (config.bundle?.active !== true || JSON.stringify(config.bundle?.targets) !== JSON.stringify(["nsis"])) {
    fail("Installer config must enable only NSIS bundling");
  }
  if (config.bundle?.windows?.nsis?.installMode !== "currentUser") {
    fail("NSIS installer must explicitly use currentUser mode to avoid UAC");
  }
  if (config.bundle?.windows?.webviewInstallMode?.type !== "skip") {
    fail("Installer must not download or execute a WebView2 installer");
  }
}

function verifyLocalInstallerBuild() {
  const text = read(PATHS.installerBuild);
  requireText(text, "npm ci --ignore-scripts", "local locked dependency restore");
  requireText(text, "-RequireNode -RequireNsis", "local NSIS preflight");
  requireText(text, "-RequireTauriCli", "local locked Tauri CLI preflight");
  requireText(text, "v2rayn-widget-nsis-before.sha256", "local NSIS fingerprint before build");
  requireText(text, "v2rayn-widget-nsis-after.sha256", "local NSIS fingerprint after build");
  requireText(text, "Expected exactly one NSIS installer", "local deterministic installer result");
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
