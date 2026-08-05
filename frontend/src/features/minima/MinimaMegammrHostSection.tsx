import { Globe } from "lucide-react";
import type { MinimaConfig } from "../../app/types";
import { Button } from "../../components/Button";
import { ButtonRow } from "../../components/ButtonRow";
import { DetailList, DetailRow } from "../../components/patterns/DetailList";
import { SubSection } from "../../components/patterns/SubSection";
import { InputField } from "../../components/ui/InputField";

const detailRowClass = "sm:grid-cols-[11rem_minmax(0,1fr)]";

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

        <DetailList>
          <DetailRow
            label="megammrHost"
            value={config?.megammrHost ?? "loading..."}
            mono
            className={detailRowClass}
          />
          <DetailRow
            label="megammrHostSource"
            value={config?.megammrHostSource ?? "loading..."}
            mono
            className={detailRowClass}
          />
        </DetailList>
      </div>
    </SubSection>
  );
}
