import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  WINDOW_CLOSE_FAILED_EVENT,
  type WindowCloseFailedDetail,
} from "@/lib/window-close-feedback";

export function WindowCloseFailureBanner(): JSX.Element | null {
  const { t } = useTranslation();
  const [failure, setFailure] = useState<WindowCloseFailedDetail | null>(null);

  useEffect(() => {
    const handleFailure = (event: Event): void => {
      setFailure((event as CustomEvent<WindowCloseFailedDetail>).detail);
    };

    window.addEventListener(WINDOW_CLOSE_FAILED_EVENT, handleFailure);
    return () => window.removeEventListener(WINDOW_CLOSE_FAILED_EVENT, handleFailure);
  }, []);

  if (!failure) {
    return null;
  }

  return (
    <div
      role="alert"
      data-window-label={failure.label}
      className="no-drag fixed inset-x-3 top-3 z-[100] rounded-xl border border-rose-400/60 bg-rose-950/95 p-3 text-sm text-rose-50 shadow-xl"
    >
      <p>{t("errors.windowCloseFailed")}</p>
      <button
        type="button"
        className="mt-2 rounded-lg border border-rose-200/50 px-2 py-1 text-xs"
        onClick={() => setFailure(null)}
      >
        {t("common.close")}
      </button>
    </div>
  );
}
