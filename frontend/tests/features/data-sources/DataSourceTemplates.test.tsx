import { render, screen, within } from "@testing-library/react";
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
  it("shows the disabled hardware summary when there is no mqttBroker capability", () => {
    render(<LocalServicesCard capabilities={null} />);
    expect(screen.getByText("0 of 4 enabled")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "MQTT: Disabled" })).toBeInTheDocument();
  });

  it("keeps MQTT URLs inside the MQTT hardware detail", async () => {
    const capabilities: DataSourceCapabilities = {
      gpioInput: { available: true, devicePath: "", reason: null },
      mqttBroker: { enabled: true, internalUrl: "mqtt://mqtt:1883", publicHost: "pi.local", publicPort: 1883 },
    };
    render(<LocalServicesCard capabilities={capabilities} hostCapabilities={enabledHostCapabilities} />);
    expect(screen.getByText("4 of 4 enabled")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "MQTT: Available" })).toBeInTheDocument();
    expect(screen.queryByText("mqtt://pi.local:1883")).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "MQTT: Available" }));

    expect(screen.getByText("mqtt://pi.local:1883")).toBeInTheDocument();
    expect(screen.getByText("mqtt://mqtt:1883")).toBeInTheDocument();
  });

  it("opens the hardware manager and switches selected hardware details", async () => {
    render(<LocalServicesCard capabilities={null} hostCapabilities={enabledHostCapabilities} />);

    await userEvent.click(screen.getByRole("button", { name: "Manage hardware" }));

    const dialog = screen.getByRole("dialog", { name: "Hardware support" });
    expect(dialog).toBeInTheDocument();
    expect(within(dialog).getByRole("region", { name: "Raspberry Pi Camera details" })).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: "Disable" })).toBeInTheDocument();
    expect(within(dialog).queryByText("Setup steps for Raspberry Pi OS")).not.toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: "Refresh status" })).toBeInTheDocument();

    await userEvent.click(within(dialog).getByRole("button", { name: /MQTT Available/ }));

    expect(within(dialog).getByRole("region", { name: "Local MQTT broker details" })).toBeInTheDocument();
  });

  it("disables a manager action when prerequisites are missing", async () => {
    const onRefreshHardware = vi.fn().mockResolvedValue(undefined);
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
    render(<LocalServicesCard capabilities={null} hostCapabilities={hostCapabilities} onRefreshHardware={onRefreshHardware} />);

    await userEvent.click(screen.getByRole("button", { name: "Manage hardware" }));

    expect(screen.getByRole("button", { name: "Action required" })).toBeDisabled();
    expect(screen.getByText("Action needed")).toBeInTheDocument();
    expect(screen.getAllByText("Camera tools are missing.").length).toBeGreaterThan(0);

    await userEvent.click(screen.getByText("Setup steps for Raspberry Pi OS"));

    expect(screen.getByText("Install camera tools")).toBeInTheDocument();
    expect(screen.getByText(/rpicam-still --list-cameras/)).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "I have completed this, refresh now" }));

    expect(onRefreshHardware).toHaveBeenCalledTimes(1);
  });

  it("shows I2C setup guidance instead of an Enable action when sensor prerequisites are missing", async () => {
    const hostCapabilities: HostCapability[] = [
      {
        name: "sensors",
        enabled: false,
        installed: false,
        available: false,
        state: "missing_prerequisites",
        reason: "/dev/i2c-1 was not found on the host. Enable I2C on the Raspberry Pi host, reboot if needed, then refresh Hardware support.",
      },
    ];
    render(<LocalServicesCard capabilities={null} hostCapabilities={hostCapabilities} />);

    await userEvent.click(screen.getByRole("button", { name: "I2C sensors: Action required" }));

    expect(screen.getByRole("button", { name: "Action required" })).toBeDisabled();

    await userEvent.click(screen.getByText("Setup steps for Raspberry Pi OS"));

    expect(screen.getByText("Enable I2C interface")).toBeInTheDocument();
    expect(screen.getByText(/sudo raspi-config/)).toBeInTheDocument();
    expect(screen.getByText("Reboot the Pi")).toBeInTheDocument();
    expect(screen.getByText(/sudo reboot/)).toBeInTheDocument();
    expect(screen.getByText(/ls -l \/dev\/i2c-1/)).toBeInTheDocument();
  });

  it("allows disabling an enabled capability even when prerequisites are missing", async () => {
    const onDisableCamera = vi.fn().mockResolvedValue(undefined);
    const hostCapabilities: HostCapability[] = [
      {
        name: "camera",
        enabled: true,
        installed: true,
        available: false,
        state: "missing_prerequisites",
        reason: "No camera was detected by the Raspberry Pi camera stack.",
      },
    ];
    render(<LocalServicesCard capabilities={null} hostCapabilities={hostCapabilities} onDisableCamera={onDisableCamera} />);

    await userEvent.click(screen.getByRole("button", { name: "Manage hardware" }));
    await userEvent.click(screen.getByRole("button", { name: "Disable" }));

    expect(onDisableCamera).toHaveBeenCalledTimes(1);
    expect(screen.getByText("Action needed")).toBeInTheDocument();
  });

  it("calls the hardware refresh action from the manager header", async () => {
    const onRefreshHardware = vi.fn().mockResolvedValue(undefined);
    render(<LocalServicesCard capabilities={null} hostCapabilities={enabledHostCapabilities} onRefreshHardware={onRefreshHardware} />);

    await userEvent.click(screen.getByRole("button", { name: "Manage hardware" }));
    await userEvent.click(screen.getByRole("button", { name: "Refresh status" }));

    expect(onRefreshHardware).toHaveBeenCalledTimes(1);
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

    await userEvent.click(screen.getByRole("button", { name: "Manage hardware" }));
    await userEvent.click(screen.getByRole("button", { name: "Repair" }));

    expect(onEnableCamera).toHaveBeenCalledTimes(1);
    expect(screen.getAllByText(/Repair camera support to restart it/).length).toBeGreaterThan(0);
  });
});
