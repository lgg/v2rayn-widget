from __future__ import annotations

from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
QUALITY_WORKFLOW = ROOT / ".github" / "workflows" / "windows-quality.yml"
RELEASE_WORKFLOW = ROOT / ".github" / "workflows" / "release-assets.yml"


def fail(message: str) -> None:
    raise AssertionError(message)


def read_lines(path: Path) -> list[str]:
    if not path.is_file():
        fail(f"Missing workflow file: {path.relative_to(ROOT)}")
    return path.read_text(encoding="utf-8").splitlines()


def block(lines: list[str], key: str, indent: int = 0) -> list[str]:
    prefix = " " * indent
    header = f"{prefix}{key}:"
    try:
        start = lines.index(header)
    except ValueError as error:
        raise AssertionError(f"Missing YAML block: {header}") from error

    result: list[str] = []
    for line in lines[start + 1 :]:
        if line.strip() and len(line) - len(line.lstrip(" ")) <= indent:
            break
        result.append(line)
    return result


def mapping_keys(lines: list[str], indent: int) -> set[str]:
    prefix = " " * indent
    keys: set[str] = set()
    for line in lines:
        if not line.startswith(prefix) or line.startswith(prefix + " "):
            continue
        stripped = line.strip()
        if stripped.endswith(":"):
            keys.add(stripped[:-1])
    return keys


def list_items(lines: list[str], indent: int) -> list[str]:
    prefix = " " * indent + "- "
    return [line[len(prefix) :].strip() for line in lines if line.startswith(prefix)]


def require_text(text: str, needle: str, label: str) -> None:
    if needle not in text:
        fail(f"{label}: missing {needle!r}")


def reject_text(text: str, needle: str, label: str) -> None:
    if needle in text:
        fail(f"{label}: forbidden {needle!r}")


def verify_quality_workflow() -> None:
    lines = read_lines(QUALITY_WORKFLOW)
    text = "\n".join(lines)
    on_block = block(lines, "on")
    events = mapping_keys(on_block, 2)
    expected_events = {"pull_request", "workflow_dispatch"}
    if events != expected_events:
        fail(f"Release Quality events must be {sorted(expected_events)}, got {sorted(events)}")

    pull_request_block = block(on_block, "pull_request", 2)
    types = list_items(block(pull_request_block, "types", 4), 6)
    expected_types = ["opened", "reopened", "ready_for_review"]
    if types != expected_types:
        fail(f"Release Quality pull_request types must be {expected_types}, got {types}")

    require_text(text, "github.event.pull_request.head.repo.full_name == github.repository", "fork guard")
    if text.count("github.event.pull_request.head.repo.full_name == github.repository") != 2:
        fail("Fork guard must protect both heavy jobs")
    if text.count("github.event.pull_request.draft == false") != 2:
        fail("Draft guard must protect both heavy jobs")

    require_text(
        text,
        "group: release-quality-${{ github.workflow }}-${{ github.event.pull_request.number || github.ref }}",
        "PR concurrency",
    )
    require_text(text, "cancel-in-progress: true", "PR concurrency")
    reject_text(text, "pull_request_target:", "Release Quality")
    reject_text("\n".join(on_block), "push:", "Release Quality events")
    reject_text("\n".join(pull_request_block), "synchronize", "Release Quality PR events")


def verify_release_workflow() -> None:
    lines = read_lines(RELEASE_WORKFLOW)
    text = "\n".join(lines)
    on_block = block(lines, "on")
    events = mapping_keys(on_block, 2)
    expected_events = {"release", "workflow_dispatch"}
    if events != expected_events:
        fail(f"Release asset events must be {sorted(expected_events)}, got {sorted(events)}")

    release_block = block(on_block, "release", 2)
    release_types = list_items(block(release_block, "types", 4), 6)
    if release_types != ["published"]:
        fail(f"Release assets must run only for release.published, got {release_types}")

    build_block = "\n".join(block(lines, "build-windows", 2))
    publish_block = "\n".join(block(lines, "publish-release", 2))

    reject_text(text, "pull_request_target:", "Release assets")
    reject_text("\n".join(on_block), "pull_request:", "Release asset events")
    reject_text("\n".join(on_block), "push:", "Release asset events")
    require_text(text, "runs-on: windows-latest", "Windows distribution build")
    require_text(text, "github.event.release.tag_name || inputs.release_tag || inputs.ref", "exact release ref")
    require_text(text, "cargo build --release --locked", "portable build")
    require_text(text, "--bundles nsis", "installer build")
    require_text(text, "actions/upload-artifact@v4", "Actions distribution artifact")
    require_text(text, "SHA256SUMS.txt", "release checksums")
    require_text(text, "release_tag:", "manual release upload input")
    require_text(text, "ref:", "manual build ref input")
    require_text(text, "cancel-in-progress: true", "release concurrency")

    reject_text(build_block, "contents: write", "release build permissions")
    require_text(build_block, "actions/checkout@v4", "release build checkout")
    require_text(publish_block, "needs: build-windows", "release publishing dependency")
    require_text(publish_block, "contents: write", "release upload permission")
    require_text(publish_block, "actions/download-artifact@v4", "verified artifact handoff")
    require_text(publish_block, "gh release upload", "GitHub Release assets")
    reject_text(publish_block, "actions/checkout", "release publisher isolation")
    if text.count("contents: write") != 1:
        fail("Only the isolated release publisher may receive contents: write")


if __name__ == "__main__":
    verify_quality_workflow()
    verify_release_workflow()
    print("Workflow trigger, security, and distribution contracts are valid.")
