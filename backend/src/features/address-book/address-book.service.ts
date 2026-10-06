import { recordAuditEvent } from "../auth/audit.service.js";
import { getLocalWalletAddresses } from "../wallet/wallet.service.js";
import type { AddressBookEntry } from "./address-book.types.js";
import { ensureLocalAddressBookEntry, getLocalAddressBookEntry } from "./address-book.repository.js";

let initialization: Promise<AddressBookEntry | null> | null = null;

export async function initializeLocalAddressBookEntry(): Promise<AddressBookEntry | null> {
  const existing = getLocalAddressBookEntry();
  if (existing) return existing;
  if (!initialization) {
    initialization = createLocalContact().finally(() => { initialization = null; });
  }
  return initialization;
}

async function createLocalContact(): Promise<AddressBookEntry | null> {
  let addresses: string[];
  try {
    addresses = await getLocalWalletAddresses();
  } catch {
    return null;
  }

  const result = ensureLocalAddressBookEntry(addresses);
  if (result?.changed) {
    recordAuditEvent("address-book.local.create", {
      detail: JSON.stringify({ id: result.entry.id, label: result.entry.label, address: result.entry.address })
    });
  }
  return result?.entry ?? null;
}
