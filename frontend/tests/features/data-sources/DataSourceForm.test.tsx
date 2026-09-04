import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { DataSourceForm, isDataSourceFormValid } from "../../../src/features/data-sources/DataSourceForm";
import type { DeviceFormFields } from "../../../src/features/data-sources/useDeviceFormFields";

function fields(overrides: Partial<DeviceFormFields> = {}): DeviceFormFields {
  return {
    name: "My device",
    setName: vi.fn(),
    description: "",
    setDescription: vi.fn(),
    type: "json-api",
    setType: vi.fn(),
    url: "",
    setUrl: vi.fn(),
    healthStatusUrl: "",
    setHealthStatusUrl: vi.fn(),
    brokerUrl: "",
    setBrokerUrl: vi.fn(),
    topic: "",
    setTopic: vi.fn(),
    gpioChip: "",
    setGpioChip: vi.fn(),
    gpioPin: "",
    setGpioPin: vi.fn(),
    gpioProfile: "generic",
    setGpioProfile: vi.fn(),
    gpioPull: "off",
    setGpioPull: vi.fn(),
    gpioEdge: "both",
    setGpioEdge: vi.fn(),
    gpioDebounceMs: "100",
    setGpioDebounceMs: vi.fn(),
    gpioActiveState: "high",
    setGpioActiveState: vi.fn(),
    cameraMode: "photo",
    setCameraMode: vi.fn(),
    cameraWidth: "",
    setCameraWidth: vi.fn(),
    cameraHeight: "",
    setCameraHeight: vi.fn(),
    cameraDurationMs: "",
    setCameraDurationMs: vi.fn(),
    cameraFps: "30",
    setCameraFps: vi.fn(),
    bmeSensor: "bme280",
    setBmeSensor: vi.fn(),
    bmeBus: "",
    setBmeBus: vi.fn(),
    bmeAddress: "0x76",
    setBmeAddress: vi.fn(),
    method: "GET",
    setMethod: vi.fn(),
    ...overrides,
  };
}

describe("isDataSourceFormValid", () => {
  it("is invalid without a name regardless of type", () => {
    expect(isDataSourceFormValid(fields({ name: "", type: "webhook" }))).toBe(false);
  });

  it("mqtt/mqtt-output require both brokerUrl and topic", () => {
    expect(isDataSourceFormValid(fields({ type: "mqtt" }))).toBe(false);
    expect(isDataSourceFormValid(fields({ type: "mqtt", brokerUrl: "mqtt://x", topic: "" }))).toBe(false);
    expect(isDataSourceFormValid(fields({ type: "mqtt", brokerUrl: "mqtt://x", topic: "t" }))).toBe(true);
    expect(isDataSourceFormValid(fields({ type: "mqtt-output", brokerUrl: "mqtt://x", topic: "t" }))).toBe(true);
  });

  it("gpio-input/gpio-output require chip and pin", () => {
    expect(isDataSourceFormValid(fields({ type: "gpio-input" }))).toBe(false);
    expect(isDataSourceFormValid(fields({ type: "gpio-input", gpioChip: "gpiochip0", gpioPin: "17" }))).toBe(true);
    expect(isDataSourceFormValid(fields({ type: "gpio-output", gpioChip: "gpiochip0", gpioPin: "" }))).toBe(false);
  });

  it("pi-camera requires width, height, and duration", () => {
    expect(isDataSourceFormValid(fields({ type: "pi-camera" }))).toBe(false);
    expect(
      isDataSourceFormValid(
        fields({ type: "pi-camera", cameraWidth: "1280", cameraHeight: "720", cameraDurationMs: "1000" }),
      ),
    ).toBe(true);
  });

  it("bme-sensor requires bmeBus", () => {
    expect(isDataSourceFormValid(fields({ type: "bme-sensor" }))).toBe(false);
    expect(isDataSourceFormValid(fields({ type: "bme-sensor", bmeBus: "1" }))).toBe(true);
  });

  it("device-system-data and webhook are always valid once named", () => {
    expect(isDataSourceFormValid(fields({ type: "device-system-data" }))).toBe(true);
    expect(isDataSourceFormValid(fields({ type: "webhook" }))).toBe(true);
  });

  it("default (json-api/http-output) requires a url", () => {
    expect(isDataSourceFormValid(fields({ type: "json-api", url: "" }))).toBe(false);
    expect(isDataSourceFormValid(fields({ type: "json-api", url: "https://x" }))).toBe(true);
    expect(isDataSourceFormValid(fields({ type: "http-output", url: "https://x" }))).toBe(true);
  });
});

