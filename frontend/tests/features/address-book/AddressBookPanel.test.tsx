import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AddressBookPanel } from "../../../src/features/address-book/AddressBookPanel";
import { ToastProvider } from "../../../src/components/ToastProvider";
import type { AddressBookEntry } from "../../../src/features/address-book/addressBookTypes";

const listAddressBookEntries = vi.fn();
const createAddressBookEntry = vi.fn();
const updateAddressBookEntry = vi.fn();
const deleteAddressBookEntry = vi.fn();

vi.mock("../../../src/features/address-book/addressBookApi", () => ({
  listAddressBookEntries: (...args: unknown[]) => listAddressBookEntries(...args),
  createAddressBookEntry: (...args: unknown[]) => createAddressBookEntry(...args),
  updateAddressBookEntry: (...args: unknown[]) => updateAddressBookEntry(...args),
  deleteAddressBookEntry: (...args: unknown[]) => deleteAddressBookEntry(...args),
}));

function entry(overrides: Partial<AddressBookEntry> = {}): AddressBookEntry {
  return {
    id: "1",
    label: "Bob",
    address: "Mx1234567890",
    notes: null,
    created_at: "2026-08-01T00:00:00.000Z",
    ...overrides,
  };
}

function renderPanel(actionsBlocked = false) {
  return render(<AddressBookPanel actionsBlocked={actionsBlocked} />, { wrapper: ToastProvider });
}

