import fs from "node:fs";

const replacements = [
  ["actions/checkout@11d5960a326750d5838078e36cf38b85af677262 # v4", "actions/checkout@fbc6f3992d24b796d5a048ff273f7fcc4a7b6c09 # v5"],
  ["actions/upload-artifact@ea165f8d65b6e75b540449e92b4886f43607fa02 # v4", "actions/upload-artifact@b7c566a772e6b6bfb58ed0dc250532a479d7789f # v6"],
  ["actions/download-artifact@d3f86a106a0bac45b974a628896c90dbdf5c8093 # v4", "actions/download-artifact@37930b1c2abaa49bbe596cd826c3c89aef350131 # v7"],
];

fs.mkdirSync("scripts/workflows-updated", { recursive: true });
for (const name of ["windows-quality.yml", "release-assets.yml"]) {
  const sourcePath = `.github/workflows/${name}`;
  let source = fs.readFileSync(sourcePath, "utf8").replace(/\r\n/g, "\n");
  for (const [before, after] of replacements) {
    if (source.includes(before)) source = source.replaceAll(before, after);
  }
  if (source.includes("actions/checkout@11d5960a") || source.includes("actions/upload-artifact@ea165f8") || source.includes("actions/download-artifact@d3f86a")) {
    throw new Error(`${name} still contains a Node 20 action pin`);
  }
  fs.writeFileSync(`scripts/workflows-updated/${name}`, source);
}
console.log("Node 24 workflow copies materialized");
