import fs from "node:fs";

const path = "src/tauri/tests/product_surface_contracts.rs";
let source = fs.readFileSync(path, "utf8").replaceAll("\r\n", "\n");

const replacements = [
  [
    '    assert!(main.contains("app_handle.emit("tray-status-updated", payload)"));\n',
    '    assert!(main.contains("app_handle.emit(\\\"tray-status-updated\\\", payload)"));\n',
  ],
  [
    '    assert!(app.contains("bindTauriListener<TrayStatusUpdate>("tray-status-updated""));\n',
    '    assert!(app.contains(\n        "bindTauriListener<TrayStatusUpdate>(\\\"tray-status-updated\\\""\n    ));\n',
  ],
  [
    '    assert!(app.contains("bindTauriListener<TrayOperationError>("tray-operation-error""));\n',
    '    assert!(app.contains(\n        "bindTauriListener<TrayOperationError>(\\\"tray-operation-error\\\""\n    ));\n',
  ],
];

for (const [before, after] of replacements) {
  const matches = source.split(before).length - 1;
  if (matches !== 1) {
    throw new Error(`Expected exactly one contract match, found ${matches}: ${before}`);
  }
  source = source.replace(before, after);
}

fs.writeFileSync(path, source, "utf8");
