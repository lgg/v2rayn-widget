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
  return (
    <select
      aria-label="Proxy client"
      className="no-drag w-full min-w-0 bg-transparent text-sm font-semibold outline-none disabled:opacity-60"
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
  );
}
