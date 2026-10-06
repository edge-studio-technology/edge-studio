import { recordAuditEvent } from "../auth/audit.service.js";
import { db } from "../../db/database.js";
import { getLocalWalletAddresses, isLocalWalletReadyForVerification } from "../wallet/wallet.service.js";
import type { AddressBookEntry } from "./address-book.types.js";
import { getLocalAddressBookEntry, getLocalWalletVerificationRevision, reconcileLocalAddressBookEntry } from "./address-book.repository.js";
import { isWalletReplacementInProgress } from "./wallet-replacement.service.js";

let initialization: Promise<AddressBookEntry | null> | null = null;

export async function initializeLocalAddressBookEntry(): Promise<AddressBookEntry | null> {
  const existing = getLocalAddressBookEntry();
  if (isWalletReplacementInProgress() || (existing && !existing.isLocalDevicePending)) return existing;
  if (!initialization) {
    initialization = createLocalContact().finally(() => { initialization = null; });
  }
  return initialization;
}

async function createLocalContact(): Promise<AddressBookEntry | null> {
  const revision = getLocalWalletVerificationRevision();
  let addresses: string[];
  try {
    if (revision && !await isLocalWalletReadyForVerification()) return null;
    addresses = await getLocalWalletAddresses();
  } catch {
    return null;
  }

  if (isWalletReplacementInProgress()) return null;
  return db.transaction(() => {
    const result = reconcileLocalAddressBookEntry(addresses, revision);
    if (result?.changed) {
      recordAuditEvent(result.previousAddress === null ? "address-book.local.create" : "address-book.local.replace", {
        detail: JSON.stringify(result.previousAddress === null
          ? { id: result.entry.id, label: result.entry.label, address: result.entry.address }
          : { id: result.entry.id, oldAddress: result.previousAddress, newAddress: result.entry.address })
      });
    }
    return result?.entry ?? null;
  }).immediate();
}
