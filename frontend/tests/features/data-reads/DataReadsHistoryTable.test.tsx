import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ToastProvider } from "../../../src/components/ToastProvider";
import { DataReadsHistoryTable } from "../../../src/features/data-reads/DataReadsHistoryTable";
import type { DataSourceRead } from "../../../src/features/data-reads/dataReadTypes";

function read(overrides: Partial<DataSourceRead> = {}): DataSourceRead {
  return {
    id: "r1",
    createdAt: "2026-08-20T00:00:00.000Z",
    dataSourceId: "d1",
    workflowId: null,
    integritasProofId: null,
    sourceName: "Kitchen Sensor",
    sourceUrl: "http://kitchen.local/data",
    triggerType: "manual",
    status: "success",
    hash: null,
    preview: null,
    error: null,
    triggerSourceId: null,
    triggerPayload: null,
    blockId: null,
    ...overrides,
  };
}

function renderTable(props: Partial<React.ComponentProps<typeof DataReadsHistoryTable>> = {}) {
  return render(
    <MemoryRouter>
      <ToastProvider>
        <DataReadsHistoryTable items={[]} {...props} />
      </ToastProvider>
    </MemoryRouter>,
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("DataReadsHistoryTable", () => {
  it("shows a loading state", () => {
    renderTable({ loading: true, items: [read()] });
    expect(screen.getByText("Fetching your read history")).toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });

  it("shows an unfiltered empty state with no clear-filters action", () => {
    renderTable({ items: [] });
    expect(screen.getByText("No reads recorded yet")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Clear filters" })).not.toBeInTheDocument();
  });

  it("shows a filtered empty state with a clear-filters action", async () => {
    const user = userEvent.setup();
    const onClearFilters = vi.fn();
    renderTable({ items: [], filtered: true, onClearFilters });

    expect(screen.getByText("No matching read history")).toBeInTheDocument();
    const clearButton = screen.getByRole("button", { name: "Clear filters" });
    await user.click(clearButton);
    expect(onClearFilters).toHaveBeenCalledOnce();
  });

  it("shows a filtered empty state without an action when onClearFilters is missing", () => {
    renderTable({ items: [], filtered: true });
    expect(screen.getByText("No matching read history")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Clear filters" })).not.toBeInTheDocument();
  });

  it("renders a row per item with source, trigger, status, hash, and proof cells", () => {
    const items = [
      read({
        id: "r1",
        sourceName: "Kitchen Sensor",
        sourceUrl: "http://kitchen.local/data",
        triggerType: "automation",
        status: "success",
        hash: "abcdef0123456789",
        integritasProofId: "proof-1",
      }),
      read({
        id: "r2",
        sourceName: "Failed Source",
        sourceUrl: "http://failed.local/data",
        triggerType: "webhook",
        status: "failed",
        hash: null,
        integritasProofId: null,
      }),
    ];
    renderTable({ items });

    const rows = screen.getAllByRole("row");
    // header + 2 data rows
    expect(rows).toHaveLength(3);

    expect(screen.getByText("Kitchen Sensor")).toBeInTheDocument();
    expect(screen.getByText("http://kitchen.local/data")).toBeInTheDocument();
    expect(screen.getByText("automation")).toBeInTheDocument();
    expect(screen.getByText("Success")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Go to proof" })).toHaveAttribute(
      "href",
      expect.stringContaining("q=proof-1"),
    );

    expect(screen.getByText("Failed Source")).toBeInTheDocument();
    expect(screen.getByText("webhook")).toBeInTheDocument();
    expect(screen.getByText("Failed")).toBeInTheDocument();
    expect(screen.getByText("No hash")).toBeInTheDocument();
    expect(screen.getByText("No proof")).toBeInTheDocument();
  });

  it("opens the details modal with hash, proof link, and JSON preview", async () => {
    const user = userEvent.setup();
    const item = read({
      id: "r1",
      sourceName: "Kitchen Sensor",
      hash: "abcdef0123456789",
      integritasProofId: "proof-1",
      preview: { temp: 21 },
    });
    renderTable({ items: [item] });

    await user.click(screen.getByRole("button", { name: /View details for read at/ }));

    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByText("Read details")).toBeInTheDocument();
    expect(within(dialog).getByText("abcdef0123456789")).toBeInTheDocument();
    expect(within(dialog).getByRole("link", { name: "Go to proof" })).toBeInTheDocument();
    expect(within(dialog).getByText(/"temp": 21/)).toBeInTheDocument();
  });

  it("shows the error detail panel in the modal when the read failed with no preview", async () => {
    const user = userEvent.setup();
    const item = read({
      id: "r1",
      status: "failed",
      preview: null,
      error: "Timed out",
      errorDetails: { message: "Timed out", code: "ETIMEDOUT" },
    });
    renderTable({ items: [item] });

    await user.click(screen.getByRole("button", { name: /View details for read at/ }));

    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByText("Message")).toBeInTheDocument();
    expect(within(dialog).getByText("Timed out")).toBeInTheDocument();
    expect(within(dialog).getByText(/"code": "ETIMEDOUT"/)).toBeInTheDocument();
  });

  it("shows a no-data empty state in the modal when there is no preview or error", async () => {
    const user = userEvent.setup();
    const item = read({ id: "r1", preview: null, error: null });
    renderTable({ items: [item] });

    await user.click(screen.getByRole("button", { name: /View details for read at/ }));

    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByText("No data")).toBeInTheDocument();
    expect(
      within(dialog).getByText("This read did not capture a preview."),
    ).toBeInTheDocument();
  });

  it("closes the details modal", async () => {
    const user = userEvent.setup();
    renderTable({ items: [read({ id: "r1" })] });

    await user.click(screen.getByRole("button", { name: /View details for read at/ }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Close" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
