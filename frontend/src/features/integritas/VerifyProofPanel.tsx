import { ButtonRow } from "../../components/ButtonRow";
import { Button } from "../../components/ui/Button";
import { FileDropBox } from "./FileDropBox";
import { VerifyResult } from "./VerifyResult";

export function VerifyProofPanel({
  file,
  setFile,
  busy,
  onVerifyFile,
  result,
  onClearResult,
}: {
  file: File | null;
  setFile: (file: File | null) => void;
  busy: boolean;
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
      />
      <ButtonRow>
        <Button type="button" disabled={busy || !file} onClick={onVerifyFile}>
          Verify proof
        </Button>
      </ButtonRow>
      {result && <VerifyResult response={result.response} onClose={onClearResult} />}
    </div>
  );
}
