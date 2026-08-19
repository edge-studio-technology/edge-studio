import { useCallback, useEffect, useState } from "react";
import { Check, Copy } from "lucide-react";
import { Button } from "../../components/ui/Button";
import { LoadingDots } from "../../components/ui/LoadingDots";
import { cx } from "../../lib/cx";
import { getReceiveAddress } from "./walletApi";
import type { ReceiveAddress } from "./walletTypes";

const RECEIVE_QR_REFRESH_MS = 3 * 60 * 1000;

export function ReceiveQrPanel({ disabled }: { disabled: boolean }) {
  const [address, setAddress] = useState<ReceiveAddress | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const refresh = useCallback(() => {
    getReceiveAddress()
      .then((result) => {
        setAddress(result);
        setError(null);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Could not fetch address."));
  }, []);

  useEffect(() => {
    if (disabled) return;
    refresh();
    let interval: number | undefined;
    function startInterval() {
      interval = window.setInterval(refresh, RECEIVE_QR_REFRESH_MS);
    }
    function stopInterval() {
      if (interval !== undefined) window.clearInterval(interval);
      interval = undefined;
    }
    function handleVisibilityChange() {
      if (document.visibilityState === "visible") {
        refresh();
        startInterval();
      } else {
        stopInterval();
      }
    }
    startInterval();
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      stopInterval();
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [disabled, refresh]);

  async function handleCopy() {
    if (!address) return;
    try {
      await navigator.clipboard.writeText(address.miniAddress);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      setError("Could not copy address.");
    }
  }

  return (
    <div className="gap-detail-close flex h-full flex-col items-center">
      <div
        className="bg-surface-always-white rounded-soft gap-detail-close p-pad-close flex w-40 flex-col items-center overflow-hidden shadow-sm"
        role="group"
        aria-labelledby="wallet-receive-label"
      >
        <p className="type-meta text-text-primary m-0" id="wallet-receive-label">
          Receive
        </p>
        <div className={cx("grid size-32 shrink-0 place-items-center", disabled && "opacity-55")}>
          {address && !disabled ? (
            <img
              src={address.qrDataUrl}
              alt="QR code for this wallet receive address"
              className="size-full"
            />
          ) : (
            <LoadingDots />
          )}
        </div>

        <Button
          type="button"
          variant="secondary"
          size="sm"
          className="w-full"
          onClick={() => {
            void handleCopy();
          }}
          disabled={!address || disabled}
          iconStart={copied ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}
        >
          {copied ? "Copied" : "Copy address"}
        </Button>
      </div>

      <p className="sr-only" aria-live="polite">
        {copied ? "Address copied to clipboard" : ""}
      </p>
      {error ? <p className="type-meta text-text-error m-0 max-w-35 text-center">{error}</p> : null}
    </div>
  );
}
