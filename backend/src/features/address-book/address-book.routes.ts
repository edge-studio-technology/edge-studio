import { Router } from "express";
import { badRequest, conflict, notFound, unexpected, validationFailed } from "../../shared/api-error.js";
import { recordAuditEvent } from "../auth/audit.service.js";
import { requireRole } from "../auth/auth.middleware.js";
import { isMinimaAddress } from "../../shared/minima-address.js";
import { initializeLocalAddressBookEntry } from "./address-book.service.js";
import {
  deleteAddressBookEntry,
  getAddressBookEntryByAddress,
  getAddressBookEntryById,
  insertAddressBookEntry,
  listAddressBookEntries,
  updateAddressBookEntry,
} from "./address-book.repository.js";

export const addressBookRouter = Router();

addressBookRouter.get("/", async (_req, res) => {
  try {
    await initializeLocalAddressBookEntry();
    res.json(listAddressBookEntries());
  } catch {
    return unexpected(res, "Could not load the address book. Please try again.");
  }
});

addressBookRouter.post("/", requireRole("admin"), (req, res) => {
  const label = typeof req.body?.label === "string" ? req.body.label.trim() : "";
  const address = typeof req.body?.address === "string" ? req.body.address.trim() : "";
  const notes = typeof req.body?.notes === "string" ? req.body.notes.trim() || null : null;

  if (!label) return validationFailed(res, "label is required", { label: "label is required" }, { ok: false });
  if (label.length > 80) return validationFailed(res, "label must be 80 characters or fewer", { label: "label must be 80 characters or fewer" }, { ok: false });
  if (!address) return validationFailed(res, "address is required", { address: "address is required" }, { ok: false });
  if (!isMinimaAddress(address)) {
    return badRequest(res, "address must be a valid Minima Mx or 0x address", { field: "address" }, { ok: false });
  }

  const existing = getAddressBookEntryByAddress(address);
  if (existing) return conflict(res, "address already exists in address book", { address }, { ok: false });

  const entry = insertAddressBookEntry({ label, address, notes });
  recordAuditEvent("address-book.create", {
    userId: req.user?.id,
    detail: JSON.stringify({ id: entry.id, label: entry.label, address: entry.address }),
  });
  res.status(201).json(entry);
});

addressBookRouter.patch("/:id", requireRole("admin"), (req, res) => {
  const { id } = req.params;

  const entry = getAddressBookEntryById(id);
  if (!entry) return notFound(res, "entry not found", { ok: false });

  const label = typeof req.body?.label === "string" ? req.body.label.trim() : undefined;
  const address = typeof req.body?.address === "string" ? req.body.address.trim() : undefined;
  const notes =
    req.body?.notes !== undefined
      ? typeof req.body.notes === "string"
        ? req.body.notes.trim() || null
        : null
      : undefined;

  if (entry.isLocalDevice && (
    (label !== undefined && label !== entry.label) ||
    (address !== undefined && address !== entry.address)
  )) {
    return conflict(res, "This device is managed by the app. Only notes can be edited.", { id }, { ok: false });
  }

  if (label !== undefined && !label) {
    return validationFailed(res, "label cannot be empty", { label: "label cannot be empty" }, { ok: false });
  }
  if (label !== undefined && label.length > 80) {
    return validationFailed(res, "label must be 80 characters or fewer", { label: "label must be 80 characters or fewer" }, { ok: false });
  }
  if (address !== undefined) {
    if (!address) {
      return validationFailed(res, "address cannot be empty", { address: "address cannot be empty" }, { ok: false });
    }
    if (!isMinimaAddress(address)) {
      return badRequest(res, "address must be a valid Minima Mx or 0x address", { field: "address" }, { ok: false });
    }
    const existing = entry.isLocalDevice ? null : getAddressBookEntryByAddress(address);
    if (existing && existing.id !== id) {
      return conflict(res, "address already exists in address book", { address }, { ok: false });
    }
  }

  const updated = updateAddressBookEntry(id, { label, address, notes });
  recordAuditEvent("address-book.update", {
    userId: req.user?.id,
    detail: JSON.stringify({ id, label: updated?.label }),
  });
  res.json(updated);
});

addressBookRouter.delete("/:id", requireRole("admin"), (req, res) => {
  const { id } = req.params;

  const entry = getAddressBookEntryById(id);
  if (!entry) return notFound(res, "entry not found", { ok: false });

  if (entry.isLocalDevice) {
    return conflict(res, "This device is managed by the app and cannot be deleted.", { id }, { ok: false });
  }

  deleteAddressBookEntry(id);
  recordAuditEvent("address-book.delete", {
    userId: req.user?.id,
    detail: JSON.stringify({ id, label: entry.label, address: entry.address }),
  });
  res.status(204).send();
});
