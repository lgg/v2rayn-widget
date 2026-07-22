import { useTranslation } from "react-i18next";
import type { ProfileSummary } from "@/lib/types";

interface Props {
  profiles: ProfileSummary[];
  selectedProfileId: string;
  activeProfileName: string | null;
  disabled?: boolean;
  onSelect: (profileId: string) => void;
}

export function ProfileSelector({
  profiles,
  selectedProfileId,
  activeProfileName,
  disabled = false,
  onSelect,
}: Props): JSX.Element {
  const { t } = useTranslation();
  const selectedExists = profiles.some((profile) => profile.id === selectedProfileId);
  const fallbackLabel = activeProfileName ?? t("common.unknown");

  return (
    <select
      aria-label={t("fields.profile")}
      className="no-drag w-full min-w-0 bg-transparent text-sm font-medium outline-none disabled:opacity-60"
      value={selectedExists ? selectedProfileId : ""}
      disabled={disabled || profiles.length === 0}
      onChange={(event) => {
        if (event.target.value) {
          onSelect(event.target.value);
        }
      }}
    >
      {!selectedExists && (
        <option value="" disabled>
          {fallbackLabel}
        </option>
      )}
      {profiles.map((profile) => (
        <option key={profile.id} value={profile.id}>
          {profile.name}
        </option>
      ))}
    </select>
  );
}
