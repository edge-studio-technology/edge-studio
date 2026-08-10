import { useEffect, useState } from "react";
import { ErrorAlert } from "../../components/patterns/ErrorAlert";
import { Button } from "../../components/ui/Button";
import { InputField } from "../../components/ui/InputField";
import { Label } from "../../components/ui/Label";
import { Modal } from "../../components/ui/Modal";
import { SelectField } from "../../components/ui/SelectField";
import { ToggleTabs } from "../../components/ui/ToggleTabs";
import { useToast } from "../../components/ToastProvider";
import { listAddressBookEntries } from "../address-book/addressBookApi";
import type { AddressBookEntry } from "../address-book/addressBookTypes";
import { sendPayment as sendPaymentApi } from "./walletApi";
import type { WalletStatus } from "./walletTypes";
import { compareDecimalStrings, isPositiveDecimal } from "./walletUtils";
import { ErrorText } from "../../components/ui/ErrorText";

type AddressMode = "external" | "address-book";

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
  const [addressMode, setAddressMode] = useState<AddressMode>("external");
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
    <Modal
      title="Send payment"
      onClose={onClose}
      footer={
        <>
          <Button type="button" variant="secondary" disabled={submitting} onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="send-payment-form" disabled={!canSubmit}>
            {submitting ? "Sending…" : "Send payment"}
          </Button>
        </>
      }
    >
      <form id="send-payment-form" onSubmit={handleSubmit} className="gap-detail-close grid">
        <div className="gap-detail-next flex min-w-0 flex-col">
          <div className="gap-detail-next flex min-w-0 items-center justify-between">
            <Label
              htmlFor={addressMode === "external" ? "send-address" : "send-contact"}
              className="mt-auto shrink-0 whitespace-nowrap"
            >
              Recipient address
            </Label>
            <ToggleTabs
              size="sm"
              className="w-1/2 shrink-0"
              label="Recipient source"
              value={addressMode}
              options={[
                { value: "external", label: "External" },
                { value: "address-book", label: "Address book" },
              ]}
              onChange={(mode) => {
                setAddressMode(mode);
                setAddress("");
                setFormError(null);
              }}
            />
          </div>
          {addressMode === "external" ? (
            <InputField
              id="send-address"
              className="min-w-0"
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
              className="min-w-0"
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
          min="0"
          max={availableSendable}
          type="number"
          value={amount}
          onChange={(e) => {
            setAmount(e.target.value);
            setFormError(null);
          }}
          placeholder="0.00"
        />

        {exceedsBalance && selectedToken ? (
          <ErrorText className="max-w-none">
            Amount exceeds available balance ({availableSendable} {availableLabel}).
          </ErrorText>
        ) : null}

        {formError ? <ErrorAlert className="max-w-none">{formError}</ErrorAlert> : null}

        {minimaConfirmedUnavailable ? (
          <ErrorAlert status="warning" className="max-w-none">
            Minima isn't running — sending is unavailable right now.
          </ErrorAlert>
        ) : null}

      </form>
    </Modal>
  );
}
