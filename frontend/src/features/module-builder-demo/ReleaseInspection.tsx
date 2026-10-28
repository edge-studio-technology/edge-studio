import { useState } from "react";
import { Button } from "../../components/ui/Button";
import { type DemoModule } from "./demoData";
import { demoReleaseFiles, downloadDemoFile } from "./demoPackaging";

export function ReleaseInspection({ module }: { module: DemoModule }) {
  const files = demoReleaseFiles(module);
  const [filename, setFilename] = useState(Object.keys(files)[0]);
  const [note, setNote] = useState("");
  const [report, setReport] = useState("");
  return (
    <section className="min-w-0 space-y-5">
      <div>
        <h2 className="text-xl font-semibold">Inspect release v{module.version}</h2>
        <p className="mt-2 text-xs leading-relaxed text-zinc-500">
          {module.author} · {module.id} · Published source snapshot. Local draft edits do not alter
          this release.{" "}
          {module.releaseFiles
            ? "Source captured when this demo listing was published."
            : "Seeded listings contain illustrative fixtures, not actual device drivers."}
        </p>
      </div>
      <label className="block text-xs font-semibold text-zinc-600">
        Release file
        <select
          aria-label="Release source file"
          value={filename}
          onChange={(event) => setFilename(event.target.value)}
          className="mt-2 w-full rounded-lg border border-zinc-200 bg-white p-3 text-xs"
        >
          {Object.keys(files).map((file) => (
            <option key={file}>{file}</option>
          ))}
        </select>
      </label>
      <pre
        aria-label="Release source"
        className="max-h-96 overflow-auto rounded-xl bg-[#191b29] p-5 text-xs leading-6 text-zinc-200"
      >
        {files[filename]}
      </pre>
      <Button
        size="sm"
        variant="secondary"
        onClick={() =>
          downloadDemoFile(`${module.id}-${module.version}.release-source.demo.json`, {
            demo: true,
            module: module.id,
            version: module.version,
            files,
          })
        }
      >
        Download release source (demo)
      </Button>
      <div className="rounded-xl border border-zinc-200 p-4 text-xs leading-relaxed text-zinc-600">
        <h3 className="font-semibold">Dependencies, changes, and provenance</h3>
        <p className="mt-2">
          Read the manifest and source imports for declared dependencies. This demo does not resolve
          or scan transitive dependencies. Requested host access:{" "}
          {module.hostAccess
            ? "full privileged host access"
            : "app services / workflow data (sample declaration)"}
          .
        </p>
        <p className="mt-2">
          Release notes are under Versions. Local changes require a new package; modified copies
          must be labelled accordingly. Production digests and signatures are planned, not verified
          here.
        </p>
        <p className="mt-2">
          License and redistribution policy remain open under D8. Inspectable source does not imply
          that a particular license has been chosen.
        </p>
      </div>
      <label className="block text-xs font-semibold text-zinc-600">
        Community inspection report · v{module.version}
        <textarea
          aria-label="Community inspection report"
          value={note}
          onChange={(event) => setNote(event.target.value)}
          rows={3}
          className="mt-2 w-full rounded-lg border border-zinc-200 p-3 text-xs"
          placeholder="Share a code observation, dependency concern, or question about this release."
        />
      </label>
      <Button size="sm" disabled={!note.trim()} onClick={() => setReport(note.trim())}>
        Save demo inspection report
      </Button>
      {report && (
        <p role="status" className="rounded-xl bg-violet-50 p-4 text-xs text-violet-800">
          Community inspection · v{module.version}: {report}
        </p>
      )}
      <p className="text-[10px] text-zinc-400">
        Inspection reports are separate from purchase reviews and do not certify safety. This note
        resets when you leave Source.
      </p>
    </section>
  );
}
