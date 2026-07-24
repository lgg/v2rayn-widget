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
      "WebView2Bootstrapper",
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

verifyIsolation(read(releaseWorkflow), "release installer isolation");
verifyIsolation(read(localBuild), "local installer isolation");

const config = JSON.parse(read(installerConfig));
if (config.bundle?.windows?.nsis?.installMode !== "currentUser") {
  fail("installer config: installMode must be currentUser");
}
if (config.bundle?.windows?.webviewInstallMode?.type !== "skip") {
  fail("installer config: WebView2 installation must be skipped");
}

console.log("Installer toolchain isolation, generated-script and non-execution contracts are valid.");
