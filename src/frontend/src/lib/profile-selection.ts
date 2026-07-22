import type { ProfileSummary } from "@/lib/types";

export function selectedProfileIdForStatus(
  profiles: ProfileSummary[],
  activeProfileName: string | null
): string {
  if (!activeProfileName) {
    return "";
  }

  return profiles.find((profile) => profile.name === activeProfileName)?.id ?? "";
}
