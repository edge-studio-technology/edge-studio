import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { AltDeviceForm, isAltDeviceFormValid } from "../../../../src/features/data-sources/add-device-alt/AltDeviceForm";
import type { DeviceFormFields } from "../../../../src/features/data-sources/useDeviceFormFields";
import type { DataSourceTemplate } from "../../../../src/features/data-sources/dataSourceTypes";

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

const template: DataSourceTemplate = {
  title: "HTTP JSON Source",
  description: "Fetch JSON from an external API",
  type: "json-api",
  config: {},
};

describe("isAltDeviceFormValid", () => {
  it("mirrors isDataSourceFormValid's rules (name required, per-type requirements)", () => {
    expect(isAltDeviceFormValid(fields({ name: "" }))).toBe(false);
    expect(isAltDeviceFormValid(fields({ type: "mqtt", brokerUrl: "mqtt://x", topic: "t" }))).toBe(true);
    expect(isAltDeviceFormValid(fields({ type: "gpio-input", gpioChip: "", gpioPin: "" }))).toBe(false);
    expect(isAltDeviceFormValid(fields({ type: "webhook" }))).toBe(true);
    expect(isAltDeviceFormValid(fields({ type: "json-api", url: "" }))).toBe(false);
  });
});

describe("AltDeviceForm", () => {
  it("shows the template badge and description on the type step", () => {
    render(<AltDeviceForm template={template} fields={fields()} currentStep="type" />);
    expect(screen.getByRole("heading", { name: "HTTP JSON Source" })).toBeInTheDocument();
    expect(screen.getByText("Fetch JSON from an external API")).toBeInTheDocument();
  });

  it("shows name/description fields on the name step", () => {
    render(<AltDeviceForm template={template} fields={fields()} currentStep="name" />);
    expect(screen.getByLabelText("Name")).toHaveValue("My device");
  });

  it("typing a name calls fields.setName", async () => {
    const user = userEvent.setup();
    const setName = vi.fn();
    render(<AltDeviceForm template={template} fields={fields({ setName })} currentStep="name" />);
    await user.type(screen.getByLabelText("Name"), "X");
    expect(setName).toHaveBeenCalled();
  });

  it("shows mqtt/mqtt-output broker and topic fields with type-specific placeholders", () => {
    render(<AltDeviceForm template={template} fields={fields({ type: "mqtt" })} currentStep="setup" />);
    expect(screen.getByLabelText("Broker URL")).toBeInTheDocument();
    expect(screen.getByLabelText("Topic")).toHaveAttribute("placeholder", "sensors/+/data");
  });

  it("shows gpio-input fields", () => {
    render(<AltDeviceForm template={template} fields={fields({ type: "gpio-input" })} currentStep="setup" />);
    expect(screen.getByLabelText("GPIO chip")).toBeInTheDocument();
    expect(screen.getByLabelText("BCM pin number")).toBeInTheDocument();
    expect(screen.getByLabelText("Pull resistor")).toBeInTheDocument();
    expect(screen.getByLabelText("Edge")).toBeInTheDocument();
  });

  it("shows gpio-output fields (no pull/edge selects)", () => {
    render(<AltDeviceForm template={template} fields={fields({ type: "gpio-output" })} currentStep="setup" />);
    expect(screen.getByLabelText("GPIO chip")).toBeInTheDocument();
    expect(screen.queryByLabelText("Pull resistor")).not.toBeInTheDocument();
  });

  it("shows camera fields, with FPS only in video mode", () => {
    const { rerender } = render(<AltDeviceForm template={template} fields={fields({ type: "pi-camera", cameraMode: "photo" })} currentStep="setup" />);
    expect(screen.getByLabelText("Width")).toBeInTheDocument();
    expect(screen.queryByLabelText("FPS")).not.toBeInTheDocument();

    rerender(<AltDeviceForm template={template} fields={fields({ type: "pi-camera", cameraMode: "video" })} currentStep="setup" />);
    expect(screen.getByLabelText("FPS")).toBeInTheDocument();
  });

  it("shows bme-sensor fields including sensor model select", () => {
    render(<AltDeviceForm template={template} fields={fields({ type: "bme-sensor" })} currentStep="setup" />);
    expect(screen.getByLabelText("Sensor model")).toBeInTheDocument();
    expect(screen.getByLabelText("I2C bus")).toBeInTheDocument();
  });

  it("shows http-output URL/method fields", () => {
    render(<AltDeviceForm template={template} fields={fields({ type: "http-output", url: "https://x" })} currentStep="setup" />);
    expect(screen.getByLabelText("URL")).toHaveValue("https://x");
    expect(screen.getByLabelText("Method")).toBeInTheDocument();
  });

  it("shows json-api URL and method fields", () => {
    render(<AltDeviceForm template={template} fields={fields({ type: "json-api", url: "https://x" })} currentStep="setup" />);
    expect(screen.getByLabelText("URL")).toHaveValue("https://x");
    expect(screen.getByLabelText("Method")).toBeInTheDocument();
  });

  it("shows no extra fields for webhook and device-system-data beyond name/description", () => {
    render(<AltDeviceForm template={template} fields={fields({ type: "webhook" })} currentStep="setup" />);
    expect(screen.queryByLabelText("URL")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Broker URL")).not.toBeInTheDocument();
  });

  it("shows a review summary", () => {
    render(<AltDeviceForm template={template} fields={fields({ type: "json-api", url: "https://x" })} currentStep="review" />);
    expect(screen.getByRole("heading", { name: "Review and add" })).toBeInTheDocument();
    expect(screen.getByText("https://x")).toBeInTheDocument();
  });
});
