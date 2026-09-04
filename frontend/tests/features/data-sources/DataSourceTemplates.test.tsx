import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import {
  inputTemplates,
  LocalServicesCard,
  outputTemplates,
  resolveTemplateConfig,
  templateIcon,
} from "../../../src/features/data-sources/DataSourceTemplates";
import type { DataSourceCapabilities, DataSourceTemplate, HostCapability } from "../../../src/features/data-sources/dataSourceTypes";

const enabledHostCapabilities: HostCapability[] = [
  { name: "camera", enabled: true, installed: true, available: true, state: "enabled", reason: null },
  { name: "gpio", enabled: true, installed: true, available: true, state: "enabled", reason: null },
  { name: "sensors", enabled: true, installed: true, available: true, state: "enabled", reason: null },
  { name: "mqtt", enabled: true, installed: true, available: true, state: "enabled", reason: null, internalUrl: "mqtt://mqtt:1883", publicPort: 1883 },
];

function findTemplate(title: string): DataSourceTemplate {
  const template = [...inputTemplates, ...outputTemplates].find((t) => t.title === title);
  if (!template) throw new Error(`template not found: ${title}`);
  return template;
}

describe("templateIcon", () => {
  it("picks ShieldAlert for a pir-motion profile", () => {
    expect(templateIcon(findTemplate("PIR Motion Sensor")).displayName).toBe("ShieldAlert");
  });

  it("picks Cpu for an esp32-mqtt-board profile even though the type is mqtt", () => {
    expect(templateIcon(findTemplate("ESP32 MQTT Board")).displayName).toBe("Cpu");
  });

  it("picks the same Globe2 icon for json-api and http-output", () => {
    expect(templateIcon(findTemplate("HTTP JSON Source"))).toBe(
      templateIcon(findTemplate("HTTP JSON Target")),
    );
  });

  it("picks Webhook, Radio, Lightbulb, Camera, ThermometerSun, Cpu by type", () => {
    expect(templateIcon(findTemplate("Webhook Receiver")).displayName).toBe("Webhook");
    expect(templateIcon(findTemplate("MQTT Subscriber")).displayName).toBe("Radio");
    expect(templateIcon(findTemplate("GPIO LED")).displayName).toBe("Lightbulb");
    expect(templateIcon(findTemplate("Raspberry Pi Camera")).displayName).toBe("Camera");
    expect(templateIcon(findTemplate("BME280 Environmental Sensor")).displayName).toBe("ThermometerSun");
    expect(templateIcon(findTemplate("Device System Data")).displayName).toBe("Cpu");
  });
});

describe("resolveTemplateConfig", () => {
  it("returns config unchanged for non-mqtt templates", () => {
    const template = findTemplate("HTTP JSON Source");
    expect(resolveTemplateConfig(template, null)).toBe(template.config);
  });

  it("uses the local broker's internal URL when the mqtt broker capability is enabled", () => {
    const template = findTemplate("MQTT Subscriber");
    const capabilities: DataSourceCapabilities = {
      gpioInput: { available: true, devicePath: "", reason: null },
      mqttBroker: { enabled: true, internalUrl: "mqtt://mqtt:1883", publicHost: "pi.local", publicPort: 1883 },
    };
    expect(resolveTemplateConfig(template, capabilities)).toEqual({
      ...template.config,
      brokerUrl: "mqtt://mqtt:1883",
    });
  });

  it("falls back to localhost when the mqtt broker capability is disabled or missing", () => {
    const template = findTemplate("MQTT Publisher");
    expect(resolveTemplateConfig(template, null).brokerUrl).toBe("mqtt://localhost:1883");
    const disabled: DataSourceCapabilities = {
      gpioInput: { available: true, devicePath: "", reason: null },
      mqttBroker: { enabled: false, internalUrl: "mqtt://mqtt:1883", publicHost: "pi.local", publicPort: 1883 },
    };
    expect(resolveTemplateConfig(template, disabled).brokerUrl).toBe("mqtt://localhost:1883");
  });
});

describe("LocalServicesCard", () => {
  it("shows Disabled and the enable-with hint when there is no mqttBroker capability", () => {
    render(<LocalServicesCard capabilities={null} />);
    expect(screen.getAllByText("Disabled").length).toBeGreaterThan(0);
    expect(screen.getByText("ENABLE_MQTT_BROKER=true")).toBeInTheDocument();
  });

  it("shows Available and the LAN/internal URLs when the broker is enabled", () => {
    const capabilities: DataSourceCapabilities = {
      gpioInput: { available: true, devicePath: "", reason: null },
      mqttBroker: { enabled: true, internalUrl: "mqtt://mqtt:1883", publicHost: "pi.local", publicPort: 1883 },
    };
    render(<LocalServicesCard capabilities={capabilities} hostCapabilities={enabledHostCapabilities} />);
    expect(screen.getAllByText("Available").length).toBeGreaterThan(0);
    expect(screen.getByText("mqtt://pi.local:1883")).toBeInTheDocument();
    expect(screen.getByText("mqtt://mqtt:1883")).toBeInTheDocument();
    expect(screen.queryByText("ENABLE_MQTT_BROKER=true")).not.toBeInTheDocument();
  });

  it("opens the hardware manager with disable actions for enabled capabilities", async () => {
    render(<LocalServicesCard capabilities={null} hostCapabilities={enabledHostCapabilities} />);

    await userEvent.click(screen.getByRole("button", { name: "Enable / disable hardware" }));

    expect(screen.getByRole("dialog", { name: "Enable / disable hardware" })).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "Disable" })).toHaveLength(4);
    expect(screen.getAllByText("Prerequisites for Raspberry Pi OS").length).toBeGreaterThan(0);
  });

  it("disables a manager action when prerequisites are missing", async () => {
    const hostCapabilities: HostCapability[] = [
      {
        name: "camera",
        enabled: false,
        installed: false,
        available: false,
        state: "missing_prerequisites",
        reason: "Camera tools are missing.",
      },
    ];
    render(<LocalServicesCard capabilities={null} hostCapabilities={hostCapabilities} />);

    await userEvent.click(screen.getByRole("button", { name: "Enable / disable hardware" }));

    expect(screen.getAllByRole("button", { name: "Enable" })[0]).toBeDisabled();
    expect(screen.getByText("Action needed")).toBeInTheDocument();
    expect(screen.getAllByText("Camera tools are missing.").length).toBeGreaterThan(0);
  });

  it("shows Repair for enabled unavailable capabilities and calls the enable action", async () => {
    const onEnableCamera = vi.fn().mockResolvedValue(undefined);
    const hostCapabilities: HostCapability[] = [
      {
        name: "camera",
        enabled: true,
        installed: true,
        available: false,
        state: "failed",
        reason: "Camera support is enabled, but the camera helper is stopped. Repair camera support to restart it.",
      },
    ];
    render(<LocalServicesCard capabilities={null} hostCapabilities={hostCapabilities} onEnableCamera={onEnableCamera} />);

    await userEvent.click(screen.getByRole("button", { name: "Enable / disable hardware" }));
    await userEvent.click(screen.getByRole("button", { name: "Repair" }));

    expect(onEnableCamera).toHaveBeenCalledTimes(1);
    expect(screen.getAllByText(/Repair camera support to restart it/).length).toBeGreaterThan(0);
  });
});
