import { ButtonRow } from "../../components/ButtonRow";
import { Button } from "../../components/ui/Button";
import { FileDropBox } from "./FileDropBox";

export function StampFilePanel({
  file,
  setFile,
  busy,
  onStamp,
}: {
  file: File | null;
  setFile: (file: File | null) => void;
  busy: boolean;
  onStamp: () => void;
}) {
  return (
    <div className="gap-detail-close flex flex-col">
      <FileDropBox title="Upload a local data file" file={file} onFile={setFile} />
      <ButtonRow>
        <Button type="button" disabled={busy || !file} onClick={onStamp}>
          Stamp file
        </Button>
      </ButtonRow>
    </div>
  );
}
