import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { AltDevicePicker } from "../../../../src/features/data-sources/add-device-alt/AltDevicePicker";
import type { DataSourceCapabilities, HostCapability } from "../../../../src/features/data-sources/dataSourceTypes";

const enabledHostCapabilities: HostCapability[] = [
  { name: "camera", enabled: true, installed: true, available: true, state: "enabled", reason: null },
  { name: "gpio", enabled: true, installed: true, available: true, state: "enabled", reason: null },
  { name: "sensors", enabled: true, installed: true, available: true, state: "enabled", reason: null },
  { name: "mqtt", enabled: true, installed: true, available: true, state: "enabled", reason: null },
];

describe("AltDevicePicker", () => {
  it("renders one card per manual input device option, excluding guided-only templates", () => {
    render(<AltDevicePicker mode="input" capabilities={null} hostCapabilities={enabledHostCapabilities} onSelect={vi.fn()} />);
    expect(screen.getByRole("heading", { name: "HTTP JSON Source" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "I2C Environmental Sensor" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "ESP32 MQTT Board" })).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "GPIO Button" })).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "PIR Motion Sensor" })).not.toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "Add input" })).toHaveLength(7);
  });

  it("renders output options with 'Add output' actions", () => {
    render(<AltDevicePicker mode="output" capabilities={null} hostCapabilities={enabledHostCapabilities} onSelect={vi.fn()} />);
    expect(screen.getByRole("heading", { name: "GPIO LED" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "HTTP JSON Target" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "MQTT Publisher" })).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "Add output" })).toHaveLength(3);
  });

  it("selecting a card resolves the template config (mqtt broker URL) before calling onSelect", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    const capabilities: DataSourceCapabilities = {
      gpioInput: { available: true, devicePath: "/dev/gpiochip0", reason: null },
      mqttBroker: { enabled: true, internalUrl: "mqtt://mqtt:1883", publicHost: "pi.local", publicPort: 1883 },
    };
    render(<AltDevicePicker mode="output" capabilities={capabilities} hostCapabilities={enabledHostCapabilities} onSelect={onSelect} />);

    await user.click(screen.getAllByRole("button", { name: "Add output" })[0]);
    // Order: GPIO LED (button clicked is the first "Add output" -> GPIO LED, no broker resolution).
    expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({ title: "GPIO LED" }));

    onSelect.mockClear();
    await user.click(screen.getAllByRole("button", { name: "Add output" })[2]);
    expect(onSelect).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "MQTT Publisher",
        config: expect.objectContaining({ brokerUrl: "mqtt://mqtt:1883" }),
      }),
    );
  });

  it("leaves a non-mqtt template's config untouched when selected", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(<AltDevicePicker mode="input" capabilities={null} onSelect={onSelect} />);

    await user.click(screen.getAllByRole("button", { name: "Add input" })[0]);
    expect(onSelect).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "HTTP JSON Source",
        config: expect.objectContaining({ url: "https://example.com/data.json" }),
      }),
    );
  });
});
