import { ButtonRow } from "../../components/ButtonRow";
import { Button } from "../../components/ui/Button";
import { FileDropBox } from "../../components/patterns/FileDropBox";
import { LoadingState } from "../../components/patterns/LoadingState";
import { StampResult } from "./StampResult";
import type { IntegritasProofRecord } from "./integritasTypes";

export function StampFilePanel({
  file,
  setFile,
  busy,
  loading,
  onStamp,
  resultRecord,
  resultDetails,
  onClearResult,
}: {
  file: File | null;
  setFile: (file: File | null) => void;
  busy: boolean;
  loading: boolean;
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
      {loading ? (
        <LoadingState
          title="Stamping your file"
          description="This should take a few seconds."
          className="min-h-64"
        />
      ) : resultRecord ? (
        <StampResult
          record={resultRecord}
          technicalDetails={resultDetails ?? undefined}
          onClose={onClearResult}
        />
      ) : null}
    </div>
  );
}
