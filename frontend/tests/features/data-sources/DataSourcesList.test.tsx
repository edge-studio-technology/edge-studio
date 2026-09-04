import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ToastProvider } from "../../../src/components/ToastProvider";
import { DataSourcesList } from "../../../src/features/data-sources/DataSourcesList";
import type { DataSource } from "../../../src/features/data-sources/dataSourceTypes";

function source(overrides: Partial<DataSource> = {}): DataSource {
  return {
    id: "s1",
    createdAt: "2026-08-01T00:00:00.000Z",
    updatedAt: "2026-08-01T00:00:00.000Z",
    name: "Kitchen Sensor",
    type: "json-api",
    status: "active",
    description: null,
    config: { url: "https://example.com/data.json", method: "GET" },
    lastReadAt: null,
    lastError: null,
    lastPreview: null,
    lastHash: null,
    ...overrides,
  };
}

const noop = () => {};
function renderList(overrides: Partial<React.ComponentProps<typeof DataSourcesList>> = {}) {
  const props = {
    items: [] as DataSource[],
    capabilities: null,
    busy: false,
    onRead: noop,
    onTestOutput: noop,
    onOpenSetupGuide: noop,
    onEdit: noop,
    onDelete: noop,
    ...overrides,
  };
  // The device-details modal's CopyableCode (last-hash row) calls useToast unconditionally.
  return render(<DataSourcesList {...props} />, { wrapper: ToastProvider });
}

