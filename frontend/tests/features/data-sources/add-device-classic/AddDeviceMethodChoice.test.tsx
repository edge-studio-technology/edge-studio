import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { AddDeviceMethodChoice } from "../../../../src/features/data-sources/add-device-classic/AddDeviceMethodChoice";

describe("AddDeviceMethodChoice", () => {
  it("shows input-specific copy for input mode", () => {
    render(<AddDeviceMethodChoice mode="input" onSelect={vi.fn()} />);
    expect(
      screen.getByText(/devices, sensors, cameras, and board examples/),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/protocol, endpoint, topic, or GPIO input settings/),
    ).toBeInTheDocument();
  });

  it("shows output-specific copy for output mode", () => {
    render(<AddDeviceMethodChoice mode="output" onSelect={vi.fn()} />);
    expect(screen.getByText(/output devices and hardware setups/)).toBeInTheDocument();
    expect(screen.getByText(/endpoint, MQTT topic, or output target settings/)).toBeInTheDocument();
  });

  it("selecting 'Start from a template' calls onSelect with 'template'", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(<AddDeviceMethodChoice mode="input" onSelect={onSelect} />);
    await user.click(screen.getByRole("button", { name: /Choose template/ }));
    expect(onSelect).toHaveBeenCalledWith("template");
  });

  it("selecting 'Define manually' calls onSelect with 'manual'", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(<AddDeviceMethodChoice mode="input" onSelect={onSelect} />);
    await user.click(screen.getByRole("button", { name: /Choose manual setup/ }));
    expect(onSelect).toHaveBeenCalledWith("manual");
  });
});
