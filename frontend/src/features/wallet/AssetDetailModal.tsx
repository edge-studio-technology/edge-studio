import { CopyableCode } from "../../components/CopyableCode";
import { Modal } from "../../components/Modal";
import { Label } from "../../components/ui/Label";
import { formatAmountAdaptive } from "../../lib/format";
import { TokenGlyph } from "./TokenGlyph";
import type { TokenBalance } from "./walletTypes";

export function AssetDetailModal({ token, onClose }: { token: TokenBalance; onClose: () => void }) {
  return (
    <Modal title={token.name} onClose={onClose}>
      <div className="grid gap-4">
        <div className="gap-detail-next flex flex-col">
          <Label>Token ID</Label>
          <CopyableCode value={token.tokenId} />
        </div>
        <div className="gap-detail-next flex flex-col">
          <Label>Sendable</Label>
          <p className="inline-flex items-center gap-2 text-lg font-semibold text-slate-900 tabular-nums">
            <TokenGlyph isNative={token.isNative} />
            {formatAmountAdaptive(token.sendable)}
          </p>
        </div>
        <div className="gap-detail-next flex flex-col">
          <Label>Confirmed</Label>
          <p className="text-sm font-medium text-slate-900 tabular-nums">
            {formatAmountAdaptive(token.confirmed)}
          </p>
        </div>
        <div className="gap-detail-next flex flex-col">
          <Label>Unconfirmed</Label>
          <p className="text-sm font-medium text-slate-500 tabular-nums">
            {formatAmountAdaptive(token.unconfirmed)}
          </p>
        </div>
      </div>
    </Modal>
  );
}
