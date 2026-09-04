import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ToastProvider } from "../../../src/components/ToastProvider";
import {
  getDeviceSetupGuide,
  hasDeviceSetupGuide,
  StandardDeviceSetupGuide,
} from "../../../src/features/data-sources/deviceSetupGuides";
import type { DataSource } from "../../../src/features/data-sources/dataSourceTypes";

function source(overrides: Partial<DataSource> = {}): DataSource {
  return {
    id: "s1",
    createdAt: "",
    updatedAt: "",
    name: "My device",
    type: "json-api",
    status: "active",
    description: null,
    config: {},
    lastReadAt: null,
    lastError: null,
    lastPreview: null,
    lastHash: null,
    ...overrides,
  };
}

describe("getDeviceSetupGuide / hasDeviceSetupGuide", () => {
  it("dispatches the esp32-mqtt-board guide for an mqtt source with that profile", () => {
    const guide = getDeviceSetupGuide(source({ type: "mqtt", config: { profile: "esp32-mqtt-board" } }));
    expect(guide?.title).toBe("ESP32 MQTT Board Setup Guide");
  });

  it("dispatches the plain MQTT Subscriber guide for mqtt without the esp32 profile", () => {
    const guide = getDeviceSetupGuide(source({ type: "mqtt", config: { brokerUrl: "mqtt://x", topic: "t" } }));
    expect(guide?.title).toBe("MQTT Subscriber Setup Guide");
  });

  it("dispatches the PIR guide for gpio-input with the pir-motion profile", () => {
    const guide = getDeviceSetupGuide(source({ type: "gpio-input", config: { profile: "pir-motion" } }));
    expect(guide?.title).toBe("PIR Motion Sensor Setup Guide");
  });

  it("dispatches the GPIO Button guide when the gpio-input source name contains 'button'", () => {
    const guide = getDeviceSetupGuide(source({ type: "gpio-input", name: "Front Door Button", config: {} }));
    expect(guide?.title).toBe("GPIO Button Setup Guide");
  });

  it("dispatches the generic GPIO Input guide otherwise", () => {
    const guide = getDeviceSetupGuide(source({ type: "gpio-input", name: "Motion", config: {} }));
    expect(guide?.title).toBe("GPIO Input Setup Guide");
  });

  it("dispatches the GPIO LED guide for gpio-output", () => {
    const guide = getDeviceSetupGuide(source({ type: "gpio-output", config: {} }));
    expect(guide?.title).toBe("GPIO LED Output Setup Guide");
  });

  it("dispatches a sensor-named guide for bme-sensor (bme280 vs bme680)", () => {
    expect(getDeviceSetupGuide(source({ type: "bme-sensor", config: { sensor: "bme280" } }))?.title).toBe(
      "BME280 Environmental Sensor Setup",
    );
    expect(getDeviceSetupGuide(source({ type: "bme-sensor", config: { sensor: "bme680" } }))?.title).toBe(
      "BME680 Environmental Sensor Setup",
    );
  });

  it("dispatches the Device System Data guide", () => {
    expect(getDeviceSetupGuide(source({ type: "device-system-data", config: {} }))?.title).toBe(
      "Device System Data Setup Guide",
    );
  });

  it("dispatches the Raspberry Pi Camera guide", () => {
    expect(getDeviceSetupGuide(source({ type: "pi-camera", config: {} }))?.title).toBe(
      "Raspberry Pi Camera Setup Guide",
    );
  });

  it("dispatches the HTTP JSON Source guide", () => {
    expect(getDeviceSetupGuide(source({ type: "json-api", config: {} }))?.title).toBe(
      "HTTP JSON Source Setup Guide",
    );
  });

  it("dispatches the Webhook Receiver guide", () => {
    expect(getDeviceSetupGuide(source({ type: "webhook", config: {} }))?.title).toBe(
      "Webhook Receiver Setup Guide",
    );
  });

  it("dispatches the HTTP JSON Target guide", () => {
    expect(getDeviceSetupGuide(source({ type: "http-output", config: {} }))?.title).toBe(
      "HTTP JSON Target Setup Guide",
    );
  });

  it("dispatches the MQTT Publisher guide", () => {
    expect(getDeviceSetupGuide(source({ type: "mqtt-output", config: {} }))?.title).toBe(
      "MQTT Publisher Setup Guide",
    );
  });

  it("hasDeviceSetupGuide is true for every supported source type", () => {
    const types: DataSource["type"][] = [
      "json-api",
      "webhook",
      "mqtt",
      "gpio-input",
      "gpio-output",
      "pi-camera",
      "bme-sensor",
      "device-system-data",
      "http-output",
      "mqtt-output",
    ];
    for (const type of types) {
      expect(hasDeviceSetupGuide(source({ type, config: {} }))).toBe(true);
    }
  });
});

