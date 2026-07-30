import fs from "node:fs";

const path = "src/tauri/src/commands/mod.rs";
const source = fs.readFileSync(path, "utf8").replaceAll("\r\n", "\n");
const before = "        assert_eq!(merged.window_opacity_percent, current.window_opacity_percent);\n";
const after = "        assert_eq!(\n            merged.window_opacity_percent,\n            current.window_opacity_percent\n        );\n";
const matches = source.split(before).length - 1;
if (matches !== 1) throw new Error(`Expected one rustfmt target, found ${matches}`);
fs.writeFileSync(path, source.replace(before, after), "utf8");
