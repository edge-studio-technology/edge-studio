import { CopyableCode } from "../../components/patterns/CopyableCode";
import { Modal } from "../../components/ui/Modal";
import { formatAmountAdaptive } from "../../lib/format";
import { formatLocalDateTime } from "../../lib/time";
import { TokenGlyph } from "./TokenGlyph";
import type { WalletSendHistoryItem } from "./walletTypes";
import { isNativeTokenId } from "./walletUtils";

export function HistoryDetailModal({
  item,
  onClose,
}: {
  item: WalletSendHistoryItem;
  onClose: () => void;
}) {
  const amountLabel = formatAmountAdaptive(item.amount);

  return (
    <Modal title="History details" onClose={onClose}>
      <div className="gap-detail-close grid">
        <section
          className="border-stroke-secondary bg-surface-always-white rounded-loose p-pad-close gap-detail-next flex flex-col border"
          aria-labelledby="history-amount-label"
        >
          <p className="type-meta text-text-secondary m-0" id="history-amount-label">
            Amount
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
                {amountLabel}
              </p>
              <p className="type-meta text-text-secondary m-0 truncate">{item.tokenName}</p>
            </div>
          </div>
        </section>

        <section className="gap-detail-next flex flex-col" aria-labelledby="history-to-label">
          <p className="type-meta text-text-secondary m-0" id="history-to-label">
            To
          </p>
          <CopyableCode value={item.toAddress} />
        </section>

        <section className="gap-detail-next flex flex-col" aria-labelledby="history-token-id-label">
          <p className="type-meta text-text-secondary m-0" id="history-token-id-label">
            Token ID
          </p>
          <CopyableCode value={item.tokenId} />
        </section>

        {item.txpowId ? (
          <section className="gap-detail-next flex flex-col" aria-labelledby="history-txpow-label">
            <p className="type-meta text-text-secondary m-0" id="history-txpow-label">
              TxPow ID
            </p>
            <CopyableCode value={item.txpowId} />
          </section>
        ) : null}

        <section className="gap-detail-next flex flex-col" aria-labelledby="history-created-label">
          <p className="type-meta text-text-secondary m-0" id="history-created-label">
            Created
          </p>
          <time className="type-body text-text-primary" dateTime={item.createdAt}>
            {formatLocalDateTime(item.createdAt)}
          </time>
        </section>
      </div>
    </Modal>
  );
}