describe("StandardDeviceSetupGuide", () => {
  beforeEach(() => {
    vi.stubGlobal("navigator", {
      ...navigator,
      clipboard: { writeText: vi.fn().mockResolvedValue(undefined) },
    });
    vi.stubGlobal("open", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("renders table and disclosure sections, and the doc-path link opens the doc in a new tab", async () => {
    const item = source({
      type: "bme-sensor",
      name: "Kitchen BME280",
      config: { sensor: "bme280", bus: 1, address: "0x76" },
    });
    render(<StandardDeviceSetupGuide source={item} />, { wrapper: ToastProvider });

    expect(screen.getByText("Requirements")).toBeInTheDocument();
    expect(screen.getByText("Sensor")).toBeInTheDocument();
    expect(screen.getByText("bme280")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "docs/guides/bme280-sensor.md" }));
    expect(window.open).toHaveBeenCalledWith(
      "https://github.com/integritas-technology/edge-studio/blob/main/docs/guides/bme280-sensor.md",
      "_blank",
      "noopener,noreferrer",
    );
  });

  it("renders a guide action and calls onAction when clicked", async () => {
    const onAction = vi.fn();
    const item = source({ type: "bme-sensor", config: { sensor: "bme280" } });
    render(<StandardDeviceSetupGuide source={item} onAction={onAction} />, { wrapper: ToastProvider });

    const actionButton = screen.getByRole("button", { name: "Create basic workflow for this device" });
    await userEvent.click(actionButton);
    expect(onAction).toHaveBeenCalledWith(
      expect.objectContaining({ key: "create-readable-preview-workflow" }),
    );
  });

  it("shows 'Go to workflow' instead of the action label once a workflow was created for it", async () => {
    const onGoToWorkflow = vi.fn();
    const item = source({ type: "bme-sensor", config: { sensor: "bme280" } });
    render(
      <StandardDeviceSetupGuide
        source={item}
        createdWorkflowIds={{ "create-readable-preview-workflow": "wf-1" }}
        onGoToWorkflow={onGoToWorkflow}
      />,
      { wrapper: ToastProvider },
    );

    const goToWorkflow = screen.getByRole("button", { name: "Go to workflow" });
    await userEvent.click(goToWorkflow);
    expect(onGoToWorkflow).toHaveBeenCalledWith("wf-1");
  });

  it("shows 'Creating...' and disables the action while it is running", () => {
    const item = source({ type: "bme-sensor", config: { sensor: "bme280" } });
    render(
      <StandardDeviceSetupGuide
        source={item}
        onAction={vi.fn()}
        runningActionKey="create-readable-preview-workflow"
      />,
      { wrapper: ToastProvider },
    );
    expect(screen.getByRole("button", { name: "Creating..." })).toBeDisabled();
  });

  it("renders a command block that copies its value to the clipboard", async () => {
    const item = source({ type: "webhook", config: { webhookToken: "tok-123" } });
    render(<StandardDeviceSetupGuide source={item} />, { wrapper: ToastProvider });

    await userEvent.click(screen.getByRole("button", { name: "Copy commands" }));
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
      expect.stringContaining("curl -X POST"),
    );
    await waitFor(() => {
      expect(screen.getByText("Commands copied to clipboard.")).toBeInTheDocument();
    });
  });

  it("shows the wiring schematic toggle for guides with a pi-gpio schematic section", async () => {
    const item = source({ type: "gpio-output", config: {} });
    render(<StandardDeviceSetupGuide source={item} />, { wrapper: ToastProvider });

    const toggle = screen.getByRole("button", { name: "Show wiring schematic" });
    await userEvent.click(toggle);
    expect(screen.getByRole("button", { name: "Hide wiring schematic" })).toBeInTheDocument();
    expect(screen.getByAltText(/Raspberry Pi 40-pin GPIO header pinout/)).toBeInTheDocument();
  });
});
