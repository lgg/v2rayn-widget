import fs from "node:fs";

function read(path) {
  return fs.readFileSync(path, "utf8").replaceAll("\r\n", "\n");
}

function write(path, content) {
  fs.writeFileSync(path, content.replaceAll("\r\n", "\n"), "utf8");
}

function replaceExact(path, before, after) {
  const source = read(path);
  const matches = source.split(before).length - 1;
  if (matches !== 1) {
    throw new Error(`Expected exactly one match in ${path}, found ${matches}`);
  }
  write(path, source.replace(before, after));
}

replaceExact(
  "src/frontend/src/app/SettingsWindow.tsx",
  "  const saveInProgressRef = useRef(false);\n",
  "  const saveInProgressRef = useRef(false);\n  const settingsRevisionRef = useRef(0);\n",
);

replaceExact(
  "src/frontend/src/app/SettingsWindow.tsx",
  "  useEffect(() => {\n    let active = true;\n\n    const load = async (): Promise<void> => {\n",
  "  useEffect(() => {\n    let active = true;\n    const revision = settingsRevisionRef.current;\n\n    const load = async (): Promise<void> => {\n",
);

replaceExact(
  "src/frontend/src/app/SettingsWindow.tsx",
  "        if (!active) {\n          return;\n        }\n        setSettings(nextSettings);\n",
  "        if (!active || revision !== settingsRevisionRef.current) {\n          return;\n        }\n        setSettings(nextSettings);\n",
);

replaceExact(
  "src/frontend/src/app/SettingsWindow.tsx",
  "      bindTauriListener<AppSettings>(\"settings-updated\", (event) => {\n        setSettings((prev) => {\n",
  "      bindTauriListener<AppSettings>(\"settings-updated\", (event) => {\n        settingsRevisionRef.current += 1;\n        setSettings((prev) => {\n",
);

replaceExact(
  "src/frontend/src/app/HappSetupWindow.tsx",
  "  const dirtyRef = useRef(false);\n",
  "  const dirtyRef = useRef(false);\n  const settingsRevisionRef = useRef(0);\n",
);

replaceExact(
  "src/frontend/src/app/HappSetupWindow.tsx",
  "  useEffect(() => {\n    let active = true;\n    setLoading(true);\n",
  "  useEffect(() => {\n    let active = true;\n    const revision = settingsRevisionRef.current;\n    setLoading(true);\n",
);

replaceExact(
  "src/frontend/src/app/HappSetupWindow.tsx",
  "        if (!active) {\n          return;\n        }\n        await applySurfaceSettings(loaded);\n        if (!active) {\n",
  "        if (!active || revision !== settingsRevisionRef.current) {\n          return;\n        }\n        await applySurfaceSettings(loaded);\n        if (!active || revision !== settingsRevisionRef.current) {\n",
);

replaceExact(
  "src/frontend/src/app/HappSetupWindow.tsx",
  "      bindTauriListener<AppSettings>(\"settings-updated\", (event) => {\n        setSettings(event.payload);\n",
  "      bindTauriListener<AppSettings>(\"settings-updated\", (event) => {\n        settingsRevisionRef.current += 1;\n        setSettings(event.payload);\n",
);

replaceExact(
  "src/frontend/src/app/DebugWindow.tsx",
  "import { useEffect, useState } from \"react\";\n",
  "import { useEffect, useRef, useState } from \"react\";\n",
);

replaceExact(
  "src/frontend/src/app/DebugWindow.tsx",
  "  const [profileNameInput, setProfileNameInput] = useState(\"\");\n",
  "  const [profileNameInput, setProfileNameInput] = useState(\"\");\n  const settingsRevisionRef = useRef(0);\n",
);

replaceExact(
  "src/frontend/src/app/DebugWindow.tsx",
  "  useEffect(() => {\n    let active = true;\n    void getSettings()\n      .then((settings) => (active ? applySurfaceSettings(settings) : undefined))\n      .catch(() => undefined);\n",
  "  useEffect(() => {\n    let active = true;\n    const revision = settingsRevisionRef.current;\n    void getSettings()\n      .then((settings) =>\n        active && revision === settingsRevisionRef.current\n          ? applySurfaceSettings(settings)\n          : undefined,\n      )\n      .catch(() => undefined);\n",
);

replaceExact(
  "src/frontend/src/app/DebugWindow.tsx",
  "      bindTauriListener<AppSettings>(\"settings-updated\", (event) => {\n        void applySurfaceSettings(event.payload);\n",
  "      bindTauriListener<AppSettings>(\"settings-updated\", (event) => {\n        settingsRevisionRef.current += 1;\n        void applySurfaceSettings(event.payload);\n",
);

replaceExact(
  "src/frontend/src/app/SettingsWindow.test.tsx",
  "  it(\"leaves the loading state and shows an error when settings cannot load\", async () => {\n",
  "  it(\"does not let a stale initial load overwrite a newer settings event\", async () => {\n    let resolveSettings!: (value: AppSettings) => void;\n    let settingsHandler: ((event: { payload: AppSettings }) => void) | undefined;\n    apiMocks.getSettings.mockImplementationOnce(\n      () => new Promise<AppSettings>((resolve) => {\n        resolveSettings = resolve;\n      }),\n    );\n    eventMocks.listen.mockImplementation(async (eventName: string, handler: (event: { payload: AppSettings }) => void) => {\n      if (eventName === \"settings-updated\") {\n        settingsHandler = handler;\n      }\n      return () => undefined;\n    });\n\n    render(<SettingsWindow />);\n    await waitFor(() => expect(settingsHandler).toBeDefined());\n\n    await act(async () => {\n      settingsHandler?.({ payload: { ...baseSettings, theme: \"light\" } });\n      resolveSettings(baseSettings);\n    });\n\n    await screen.findByRole(\"heading\", { name: \"Settings\" });\n    expect(document.documentElement.classList.contains(\"dark\")).toBe(false);\n  });\n\n  it(\"leaves the loading state and shows an error when settings cannot load\", async () => {\n",
);

