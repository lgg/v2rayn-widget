import fs from "node:fs";
import path from "node:path";

function read(file) {
  return fs.readFileSync(file, "utf8").replace(/\r\n/g, "\n");
}
function write(file, content) {
  fs.writeFileSync(file, content);
}
function replaceOnce(file, before, after) {
  const source = read(file);
  const at = source.indexOf(before);
  if (at < 0) throw new Error(`Missing expected block in ${file}: ${before.slice(0, 120)}`);
  if (source.indexOf(before, at + before.length) >= 0) throw new Error(`Expected unique block in ${file}`);
  write(file, source.slice(0, at) + after + source.slice(at + before.length));
}
function insertBeforeLast(file, marker, addition) {
  const source = read(file);
  const at = source.lastIndexOf(marker);
  if (at < 0) throw new Error(`Missing final marker in ${file}`);
  write(file, source.slice(0, at) + addition + source.slice(at));
}

// Queue ownership.
replaceOnce(
  "src/frontend/src/lib/serialized-task-queue.ts",
  `    return run;\n  }\n}`,
  `    return run;\n  }\n\n  waitForIdle(): Promise<void> {\n    return this.tail;\n  }\n}`,
);
insertBeforeLast(
  "src/frontend/src/lib/serialized-task-queue.test.ts",
  `\n});`,
  `\n  it("waits until the current tail settles", async () => {\n    let resolveTask!: () => void;\n    const queue = new SerializedTaskQueue();\n    queue.enqueue(\n      () =>\n        new Promise<void>((resolve) => {\n          resolveTask = resolve;\n        }),\n    );\n\n    let idle = false;\n    const waiting = queue.waitForIdle().then(() => {\n      idle = true;\n    });\n    await Promise.resolve();\n    expect(idle).toBe(false);\n\n    resolveTask();\n    await waiting;\n    expect(idle).toBe(true);\n  });\n`,
);

