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
  "  const uiSettingsQueueRef = useRef(new SerializedTaskQueue());\n",
  "  const uiSettingsQueueRef = useRef(new SerializedTaskQueue());\n  const saveInProgressRef = useRef(false);\n",
);

replaceExact(
  "src/frontend/src/app/SettingsWindow.tsx",
  "  const applyUi = async (patch: UiSettingsPatch): Promise<void> => {\n    if (!settings) {\n      return;\n    }\n",
  "  const applyUi = async (patch: UiSettingsPatch): Promise<void> => {\n    if (!settings || saveInProgressRef.current) {\n      return;\n    }\n",
);

replaceExact(
  "src/frontend/src/app/SettingsWindow.tsx",
  "  const onSave = async (): Promise<void> => {\n    if (!settings) {\n      return;\n    }\n\n    setBusy(true);\n",
  "  const onSave = async (): Promise<void> => {\n    if (!settings || saveInProgressRef.current) {\n      return;\n    }\n\n    saveInProgressRef.current = true;\n    setBusy(true);\n",
);

replaceExact(
  "src/frontend/src/app/SettingsWindow.tsx",
  "      const saved = await updateSettings(next);\n",
  "      const saved = await uiSettingsQueueRef.current.enqueue(() => updateSettings(next));\n",
);

replaceExact(
  "src/frontend/src/app/SettingsWindow.tsx",
  "    } finally {\n      setBusy(false);\n    }\n  };\n",
  "    } finally {\n      saveInProgressRef.current = false;\n      setBusy(false);\n    }\n  };\n",
);

replaceExact(
  "src/frontend/src/app/HappSetupWindow.tsx",
  "import { bindTauriListener } from \"@/lib/tauri-listener\";\n",
  "import { applySurfaceSettings } from \"@/lib/surface-settings\";\nimport { bindTauriListener } from \"@/lib/tauri-listener\";\n",
);

replaceExact(
  "src/frontend/src/app/HappSetupWindow.tsx",
  "      .then((loaded) => {\n        if (!active) {\n          return;\n        }\n        setSettings(loaded);\n        setPath(loaded.happ_path ?? \"\");\n        setAllowUiAutomation(loaded.happ_allow_ui_automation);\n      })\n",
  "      .then(async (loaded) => {\n        if (!active) {\n          return;\n        }\n        await applySurfaceSettings(loaded);\n        if (!active) {\n          return;\n        }\n        setSettings(loaded);\n        setPath(loaded.happ_path ?? \"\");\n        setAllowUiAutomation(loaded.happ_allow_ui_automation);\n      })\n",
);

replaceExact(
  "src/frontend/src/app/HappSetupWindow.tsx",
  "  }, [i18n, loadAttempt]);\n\n  const dirty = settings !== null\n",
  "  }, [i18n, loadAttempt]);\n\n  useEffect(\n    () =>\n      bindTauriListener<AppSettings>(\"settings-updated\", (event) => {\n        setSettings(event.payload);\n        if (!dirtyRef.current) {\n          setPath(event.payload.happ_path ?? \"\");\n          setAllowUiAutomation(event.payload.happ_allow_ui_automation);\n          setDiagnostics(null);\n          setProbedCandidate(null);\n        }\n        void applySurfaceSettings(event.payload);\n      }),\n    [],\n  );\n\n  const dirty = settings !== null\n",
);

replaceExact(
  "src/frontend/src/app/DebugWindow.tsx",
  "  debugToggleViaUiOnly,\n  openV2RayN,\n",
  "  debugToggleViaUiOnly,\n  getSettings,\n  openV2RayN,\n",
);

replaceExact(
  "src/frontend/src/app/DebugWindow.tsx",
  "import { bindTauriListener } from \"@/lib/tauri-listener\";\nimport type { DebugRuntimeSnapshot, UiDebugReport } from \"@/lib/types\";\n",
  "import { applySurfaceSettings } from \"@/lib/surface-settings\";\nimport { bindTauriListener } from \"@/lib/tauri-listener\";\nimport type { AppSettings, DebugRuntimeSnapshot, UiDebugReport } from \"@/lib/types\";\n",
);

