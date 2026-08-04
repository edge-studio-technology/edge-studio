import { CopyableCode } from "../../components/CopyableCode";
import { Modal } from "../../components/Modal";
import { Label } from "../../components/ui/Label";
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
  return (
    <Modal title="History item details" onClose={onClose}>
      <div className="grid gap-4">
        <div className="gap-detail-next flex flex-col">
          <Label>Amount</Label>
          <p className="inline-flex items-center gap-2 text-lg font-semibold text-slate-900">
            <TokenGlyph isNative={isNativeTokenId(item.tokenId)} />
            {item.amount} {item.tokenName}
          </p>
        </div>
        <div className="gap-detail-next flex flex-col">
          <Label>Status</Label>
          <p className="text-sm font-medium text-slate-900 capitalize">{item.status}</p>
        </div>
        <div className="gap-detail-next flex flex-col">
          <Label>To</Label>
          <CopyableCode value={item.toAddress} />
        </div>
        <div className="gap-detail-next flex flex-col">
          <Label>Token ID</Label>
          <CopyableCode value={item.tokenId} />
        </div>
        {item.txpowId && (
          <div className="gap-detail-next flex flex-col">
            <Label>TxPow ID</Label>
            <CopyableCode value={item.txpowId} />
          </div>
        )}
        <div className="gap-detail-next flex flex-col">
          <Label>Created</Label>
          <p className="text-sm text-slate-900">{new Date(item.createdAt).toLocaleString()}</p>
        </div>
      </div>
    </Modal>
  );
}
