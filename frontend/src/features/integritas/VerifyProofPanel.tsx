import { ButtonRow } from "../../components/ButtonRow";
import { Button } from "../../components/ui/Button";
import { FileDropBox } from "./FileDropBox";
import { ResultLoadingShell } from "./ResultLoadingShell";
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
        <ResultLoadingShell
          title="Verifying proof"
          description="Uploading the proof file and checking the result."
          ariaLabel="Verify result loading"
        />
      ) : result ? (
        <VerifyResult response={result.response} onClose={onClearResult} />
      ) : null}
    </div>
  );
}