// Settings live-write ownership and close barrier.
replaceOnce(
  "src/frontend/src/app/SettingsWindow.tsx",
  `  const settingsRevisionRef = useRef(0);\n  const [settingsListenerSettled, setSettingsListenerSettled] = useState(false);`,
  `  const settingsRevisionRef = useRef(0);\n  const authoritativeSettingsRef = useRef<AppSettings | null>(null);\n  const liveWriteFailedRef = useRef(false);\n  const closingRef = useRef(false);\n  const [closing, setClosing] = useState(false);\n  const [settingsListenerSettled, setSettingsListenerSettled] = useState(false);`,
);
replaceOnce(
  "src/frontend/src/app/SettingsWindow.tsx",
  `        setSettings(nextSettings);\n        setLocales(nextLocales);`,
  `        authoritativeSettingsRef.current = nextSettings;\n        liveWriteFailedRef.current = false;\n        setSettings(nextSettings);\n        setLocales(nextLocales);`,
);
replaceOnce(
  "src/frontend/src/app/SettingsWindow.tsx",
  `        settingsRevisionRef.current += 1;\n        setLoading(false);\n        setLoadError(null);`,
  `        settingsRevisionRef.current += 1;\n        authoritativeSettingsRef.current = event.payload;\n        liveWriteFailedRef.current = false;\n        setLoading(false);\n        setLoadError(null);\n        setSaveError(null);`,
);
replaceOnce(
  "src/frontend/src/app/SettingsWindow.tsx",
  `      bindTauriListener("settings-close-requested", () => {\n        if (draftDirtyRef.current) {\n          setConfirmDiscardOpen(true);\n        } else {\n          void closeSettingsWindow();\n        }\n      }),`,
  `      bindTauriListener("settings-close-requested", () => {\n        void requestClose();\n      }),`,
);
replaceOnce(
  "src/frontend/src/app/SettingsWindow.tsx",
  `        const saved = await applyUiSettings(patch);\n        if (revision === settingsRevisionRef.current) {`,
  `        const saved = await applyUiSettings(patch);\n        authoritativeSettingsRef.current = saved;\n        liveWriteFailedRef.current = false;\n        if (revision === settingsRevisionRef.current) {`,
);
replaceOnce(
  "src/frontend/src/app/SettingsWindow.tsx",
  `        const authoritative = await getSettings().catch(() => null);\n        if (authoritative && revision === settingsRevisionRef.current) {\n          setSettings((prev) => (prev ? mergeUiFields(prev, authoritative) : authoritative));\n          applyTheme(authoritative.theme);\n          applyVisual(authoritative);\n          await i18n.changeLanguage(authoritative.language);\n        }`,
  `        const authoritative = await getSettings().catch(() => null);\n        if (authoritative && revision === settingsRevisionRef.current) {\n          authoritativeSettingsRef.current = authoritative;\n          liveWriteFailedRef.current = false;\n          setSettings((prev) => (prev ? mergeUiFields(prev, authoritative) : authoritative));\n          applyTheme(authoritative.theme);\n          applyVisual(authoritative);\n          await i18n.changeLanguage(authoritative.language);\n          return;\n        }\n\n        liveWriteFailedRef.current = true;\n        const fallback = authoritativeSettingsRef.current;\n        if (fallback && revision === settingsRevisionRef.current) {\n          setSettings((prev) => (prev ? mergeUiFields(prev, fallback) : fallback));\n          applyTheme(fallback.theme);\n          applyVisual(fallback);\n          await i18n.changeLanguage(fallback.language);\n        }`,
);
replaceOnce(
  "src/frontend/src/app/SettingsWindow.tsx",
  `      const saved = await uiSettingsQueueRef.current.enqueue(() => updateSettings(next));\n      setSettings(saved);\n      updateDraftDirty(false);`,
  `      const saved = await uiSettingsQueueRef.current.enqueue(() => updateSettings(next));\n      authoritativeSettingsRef.current = saved;\n      liveWriteFailedRef.current = false;\n      setSettings(saved);\n      updateDraftDirty(false);`,
);
replaceOnce(
  "src/frontend/src/app/SettingsWindow.tsx",
  `  const requestClose = async (): Promise<void> => {\n    if (draftDirty) {\n      setConfirmDiscardOpen(true);\n      return;\n    }\n\n    await closeSettingsWindow();\n  };`,
  `  async function requestClose(): Promise<void> {\n    if (closingRef.current) {\n      return;\n    }\n\n    closingRef.current = true;\n    setClosing(true);\n    try {\n      await uiSettingsQueueRef.current.waitForIdle();\n      if (liveWriteFailedRef.current) {\n        setSaveError(t("errors.settingsSaveFailed"));\n        return;\n      }\n      if (draftDirtyRef.current) {\n        setConfirmDiscardOpen(true);\n        return;\n      }\n\n      await closeSettingsWindow();\n    } finally {\n      closingRef.current = false;\n      setClosing(false);\n    }\n  }`,
);
replaceOnce(
  "src/frontend/src/app/SettingsWindow.tsx",
  `            disabled={busy}`,
  `            disabled={busy || closing}`,
);
replaceOnce(
  "src/frontend/src/app/SettingsWindow.tsx",
  `<fieldset disabled={busy} className="contents">`,
  `<fieldset disabled={busy || closing || confirmDiscardOpen} className="contents">`,
);
replaceOnce(
  "src/frontend/src/app/SettingsWindow.tsx",
  `<button type="button" disabled={busy} className="w-full rounded-xl bg-accent px-3 py-2 font-medium text-white" onClick={() => void onSave()}>`,
  `<button type="button" disabled={busy || closing} className="w-full rounded-xl bg-accent px-3 py-2 font-medium text-white" onClick={() => void onSave()}>`,
);

insertBeforeLast(
  "src/frontend/src/app/SettingsWindow.test.tsx",
  `\n});`,
  `\n  it("waits for a pending live write before closing", async () => {\n    let resolveLiveWrite!: (value: AppSettings) => void;\n    apiMocks.applyUiSettings.mockImplementationOnce(\n      () => new Promise<AppSettings>((resolve) => { resolveLiveWrite = resolve; }),\n    );\n\n    render(<SettingsWindow />);\n    await screen.findByRole("heading", { name: "Settings" });\n    fireEvent.click(screen.getByLabelText("Always on top"));\n    fireEvent.click(screen.getByRole("button", { name: "Close" }));\n\n    await waitFor(() => expect(apiMocks.applyUiSettings).toHaveBeenCalledOnce());\n    expect(apiMocks.closeWindow).not.toHaveBeenCalled();\n\n    await act(async () => resolveLiveWrite({ ...baseSettings, always_on_top: true }));\n    await waitFor(() => expect(apiMocks.closeWindow).toHaveBeenCalledWith("settings"));\n  });\n\n  it("keeps the window open and rolls back an unrecoverable live write", async () => {\n    let rejectLiveWrite!: (error: Error) => void;\n    apiMocks.applyUiSettings.mockImplementationOnce(\n      () => new Promise<AppSettings>((_resolve, reject) => { rejectLiveWrite = reject; }),\n    );\n    apiMocks.getSettings\n      .mockResolvedValueOnce(baseSettings)\n      .mockRejectedValueOnce(new Error("recovery failed"));\n\n    render(<SettingsWindow />);\n    await screen.findByRole("heading", { name: "Settings" });\n    const alwaysOnTop = screen.getByLabelText("Always on top") as HTMLInputElement;\n    fireEvent.click(alwaysOnTop);\n    expect(alwaysOnTop.checked).toBe(true);\n    fireEvent.click(screen.getByRole("button", { name: "Close" }));\n\n    await act(async () => rejectLiveWrite(new Error("write failed")));\n    expect((await screen.findByRole("alert")).textContent).toContain("Could not save settings");\n    expect(alwaysOnTop.checked).toBe(false);\n    expect(apiMocks.closeWindow).not.toHaveBeenCalled();\n  });\n`,
);

