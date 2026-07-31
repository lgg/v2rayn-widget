#[test]
fn release_quality_uses_an_isolated_spacious_rust_target() {
    let workflow = include_str!("../../../.github/workflows/windows-quality.yml");

    assert!(workflow.contains("Configure isolated Rust target directory"));
    assert!(workflow.contains("Get-PSDrive -PSProvider FileSystem"));
    assert!(workflow.contains("CARGO_TARGET_DIR=$targetDirectory"));
    assert!(workflow.contains("CARGO_INCREMENTAL=0"));
    assert!(workflow.contains("src/tauri/portable-release/v2rayn-widget.exe"));
    assert!(workflow.contains("Remove-Item $env:CARGO_TARGET_DIR"));
}
