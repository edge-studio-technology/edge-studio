import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ToastProvider } from "../../../src/components/ToastProvider";
import { IntegritasHistoryTable } from "../../../src/features/integritas/IntegritasHistoryTable";
import type { IntegritasProofRecord } from "../../../src/features/integritas/integritasTypes";

function record(overrides: Partial<IntegritasProofRecord> = {}): IntegritasProofRecord {
  return {
    id: "r1",
    created_at: "2026-08-20T00:00:00.000Z",
    updated_at: "2026-08-20T00:00:00.000Z",
    file_name: "file.txt",
    file_size: 10,
    hash: "abcdef0123456789",
    proof_uid: "uid-1",
    proof_status: "ready",
    proof_payload: '{"foo":"bar"}',
    status_response: null,
    verify_response: null,
    proof_error: null,
    ...overrides,
  };
}

function renderTable(props: Partial<React.ComponentProps<typeof IntegritasHistoryTable>> = {}) {
  return render(
    <ToastProvider>
      <IntegritasHistoryTable
        records={[]}
        selectedIds={[]}
        onToggle={vi.fn()}
        onToggleAllVisible={vi.fn()}
        onVerify={vi.fn()}
        onDownload={vi.fn()}
        onDownloadZip={vi.fn()}
        onClearSelection={vi.fn()}
        onDeleteSelected={vi.fn()}
        onDownloadSelected={vi.fn()}
        busy={false}
        {...props}
      />
    </ToastProvider>,
  );
}

