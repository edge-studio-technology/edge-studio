import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ToastProvider } from "../../../../src/components/ToastProvider";

const createDataSource = vi.fn();
vi.mock("../../../../src/features/data-sources/dataSourcesApi", () => ({
  createDataSource: (...args: unknown[]) => createDataSource(...args),
}));

import { ClassicAddDeviceFlow } from "../../../../src/features/data-sources/add-device-classic/ClassicAddDeviceFlow";

function renderFlow(overrides: Partial<React.ComponentProps<typeof ClassicAddDeviceFlow>> = {}) {
  const props = {
    mode: "input" as const,
    capabilities: null,
    onClose: vi.fn(),
    onCreated: vi.fn(),
    ...overrides,
  };
  return { ...render(<ClassicAddDeviceFlow {...props} />, { wrapper: ToastProvider }), props };
}

describe("ClassicAddDeviceFlow", () => {
  beforeEach(() => {
    createDataSource.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders nothing when mode is null", () => {
    const { container } = render(
      <ClassicAddDeviceFlow mode={null} capabilities={null} onClose={vi.fn()} onCreated={vi.fn()} />,
      { wrapper: ToastProvider },
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("shows the method-choice step first with an Input source breadcrumb", () => {
    renderFlow({ mode: "input" });
    expect(screen.getByText("Input source")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Choose template/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Choose manual setup/ })).toBeInTheDocument();
  });

  it("choosing manual setup shows the manual-only template grid with a Manual breadcrumb", async () => {
    renderFlow({ mode: "input" });
    await userEvent.click(screen.getByRole("button", { name: /Choose manual setup/ }));
    expect(screen.getByText("Manual")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "HTTP JSON Source" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "GPIO Button" })).not.toBeInTheDocument();
  });

  it("choosing a template shows the guided template grid with a Template breadcrumb", async () => {
    renderFlow({ mode: "input" });
    await userEvent.click(screen.getByRole("button", { name: /Choose template/ }));
    expect(screen.getByText("Template")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "GPIO Button" })).toBeInTheDocument();
  });

  it("Back from the template grid returns to the method-choice step", async () => {
    renderFlow({ mode: "input" });
    await userEvent.click(screen.getByRole("button", { name: /Choose manual setup/ }));
    await userEvent.click(screen.getByRole("button", { name: "Back" }));
    expect(screen.getByRole("button", { name: /Choose template/ })).toBeInTheDocument();
  });

  it("selecting a template moves to the form step with fields filled in", async () => {
    renderFlow({ mode: "input" });
    await userEvent.click(screen.getByRole("button", { name: /Choose manual setup/ }));
    await userEvent.click(screen.getByRole("button", { name: /HTTP JSON Source/ }));

    expect(screen.getByText("Add device")).toBeInTheDocument();
    expect(screen.getByLabelText("Name")).toHaveValue("HTTP JSON Source");
    expect(screen.getByRole("button", { name: "Add input" })).toBeEnabled();
  });

  it("Back from the form step returns to the template grid", async () => {
    renderFlow({ mode: "input" });
    await userEvent.click(screen.getByRole("button", { name: /Choose manual setup/ }));
    await userEvent.click(screen.getByRole("button", { name: /HTTP JSON Source/ }));
    await userEvent.click(screen.getByRole("button", { name: "Back" }));
    expect(screen.getByRole("heading", { name: "HTTP JSON Source" })).toBeInTheDocument();
  });

  it("submits the built config, shows a success toast, and calls onCreated", async () => {
    const created = { id: "s1", name: "HTTP JSON Source" };
    createDataSource.mockResolvedValue({ item: created });
    const { props } = renderFlow({ mode: "input" });
    await userEvent.click(screen.getByRole("button", { name: /Choose manual setup/ }));
    await userEvent.click(screen.getByRole("button", { name: /HTTP JSON Source/ }));

    await userEvent.click(screen.getByRole("button", { name: "Add input" }));

    await waitFor(() => {
      expect(createDataSource).toHaveBeenCalled();
    });
    expect(createDataSource.mock.calls[0][0]).toMatchObject({ name: "HTTP JSON Source", type: "json-api" });
    expect(props.onCreated).toHaveBeenCalledWith(created);
    expect(await screen.findByText("Device added")).toBeInTheDocument();
  });

  it("shows an error toast and does not call onCreated when the create request fails", async () => {
    createDataSource.mockRejectedValue(new Error("Network error"));
    const { props } = renderFlow({ mode: "input" });
    await userEvent.click(screen.getByRole("button", { name: /Choose manual setup/ }));
    await userEvent.click(screen.getByRole("button", { name: /HTTP JSON Source/ }));

    await userEvent.click(screen.getByRole("button", { name: "Add input" }));

    expect(await screen.findByText("Device action failed")).toBeInTheDocument();
    expect(screen.getByText("Network error")).toBeInTheDocument();
    expect(props.onCreated).not.toHaveBeenCalled();
  });
});
