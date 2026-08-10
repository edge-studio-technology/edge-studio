import { useEffect, useState } from "react";
import { Eye, Inbox, Plus, UserPlus } from "lucide-react";
import {
  DataTable,
  RowActions,
  TableBody,
  TableCell,
  TableHead,
  TableHeaderCell,
  TableIconButton,
  TableIconMenu,
  TableRow,
  TableWrap,
} from "../../components/DataTable";
import { CopyableCode } from "../../components/patterns/CopyableCode";
import { DeleteConfirmModal, DeleteProgressModal } from "../../components/patterns/DeleteConfirmModal";
import { EmptyContentState } from "../../components/patterns/EmptyContentState";
import { ErrorAlert } from "../../components/patterns/ErrorAlert";
import { ListFilterBar } from "../../components/patterns/ListFilterBar";
import { ListPaginationFooter } from "../../components/patterns/ListPaginationFooter";
import { LoadingState } from "../../components/patterns/LoadingState";
import { Button } from "../../components/ui/Button";
import { InputField } from "../../components/ui/InputField";
import { Modal } from "../../components/ui/Modal";
import { TruncatedHash } from "../../components/ui/TruncatedHash";
import { useToast } from "../../components/ToastProvider";
import { DEFAULT_PAGE_SIZE_OPTIONS } from "../../lib/paginated";
import {
  createAddressBookEntry,
  deleteAddressBookEntry,
  listAddressBookEntries,
  updateAddressBookEntry,
} from "./addressBookApi";
import type {
  AddressBookEntry,
  CreateAddressBookEntryInput,
  UpdateAddressBookEntryInput,
} from "./addressBookTypes";

const PAGE_SIZE_OPTIONS = DEFAULT_PAGE_SIZE_OPTIONS.map((size) => ({
  value: String(size),
  label: String(size),
}));

function sortByLabel(entries: AddressBookEntry[]): AddressBookEntry[] {
  return [...entries].sort((a, b) =>
    a.label.localeCompare(b.label, undefined, { sensitivity: "base" }),
  );
}

