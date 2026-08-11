import { Modal } from "../../components/ui/Modal";
import { cx } from "../../lib/cx";
import { formatMinimaAmount } from "../../lib/format";
import { TokenGlyph } from "./TokenGlyph";
import type { TokenBalance } from "./walletTypes";

function isNonZeroAmount(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed || !/^-?\d+(\.\d+)?$/.test(trimmed)) return false;
  return !/^-?0+(\.0*)?$/.test(trimmed);
}

function BalanceTile({
  label,
  value,
  tone = "default",
  hint,
}: {
  label: string;
  value: string;
  tone?: "default" | "warning";
  hint?: string;
}) {
  return (
    <div
      className={cx(
        "rounded-loose p-pad-close gap-detail-next flex flex-col border",
        tone === "warning"
          ? "border-stroke-warning bg-surface-always-white"
          : "border-stroke-secondary bg-surface-always-white",
      )}
    >
      <p className="type-meta text-text-secondary m-0">{label}</p>
      <p
        className={cx(
          "type-mono m-0 break-all tabular-nums",
          tone === "warning" ? "text-text-warning" : "text-text-primary",
        )}
      >
        {formatMinimaAmount(value, 12)}
      </p>
      {hint ? <p className="type-meta text-text-warning m-0">{hint}</p> : null}
    </div>
  );
}

export function AssetDetailModal({ token, onClose }: { token: TokenBalance; onClose: () => void }) {
  const hasPending = isNonZeroAmount(token.unconfirmed);

  return (
    <Modal title={token.name} onClose={onClose}>
      <div className="gap-detail-close grid">
        <section
          className="border-stroke-secondary bg-surface-always-white rounded-loose p-pad-close gap-detail-next flex flex-col border"
          aria-labelledby="asset-sendable-label"
        >
          <p className="type-meta text-text-secondary m-0" id="asset-sendable-label">
            Sendable
          </p>
          <div className="gap-detail-close flex min-w-0 items-center">
            <span
              className="bg-surface-secondary text-icon-primary rounded-loose flex size-10 shrink-0 items-center justify-center"
              aria-hidden
            >
              <TokenGlyph isNative={token.isNative} />
            </span>
            <p className="type-title text-text-primary m-0 min-w-0 break-all tabular-nums">
              {formatMinimaAmount(token.sendable, 12)}
            </p>
          </div>
          <p className="type-meta text-text-tertiary m-0">Available to send from this wallet</p>
        </section>

        <div className="gap-detail-close grid sm:grid-cols-2">
          <BalanceTile label="Confirmed" value={token.confirmed} />
          <BalanceTile
            label="Unconfirmed"
            value={token.unconfirmed}
            tone={hasPending ? "warning" : "default"}
            hint={hasPending ? "Pending network confirmation" : undefined}
          />
        </div>

        {/* <section className="gap-detail-next flex flex-col" aria-labelledby="asset-token-id-label">
          <p className="type-meta text-text-secondary m-0" id="asset-token-id-label">
            Token ID
          </p>
          <CopyableCode value={token.tokenId} />
        </section> */}
      </div>
    </Modal>
  );
}
