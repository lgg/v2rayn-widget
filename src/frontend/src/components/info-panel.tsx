import { useEffect, useMemo, useState } from "react";
import { Gauge, Globe } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { AppSettings, DashboardStatus } from "@/lib/types";
import { StatusBadge } from "@/components/status-badge";

function formatLatency(value: number | null, fallback: string): string {
  if (value === null || Number.isNaN(value)) {
    return fallback;
  }

  return `${value} ms`;
}

function formatTime(value: Date, format: AppSettings["time_format"]): string {
  if (format === "24h") {
    return value.toLocaleTimeString([], { hour12: false });
  }

  if (format === "12h") {
    return value.toLocaleTimeString([], { hour12: true });
  }

  return value.toLocaleTimeString();
}

export function InfoPanel({ status, settings }: { status: DashboardStatus; settings: AppSettings }): JSX.Element {
  const { t } = useTranslation();
  const [now, setNow] = useState<Date>(() => new Date());

  useEffect(() => {
    const timer = window.setInterval(() => {
      setNow(new Date());
    }, 1000);

    return () => window.clearInterval(timer);
  }, []);

  const displayTime = useMemo(() => formatTime(now, settings.time_format), [now, settings.time_format]);

  return (
    <section className="rounded-2xl border border-white/50 bg-white/70 p-4 dark:border-slate-600/60 dark:bg-slate-900/60">
      <div className="mb-3 flex items-center justify-between">
        <StatusBadge status={status.status} />
        {settings.show_clock && <span className="text-xs text-muted">{displayTime}</span>}
      </div>

      <dl className="space-y-2 text-sm">
        {settings.show_external_ip && (
          <div className="flex items-center justify-between gap-3">
            <dt className="flex items-center gap-2 text-muted">
              <Globe className="h-4 w-4" />
              {t("fields.externalIp")}
            </dt>
            <dd>{status.external_ip ?? t("common.notAvailable")}</dd>
          </div>
        )}

        {settings.show_latency && (
          <div className="flex items-center justify-between gap-3">
            <dt className="flex items-center gap-2 text-muted">
              <Gauge className="h-4 w-4" />
              {t("fields.latency")}
            </dt>
            <dd>{formatLatency(status.latency_ms, t("common.notAvailable"))}</dd>
          </div>
        )}
      </dl>
    </section>
  );
}

