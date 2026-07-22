import ReactDOM from "react-dom/client";
import { getCurrentWindow } from "@tauri-apps/api/window";
import "@/styles/globals.css";
import "@/lib/i18n";
import { App } from "@/app/App";
import { DebugWindow } from "@/app/DebugWindow";
import { HappSetupWindow } from "@/app/HappSetupWindow";
import { SettingsWindow } from "@/app/SettingsWindow";
import { resolveWindowSurface } from "@/lib/window-surface";

function Root(): JSX.Element {
  const surface = resolveWindowSurface(getCurrentWindow().label);

  if (surface === "settings") {
    return <SettingsWindow />;
  }

  if (surface === "debug") {
    return <DebugWindow />;
  }

  if (surface === "happ-setup") {
    return <HappSetupWindow />;
  }

  return <App />;
}

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(<Root />);