describe("DataSourcesList", () => {
  it("shows a loading state", () => {
    renderList({ loading: true, items: [source()] });
    expect(screen.getByText("Fetching your devices")).toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });

  it("shows an unfiltered empty state prompting to connect a device, with New input/output actions", async () => {
    const onAddInput = vi.fn();
    const onAddOutput = vi.fn();
    renderList({ onAddInput, onAddOutput });
    expect(screen.getByText("Connect your first device")).toBeInTheDocument();

    await userEvent.click(screen.getAllByRole("button", { name: "New input" })[0]);
    expect(onAddInput).toHaveBeenCalled();
  });

  it("shows a filtered empty state with a clear-filters action when search matches nothing", async () => {
    renderList({ items: [source()] });
    await userEvent.type(screen.getByPlaceholderText("Name, type, or endpoint"), "nomatch");
    await waitFor(() => {
      expect(screen.getByText("No matching devices")).toBeInTheDocument();
    });
    expect(screen.getByRole("button", { name: "Clear filters" })).toBeInTheDocument();
  });

  it("renders a row with type label, endpoint, and no-activity status", () => {
    renderList({ items: [source()] });
    const table = screen.getByRole("table");
    const row = within(table).getAllByRole("row")[1];
    expect(within(row).getByText("Kitchen Sensor")).toBeInTheDocument();
    expect(within(row).getByText("HTTP JSON Source")).toBeInTheDocument();
    expect(within(row).getByTitle("Input · https://example.com/data.json")).toBeInTheDocument();
    expect(within(row).getByText("No activity")).toBeInTheDocument();
  });

  it("labels a pi-camera row's direction as Capture", () => {
    renderList({ items: [source({ type: "pi-camera", config: { mode: "photo", width: 1280, height: 720 } })] });
    const table = screen.getByRole("table");
    const row = within(table).getAllByRole("row")[1];
    expect(within(row).getByTitle("Capture · photo 1280x720")).toBeInTheDocument();
  });

  it("labels output-type rows as Output", () => {
    renderList({ items: [source({ type: "gpio-output", config: { chip: "gpiochip0", pin: 18 } })] });
    const table = screen.getByRole("table");
    const row = within(table).getAllByRole("row")[1];
    expect(within(row).getByText("GPIO LED")).toBeInTheDocument();
    expect(within(row).getByTitle("Output · led gpiochip0 GPIO18 active:high")).toBeInTheDocument();
  });

  it("labels PIR motion / ESP32 board rows via their config profile", () => {
    renderList({
      items: [
        source({ id: "s1", type: "gpio-input", config: { profile: "pir-motion", chip: "gpiochip0", pin: 23, edge: "rising" } }),
        source({ id: "s2", type: "mqtt", config: { profile: "esp32-mqtt-board", brokerUrl: "mqtt://x", topic: "t" } }),
      ],
    });
    expect(screen.getByText("PIR Motion Sensor")).toBeInTheDocument();
    expect(screen.getByText("ESP32 MQTT Board")).toBeInTheDocument();
  });

  it("shows No activity when the source has no read history", () => {
    renderList({ items: [source({ type: "webhook", config: {} })] });
    expect(screen.getByText("No activity")).toBeInTheDocument();
  });

  it("shows a truncated hash pill when lastHash is present", () => {
    renderList({ items: [source({ lastHash: "abcdef0123456789" })] });
    expect(screen.queryByText("Not read yet")).not.toBeInTheDocument();
  });

  it("shows last-preview status pills: Success, Failed, and No activity", () => {
    renderList({
      items: [
        source({ id: "s1", lastPreview: { a: 1 } }),
        source({ id: "s2", lastPreview: null, lastError: "boom" }),
        source({ id: "s3", lastPreview: null, lastError: null }),
      ],
    });
    const table = screen.getByRole("table");
    const rows = within(table).getAllByRole("row").slice(1);
    expect(within(rows[0]).getByText("Success")).toBeInTheDocument();
    expect(within(rows[1]).getAllByText("Failed").length).toBeGreaterThan(0);
    expect(within(rows[2]).getByText("No activity")).toBeInTheDocument();
  });

  it("filters by direction", async () => {
    renderList({
      items: [
        source({ id: "s1", name: "Input One", type: "json-api" }),
        source({ id: "s2", name: "Output One", type: "gpio-output", config: { chip: "gpiochip0", pin: 18 } }),
      ],
    });
    await userEvent.selectOptions(screen.getByLabelText("Filter"), "Output");
    expect(screen.queryByText("Input One")).not.toBeInTheDocument();
    expect(screen.getByText("Output One")).toBeInTheDocument();
  });

  it("filters by search across name, type label, and endpoint", async () => {
    renderList({
      items: [
        source({ id: "s1", name: "Kitchen Sensor" }),
        source({ id: "s2", name: "Garage Door", config: { url: "https://garage.local/data" } }),
      ],
    });
    await userEvent.type(screen.getByPlaceholderText("Name, type, or endpoint"), "garage");
    await waitFor(() => {
      expect(screen.queryByText("Kitchen Sensor")).not.toBeInTheDocument();
    });
    expect(screen.getByText("Garage Door")).toBeInTheDocument();
  });

  it("disables the trigger-manually action for non-manually-triggerable types", () => {
    renderList({ items: [source({ type: "webhook", config: {} })] });
    expect(screen.getByRole("button", { name: /Trigger .* manually/ })).toBeDisabled();
  });

  it("enables trigger manually for a json-api source and calls onRead", async () => {
    const onRead = vi.fn();
    const item = source();
    renderList({ items: [item], onRead });
    const trigger = screen.getByRole("button", { name: "Trigger Kitchen Sensor manually" });
    expect(trigger).toBeEnabled();
    await userEvent.click(trigger);
    expect(onRead).toHaveBeenCalledWith(item);
  });

  it("shows a 'Test output' menu action for http-output and calls onTestOutput", async () => {
    const onTestOutput = vi.fn();
    const item = source({ type: "http-output", name: "Relay", config: { url: "https://x" } });
    renderList({ items: [item], onTestOutput });
    await userEvent.click(screen.getByRole("button", { name: "More actions for Relay" }));
    await userEvent.click(screen.getByRole("menuitem", { name: "Test output" }));
    expect(onTestOutput).toHaveBeenCalledWith(item);
  });

  it("shows 'Test pulse' for gpio-output instead of 'Test output'", async () => {
    const item = source({ type: "gpio-output", name: "LED", config: { chip: "gpiochip0", pin: 18 } });
    renderList({ items: [item] });
    await userEvent.click(screen.getByRole("button", { name: "More actions for LED" }));
    expect(screen.getByRole("menuitem", { name: "Test pulse" })).toBeInTheDocument();
  });

  it("shows a Setup guide action and calls onOpenSetupGuide", async () => {
    const onOpenSetupGuide = vi.fn();
    const item = source({ type: "gpio-input", name: "Motion", config: { chip: "gpiochip0", pin: 23 } });
    renderList({ items: [item], onOpenSetupGuide });
    await userEvent.click(screen.getByRole("button", { name: "More actions for Motion" }));
    await userEvent.click(screen.getByRole("menuitem", { name: "Setup guide" }));
    expect(onOpenSetupGuide).toHaveBeenCalledWith(item);
  });

  it("edits and deletes via the row menu", async () => {
    const onEdit = vi.fn();
    const onDelete = vi.fn();
    const item = source();
    renderList({ items: [item], onEdit, onDelete });

    await userEvent.click(screen.getByRole("button", { name: "More actions for Kitchen Sensor" }));
    await userEvent.click(screen.getByRole("menuitem", { name: "Edit" }));
    expect(onEdit).toHaveBeenCalledWith(item);

    await userEvent.click(screen.getByRole("button", { name: "More actions for Kitchen Sensor" }));
    await userEvent.click(screen.getByRole("menuitem", { name: "Delete" }));
    expect(onDelete).toHaveBeenCalledWith(item);
  });

  it("disables delete when the source is used by a workflow", async () => {
    const item = source({ usedByWorkflows: [{ id: "w1", name: "Front gate flow" }] });
    renderList({ items: [item] });
    await userEvent.click(screen.getByRole("button", { name: "More actions for Kitchen Sensor" }));
    expect(screen.getByRole("menuitem", { name: "Delete" })).toBeDisabled();
  });

  it("opens the device details modal with status and last-preview disclosures", async () => {
    const item = source({
      lastHash: "abcdef0123456789",
      lastPreview: { temp: 21 },
      lastReadAt: "2026-08-20T00:00:00.000Z",
    });
    renderList({ items: [item] });
    await userEvent.click(screen.getByRole("button", { name: "More actions for Kitchen Sensor" }));
    await userEvent.click(screen.getByRole("menuitem", { name: "View details" }));

    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByText("Device details")).toBeInTheDocument();
    expect(within(dialog).getByText("abcdef0123456789")).toBeInTheDocument();
  });

  it("shows the error detail panel in the details modal when the last read failed with no preview", async () => {
    const item = source({ lastPreview: null, lastError: "Fetch failed" });
    renderList({ items: [item] });
    await userEvent.click(screen.getByRole("button", { name: "More actions for Kitchen Sensor" }));
    await userEvent.click(screen.getByRole("menuitem", { name: "View details" }));

    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getAllByText("Fetch failed").length).toBeGreaterThan(0);
  });
});
