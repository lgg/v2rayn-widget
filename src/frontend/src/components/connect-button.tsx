import { Power } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/cn";
import type { StatusLevel } from "@/lib/types";

function resolveButtonText(status: StatusLevel): string {
  if (status === "Connected") {
    return "on";
  }

  if (status === "Connecting") {
    return "connecting";
  }

  if (status === "Error") {
    return "error";
  }

  return "off";
}

export function ConnectButton({
  status,
  disabled,
  onClick
}: {
  status: StatusLevel;
  disabled: boolean;
  onClick: () => void;
}): JSX.Element {
  const { t } = useTranslation();
  const textKey = resolveButtonText(status);

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "group relative mx-auto flex h-44 w-44 items-center justify-center rounded-full border border-white/40",
        "bg-gradient-to-b from-white to-slate-100 text-slate-900 shadow-float transition-all",
        "hover:scale-[1.02] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60",
        "dark:from-slate-700 dark:to-slate-900 dark:text-slate-100",
        status === "Connected" && "shadow-glow",
        status === "Error" && "ring-4 ring-rose-300/40 dark:ring-rose-500/30"
      )}
      aria-label={t("actions.toggle")}
    >
      <span className="absolute inset-2 rounded-full border border-white/40" />
      <span className="relative flex flex-col items-center gap-2">
        <Power className="h-10 w-10" />
        <span className="text-xs font-semibold uppercase tracking-[0.16em]">{t(`connectionButton.${textKey}`)}</span>
      </span>
    </button>
  );
}
