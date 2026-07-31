import fs from "node:fs";

function read(file) {
  return fs.readFileSync(file, "utf8").replace(/\r\n/g, "\n");
}
function write(file, content) {
  fs.writeFileSync(file, content);
}
function replaceOnce(file, before, after) {
  const source = read(file);
  const at = source.indexOf(before);
  if (at < 0) throw new Error(`Missing expected block in ${file}: ${before.slice(0, 140)}`);
  if (source.indexOf(before, at + before.length) >= 0) throw new Error(`Expected unique block in ${file}`);
  write(file, source.slice(0, at) + after + source.slice(at + before.length));
}
function insertBeforeLast(file, marker, addition) {
  const source = read(file);
  const at = source.lastIndexOf(marker);
  if (at < 0) throw new Error(`Missing final marker in ${file}`);
  write(file, source.slice(0, at) + addition + source.slice(at));
}

// A stale successful live write must not replace a newer authoritative event snapshot.
replaceOnce(
  "src/frontend/src/app/SettingsWindow.tsx",
  `        const saved = await applyUiSettings(patch);\n        authoritativeSettingsRef.current = saved;\n        liveWriteFailedRef.current = false;\n        if (revision === settingsRevisionRef.current) {\n          setSettings((prev) => (prev ? mergeUiFields(prev, saved) : saved));`,
  `        const saved = await applyUiSettings(patch);\n        if (revision === settingsRevisionRef.current) {\n          authoritativeSettingsRef.current = saved;\n          liveWriteFailedRef.current = false;\n          setSettings((prev) => (prev ? mergeUiFields(prev, saved) : saved));`,
);
insertBeforeLast(
  "src/frontend/src/app/SettingsWindow.test.tsx",
  `\n});`,
  `\n  it("keeps a newer authoritative fallback after a stale live-write success", async () => {\n    let settingsHandler: ((event: { payload: AppSettings }) => void) | undefined;\n    let resolveStaleWrite!: (value: AppSettings) => void;\n    eventMocks.listen.mockImplementation(async (eventName: string, handler: (event: { payload: AppSettings }) => void) => {\n      if (eventName === "settings-updated") settingsHandler = handler;\n      return () => undefined;\n    });\n    apiMocks.applyUiSettings\n      .mockImplementationOnce(\n        () => new Promise<AppSettings>((resolve) => { resolveStaleWrite = resolve; }),\n      )\n      .mockRejectedValueOnce(new Error("second live write failed"));\n    apiMocks.getSettings\n      .mockResolvedValueOnce(baseSettings)\n      .mockRejectedValueOnce(new Error("recovery unavailable"));\n\n    render(<SettingsWindow />);\n    await screen.findByRole("heading", { name: "Settings" });\n    await waitFor(() => expect(settingsHandler).toBeDefined());\n    const alwaysOnTop = screen.getByLabelText("Always on top") as HTMLInputElement;\n\n    fireEvent.click(alwaysOnTop);\n    await waitFor(() => expect(apiMocks.applyUiSettings).toHaveBeenCalledTimes(1));\n    await act(async () => {\n      settingsHandler?.({ payload: { ...baseSettings, theme: "light", always_on_top: false } });\n      resolveStaleWrite({ ...baseSettings, theme: "dark", always_on_top: true });\n      await Promise.resolve();\n    });\n\n    expect(alwaysOnTop.checked).toBe(false);\n    fireEvent.click(alwaysOnTop);\n    expect((await screen.findByRole("alert")).textContent).toContain("Could not save settings");\n    expect(alwaysOnTop.checked).toBe(false);\n    expect(document.documentElement.classList.contains("dark")).toBe(false);\n  });\n`,
);

