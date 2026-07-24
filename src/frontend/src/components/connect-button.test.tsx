// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import i18n from "@/lib/i18n";
import { ConnectButton } from "@/components/connect-button";

describe("ConnectButton", () => {
  beforeEach(async () => {
    await i18n.changeLanguage("en");
  });

  it("does not present an unknown state as disconnected", () => {
    render(<ConnectButton status="Unknown" disabled={false} onClick={vi.fn()} />);
    expect(screen.getByText("UNKNOWN")).toBeTruthy();
    expect(screen.queryByText("OFF")).toBeNull();
  });

  it("still presents a confirmed disconnected state as off", () => {
    render(<ConnectButton status="Disconnected" disabled={false} onClick={vi.fn()} />);
    expect(screen.getByText("OFF")).toBeTruthy();
  });
});
