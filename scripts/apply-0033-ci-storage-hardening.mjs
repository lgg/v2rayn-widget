import fs from "node:fs";

function read(path) {
  return fs.readFileSync(path, "utf8").replaceAll("\r\n", "\n");
}

function replaceOnce(source, before, after, label) {
  const count = source.split(before).length - 1;
  if (count !== 1) {
    throw new Error(`${label}: expected one match, found ${count}`);
  }
  return source.replace(before, after);
}

function patch(path, replacements) {
  let source = read(path);
  for (const [before, after, label] of replacements) {
    source = replaceOnce(source, before, after, `${path}: ${label}`);
  }
  fs.writeFileSync(path, source, "utf8");
}

patch(".github/workflows/windows-quality.yml", [
  [
`      - name: Verify pre-provisioned Rust and MSVC
        shell: pwsh
        run: ./scripts/assert-ci-prerequisites.ps1 -RequireRust

      - name: Check all Rust formatting`,
`      - name: Verify pre-provisioned Rust and MSVC
        shell: pwsh
        run: ./scripts/assert-ci-prerequisites.ps1 -RequireRust

      - name: Configure isolated Rust target directory
        shell: pwsh
        run: |
          $minimumFreeBytes = 12GB
          $drive = Get-PSDrive -PSProvider FileSystem |
            Where-Object { $_.Root -and $_.Free -ge $minimumFreeBytes } |
            Sort-Object Free -Descending |
            Select-Object -First 1
          if (-not $drive) {
            throw "No local filesystem drive has at least 12 GB free for the Rust target directory"
          }

          $projectTargetRoot = Join-Path $drive.Root "github-ci-targets\\v2rayn-widget"
          New-Item -ItemType Directory -Path $projectTargetRoot -Force | Out-Null
          Get-ChildItem $projectTargetRoot -Directory -ErrorAction SilentlyContinue |
            Where-Object { $_.LastWriteTimeUtc -lt [DateTime]::UtcNow.AddDays(-1) } |
            Remove-Item -Recurse -Force -ErrorAction SilentlyContinue

          $targetDirectory = Join-Path $projectTargetRoot "${{ github.run_id }}-${{ github.run_attempt }}"
          Remove-Item $targetDirectory -Recurse -Force -ErrorAction SilentlyContinue
          New-Item -ItemType Directory -Path $targetDirectory -Force | Out-Null
          "CARGO_TARGET_DIR=$targetDirectory" | Out-File -FilePath $env:GITHUB_ENV -Encoding utf8 -Append
          "CARGO_INCREMENTAL=0" | Out-File -FilePath $env:GITHUB_ENV -Encoding utf8 -Append

          $freeGb = [math]::Round($drive.Free / 1GB, 2)
          Write-Host "Rust target directory: $targetDirectory on drive $($drive.Name): with $freeGb GB free"

      - name: Check all Rust formatting`,
    "configure spacious isolated Rust target",
  ],
  [
`          cargo build --release --locked 2>&1 | Tee-Object -FilePath rust-release-output.txt
          if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
          if (-not (Test-Path "target/release/v2rayn-widget.exe")) {
            Write-Error "Release executable was not produced"
            exit 1
          }`,
`          cargo build --release --locked 2>&1 | Tee-Object -FilePath rust-release-output.txt
          if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

          $releaseExecutable = Join-Path $env:CARGO_TARGET_DIR "release\\v2rayn-widget.exe"
          if (-not (Test-Path $releaseExecutable)) {
            Write-Error "Release executable was not produced at $releaseExecutable"
            exit 1
          }

          $portableDirectory = Join-Path $env:GITHUB_WORKSPACE "src\\tauri\\portable-release"
          Remove-Item $portableDirectory -Recurse -Force -ErrorAction SilentlyContinue
          New-Item -ItemType Directory -Path $portableDirectory -Force | Out-Null
          Copy-Item $releaseExecutable (Join-Path $portableDirectory "v2rayn-widget.exe") -Force`,
    "copy portable executable from external target",
  ],
  [
`          path: src/tauri/target/release/v2rayn-widget.exe`,
`          path: src/tauri/portable-release/v2rayn-widget.exe`,
    "upload stable portable path",
  ],
  [
`      - name: Cleanup Rust workspace
        if: always()
        shell: pwsh
        run: |
          Remove-Item "src/frontend/dist" -Recurse -Force -ErrorAction SilentlyContinue
          Remove-Item "src/tauri/target" -Recurse -Force -ErrorAction SilentlyContinue`,
`      - name: Cleanup Rust workspace
        if: always()
        shell: pwsh
        run: |
          Remove-Item "src/frontend/dist" -Recurse -Force -ErrorAction SilentlyContinue
          Remove-Item "src/tauri/target" -Recurse -Force -ErrorAction SilentlyContinue
          Remove-Item "src/tauri/portable-release" -Recurse -Force -ErrorAction SilentlyContinue
          if ($env:CARGO_TARGET_DIR) {
            Remove-Item $env:CARGO_TARGET_DIR -Recurse -Force -ErrorAction SilentlyContinue
          }`,
    "clean external Rust target",
  ],
]);

