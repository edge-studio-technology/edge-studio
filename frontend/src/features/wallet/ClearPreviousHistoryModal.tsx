import { useState } from "react";
import { Trash2 } from "lucide-react";
import { ErrorText } from "../../components/Text";
import { Button } from "../../components/ui/Button";
import { CredentialField } from "../../components/ui/CredentialField";
import { Modal } from "../../components/ui/Modal";
import { adminCredentialLabel, isAdminCredentialEntryReady } from "../auth/adminCredentials";
import { useAuth } from "../auth/hooks";
import { clearPreviousWalletHistory } from "./walletApi";

export function ClearPreviousHistoryModal({
  itemCount,
  onClose,
  onCleared,
}: {
  itemCount: number;
  onClose: () => void;
  onCleared: (deleted: number) => Promise<void> | void;
}) {
  const { user } = useAuth();
  const credentialType = user?.credentialType ?? null;
  const credentialLabel = adminCredentialLabel(credentialType);
  const [currentPassword, setCurrentPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const ready = isAdminCredentialEntryReady(credentialType, currentPassword);

  async function confirm() {
    if (busy || !ready) return;
    setBusy(true);
    setError(null);
    try {
      const { deleted } = await clearPreviousWalletHistory(currentPassword);
      await onCleared(deleted);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Invalid current credential");
      setBusy(false);
    }
  }

  return (
    <Modal
      title="Clear previous wallet history"
      onClose={() => {
        if (!busy) onClose();
      }}
      closeDisabled={busy}
      bodyClassName="min-h-0 flex-1"
      footer={
        <>
          <Button type="button" variant="secondary" disabled={busy} onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="danger"
            iconStart={<Trash2 aria-hidden />}
            disabled={busy || !ready}
            onClick={() => void confirm()}
          >
            {busy ? "Clearing…" : "Clear history"}
          </Button>
        </>
      }
    >
      <form
        className="grid gap-3"
        onSubmit={(event) => {
          event.preventDefault();
          void confirm();
        }}
      >
        <p className="type-body text-text-secondary m-0">
          {itemCount === 1 ? "1 item" : `${itemCount} items`} recorded under a wallet this node no
          longer uses will be deleted. History of the current wallet is kept. This can't be undone.
        </p>
        <CredentialField
          credentialType={credentialType}
          label={`Current ${credentialLabel}`}
          value={currentPassword}
          onChange={(value) => {
            setCurrentPassword(value);
            setError(null);
          }}
          autoComplete="current-password"
        />
        {error ? <ErrorText className="m-0">{error}</ErrorText> : null}
      </form>
    </Modal>
  );
}
