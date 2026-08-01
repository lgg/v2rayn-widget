import { beforeEach, describe, expect, it, vi } from "vitest";

const apiMocks = vi.hoisted(() => ({ invoke: vi.fn() }));

vi.mock("@tauri-apps/api/core", () => apiMocks);
vi.mock("@tauri-apps/api/window", () => ({ getCurrentWindow: vi.fn() }));

interface Deferred<T> {
  promise: Promise<T>;
  resolve: (value: T | PromiseLike<T>) => void;
  reject: (reason?: unknown) => void;
}

function deferred<T>(): Deferred<T> {
  let resolve!: Deferred<T>["resolve"];
  let reject!: Deferred<T>["reject"];
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

describe("API window operation ownership", () => {
  beforeEach(() => {
    apiMocks.invoke.mockReset();
    vi.resetModules();
  });

  it("coalesces duplicate diagnostics opens and releases ownership afterward", async () => {
    const firstOpen = deferred<void>();
    apiMocks.invoke.mockImplementationOnce(() => firstOpen.promise);
    const { openDiagnosticsWindow } = await import("@/lib/api");

    const first = openDiagnosticsWindow();
    const duplicate = openDiagnosticsWindow();

    expect(apiMocks.invoke).toHaveBeenCalledTimes(1);
    expect(apiMocks.invoke).toHaveBeenCalledWith("open_diagnostics_window");
    expect(duplicate).toBe(first);

    firstOpen.resolve(undefined);
    await Promise.all([first, duplicate]);

    apiMocks.invoke.mockResolvedValueOnce(undefined);
    await openDiagnosticsWindow();
    expect(apiMocks.invoke).toHaveBeenCalledTimes(2);
  });

  it("serializes main-window height writes so the newest measurement is applied last", async () => {
    const firstWrite = deferred<void>();
    const secondWrite = deferred<void>();
    apiMocks.invoke
      .mockImplementationOnce(() => firstWrite.promise)
      .mockImplementationOnce(() => secondWrite.promise);
    const { setMainWindowHeight } = await import("@/lib/api");

    const first = setMainWindowHeight(320);
    const second = setMainWindowHeight(540);

    await vi.waitFor(() => expect(apiMocks.invoke).toHaveBeenCalledTimes(1));
    expect(apiMocks.invoke).toHaveBeenNthCalledWith(1, "set_main_window_height", {
      height: 320,
    });

    firstWrite.resolve(undefined);
    await first;
    await vi.waitFor(() => expect(apiMocks.invoke).toHaveBeenCalledTimes(2));
    expect(apiMocks.invoke).toHaveBeenNthCalledWith(2, "set_main_window_height", {
      height: 540,
    });

    secondWrite.resolve(undefined);
    await second;
  });

  it("continues the height queue after a failed resize", async () => {
    apiMocks.invoke
      .mockRejectedValueOnce(new Error("resize failed"))
      .mockResolvedValueOnce(undefined);
    const { setMainWindowHeight } = await import("@/lib/api");

    await expect(setMainWindowHeight(300)).rejects.toThrow("resize failed");
    await expect(setMainWindowHeight(500)).resolves.toBeUndefined();

    expect(apiMocks.invoke).toHaveBeenNthCalledWith(2, "set_main_window_height", {
      height: 500,
    });
  });
});