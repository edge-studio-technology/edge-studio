import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ToastProvider } from "../../../../src/components/ToastProvider";

const createDataSource = vi.fn();
vi.mock("../../../../src/features/data-sources/dataSourcesApi", () => ({
  createDataSource: (...args: unknown[]) => createDataSource(...args),
}));

import { AltAddDeviceFlow } from "../../../../src/features/data-sources/add-device-alt/AltAddDeviceFlow";

function renderFlow(overrides: Partial<React.ComponentProps<typeof AltAddDeviceFlow>> = {}) {
  const props = {
    open: true,
    capabilities: null,
    onClose: vi.fn(),
    onCreated: vi.fn(),
    ...overrides,
  };
  return { ...render(<AltAddDeviceFlow {...props} />, { wrapper: ToastProvider }), props };
}

describe("AltAddDeviceFlow", () => {
  beforeEach(() => {
    createDataSource.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders nothing when closed", () => {
    const { container } = render(
      <AltAddDeviceFlow open={false} capabilities={null} onClose={vi.fn()} onCreated={vi.fn()} />,
      { wrapper: ToastProvider },
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("shows the setup category picker first", () => {
    renderFlow();
    expect(screen.getByText("Setup Device")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Boards/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Protocols/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Sensors/ })).toBeInTheDocument();
  });

  it("Cancel in the picker step calls onClose", async () => {
    const { props } = renderFlow();
    await userEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(props.onClose).toHaveBeenCalled();
  });

  it("selecting a protocol device starts the provisioning steps", async () => {
    renderFlow();
    await chooseRestApiSource();

    expect(screen.getAllByText("Select device type").length).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: "Next step (2)" })).toBeEnabled();

    await userEvent.click(screen.getByRole("button", { name: "Next step (2)" }));
    expect(screen.getByLabelText("Name")).toHaveValue("HTTP JSON Source");
    expect(screen.getByRole("button", { name: "Next step (3)" })).toBeEnabled();
  });

  it("Back returns to the previous setup step", async () => {
    renderFlow();
    await userEvent.click(screen.getByRole("button", { name: /Protocols/ }));
    await userEvent.click(screen.getByRole("button", { name: /Inbound/ }));
    await userEvent.click(screen.getByRole("button", { name: "Back" }));
    expect(screen.getByRole("button", { name: /Inbound/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Outbound/ })).toBeInTheDocument();
  });

  it("uses Previous step within provisioning and Back to return to the device picker", async () => {
    renderFlow();
    await chooseRestApiSource();
    await userEvent.click(screen.getByRole("button", { name: "Next step (2)" }));

    expect(screen.getByRole("button", { name: "Previous step (1)" })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Previous step (1)" }));
    expect(screen.getByRole("button", { name: "Next step (2)" })).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Back" }));
    expect(screen.getByRole("button", { name: /REST API/ })).toBeInTheDocument();
  });

  it("shows boards and sensor template choices", async () => {
    renderFlow();
    await userEvent.click(screen.getByRole("button", { name: /Boards/ }));
    expect(screen.getByRole("button", { name: /ESP32/ })).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Back" }));
    await userEvent.click(screen.getByRole("button", { name: /Sensors/ }));
    await userEvent.click(screen.getByRole("button", { name: /Template devices/ }));
    expect(screen.getByRole("button", { name: /GPIO Button/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /PIR Motion Sensor/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /GPIO LED/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /BME280 \/ BME680 Environmental Sensor/ })).toBeInTheDocument();
  });

  it("splits GPIO input setup into connection and behavior steps", async () => {
    renderFlow();
    await userEvent.click(screen.getByRole("button", { name: /Sensors/ }));
    await userEvent.click(screen.getByRole("button", { name: /Template devices/ }));
    await userEvent.click(screen.getByRole("button", { name: /GPIO Button/ }));

    await userEvent.click(screen.getByRole("button", { name: "Next step (2)" }));
    await userEvent.click(screen.getByRole("button", { name: "Next step (3)" }));
    expect(screen.getByRole("heading", { name: "Connect GPIO" })).toBeInTheDocument();
    expect(screen.getByLabelText("GPIO chip")).toBeInTheDocument();
    expect(screen.queryByLabelText("Pull resistor")).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Next step (4)" }));
    expect(screen.getByRole("heading", { name: "Configure input behavior" })).toBeInTheDocument();
    expect(screen.getByLabelText("Pull resistor")).toBeInTheDocument();
    expect(screen.queryByLabelText("GPIO chip")).not.toBeInTheDocument();
  });

  it("submits the built config, shows a success toast, and calls onCreated", async () => {
    const created = { id: "s1", name: "HTTP JSON Source" };
    createDataSource.mockResolvedValue({ item: created });
    const { props } = renderFlow();
    await chooseRestApiSource();
    await advanceToReview();

    await userEvent.click(screen.getByRole("button", { name: "Add device" }));

    await waitFor(() => {
      expect(createDataSource).toHaveBeenCalled();
    });
    expect(createDataSource.mock.calls[0][0]).toMatchObject({
      name: "HTTP JSON Source",
      type: "json-api",
    });
    expect(props.onCreated).toHaveBeenCalledWith(created);
    expect(await screen.findByRole("heading", { name: "Device added" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Return to device page" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Add new device" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Open device guide" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Go to workflow page" })).toBeInTheDocument();
  });

  it("opens the saved device guide from the success state", async () => {
    const created = { id: "s1", name: "HTTP JSON Source" };
    const onOpenSetupGuide = vi.fn();
    createDataSource.mockResolvedValue({ item: created });
    const { props } = renderFlow({ onOpenSetupGuide });
    await chooseRestApiSource();
    await advanceToReview();
    await userEvent.click(screen.getByRole("button", { name: "Add device" }));

    await userEvent.click(await screen.findByRole("button", { name: "Open device guide" }));
    expect(onOpenSetupGuide).toHaveBeenCalledWith(created);
    expect(props.onClose).toHaveBeenCalled();
  });

  it("shows an error toast and does not call onCreated when the create request fails", async () => {
    createDataSource.mockRejectedValue(new Error("Network error"));
    const { props } = renderFlow();
    await chooseRestApiSource();
    await advanceToReview();

    await userEvent.click(screen.getByRole("button", { name: "Add device" }));

    expect(await screen.findByText("Device action failed")).toBeInTheDocument();
    expect(screen.getByText("Network error")).toBeInTheDocument();
    expect(props.onCreated).not.toHaveBeenCalled();
  });
});

async function chooseRestApiSource() {
  await userEvent.click(screen.getByRole("button", { name: /Protocols/ }));
  await userEvent.click(screen.getByRole("button", { name: /Inbound/ }));
  await userEvent.click(screen.getByRole("button", { name: /REST API/ }));
}

async function advanceToReview() {
  await userEvent.click(screen.getByRole("button", { name: "Next step (2)" }));
  await userEvent.click(screen.getByRole("button", { name: "Next step (3)" }));
  await userEvent.click(screen.getByRole("button", { name: "Next step (4)" }));
}
