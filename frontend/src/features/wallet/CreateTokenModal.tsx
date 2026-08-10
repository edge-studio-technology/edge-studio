import { useEffect, useState } from "react";
import { Button } from "../../components/Button";
import { Modal } from "../../components/Modal";
import { useToast } from "../../components/ToastProvider";
import { InputField } from "../../components/ui/InputField";
import { formatMinimaAmount } from "../../lib/format";
import {
  createToken as createTokenApi,
  getTokenCreateRequirements,
} from "../tokens/tokensApi";
import type { TokenCreateRequirements } from "../tokens/tokensTypes";
import type { WalletStatus } from "./walletTypes";
import { compareDecimalStrings, isPositiveDecimal } from "./walletUtils";

export function CreateTokenModal({
  walletStatus,
  actionsBlocked,
  minimaConfirmedUnavailable,
  onClose,
  onCreated,
}: {
  walletStatus: WalletStatus | null;
  actionsBlocked: boolean;
  minimaConfirmedUnavailable: boolean;
  onClose: () => void;
  onCreated: () => Promise<void>;
}) {
  const { showToast } = useToast();
  const [requirements, setRequirements] = useState<TokenCreateRequirements | null>(null);
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [decimal, setDecimal] = useState("0");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    getTokenCreateRequirements()
      .then(setRequirements)
      .catch(() => {
        setRequirements({
          estimatedMinimaCost: "0.001",
          minimumAccountMinima: "0.001",
          note: "",
        });
      });
  }, []);

  const minimumBalance = requirements?.minimumAccountMinima ?? "0.001";
  const nativeToken = walletStatus?.tokens.find((t) => t.isNative);
  const availableMinima = nativeToken?.sendable ?? "0";
  const hasSufficientMinima = compareDecimalStrings(availableMinima, minimumBalance) >= 0;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const trimmedName = name.trim();
    const trimmedAmount = amount.trim();
    const parsedDecimal = Number(decimal);

    if (!hasSufficientMinima) {
      setError(`Wallet needs at least ${minimumBalance} sendable MINIMA to create a token.`);
      return;
    }
    if (!trimmedName) {
      setError("Name is required.");
      return;
    }
    if (!isPositiveDecimal(trimmedAmount)) {
      setError("Amount must be a positive number.");
      return;
    }
    if (!Number.isInteger(parsedDecimal) || parsedDecimal < 0) {
      setError("Decimal must be a non-negative whole number.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await createTokenApi({
        name: trimmedName,
        amount: trimmedAmount,
        decimal: parsedDecimal,
      });
      if (res.ok) {
        await onCreated();
        showToast({
          tone: "success",
          title: "Token created",
          message: res.tokenId
            ? `${res.name} (${res.tokenId})`
            : (res.message ?? "Custom token created."),
        });
        onClose();
      } else {
        setError(res.message ?? "Token creation failed.");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Token creation failed.");
    } finally {
      setSubmitting(false);
    }
  }

  function handleCloseRequest() {
    if (submitting) return;
    onClose();
  }

  return (
    <Modal
      title="Create custom token"
      onClose={handleCloseRequest}
      footer={
        <>
          <Button type="button" variant="secondary" disabled={submitting} onClick={handleCloseRequest}>
            Cancel
          </Button>
          <Button
            type="submit"
            form="create-token-form"
            disabled={submitting || !hasSufficientMinima || actionsBlocked}
          >
            {submitting ? "Creating…" : "Create token"}
          </Button>
        </>
      }
    >
      <form id="create-token-form" onSubmit={handleSubmit} className="grid gap-4">
        <p className="text-sm text-slate-500">
          Wallet MINIMA:{" "}
          <span className={hasSufficientMinima ? "text-slate-900" : "text-red-700"}>
            {formatMinimaAmount(availableMinima, 12)} sendable
          </span>{" "}
          (minimum: {minimumBalance})
        </p>
        <InputField
          label="Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Device access"
          maxLength={80}
        />
        <InputField
          label="Amount (supply)"
          inputMode="decimal"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="e.g. 1000"
        />
        <InputField
          label="Decimal places"
          type="number"
          min={0}
          step={1}
          value={decimal}
          onChange={(e) => setDecimal(e.target.value)}
        />
        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-3">
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}
        {submitting && (
          <p className="text-sm text-slate-500">
            Creating token on the node… this may take up to a minute.
          </p>
        )}
        {minimaConfirmedUnavailable && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-3">
            <p className="text-sm text-amber-800">
              Minima isn't running — token creation is unavailable right now.
            </p>
          </div>
        )}
      </form>
    </Modal>
  );
}