replaceExact(
  "src/frontend/src/app/HappSetupWindow.test.tsx",
  "  it(\"leaves loading and shows an error when settings cannot load\", async () => {\n",
  "  it(\"does not let a stale initial load overwrite a newer settings event\", async () => {\n    let resolveSettings!: (value: AppSettings) => void;\n    let settingsHandler: ((event: { payload: AppSettings }) => void) | undefined;\n    apiMocks.getSettings.mockImplementationOnce(\n      () => new Promise<AppSettings>((resolve) => {\n        resolveSettings = resolve;\n      }),\n    );\n    eventMocks.listen.mockImplementation(async (eventName: string, handler: (event: { payload: AppSettings }) => void) => {\n      if (eventName === \"settings-updated\") {\n        settingsHandler = handler;\n      }\n      return () => undefined;\n    });\n\n    render(<HappSetupWindow />);\n    await waitFor(() => expect(settingsHandler).toBeDefined());\n\n    const external = {\n      ...settings,\n      theme: \"light\" as const,\n      happ_path: \"C:\\\\External\\\\Happ.exe\",\n    };\n    await act(async () => {\n      settingsHandler?.({ payload: external });\n      resolveSettings(settings);\n    });\n\n    await screen.findByRole(\"heading\", { name: \"Happ adapter setup\" });\n    expect((screen.getByLabelText(\"Executable path\") as HTMLInputElement).value).toBe(external.happ_path);\n    expect(document.documentElement.classList.contains(\"dark\")).toBe(false);\n  });\n\n  it(\"leaves loading and shows an error when settings cannot load\", async () => {\n",
);

replaceExact(
  "src/frontend/src/app/DebugWindow.test.tsx",
  "  it(\"routes a native close request through the shared safe close API\", async () => {\n",
  "  it(\"does not let a stale initial load overwrite a newer settings event\", async () => {\n    let resolveSettings!: (value: AppSettings) => void;\n    let settingsHandler: ((event: { payload: AppSettings }) => void) | undefined;\n    apiMocks.getSettings.mockImplementationOnce(\n      () => new Promise<AppSettings>((resolve) => {\n        resolveSettings = resolve;\n      }),\n    );\n    listenerMocks.bindTauriListener.mockImplementation((eventName: string, handler: (event: { payload: AppSettings }) => void) => {\n      if (eventName === \"settings-updated\") {\n        settingsHandler = handler;\n      }\n      return () => undefined;\n    });\n\n    render(<DebugWindow />);\n    await waitFor(() => expect(settingsHandler).toBeDefined());\n\n    await act(async () => {\n      settingsHandler?.({ payload: { ...settings, theme: \"dark\" } });\n      resolveSettings({ ...settings, theme: \"light\" });\n    });\n\n    await waitFor(() => expect(document.documentElement.classList.contains(\"dark\")).toBe(true));\n  });\n\n  it(\"routes a native close request through the shared safe close API\", async () => {\n",
);

replaceExact(
  "project-tracking/tasks/0032-auxiliary-settings-consistency.md",
  "3. Full Settings persistence bypassed the serialized live-patch queue, allowing a pending older `apply_ui_settings` request to complete after `update_settings` and roll back one live field.\n",
  "3. Full Settings persistence bypassed the serialized live-patch queue, allowing a pending older `apply_ui_settings` request to complete after `update_settings` and roll back one live field.\n4. Settings, Happ Setup and Debug Tools could accept a newer `settings-updated` event while their initial `getSettings()` request was pending, then overwrite it with the late stale response.\n",
);

replaceExact(
  "project-tracking/tasks/0032-auxiliary-settings-consistency.md",
  "- [x] Regression tests cover both auxiliary surfaces and the live-patch/full-save ordering.\n",
  "- [x] Initial settings loads on all three native settings-aware auxiliary surfaces reject stale responses after a newer event.\n- [x] Regression tests cover auxiliary surfaces, stale initialization and live-patch/full-save ordering.\n",
);

replaceExact(
  "project-tracking/reports/0032-auxiliary-settings-consistency-report.md",
  "3. **Non-linearizable Settings save.** Live UI patches were serialized with each other, but the full save bypassed that queue. A slower older patch could therefore persist after the full save and roll back one field.\n",
  "3. **Non-linearizable Settings save.** Live UI patches were serialized with each other, but the full save bypassed that queue. A slower older patch could therefore persist after the full save and roll back one field.\n4. **Stale initialization could beat a newer event.** Settings, Happ Setup and Debug Tools had no request revision guard around their initial settings fetch, so a late old response could overwrite a newer `settings-updated` event.\n",
);

replaceExact(
  "project-tracking/reports/0032-auxiliary-settings-consistency-report.md",
  "- added regression coverage for persisted/live auxiliary settings and save ordering.\n",
  "- added settings-event revision guards to all three affected initial loads;\n- added regression coverage for persisted/live auxiliary settings, stale initialization and save ordering.\n",
);
