import type { DashboardStatus } from "@/lib/types";

const RFC3339_INSTANT = /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2})(?:\.(\d{1,9}))?(Z|[+-]\d{2}:\d{2})$/;

export function parseStatusInstant(value: string): bigint | null {
  const match = RFC3339_INSTANT.exec(value.trim());
  if (!match) return null;

  const milliseconds = Date.parse(value);
  if (!Number.isFinite(milliseconds)) return null;

  const fraction = (match[2] ?? "").padEnd(9, "0");
  const subMillisecondNanoseconds = BigInt(fraction.slice(3) || "0");
  return BigInt(milliseconds) * 1_000_000n + subMillisecondNanoseconds;
}

export function statusIsAtLeastAsFresh(
  candidate: DashboardStatus,
  current: DashboardStatus | null,
): boolean {
  if (!current) return true;

  const candidateTime = parseStatusInstant(candidate.updated_at);
  const currentTime = parseStatusInstant(current.updated_at);
  if (candidateTime !== null && currentTime !== null) return candidateTime >= currentTime;
  if (candidateTime === null && currentTime !== null) return false;
  return true;
}
