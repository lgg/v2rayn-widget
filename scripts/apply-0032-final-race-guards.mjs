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
  if (matches !== 1) throw new Error(`Expected exactly one match in ${path}, found ${matches}`);
  write(path, source.replace(before, after));
}

replaceExact(
  "src/frontend/src/app/SettingsWindow.tsx",
  "      } catch {\n        if (active) {\n          setLoadError(i18n.t(\"errors.settingsLoadFailed\"));\n        }\n",
  "      } catch {\n        if (active && revision === settingsRevisionRef.current) {\n          setLoadError(i18n.t(\"errors.settingsLoadFailed\"));\n        }\n",
);

replaceExact(
  "src/frontend/src/app/SettingsWindow.tsx",
  `  const applyUi = async (patch: UiSettingsPatch): Promise<void> => {\n    if (!settings || saveInProgressRef.current) {\n      return;\n    }\n\n    setSaveError(null);\n    try {\n      const saved = await uiSettingsQueueRef.current.enqueue(() => applyUiSettings(patch));\n      setSettings((prev) => (prev ? mergeUiFields(prev, saved) : saved));\n      applyTheme(saved.theme);\n      applyVisual(saved);\n      await i18n.changeLanguage(saved.language);\n    } catch {\n      setSaveError(t(\"errors.settingsSaveFailed\"));\n      const authoritative = await getSettings().catch(() => null);\n      if (authoritative) {\n        setSettings((prev) => (prev ? mergeUiFields(prev, authoritative) : authoritative));\n        applyTheme(authoritative.theme);\n        applyVisual(authoritative);\n        await i18n.changeLanguage(authoritative.language);\n      }\n    }\n  };\n`,
  `  const applyUi = async (patch: UiSettingsPatch): Promise<void> => {\n    if (!settings || saveInProgressRef.current) {\n      return;\n    }\n\n    setSaveError(null);\n    await uiSettingsQueueRef.current.enqueue(async () => {\n      const revision = settingsRevisionRef.current;\n      try {\n        const saved = await applyUiSettings(patch);\n        if (revision === settingsRevisionRef.current) {\n          setSettings((prev) => (prev ? mergeUiFields(prev, saved) : saved));\n          applyTheme(saved.theme);\n          applyVisual(saved);\n          await i18n.changeLanguage(saved.language);\n        }\n      } catch {\n        setSaveError(t(\"errors.settingsSaveFailed\"));\n        const authoritative = await getSettings().catch(() => null);\n        if (authoritative && revision === settingsRevisionRef.current) {\n          setSettings((prev) => (prev ? mergeUiFields(prev, authoritative) : authoritative));\n          applyTheme(authoritative.theme);\n          applyVisual(authoritative);\n          await i18n.changeLanguage(authoritative.language);\n        }\n      }\n    });\n  };\n`,
);

replaceExact(
  "src/frontend/src/app/SettingsWindow.tsx",
  "          <button\n            type=\"button\"\n            aria-label={t(\"common.close\")}\n            className=\"no-drag rounded-lg p-2 hover:bg-white/50 dark:hover:bg-slate-800\"\n",
  "          <button\n            type=\"button\"\n            aria-label={t(\"common.close\")}\n            disabled={busy}\n            className=\"no-drag rounded-lg p-2 hover:bg-white/50 disabled:opacity-60 dark:hover:bg-slate-800\"\n",
);

replaceExact(
  "src/frontend/src/app/SettingsWindow.tsx",
  "        <div className=\"no-drag min-h-0 flex-1 space-y-4 overflow-y-auto pr-1\">\n",
  "        <fieldset disabled={busy} className=\"contents\">\n          <div className=\"no-drag min-h-0 flex-1 space-y-4 overflow-y-auto pr-1\">\n",
);

replaceExact(
  "src/frontend/src/app/SettingsWindow.tsx",
  "          </section>\n        </div>\n\n        <footer className=\"no-drag mt-3\">\n",
  "          </section>\n          </div>\n        </fieldset>\n\n        <footer className=\"no-drag mt-3\">\n",
);

replaceExact(
  "src/frontend/src/app/HappSetupWindow.tsx",
  "      .catch((cause) => {\n        if (active) {\n          setError(backendMessage(\n",
  "      .catch((cause) => {\n        if (active && revision === settingsRevisionRef.current) {\n          setError(backendMessage(\n",
);

replaceExact(
  "src/frontend/src/app/HappSetupWindow.tsx",
  "  dirtyRef.current = dirty;\n\n  useEffect(\n",
  `  dirtyRef.current = dirty;\n\n  const updatePathDraft = (value: string): void => {\n    dirtyRef.current = settings !== null\n      && (candidateKey(value) !== candidateKey(settings.happ_path)\n        || allowUiAutomation !== settings.happ_allow_ui_automation);\n    setPath(value);\n  };\n\n  const updateConsentDraft = (value: boolean): void => {\n    dirtyRef.current = settings !== null\n      && (candidateKey(path) !== candidateKey(settings.happ_path)\n        || value !== settings.happ_allow_ui_automation);\n    setAllowUiAutomation(value);\n  };\n\n  useEffect(\n`,
);

replaceExact(
  "src/frontend/src/app/HappSetupWindow.tsx",
  "        setPath(detected);\n        setProbedCandidate(null);\n",
  "        updatePathDraft(detected);\n        setProbedCandidate(null);\n",
);

replaceExact(
  "src/frontend/src/app/HappSetupWindow.tsx",
  "        setPath(normalizedPath);\n      }\n\n      const result = await probeHappCandidate(normalizedPath);\n",
  "        updatePathDraft(normalizedPath);\n      }\n\n      const result = await probeHappCandidate(normalizedPath);\n",
);

