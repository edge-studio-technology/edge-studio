import { useState } from "react";
import { ErrorAlert } from "../../components/patterns/ErrorAlert";
import { Button } from "../../components/ui/Button";
import { InputField } from "../../components/ui/InputField";
import { Modal } from "../../components/ui/Modal";
import type { CreateAddressBookEntryInput } from "./addressBookTypes";

export function AddContactModal({
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