// Debug results belong to the selected-client generation that started them.
replaceOnce(
  "src/frontend/src/app/DebugWindow.tsx",
  `  const [settingsListenerSettled, setSettingsListenerSettled] = useState(false);\n  const [selectedClient, setSelectedClient] = useState<ProxyClientId | null>(null);\n\n  const append = (line: string): void => {\n    setLog((prev) => [\`${new Date().toLocaleTimeString()}  ${line}\`, ...prev].slice(0, 220));\n  };\n\n  const captureSnapshot = async (label: string): Promise<void> => {\n    try {\n      const snapshot = await debugCaptureRuntimeSnapshot();\n      append(\`${label}: ${formatSnapshot(snapshot)}\`);\n    } catch (error) {\n      append(\`${label}: snapshot failed (${error instanceof Error ? error.message : String(error)})\`);\n    }\n  };\n\n  const run = async (\n    title: string,\n    fn: () => Promise<unknown>,\n    options?: { captureSnapshot?: boolean; refreshProbe?: boolean; probeOperation?: boolean }\n  ): Promise<boolean> => {\n    setBusy(true);\n    const withSnapshot = options?.captureSnapshot ?? true;\n    if (options?.probeOperation) {\n      setProbeError(null);\n      setReport(null);\n    }\n\n    try {\n      append(\`RUN ${title}\`);\n      if (withSnapshot) {\n        await captureSnapshot("before");\n      }\n\n      const result = await fn();\n      append(\`OK ${title}: ${typeof result === "string" ? result : "done"}\`);\n\n      if (withSnapshot) {\n        await captureSnapshot("after");\n      }\n\n      if (options?.refreshProbe) {\n        const refreshed = await runUiDebugProbe();\n        setReport(refreshed);\n        setProbeError(null);\n      }\n      return true;\n    } catch (error) {\n      const message = error instanceof Error ? error.message : String(error);\n      append(\`ERR ${title}: ${message}\`);\n      if (options?.probeOperation || options?.refreshProbe) {\n        setProbeError(message.trim() || t("debug.probeFailed"));\n      }\n      if (withSnapshot) {\n        await captureSnapshot("after_err");\n      }\n      return false;\n    } finally {\n      setBusy(false);\n    }\n  };`,
  `  const [settingsListenerSettled, setSettingsListenerSettled] = useState(false);\n  const [selectedClient, setSelectedClient] = useState<ProxyClientId | null>(null);\n  const selectedClientRef = useRef<ProxyClientId | null>(null);\n  const clientRevisionRef = useRef(0);\n\n  const applySelectedClient = (client: ProxyClientId): void => {\n    if (selectedClientRef.current !== client) {\n      clientRevisionRef.current += 1;\n    }\n    selectedClientRef.current = client;\n    setSelectedClient(client);\n    if (client !== "v2rayn") {\n      setBusy(false);\n      setReport(null);\n      setProbeError(null);\n      setInitialProbePending(false);\n    }\n  };\n\n  const append = (line: string): void => {\n    setLog((prev) => [\`${new Date().toLocaleTimeString()}  ${line}\`, ...prev].slice(0, 220));\n  };\n\n  const captureSnapshot = async (label: string, isCurrent: () => boolean): Promise<void> => {\n    try {\n      const snapshot = await debugCaptureRuntimeSnapshot();\n      if (isCurrent()) append(\`${label}: ${formatSnapshot(snapshot)}\`);\n    } catch (error) {\n      if (isCurrent()) {\n        append(\`${label}: snapshot failed (${error instanceof Error ? error.message : String(error)})\`);\n      }\n    }\n  };\n\n  const run = async (\n    title: string,\n    fn: () => Promise<unknown>,\n    options?: { captureSnapshot?: boolean; refreshProbe?: boolean; probeOperation?: boolean }\n  ): Promise<boolean> => {\n    const operationRevision = clientRevisionRef.current;\n    const isCurrent = (): boolean =>\n      operationRevision === clientRevisionRef.current && selectedClientRef.current === "v2rayn";\n    if (!isCurrent()) return false;\n\n    setBusy(true);\n    const withSnapshot = options?.captureSnapshot ?? true;\n    if (options?.probeOperation) {\n      setProbeError(null);\n      setReport(null);\n    }\n\n    try {\n      append(\`RUN ${title}\`);\n      if (withSnapshot) {\n        await captureSnapshot("before", isCurrent);\n      }\n      if (!isCurrent()) return false;\n\n      const result = await fn();\n      if (!isCurrent()) return false;\n      append(\`OK ${title}: ${typeof result === "string" ? result : "done"}\`);\n      if (options?.probeOperation) {\n        setReport(result as UiDebugReport);\n        setProbeError(null);\n      }\n\n      if (withSnapshot) {\n        await captureSnapshot("after", isCurrent);\n      }\n\n      if (options?.refreshProbe) {\n        const refreshed = await runUiDebugProbe();\n        if (!isCurrent()) return false;\n        setReport(refreshed);\n        setProbeError(null);\n      }\n      return true;\n    } catch (error) {\n      if (!isCurrent()) return false;\n      const message = error instanceof Error ? error.message : String(error);\n      append(\`ERR ${title}: ${message}\`);\n      if (options?.probeOperation || options?.refreshProbe) {\n        setProbeError(message.trim() || t("debug.probeFailed"));\n      }\n      if (withSnapshot) {\n        await captureSnapshot("after_err", isCurrent);\n      }\n      return false;\n    } finally {\n      if (isCurrent()) setBusy(false);\n    }\n  };`,
);
replaceOnce(
  "src/frontend/src/app/DebugWindow.tsx",
  `        setSelectedClient(settings.selected_client);`,
  `        applySelectedClient(settings.selected_client);`,
);
replaceOnce(
  "src/frontend/src/app/DebugWindow.tsx",
  `        setSelectedClient(event.payload.selected_client);`,
  `        applySelectedClient(event.payload.selected_client);`,
);
replaceOnce(
  "src/frontend/src/app/DebugWindow.tsx",
  `    setInitialProbePending(true);\n    void run(\n      "probe",\n      async () => {\n        const result = await runUiDebugProbe();\n        setReport(result);\n        return "probe complete";\n      },\n      { captureSnapshot: true, probeOperation: true }\n    ).finally(() => setInitialProbePending(false));`,
  `    const operationRevision = clientRevisionRef.current;\n    setInitialProbePending(true);\n    void run(\n      "probe",\n      runUiDebugProbe,\n      { captureSnapshot: true, probeOperation: true }\n    ).finally(() => {\n      if (operationRevision === clientRevisionRef.current) setInitialProbePending(false);\n    });`,
);
replaceOnce(
  "src/frontend/src/app/DebugWindow.tsx",
  `                async () => {\n                  const result = await runUiDebugProbe();\n                  setReport(result);\n                  return "probe complete";\n                },`,
  `                runUiDebugProbe,`,
);
insertBeforeLast(
  "src/frontend/src/app/DebugWindow.test.tsx",
  `\n});`,
  `\n  it("drops an in-flight probe result after the adapter changes", async () => {\n    let settingsHandler: ((event: { payload: AppSettings }) => void) | undefined;\n    let resolveProbe!: (value: UiDebugReport) => void;\n    listenerMocks.bindTauriListener.mockImplementation((eventName: string, handler: (event: { payload: AppSettings }) => void, _onError?: unknown, onReady?: () => void) => {\n      if (eventName === "settings-updated") settingsHandler = handler;\n      onReady?.();\n      return () => undefined;\n    });\n    apiMocks.runUiDebugProbe.mockImplementationOnce(\n      () => new Promise<UiDebugReport>((resolve) => { resolveProbe = resolve; }),\n    );\n\n    await renderDebugWindow();\n    await waitFor(() => expect(apiMocks.runUiDebugProbe).toHaveBeenCalledOnce());\n    await act(async () => settingsHandler?.({ payload: { ...settings, selected_client: "happ" } }));\n    expect(await screen.findByText(/These tools control v2rayN only/)).toBeTruthy();\n\n    await act(async () => {\n      resolveProbe(report);\n      await Promise.resolve();\n    });\n    expect(screen.queryByText("Probe complete")).toBeNull();\n    expect((screen.getByRole("button", { name: "Open v2rayN" }) as HTMLButtonElement).disabled).toBe(true);\n  });\n`,
);

