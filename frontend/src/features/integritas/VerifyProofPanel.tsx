import { ButtonRow } from "../../components/ButtonRow";
import { Button } from "../../components/ui/Button";
import { FileDropBox } from "./FileDropBox";

export function VerifyProofPanel({
  file,
  setFile,
  busy,
  result,
  onVerifyFile,
}: {
  file: File | null;
  setFile: (file: File | null) => void;
  busy: boolean;
  result: unknown;
  onVerifyFile: () => void;
}) {
  return (
    <div className="gap-detail-close flex flex-col">
      <FileDropBox
        title="Upload a JSON proof file"
        file={file}
        onFile={setFile}
        accept=".json,application/json"
        result={result}
        resultText="Drop a new file to verify again."
      />
      <ButtonRow>
        <Button type="button" disabled={busy || !file} onClick={onVerifyFile}>
          Verify proof
        </Button>
      </ButtonRow>
    </div>
  );
}
