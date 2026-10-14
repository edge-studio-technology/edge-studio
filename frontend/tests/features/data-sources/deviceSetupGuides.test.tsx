import { render, screen, waitFor } from "@testing-library/react";
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

  it("dispatches the GPIO Button guide for gpio-input with the gpio-button profile", () => {
    const guide = getDeviceSetupGuide(source({ type: "gpio-input", name: "Front Door Button", config: { profile: "gpio-button" } }));
    expect(guide?.title).toBe("GPIO Button Setup Guide");
  });

  it("does not dispatch the GPIO Button guide from the source name", () => {
    const guide = getDeviceSetupGuide(source({ type: "gpio-input", name: "Front Door Button", config: {} }));
    expect(guide?.title).toBe("GPIO Input Setup Guide");
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

  it("gives every guide variant a Saved settings topic", () => {
    const items = [
      source({ type: "mqtt", config: { profile: "esp32-mqtt-board" } }),
      source({ type: "bme-sensor", config: {} }),
      source({ type: "device-system-data", config: {} }),
      source({ type: "gpio-input", config: {} }),
      source({ type: "gpio-input", config: { profile: "gpio-button" } }),
      source({ type: "gpio-input", config: { profile: "pir-motion" } }),
      source({ type: "gpio-output", config: {} }),
      source({ type: "pi-camera", config: {} }),
      source({ type: "json-api", config: {} }),
      source({ type: "webhook", config: {} }),
      source({ type: "mqtt", config: {} }),
      source({ type: "http-output", config: {} }),
      source({ type: "mqtt-output", config: {} }),
    ];

    for (const item of items) {
      expect(getDeviceSetupGuide(item)?.sections.some((section) => section.title === "Saved settings")).toBe(true);
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

  it("renders overview details, and documentation opens in a new tab", async () => {
    const item = source({
      type: "bme-sensor",
      name: "Kitchen BME280",
      config: { sensor: "bme280", bus: 1, address: "0x76" },
    });
    render(<StandardDeviceSetupGuide source={item} />, { wrapper: ToastProvider });

    expect(screen.getByText("How to use this guide")).toBeInTheDocument();
    expect(screen.getByText("Requirements")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Saved settings" }));
    expect(screen.getByText("Configuration currently saved for this device.")).toBeInTheDocument();
    expect(screen.getByText("Sensor")).toBeInTheDocument();
    expect(screen.getByText("bme280")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Requirements" }));
    expect(screen.getByText("Conditions that must be in place before this device can be used.")).toBeInTheDocument();
    expect(screen.getByText("I2C sensors are enabled in Devices -> Hardware support so the host-side sensor helper is running.")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Documentation" }));
    await userEvent.click(screen.getByRole("button", { name: "Open documentation" }));
    expect(window.open).toHaveBeenCalledWith(
      "https://github.com/integritas-technology/edge-studio/blob/main/docs/guides/bme280-sensor.md",
      "_blank",
      "noopener,noreferrer",
    );
  });

  it("moves between guide topics with previous and next controls", async () => {
    const item = source({ type: "bme-sensor", config: { sensor: "bme280" } });
    render(<StandardDeviceSetupGuide source={item} />, { wrapper: ToastProvider });

    expect(screen.getByRole("button", { name: "Previous" })).toBeDisabled();
    await userEvent.click(screen.getByRole("button", { name: "Next" }));
    expect(screen.getByRole("heading", { name: "Requirements" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Requirements" })).toHaveAttribute("aria-current", "page");
    await userEvent.click(screen.getByRole("button", { name: "Previous" }));
    expect(screen.getByRole("heading", { name: "Overview" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Overview" })).toHaveAttribute("aria-current", "page");
  });

  it("uses consistent workflow, verification, and saved-settings topics", async () => {
    const item = source({ type: "http-output", config: { url: "https://example.test/output" } });
    render(<StandardDeviceSetupGuide source={item} />, { wrapper: ToastProvider });

    expect(screen.getByRole("button", { name: "Overview" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Saved settings" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Workflow use" })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Verify" }));
    expect(screen.getByText("Use Test output in Devices and confirm the endpoint receives the expected JSON request.")).toBeInTheDocument();
  });

  it("shows operational safety guidance where device output or access has side effects", async () => {
    const webhook = source({ type: "webhook", config: { webhookToken: "tok-123" } });
    render(<StandardDeviceSetupGuide source={webhook} />, { wrapper: ToastProvider });

    await userEvent.click(screen.getByRole("button", { name: "Workflow use" }));
    expect(screen.getByText(/Treat the webhook URL as a bearer secret/)).toBeInTheDocument();
  });

  it("uses the configured PIR pin and shows GPIO debounce in saved settings", async () => {
    const item = source({ type: "gpio-input", config: { profile: "pir-motion", pin: 24, debounceMs: 750 } });
    render(<StandardDeviceSetupGuide source={item} />, { wrapper: ToastProvider });

    await userEvent.click(screen.getByRole("button", { name: "Wiring" }));
    expect(screen.getByText("Configured BCM GPIO24; GPIO23 is physical pin 16 for the default template.")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Saved settings" }));
    expect(screen.getByText("750 ms")).toBeInTheDocument();
  });

  it("uses a concrete MQTT verification topic when the subscription has wildcards", async () => {
    const item = source({ type: "mqtt", config: { topic: "sensors/+/data" } });
    render(<StandardDeviceSetupGuide source={item} />, { wrapper: ToastProvider });

    await userEvent.click(screen.getByRole("button", { name: "Verify" }));
    expect(screen.getByText(/publishers cannot publish to \+ or #/)).toBeInTheDocument();
    expect(screen.getByText(/<concrete-matching-topic>/)).toBeInTheDocument();
  });

  it("renders a guide action and calls onAction when clicked", async () => {
    const onAction = vi.fn();
    const item = source({ type: "bme-sensor", config: { sensor: "bme280" } });
    render(<StandardDeviceSetupGuide source={item} onAction={onAction} />, { wrapper: ToastProvider });

    await userEvent.click(screen.getByRole("button", { name: "Guide actions" }));
    const actionButton = screen.getByRole("button", { name: "Create basic workflow for this device" });
    await userEvent.click(actionButton);
    expect(onAction).toHaveBeenCalledWith(
      expect.objectContaining({ key: "create-basic-workflow" }),
    );
  });

  it("shows 'Go to workflow' instead of the action label once a workflow was created for it", async () => {
    const onGoToWorkflow = vi.fn();
    const item = source({ type: "bme-sensor", config: { sensor: "bme280" } });
    render(
      <StandardDeviceSetupGuide
        source={item}
        createdWorkflowIds={{ "create-basic-workflow": "wf-1" }}
        onGoToWorkflow={onGoToWorkflow}
      />,
      { wrapper: ToastProvider },
    );

    await userEvent.click(screen.getByRole("button", { name: "Guide actions" }));
    const goToWorkflow = screen.getByRole("button", { name: "Go to workflow" });
    await userEvent.click(goToWorkflow);
    expect(onGoToWorkflow).toHaveBeenCalledWith("wf-1");
  });

  it("shows 'Creating...' and disables the action while it is running", async () => {
    const item = source({ type: "bme-sensor", config: { sensor: "bme280" } });
    render(
      <StandardDeviceSetupGuide
        source={item}
        onAction={vi.fn()}
        runningActionKey="create-basic-workflow"
      />,
      { wrapper: ToastProvider },
    );
    await userEvent.click(screen.getByRole("button", { name: "Guide actions" }));
    expect(screen.getByRole("button", { name: "Creating..." })).toBeDisabled();
  });

  it("renders a command block that copies its value to the clipboard", async () => {
    const item = source({ type: "webhook", config: { webhookToken: "tok-123" } });
    render(<StandardDeviceSetupGuide source={item} />, { wrapper: ToastProvider });

    await userEvent.click(screen.getByRole("button", { name: "Verify" }));
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

    await userEvent.click(screen.getByRole("button", { name: "Wiring" }));
    const toggle = screen.getByRole("button", { name: "Show wiring schematic" });
    await userEvent.click(toggle);
    expect(screen.getByRole("button", { name: "Hide wiring schematic" })).toBeInTheDocument();
    const image = screen.getByAltText(/Raspberry Pi 40-pin GPIO header pinout/);
    const fullSizeLink = screen.getByRole("link", { name: "Open full-size Raspberry Pi GPIO header pinout" });
    expect(fullSizeLink).toHaveAttribute("href", image.getAttribute("src"));
    expect(fullSizeLink).toHaveAttribute("target", "_blank");
    expect(fullSizeLink).toHaveAttribute("rel", "noopener noreferrer");
  });

  it("offers device editing from saved settings", async () => {
    const onEditSettings = vi.fn();
    const item = source({ type: "mqtt", config: { brokerUrl: "mqtt://broker", topic: "sensors/data" } });
    render(<StandardDeviceSetupGuide source={item} onEditSettings={onEditSettings} />, { wrapper: ToastProvider });

    await userEvent.click(screen.getByRole("button", { name: "Saved settings" }));
    await userEvent.click(screen.getByRole("button", { name: "Edit device settings" }));
    expect(onEditSettings).toHaveBeenCalledOnce();
  });
});
