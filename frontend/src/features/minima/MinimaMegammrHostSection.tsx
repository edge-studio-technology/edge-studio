import { Globe } from "lucide-react";
import type { MinimaConfig } from "../../app/types";
import { Button } from "../../components/Button";
import { ButtonRow } from "../../components/ButtonRow";
import { SubSection } from "../../components/patterns/SubSection";
import { InputField } from "../../components/ui/InputField";

function ConfigDetail({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid gap-1 sm:grid-cols-[11rem_minmax(0,1fr)] sm:gap-3">
      <dt className="m-0 text-sm font-medium text-slate-500">{label}</dt>
      <dd className="m-0 min-w-0 font-mono text-sm text-slate-800 break-all">{value}</dd>
    </div>
  );
}

export function MinimaMegammrHostSection({
  config,
  megammrHostInput,
  setMegammrHostInput,
  busy,
  onSave
}: {
  config: MinimaConfig | null;
  megammrHostInput: string;
  setMegammrHostInput: (value: string) => void;
  busy: boolean;
  onSave: () => void;
}) {
  return (
    <SubSection
      icon={<Globe size={13} />}
      title="Megammr host"
      description="Runtime sync host configuration used by this node."
    >
      <div className="grid gap-4">
        <div className="grid min-w-[min(100%,360px)] gap-2.5">
          <InputField
            label="Host"
            value={megammrHostInput}
            onChange={(event) => setMegammrHostInput(event.target.value)}
            placeholder="megammr.minima.global:9001"
          />
          <ButtonRow>
            <Button type="button" disabled={busy || !megammrHostInput.trim()} onClick={onSave}>
              Save configuration
            </Button>
          </ButtonRow>
        </div>

        <dl className="m-0 grid gap-3 border-t border-slate-200 pt-4">
          <ConfigDetail label="megammrHost" value={config?.megammrHost ?? "loading..."} />
          <ConfigDetail label="megammrHostSource" value={config?.megammrHostSource ?? "loading..."} />
        </dl>
      </div>
    </SubSection>
  );
}
