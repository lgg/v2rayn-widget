import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const releaseWorkflow = resolve(root, ".github/workflows/release-assets.yml");
const localBuild = resolve(root, "scripts/build-installer.ps1");
const installerConfig = resolve(root, "src/tauri/tauri.installer.conf.json");

function fail(message) {
  throw new Error(message);
}

function read(path) {
  if (!existsSync(path)) fail(`Missing contract input: ${path}`);
  return readFileSync(path, "utf8");
}

function requireText(text, needle, label) {
  if (!text.includes(needle)) fail(`${label}: missing ${JSON.stringify(needle)}`);
}

function rejectText(text, needle, label) {
  if (text.toLowerCase().includes(needle.toLowerCase())) {
    fail(`${label}: forbidden ${JSON.stringify(needle)}`);
  }
}

function requireOrdered(text, needles, label) {
  let offset = 0;
  for (const needle of needles) {
    const next = text.indexOf(needle, offset);
    if (next < 0) fail(`${label}: missing or out-of-order ${JSON.stringify(needle)}`);
    offset = next + needle.length;
  }
}

function verifyReleaseIsolation() {
  const text = read(releaseWorkflow);
  for (const needle of [
    'Join-Path $env:RUNNER_TEMP "tauri-release-localappdata"',
    'Join-Path $env:RUNNER_TEMP "nsis-source.sha256"',
    'Join-Path $env:RUNNER_TEMP "nsis-before.sha256"',
    'Join-Path $env:RUNNER_TEMP "nsis-after.sha256"',
    "Copy-Item -LiteralPath $sourceNsis -Destination $isolatedTauriRoot -Recurse -Force",
    '$env:LOCALAPPDATA = $isolatedLocalAppData',
    "The isolated NSIS cache copy does not match the validated source cache.",
    "The isolated Tauri NSIS cache changed during packaging.",
    "Expected exactly one generated installer.nsi",
    "RequestExecutionLevel\\s+user",
    "MicrosoftEdgeWebview2Setup\\.exe|WebView2Bootstrapper\\.exe",
    'Remove-Item (Join-Path $env:RUNNER_TEMP "tauri-release-localappdata")',
  ]) requireText(text, needle, "release isolation");

  requireOrdered(
    text,
    [
      "-RequireRust -RequireTauriCli -RequireNsis -WriteNsisFingerprint $sourceFingerprint",
      "Copy-Item -LiteralPath $sourceNsis -Destination $isolatedTauriRoot -Recurse -Force",
      '$env:LOCALAPPDATA = $isolatedLocalAppData',
      "-RequireNsis -WriteNsisFingerprint $beforeFingerprint",
      "& $tauriCli build --bundles nsis",
      "-RequireNsis -WriteNsisFingerprint $afterFingerprint",
    ],
    "release isolated-cache sequence",
  );

  rejectText(text, "Remove-Item -LiteralPath $sourceNsis", "persistent NSIS cache safety");
  rejectText(text, "Start-Process", "generated installer execution");
  rejectText(text, "Invoke-Item", "generated installer execution");
}

function verifyLocalIsolation() {
  const text = read(localBuild);
  for (const needle of [
    "v2rayn-widget-tauri-localappdata-$PID",
    "v2rayn-widget-nsis-source-$PID.sha256",
    "v2rayn-widget-nsis-before-$PID.sha256",
    "v2rayn-widget-nsis-after-$PID.sha256",
    "Copy-Item -LiteralPath $sourceNsis -Destination $isolatedTauriRoot -Recurse -Force",
    '$env:LOCALAPPDATA = $isolatedLocalAppData',
    '$env:LOCALAPPDATA = $originalLocalAppData',
    "The isolated NSIS cache copy does not match the validated source cache.",
    "The isolated Tauri NSIS cache changed during packaging.",
    "Expected exactly one generated installer.nsi",
    "RequestExecutionLevel\\s+user",
    "MicrosoftEdgeWebview2Setup\\.exe|WebView2Bootstrapper\\.exe",
  ]) requireText(text, needle, "local installer isolation");

  requireOrdered(
    text,
    [
      "-RequireNode -RequireNsis -WriteNsisFingerprint $sourceFingerprint",
      "Copy-Item -LiteralPath $sourceNsis -Destination $isolatedTauriRoot -Recurse -Force",
      '$env:LOCALAPPDATA = $isolatedLocalAppData',
      "-RequireNsis -WriteNsisFingerprint $beforeFingerprint",
      "& $tauriCli build",
      "-RequireNsis -WriteNsisFingerprint $afterFingerprint",
    ],
    "local isolated-cache sequence",
  );

  rejectText(text, "Remove-Item -LiteralPath $sourceNsis", "persistent NSIS cache safety");
  rejectText(text, "Start-Process", "generated installer execution");
  rejectText(text, "Invoke-Item", "generated installer execution");
}

function verifyInstallerConfig() {
  const config = JSON.parse(read(installerConfig));
  if (config.bundle?.windows?.nsis?.installMode !== "currentUser") {
    fail("installer config: installMode must be currentUser");
  }
  if (config.bundle?.windows?.webviewInstallMode?.type !== "skip") {
    fail("installer config: WebView2 installation must be skipped");
  }
}

verifyReleaseIsolation();
verifyLocalIsolation();
verifyInstallerConfig();
console.log("Installer toolchain isolation, generated-script and non-execution contracts are valid.");