replaceExact(
  "src/frontend/src/app/DebugWindow.tsx",
  "  useEffect(() => {\n    void run(\n",
  "  useEffect(() => {\n    let active = true;\n    void getSettings()\n      .then((settings) => (active ? applySurfaceSettings(settings) : undefined))\n      .catch(() => undefined);\n    return () => {\n      active = false;\n    };\n  }, []);\n\n  useEffect(\n    () =>\n      bindTauriListener<AppSettings>(\"settings-updated\", (event) => {\n        void applySurfaceSettings(event.payload);\n      }),\n    [],\n  );\n\n  useEffect(() => {\n    void run(\n",
);

replaceExact(
  "src/frontend/src/app/SettingsWindow.test.tsx",
  "  it(\"leaves the loading state and shows an error when settings cannot load\", async () => {\n",
  "  it(\"serializes the full save after pending live UI writes\", async () => {\n    let resolveLiveWrite!: (value: AppSettings) => void;\n    apiMocks.applyUiSettings.mockImplementationOnce(\n      () => new Promise<AppSettings>((resolve) => {\n        resolveLiveWrite = resolve;\n      }),\n    );\n\n    render(<SettingsWindow />);\n    await screen.findByRole(\"heading\", { name: \"Settings\" });\n\n    fireEvent.click(screen.getByLabelText(\"Always on top\"));\n    fireEvent.click(screen.getByLabelText(\"Autostart with Windows\"));\n    fireEvent.click(screen.getByRole(\"button\", { name: \"Save\" }));\n\n    await waitFor(() => expect(apiMocks.applyUiSettings).toHaveBeenCalledTimes(1));\n    expect(apiMocks.updateSettings).not.toHaveBeenCalled();\n\n    await act(async () => {\n      resolveLiveWrite({ ...baseSettings, always_on_top: true });\n    });\n\n    await waitFor(() => expect(apiMocks.updateSettings).toHaveBeenCalledTimes(1));\n    expect(apiMocks.updateSettings.mock.calls[0][0]).toMatchObject({\n      always_on_top: true,\n      autostart_with_windows: true,\n    });\n    expect(apiMocks.applyUiSettings.mock.invocationCallOrder[0]).toBeLessThan(\n      apiMocks.updateSettings.mock.invocationCallOrder[0],\n    );\n  });\n\n  it(\"leaves the loading state and shows an error when settings cannot load\", async () => {\n",
);

replaceExact(
  "src/frontend/src/app/HappSetupWindow.test.tsx",
  "    eventMocks.listen.mockImplementation(async (_event: string, handler: () => void) => {\n      closeHandler = handler;\n      return () => undefined;\n    });\n",
  "    eventMocks.listen.mockImplementation(async (eventName: string, handler: () => void) => {\n      if (eventName === \"happ-setup-close-requested\") {\n        closeHandler = handler;\n      }\n      return () => undefined;\n    });\n",
);

