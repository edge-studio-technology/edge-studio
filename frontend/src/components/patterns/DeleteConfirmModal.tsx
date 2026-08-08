import { Trash2 } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "../ui/Button";
import { Modal } from "../ui/Modal";
import { SpinnerAlt } from "../ui/SpinnerAlt";
import { ButtonRow } from "./ButtonRow";

export function DeleteConfirmModal({
  title,
  itemLabel,
  confirmLabel,
  description = "This can't be undone.",
  onCancel,
  onConfirm,
}: {
  title: string;
  itemLabel: ReactNode;
  confirmLabel: string;
  description?: ReactNode;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <Modal title={title} onClose={onCancel} bodyClassName="min-h-0 flex-1">
      <div className="gap-detail-near grid min-h-56 place-items-center text-center">
        <Trash2 size={40} className="text-icon-secondary" aria-hidden />
        <div className="gap-detail-tight grid">
          <p className="type-title text-text-primary m-0">Delete {itemLabel}?</p>
          <p className="type-body text-text-secondary m-0 mt-4">{description}</p>
        </div>
        <ButtonRow>
          <Button variant="secondary" onClick={onCancel}>
            Cancel
          </Button>
          <Button variant="danger" onClick={onConfirm}>
            {confirmLabel}
          </Button>
        </ButtonRow>
      </div>
    </Modal>
  );
}

export function DeleteProgressModal({
  title,
  description,
}: {
  title: string;
  description: ReactNode;
}) {
  return (
    <Modal title={title} closeDisabled onClose={() => undefined} bodyClassName="min-h-0 flex-1">
      <div className="gap-detail-near grid min-h-56 place-items-center text-center">
        <SpinnerAlt size="lg" />
        <div className="gap-detail-tight grid">
          <p className="type-title text-text-primary m-0">Deleting in progress</p>
          <p className="type-body text-text-secondary m-0 mt-4">{description}</p>
        </div>
      </div>
    </Modal>
  );
}
