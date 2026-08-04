import { ButtonRow } from "../../components/ButtonRow";
import { Button } from "../../components/ui/Button";
import { FileDropBox } from "./FileDropBox";
import { StampResult } from "./StampResult";
import type { IntegritasProofRecord } from "./integritasTypes";

export function StampFilePanel({
  file,
  setFile,
  busy,
  onStamp,
  resultRecord,
  resultDetails,
  onClearResult,
}: {
  file: File | null;
  setFile: (file: File | null) => void;
  busy: boolean;
  onStamp: () => void;
  resultRecord: IntegritasProofRecord | null;
  resultDetails: unknown;
  onClearResult: () => void;
}) {
  return (
    <div className="gap-detail-close flex flex-col">
      <FileDropBox title="Upload a local data file" file={file} onFile={setFile} busy={busy} />
      <ButtonRow>
        <Button type="button" disabled={busy || !file} onClick={onStamp}>
          Stamp file
        </Button>
      </ButtonRow>
      {resultRecord ? (
        <StampResult
          record={resultRecord}
          technicalDetails={resultDetails ?? undefined}
          onClose={onClearResult}
        />
      ) : null}
    </div>
  );
}
