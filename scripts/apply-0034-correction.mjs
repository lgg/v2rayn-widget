import fs from "node:fs";

function read(path) {
  return fs.readFileSync(path, "utf8").replace(/\r\n/g, "\n");
}

function replaceOnce(path, before, after) {
  const source = read(path);
  const first = source.indexOf(before);
  if (first < 0) throw new Error(`Missing expected block in ${path}: ${before.slice(0, 100)}`);
  if (source.indexOf(before, first + before.length) >= 0) throw new Error(`Expected unique block in ${path}`);
  fs.writeFileSync(path, source.slice(0, first) + after + source.slice(first + before.length));
}

replaceOnce(
  "src/frontend/src/features/dashboard-store.ts",
  '    updated_at: new Date().toISOString(),',
  '    updated_at: "1970-01-01T00:00:00.000Z",',
);

replaceOnce(
  "src/frontend/src/features/dashboard-store.test.ts",
  '      ...status("happ"),\n      status: "Disconnected",',
  '      ...status("2026-07-31T00:00:02.000000000Z"),\n      status: "Disconnected",',
);
replaceOnce(
  "src/frontend/src/features/dashboard-store.test.ts",
  '    expect(useDashboardStore.getState().status?.updated_at).toBe("happ");',
  '    expect(useDashboardStore.getState().status?.updated_at).toBe(\n      "2026-07-31T00:00:02.000000000Z",\n    );',
);

replaceOnce(
  "src/frontend/src/app/SettingsWindow.tsx",
  '      } catch {\n        setSaveError(t("errors.settingsSaveFailed"));\n        const authoritative = await getSettings().catch(() => null);',
  '      } catch {\n        if (revision !== settingsRevisionRef.current) {\n          return;\n        }\n        setSaveError(t("errors.settingsSaveFailed"));\n        const authoritative = await getSettings().catch(() => null);',
);

const testAnchor = '  it("serializes the full save after pending live UI writes", async () => {';
const staleFailureTest = `  it("ignores a stale live-save failure after authoritative settings arrive", async () => {
    let settingsHandler: ((event: { payload: AppSettings }) => void) | undefined;
    let rejectLiveWrite!: (error: Error) => void;
    eventMocks.listen.mockImplementation(async (eventName: string, handler: (event: { payload: AppSettings }) => void) => {
      if (eventName === "settings-updated") settingsHandler = handler;
      return () => undefined;
    });
    apiMocks.applyUiSettings.mockImplementationOnce(
      () => new Promise<AppSettings>((_resolve, reject) => {
        rejectLiveWrite = reject;
      }),
    );

    render(<SettingsWindow />);
    await screen.findByRole("heading", { name: "Settings" });
    await waitFor(() => expect(settingsHandler).toBeDefined());

    fireEvent.click(screen.getByLabelText("Always on top"));
    await waitFor(() => expect(apiMocks.applyUiSettings).toHaveBeenCalledTimes(1));

    await act(async () => {
      settingsHandler?.({ payload: { ...baseSettings, theme: "light" } });
      rejectLiveWrite(new Error("stale live failure"));
      await Promise.resolve();
    });

    expect(apiMocks.getSettings).toHaveBeenCalledTimes(1);
  });

`;
replaceOnce(
  "src/frontend/src/app/SettingsWindow.test.tsx",
  testAnchor,
  staleFailureTest + testAnchor,
);

console.log("0034 correction applied");
