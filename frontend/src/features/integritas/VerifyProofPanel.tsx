import { ButtonRow } from "../../components/ButtonRow";
import { Button } from "../../components/ui/Button";
import { FileDropBox } from "../../components/patterns/FileDropBox";
import { LoadingState } from "../../components/patterns/LoadingState";
import { VerifyResult } from "./VerifyResult";

export function VerifyProofPanel({
  file,
  setFile,
  busy,
  loading,
  onVerifyFile,
  result,
  onClearResult,
}: {
  file: File | null;
  setFile: (file: File | null) => void;
  busy: boolean;
  loading: boolean;
  onVerifyFile: () => void;
  result: { response: unknown } | null;
  onClearResult: () => void;
}) {
  return (
    <div className="gap-detail-close flex flex-col">
      <FileDropBox
        title="Upload a JSON proof file"
        file={file}
        onFile={setFile}
        accept=".json,application/json"
        busy={busy}
      />
      <ButtonRow>
        <Button type="button" disabled={busy || !file} onClick={onVerifyFile}>
          Verify proof
        </Button>
      </ButtonRow>
      {loading ? (
        <LoadingState
          title="Verifying your proof"
          description="This should take a few seconds."
          className="min-h-64"
        />
      ) : result ? (
        <VerifyResult response={result.response} onClose={onClearResult} />
      ) : null}
    </div>
  );
}
