import fs from "node:fs";

const path = "scripts/apply-0033-ci-storage-hardening.mjs";
let source = fs.readFileSync(path, "utf8").replaceAll("\r\n", "\n");
const before = '"${{ github.run_id }}-${{ github.run_attempt }}"';
const after = '"\\${{ github.run_id }}-\\${{ github.run_attempt }}"';
const count = source.split(before).length - 1;
if (count !== 1) {
  throw new Error(`Expected one GitHub run expression, found ${count}`);
}
source = source.replace(before, after);
fs.writeFileSync(path, source, "utf8");
await import(`./apply-0033-ci-storage-hardening.mjs?escaped=${Date.now()}`);
