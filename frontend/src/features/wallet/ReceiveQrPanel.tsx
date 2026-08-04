import { useCallback, useEffect, useState } from "react";
import { Check, Copy } from "lucide-react";
import { LoadingDots } from "../../components/ui/LoadingDots";
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
      // ignore clipboard failures in non-secure contexts
    }
  }

  return (
    <div className="flex h-full flex-col items-center gap-2">
      <button
        type="button"
        onClick={handleCopy}
        disabled={!address || disabled}
        aria-label={copied ? "Copied" : "Copy Mx address"}
        className="flex h-full w-40 flex-col overflow-hidden rounded-md bg-white text-slate-950 shadow-sm transition-colors enabled:hover:bg-slate-50 disabled:opacity-55"
      >
        <div className="flex flex-1 items-center justify-center p-2">
          <div className="grid size-32 shrink-0 place-items-center">
            {address ? (
              <img
                src={address.qrDataUrl}
                alt="Wallet receive address QR code"
                className="size-full"
              />
            ) : (
              <LoadingDots />
            )}
          </div>
        </div>
        <div className="flex w-full items-center justify-center gap-2 border-t border-slate-200 px-3 py-2.5 text-sm font-bold whitespace-nowrap">
          <span className="grid shrink-0 place-items-center">
            {copied ? <Check size={16} /> : <Copy size={16} />}
          </span>
          {copied ? "Copied" : "Copy address"}
        </div>
      </button>
      {error && <p className="m-0 max-w-35 text-center text-xs text-red-400">{error}</p>}
    </div>
  );
}