// Debug Tools are v2rayN-specific and must fail in the UI before invoking legacy commands.
replaceOnce(
  "src/frontend/src/app/DebugWindow.tsx",
  `import type { AppSettings, DebugRuntimeSnapshot, UiDebugReport } from "@/lib/types";`,
  `import type { AppSettings, DebugRuntimeSnapshot, ProxyClientId, UiDebugReport } from "@/lib/types";`,
);
replaceOnce(
  "src/frontend/src/app/DebugWindow.tsx",
  `  const [settingsListenerSettled, setSettingsListenerSettled] = useState(false);`,
  `  const [settingsListenerSettled, setSettingsListenerSettled] = useState(false);\n  const [selectedClient, setSelectedClient] = useState<ProxyClientId | null>(null);`,
);
replaceOnce(
  "src/frontend/src/app/DebugWindow.tsx",
  `      .then((settings) =>\n        active && revision === settingsRevisionRef.current\n          ? applySurfaceSettings(settings)\n          : undefined,\n      )`,
  `      .then(async (settings) => {\n        if (!active || revision !== settingsRevisionRef.current) return;\n        setSelectedClient(settings.selected_client);\n        await applySurfaceSettings(settings);\n      })`,
);
replaceOnce(
  "src/frontend/src/app/DebugWindow.tsx",
  `        settingsRevisionRef.current += 1;\n        void applySurfaceSettings(event.payload);`,
  `        settingsRevisionRef.current += 1;\n        setSelectedClient(event.payload.selected_client);\n        void applySurfaceSettings(event.payload);`,
);
replaceOnce(
  "src/frontend/src/app/DebugWindow.tsx",
  `  useEffect(() => {\n    void run(\n      "probe",\n      async () => {\n        const result = await runUiDebugProbe();\n        setReport(result);\n        return "probe complete";\n      },\n      { captureSnapshot: true, probeOperation: true }\n    ).finally(() => setInitialProbePending(false));\n  }, []);`,
  `  useEffect(() => {\n    if (selectedClient === null) return;\n    if (selectedClient !== "v2rayn") {\n      setReport(null);\n      setProbeError(t("debug.v2raynOnly"));\n      setInitialProbePending(false);\n      return;\n    }\n\n    setInitialProbePending(true);\n    void run(\n      "probe",\n      async () => {\n        const result = await runUiDebugProbe();\n        setReport(result);\n        return "probe complete";\n      },\n      { captureSnapshot: true, probeOperation: true }\n    ).finally(() => setInitialProbePending(false));\n  }, [selectedClient]);`,
);
replaceOnce(
  "src/frontend/src/app/DebugWindow.tsx",
  `  return (\n    <main`,
  `  const debugEnabled = selectedClient === "v2rayn";\n\n  return (\n    <main`,
);
replaceOnce(
  "src/frontend/src/app/DebugWindow.tsx",
  `        <div className="no-drag mb-3 grid grid-cols-2 gap-2 text-xs">`,
  `        {!debugEnabled && selectedClient !== null && (\n          <p role="alert" className="no-drag mb-3 rounded-xl border border-amber-400/50 bg-amber-500/10 p-3 text-xs text-amber-100">\n            {t("debug.v2raynOnly")}\n          </p>\n        )}\n\n        <div className="no-drag mb-3 grid grid-cols-2 gap-2 text-xs">`,
);
{
  const file = "src/frontend/src/app/DebugWindow.tsx";
  let source = read(file);
  source = source.replaceAll(`disabled={busy}`, `disabled={busy || !debugEnabled}`);
  source = source.replaceAll(`disabled={busy || profileNameInput.trim().length === 0}`, `disabled={busy || !debugEnabled || profileNameInput.trim().length === 0}`);
  write(file, source);
}
insertBeforeLast(
  "src/frontend/src/app/DebugWindow.test.tsx",
  `\n});`,
  `\n  it("blocks v2rayN commands while Happ is selected and enables them after a switch", async () => {\n    let settingsHandler: ((event: { payload: AppSettings }) => void) | undefined;\n    listenerMocks.bindTauriListener.mockImplementation((eventName: string, handler: (event: { payload: AppSettings }) => void, _onError?: unknown, onReady?: () => void) => {\n      if (eventName === "settings-updated") settingsHandler = handler;\n      onReady?.();\n      return () => undefined;\n    });\n    apiMocks.getSettings.mockResolvedValueOnce({ ...settings, selected_client: "happ" });\n\n    render(<DebugWindow />);\n    expect(await screen.findByRole("alert")).toHaveTextContent("v2rayN");\n    expect(screen.getByRole("button", { name: "Open v2rayN" })).toBeDisabled();\n    expect(apiMocks.runUiDebugProbe).not.toHaveBeenCalled();\n\n    await act(async () => settingsHandler?.({ payload: settings }));\n    await waitFor(() => expect(apiMocks.runUiDebugProbe).toHaveBeenCalledOnce());\n    expect(screen.getByRole("button", { name: "Open v2rayN" })).not.toBeDisabled();\n  });\n`,
);

