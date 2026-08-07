import { Loader2, Trash2 } from "lucide-react";
import { Button } from "../../components/Button";
import { ButtonRow } from "../../components/ButtonRow";
import { Modal } from "../../components/Modal";
import type { DataSource } from "./dataSourceTypes";

export function DeleteDeviceConfirmModal({
  source,
  onCancel,
  onConfirm,
}: {
  source: DataSource;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <Modal title="Delete device" onClose={onCancel} bodyClassName="min-h-0 flex-1">
      <div className="gap-detail-near grid min-h-56 place-items-center text-center">
        <Trash2 size={40} className="text-icon-error" aria-hidden />
        <div className="gap-detail-tight grid">
          <p className="type-title text-text-primary m-0">Delete {source.name}?</p>
          <p className="type-body text-text-secondary m-0 max-w-xl">This can't be undone.</p>
        </div>
        <ButtonRow>
          <Button variant="secondary" onClick={onCancel}>
            Cancel
          </Button>
          <Button variant="danger" onClick={onConfirm}>
            Delete device
          </Button>
        </ButtonRow>
      </div>
    </Modal>
  );
}

export function DeleteDeviceProgressModal({ source }: { source: DataSource }) {
  return (
    <Modal
      title="Deleting device"
      closeDisabled
      onClose={() => undefined}
      bodyClassName="min-h-0 flex-1"
    >
      <div className="gap-detail-near grid min-h-56 place-items-center text-center">
        <Loader2 size={64} className="text-icon-primary animate-spin" aria-hidden />
        <div className="gap-detail-tight grid">
          <p className="type-title text-text-primary m-0">Deleting in progress</p>
          <p className="type-body text-text-secondary m-0 max-w-xl">
            Removing {source.name}. Large read histories can take a few seconds while saved read
            rows are detached from this device.
          </p>
        </div>
      </div>
    </Modal>
  );
}
