import { Send } from "lucide-react";
import { ButtonRow } from "../../components/patterns/ButtonRow";
import { Button } from "../../components/ui/Button";
import { LoadingDots } from "../../components/ui/LoadingDots";
import { MinimaIcon } from "../../components/MinimaIcon";
import { formatAmountThreshold } from "../../lib/format";
import { ReceiveQrPanel } from "./ReceiveQrPanel";

export function WalletHero({
  loading,
  totalMinima,
  disabled,
  onSend,
  // onCreateToken,
}: {
  loading: boolean;
  totalMinima: string;
  disabled: boolean;
  onSend: () => void;
  // onCreateToken: () => void;
}) {
  const balanceBusy = loading || disabled;

  return (
    <section className="rounded-soft p-pad-tight relative w-full overflow-hidden border border-slate-800 bg-slate-950 text-white before:absolute before:-top-20 before:-right-10 before:size-[260px] before:rounded-full before:bg-cyan-400 before:opacity-30 before:blur-[64px] after:absolute after:right-40 after:-bottom-28 after:size-[260px] after:rounded-full after:bg-violet-400 after:opacity-30 after:blur-[64px]">
      <div className="gap-detail-near relative z-10 flex flex-col sm:flex-row sm:items-stretch sm:justify-between">
        <div className="gap-detail-near flex min-w-0 flex-1 flex-col justify-between">
          <h2 className="type-title text-text-inverse m-0">Your wallet</h2>

          <div className="gap-detail-next flex flex-col">
            <p className="type-body text-grey-03 m-0" id="wallet-balance-label">
              Total sendable MINIMA
            </p>
            <div
              className="gap-detail-close flex min-w-0 items-center"
              aria-labelledby="wallet-balance-label"
              aria-busy={balanceBusy}
            >
              <MinimaIcon size={32} className="text-icon-inverse shrink-0" />
              <span
                className="type-heading text-text-inverse min-w-0 break-all"
                title={balanceBusy ? undefined : totalMinima}
              >
                {balanceBusy ? (
                  <LoadingDots className="scale-125" />
                ) : (
                  formatAmountThreshold(totalMinima)
                )}
              </span>
            </div>
          </div>

          <ButtonRow className="w-full sm:w-auto [&_button]:w-full sm:[&_button]:w-auto">
            <Button
              type="button"
              variant="accent"
              onClick={onSend}
              disabled={disabled}
              iconStart={<Send aria-hidden="true" />}
            >
              Send payment
            </Button>
            {/* <Button
                type="button"
                variant="accent"
                onClick={onCreateToken}
                disabled={disabled}
                iconStart={<Coins aria-hidden="true" />}
              >
                Create token
              </Button> */}
          </ButtonRow>
        </div>

        <ReceiveQrPanel disabled={disabled} />
      </div>
    </section>
  );
}