replaceExact(
  "src/frontend/src/app/HappSetupWindow.test.tsx",
  "  it(\"leaves loading and shows an error when settings cannot load\", async () => {\n",
  "  it(\"applies saved surface settings and preserves a dirty draft across external updates\", async () => {\n    let settingsHandler: ((event: { payload: AppSettings }) => void) | undefined;\n    eventMocks.listen.mockImplementation(async (eventName: string, handler: (event: { payload: AppSettings }) => void) => {\n      if (eventName === \"settings-updated\") {\n        settingsHandler = handler;\n      }\n      return () => undefined;\n    });\n    apiMocks.getSettings.mockResolvedValueOnce({\n      ...settings,\n      language: \"ru\",\n      theme: \"light\",\n      window_effect_enabled: false,\n      window_opacity_percent: 73,\n    });\n\n    render(<HappSetupWindow />);\n    await waitFor(() => expect(i18n.language).toBe(\"ru\"));\n    expect(document.documentElement.classList.contains(\"dark\")).toBe(false);\n    expect(document.documentElement.style.getPropertyValue(\"--widget-opacity\")).toBe(\"0.73\");\n    expect(document.body.classList.contains(\"widget-effect-disabled\")).toBe(true);\n\n    const pathInput = screen.getByLabelText(\"Путь к исполняемому файлу\") as HTMLInputElement;\n    fireEvent.change(pathInput, { target: { value: \"C:\\\\Draft\\\\Happ.exe\" } });\n\n    await act(async () => {\n      settingsHandler?.({\n        payload: {\n          ...settings,\n          language: \"en\",\n          theme: \"dark\",\n          happ_path: \"C:\\\\External\\\\Happ.exe\",\n        },\n      });\n    });\n\n    await waitFor(() => expect(i18n.language).toBe(\"en\"));\n    expect(document.documentElement.classList.contains(\"dark\")).toBe(true);\n    expect(pathInput.value).toBe(\"C:\\\\Draft\\\\Happ.exe\");\n  });\n\n  it(\"leaves loading and shows an error when settings cannot load\", async () => {\n",
);

replaceExact(
  "src/frontend/src/app/HappSetupWindow.test.tsx",
  "  afterEach(async () => {\n    await i18n.changeLanguage(\"en\");\n  });\n",
  "  afterEach(async () => {\n    await i18n.changeLanguage(\"en\");\n    document.documentElement.classList.remove(\"dark\");\n    document.documentElement.style.removeProperty(\"--widget-opacity\");\n    document.body.classList.remove(\"widget-effect-disabled\");\n  });\n",
);

replaceExact(
  "src/frontend/src/app/DebugWindow.test.tsx",
  "import { beforeEach, describe, expect, it, vi } from \"vitest\";\nimport type { DebugRuntimeSnapshot, UiDebugReport } from \"@/lib/types\";\nimport \"@/lib/i18n\";\n",
  "import { afterEach, beforeEach, describe, expect, it, vi } from \"vitest\";\nimport type { AppSettings, DebugRuntimeSnapshot, UiDebugReport } from \"@/lib/types\";\nimport i18n from \"@/lib/i18n\";\n",
);

replaceExact(
  "src/frontend/src/app/DebugWindow.test.tsx",
  "  debugToggleViaUiOnly: vi.fn(),\n  openV2RayN: vi.fn(),\n",
  "  debugToggleViaUiOnly: vi.fn(),\n  getSettings: vi.fn(),\n  openV2RayN: vi.fn(),\n",
);

replaceExact(
  "src/frontend/src/app/DebugWindow.test.tsx",
  "const snapshot: DebugRuntimeSnapshot = {\n",
  "const settings: AppSettings = {\n  selected_client: \"v2rayn\",\n  language: \"en\",\n  theme: \"dark\",\n  always_on_top: false,\n  autostart_with_windows: false,\n  allow_restart_fallback: false,\n  poll_interval_sec: 10,\n  time_format: \"24h\",\n  show_clock: true,\n  show_info_status: true,\n  show_external_ip: true,\n  show_latency: true,\n  mock_mode_enabled: false,\n  show_action_buttons: true,\n  show_profile_selector: true,\n  window_effect_enabled: true,\n  window_opacity_percent: 92,\n  diagnostics_enabled: false,\n  diagnostics_url: \"https://ipleak.net/\",\n  latency_mode: \"active\",\n  connectivity_endpoints: [],\n  ip_endpoints: [],\n  v2rayn_path_mode: \"auto\",\n  v2rayn_path: null,\n  happ_path: null,\n  happ_allow_ui_automation: false,\n  window_position: null,\n};\n\nconst snapshot: DebugRuntimeSnapshot = {\n",
);

