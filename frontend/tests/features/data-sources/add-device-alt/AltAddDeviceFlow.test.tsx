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

  it("selecting a protocol device moves to the configure step with a filled name", async () => {
    renderFlow();
    await chooseRestApiSource();

    expect(screen.getByRole("button", { name: "Add device" })).toBeInTheDocument();
    expect(screen.getByLabelText("Name")).toHaveValue("HTTP JSON Source");
    // json-api template comes with a default url, so the form should already be valid.
    expect(screen.getByRole("button", { name: "Add device" })).toBeEnabled();
  });

  it("Back returns to the previous setup step", async () => {
    renderFlow();
    await userEvent.click(screen.getByRole("button", { name: /Protocols/ }));
    await userEvent.click(screen.getByRole("button", { name: /Inbound/ }));
    await userEvent.click(screen.getByRole("button", { name: "Back" }));
    expect(screen.getByRole("button", { name: /Inbound/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Outbound/ })).toBeInTheDocument();
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

  it("submits the built config, shows a success toast, and calls onCreated", async () => {
    const created = { id: "s1", name: "HTTP JSON Source" };
    createDataSource.mockResolvedValue({ item: created });
    const { props } = renderFlow();
    await chooseRestApiSource();

    await userEvent.click(screen.getByRole("button", { name: "Add device" }));

    await waitFor(() => {
      expect(createDataSource).toHaveBeenCalled();
    });
    expect(createDataSource.mock.calls[0][0]).toMatchObject({
      name: "HTTP JSON Source",
      type: "json-api",
    });
    expect(props.onCreated).toHaveBeenCalledWith(created);
    expect(await screen.findByText("Device added")).toBeInTheDocument();
  });

  it("shows an error toast and does not call onCreated when the create request fails", async () => {
    createDataSource.mockRejectedValue(new Error("Network error"));
    const { props } = renderFlow();
    await chooseRestApiSource();

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
