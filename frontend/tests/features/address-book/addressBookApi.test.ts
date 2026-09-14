import { describe, expect, it, vi } from "vitest";

const getJson = vi.fn();
const postJson = vi.fn();
const patchJson = vi.fn();
const deleteJson = vi.fn();

vi.mock("../../../src/lib/api", () => ({
  getJson: (...args: unknown[]) => getJson(...args),
  postJson: (...args: unknown[]) => postJson(...args),
  patchJson: (...args: unknown[]) => patchJson(...args),
  deleteJson: (...args: unknown[]) => deleteJson(...args),
}));

import {
  createAddressBookEntry,
  deleteAddressBookEntry,
  listAddressBookEntries,
  updateAddressBookEntry,
} from "../../../src/features/address-book/addressBookApi";

describe("addressBookApi", () => {
  it("listAddressBookEntries GETs the address book list", async () => {
    const entries = [{ id: "1", label: "Alice", address: "Mx1", notes: null, created_at: "now" }];
    getJson.mockResolvedValue(entries);

    const result = await listAddressBookEntries();

    expect(getJson).toHaveBeenCalledWith("/api/wallet/address-book");
    expect(result).toBe(entries);
  });

  it("createAddressBookEntry POSTs the given body", async () => {
    const entry = { id: "1", label: "Alice", address: "Mx1", notes: null, created_at: "now" };
    postJson.mockResolvedValue(entry);

    const result = await createAddressBookEntry({ label: "Alice", address: "Mx1" });

    expect(postJson).toHaveBeenCalledWith("/api/wallet/address-book", {
      label: "Alice",
      address: "Mx1",
    });
    expect(result).toBe(entry);
  });

  it("updateAddressBookEntry PATCHes the entry by id", async () => {
    const entry = { id: "1", label: "Alicia", address: "Mx1", notes: null, created_at: "now" };
    patchJson.mockResolvedValue(entry);

    const result = await updateAddressBookEntry("1", { label: "Alicia" });

    expect(patchJson).toHaveBeenCalledWith("/api/wallet/address-book/1", { label: "Alicia" });
    expect(result).toBe(entry);
  });

  it("deleteAddressBookEntry DELETEs the entry by id and returns nothing", async () => {
    deleteJson.mockResolvedValue({});

    const result = await deleteAddressBookEntry("1");

    expect(deleteJson).toHaveBeenCalledWith("/api/wallet/address-book/1");
    expect(result).toBeUndefined();
  });
});
