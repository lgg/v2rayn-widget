import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const releaseWorkflow = resolve(root, ".github/workflows/release-assets.yml");
const localBuild = resolve(root, "scripts/build-installer.ps1");
const prerequisites = resolve(root, "scripts/assert-ci-prerequisites.ps1");
const toolchainPolicy = resolve(root, "scripts/ci-toolchain-policy.json");
const installerConfig = resolve(root, "src/tauri/tauri.installer.conf.json");

const PINNED_NSIS_FINGERPRINT = "28852b9b39fd712258bd098f6d875b4d8053d91e704f5729f0b1e5b139971388";

function fail(message) {
  throw new Error(message);
}

function read(path) {
  if (!existsSync(path)) fail(`Missing contract input: ${path}`);
  return readFileSync(path, "utf8");
}

function requireAll(text, needles, label) {
  for (const needle of needles) {
    if (!text.includes(needle)) fail(`${label}: missing ${JSON.stringify(needle)}`);
  }
}

function rejectAll(text, needles, label) {
  const lower = text.toLowerCase();
  for (const needle of needles) {
    if (lower.includes(needle.toLowerCase())) fail(`${label}: forbidden ${JSON.stringify(needle)}`);
  }
}

function verifyIsolation(text, label) {
  requireAll(
    text,
    [
      "$sourceNsis",
      "$isolatedLocalAppData",
      "$isolatedTauriRoot",
      "$sourceFingerprint",
      "$beforeFingerprint",
      "$afterFingerprint",
      "Copy-Item -LiteralPath $sourceNsis",
      "$env:LOCALAPPDATA = $isolatedLocalAppData",
      "-WriteNsisFingerprint $sourceFingerprint",
      "-WriteNsisFingerprint $beforeFingerprint",
      "-WriteNsisFingerprint $afterFingerprint",
      "The isolated NSIS cache copy does not match",
      "isolated Tauri NSIS cache changed during packaging",
      "RequestExecutionLevel",
      "!define INSTALLWEBVIEW2MODE \"\"",
      "!define WEBVIEW2BOOTSTRAPPERPATH \"\"",
      "!define WEBVIEW2INSTALLERPATH \"\"",
      "!define MINIMUMWEBVIEW2VERSION \"\"",
      "Expected exactly one generated installer.nsi",
      "Expected exactly one NSIS installer",
    ],
    label,
  );

  const copyIndex = text.indexOf("Copy-Item -LiteralPath $sourceNsis");
  const switchIndex = text.indexOf("$env:LOCALAPPDATA = $isolatedLocalAppData");
  const buildIndex = text.indexOf("$tauriCli build");
  const afterIndex = text.indexOf("-WriteNsisFingerprint $afterFingerprint");
  if (!(copyIndex >= 0 && switchIndex > copyIndex && buildIndex > switchIndex && afterIndex > buildIndex)) {
    fail(`${label}: isolated cache sequence is invalid`);
  }

  rejectAll(
    text,
    [
      "Remove-Item -LiteralPath $sourceNsis",
      "Start-Process",
      "Invoke-Item",
      "msiexec",
      "-Verb RunAs",
    ],
    label,
  );
}

const releaseText = read(releaseWorkflow);
const localText = read(localBuild);
const prerequisiteText = read(prerequisites);
const policy = JSON.parse(read(toolchainPolicy));

verifyIsolation(releaseText, "release installer isolation");
verifyIsolation(localText, "local installer isolation");

if (policy.nsis?.cacheFingerprintSha256 !== PINNED_NSIS_FINGERPRINT) {
  fail("toolchain policy: complete NSIS cache fingerprint is not pinned to the audited value");
}
requireAll(
  prerequisiteText,
  [
    "cacheFingerprintSha256",
    "The Tauri NSIS cache fingerprint is not approved",
    "if ($fingerprint -ne $expectedFingerprint)",
  ],
  "NSIS full-cache validation",
);

requireAll(
  localText,
  [
    "-RequireRust -RequireTauriCli",
    "Restore-EnvironmentSnapshot",
    "$originalEnvironment",
    "$originalLocation",
    "Set-Location -LiteralPath $originalLocation.Path",
  ],
  "local installer shell hygiene",
);
rejectAll(localText, ['. (Join-Path $PSScriptRoot "rust-env.ps1")'], "local installer global Rust resolution");

requireAll(
  releaseText,
  [
    "format('refs/tags/{0}'",
    'git rev-list -n 1 "refs/tags/$env:RELEASE_TAG"',
    "Checked-out commit $headCommit does not match release tag commit $tagCommit",
    'find "$distribution_dir" -mindepth 1 -printf \'%P\\n\'',
    "Release distribution does not match the exact recursive allowlist",
    "declare -A manifest_seen=()",
    "Checksum manifest must contain exactly",
    "Duplicate checksum target",
    "Missing checksum target",
    'sha256sum --check --strict "$checksum_file"',
    'gh release upload "$RELEASE_TAG" "${upload_paths[@]}"',
  ],
  "release ref and publisher integrity",
);
rejectAll(releaseText, ["actual_count=", "for asset in \"${expected_assets[@]}\"; do\n            gh release upload"], "legacy publisher validation");

const config = JSON.parse(read(installerConfig));
if (config.bundle?.windows?.nsis?.installMode !== "currentUser") {
  fail("installer config: installMode must be currentUser");
}
if (config.bundle?.windows?.webviewInstallMode?.type !== "skip") {
  fail("installer config: WebView2 installation must be skipped");
}

console.log("Installer cache pinning, isolated packaging, local shell hygiene, exact release refs and publisher integrity contracts are valid.");
