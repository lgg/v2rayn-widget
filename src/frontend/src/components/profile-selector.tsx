import { useEffect, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
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
  onSelect
}: Props): JSX.Element {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) {
      return;
    }

    const onDown = (event: MouseEvent): void => {
      const target = event.target as Node | null;
      if (target && rootRef.current?.contains(target)) {
        return;
      }
      setOpen(false);
    };

    window.addEventListener("mousedown", onDown);
    return () => window.removeEventListener("mousedown", onDown);
  }, [open]);

  const selectedName =
    profiles.find((profile) => profile.id === selectedProfileId)?.name ?? activeProfileName ?? t("common.unknown");

  return (
    <div ref={rootRef} className="no-drag relative min-w-0">
      <button
        type="button"
        className="flex w-full items-center justify-between gap-2 rounded-lg bg-transparent text-left text-sm font-medium"
        disabled={disabled || profiles.length === 0}
        onClick={() => setOpen((prev) => !prev)}
      >
        <span className="truncate">{selectedName}</span>
        <ChevronDown className="h-4 w-4 opacity-75" />
      </button>

      {open && profiles.length > 0 && (
        <div className="absolute left-0 right-0 z-30 mt-2 max-h-52 overflow-y-auto rounded-xl border border-white/30 bg-slate-900/95 p-1 shadow-float backdrop-blur">
          {profiles.map((profile) => (
            <button
              key={profile.id}
              type="button"
              className="block w-full truncate rounded-lg px-2 py-2 text-left text-sm text-slate-100 hover:bg-white/10"
              onClick={() => {
                setOpen(false);
                onSelect(profile.id);
              }}
            >
              {profile.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