describe("IntegritasHistoryTable", () => {
  it("shows a loading state", () => {
    renderTable({ loading: true, records: [record()] });
    expect(screen.getByText("Fetching your proof history")).toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });

  it("shows an unfiltered empty state with no clear-filters action", () => {
    renderTable({ records: [] });
    expect(screen.getByText("No proof history yet")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Clear filters" })).not.toBeInTheDocument();
  });

  it("shows a filtered empty state with a clear-filters action", async () => {
    const user = userEvent.setup();
    const onClearFilters = vi.fn();
    renderTable({ records: [], filtered: true, onClearFilters });

    expect(screen.getByText("No matching proof history")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Clear filters" }));
    expect(onClearFilters).toHaveBeenCalledOnce();
  });

  it("shows a filtered empty state without an action when onClearFilters is missing", () => {
    renderTable({ records: [], filtered: true });
    expect(screen.getByText("No matching proof history")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Clear filters" })).not.toBeInTheDocument();
  });

  it("renders a row per record with timestamp, UID, status, and hash", () => {
    const records = [
      record({ id: "r1", proof_uid: "uid-1", proof_status: "pending" }),
      record({ id: "r2", proof_uid: null, proof_status: "failed" }),
    ];
    renderTable({ records });

    const rows = screen.getAllByRole("row");
    expect(rows).toHaveLength(3); // header + 2 data rows

    expect(screen.getByText("uid-1")).toBeInTheDocument();
    expect(screen.getByText("—")).toBeInTheDocument();
    expect(screen.getByText("Pending")).toBeInTheDocument();
    expect(screen.getByText("Failed")).toBeInTheDocument();
  });

  it.each([
    ["ready", "On chain"],
    ["on-chain", "On chain"],
    ["completed", "On chain"],
    ["confirmed", "On chain"],
    ["success", "On chain"],
    ["pending", "Pending"],
    ["failed", "Failed"],
    ["error", "Error"],
  ])("maps proof_status %s to label %s", (status, label) => {
    renderTable({ records: [record({ proof_status: status })] });
    expect(screen.getByText(label)).toBeInTheDocument();
  });

  it("falls back to the raw status text for an unrecognized proof_status", () => {
    renderTable({ records: [record({ proof_status: "weird" })] });
    expect(screen.getByText("weird")).toBeInTheDocument();
  });

  it("toggles an individual row via onToggle", async () => {
    const user = userEvent.setup();
    const onToggle = vi.fn();
    renderTable({ records: [record({ id: "r1", proof_uid: "uid-1" })], onToggle });

    await user.click(screen.getByRole("checkbox", { name: "Select proof uid-1" }));
    expect(onToggle).toHaveBeenCalledWith("r1");
  });

  it("toggles all visible rows via the header checkbox", async () => {
    const user = userEvent.setup();
    const onToggleAllVisible = vi.fn();
    renderTable({ records: [record({ id: "r1" }), record({ id: "r2" })], onToggleAllVisible });

    await user.click(screen.getByRole("checkbox", { name: "Select all proofs on this page" }));
    expect(onToggleAllVisible).toHaveBeenCalledOnce();
  });

  it("marks the header checkbox indeterminate when only some rows are selected", () => {
    renderTable({
      records: [record({ id: "r1" }), record({ id: "r2" })],
      selectedIds: ["r1"],
    });

    const headerCheckbox = screen.getByRole("checkbox", {
      name: "Select all proofs on this page",
    }) as HTMLInputElement;
    expect(headerCheckbox.indeterminate).toBe(true);
    expect(headerCheckbox.checked).toBe(false);
  });

  it("marks the header checkbox checked when all visible rows are selected", () => {
    renderTable({
      records: [record({ id: "r1" }), record({ id: "r2" })],
      selectedIds: ["r1", "r2"],
    });

    const headerCheckbox = screen.getByRole("checkbox", {
      name: "Select all proofs on this page",
    }) as HTMLInputElement;
    expect(headerCheckbox.indeterminate).toBe(false);
    expect(headerCheckbox.checked).toBe(true);
  });

  it("shows the selected-count banner with Clear/Download/Delete actions", async () => {
    const user = userEvent.setup();
    const onClearSelection = vi.fn();
    renderTable({
      records: [record({ id: "r1" }), record({ id: "r2" })],
      selectedIds: ["r1", "r2"],
      onClearSelection,
    });

    expect(screen.getByText("2 selected")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Clear" }));
    expect(onClearSelection).toHaveBeenCalledOnce();
  });

  it("hides the selected-count banner when nothing is selected", () => {
    renderTable({ records: [record()], selectedIds: [] });
    expect(screen.queryByRole("region", { name: "Selected proofs" })).not.toBeInTheDocument();
  });

  it("calls onDownloadSelected from the banner and shows the busy label", () => {
    const onDownloadSelected = vi.fn();
    renderTable({
      records: [record({ id: "r1" })],
      selectedIds: ["r1"],
      onDownloadSelected,
      bulkBusy: "download",
    });

    expect(screen.getByRole("button", { name: "Downloading…" })).toBeInTheDocument();
  });

  it("opens a delete confirmation modal and confirms deletion", async () => {
    const user = userEvent.setup();
    const onDeleteSelected = vi.fn();
    renderTable({
      records: [record({ id: "r1" })],
      selectedIds: ["r1"],
      onDeleteSelected,
    });

    await user.click(screen.getByRole("button", { name: "Delete" }));
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByText("Delete this proof?")).toBeInTheDocument();

    await user.click(within(dialog).getByRole("button", { name: "Delete" }));
    expect(onDeleteSelected).toHaveBeenCalledOnce();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("shows plural copy in the delete modal for multiple selections and cancels without deleting", async () => {
    const user = userEvent.setup();
    const onDeleteSelected = vi.fn();
    renderTable({
      records: [record({ id: "r1" }), record({ id: "r2" })],
      selectedIds: ["r1", "r2"],
      onDeleteSelected,
    });

    await user.click(screen.getByRole("button", { name: "Delete" }));
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByText("Delete 2 proofs?")).toBeInTheDocument();

    await user.click(within(dialog).getByRole("button", { name: "Cancel" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(onDeleteSelected).not.toHaveBeenCalled();
  });

  it("opens the details modal with UID, status, hash, and JSON payload", async () => {
    const user = userEvent.setup();
    const item = record({ id: "r1", proof_uid: "uid-1", proof_payload: '{"foo":"bar"}' });
    renderTable({ records: [item] });

    await user.click(screen.getByRole("button", { name: "View details for uid-1" }));

    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByText("Proof details")).toBeInTheDocument();
    expect(within(dialog).getByText(/"foo": "bar"/)).toBeInTheDocument();
  });

  it("shows the error detail panel in the details modal when there is no payload but a proof_error", async () => {
    const user = userEvent.setup();
    const item = record({
      id: "r1",
      proof_uid: "uid-1",
      proof_payload: null,
      proof_error: "Stamp failed",
    });
    renderTable({ records: [item] });

    await user.click(screen.getByRole("button", { name: "View details for uid-1" }));

    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByText("Stamp failed")).toBeInTheDocument();
  });

  it("shows a no-payload empty state in the details modal when there is neither payload nor error", async () => {
    const user = userEvent.setup();
    const item = record({ id: "r1", proof_uid: "uid-1", proof_payload: null, proof_error: null });
    renderTable({ records: [item] });

    await user.click(screen.getByRole("button", { name: "View details for uid-1" }));

    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByText("No payload yet")).toBeInTheDocument();
  });

  it("closes the details modal", async () => {
    const user = userEvent.setup();
    renderTable({ records: [record({ id: "r1", proof_uid: "uid-1" })] });

    await user.click(screen.getByRole("button", { name: "View details for uid-1" }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Close" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("shows the row menu with Verify/Download/Download ZIP and calls the respective callbacks", async () => {
    const user = userEvent.setup();
    const onVerify = vi.fn();
    const onDownload = vi.fn();
    const onDownloadZip = vi.fn();
    const item = record({ id: "r1", proof_uid: "uid-1", proof_payload: "{}" });
    renderTable({ records: [item], onVerify, onDownload, onDownloadZip });

    await user.click(screen.getByRole("button", { name: "More actions for uid-1" }));
    await user.click(screen.getByRole("menuitem", { name: "Verify" }));
    expect(onVerify).toHaveBeenCalledWith(item);

    await user.click(screen.getByRole("button", { name: "More actions for uid-1" }));
    await user.click(screen.getByRole("menuitem", { name: "Download" }));
    expect(onDownload).toHaveBeenCalledWith(item);

    await user.click(screen.getByRole("button", { name: "More actions for uid-1" }));
    await user.click(screen.getByRole("menuitem", { name: "Download ZIP" }));
    expect(onDownloadZip).toHaveBeenCalledWith(item);
  });

  it("disables Verify/Download/Download ZIP in the row menu when there is no payload", async () => {
    const user = userEvent.setup();
    const item = record({ id: "r1", proof_uid: "uid-1", proof_payload: null });
    renderTable({ records: [item] });

    await user.click(screen.getByRole("button", { name: "More actions for uid-1" }));
    expect(screen.getByRole("menuitem", { name: "Verify" })).toBeDisabled();
    expect(screen.getByRole("menuitem", { name: "Download" })).toBeDisabled();
    expect(screen.getByRole("menuitem", { name: "Download ZIP" })).toBeDisabled();
  });

  it("shows a Verifying… label and disables the menu item for the record currently verifying", async () => {
    const user = userEvent.setup();
    const item = record({ id: "r1", proof_uid: "uid-1", proof_payload: "{}" });
    renderTable({ records: [item], verifyingId: "r1" });

    await user.click(screen.getByRole("button", { name: "More actions for uid-1" }));
    expect(screen.getByRole("menuitem", { name: "Verifying…" })).toBeDisabled();
  });
});
