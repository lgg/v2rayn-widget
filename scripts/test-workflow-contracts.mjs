import { readFileSync, existsSync } from "node:fs";
import { dirname, resolve, relative } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const QUALITY_WORKFLOW = resolve(ROOT, ".github/workflows/windows-quality.yml");
const RELEASE_WORKFLOW = resolve(ROOT, ".github/workflows/release-assets.yml");
const SELF_HOSTED_RUNNER = "runs-on: [self-hosted, v2rayn-widget-ci]";
const PROJECT_RUST_BOOTSTRAP = "scripts/rust-env.ps1";

function fail(message) {
  throw new Error(message);
}

function readLines(path) {
  if (!existsSync(path)) {
    fail(`Missing workflow file: ${relative(ROOT, path)}`);
  }
  return readFileSync(path, "utf8").split(/\r?\n/);
}

function block(lines, key, indent = 0) {
  const prefix = " ".repeat(indent);
  const header = `${prefix}${key}:`;
  const start = lines.indexOf(header);
  if (start < 0) {
    fail(`Missing YAML block: ${header}`);
  }

  const result = [];
  for (const line of lines.slice(start + 1)) {
    if (line.trim() && line.length - line.trimStart().length <= indent) {
      break;
    }
    result.push(line);
  }
  return result;
}

function mappingKeys(lines, indent) {
  const prefix = " ".repeat(indent);
  const keys = new Set();
  for (const line of lines) {
    if (!line.startsWith(prefix) || line.startsWith(`${prefix} `)) {
      continue;
    }
    const stripped = line.trim();
    if (stripped.endsWith(":")) {
      keys.add(stripped.slice(0, -1));
    }
  }
  return keys;
}

function listItems(lines, indent) {
  const prefix = `${" ".repeat(indent)}- `;
  return lines
    .filter((line) => line.startsWith(prefix))
    .map((line) => line.slice(prefix.length).trim());
}

function sameItems(actual, expected) {
  return actual.length === expected.length && actual.every((value, index) => value === expected[index]);
}

function sameSet(actual, expected) {
  return actual.size === expected.size && [...actual].every((value) => expected.has(value));
}

function requireText(text, needle, label) {
  if (!text.includes(needle)) {
    fail(`${label}: missing ${JSON.stringify(needle)}`);
  }
}

function rejectText(text, needle, label) {
  if (text.includes(needle)) {
    fail(`${label}: forbidden ${JSON.stringify(needle)}`);
  }
}

function countText(text, needle) {
  return text.split(needle).length - 1;
}

function verifyQualityWorkflow() {
  const lines = readLines(QUALITY_WORKFLOW);
  const text = lines.join("\n");
  const onBlock = block(lines, "on");
  const events = mappingKeys(onBlock, 2);
  const expectedEvents = new Set(["pull_request", "workflow_dispatch"]);
  if (!sameSet(events, expectedEvents)) {
    fail(`Release Quality events must be ${JSON.stringify([...expectedEvents].sort())}, got ${JSON.stringify([...events].sort())}`);
  }

  const pullRequestBlock = block(onBlock, "pull_request", 2);
  const types = listItems(block(pullRequestBlock, "types", 4), 6);
  const expectedTypes = ["opened", "reopened", "ready_for_review", "synchronize"];
  if (!sameItems(types, expectedTypes)) {
    fail(`Release Quality pull_request types must be ${JSON.stringify(expectedTypes)}, got ${JSON.stringify(types)}`);
  }

  requireText(text, "github.event.pull_request.head.repo.full_name == github.repository", "fork guard");
  if (countText(text, "github.event.pull_request.head.repo.full_name == github.repository") !== 2) {
    fail("Fork guard must protect both heavy jobs");
  }
  if (countText(text, "github.event.pull_request.draft == false") !== 2) {
    fail("Draft guard must protect both heavy jobs");
  }

  requireText(
    text,
    "group: release-quality-${{ github.workflow }}-${{ github.event.pull_request.number || github.ref }}",
    "PR concurrency",
  );
  requireText(text, "cancel-in-progress: true", "PR concurrency");
  rejectText(text, "pull_request_target:", "Release Quality");
  rejectText(onBlock.join("\n"), "push:", "Release Quality events");

  if (countText(text, SELF_HOSTED_RUNNER) !== 2) {
    fail("Both Release Quality jobs must target [self-hosted, v2rayn-widget-ci]");
  }
  rejectText(text, "runs-on: ubuntu-latest", "Release Quality runner assignment");
  rejectText(text, "runs-on: windows-latest", "Release Quality runner assignment");
  rejectText(text, "actions/setup-python", "Release Quality unnecessary toolchains");
  rejectText(text, "dtolnay/rust-toolchain", "self-hosted Rust bootstrap");
  requireText(text, PROJECT_RUST_BOOTSTRAP, "project Rust bootstrap");
  requireText(text, "-UseGlobalHomes", "persistent Rust toolchain reuse");
  requireText(text, "Bootstrap project Rust toolchain", "Rust bootstrap step");
  requireText(text, "runner.environment", "self-hosted runtime assertion");
  requireText(text, "Cleanup frontend workspace", "self-hosted workspace cleanup");
  requireText(text, "Cleanup Rust and installer workspace", "self-hosted workspace cleanup");
}

