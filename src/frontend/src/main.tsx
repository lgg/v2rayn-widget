import { useEffect, useState } from "react";
import ReactDOM from "react-dom/client";
import { getCurrentWindow } from "@tauri-apps/api/window";
import "@/styles/globals.css";
import "@/lib/i18n";
import { App } from "@/app/App";
import { DebugWindow } from "@/app/DebugWindow";
import { SettingsWindow } from "@/app/SettingsWindow";

function Root(): JSX.Element {
  const [label, setLabel] = useState<string>("main");

  useEffect(() => {
    const current = getCurrentWindow();
    setLabel(current.label);
  }, []);

  if (label === "settings") {
    return <SettingsWindow />;
  }

  if (label === "debug") {
    return <DebugWindow />;
  }

  return <App />;
}

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(<Root />);
