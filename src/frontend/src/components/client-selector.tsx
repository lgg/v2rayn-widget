import { SlidersHorizontal } from "lucide-react";
import { useTranslation } from "react-i18next";
import { openHappSetupWindow } from "@/lib/api";
import type { ClientDescriptor, ProxyClientId } from "@/lib/types";

interface ClientSelectorProps {
  clients: ClientDescriptor[];
  selectedClientId: ProxyClientId;
  disabled?: boolean;
  onSelect: (clientId: ProxyClientId) => void;
}

export function ClientSelector({
  clients,
  selectedClientId,
  disabled = false,
  onSelect
}: ClientSelectorProps): JSX.Element {
  const { t } = useTranslation();

  return (
    <div className="flex items-center gap-2">
      <select
        aria-label="Proxy client"
        className="no-drag min-w-0 flex-1 bg-transparent text-sm font-semibold outline-none disabled:opacity-60"
        value={selectedClientId}
        disabled={disabled}
        onChange={(event) => onSelect(event.target.value as ProxyClientId)}
      >
        {clients.map((client) => (
          <option key={client.id} value={client.id}>
            {client.display_name}
          </option>
        ))}
      </select>

      {selectedClientId === "happ" && (
        <button
          type="button"
          aria-label={t("actions.configureHapp")}
          title={t("actions.configureHapp")}
          disabled={disabled}
          className="no-drag rounded-md border border-white/30 p-1 disabled:opacity-60"
          onClick={() => void openHappSetupWindow()}
        >
          <SlidersHorizontal className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}