function verifyReleaseWorkflow() {
  const lines = readLines(RELEASE_WORKFLOW);
  const text = lines.join("\n");
  const onBlock = block(lines, "on");
  const events = mappingKeys(onBlock, 2);
  const expectedEvents = new Set(["release", "workflow_dispatch"]);
  if (!sameSet(events, expectedEvents)) {
    fail(`Release asset events must be ${JSON.stringify([...expectedEvents].sort())}, got ${JSON.stringify([...events].sort())}`);
  }

  const releaseBlock = block(onBlock, "release", 2);
  const releaseTypes = listItems(block(releaseBlock, "types", 4), 6);
  if (!sameItems(releaseTypes, ["published"])) {
    fail(`Release assets must run only for release.published, got ${JSON.stringify(releaseTypes)}`);
  }

  const buildBlock = block(lines, "build-windows", 2).join("\n");
  const publishBlock = block(lines, "publish-release", 2).join("\n");

  rejectText(text, "pull_request_target:", "Release assets");
  rejectText(onBlock.join("\n"), "pull_request:", "Release asset events");
  rejectText(onBlock.join("\n"), "push:", "Release asset events");
  requireText(buildBlock, SELF_HOSTED_RUNNER, "Windows distribution build");
  rejectText(buildBlock, "runs-on: windows-latest", "Windows distribution build");
  rejectText(buildBlock, "dtolnay/rust-toolchain", "self-hosted release Rust bootstrap");
  requireText(buildBlock, PROJECT_RUST_BOOTSTRAP, "project release Rust bootstrap");
  requireText(buildBlock, "-UseGlobalHomes", "persistent release Rust toolchain reuse");
  requireText(buildBlock, "runner.environment", "self-hosted release runtime assertion");
  requireText(buildBlock, "Cleanup Windows release workspace", "self-hosted release cleanup");
  requireText(publishBlock, "runs-on: ubuntu-latest", "isolated release publisher");
  rejectText(publishBlock, SELF_HOSTED_RUNNER, "isolated release publisher");
  requireText(text, "github.event.release.tag_name || inputs.release_tag || inputs.ref", "exact release ref");
  requireText(text, "cargo build --release --locked", "portable build");
  requireText(text, "--bundles nsis", "installer build");
  requireText(text, "actions/upload-artifact@v4", "Actions distribution artifact");
  requireText(text, "SHA256SUMS.txt", "release checksums");
  requireText(text, "release_tag:", "manual release upload input");
  requireText(text, "ref:", "manual build ref input");
  requireText(text, "cancel-in-progress: true", "release concurrency");

  rejectText(buildBlock, "contents: write", "release build permissions");
  requireText(buildBlock, "actions/checkout@v4", "release build checkout");
  requireText(publishBlock, "needs: build-windows", "release publishing dependency");
  requireText(publishBlock, "contents: write", "release upload permission");
  requireText(publishBlock, "actions/download-artifact@v4", "verified artifact handoff");
  requireText(publishBlock, "gh release upload", "GitHub Release assets");
  requireText(publishBlock, "sha256sum --check", "release checksum verification");
  requireText(publishBlock, "expected_assets", "release asset allowlist");
  requireText(publishBlock, "actual_count", "release extra-file rejection");
  rejectText(publishBlock, "actions/checkout", "release publisher isolation");
  if (countText(text, "contents: write") !== 1) {
    fail("Only the isolated release publisher may receive contents: write");
  }
}

verifyQualityWorkflow();
verifyReleaseWorkflow();
console.log("Workflow trigger, runner, toolchain, security, cleanup, and distribution contracts are valid.");
