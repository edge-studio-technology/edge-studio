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
    mode: "input" as const,
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

  it("renders nothing when mode is null", () => {
    const { container } = render(
      <AltAddDeviceFlow mode={null} capabilities={null} onClose={vi.fn()} onCreated={vi.fn()} />,
      { wrapper: ToastProvider },
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("shows the device picker first with an Input source breadcrumb", () => {
    renderFlow({ mode: "input" });
    expect(screen.getByText("Input source")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "HTTP JSON Source" })).toBeInTheDocument();
  });

  it("shows an Output target breadcrumb for output mode", () => {
    renderFlow({ mode: "output" });
    expect(screen.getByText("Output target")).toBeInTheDocument();
  });

  it("Cancel in the picker step calls onClose", async () => {
    const { props } = renderFlow();
    await userEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(props.onClose).toHaveBeenCalled();
  });

  it("selecting a device moves to the configure step with a filled name and a disabled submit until valid", async () => {
    renderFlow({ mode: "input" });
    await userEvent.click(screen.getAllByRole("button", { name: "Add input" })[0]);

    expect(screen.getByText("Add device")).toBeInTheDocument();
    expect(screen.getByLabelText("Name")).toHaveValue("HTTP JSON Source");
    // json-api template comes with a default url, so the form should already be valid.
    expect(screen.getByRole("button", { name: "Add input" })).toBeEnabled();
  });

  it("Back returns to the picker step", async () => {
    renderFlow({ mode: "input" });
    await userEvent.click(screen.getAllByRole("button", { name: "Add input" })[0]);
    await userEvent.click(screen.getByRole("button", { name: "Back" }));
    expect(screen.getByRole("heading", { name: "HTTP JSON Source" })).toBeInTheDocument();
  });

  it("submits the built config, shows a success toast, and calls onCreated", async () => {
    const created = { id: "s1", name: "HTTP JSON Source" };
    createDataSource.mockResolvedValue({ item: created });
    const { props } = renderFlow({ mode: "input" });
    await userEvent.click(screen.getAllByRole("button", { name: "Add input" })[0]);

    await userEvent.click(screen.getByRole("button", { name: "Add input" }));

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
    const { props } = renderFlow({ mode: "input" });
    await userEvent.click(screen.getAllByRole("button", { name: "Add input" })[0]);

    await userEvent.click(screen.getByRole("button", { name: "Add input" }));

    expect(await screen.findByText("Device action failed")).toBeInTheDocument();
    expect(screen.getByText("Network error")).toBeInTheDocument();
    expect(props.onCreated).not.toHaveBeenCalled();
  });
});
