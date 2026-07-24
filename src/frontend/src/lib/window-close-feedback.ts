export const WINDOW_CLOSE_FAILED_EVENT = "window-close-failed";
export const WINDOW_CLOSE_CLEARED_EVENT = "window-close-cleared";

export interface WindowCloseFailedDetail {
  label: string;
  cause: string;
}

export interface WindowCloseClearedDetail {
  label: string;
}

function causeMessage(cause: unknown): string {
  if (cause instanceof Error) {
    return cause.message;
  }

  return String(cause ?? "");
}

export function clearWindowCloseFailure(label: string): void {
  window.dispatchEvent(
    new CustomEvent<WindowCloseClearedDetail>(WINDOW_CLOSE_CLEARED_EVENT, {
      detail: { label },
    }),
  );
}

export function reportWindowCloseFailure(label: string, cause: unknown): void {
  const detail: WindowCloseFailedDetail = {
    label,
    cause: causeMessage(cause),
  };

  console.error(`Could not safely close window ${label}`, cause);
  window.dispatchEvent(
    new CustomEvent<WindowCloseFailedDetail>(WINDOW_CLOSE_FAILED_EVENT, { detail }),
  );
}
