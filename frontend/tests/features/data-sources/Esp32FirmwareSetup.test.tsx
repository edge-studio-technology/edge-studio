import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Esp32FirmwareSetup } from "../../../src/features/data-sources/Esp32FirmwareSetup";
import type { DataSource } from "../../../src/features/data-sources/dataSourceTypes";

function source(overrides: Partial<DataSource> = {}): DataSource {
  return {
    id: "s1",
    createdAt: "",
    updatedAt: "",
    name: "Kitchen ESP32",
    type: "mqtt",
    status: "active",
    description: null,
    config: { brokerUrl: "mqtt://192.168.1.50:1883", topic: "sensors/esp32/data", profile: "esp32-mqtt-board" },
    lastReadAt: null,
    lastError: null,
    lastPreview: null,
    lastHash: null,
    ...overrides,
  };
}

describe("Esp32FirmwareSetup", () => {
  beforeEach(() => {
    vi.stubGlobal("navigator", {
      ...navigator,
      clipboard: { writeText: vi.fn().mockResolvedValue(undefined) },
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("shows the saved broker/topic and no override warning for a LAN-reachable broker", () => {
    render(<Esp32FirmwareSetup source={source()} />);
    expect(screen.getByText("mqtt://192.168.1.50:1883")).toBeInTheDocument();
    expect(screen.getAllByText("192.168.1.50").length).toBeGreaterThan(0);
    expect(screen.getAllByText("sensors/esp32/data").length).toBeGreaterThan(0);
    expect(screen.queryByText("ESP32 broker address needed")).not.toBeInTheDocument();
  });

  it("shows an override warning and lets the operator enter a reachable broker host/port for a localhost broker", async () => {
    const user = userEvent.setup();
    render(<Esp32FirmwareSetup source={source({ config: { brokerUrl: "mqtt://localhost:1883", topic: "t" } })} />);

    expect(screen.getByText("ESP32 broker address needed")).toBeInTheDocument();
    expect(
      screen.getByText(/The saved broker host localhost is only reachable from the backend host\/container/),
    ).toBeInTheDocument();

    await user.clear(screen.getByLabelText("ESP32 broker host"));
    await user.type(screen.getByLabelText("ESP32 broker host"), "192.168.1.75");
    await user.clear(screen.getByLabelText("ESP32 broker port"));
    await user.type(screen.getByLabelText("ESP32 broker port"), "1884");

    // The overridden host/port should now flow into the "ESP32 broker host/port" summary and firmware.
    expect(screen.getAllByText("192.168.1.75").length).toBeGreaterThan(0);
    expect(screen.getAllByText("1884").length).toBeGreaterThan(0);
  });

  it("shows an override warning for an unparsable broker URL", () => {
    render(<Esp32FirmwareSetup source={source({ config: { brokerUrl: "not a url", topic: "t" } })} />);
    expect(screen.getByText(/The saved broker URL could not be parsed\./)).toBeInTheDocument();
  });

  it("defaults to Arduino IDE steps and switches to Arduino CLI steps", async () => {
    const user = userEvent.setup();
    render(<Esp32FirmwareSetup source={source()} />);
    expect(screen.getByText("Arduino IDE steps")).toBeInTheDocument();
    expect(screen.queryByText("Arduino CLI steps")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Arduino CLI" }));
    expect(screen.getByText("Arduino CLI steps")).toBeInTheDocument();
    expect(screen.queryByText("Arduino IDE steps")).not.toBeInTheDocument();
  });

  it("shows/hides the generated firmware and includes the device name, wifi, and topic", async () => {
    const user = userEvent.setup();
    render(<Esp32FirmwareSetup source={source({ name: "Kitchen ESP32!" })} />);

    await user.type(screen.getAllByLabelText("Wi-Fi name")[0], "MyWifi");
    await user.type(screen.getAllByLabelText("Wi-Fi password")[0], "secret123");

    await user.click(screen.getAllByRole("button", { name: "Show firmware" })[0]);
    // There can be multiple readonly textareas; find the one containing the firmware source.
    const firmwareBox = screen
      .getAllByDisplayValue(/#include <WiFi.h>/)
      .find((el) => el.tagName === "TEXTAREA") as HTMLTextAreaElement;
    expect(firmwareBox.value).toContain('WIFI_SSID = "MyWifi"');
    expect(firmwareBox.value).toContain('WIFI_PASSWORD = "secret123"');
    expect(firmwareBox.value).toContain('DEVICE_NAME = "kitchen-esp32"');
    expect(firmwareBox.value).toContain('MQTT_TOPIC = "sensors/esp32/data"');
  });

  it("copies the firmware to the clipboard via 'Copy firmware'", async () => {
    render(<Esp32FirmwareSetup source={source()} />);
    // Not userEvent.setup() here: its own clipboard emulation would replace the
    // vi.stubGlobal navigator.clipboard mock set up in beforeEach.
    await userEvent.click(screen.getAllByRole("button", { name: "Copy firmware" })[0]);
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(expect.stringContaining("#include <WiFi.h>"));
  });

  it("CLI steps: detects an ESP32 USB serial port from pasted `arduino-cli board list` output", async () => {
    const user = userEvent.setup();
    render(<Esp32FirmwareSetup source={source()} />);
    await user.click(screen.getByRole("button", { name: "Arduino CLI" }));

    const textarea = screen.getByPlaceholderText(/Board Name/);
    await user.type(
      textarea,
      "/dev/ttyUSB0 serial   Serial Port (USB) ESP32 Family Device esp32:esp32:esp32_family  esp32:esp32",
    );

    // Detected port is shown in both the step-4 confirmation and the step-8 upload note.
    expect(screen.getAllByText("/dev/ttyUSB0").length).toBeGreaterThanOrEqual(2);
  });

  it("CLI steps: falls back to placeholder port/FQBN guidance with no pasted board list", async () => {
    const user = userEvent.setup();
    render(<Esp32FirmwareSetup source={source()} />);
    await user.click(screen.getByRole("button", { name: "Arduino CLI" }));
    expect(screen.getByText(/Look for a USB serial port such as/)).toBeInTheDocument();
    expect(screen.getByText(/Using placeholder port/)).toBeInTheDocument();
  });

  it("CLI steps: lets the operator type a manual Board FQBN when nothing is detected", async () => {
    const user = userEvent.setup();
    render(<Esp32FirmwareSetup source={source()} />);
    await user.click(screen.getByRole("button", { name: "Arduino CLI" }));

    const fqbnInput = screen.getByLabelText("Board FQBN");
    expect(fqbnInput).toBeEnabled();
    await user.clear(fqbnInput);
    await user.type(fqbnInput, "esp32:esp32:esp32s3");
    expect(fqbnInput).toHaveValue("esp32:esp32:esp32s3");
    // The typed FQBN flows into the compile/upload command blocks.
    const compileCommand = screen
      .getAllByDisplayValue(/arduino-cli compile/)
      .find((el) => el.tagName === "TEXTAREA") as HTMLTextAreaElement;
    expect(compileCommand.value).toContain("--fqbn esp32:esp32:esp32s3");
  });
});
