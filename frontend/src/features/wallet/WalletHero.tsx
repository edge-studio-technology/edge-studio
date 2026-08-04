import { DarkHeroCard } from "../../components/DarkHeroCard";
import { LoadingDots } from "../../components/ui/LoadingDots";
import { MinimaIcon } from "../../components/MinimaIcon";
import { formatAmountThreshold } from "../../lib/format";
import { ReceiveQrPanel } from "./ReceiveQrPanel";

export function WalletHero({
  loading,
  totalMinima,
  disabled,
}: {
  loading: boolean;
  totalMinima: string;
  disabled: boolean;
}) {
  return (
    <DarkHeroCard rounded="rounded-md" padding="p-5">
      <div className="relative z-10 flex flex-col gap-6 sm:flex-row sm:items-stretch sm:justify-between">
        <div className="flex min-w-0 flex-col justify-end gap-4">
          <div className="flex items-center gap-3">
            <div className="grid size-[38px] place-items-center rounded-[14px] bg-white/10">
              <MinimaIcon size={18} />
            </div>
            <p className="type-callout text-text-inverse m-0">Primary wallet</p>
          </div>
          <div>
            <p className="m-0 text-xs font-extrabold tracking-[0.12em] text-slate-400 uppercase">
              Total sendable MINIMA
            </p>
            <div className="mt-2 flex min-w-0 items-start gap-4 text-[clamp(2.5rem,6vw,3.5rem)]">
              <MinimaIcon size={36} className="mt-[calc((1.1em-36px)/2)] shrink-0 opacity-55" />
              <span
                className="min-w-0 text-[clamp(2.5rem,6vw,3.5rem)] leading-[1.1] font-bold tracking-[-0.04em] break-all"
                title={loading || disabled ? undefined : totalMinima}
              >
                {loading || disabled ? (
                  <LoadingDots className="scale-125" />
                ) : (
                  formatAmountThreshold(totalMinima)
                )}
              </span>
            </div>
          </div>
        </div>
        <ReceiveQrPanel disabled={disabled} />
      </div>
    </DarkHeroCard>
  );
}
