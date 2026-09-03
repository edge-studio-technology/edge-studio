import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import {
  DataSourceTemplates,
  templateKind,
} from "../../../../src/features/data-sources/add-device-classic/ClassicDeviceTemplates";
import { inputTemplates, outputTemplates } from "../../../../src/features/data-sources/DataSourceTemplates";
import type { DataSourceCapabilities, DataSourceTemplate } from "../../../../src/features/data-sources/dataSourceTypes";

function findTemplate(title: string): DataSourceTemplate {
  const template = [...inputTemplates, ...outputTemplates].find((t) => t.title === title);
  if (!template) throw new Error(`template not found: ${title}`);
  return template;
}

describe("templateKind", () => {
  it("classifies GPIO Button, esp32-mqtt-board, pir-motion, pi-camera, bme-sensor, and gpio-output as 'template'", () => {
    expect(templateKind(findTemplate("GPIO Button"))).toBe("template");
    expect(templateKind(findTemplate("ESP32 MQTT Board"))).toBe("template");
    expect(templateKind(findTemplate("PIR Motion Sensor"))).toBe("template");
    expect(templateKind(findTemplate("Raspberry Pi Camera"))).toBe("template");
    expect(templateKind(findTemplate("BME280 Environmental Sensor"))).toBe("template");
    expect(templateKind(findTemplate("GPIO LED"))).toBe("template");
  });

  it("classifies everything else as 'manual'", () => {
    expect(templateKind(findTemplate("HTTP JSON Source"))).toBe("manual");
    expect(templateKind(findTemplate("Webhook Receiver"))).toBe("manual");
    expect(templateKind(findTemplate("MQTT Subscriber"))).toBe("manual");
    expect(templateKind(findTemplate("GPIO Input Pin"))).toBe("manual");
    expect(templateKind(findTemplate("Device System Data"))).toBe("manual");
    expect(templateKind(findTemplate("HTTP JSON Target"))).toBe("manual");
    expect(templateKind(findTemplate("MQTT Publisher"))).toBe("manual");
  });
});

describe("DataSourceTemplates (classic)", () => {
  it("shows the input-sources heading and every input template when category is unset", () => {
    render(<DataSourceTemplates mode="input" capabilities={null} onSelect={vi.fn()} />);
    expect(screen.getByText("Input sources")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "HTTP JSON Source" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "GPIO Button" })).toBeInTheDocument();
  });

  it("filters to template-kind cards only when category is 'template'", () => {
    render(<DataSourceTemplates mode="input" category="template" capabilities={null} onSelect={vi.fn()} />);
    expect(screen.getByText("Templates and examples")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "GPIO Button" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "HTTP JSON Source" })).not.toBeInTheDocument();
  });

  it("filters to manual-kind cards only when category is 'manual'", () => {
    render(<DataSourceTemplates mode="input" category="manual" capabilities={null} onSelect={vi.fn()} />);
    expect(screen.getByText("Manual setup")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "HTTP JSON Source" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "GPIO Button" })).not.toBeInTheDocument();
  });

  it("shows output targets for output mode", () => {
    render(<DataSourceTemplates mode="output" capabilities={null} onSelect={vi.fn()} />);
    expect(screen.getByText("Output targets")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "MQTT Publisher" })).toBeInTheDocument();
  });

  it("selecting a card resolves mqtt broker config and calls onSelect", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    const capabilities: DataSourceCapabilities = {
      gpioInput: { available: true, devicePath: "", reason: null },
      mqttBroker: { enabled: true, internalUrl: "mqtt://mqtt:1883", publicHost: "pi.local", publicPort: 1883 },
    };
    render(<DataSourceTemplates mode="output" category="manual" capabilities={capabilities} onSelect={onSelect} />);

    await user.click(screen.getByRole("button", { name: /MQTT Publisher/ }));
    expect(onSelect).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "MQTT Publisher",
        config: expect.objectContaining({ brokerUrl: "mqtt://mqtt:1883" }),
      }),
    );
  });

  it("shows a GPIO-not-available warning for gpio-input/output templates when capabilities say so", () => {
    const capabilities: DataSourceCapabilities = {
      gpioInput: { available: false, devicePath: "/dev/gpiochip0", reason: "GPIO device not mounted" },
    };
    render(<DataSourceTemplates mode="input" category="manual" capabilities={capabilities} onSelect={vi.fn()} />);
    expect(screen.getByText("GPIO device not mounted")).toBeInTheDocument();
  });

  it("shows the bme680-not-supported warning when the sensor helper doesn't report bme680", () => {
    const capabilities: DataSourceCapabilities = {
      gpioInput: { available: true, devicePath: "", reason: null },
      sensors: { enabled: true, available: true, reason: null, supportedSensors: ["bme280"] },
    };
    render(<DataSourceTemplates mode="input" category="template" capabilities={capabilities} onSelect={vi.fn()} />);
    expect(screen.getByText(/not reporting BME680 support yet/)).toBeInTheDocument();
  });

  it("shows the pi-camera capture directory and a camera-not-ready warning", () => {
    const capabilities: DataSourceCapabilities = {
      gpioInput: { available: true, devicePath: "", reason: null },
      camera: { available: false, enabled: true, captureDir: "/data/captures", reason: "Camera helper offline" },
    };
    render(<DataSourceTemplates mode="input" category="template" capabilities={capabilities} onSelect={vi.fn()} />);
    expect(screen.getByText("/data/captures")).toBeInTheDocument();
    expect(screen.getByText(/Camera helper offline/)).toBeInTheDocument();
  });
});
