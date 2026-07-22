import { listen, type Event, type UnlistenFn } from "@tauri-apps/api/event";

export function bindTauriListener<T>(
  eventName: string,
  handler: (event: Event<T>) => void,
  onError?: (error: unknown) => void,
): () => void {
  let active = true;
  let unlisten: UnlistenFn | null = null;

  void listen<T>(eventName, handler)
    .then((dispose) => {
      if (!active) {
        dispose();
        return;
      }
      unlisten = dispose;
    })
    .catch((error) => {
      if (active) {
        onError?.(error);
      }
    });

  return () => {
    active = false;
    unlisten?.();
    unlisten = null;
  };
}