replaceExact(
  "src/frontend/src/app/HappSetupWindow.tsx",
  "      setSettings(saved);\n      setPath(saved.happ_path ?? \"\");\n      setAllowUiAutomation(saved.happ_allow_ui_automation);\n",
  "      dirtyRef.current = false;\n      setSettings(saved);\n      setPath(saved.happ_path ?? \"\");\n      setAllowUiAutomation(saved.happ_allow_ui_automation);\n",
);

replaceExact(
  "src/frontend/src/app/HappSetupWindow.tsx",
  "            aria-label={t(\"common.close\")}\n            className=\"no-drag rounded-lg p-2 hover:bg-white/50 dark:hover:bg-slate-800\"\n",
  "            aria-label={t(\"common.close\")}\n            disabled={busy}\n            className=\"no-drag rounded-lg p-2 hover:bg-white/50 disabled:opacity-60 dark:hover:bg-slate-800\"\n",
);

replaceExact(
  "src/frontend/src/app/HappSetupWindow.tsx",
  "              value={path}\n              placeholder={t(\"happSetup.pathPlaceholder\")}\n              onChange={(event) => {\n                setPath(event.target.value);\n",
  "              value={path}\n              disabled={busy}\n              placeholder={t(\"happSetup.pathPlaceholder\")}\n              onChange={(event) => {\n                updatePathDraft(event.target.value);\n",
);

replaceExact(
  "src/frontend/src/app/HappSetupWindow.tsx",
  "                  setPath(\"\");\n                  setDiagnostics(null);\n",
  "                  updatePathDraft(\"\");\n                  setDiagnostics(null);\n",
);

replaceExact(
  "src/frontend/src/app/HappSetupWindow.tsx",
  "                onChange={(event) => setAllowUiAutomation(event.target.checked)}\n",
  "                onChange={(event) => updateConsentDraft(event.target.checked)}\n",
);

replaceExact(
  "src/frontend/src/app/SettingsWindow.test.tsx",
  "  it(\"does not let a stale initial load overwrite a newer settings event\", async () => {\n",
  `  it("waits for failed live-patch recovery before starting the full save", async () => {\n    let resolveRecovery!: (value: AppSettings) => void;\n    apiMocks.applyUiSettings.mockRejectedValueOnce(new Error("write failed"));\n    apiMocks.getSettings\n      .mockResolvedValueOnce(baseSettings)\n      .mockImplementationOnce(\n        () => new Promise<AppSettings>((resolve) => {\n          resolveRecovery = resolve;\n        }),\n      );\n\n    render(<SettingsWindow />);\n    await screen.findByRole("heading", { name: "Settings" });\n\n    fireEvent.click(screen.getByLabelText("Always on top"));\n    fireEvent.click(screen.getByLabelText("Autostart with Windows"));\n    fireEvent.click(screen.getByRole("button", { name: "Save" }));\n\n    await waitFor(() => expect(apiMocks.getSettings).toHaveBeenCalledTimes(2));\n    expect(apiMocks.updateSettings).not.toHaveBeenCalled();\n\n    await act(async () => {\n      resolveRecovery(baseSettings);\n    });\n\n    await waitFor(() => expect(apiMocks.updateSettings).toHaveBeenCalledTimes(1));\n  });\n\n  it("does not let a stale initial load overwrite a newer settings event", async () => {\n`,
);

replaceExact(
  "src/frontend/src/app/HappSetupWindow.test.tsx",
  "  it(\"does not let a stale initial load overwrite a newer settings event\", async () => {\n",
  `  it("marks a path draft immediately before an external settings event", async () => {\n    let settingsHandler: ((event: { payload: AppSettings }) => void) | undefined;\n    eventMocks.listen.mockImplementation(async (eventName: string, handler: (event: { payload: AppSettings }) => void) => {\n      if (eventName === "settings-updated") settingsHandler = handler;\n      return () => undefined;\n    });\n\n    render(<HappSetupWindow />);\n    await screen.findByRole("heading", { name: "Happ adapter setup" });\n    const pathInput = screen.getByLabelText("Executable path") as HTMLInputElement;\n\n    fireEvent.change(pathInput, { target: { value: "C:\\Draft\\Happ.exe" } });\n    await act(async () => {\n      settingsHandler?.({ payload: { ...settings, happ_path: "C:\\External\\Happ.exe" } });\n    });\n\n    expect(pathInput.value).toBe("C:\\Draft\\Happ.exe");\n  });\n\n  it("does not let a stale initial load overwrite a newer settings event", async () => {\n`,
);

replaceExact(
  "project-tracking/tasks/0032-auxiliary-settings-consistency.md",
  "- [x] Initial settings loads on all three native settings-aware auxiliary surfaces reject stale responses after a newer event.\n",
  "- [x] Initial settings loads on all three native settings-aware auxiliary surfaces reject stale responses and stale load errors after a newer event.\n- [x] Pending live-patch error recovery completes before a queued full save begins.\n- [x] Happ path/consent dirty state is updated synchronously and editable controls are disabled during probe/save.\n- [x] Settings controls and close action are disabled while a full save is in progress.\n",
);

replaceExact(
  "project-tracking/reports/0032-auxiliary-settings-consistency-report.md",
  "- queued the full Settings save behind prior live patches;\n- blocked new live-patch submission after the full save starts;\n",
  "- queued the complete live-patch workflow, including failure recovery, and placed the full Settings save behind it;\n- blocked new live-patch submission and form edits after the full save starts;\n- updated Happ dirty state synchronously and disabled path edits during probe/save;\n",
);
