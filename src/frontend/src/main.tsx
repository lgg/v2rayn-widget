import { useEffect } from "react";
import ReactDOM from "react-dom/client";
import { getCurrentWindow } from "@tauri-apps/api/window";
import "@/styles/globals.css";
import "@/lib/i18n";
import { App } from "@/app/App";
import { DebugWindow } from "@/app/DebugWindow";
import { HappSetupWindow } from "@/app/HappSetupWindow";
import { SettingsWindow } from "@/app/SettingsWindow";
import { WindowCloseFailureBanner } from "@/components/window-close-failure-banner";
import { installDiagnosticEndpointRefreshWatcher } from "@/features/diagnostic-endpoint-refresh";
import { resolveWindowSurface } from "@/lib/window-surface";

function MainSurface(): JSX.Element {
  useEffect(() => installDiagnosticEndpointRefreshWatcher(), []);

  return <App />;
}

function Root(): JSX.Element {
  const surface = resolveWindowSurface(getCurrentWindow().label);
  let content: JSX.Element;

  if (surface === "settings") {
    content = <SettingsWindow />;
  } else if (surface === "debug") {
    content = <DebugWindow />;
  } else if (surface === "happ-setup") {
    content = <HappSetupWindow />;
  } else {
    content = <MainSurface />;
  }

  return (
    <>
      <WindowCloseFailureBanner />
      {content}
    </>
  );
}

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(<Root />);