patch("scripts/test-workflow-contracts.mjs", [
  [
`    ["Cleanup Rust workspace", "Rust cleanup"],`,
`    ["Cleanup Rust workspace", "Rust cleanup"],
    ["Configure isolated Rust target directory", "isolated Rust target"],
    ["Get-PSDrive -PSProvider FileSystem", "spacious drive selection"],
    ["CARGO_TARGET_DIR", "external Cargo target"],
    ["src/tauri/portable-release/v2rayn-widget.exe", "stable portable artifact path"],`,
    "enforce storage hardening contract",
  ],
]);

patch("docs/architecture.md", [
  [
`Tray Refresh executes the selected adapter's backend refresh and emits a typed client-scoped status event to Main. Main ignores inactive-client status and error events, compares backend timestamps so an older in-flight frontend response cannot overwrite a newer tray result, and accepts status/profile pairs atomically. Refresh and Open Client failures use the same visible notice/UIPI handling as equivalent Main actions.`,
`Tray Refresh executes the selected adapter's backend refresh and emits a typed client-scoped status event to Main. Main ignores inactive-client status and error events, compares backend timestamps so an older in-flight frontend response cannot overwrite a newer tray result, and accepts status/profile pairs atomically. Refresh and Open Client failures use the same visible notice/UIPI handling as equivalent Main actions.

Release Quality selects the local filesystem drive with the most free space above a fail-closed threshold for an isolated per-run Cargo target. The portable executable is copied back to a stable artifact path, and both the external target and workspace copy are removed in the always-run cleanup. This keeps the validation-only self-hosted runner reliable even when its system drive is constrained.`,
    "document CI storage isolation",
  ],
]);

patch("project-tracking/tasks/0033-tray-runtime-consistency.md", [
  [
`6. The new freshness layer could reject a stale bootstrap status while still accepting its stale profile list; status/profile pairs and tray errors needed atomic client-scoped acceptance.`,
`6. The new freshness layer could reject a stale bootstrap status while still accepting its stale profile list; status/profile pairs and tray errors needed atomic client-scoped acceptance.
7. Release Quality compiled every Rust phase inside the checkout workspace on the nearly full system drive even though spacious local drives were available, causing an infrastructure-only no-space failure before final verification.`,
    "record CI storage finding",
  ],
  [
`- [x] Pure native-label tests, frontend ordering tests and product-surface contracts cover the behavior.
- [ ] Exact-head frontend and Rust Release Quality gates pass.`,
`- [x] Pure native-label tests, frontend ordering tests and product-surface contracts cover the behavior.
- [x] Release Quality selects an isolated spacious-drive Cargo target, publishes from a stable workspace path and removes both copies during cleanup.
- [ ] Exact-head frontend and Rust Release Quality gates pass.`,
    "record CI storage acceptance",
  ],
]);

patch("project-tracking/reports/0033-tray-runtime-consistency-report.md", [
  [
`6. **Related state could split across freshness decisions.** Bootstrap could reject stale status while accepting stale profiles, and tray errors lacked client identity.`,
`6. **Related state could split across freshness decisions.** Bootstrap could reject stale status while accepting stale profiles, and tray errors lacked client identity.
7. **Quality verification was bound to a constrained system drive.** Cargo used the checkout workspace on C: until rustc failed with no space despite E: and D: having ample capacity.`,
    "record CI storage defect",
  ],
  [
`- added Rust, frontend and source-contract regression coverage.`,
`- added Rust, frontend and source-contract regression coverage;
- made Release Quality choose the spacious local drive dynamically for an isolated per-run Cargo target;
- copied the release executable to a stable artifact path and removed external/workspace build copies in always-run cleanup;
- extended workflow contracts so storage isolation cannot regress.`,
    "record CI storage corrections",
  ],
]);
