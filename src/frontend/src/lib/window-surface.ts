export type WindowSurface = "main" | "settings" | "debug" | "happ-setup";

export function resolveWindowSurface(label: string): WindowSurface {
  if (label === "settings" || label === "debug" || label === "happ-setup") {
    return label;
  }

  return "main";
}