// Accessibility: one live region and state-specific connection action.
replaceOnce(
  "src/frontend/src/components/status-badge.tsx",
  `export function StatusBadge({ status }: { status: StatusLevel }): JSX.Element {`,
  `export function StatusBadge({ status, announce = true }: { status: StatusLevel; announce?: boolean }): JSX.Element {`,
);
replaceOnce(
  "src/frontend/src/components/status-badge.tsx",
  `      role="status"\n      aria-live="polite"`,
  `      role={announce ? "status" : undefined}\n      aria-live={announce ? "polite" : undefined}`,
);
replaceOnce(
  "src/frontend/src/components/info-panel.tsx",
  `<StatusBadge status={status.status} />`,
  `<StatusBadge status={status.status} announce={false} />`,
);
replaceOnce(
  "src/frontend/src/components/connect-button.tsx",
  `  const textKey = resolveButtonText(status);`,
  `  const textKey = resolveButtonText(status);\n  const actionKey = status === "Connected"\n    ? "actions.disconnect"\n    : status === "Disconnected"\n      ? "actions.connect"\n      : status === "Connecting"\n        ? "actions.connectionInProgress"\n        : "actions.toggleConnection";`,
);
replaceOnce(
  "src/frontend/src/components/connect-button.tsx",
  `      aria-label={t("actions.toggle")}`,
  `      aria-label={t(actionKey)}\n      aria-busy={status === "Connecting"}`,
);
insertBeforeLast(
  "src/frontend/src/components/connect-button.test.tsx",
  `\n});`,
  `\n  it("exposes the action implied by the current state", () => {\n    const { rerender } = render(<ConnectButton status="Disconnected" disabled={false} onClick={vi.fn()} />);\n    expect(screen.getByRole("button", { name: "Connect" })).toBeTruthy();\n\n    rerender(<ConnectButton status="Connected" disabled={false} onClick={vi.fn()} />);\n    expect(screen.getByRole("button", { name: "Disconnect" })).toBeTruthy();\n\n    rerender(<ConnectButton status="Connecting" disabled onClick={vi.fn()} />);\n    expect(screen.getByRole("button", { name: "Connection in progress" }).getAttribute("aria-busy")).toBe("true");\n  });\n`,
);
insertBeforeLast(
  "src/frontend/src/components/info-panel.test.tsx",
  `\n});`,
  `\n  it("renders its secondary status without another live region", () => {\n    render(<InfoPanel status={baseStatus} settings={baseSettings} />);\n    expect(screen.queryByRole("status")).toBeNull();\n  });\n`,
);