describe("DataSourceForm", () => {
  it("renders name/description fields and a template pill when a template is given", () => {
    render(<DataSourceForm template={{ title: "HTTP JSON Source", description: "", type: "json-api", config: {} }} {...fields()} />);
    expect(screen.getByLabelText("Name")).toHaveValue("My device");
    expect(screen.getByText("HTTP JSON Source")).toBeInTheDocument();
  });

  it("omits the template pill when there is no template", () => {
    render(<DataSourceForm template={null} {...fields()} />);
    expect(screen.queryByText("HTTP JSON Source")).not.toBeInTheDocument();
  });

  it("typing a name calls setName", async () => {
    const user = userEvent.setup();
    const setName = vi.fn();
    render(<DataSourceForm template={null} {...fields({ setName })} />);
    await user.type(screen.getByLabelText("Name"), "X");
    expect(setName).toHaveBeenCalled();
  });

  it("shows the generated-after-save note for webhook and no other fields", () => {
    render(<DataSourceForm template={null} {...fields({ type: "webhook" })} />);
    expect(screen.getByText(/A receive URL will be generated after saving/)).toBeInTheDocument();
    expect(screen.queryByLabelText("Broker URL")).not.toBeInTheDocument();
  });

  it("shows broker/topic fields for mqtt, plus the esp32 note only for the esp32 template", () => {
    const { rerender } = render(
      <DataSourceForm template={null} {...fields({ type: "mqtt" })} />,
    );
    expect(screen.getByLabelText("Broker URL")).toBeInTheDocument();
    expect(screen.getByLabelText("Topic")).toBeInTheDocument();
    expect(screen.queryByText(/starter ESP32 firmware/)).not.toBeInTheDocument();

    rerender(
      <DataSourceForm
        template={{ title: "ESP32 MQTT Board", description: "", type: "mqtt", config: { profile: "esp32-mqtt-board" } }}
        {...fields({ type: "mqtt" })}
      />,
    );
    expect(screen.getByText(/starter ESP32 firmware/)).toBeInTheDocument();
  });

  it("shows broker/topic fields for mqtt-output", () => {
    render(<DataSourceForm template={null} {...fields({ type: "mqtt-output" })} />);
    expect(screen.getByLabelText("Broker URL")).toBeInTheDocument();
    expect(screen.getByLabelText("Topic")).toBeInTheDocument();
    expect(screen.getByText(/Workflows publish JSON payloads/)).toBeInTheDocument();
  });

  it("shows GPIO input fields, with the PIR-specific note only for pir-motion profile", () => {
    const { rerender } = render(
      <DataSourceForm template={null} {...fields({ type: "gpio-input", gpioProfile: "generic" })} />,
    );
    expect(screen.getByLabelText("GPIO chip")).toBeInTheDocument();
    expect(screen.getByLabelText("BCM pin number")).toBeInTheDocument();
    expect(screen.getByText(/generic input profile/)).toBeInTheDocument();
    expect(screen.queryByText(/HC-SR501 default/)).not.toBeInTheDocument();

    rerender(<DataSourceForm template={null} {...fields({ type: "gpio-input", gpioProfile: "pir-motion" })} />);
    expect(screen.getByText(/fixed by the selected template/)).toBeInTheDocument();
    expect(screen.getByText(/HC-SR501 default/)).toBeInTheDocument();
  });

  it("shows GPIO output fields", () => {
    render(<DataSourceForm template={null} {...fields({ type: "gpio-output" })} />);
    expect(screen.getByLabelText("GPIO chip")).toBeInTheDocument();
    expect(screen.getByLabelText(/LED turns on when GPIO is/)).toBeInTheDocument();
  });

  it("shows camera fields, with FPS only in video mode", () => {
    const { rerender } = render(<DataSourceForm template={null} {...fields({ type: "pi-camera", cameraMode: "photo" })} />);
    expect(screen.getByLabelText("Width")).toBeInTheDocument();
    expect(screen.getByLabelText("Warmup timeout ms")).toBeInTheDocument();
    expect(screen.queryByLabelText("FPS")).not.toBeInTheDocument();

    rerender(<DataSourceForm template={null} {...fields({ type: "pi-camera", cameraMode: "video" })} />);
    expect(screen.getByLabelText("Video duration ms")).toBeInTheDocument();
    expect(screen.getByLabelText("FPS")).toBeInTheDocument();
  });

  it("shows BME sensor fields", () => {
    render(<DataSourceForm template={null} {...fields({ type: "bme-sensor" })} />);
    expect(screen.getByLabelText("I2C bus")).toBeInTheDocument();
    expect(screen.getByLabelText("I2C address")).toBeInTheDocument();
  });

  it("shows the device-system-data description with no configurable fields", () => {
    render(<DataSourceForm template={null} {...fields({ type: "device-system-data" })} />);
    expect(screen.getByText(/reads local OS facts from this Pi/)).toBeInTheDocument();
    expect(screen.queryByLabelText("URL")).not.toBeInTheDocument();
  });

  it("shows URL/method fields for http-output, normalizing GET to POST in the select", () => {
    render(<DataSourceForm template={null} {...fields({ type: "http-output", url: "https://x", method: "GET" })} />);
    expect(screen.getByLabelText("URL")).toHaveValue("https://x");
    expect(screen.getByLabelText("Method")).toHaveValue("POST");
  });

  it("shows URL/health/method fields for the default json-api type", () => {
    render(<DataSourceForm template={null} {...fields({ type: "json-api", url: "https://x", method: "PATCH" })} />);
    expect(screen.getByLabelText("URL")).toBeInTheDocument();
    expect(screen.getByLabelText("Health status URL")).toBeInTheDocument();
    // PATCH isn't one of the GET/POST options, so it's normalized to POST for display.
    expect(screen.getByLabelText("Method")).toHaveValue("POST");
  });
});