// Exact immutable action pins are part of the workflow contract, not only full-SHA syntax.
replaceOnce(
  "scripts/test-workflow-contracts.mjs",
  `const PREREQUISITES = "scripts/assert-ci-prerequisites.ps1";`,
  `const PREREQUISITES = "scripts/assert-ci-prerequisites.ps1";\nconst OFFICIAL_ACTION_PINS = new Map([\n  ["checkout", "fbc6f3992d24b796d5a048ff273f7fcc4a7b6c09"],\n  ["upload-artifact", "b7c566a772e6b6bfb58ed0dc250532a479d7789f"],\n  ["download-artifact", "37930b1c2abaa49bbe596cd826c3c89aef350131"],\n]);`,
);
replaceOnce(
  "scripts/test-workflow-contracts.mjs",
  `  for (const line of actionLines) {\n    if (!/^\\s*uses:\\s*actions\\/[^@\\s]+@[0-9a-f]{40}(?:\\s+#.*)?$/.test(line)) {\n      fail(\`${label}: official action must be pinned to a full commit SHA: ${line.trim()}\`);\n    }\n  }`,
  `  for (const line of actionLines) {\n    const match = line.match(/^\\s*uses:\\s*actions\\/([^@\\s]+)@([0-9a-f]{40})(?:\\s+#.*)?$/);\n    if (!match) {\n      fail(\`${label}: official action must be pinned to a full commit SHA: ${line.trim()}\`);\n    }\n    const expected = OFFICIAL_ACTION_PINS.get(match[1]);\n    if (expected && match[2] !== expected) {\n      fail(\`${label}: actions/${match[1]} must use approved Node 24 revision ${expected}\`);\n    }\n  }`,
);

// Keep audit documentation integrated rather than duplicating the 0030 roadmap entry.
for (const file of ["README.md", "docs/architecture.md"]) {
  let source = read(file);
  source = source.replace("\n\n\n### Final consistency audits", "\n\n## Final consistency audits");
  write(file, source);
}
replaceOnce(
  "project-tracking/roadmap/0013-proxy-client-adapter-roadmap.md",
  `- Task/report 0030 — active selected-adapter context consistency audit.\n\n\n### Final consistency audits\n\n- 0030: active selected-adapter context consistency.\n- 0031: Happ toggle lifecycle hardening.\n- 0032: auxiliary settings consistency.\n- 0033: tray/native runtime consistency.\n- 0034: asynchronous native ownership and warning-free quality gates.\n- 0035: declared-surface, accessibility, Settings close ownership and Node 24 Actions audit.`,
  `- Task/report 0030 — active selected-adapter context consistency audit.\n- Task/report 0031 — Happ toggle lifecycle hardening.\n- Task/report 0032 — auxiliary settings consistency.\n- Task/report 0033 — tray/native runtime consistency.\n- Task/report 0034 — asynchronous native ownership and warning-free quality gates.\n- Task/report 0035 — declared-surface, accessibility, Settings close ownership and Node 24 Actions audit.`,
);

console.log("0035 final diff review corrections applied");
