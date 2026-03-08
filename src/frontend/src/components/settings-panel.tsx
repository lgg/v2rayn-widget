import type { AppSettings, LocaleInfo } from "@/lib/types";

interface Props {
  settings: AppSettings;
  locales: LocaleInfo[];
  busy: boolean;
  onClose: () => void;
  onSave: (settings: AppSettings) => Promise<void>;
  onApplyImmediate: () => Promise<void>;
  onDetectPath: () => Promise<string | null>;
  onValidatePath: (path: string) => Promise<{ is_valid: boolean; message_key: string }>;
  onBackgroundMouseDown: (event: unknown) => void;
}

export function SettingsPanel(_props: Props): JSX.Element {
  return <></>;
}

