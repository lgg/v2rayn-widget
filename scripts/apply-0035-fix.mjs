import fs from "node:fs";

function read(file) {
  return fs.readFileSync(file, "utf8").replace(/\r\n/g, "\n");
}
function replaceAllRequired(file, before, after) {
  const source = read(file);
  if (!source.includes(before)) throw new Error(`Missing expected correction in ${file}: ${before}`);
  fs.writeFileSync(file, source.replaceAll(before, after));
}
function replaceOnce(file, before, after) {
  const source = read(file);
  const at = source.indexOf(before);
  if (at < 0) throw new Error(`Missing expected correction in ${file}: ${before}`);
  fs.writeFileSync(file, source.slice(0, at) + after + source.slice(at + before.length));
}

replaceOnce(
  "src/frontend/src/app/SettingsWindow.tsx",
  `  const [draftDirty, setDraftDirty] = useState(false);`,
  `  const [, setDraftDirty] = useState(false);`,
);
replaceOnce(
  "src/frontend/src/app/DebugWindow.tsx",
  `      setProbeError(t("debug.v2raynOnly"));`,
  `      setProbeError(null);`,
);
replaceAllRequired(
  "src/frontend/src/app/DebugWindow.test.tsx",
  `{ name: "Debug tools" }`,
  `{ name: "v2rayN Debug Tools" }`,
);
replaceOnce(
  "src/frontend/src/app/DebugWindow.test.tsx",
  `    expect(await screen.findByRole("alert")).toHaveTextContent("v2rayN");\n    expect(screen.getByRole("button", { name: "Open v2rayN" })).toBeDisabled();`,
  `    const adapterNotice = await screen.findByText(/These tools control v2rayN only/);\n    expect(adapterNotice.textContent).toContain("v2rayN");\n    expect((screen.getByRole("button", { name: "Open v2rayN" }) as HTMLButtonElement).disabled).toBe(true);`,
);
replaceOnce(
  "src/frontend/src/app/DebugWindow.test.tsx",
  `    expect(screen.getByRole("button", { name: "Open v2rayN" })).not.toBeDisabled();`,
  `    expect((screen.getByRole("button", { name: "Open v2rayN" }) as HTMLButtonElement).disabled).toBe(false);`,
);
replaceOnce(
  "src/frontend/src/app/SettingsWindow.test.tsx",
  `    fireEvent.click(screen.getByRole("button", { name: "Close" }));\n\n    await act(async () => rejectLiveWrite(new Error("write failed")));`,
  `    fireEvent.click(screen.getByRole("button", { name: "Close" }));\n    await waitFor(() => expect(apiMocks.applyUiSettings).toHaveBeenCalledOnce());\n\n    await act(async () => rejectLiveWrite(new Error("write failed")));`,
);

console.log("0035 verification corrections applied");