replaceExact(
  "src/frontend/src/app/DebugWindow.test.tsx",
  "describe(\"DebugWindow\", () => {\n  beforeEach(() => {\n    vi.clearAllMocks();\n    listenerMocks.bindTauriListener.mockReturnValue(() => undefined);\n    apiMocks.closeWindow.mockResolvedValue(true);\n    apiMocks.debugCaptureRuntimeSnapshot.mockResolvedValue(snapshot);\n    apiMocks.runUiDebugProbe.mockResolvedValue(report);\n  });\n",
  "describe(\"DebugWindow\", () => {\n  beforeEach(async () => {\n    vi.clearAllMocks();\n    await i18n.changeLanguage(\"en\");\n    document.documentElement.classList.remove(\"dark\");\n    document.documentElement.style.removeProperty(\"--widget-opacity\");\n    document.body.classList.remove(\"widget-effect-disabled\");\n    listenerMocks.bindTauriListener.mockReturnValue(() => undefined);\n    apiMocks.closeWindow.mockResolvedValue(true);\n    apiMocks.getSettings.mockResolvedValue(settings);\n    apiMocks.debugCaptureRuntimeSnapshot.mockResolvedValue(snapshot);\n    apiMocks.runUiDebugProbe.mockResolvedValue(report);\n  });\n\n  afterEach(async () => {\n    await i18n.changeLanguage(\"en\");\n    document.documentElement.classList.remove(\"dark\");\n    document.documentElement.style.removeProperty(\"--widget-opacity\");\n    document.body.classList.remove(\"widget-effect-disabled\");\n  });\n",
);

replaceExact(
  "src/frontend/src/app/DebugWindow.test.tsx",
  "  it(\"routes a native close request through the shared safe close API\", async () => {\n",
  "  it(\"applies persisted settings and reacts to settings-updated events\", async () => {\n    let settingsHandler: ((event: { payload: AppSettings }) => void) | undefined;\n    listenerMocks.bindTauriListener.mockImplementation((eventName: string, handler: (event: { payload: AppSettings }) => void) => {\n      if (eventName === \"settings-updated\") {\n        settingsHandler = handler;\n      }\n      return () => undefined;\n    });\n    apiMocks.getSettings.mockResolvedValueOnce({\n      ...settings,\n      language: \"ru\",\n      theme: \"light\",\n      window_effect_enabled: false,\n      window_opacity_percent: 64,\n    });\n\n    render(<DebugWindow />);\n    await waitFor(() => expect(i18n.language).toBe(\"ru\"));\n    expect(document.documentElement.classList.contains(\"dark\")).toBe(false);\n    expect(document.documentElement.style.getPropertyValue(\"--widget-opacity\")).toBe(\"0.64\");\n    expect(document.body.classList.contains(\"widget-effect-disabled\")).toBe(true);\n\n    await act(async () => {\n      settingsHandler?.({ payload: { ...settings, language: \"en\", theme: \"dark\" } });\n    });\n\n    await waitFor(() => expect(i18n.language).toBe(\"en\"));\n    expect(document.documentElement.classList.contains(\"dark\")).toBe(true);\n  });\n\n  it(\"routes a native close request through the shared safe close API\", async () => {\n",
);

write(
  "src/frontend/src/lib/surface-settings.ts",
  `import i18n from "@/lib/i18n";\nimport type { AppSettings } from "@/lib/types";\n\nexport async function applySurfaceSettings(settings: AppSettings): Promise<void> {\n  const root = document.documentElement;\n  const body = document.body;\n  const opacity = Math.max(10, Math.min(100, Math.round(settings.window_opacity_percent)));\n\n  root.classList.toggle("dark", settings.theme === "dark");\n  root.style.setProperty("--widget-opacity", String(opacity / 100));\n  body.classList.toggle("widget-effect-disabled", !settings.window_effect_enabled);\n  await i18n.changeLanguage(settings.language);\n}\n`,
);

replaceExact(
  "docs/architecture.md",
  "- render Settings, Debug and Happ Setup windows;\n- dispose asynchronous Tauri event registrations safely;\n",
  "- render Settings, Debug and Happ Setup windows;\n- bootstrap persisted language/theme/visual settings in every native React surface and subscribe auxiliary surfaces to later settings events;\n- preserve Happ Setup path/consent drafts while applying external language and visual updates;\n- serialize the full Settings save behind pending live UI patches so an older patch cannot roll back a completed save;\n- dispose asynchronous Tauri event registrations safely;\n",
);

