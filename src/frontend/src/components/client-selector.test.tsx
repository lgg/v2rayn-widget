// @vitest-environment jsdom

import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import "@/lib/i18n";

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
    maturity: "experimental_ui_automation",
    status_note: "Experimental control",
    capabilities: {
      detect_application: "supported",
      read_process_state: "supported",
      read_connection_state: "experimental",
      open_application: "supported",
      toggle_connection: "experimental",
      list_items: "research_required",
      select_item: "research_required",
      restart_application: "research_required",
      read_transport_mode: "experimental",
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
        onConfigureHapp={() => undefined}
      />
    );

    expect(screen.getByRole("option", { name: "v2rayN" })).toBeTruthy();
    expect(screen.getByRole("option", { name: "Happ" })).toBeTruthy();

    fireEvent.change(screen.getByRole("combobox", { name: "Client application" }), {
      target: { value: "happ" }
    });

    expect(onSelect).toHaveBeenCalledWith("happ");
  });

  it("opens adapter setup while Happ is selected", () => {
    const onConfigureHapp = vi.fn();
    render(
      <ClientSelector
        clients={clients}
        selectedClientId="happ"
        onSelect={() => undefined}
        onConfigureHapp={onConfigureHapp}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Configure Happ adapter" }));
    expect(onConfigureHapp).toHaveBeenCalledTimes(1);
  });

  it("can be disabled while an adapter switch is in progress", () => {
    render(
      <ClientSelector
        clients={clients}
        selectedClientId="v2rayn"
        disabled
        onSelect={() => undefined}
        onConfigureHapp={() => undefined}
      />
    );

    expect(screen.getByRole("combobox", { name: "Client application" }).hasAttribute("disabled")).toBe(true);
  });
});
