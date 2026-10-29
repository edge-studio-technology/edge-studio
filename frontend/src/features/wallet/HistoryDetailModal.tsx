import { useId, type ReactNode } from "react";
import { CopyableCode } from "../../components/patterns/CopyableCode";
import { Modal } from "../../components/ui/Modal";
import { Pill } from "../../components/ui/Pill";
import { formatLocalDateTime } from "../../lib/time";
import { TokenGlyph } from "./TokenGlyph";
import {
  DIRECTION_LABEL,
  ORIGIN_LABEL,
  signedAmountLabel,
  STATUS_LABEL,
  STATUS_TONE,
} from "./walletHistory";
import type { WalletHistoryItem } from "./walletTypes";
import { isNativeTokenId } from "./walletUtils";

function HistoryField({ label, children }: { label: string; children: ReactNode }) {
  const labelId = useId();
  return (
    <section className="gap-detail-next flex flex-col" aria-labelledby={labelId}>
      <p className="type-meta text-text-secondary m-0" id={labelId}>
        {label}
      </p>
      {children}
    </section>
  );
}

function HistoryTime({ value }: { value: string }) {
  return (
    <time className="type-body text-text-primary" dateTime={value}>
      {formatLocalDateTime(value)}
    </time>
  );
}

export function HistoryDetailModal({
  item,
  onClose,
}: {
  item: WalletHistoryItem;
  onClose: () => void;
}) {
  const counterpartyTitle = item.direction === "in" ? "From" : "To";

  return (
    <Modal title="History details" onClose={onClose}>
      <div className="gap-detail-close grid">
        <section
          className="border-stroke-secondary bg-surface-always-white rounded-loose p-pad-close gap-detail-next flex flex-col border"
          aria-labelledby="history-amount-label"
        >
          <p className="type-meta text-text-secondary m-0" id="history-amount-label">
            {DIRECTION_LABEL[item.direction]}
          </p>
          <div className="gap-detail-close flex min-w-0 items-center">
            <span
              className="bg-surface-secondary text-icon-primary rounded-loose flex size-10 shrink-0 items-center justify-center"
              aria-hidden
            >
              <TokenGlyph isNative={isNativeTokenId(item.tokenId)} />
            </span>
            <div className="gap-detail-tight flex min-w-0 flex-col">
              <p className="type-title text-text-primary m-0 min-w-0 break-all tabular-nums">
                {signedAmountLabel(item)}
              </p>
              <p className="type-meta text-text-secondary m-0 truncate">{item.tokenName}</p>
            </div>
          </div>
          <div className="gap-detail-tight flex flex-wrap items-center">
            <Pill tone={STATUS_TONE[item.status]} indicator>
              {STATUS_LABEL[item.status]}
            </Pill>
            {item.isPreviousWallet ? <Pill>Previous wallet</Pill> : null}
          </div>
        </section>

        {item.status === "failed" ? (
          <HistoryField label="Reason">
            <p className="type-body text-text-error m-0 break-words">
              {item.error ?? "No reason was recorded for this send."}
            </p>
          </HistoryField>
        ) : null}

        {item.direction !== "self" ? (
          <HistoryField label={counterpartyTitle}>
            {item.counterpartyLabel ? (
              <p className="type-body text-text-primary m-0">{item.counterpartyLabel}</p>
            ) : null}
            {item.counterparty ? (
              <CopyableCode value={item.counterparty} />
            ) : (
              <p className="type-body text-text-secondary m-0">Unknown</p>
            )}
          </HistoryField>
        ) : null}

        <HistoryField label="Date">
          <HistoryTime value={item.time} />
        </HistoryField>

        {item.confirmedAt ? (
          <HistoryField label="Confirmed">
            <HistoryTime value={item.confirmedAt} />
          </HistoryField>
        ) : null}

        {item.block !== null ? (
          <HistoryField label="Block">
            <p className="type-body text-text-primary m-0 tabular-nums">
              {item.block}
              {item.confirmations !== null
                ? ` · ${item.confirmations} ${item.confirmations === 1 ? "confirmation" : "confirmations"}`
                : null}
            </p>
          </HistoryField>
        ) : null}

        {item.origin ? (
          <HistoryField label="Origin">
            <p className="type-body text-text-primary m-0">{ORIGIN_LABEL[item.origin]}</p>
          </HistoryField>
        ) : null}

        <HistoryField label="Token ID">
          <CopyableCode value={item.tokenId} />
        </HistoryField>

        {item.txpowId ? (
          <HistoryField label="TxPoW ID">
            <CopyableCode value={item.txpowId} />
          </HistoryField>
        ) : null}

        {item.transactionId ? (
          <HistoryField label="Transaction ID">
            <CopyableCode value={item.transactionId} />
          </HistoryField>
        ) : null}
      </div>
    </Modal>
  );
}