describe("AddressBookPanel", () => {
  beforeEach(() => {
    listAddressBookEntries.mockReset();
    createAddressBookEntry.mockReset();
    updateAddressBookEntry.mockReset();
    deleteAddressBookEntry.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("shows a loading state while fetching, then the empty state when there are no contacts", async () => {
    listAddressBookEntries.mockResolvedValue([]);
    renderPanel();

    expect(screen.getByText("Fetching your contacts")).toBeInTheDocument();

    expect(await screen.findByText("Save your first contact")).toBeInTheDocument();
    expect(
      screen.getByText("Your saved recipients will be added to your address book here."),
    ).toBeInTheDocument();
  });

  it("shows an error alert when the initial fetch fails", async () => {
    listAddressBookEntries.mockRejectedValue(new Error("network down"));
    renderPanel();

    expect(await screen.findByText("Couldn't load address book")).toBeInTheDocument();
    expect(screen.getByText("network down")).toBeInTheDocument();
  });

  it("renders contacts sorted by label with a fallback for missing notes", async () => {
    listAddressBookEntries.mockResolvedValue([
      entry({ id: "2", label: "Zoe", address: "Mx2", notes: "Work wallet" }),
      entry({ id: "1", label: "Alice", address: "0xabc", notes: null }),
    ]);
    renderPanel();

    const table = await screen.findByRole("table", { name: "Address book" });
    expect(within(table).getByText("Zoe")).toBeInTheDocument();
    expect(within(table).getByText("Alice")).toBeInTheDocument();
    expect(within(table).getByText("Work wallet")).toBeInTheDocument();
    expect(within(table).getByText("—")).toBeInTheDocument();
  });

  it("re-sorts the list by label after adding a contact", async () => {
    listAddressBookEntries.mockResolvedValue([entry({ id: "1", label: "Zoe", address: "Mx1" })]);
    createAddressBookEntry.mockResolvedValue(entry({ id: "2", label: "Amy", address: "Mx2" }));
    renderPanel();
    const table = await screen.findByRole("table", { name: "Address book" });

    await userEvent.click(screen.getByRole("button", { name: "New contact" }));
    const dialog = screen.getByRole("dialog", { name: "New contact" });
    await userEvent.type(within(dialog).getByLabelText("Label"), "Amy");
    await userEvent.type(within(dialog).getByLabelText("Address"), "Mx2");
    await userEvent.click(within(dialog).getByRole("button", { name: "Add contact" }));
    await waitFor(() => expect(createAddressBookEntry).toHaveBeenCalled());

    const labels = within(table)
      .getAllByRole("row")
      .slice(1)
      .map((row) => within(row).getByText(/Amy|Zoe/).textContent);
    expect(labels).toEqual(["Amy", "Zoe"]);
  });

  it("filters contacts by label, address, or notes and clears filters from the empty state", async () => {
    listAddressBookEntries.mockResolvedValue([
      entry({ id: "1", label: "Alice", address: "Mx1", notes: null }),
      entry({ id: "2", label: "Zoe", address: "Mx2", notes: null }),
    ]);
    renderPanel();
    await screen.findByRole("table", { name: "Address book" });

    await userEvent.type(screen.getByLabelText("Search"), "alice");
    await waitFor(() => {
      expect(screen.queryByText("Zoe")).not.toBeInTheDocument();
    });
    expect(screen.getByText("Alice")).toBeInTheDocument();

    await userEvent.clear(screen.getByLabelText("Search"));
    await userEvent.type(screen.getByLabelText("Search"), "nomatch");
    expect(await screen.findByText("No matching contacts")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Clear filters" }));
    expect(await screen.findByRole("table", { name: "Address book" })).toBeInTheDocument();
    expect(screen.getByLabelText("Search")).toHaveValue("");
  });

  it("opens the view modal for a contact and shows its address and notes", async () => {
    listAddressBookEntries.mockResolvedValue([
      entry({ label: "Alice", address: "Mx1", notes: "Main wallet" }),
    ]);
    renderPanel();
    await screen.findByRole("table", { name: "Address book" });

    await userEvent.click(screen.getByRole("button", { name: "View Alice" }));

    const dialog = screen.getByRole("dialog", { name: "Alice" });
    expect(within(dialog).getByText("Mx1")).toBeInTheDocument();
    expect(within(dialog).getByText("Main wallet")).toBeInTheDocument();

    await userEvent.click(within(dialog).getByRole("button", { name: "Close" }));
    expect(screen.queryByRole("dialog", { name: "Alice" })).not.toBeInTheDocument();
  });

  it("does not render a notes section in the view modal when there are no notes", async () => {
    listAddressBookEntries.mockResolvedValue([entry({ label: "Alice", address: "Mx1", notes: null })]);
    renderPanel();
    await screen.findByRole("table", { name: "Address book" });

    await userEvent.click(screen.getByRole("button", { name: "View Alice" }));

    const dialog = screen.getByRole("dialog", { name: "Alice" });
    expect(within(dialog).queryByText("Notes")).not.toBeInTheDocument();
  });

  it("adds a new contact and shows a success toast", async () => {
    listAddressBookEntries.mockResolvedValue([]);
    const created = entry({ id: "9", label: "Carol", address: "Mx9", notes: "friend" });
    createAddressBookEntry.mockResolvedValue(created);
    renderPanel();
    await screen.findByText("Save your first contact");

    // Both the header button and the empty-state action are labelled "New contact" here.
    await userEvent.click(screen.getAllByRole("button", { name: "New contact" })[0]);
    const dialog = screen.getByRole("dialog", { name: "New contact" });
    await userEvent.type(within(dialog).getByLabelText("Label"), "  Carol  ");
    await userEvent.type(within(dialog).getByLabelText("Address"), "  Mx9  ");
    await userEvent.type(within(dialog).getByLabelText("Notes"), " friend ");
    await userEvent.click(within(dialog).getByRole("button", { name: "Add contact" }));

    await waitFor(() => {
      expect(createAddressBookEntry).toHaveBeenCalledWith({
        label: "Carol",
        address: "Mx9",
        notes: "friend",
      });
    });
    expect(screen.queryByRole("dialog", { name: "New contact" })).not.toBeInTheDocument();
    expect(await screen.findByText("Contact added")).toBeInTheDocument();
    expect(screen.getByText("Carol")).toBeInTheDocument();
  });

  it("sends null notes when the notes field is left blank", async () => {
    listAddressBookEntries.mockResolvedValue([]);
    createAddressBookEntry.mockResolvedValue(entry({ id: "9", label: "Carol", address: "Mx9" }));
    renderPanel();
    await screen.findByText("Save your first contact");

    await userEvent.click(screen.getAllByRole("button", { name: "New contact" })[0]);
    const dialog = screen.getByRole("dialog", { name: "New contact" });
    await userEvent.type(within(dialog).getByLabelText("Label"), "Carol");
    await userEvent.type(within(dialog).getByLabelText("Address"), "Mx9");
    await userEvent.click(within(dialog).getByRole("button", { name: "Add contact" }));

    await waitFor(() => {
      expect(createAddressBookEntry).toHaveBeenCalledWith({
        label: "Carol",
        address: "Mx9",
        notes: null,
      });
    });
  });

  it("validates required label before calling the API", async () => {
    listAddressBookEntries.mockResolvedValue([]);
    renderPanel();
    await screen.findByText("Save your first contact");

    await userEvent.click(screen.getAllByRole("button", { name: "New contact" })[0]);
    const dialog = screen.getByRole("dialog", { name: "New contact" });
    await userEvent.type(within(dialog).getByLabelText("Address"), "Mx9");
    await userEvent.click(within(dialog).getByRole("button", { name: "Add contact" }));

    expect(await within(dialog).findByText("Label is required.")).toBeInTheDocument();
    expect(createAddressBookEntry).not.toHaveBeenCalled();
  });

  it("validates the address prefix before calling the API", async () => {
    listAddressBookEntries.mockResolvedValue([]);
    renderPanel();
    await screen.findByText("Save your first contact");

    await userEvent.click(screen.getAllByRole("button", { name: "New contact" })[0]);
    const dialog = screen.getByRole("dialog", { name: "New contact" });
    await userEvent.type(within(dialog).getByLabelText("Label"), "Carol");
    await userEvent.type(within(dialog).getByLabelText("Address"), "not-an-address");
    await userEvent.click(within(dialog).getByRole("button", { name: "Add contact" }));

    expect(await within(dialog).findByText("Address must start with Mx or 0x.")).toBeInTheDocument();
    expect(createAddressBookEntry).not.toHaveBeenCalled();
  });

  it("shows a form error and keeps the modal open when saving a new contact fails", async () => {
    listAddressBookEntries.mockResolvedValue([]);
    createAddressBookEntry.mockRejectedValue(new Error("label already used"));
    renderPanel();
    await screen.findByText("Save your first contact");

    await userEvent.click(screen.getAllByRole("button", { name: "New contact" })[0]);
    const dialog = screen.getByRole("dialog", { name: "New contact" });
    await userEvent.type(within(dialog).getByLabelText("Label"), "Carol");
    await userEvent.type(within(dialog).getByLabelText("Address"), "Mx9");
    await userEvent.click(within(dialog).getByRole("button", { name: "Add contact" }));

    expect(await within(dialog).findByText("label already used")).toBeInTheDocument();
    expect(screen.getByRole("dialog", { name: "New contact" })).toBeInTheDocument();
  });

  it("edits an existing contact via the row menu and shows a success toast", async () => {
    listAddressBookEntries.mockResolvedValue([entry({ id: "1", label: "Alice", address: "Mx1", notes: null })]);
    const updated = entry({ id: "1", label: "Alicia", address: "Mx1", notes: null });
    updateAddressBookEntry.mockResolvedValue(updated);
    renderPanel();
    await screen.findByRole("table", { name: "Address book" });

    await userEvent.click(screen.getByRole("button", { name: "More actions for Alice" }));
    await userEvent.click(screen.getByRole("menuitem", { name: "Edit" }));

    const dialog = screen.getByRole("dialog", { name: "Edit contact" });
    const labelField = within(dialog).getByLabelText("Label");
    expect(labelField).toHaveValue("Alice");
    await userEvent.clear(labelField);
    await userEvent.type(labelField, "Alicia");
    await userEvent.click(within(dialog).getByRole("button", { name: "Save changes" }));

    await waitFor(() => {
      expect(updateAddressBookEntry).toHaveBeenCalledWith("1", {
        label: "Alicia",
        address: "Mx1",
        notes: null,
      });
    });
    expect(screen.queryByRole("dialog", { name: "Edit contact" })).not.toBeInTheDocument();
    expect(await screen.findByText("Contact updated")).toBeInTheDocument();
    expect(screen.getByText("Alicia")).toBeInTheDocument();
  });

  it("deletes a contact via the row menu after confirming, showing progress then a success toast", async () => {
    listAddressBookEntries.mockResolvedValue([entry({ id: "1", label: "Alice", address: "Mx1" })]);
    let resolveDelete: () => void = () => {};
    deleteAddressBookEntry.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          resolveDelete = resolve;
        }),
    );
    renderPanel();
    await screen.findByRole("table", { name: "Address book" });

    await userEvent.click(screen.getByRole("button", { name: "More actions for Alice" }));
    await userEvent.click(screen.getByRole("menuitem", { name: "Remove" }));

    const confirmDialog = screen.getByRole("dialog");
    expect(within(confirmDialog).getByText("Delete Alice?")).toBeInTheDocument();
    await userEvent.click(within(confirmDialog).getByRole("button", { name: "Delete contact" }));

    expect(await screen.findByText("Deleting contact")).toBeInTheDocument();
    expect(deleteAddressBookEntry).toHaveBeenCalledWith("1");

    resolveDelete();

    expect(await screen.findByText("Contact deleted")).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.queryByText("Alice")).not.toBeInTheDocument();
    });
  });

  it("shows an error toast and keeps the contact when delete fails", async () => {
    listAddressBookEntries.mockResolvedValue([entry({ id: "1", label: "Alice", address: "Mx1" })]);
    deleteAddressBookEntry.mockRejectedValue(new Error("cannot delete"));
    renderPanel();
    await screen.findByRole("table", { name: "Address book" });

    await userEvent.click(screen.getByRole("button", { name: "More actions for Alice" }));
    await userEvent.click(screen.getByRole("menuitem", { name: "Remove" }));
    await userEvent.click(screen.getByRole("button", { name: "Delete contact" }));

    expect(await screen.findByText("Delete failed")).toBeInTheDocument();
    expect(screen.getByText("cannot delete")).toBeInTheDocument();
    expect(screen.getByText("Alice")).toBeInTheDocument();
  });

  it("disables the new-contact action and forces the loading state while actionsBlocked", async () => {
    listAddressBookEntries.mockResolvedValue([entry({ label: "Alice", address: "Mx1" })]);
    renderPanel(true);

    await waitFor(() => {
      expect(listAddressBookEntries).toHaveBeenCalled();
    });
    expect(screen.getByText("Fetching your contacts")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "New contact" })).toBeDisabled();
  });
});