for (const [file, entries] of [
  ["src/frontend/src/locales/en.json", [
    [`  "actions.toggle": "Toggle",`, `  "actions.toggle": "Toggle",\n  "actions.connect": "Connect",\n  "actions.disconnect": "Disconnect",\n  "actions.connectionInProgress": "Connection in progress",\n  "actions.toggleConnection": "Toggle connection",`],
    [`  "debug.title": "Debug tools",`, `  "debug.title": "v2rayN Debug Tools",\n  "debug.v2raynOnly": "These tools control v2rayN only. Select v2rayN in the main widget to enable them.",`],
  ]],
  ["src/frontend/src/locales/ru.json", [
    [`  "actions.toggle": "Переключить",`, `  "actions.toggle": "Переключить",\n  "actions.connect": "Подключить",\n  "actions.disconnect": "Отключить",\n  "actions.connectionInProgress": "Выполняется подключение",\n  "actions.toggleConnection": "Переключить подключение",`],
    [`  "debug.title": "Debug-инструменты",`, `  "debug.title": "Debug-инструменты v2rayN",\n  "debug.v2raynOnly": "Эти инструменты управляют только v2rayN. Выберите v2rayN в главном окне, чтобы включить их.",`],
  ]],
]) {
  for (const [before, after] of entries) replaceOnce(file, before, after);
}

// Node 24 official Actions, pinned to immutable SHAs in every permanent workflow.
const workflowDir = ".github/workflows";
for (const name of fs.readdirSync(workflowDir)) {
  if (!name.endsWith(".yml") && !name.endsWith(".yaml")) continue;
  const file = path.join(workflowDir, name);
  let source = read(file);
  source = source
    .replaceAll("actions/checkout@11d5960a326750d5838078e36cf38b85af677262 # v4", "actions/checkout@fbc6f3992d24b796d5a048ff273f7fcc4a7b6c09 # v5")
    .replaceAll("actions/upload-artifact@ea165f8d65b6e75b540449e92b4886f43607fa02 # v4", "actions/upload-artifact@b7c566a772e6b6bfb58ed0dc250532a479d7789f # v6")
    .replaceAll("actions/download-artifact@d3f86a106a0bac45b974a628896c90dbdf5c8093 # v4", "actions/download-artifact@37930b1c2abaa49bbe596cd826c3c89aef350131 # v7");
  write(file, source);
}

// Tracking and docs: keep current release claims honest and recent.
replaceOnce(
  "project-tracking/tasks/0011-build-subscription-mode-profile-switch-validation-matrix.md",
  `| Status | Open |`,
  `| Status | Blocked — external manual QA required |`,
);
replaceOnce(
  "project-tracking/tasks/0011-build-subscription-mode-profile-switch-validation-matrix.md",
  `| Which subscription setup variants are available for validation? | Open | Need safe, redacted variant list before testing. |`,
  `| Which subscription setup variants are available for validation? | Blocked | Representative real subscription-driven installations and a redacted variant list are not available in repository-only CI. The current product continues to label profile switching experimental and subscription operations unsupported. |`,
);
replaceOnce(
  "project-tracking/tasks/0012-assess-linux-and-macos-feasibility-after-platform-control-path-validation.md",
  `| Status | Open |`,
  `| Status | Deferred |`,
);
replaceOnce(
  "project-tracking/tasks/0012-assess-linux-and-macos-feasibility-after-platform-control-path-validation.md",
  `- [ ] A feasibility decision documents platform control path.\n- [ ] Decision documents limitations and risks.\n- [ ] Decision states whether to proceed, defer or reject Linux/macOS support.\n- [ ] Follow-up tasks exist if support proceeds.\n- [ ] No local system paths, private configs, real logs, endpoints or personal data are committed.\n- [ ] Public task/report materials do not contain secrets, private URLs, local system paths or personal data.`,
  `- [x] A feasibility decision documents that no validated non-Windows client/control path is currently available.\n- [x] Decision documents limitations and risks.\n- [x] Decision defers Linux/macOS support.\n- [x] No implementation follow-up is created until a supported client/control contract and real target systems exist.\n- [x] No local system paths, private configs, real logs, endpoints or personal data are committed.\n- [x] Public task/report materials do not contain secrets, private URLs, local system paths or personal data.`,
);

