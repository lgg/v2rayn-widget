// @vitest-environment jsdom

import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ClientSelector } from "@/components/client-selector";
import type { ClientDescriptor } from "@/lib/types";

const clients: ClientDescriptor[] = [
  {
    id: "v2rayn",
    display_name: "v2rayN",
    maturity: "stable",
    status_note: "",
    capabilities: {
      detect_application: "supported",
      read_process_state: "supported",
      read_connection_state: "supported",
      open_application: "supported",
      toggle_connection: "supported",
      list_items: "supported",
      select_item: "experimental",
      restart_application: "supported",
      read_transport_mode: "unsupported",
      list_subscriptions: "unsupported",
      switch_subscription: "unsupported",
      refresh_subscription: "unsupported",
      manage_subscriptions: "unsupported"
    }
  },
  {
    id: "happ",
    display_name: "Happ",
    maturity: "read_only_mvp",
    status_note: "Research required",
    capabilities: {
      detect_application: "supported",
      read_process_state: "supported",
      read_connection_state: "research_required",
      open_application: "supported",
      toggle_connection: "research_required",
      list_items: "research_required",
      select_item: "research_required",
      restart_application: "research_required",
      read_transport_mode: "research_required",
      list_subscriptions: "research_required",
      switch_subscription: "research_required",
      refresh_subscription: "research_required",
      manage_subscriptions: "research_required"
    }
  }
];

describe("ClientSelector", () => {
  it("renders registered clients and emits a selected client id", () => {
    const onSelect = vi.fn();

    render(
      <ClientSelector
        clients={clients}
        selectedClientId="v2rayn"
        onSelect={onSelect}
      />
    );

    expect(screen.getByRole("option", { name: "v2rayN" })).toBeTruthy();
    expect(screen.getByRole("option", { name: "Happ" })).toBeTruthy();

    fireEvent.change(screen.getByRole("combobox", { name: "Proxy client" }), {
      target: { value: "happ" }
    });

    expect(onSelect).toHaveBeenCalledWith("happ");
  });

  it("can be disabled while an adapter switch is in progress", () => {
    render(
      <ClientSelector
        clients={clients}
        selectedClientId="v2rayn"
        disabled
        onSelect={() => undefined}
      />
    );

    expect(screen.getByRole("combobox", { name: "Proxy client" })).toBeDisabled();
  });
});
