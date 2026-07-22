import { describe, expect, it } from "vitest";
import { SerializedTaskQueue } from "@/lib/serialized-task-queue";

describe("SerializedTaskQueue", () => {
  it("preserves invocation order even when the first task is slower", async () => {
    const queue = new SerializedTaskQueue();
    const events: string[] = [];
    let releaseFirst: (() => void) | undefined;

    const first = queue.enqueue(async () => {
      events.push("first:start");
      await new Promise<void>((resolve) => {
        releaseFirst = resolve;
      });
      events.push("first:end");
      return 1;
    });
    const second = queue.enqueue(async () => {
      events.push("second:start");
      events.push("second:end");
      return 2;
    });

    await Promise.resolve();
    expect(events).toEqual(["first:start"]);
    releaseFirst?.();
    await expect(first).resolves.toBe(1);
    await expect(second).resolves.toBe(2);
    expect(events).toEqual([
      "first:start",
      "first:end",
      "second:start",
      "second:end",
    ]);
  });

  it("continues after a rejected task", async () => {
    const queue = new SerializedTaskQueue();
    await expect(
      queue.enqueue(async () => {
        throw new Error("failed");
      }),
    ).rejects.toThrow("failed");
    await expect(queue.enqueue(async () => "ok")).resolves.toBe("ok");
  });
});