write("project-tracking/decisions/0012-defer-cross-platform-support.md", `# 0012 - Defer Cross-Platform Support\n\n## Decision\n\nLinux and macOS support is deferred. The current product and both implemented adapters rely on Windows process discovery, Windows UI Automation, Windows privilege/UIPI behavior, Windows window management and Windows packaging. No validated non-Windows client/control path has been selected.\n\n## Rationale\n\nA cross-platform shell without a reliable target-client status/control contract would create misleading partial support. The frontend adapter boundary is reusable, but that is not evidence that the current runtime works outside Windows.\n\n## Conditions to reopen\n\n- identify a maintained target client for Linux/macOS;\n- document stable status and control contracts;\n- validate on real target systems;\n- define platform-specific capability states and packaging;\n- add dedicated CI and manual QA evidence.\n\n## Current product impact\n\nNone. Windows remains the only supported platform. No Linux/macOS capability is advertised.\n`);
write("project-tracking/reports/0012-assess-linux-and-macos-feasibility-after-platform-control-path-validation-report.md", `# 0012 - Cross-Platform Feasibility Report\n\n## Result\n\nDeferred. Repository audit confirms that current process, UI automation, privilege, window, installer and runtime-control paths are Windows-specific. No validated Linux/macOS target-client contract or real-system evidence exists.\n\n## Decision\n\nDo not implement or advertise Linux/macOS support until the reopening conditions in the matching decision are met.\n\n## Public data review\n\nNo private paths, configs, endpoints, logs or personal data are included.\n`);

replaceOnce(
  "project-tracking/roadmap/0000-roadmap.md",
  `## Phase 4 - Diagnostics and Profile Validation\n\nStatus: In Progress`,
  `## Phase 4 - Diagnostics and Profile Validation\n\nStatus: Blocked on external manual QA`,
);
replaceOnce(
  "project-tracking/roadmap/0000-roadmap.md",
  `- \`0011-build-subscription-mode-profile-switch-validation-matrix\` - Open`,
  `- \`0011-build-subscription-mode-profile-switch-validation-matrix\` - Blocked: representative real subscription-driven installations are required`,
);
replaceOnce(
  "project-tracking/roadmap/0000-roadmap.md",
  `## Phase 9 - Cross-Platform Feasibility\n\nStatus: Planned`,
  `## Phase 9 - Cross-Platform Feasibility\n\nStatus: Deferred`,
);
replaceOnce(
  "project-tracking/roadmap/0000-roadmap.md",
  `- \`0012-assess-linux-and-macos-feasibility-after-platform-control-path-validation\` - Open`,
  `- \`0012-assess-linux-and-macos-feasibility-after-platform-control-path-validation\` - Deferred by decision 0012`,
);
replaceOnce(
  "project-tracking/roadmap/0000-roadmap.md",
  `| 0011 | Build subscription-mode profile switch validation matrix | P2 | Open | QA matrix; subscriptions remain unsupported |\n| 0012 | Assess Linux and macOS feasibility after platform control path validation | P3 | Open | После стабилизации Windows adapters |`,
  `| 0011 | Build subscription-mode profile switch validation matrix | P2 | Blocked | Requires representative real subscription-driven installations; subscriptions remain unsupported |\n| 0012 | Assess Linux and macOS feasibility after platform control path validation | P3 | Deferred | No validated non-Windows control contract or real-system evidence |`,
);

for (const file of ["README.md", "docs/architecture.md", "project-tracking/roadmap/0013-proxy-client-adapter-roadmap.md"]) {
  let source = read(file);
  const note = `\n\n### Final consistency audits\n\n- 0030: active selected-adapter context consistency.\n- 0031: Happ toggle lifecycle hardening.\n- 0032: auxiliary settings consistency.\n- 0033: tray/native runtime consistency.\n- 0034: asynchronous native ownership and warning-free quality gates.\n- 0035: declared-surface, accessibility, Settings close ownership and Node 24 Actions audit.\n`;
  if (!source.includes("0035: declared-surface")) source += note;
  write(file, source);
}

// Update 0035 report with implementation detail; final CI/merge evidence is recorded later.
{
  const file = "project-tracking/reports/0035-final-declared-surface-audit-report.md";
  let source = read(file);
  source = source.replace("Implementation and verification in progress.", "Implementation complete; exact-head verification pending.");
  source += `\n## Implemented corrections\n\n- Settings close now waits for the serialized live-write tail and fails visibly when persistence cannot be recovered.\n- Unrecoverable live-write failures rebase live UI fields to the last authoritative snapshot while preserving unrelated draft-only fields.\n- v2rayN Debug Tools are adapter-gated and react to authoritative client switches.\n- Main exposes one live status region and state-specific connection action names.\n- Official checkout/artifact actions are upgraded to immutable Node 24 revisions.\n- External-only task 0011 is explicitly blocked; task 0012 is resolved with a defer decision.\n`;
  write(file, source);
}

console.log("0035 assertion-backed patch applied");
