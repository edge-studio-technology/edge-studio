import crypto from "node:crypto";
import { db } from "../../db/database.js";
import { canonicalMinimaAddress } from "../../shared/minima-address.js";
import type { AddressBookEntry } from "./address-book.types.js";

type AddressBookRow = Omit<AddressBookEntry, "isLocalDevice"> & { is_local_device: number };

function mapEntry({ is_local_device, ...entry }: AddressBookRow): AddressBookEntry {
  return { ...entry, isLocalDevice: is_local_device === 1 };
}

export function listAddressBookEntries(): AddressBookEntry[] {
  const rows = db.prepare(`
    SELECT id, label, address, notes, created_at, is_local_device
    FROM address_book
    ORDER BY label COLLATE NOCASE ASC
  `).all() as AddressBookRow[];
  return rows.map(mapEntry);
}

export function getAddressBookEntryById(id: string): AddressBookEntry | null {
  const row = db.prepare(`
    SELECT id, label, address, notes, created_at, is_local_device
    FROM address_book
    WHERE id = ?
    LIMIT 1
  `).get(id) as AddressBookRow | undefined;
  return row ? mapEntry(row) : null;
}

/** Finds an ordinary contact for manual-contact uniqueness checks. */
export function getAddressBookEntryByAddress(address: string): AddressBookEntry | null {
  const row = db.prepare(`
    SELECT id, label, address, notes, created_at, is_local_device
    FROM address_book
    WHERE address = ? AND is_local_device = 0
    LIMIT 1
  `).get(address) as AddressBookRow | undefined;
  return row ? mapEntry(row) : null;
}

export function getLocalAddressBookEntry(): AddressBookEntry | null {
  const row = db.prepare(`
    SELECT id, label, address, notes, created_at, is_local_device
    FROM address_book WHERE is_local_device = 1
  `).get() as AddressBookRow | undefined;
  return row ? mapEntry(row) : null;
}

export function ensureLocalAddressBookEntry(addresses: readonly string[]): {
  entry: AddressBookEntry;
  changed: boolean;
} | null {
  return db.transaction(() => {
    const local = getLocalAddressBookEntry();
    if (local) return { entry: local, changed: false };
    if (addresses.length === 0) return null;

    const candidates = addresses.map((address) => {
      const canonical = canonicalMinimaAddress(address);
      if (canonical === null) throw new Error("Invalid local wallet address");
      return { address: address.trim(), canonical };
    }).sort((a, b) => a.canonical.localeCompare(b.canonical) || a.address.localeCompare(b.address));

    const id = crypto.randomUUID();
    db.prepare(`
      INSERT INTO address_book (id, label, address, notes, created_at, is_local_device)
      VALUES (?, 'This device', ?, NULL, ?, 1)
    `).run(id, candidates[0].address, new Date().toISOString());
    return { entry: getAddressBookEntryById(id)!, changed: true };
  }).immediate();
}

export function insertAddressBookEntry(input: {
  label: string;
  address: string;
  notes: string | null;
}): AddressBookEntry {
  const id = crypto.randomUUID();
  const createdAt = new Date().toISOString();
  db.prepare(`
    INSERT INTO address_book (id, label, address, notes, created_at)
    VALUES (?, ?, ?, ?, ?)
  `).run(id, input.label, input.address, input.notes, createdAt);
  return getAddressBookEntryById(id)!;
}

export function updateAddressBookEntry(
  id: string,
  input: { label?: string; address?: string; notes?: string | null }
): AddressBookEntry | null {
  const entry = getAddressBookEntryById(id);
  if (!entry) return null;

  const newLabel = input.label ?? entry.label;
  const newAddress = input.address ?? entry.address;
  const newNotes = input.notes !== undefined ? input.notes : entry.notes;

  db.prepare(`
    UPDATE address_book SET label = ?, address = ?, notes = ? WHERE id = ?
  `).run(newLabel, newAddress, newNotes, id);

  return getAddressBookEntryById(id)!;
}

export function deleteAddressBookEntry(id: string): boolean {
  const result = db.prepare(`DELETE FROM address_book WHERE id = ?`).run(id);
  return result.changes > 0;
}
