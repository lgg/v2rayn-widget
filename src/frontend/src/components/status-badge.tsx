import { useTranslation } from "react-i18next";
import { cn } from "@/lib/cn";
import type { StatusLevel } from "@/lib/types";

const toneClasses: Record<StatusLevel, string> = {
  Connected: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300",
  Disconnected: "bg-slate-200 text-slate-700 dark:bg-slate-500/20 dark:text-slate-300",
  Error: "bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-300",
  Unknown: "bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300",
  Connecting: "bg-sky-100 text-sky-700 dark:bg-sky-500/20 dark:text-sky-300"
};

export function StatusBadge({ status }: { status: StatusLevel }): JSX.Element {
  const { t } = useTranslation();

  return (
    <span
      className={cn(
        "inline-flex rounded-full px-3 py-1 text-xs font-semibold tracking-wide",
        toneClasses[status]
      )}
    >
      {t(`status.${status.toLowerCase()}`)}
    </span>
  );
}