export function AddressBookPanel({ actionsBlocked }: { actionsBlocked: boolean }) {
  const { showToast } = useToast();
  const [entries, setEntries] = useState<AddressBookEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<number>(DEFAULT_PAGE_SIZE_OPTIONS[0]);
  const [addOpen, setAddOpen] = useState(false);
  const [viewEntry, setViewEntry] = useState<AddressBookEntry | null>(null);
  const [editEntry, setEditEntry] = useState<AddressBookEntry | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<AddressBookEntry | null>(null);
  const [deletingEntry, setDeletingEntry] = useState<AddressBookEntry | null>(null);

  useEffect(() => {
    listAddressBookEntries()
      .then(setEntries)
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load address book."))
      .finally(() => setLoading(false));
  }, []);

  function upsertEntry(next: AddressBookEntry) {
    setEntries((prev) => sortByLabel([...prev.filter((e) => e.id !== next.id), next]));
  }

  const isLoading = loading || actionsBlocked;
  const trimmedQuery = query.trim().toLowerCase();
  const filtersActive = Boolean(trimmedQuery);
  const filteredEntries = entries.filter((entry) => {
    if (!trimmedQuery) return true;
    return (
      entry.label.toLowerCase().includes(trimmedQuery) ||
      entry.address.toLowerCase().includes(trimmedQuery) ||
      (entry.notes ?? "").toLowerCase().includes(trimmedQuery)
    );
  });
  const totalPages = Math.max(1, Math.ceil(filteredEntries.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const pagedEntries = filteredEntries.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  function clearFilters() {
    setQuery("");
    setPage(1);
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    const target = deleteTarget;
    setDeleteTarget(null);
    setDeletingEntry(target);
    try {
      await deleteAddressBookEntry(target.id);
      setEntries((prev) => prev.filter((e) => e.id !== target.id));
      showToast({ tone: "success", title: "Contact deleted" });
    } catch (err) {
      showToast({
        tone: "error",
        title: "Delete failed",
        message: err instanceof Error ? err.message : "Could not delete.",
      });
    } finally {
      setDeletingEntry(null);
    }
  }

  return (
    <div className="gap-detail-close flex flex-col">
      <div className="gap-detail-close flex flex-wrap items-end justify-between">
        <div className="min-w-0 flex-1 [&>div]:mb-0">
          <ListFilterBar
            q={query}
            searchPlaceholder="Name, address, or notes"
            disabled={isLoading || entries.length === 0}
            onQueryChange={(q) => {
              setQuery(q);
              setPage(1);
            }}
          />
        </div>
        <Button
          type="button"
          iconStart={<Plus aria-hidden />}
          onClick={() => setAddOpen(true)}
          disabled={actionsBlocked}
        >
          New contact
        </Button>
      </div>

      {error ? (
        <ErrorAlert title="Couldn't load address book" className="w-full max-w-none">
          {error}
        </ErrorAlert>
      ) : null}

      {isLoading ? (
        <LoadingState
          title="Fetching your contacts"
          description="This should take a few seconds."
        />
      ) : filteredEntries.length === 0 ? (
        <EmptyContentState
          icon={filtersActive ? Inbox : UserPlus}
          title={filtersActive ? "No matching contacts" : "Save your first contact"}
          description={
            filtersActive
              ? "Try another search, or clear filters."
              : "Your saved recipients will be added to your address book here."
          }
          actionLabel={filtersActive ? "Clear filters" : "New contact"}
          actionIcon={filtersActive ? undefined : <Plus aria-hidden />}
          actionVariant={filtersActive ? "secondary" : "primary"}
          actionDisabled={!filtersActive && actionsBlocked}
          onAction={filtersActive ? clearFilters : () => setAddOpen(true)}
        />
      ) : (
        <TableWrap>
          <DataTable aria-label="Address book">
            <TableHead>
              <TableHeaderCell className="w-72">Name</TableHeaderCell>
              <TableHeaderCell className="w-40">Address</TableHeaderCell>
              <TableHeaderCell>Notes</TableHeaderCell>
              <TableHeaderCell className="w-px whitespace-nowrap">Actions</TableHeaderCell>
            </TableHead>
            <TableBody>
              {pagedEntries.map((entry) => (
                <TableRow key={entry.id}>
                  <TableCell className="min-w-0">
                    <span className="type-body-em text-text-primary truncate">{entry.label}</span>
                  </TableCell>
                  <TableCell className="min-w-0">
                    <TruncatedHash value={entry.address} />
                  </TableCell>
                  <TableCell className="min-w-0">
                    <span className="type-body text-text-secondary truncate">
                      {entry.notes || "—"}
                    </span>
                  </TableCell>
                  <TableCell className="w-px whitespace-nowrap">
                    <RowActions>
                      <TableIconButton
                        type="button"
                        title="View contact"
                        aria-label={`View ${entry.label}`}
                        onClick={() => setViewEntry(entry)}
                      >
                        <Eye size={16} aria-hidden />
                      </TableIconButton>
                      <TableIconMenu
                        aria-label={`More actions for ${entry.label}`}
                        items={[
                          {
                            label: "Edit",
                            onClick: () => setEditEntry(entry),
                          },
                          {
                            label: "Remove",
                            danger: true,
                            onClick: () => setDeleteTarget(entry),
                          },
                        ]}
                      />
                    </RowActions>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </DataTable>
        </TableWrap>
      )}

      <ListPaginationFooter
        page={currentPage}
        pageSize={pageSize}
        total={filteredEntries.length}
        totalPages={totalPages}
        disabled={isLoading}
        onPageChange={setPage}
        onPageSizeChange={(size) => {
          setPageSize(size);
          setPage(1);
        }}
        pageSizeOptions={PAGE_SIZE_OPTIONS}
      />

      {addOpen ? (
        <AddContactForm
          onSave={async (data) => {
            const entry = await createAddressBookEntry(data);
            upsertEntry(entry);
            setAddOpen(false);
            showToast({ tone: "success", title: "Contact added" });
          }}
          onCancel={() => setAddOpen(false)}
        />
      ) : null}

      {viewEntry ? (
        <ContactDetailModal entry={viewEntry} onClose={() => setViewEntry(null)} />
      ) : null}

      {editEntry ? (
        <EditContactForm
          entry={editEntry}
          onSave={async (data) => {
            const updated = await updateAddressBookEntry(editEntry.id, data);
            upsertEntry(updated);
            setEditEntry(null);
            showToast({ tone: "success", title: "Contact updated" });
          }}
          onCancel={() => setEditEntry(null)}
        />
      ) : null}

      {deletingEntry && (
        <DeleteProgressModal
          title="Deleting contact"
          description={`Removing ${deletingEntry.label}.`}
        />
      )}

      {deleteTarget && (
        <DeleteConfirmModal
          title="Delete contact"
          itemLabel={deleteTarget.label}
          confirmLabel="Delete contact"
          onCancel={() => setDeleteTarget(null)}
          onConfirm={() => void confirmDelete()}
        />
      )}
    </div>
  );
}

function ContactDetailModal({
  entry,
  onClose,
}: {
  entry: AddressBookEntry;
  onClose: () => void;
}) {
  return (
    <Modal title={entry.label} description="Saved recipient details." onClose={onClose}>
      <div className="gap-detail-close grid">
        <section className="gap-detail-next flex flex-col" aria-labelledby="contact-address-label">
          <p className="type-meta text-text-secondary m-0" id="contact-address-label">
            Address
          </p>
          <CopyableCode value={entry.address} />
        </section>

        {entry.notes ? (
          <section className="gap-detail-next flex flex-col" aria-labelledby="contact-notes-label">
            <p className="type-meta text-text-secondary m-0" id="contact-notes-label">
              Notes
            </p>
            <p className="type-body text-text-primary m-0">{entry.notes}</p>
          </section>
        ) : null}
      </div>
    </Modal>
  );
}

function AddContactForm({
  onSave,
  onCancel,
}: {
  onSave: (data: CreateAddressBookEntryInput) => Promise<void>;
  onCancel: () => void;
}) {
  const [label, setLabel] = useState("");
  const [address, setAddress] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimLabel = label.trim();
    const trimAddress = address.trim();
    if (!trimLabel) {
      setFormError("Label is required.");
      return;
    }
    if (trimLabel.length > 80) {
      setFormError("Label must be 80 characters or fewer.");
      return;
    }
    if (!trimAddress) {
      setFormError("Address is required.");
      return;
    }
    if (!/^(Mx|0x)/i.test(trimAddress)) {
      setFormError("Address must start with Mx or 0x.");
      return;
    }
    setFormError(null);
    setSubmitting(true);
    try {
      await onSave({
        label: trimLabel,
        address: trimAddress,
        notes: notes.trim() || null,
      });
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Could not save contact.");
      setSubmitting(false);
    }
  }

  return (
    <Modal
      title="New contact"
      description="Save a recipient for future sends."
      bodyClassName="min-h-0 flex-1"
      onClose={onCancel}
      closeDisabled={submitting}
      footer={
        <>
          <Button type="button" variant="secondary" onClick={onCancel} disabled={submitting}>
            Cancel
          </Button>
          <Button type="submit" form="add-contact-form" disabled={submitting}>
            {submitting ? "Saving…" : "Add contact"}
          </Button>
        </>
      }
    >
      <form id="add-contact-form" onSubmit={handleSubmit} className="gap-detail-close grid">
        <div className="gap-detail-close grid sm:grid-cols-2">
          <InputField
            label="Label"
            description="The label of the contact"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="e.g. Alice"
            maxLength={80}
            autoFocus
            disabled={submitting}
          />
          <InputField
            label="Address"
            description="The Minima address for the contact"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder="Mx… or 0x…"
            autoComplete="off"
            spellCheck={false}
            disabled={submitting}
          />
        </div>
        <InputField
          label="Notes"
          description="Optional note"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="e.g. Alice's main wallet"
          disabled={submitting}
        />
        {formError ? (
          <ErrorAlert title="Couldn't save contact" className="w-full max-w-none">
            {formError}
          </ErrorAlert>
        ) : null}
      </form>
    </Modal>
  );
}

function EditContactForm({
  entry,
  onSave,
  onCancel,
}: {
  entry: AddressBookEntry;
  onSave: (data: UpdateAddressBookEntryInput) => Promise<void>;
  onCancel: () => void;
}) {
  const [label, setLabel] = useState(entry.label);
  const [notes, setNotes] = useState(entry.notes ?? "");
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimLabel = label.trim();
    if (!trimLabel) {
      setFormError("Label is required.");
      return;
    }
    if (trimLabel.length > 80) {
      setFormError("Label must be 80 characters or fewer.");
      return;
    }
    setFormError(null);
    setSubmitting(true);
    try {
      await onSave({ label: trimLabel, notes: notes.trim() || null });
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Could not update contact.");
      setSubmitting(false);
    }
  }

  return (
    <Modal
      title="Edit contact"
      onClose={onCancel}
      closeDisabled={submitting}
      bodyClassName="min-h-0 flex-1"
      footer={
        <>
          <Button type="button" variant="secondary" onClick={onCancel} disabled={submitting}>
            Cancel
          </Button>
          <Button type="submit" form="edit-contact-form" disabled={submitting}>
            {submitting ? "Saving…" : "Save changes"}
          </Button>
        </>
      }
    >
      <form id="edit-contact-form" onSubmit={handleSubmit} className="gap-detail-close grid">
        <section
          className="gap-detail-next flex flex-col"
          aria-labelledby="edit-contact-address-label"
        >
          <p className="type-meta text-text-secondary m-0" id="edit-contact-address-label">
            Address
          </p>
          <CopyableCode value={entry.address} />
        </section>
        <div className="gap-detail-close grid sm:grid-cols-2">
          <InputField
            label="Label"
            description="Name of the contact"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            maxLength={80}
            autoFocus
            disabled={submitting}
          />
          <InputField
            label="Notes"
            description="Optional note"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="e.g. Alice's main wallet"
            disabled={submitting}
          />
        </div>
        {formError ? (
          <ErrorAlert title="Couldn't update contact" className="w-full max-w-none">
            {formError}
          </ErrorAlert>
        ) : null}
      </form>
    </Modal>
  );
}