write(
  "project-tracking/tasks/0032-auxiliary-settings-consistency.md",
  `# 0032 - Auxiliary Settings Consistency\n\n## Status\n\nImplementation in progress on \`audit/0032-auxiliary-settings-consistency\`.\n\n## Audited baseline\n\n\`main\` commit \`4b1dcc74b2bc558fed27d450d873682231a5ad85\`.\n\n## Confirmed findings\n\n1. Happ Setup loaded adapter values but did not apply persisted language, theme, opacity or visual-effect settings and did not react to later settings events.\n2. Debug Tools started from browser language/default DOM styling and likewise ignored persisted and live application settings.\n3. Full Settings persistence bypassed the serialized live-patch queue, allowing a pending older \`apply_ui_settings\` request to complete after \`update_settings\` and roll back one live field.\n\n## Objective\n\nMake all native React surfaces honor one persisted application appearance/language state while preserving unsaved drafts, and make Settings persistence linearizable across live patches and full saves.\n\n## Acceptance criteria\n\n- [x] Happ Setup applies persisted language, theme, opacity and effect settings during load.\n- [x] Happ Setup reacts to settings-updated events without discarding an unsaved path/consent draft.\n- [x] Clean Happ Setup state follows externally changed Happ path/consent values.\n- [x] Debug Tools applies persisted surface settings during load.\n- [x] Debug Tools reacts to settings-updated events.\n- [x] Full Settings save waits behind all previously queued live UI writes.\n- [x] Live UI writes are not enqueued after a full save begins.\n- [x] Regression tests cover both auxiliary surfaces and the live-patch/full-save ordering.\n- [ ] Exact-head frontend and Rust Release Quality gates pass.\n- [ ] PR is squash-merged and final evidence is recorded.\n`,
);

write(
  "project-tracking/reports/0032-auxiliary-settings-consistency-report.md",
  `# 0032 - Auxiliary Settings Consistency Audit Report\n\n## Status\n\nImplementation in progress.\n\n## Audit method\n\nThe audit rechecked Main, Settings, Happ Setup, Debug Tools and Diagnostics from rendered controls through settings ownership, asynchronous persistence, Tauri events and backend commands. It specifically compared the documented application-wide language/visual settings with the initialization and update behavior of every native React webview.\n\n## Confirmed defects\n\n1. **Happ Setup appearance/language drift.** The window fetched settings only to populate Happ fields; it never applied persisted theme/language/opacity/effect values and did not subscribe to settings updates.\n2. **Debug Tools appearance/language drift.** The screen did not fetch application settings at all and remained on browser-language/default DOM styling.\n3. **Non-linearizable Settings save.** Live UI patches were serialized with each other, but the full save bypassed that queue. A slower older patch could therefore persist after the full save and roll back one field.\n\n## Corrections implemented\n\n- added a shared auxiliary-surface settings applicator for language, theme, opacity and visual effects;\n- applied it during Happ Setup and Debug Tools initialization;\n- subscribed both auxiliary surfaces to settings-updated events;\n- preserved Happ Setup local path/consent input while a draft is dirty;\n- synchronized clean Happ Setup input to authoritative external changes;\n- queued the full Settings save behind prior live patches;\n- blocked new live-patch submission after the full save starts;\n- added regression coverage for persisted/live auxiliary settings and save ordering.\n\n## Screen and capability audit\n\nNo capability state was promoted or broadened. Main remains selected-adapter/capability gated; Settings remains the owner of general and v2rayN fields; Happ Setup remains the owner of Happ path and explicit consent; Debug Tools remains v2rayN-specific; Diagnostics remains an external webview without default Tauri IPC capability.\n\n## Verification status\n\nPending exact-head Release Quality.\n`,
);
