import { beforeEach, describe, expect, it, vi } from "vitest";

const listenMock = vi.fn();
vi.mock("@tauri-apps/api/event", () => ({
  listen: listenMock,
}));

import { bindTauriListener } from "@/lib/tauri-listener";

describe("bindTauriListener", () => {
  beforeEach(() => {
    listenMock.mockReset();
  });

  it("disposes a listener that resolves after the component already unmounted", async () => {
    let resolveListen: ((dispose: () => void) => void) | undefined;
    const dispose = vi.fn();
    listenMock.mockReturnValue(
      new Promise<() => void>((resolve) => {
        resolveListen = resolve;
      }),
    );

    const cleanup = bindTauriListener("event", () => undefined);
    cleanup();
    resolveListen?.(dispose);
    await Promise.resolve();

    expect(dispose).toHaveBeenCalledOnce();
  });

  it("disposes an active listener on cleanup", async () => {
    const dispose = vi.fn();
    listenMock.mockResolvedValue(dispose);

    const cleanup = bindTauriListener("event", () => undefined);
    await Promise.resolve();
    cleanup();

    expect(dispose).toHaveBeenCalledOnce();
  });
});
