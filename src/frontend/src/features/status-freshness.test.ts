import { describe, expect, it } from "vitest";
import { parseStatusInstant, statusIsAtLeastAsFresh } from "@/features/status-freshness";
import type { DashboardStatus } from "@/lib/types";

function status(updated_at: string): DashboardStatus {
  return {
    status: "Connected", tun_enabled: true, connection_state: "Connected",
    active_profile_name: null, external_ip: null, latency_ms: null,
    last_error: null, last_event: null, updated_at,
  };
}

describe("status freshness", () => {
  it("preserves sub-millisecond RFC3339 ordering", () => {
    const newer = status("2026-07-31T10:00:00.123456789Z");
    const older = status("2026-07-31T10:00:00.123456788Z");
    expect(parseStatusInstant(newer.updated_at)).toBeGreaterThan(parseStatusInstant(older.updated_at)!);
    expect(statusIsAtLeastAsFresh(older, newer)).toBe(false);
    expect(statusIsAtLeastAsFresh(newer, older)).toBe(true);
  });

  it("rejects an invalid candidate against a valid current timestamp", () => {
    expect(statusIsAtLeastAsFresh(status("invalid"), status("2026-07-31T10:00:00Z"))).toBe(false);
    expect(statusIsAtLeastAsFresh(status("2026-07-31T10:00:00Z"), status("invalid"))).toBe(true);
  });
});
