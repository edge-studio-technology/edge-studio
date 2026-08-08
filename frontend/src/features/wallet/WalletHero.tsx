import { Coins, Download, Send } from "lucide-react";
import { ButtonRow } from "../../components/patterns/ButtonRow";
import { Button } from "../../components/ui/Button";
import { LoadingDots } from "../../components/ui/LoadingDots";
import { MinimaIcon } from "../../components/MinimaIcon";
import { formatMinimaAmount } from "../../lib/format";

/** Overrides shared Button colors for the dark wallet hero (cx does not merge Tailwind). */
const receiveOnDarkButtonClass =
  "!border-stroke-always-white !bg-overlay-light !text-text-inverse hover:enabled:!border-white hover:enabled:!bg-surface-inverse-hover disabled:!bg-overlay-light disabled:!text-text-disabled disabled:hover:!bg-overlay-light disabled:hover:!border-stroke-always-white";

export function WalletHero({
  loading,
  totalMinima,
  disabled,
  onSend,
  onReceive,
  // onCreateToken,
}: {
  loading: boolean;
  totalMinima: string;
  disabled: boolean;
  onSend: () => void;
  onReceive: () => void;
  // onCreateToken: () => void;
}) {
  const balanceBusy = loading || disabled;

  return (
    <section className="rounded-soft p-pad-tight border-stroke-always-white bg-surface-inverse text-text-inverse before:bg-surface-accent-hover after:bg-surface-accent relative w-full overflow-hidden border before:absolute before:-top-20 before:-right-10 before:size-[260px] before:rounded-full before:opacity-30 before:blur-[64px] after:absolute after:right-40 after:-bottom-28 after:size-[260px] after:rounded-full after:opacity-30 after:blur-[64px]">
      <div className="gap-detail-near relative z-10 flex flex-col">
        <div className="gap-detail-next flex flex-col">
          <p className="type-body text-grey-03 m-0" id="wallet-balance-label">
            Wallet balance
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
                formatMinimaAmount(totalMinima, 12)
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
            Send
          </Button>
          <Button
            type="button"
            variant="secondary"
            onClick={onReceive}
            disabled={disabled}
            iconStart={<Download aria-hidden="true" />}
            className={receiveOnDarkButtonClass}
          >
            Receive
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
    </section>
  );
}
