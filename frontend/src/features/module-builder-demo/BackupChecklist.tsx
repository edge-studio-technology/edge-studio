import { useState } from "react";
import { Button } from "../../components/ui/Button";
import { useDemo } from "./demoState";
import { downloadDemoFile } from "./demoPackaging";

export function BackupChecklist() {
  const { modules, drafts, activity } = useDemo();
  const [exports, setExports] = useState<string[]>([]);
  function exportSample(kind: "device" | "logs") {
    downloadDemoFile(`edge-studio-${kind}.demo.json`, {
      demo: true,
      kind,
      restorable: false,
      notice:
        "Demo sample only. This is not a backup of your device and cannot restore Edge Studio.",
      ...(kind === "device" ? { modules, drafts } : { activity }),
    });
    setExports((items) => [...items.filter((item) => item !== kind), kind]);
  }
  return (
    <section
      aria-label="Backup before changing modules"
      className="rounded-xl border border-amber-200 bg-amber-50 p-4"
    >
      <h3 className="text-sm font-semibold text-amber-950">Back up before changing modules</h3>
      <p className="mt-2 text-xs leading-relaxed text-amber-900">
        In the planned app, export your device and logs before installation or an update. Device
        exports support user-directed restore; logs help diagnose failures. Host changes may need
        separate recovery.
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button size="sm" variant="secondary" onClick={() => exportSample("device")}>
          Export device (demo)
        </Button>
        <Button size="sm" variant="secondary" onClick={() => exportSample("logs")}>
          Export logs (demo)
        </Button>
      </div>
      <p aria-live="polite" className="mt-3 text-xs text-amber-900">
        {exports.length > 0 ? `Sample exports downloaded: ${exports.join(", ")}. ` : ""}
        These files contain sample state only and cannot restore a device. Continuing without
        exports is allowed in this demo; the production skip policy remains undecided.
      </p>
    </section>
  );
}
