import fs from "node:fs";

for (const path of [
  "src/frontend/src/app/DebugWindow.test.tsx",
  "src/frontend/src/app/HappSetupWindow.test.tsx",
]) {
  const source = fs.readFileSync(path, "utf8").replace(/\r\n/g, "\n");
  const before = `  afterEach(async () => {\n    await i18n.changeLanguage("en");`;
  const after = `  afterEach(async () => {\n    await act(async () => {\n      await i18n.changeLanguage("en");\n    });`;
  const count = source.split(before).length - 1;
  if (count !== 1) throw new Error(`Expected one teardown language reset in ${path}, found ${count}`);
  fs.writeFileSync(path, source.replace(before, after));
}

console.log("0034 teardown transitions wrapped in act");
