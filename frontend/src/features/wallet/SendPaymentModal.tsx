import { useEffect, useState } from "react";
import { Button } from "../../components/Button";
import { Modal } from "../../components/Modal";
import { useToast } from "../../components/ToastProvider";
import { InputField } from "../../components/ui/InputField";
import { Label } from "../../components/ui/Label";
import { SelectField } from "../../components/ui/SelectField";
import { listAddressBookEntries } from "../address-book/addressBookApi";
import type { AddressBookEntry } from "../address-book/addressBookTypes";
import { sendPayment as sendPaymentApi } from "./walletApi";
import type { WalletStatus } from "./walletTypes";
import { compareDecimalStrings, isPositiveDecimal } from "./walletUtils";

export function SendPaymentModal({
  walletStatus,
  actionsBlocked,
  minimaConfirmedUnavailable,
  onClose,
}: {
  walletStatus: WalletStatus | null;
  actionsBlocked: boolean;
  minimaConfirmedUnavailable: boolean;
  onClose: () => void;
}) {
  const { showToast } = useToast();
  const [address, setAddress] = useState("");
  const [amount, setAmount] = useState("");
  const [tokenId, setTokenId] = useState("0x00");
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [addressMode, setAddressMode] = useState<"external" | "address-book">("external");
  const [contacts, setContacts] = useState<AddressBookEntry[]>([]);

  useEffect(() => {
    listAddressBookEntries()
      .then(setContacts)
      .catch(() => {});
  }, []);

  const tokens = walletStatus?.tokens ?? [];
  const tokenOptions =
    tokens.length > 0
      ? tokens.map((token) => ({
          value: token.tokenId,
          label: token.isNative ? "Minima (native)" : token.name,
        }))
      : [{ value: "0x00", label: "Minima (native)" }];
  const selectedToken = tokens.find((t) => t.tokenId === tokenId);
  const availableSendable = selectedToken?.sendable ?? "0";
  const availableLabel = selectedToken
    ? selectedToken.isNative
      ? "Minima"
      : selectedToken.name
    : null;

  const exceedsBalance = Boolean(
    selectedToken &&
    isPositiveDecimal(amount) &&
    compareDecimalStrings(amount.trim(), availableSendable) > 0,
  );
  const canSubmit = !exceedsBalance && !submitting && !actionsBlocked;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    if (!address.trim()) {
      setFormError("Address is required.");
      return;
    }
    const num = Number(amount);
    if (!amount || !Number.isFinite(num) || num <= 0) {
      setFormError("Amount must be a positive number.");
      return;
    }
    if (exceedsBalance) {
      setFormError(`Amount exceeds available balance (${availableSendable} ${availableLabel}).`);
      return;
    }
    setSubmitting(true);
    try {
      const result = await sendPaymentApi({
        address: address.trim(),
        amount: amount.trim(),
        tokenId,
        tokenName:
          tokenId === "0x00"
            ? "Minima"
            : (tokenOptions.find((opt) => opt.value === tokenId)?.label ?? tokenId),
      });
      if (!result.ok || result.status === "failed") {
        setFormError(result.message ?? "Send failed.");
        return;
      }
      showToast({
        tone: "success",
        title: "Payment sent",
        message: result.txpowId
          ? `Transaction submitted: ${result.txpowId.slice(0, 16)}…`
          : undefined,
      });
      onClose();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Send failed.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal title="Send payment" onClose={onClose}>
      <form onSubmit={handleSubmit} className="grid gap-4">
        <div className="gap-detail-next flex flex-col">
          <div className="flex items-center justify-between gap-3">
            <Label htmlFor={addressMode === "external" ? "send-address" : "send-contact"}>
              Recipient address
            </Label>
            <div className="flex gap-1 rounded-lg bg-slate-100 p-0.5">
              {(["external", "address-book"] as const).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => {
                    setAddressMode(mode);
                    setAddress("");
                    setFormError(null);
                  }}
                  className={`rounded-md px-2.5 py-1 text-xs font-semibold transition-colors ${
                    addressMode === mode
                      ? "bg-white text-slate-900 shadow-sm"
                      : "text-slate-500 hover:text-slate-700"
                  }`}
                >
                  {mode === "external" ? "External" : "Address book"}
                </button>
              ))}
            </div>
          </div>
          {addressMode === "external" ? (
            <InputField
              id="send-address"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="Enter an address (Mx… or 0x…)"
              autoComplete="off"
              spellCheck={false}
            />
          ) : contacts.length === 0 ? (
            <p className="type-body text-text-secondary m-0">No contacts saved in address book.</p>
          ) : (
            <SelectField
              id="send-contact"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="Select a contact…"
              options={contacts.map((contact) => ({
                value: contact.address,
                label: contact.label,
              }))}
            />
          )}
        </div>

        <SelectField
          label="Token"
          description={
            selectedToken ? `${availableSendable} ${availableLabel} sendable` : undefined
          }
          value={tokenId}
          onChange={(e) => {
            setTokenId(e.target.value);
            setFormError(null);
          }}
          options={tokenOptions}
        />

        <InputField
          label="Amount"
          inputMode="decimal"
          value={amount}
          onChange={(e) => {
            setAmount(e.target.value);
            setFormError(null);
          }}
          placeholder="0.00"
        />

        {exceedsBalance && selectedToken && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-3">
            <p className="text-sm text-amber-800">
              Amount exceeds available balance ({availableSendable} {availableLabel}).
            </p>
          </div>
        )}

        {formError && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-3">
            <p className="text-sm text-red-700">{formError}</p>
          </div>
        )}

        {minimaConfirmedUnavailable && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-3">
            <p className="text-sm text-amber-800">
              Minima isn't running — sending is unavailable right now.
            </p>
          </div>
        )}

        <Button type="submit" disabled={!canSubmit} className="w-full justify-center">
          {submitting ? "Sending…" : "Send payment"}
        </Button>
      </form>
    </Modal>
  );
}
