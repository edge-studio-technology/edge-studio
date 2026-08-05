import { useEffect, useState } from "react";
import { CopyableCode } from "../../components/patterns/CopyableCode";
import { ErrorAlert } from "../../components/patterns/ErrorAlert";
import { LoadingDots } from "../../components/ui/LoadingDots";
import { Modal } from "../../components/ui/Modal";
import { getReceiveAddress } from "./walletApi";
import type { ReceiveAddress } from "./walletTypes";

export function ReceiveAddressModal({
  actionsBlocked,
  onClose,
}: {
  actionsBlocked: boolean;
  onClose: () => void;
}) {
  const [address, setAddress] = useState<ReceiveAddress | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (actionsBlocked) {
      setLoading(false);
      setError("Wallet actions are unavailable while Minima isn't running.");
      return;
    }
    let cancelled = false;
    setLoading(true);
    getReceiveAddress()
      .then((result) => {
        if (cancelled) return;
        setAddress(result);
        setError(null);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Could not fetch receive address.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [actionsBlocked]);

  return (
    <Modal
      title="Receive"
      description="Share this address to deposit Minima or tokens into this wallet."
      onClose={onClose}
    >
      <div className="gap-detail-close grid">
        {error ? (
          <ErrorAlert title="Couldn't load address" className="w-full max-w-none">
            {error}
          </ErrorAlert>
        ) : null}

        {loading ? (
          <div className="py-pad-relaxed flex items-center justify-center" aria-busy="true">
            <LoadingDots />
          </div>
        ) : address ? (
          <>
            <section
              className="gap-detail-next flex flex-col"
              aria-labelledby="receive-address-label"
            >
              <p className="type-meta text-text-secondary m-0" id="receive-address-label">
                Receive address
              </p>
              <CopyableCode value={address.miniAddress} />
            </section>
          </>
        ) : null}
      </div>
    </Modal>
  );
}
