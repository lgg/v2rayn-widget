import { existsSync, readFileSync } from "node:fs";
import { dirname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const QUALITY_WORKFLOW = resolve(ROOT, ".github/workflows/windows-quality.yml");
const RELEASE_WORKFLOW = resolve(ROOT, ".github/workflows/release-assets.yml");
const RUST_ENV = resolve(ROOT, "scripts/rust-env.ps1");
const PREREQUISITES = "scripts/assert-ci-prerequisites.ps1";
const SELF_HOSTED_RUNNER = "runs-on: [self-hosted, v2rayn-widget-ci]";

function fail(message) {
  throw new Error(message);
}

function read(path) {
  if (!existsSync(path)) {
    fail(`Missing file: ${relative(ROOT, path)}`);
  }
  return readFileSync(path, "utf8");
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
    "actions/setup-node",
    "actions/setup-python",
    "dtolnay/rust-toolchain",
    "rustup toolchain install",
    "rustup component add",
    "-Bootstrap",
    "winget install",
    "choco install",
    "scoop install",
    "msiexec",
    "-Verb RunAs",
    "npm config set registry",
    "npm config set cache",
  ];
  for (const needle of forbidden) {
    rejectText(text, needle, `${label} provisioning policy`);
  }
}

function verifyQualityWorkflow() {
  const sourceLines = lines(QUALITY_WORKFLOW);
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
  requireText(text, "npm ci --ignore-scripts", "local dependency restore");
  requireText(text, "Cleanup frontend workspace", "frontend cleanup");
  requireText(text, "Cleanup Rust workspace", "Rust cleanup");
  rejectText(text, "pull_request_target:", "Release Quality");
  rejectText(onBlock.join("\n"), "push:", "Release Quality events");
  rejectText(text, "--bundles nsis", "Release Quality must not bootstrap installer tooling");
  rejectProvisioning(text, "Release Quality");
}

function verifyReleaseWorkflow() {
  const sourceLines = lines(RELEASE_WORKFLOW);
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
  requireText(buildBlock, "npm ci --ignore-scripts", "release dependency restore");
  requireText(buildBlock, "--bundles nsis", "installer build");
  requireText(buildBlock, "cargo build --release --locked", "portable build");
  requireText(buildBlock, "Cleanup Windows release workspace", "release cleanup");
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
}

function verifyRustBootstrapPolicy() {
  const text = read(RUST_ENV);
  requireText(text, '$isGitHubActions = $env:GITHUB_ACTIONS -eq "true"', "Rust CI guard");
  requireText(text, "Automatic Rust installation is forbidden in GitHub Actions", "Rust CI guard");
  requireText(text, "CI will not install or update toolchains", "missing toolchain failure");
}

verifyQualityWorkflow();
verifyReleaseWorkflow();
verifyRustBootstrapPolicy();
console.log("Workflow runner, no-provisioning, security, cleanup, and distribution contracts are valid.");
