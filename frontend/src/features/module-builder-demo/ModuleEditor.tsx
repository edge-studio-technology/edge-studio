import { useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  Braces,
  Check,
  CheckCircle2,
  ChevronRight,
  Circle,
  Code2,
  Download,
  Eye,
  FileCode2,
  FileJson2,
  FileText,
  Folder,
  Globe2,
  Info,
  Play,
  Plus,
  Save,
  Settings2,
  Terminal,
  UploadCloud,
  Workflow,
} from "lucide-react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Button } from "../../components/ui/Button";
import { InputField } from "../../components/ui/InputField";
import { Modal } from "../../components/ui/Modal";
import { useToast } from "../../components/ToastProvider";
import { cx } from "../../lib/cx";
import { DemoBadge, ModuleGlyph, SectionLabel } from "./DemoUi";
import { useDemo } from "./demoState";

function HighlightedCode({ source }: { source: string }) {
  return (
    <>
      {source.split("\n").map((line, lineIndex) => (
        <span key={lineIndex} className="block min-h-6">
          {line
            .split(
              /("[^"]*"|\b(?:import|from|export|default|return|const|async|true|false)\b|\/\/.*$)/g,
            )
            .map((part, index) => (
              <span
                key={index}
                className={
                  part.startsWith("//")
                    ? "text-[#6b7892]"
                    : part.startsWith('"')
                      ? "text-[#b4d998]"
                      : /^(import|from|export|default|return|const|async|true|false)$/.test(part)
                        ? "text-[#c5a2f4]"
                        : "text-[#c3d3eb]"
                }
              >
                {part || " "}
              </span>
            ))}
        </span>
      ))}
    </>
  );
}

export function ModuleEditor() {
  const { draftId } = useParams();
  const { drafts, saveDraft, publish, activate } = useDemo();
  const draft = drafts.find((item) => item.id === draftId) ?? drafts[0];
  const [files, setFiles] = useState(draft.files);
  const [activeFile, setActiveFile] = useState("src/index.ts");
  const [moduleName, setModuleName] = useState(draft.name);
  const [description, setDescription] = useState(draft.description);
  const [dirty, setDirty] = useState(false);
  const [workspaceTab, setWorkspaceTab] = useState("Code");
  const [consoleTab, setConsoleTab] = useState("Output");
  const [previewTab, setPreviewTab] = useState(
    draft.icon === "cpu"
      ? "Hardware support"
      : draft.icon === "thermometer"
        ? "Device setup"
        : "Block preview",
  );
  const [hardwareEnabled, setHardwareEnabled] = useState(false);
  const [threshold, setThreshold] = useState("28");
  const [sample, setSample] = useState('{ "temperature": 31.4, "humidity": 62 }');
  const [result, setResult] = useState<string | null>(null);
  const [runError, setRunError] = useState(false);
  const [publishOpen, setPublishOpen] = useState(false);
  const [published, setPublished] = useState(false);
  const [agreed, setAgreed] = useState(false);
  const [activateOpen, setActivateOpen] = useState(false);
  const [readme, setReadme] = useState(true);
  const preRef = useRef<HTMLPreElement>(null);
  const lineRef = useRef<HTMLDivElement>(null);
  const { showToast } = useToast();
  const navigate = useNavigate();
  const source = files[activeFile] ?? "";
  const currentDraft = { ...draft, files, name: moduleName, description };
  function save() {
    saveDraft(currentDraft);
    setDirty(false);
    showToast({
      title: "Draft saved in the preview",
      message: "Demo drafts reset when you reload the page.",
      tone: "success",
    });
  }
  function runSample() {
    try {
      const input: unknown = JSON.parse(sample);
      if (
        typeof input !== "object" ||
        input === null ||
        !("temperature" in input) ||
        typeof input.temperature !== "number" ||
        !Number.isFinite(Number(threshold))
      )
        throw new Error("Use a numeric temperature and threshold for this sample.");
      setResult(
        JSON.stringify(
          {
            temperature: input.temperature,
            aboveThreshold: input.temperature > Number(threshold),
            message: input.temperature > Number(threshold) ? "Time to cool down" : "All good!",
          },
          null,
          2,
        ),
      );
      setRunError(false);
    } catch {
      setResult("Use valid JSON with a numeric temperature, and a numeric threshold.");
      setRunError(true);
    }
  }
  function exportDraft() {
    const url = URL.createObjectURL(
      new Blob([JSON.stringify({ demo: true, name: moduleName, files }, null, 2)], {
        type: "application/json",
      }),
    );
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${draft.id}.demo.json`;
    anchor.click();
    URL.revokeObjectURL(url);
    showToast({
      title: "Demo draft exported",
      message: "A source snapshot, not an executable module package.",
      tone: "info",
    });
  }
  return (
    <div className="flex min-h-[calc(100vh-102px)] flex-col">
      <div className="border-b border-zinc-200 bg-white px-5 py-6 md:px-8">
        <Link
          to="/demo/modules"
          className="mb-4 inline-flex items-center gap-1 text-[11px] text-zinc-400 hover:text-violet-600"
        >
          <ArrowLeft size={12} />
          Your modules
        </Link>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <ModuleGlyph icon={draft.icon} color={draft.color} />
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-xl font-semibold tracking-tight">{moduleName}</h1>
                <DemoBadge>Draft</DemoBadge>
              </div>
              <p className="mt-1.5 text-xs text-zinc-400">
                local.{draft.id} <span className="mx-1">/</span> v0.1.0{" "}
                <span className="mx-1">/</span> {dirty ? "Unsaved changes" : "All changes saved"}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="ghost" size="sm" iconStart={<Save />} onClick={save}>
              Save draft
            </Button>
            <Button variant="secondary" size="sm" iconStart={<Play />} onClick={runSample}>
              Test sample
            </Button>
            <Button
              size="sm"
              iconStart={<UploadCloud />}
              onClick={() => {
                setPublishOpen(true);
                setPublished(false);
                setAgreed(false);
              }}
            >
              Publish
            </Button>
          </div>
        </div>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-200 bg-white px-5 md:px-8">
        <div className="flex gap-6">
          {[
            { label: "Code", icon: Code2 },
            { label: "Configuration", icon: Settings2 },
            { label: "Preview", icon: Eye },
          ].map((tab) => (
            <button
              key={tab.label}
              onClick={() => setWorkspaceTab(tab.label)}
              className={cx(
                "flex cursor-pointer items-center gap-1.5 border-b-2 py-4 text-xs",
                workspaceTab === tab.label
                  ? "border-violet-600 font-semibold text-violet-600"
                  : "border-transparent text-zinc-400",
              )}
            >
              <tab.icon size={14} />
              {tab.label}
            </button>
          ))}
        </div>
        <div className="flex gap-3 py-3">
          <button
            onClick={exportDraft}
            className="flex cursor-pointer items-center gap-1.5 text-[11px] text-zinc-400 hover:text-violet-600"
          >
            <Download size={13} />
            Export source
          </button>
          <button
            onClick={() => setActivateOpen(true)}
            className="flex cursor-pointer items-center gap-1.5 text-[11px] font-semibold text-violet-600"
          >
            <Play size={12} />
            Activate locally
          </button>
        </div>
      </div>
      <div className="flex min-h-[650px] flex-1">
        <aside
          className={cx(
            "w-44 shrink-0 border-r border-zinc-200 bg-white py-5",
            workspaceTab !== "Code" ? "hidden" : "hidden xl:block",
          )}
        >
          <div className="flex items-center justify-between px-4">
            <SectionLabel>EXPLORER</SectionLabel>
            <button
              aria-label="Add file"
              onClick={() => {
                const filename = `src/example-${Object.keys(files).length}.ts`;
                setFiles({ ...files, [filename]: "// A new file, a new possibility.\n" });
                setActiveFile(filename);
                setDirty(true);
              }}
              className="cursor-pointer text-zinc-400 hover:text-violet-600"
            >
              <Plus size={13} />
            </button>
          </div>
          <p className="mt-5 mb-2 flex items-center gap-1 px-4 text-xs font-semibold text-zinc-600">
            <ChevronRight size={12} />
            <Folder size={13} />
            {draft.id}
          </p>
          {Object.keys(files).map((file) => (
            <button
              key={file}
              onClick={() => setActiveFile(file)}
              className={cx(
                "flex w-full cursor-pointer items-center gap-2 px-5 py-2.5 text-left text-[11px]",
                file === activeFile
                  ? "border-r-2 border-violet-600 bg-violet-50 text-violet-700"
                  : "text-zinc-400 hover:bg-zinc-50",
              )}
            >
              {file.endsWith(".json") ? (
                <FileJson2 size={13} />
              ) : file.endsWith(".md") ? (
                <FileText size={13} />
              ) : (
                <FileCode2 size={13} />
              )}
              <span className="truncate">{file}</span>
            </button>
          ))}
          <div className="mx-4 mt-10 rounded-lg border border-zinc-100 p-3">
            <p className="flex items-center gap-1 text-[10px] font-semibold text-zinc-500">
              <Circle size={6} fill="currentColor" className="text-emerald-500" />
              Local workspace
            </p>
            <p className="mt-2 text-[10px] leading-relaxed text-zinc-400">
              A private draft. Share it only when you're ready.
            </p>
          </div>
        </aside>
        <div
          className={cx(
            "min-w-0 flex-1",
            workspaceTab === "Preview" ? "hidden xl:block" : "flex flex-col",
          )}
        >
          {workspaceTab === "Configuration" ? (
            <div className="flex-1 space-y-7 bg-[#fafafa] p-7">
              <div>
                <h2 className="text-xl font-semibold">A name, a purpose, a place to start.</h2>
                <p className="mt-2 text-xs text-zinc-400">
                  Describe what your module brings to someone's workspace.
                </p>
              </div>
              <InputField
                label="Module name"
                value={moduleName}
                onChange={(event) => {
                  setModuleName(event.target.value);
                  setDirty(true);
                }}
              />
              <InputField
                label="Short description"
                value={description}
                onChange={(event) => {
                  setDescription(event.target.value);
                  setDirty(true);
                }}
              />
              <div className="grid gap-5 sm:grid-cols-2">
                <InputField label="Version" defaultValue="0.1.0" />
                <InputField label="License" defaultValue="MIT" />
              </div>
              <div className="rounded-xl border border-violet-100 bg-violet-50 p-5">
                <h3 className="flex items-center gap-2 text-sm font-semibold text-violet-800">
                  <Workflow size={17} />
                  What this module contributes
                </h3>
                <p className="mt-3 text-sm text-violet-600">1 workflow block · Check temperature</p>
                <p className="mt-2 text-xs text-violet-500">
                  Contribution and runtime settings are illustrative in this preview.
                </p>
              </div>
            </div>
          ) : (
            <>
              <div className="flex min-h-11 items-center justify-between gap-2 overflow-x-auto border-b border-[#303145] bg-[#242536] px-3">
                <div className="flex gap-1">
                  {Object.keys(files)
                    .slice(0, 3)
                    .map((file) => (
                      <button
                        key={file}
                        onClick={() => setActiveFile(file)}
                        className={cx(
                          "flex cursor-pointer items-center gap-2 rounded-t-md px-3 py-3 text-[10px] whitespace-nowrap",
                          file === activeFile ? "bg-[#191b29] text-zinc-200" : "text-zinc-500",
                        )}
                      >
                        <FileCode2 size={12} className="text-violet-300" />
                        {file.split("/").slice(-1)[0]}
                        {dirty && file === activeFile && (
                          <span className="size-1 rounded-full bg-violet-300" />
                        )}
                      </button>
                    ))}
                </div>
                <span className="hidden pr-2 text-[10px] text-zinc-500 md:block">
                  TypeScript · UTF-8
                </span>
              </div>
              <div className="relative flex min-h-[470px] flex-1 overflow-hidden bg-[#191b29]">
                <div
                  ref={lineRef}
                  aria-hidden
                  className="w-12 shrink-0 overflow-hidden py-5 text-right font-mono text-[11px] leading-6 text-[#4e566d]"
                >
                  {source.split("\n").map((_, index) => (
                    <div key={index} className="pr-3">
                      {index + 1}
                    </div>
                  ))}
                </div>
                <div className="relative min-w-0 flex-1">
                  <pre
                    ref={preRef}
                    aria-hidden
                    className="pointer-events-none absolute inset-0 m-0 overflow-hidden px-2 py-5 font-mono text-[11px] leading-6 whitespace-pre"
                  >
                    <HighlightedCode source={source} />
                  </pre>
                  <textarea
                    aria-label={`Edit ${activeFile}`}
                    spellCheck={false}
                    value={source}
                    onChange={(event) => {
                      setFiles({ ...files, [activeFile]: event.target.value });
                      setDirty(true);
                    }}
                    onScroll={(event) => {
                      if (preRef.current) {
                        preRef.current.scrollTop = event.currentTarget.scrollTop;
                        preRef.current.scrollLeft = event.currentTarget.scrollLeft;
                      }
                      if (lineRef.current)
                        lineRef.current.scrollTop = event.currentTarget.scrollTop;
                    }}
                    className="absolute inset-0 h-full w-full resize-none border-none bg-transparent px-2 py-5 font-mono text-[11px] leading-6 whitespace-pre text-transparent caret-white outline-none"
                  />
                </div>
              </div>
            </>
          )}
          <div className="min-h-44 border-t border-zinc-200 bg-white">
            <div className="flex items-center justify-between border-b border-zinc-100 px-5">
              <div className="flex gap-5">
                {["Output", "Logs"].map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setConsoleTab(tab)}
                    className={cx(
                      "cursor-pointer border-b-2 py-3 text-[11px]",
                      consoleTab === tab
                        ? "border-violet-500 text-zinc-800"
                        : "border-transparent text-zinc-400",
                    )}
                  >
                    {tab === "Output" ? (
                      <span className="flex items-center gap-1.5">
                        <Terminal size={12} />
                        {tab}
                      </span>
                    ) : (
                      tab
                    )}
                  </button>
                ))}
              </div>
              <span className="text-[9px] text-zinc-400">
                Simulated runtime · Source is not executed
              </span>
            </div>
            {result ? (
              <div className="p-5">
                <p
                  className={cx(
                    "mb-2 flex items-center gap-1.5 text-[10px]",
                    runError ? "text-red-600" : "text-emerald-600",
                  )}
                >
                  <CheckCircle2 size={12} />
                  {runError ? "Sample input needs attention" : "Sample preview completed"}
                </p>
                <pre className="overflow-auto bg-transparent font-mono text-[10px] leading-5 text-zinc-600">
                  {consoleTab === "Output"
                    ? result
                    : `[preview] Received sample input\n[preview] Threshold: ${threshold}°C\n[preview] Illustrative result generated\n[preview] Draft code was not executed`}
                </pre>
              </div>
            ) : (
              <div className="flex items-start gap-3 p-5">
                <span className="rounded-lg bg-zinc-50 p-2 text-zinc-400">
                  <Terminal size={17} />
                </span>
                <div>
                  <p className="text-xs font-semibold text-zinc-600">
                    A good idea starts with a little experiment.
                  </p>
                  <p className="mt-2 text-[11px] text-zinc-400">
                    Choose Test sample to preview output with the data on the right.
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
        <aside
          className={cx(
            "w-full shrink-0 border-l border-zinc-200 bg-white xl:w-[310px] 2xl:w-[345px]",
            workspaceTab === "Preview" ? "block" : "hidden xl:block",
          )}
        >
          <div className="flex items-center gap-4 border-b border-zinc-100 px-5">
            {["Preview", "Test input"].map((tab) => (
              <button
                key={tab}
                onClick={() => setPreviewTab(tab === "Preview" ? "Block preview" : tab)}
                className={cx(
                  "cursor-pointer border-b-2 py-4 text-[11px]",
                  (tab === "Preview" && previewTab !== "Test input") || previewTab === tab
                    ? "border-violet-600 font-semibold text-zinc-700"
                    : "border-transparent text-zinc-400",
                )}
              >
                {tab}
              </button>
            ))}
          </div>
          <div className="space-y-6 p-5">
            {previewTab !== "Test input" && (
              <label className="block text-[10px] text-zinc-400">
                PREVIEW SURFACE
                <select
                  aria-label="Preview surface"
                  value={previewTab}
                  onChange={(event) => setPreviewTab(event.target.value)}
                  className="mt-2 h-9 w-full rounded-lg border border-zinc-200 bg-white px-3 text-xs text-zinc-600"
                >
                  <option value="Block preview">Workflow block</option>
                  <option>Device setup</option>
                  <option>Hardware support</option>
                </select>
              </label>
            )}
            {previewTab === "Device setup" ? (
              <>
                <SectionLabel>HOW IT APPEARS IN ADD DEVICE</SectionLabel>
                <div className="rounded-xl border border-violet-200 p-4">
                  <ModuleGlyph icon="thermometer" color="green" />
                  <h3 className="mt-3 text-sm font-semibold">{moduleName}</h3>
                  <p className="mt-2 text-[11px] text-zinc-400">
                    A guided setup experience, defined by your module.
                  </p>
                  <div className="mt-4 flex gap-2">
                    <DemoBadge tone="purple">Configure</DemoBadge>
                    <DemoBadge>Test</DemoBadge>
                    <DemoBadge>Ready</DemoBadge>
                  </div>
                </div>
                <InputField label="Device name" defaultValue="My greenhouse sensor" />
                <InputField label="Sensor address" defaultValue="0x76" />
                <Button size="sm" variant="accent" onClick={runSample} iconStart={<Play />}>
                  Preview connection test
                </Button>
                {result && !runError && (
                  <div className="rounded-xl bg-emerald-50 p-4 text-xs text-emerald-700">
                    <CheckCircle2 size={18} className="mb-2" />
                    Sample connection ready · 31.4°C
                    <p className="mt-2 text-[10px]">
                      Illustrative reading. No device was contacted.
                    </p>
                  </div>
                )}
                <p className="text-[10px] leading-relaxed text-zinc-400">
                  Configuration fields, setup steps, and guides come from the module in the planned
                  system.
                </p>
              </>
            ) : previewTab === "Hardware support" ? (
              <>
                <SectionLabel>HOW IT APPEARS IN HARDWARE SUPPORT</SectionLabel>
                <div className="rounded-xl border border-zinc-200 p-4">
                  <div className="flex items-center justify-between">
                    <ModuleGlyph icon="cpu" color="purple" />
                    <DemoBadge tone={hardwareEnabled ? "green" : "neutral"}>
                      {hardwareEnabled ? "Enabled" : "Ready to enable"}
                    </DemoBadge>
                  </div>
                  <h3 className="mt-3 text-sm font-semibold">{moduleName}</h3>
                  <p className="mt-2 text-[11px] text-zinc-400">Host agent capability · Preview</p>
                </div>
                <div className="space-y-3">
                  {[
                    "Host agent connected",
                    "Prerequisites available",
                    "Sample hardware detected",
                  ].map((item) => (
                    <p key={item} className="flex items-center gap-2 text-[11px] text-zinc-500">
                      <Check size={13} className="text-emerald-500" />
                      {item}
                    </p>
                  ))}
                </div>
                <div className="rounded-xl bg-amber-50 p-4 text-[11px] leading-relaxed text-amber-800">
                  <strong>Full host access</strong>
                  <p className="mt-2">
                    The planned capability can run privileged setup and hardware code. This preview
                    runs nothing.
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="accent"
                  onClick={() => setHardwareEnabled(!hardwareEnabled)}
                >
                  {hardwareEnabled ? "Preview disable" : "Preview enable"}
                </Button>
                <p className="text-[10px] leading-relaxed text-zinc-400">
                  Only this visual state changes. The hardware agent is not connected.
                </p>
              </>
            ) : previewTab === "Block preview" ? (
              <>
                <SectionLabel>HOW IT FITS INTO A WORKFLOW</SectionLabel>
                <div className="rounded-xl border border-dashed border-violet-200 bg-violet-50/40 p-5">
                  <div className="mx-auto w-fit rounded-lg border border-zinc-200 bg-white px-4 py-2 text-[10px] text-zinc-500">
                    <span className="inline-flex items-center gap-2">
                      <Play size={11} />
                      Sensor reading
                    </span>
                  </div>
                  <div className="mx-auto h-6 w-px bg-violet-200" />
                  <div className="relative rounded-xl border border-violet-400 bg-white p-4 shadow-sm shadow-violet-100">
                    <span className="absolute top-1/2 -left-1 size-2 rounded-full border-2 border-violet-400 bg-white" />
                    <span className="absolute top-1/2 -right-1 size-2 rounded-full border-2 border-violet-400 bg-white" />
                    <p className="flex items-center gap-2 text-xs font-semibold">
                      <span className="rounded-md bg-violet-50 p-1.5 text-violet-600">
                        <Braces size={14} />
                      </span>
                      Check temperature
                    </p>
                    <p className="mt-3 text-[10px] text-zinc-400">
                      If temperature is above {threshold || "28"}°C
                    </p>
                    <div className="mt-3 flex gap-1">
                      <DemoBadge tone="purple">Condition</DemoBadge>
                      <DemoBadge>Your module</DemoBadge>
                    </div>
                  </div>
                  <div className="mx-auto h-6 w-px bg-violet-200" />
                  <div className="mx-auto flex size-7 items-center justify-center rounded-full border border-dashed border-violet-300 bg-white text-violet-500">
                    <Plus size={13} />
                  </div>
                </div>
                <div>
                  <h3 className="mb-4 text-xs font-semibold">Block configuration</h3>
                  <InputField
                    label="Temperature threshold (°C)"
                    type="number"
                    value={threshold}
                    onChange={(event) => setThreshold(event.target.value)}
                  />
                  <p className="mt-3 text-[10px] leading-relaxed text-zinc-400">
                    Generated from your configuration schema. Try changing the threshold.
                  </p>
                </div>
                <button
                  onClick={() => setPreviewTab("Test input")}
                  className="inline-flex cursor-pointer items-center gap-1.5 text-xs font-semibold text-violet-600"
                >
                  Try it with sample data <ArrowRight size={13} />
                </button>
              </>
            ) : (
              <>
                <SectionLabel>SAMPLE WORKFLOW INPUT</SectionLabel>
                <textarea
                  aria-label="Sample input JSON"
                  value={sample}
                  onChange={(event) => setSample(event.target.value)}
                  className="h-48 w-full resize-y rounded-xl border border-zinc-200 bg-zinc-50 p-4 font-mono text-xs leading-6 text-zinc-600 outline-violet-500"
                />
                <InputField
                  label="Threshold (°C)"
                  type="number"
                  value={threshold}
                  onChange={(event) => setThreshold(event.target.value)}
                />
                <Button size="sm" variant="accent" iconStart={<Play />} onClick={runSample}>
                  Run sample preview
                </Button>
                <p className="flex items-start gap-2 text-[10px] leading-relaxed text-zinc-400">
                  <Info size={13} className="shrink-0" />
                  Preview uses a fixed temperature example. Editing source does not execute code in
                  this demo.
                </p>
                {result && (
                  <pre className="overflow-x-auto rounded-lg bg-zinc-50 p-3 font-mono text-[10px] leading-5 text-zinc-600">
                    {result}
                  </pre>
                )}
              </>
            )}
            <div className="border-t border-zinc-100 pt-5">
              <p className="flex items-center gap-2 text-[10px] font-semibold text-zinc-500">
                <Check size={13} className="text-emerald-500" />
                Your workspace, your choice
              </p>
              <p className="mt-2 text-[10px] leading-relaxed text-zinc-400">
                Keep this module local, or share a version when you're ready.
              </p>
            </div>
          </div>
        </aside>
      </div>
      {activateOpen && (
        <Modal
          title="Try it in your workspace"
          description="Activate a local version of your module in the preview."
          onClose={() => setActivateOpen(false)}
          footer={
            <>
              <Button variant="ghost" onClick={() => setActivateOpen(false)}>
                Cancel
              </Button>
              <Button
                variant="accent"
                onClick={() => {
                  saveDraft(currentDraft);
                  activate(currentDraft);
                  setActivateOpen(false);
                  setDirty(false);
                }}
              >
                Activate demo version
              </Button>
            </>
          }
        >
          <div className="space-y-4 p-6 text-sm text-zinc-500">
            <p>
              <strong className="text-zinc-800">{moduleName}</strong> will appear under Installed as
              a local module.
            </p>
            <p>
              This demonstration adds a sample entry. It does not compile, run, install, or grant
              host access to your code.
            </p>
          </div>
        </Modal>
      )}
      {publishOpen && (
        <Modal
          title={published ? "Your idea is out there." : "A small idea. A wider world."}
          description={
            published
              ? "Your sample listing is now in the demo library."
              : "Preview how your module becomes a community contribution."
          }
          onClose={() => setPublishOpen(false)}
          footer={
            published ? (
              <>
                <Button variant="ghost" onClick={() => setPublishOpen(false)}>
                  Keep building
                </Button>
                <Button
                  variant="accent"
                  iconEnd={<ArrowUpRight />}
                  onClick={() => navigate(`/demo/library/community-${draft.id}`)}
                >
                  View in library
                </Button>
              </>
            ) : (
              <>
                <Button variant="ghost" onClick={() => setPublishOpen(false)}>
                  Keep it local
                </Button>
                <Button
                  variant="accent"
                  disabled={!agreed || !readme || !moduleName.trim()}
                  onClick={() => {
                    saveDraft(currentDraft);
                    publish(currentDraft);
                    setPublished(true);
                    setDirty(false);
                  }}
                  iconStart={<Globe2 />}
                >
                  Publish demo listing
                </Button>
              </>
            )
          }
        >
          <div className="space-y-5 p-6">
            {published ? (
              <div className="py-5 text-center">
                <span className="mx-auto flex size-16 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
                  <Check size={30} />
                </span>
                <h3 className="mt-5 text-xl font-semibold">{moduleName}</h3>
                <p className="mt-3 text-sm leading-relaxed text-zinc-500">
                  A new possibility in the community library.
                  <br />
                  This listing lives only in your current demo session.
                </p>
              </div>
            ) : (
              <>
                <div className="flex items-center gap-4 rounded-xl border border-zinc-200 p-4">
                  <ModuleGlyph icon={draft.icon} color={draft.color} />
                  <div>
                    <h3 className="font-semibold">{moduleName}</h3>
                    <p className="mt-1 text-xs text-zinc-400">Alex Morgan · v0.1.0 · MIT</p>
                  </div>
                  <DemoBadge tone="purple">Public</DemoBadge>
                </div>
                <InputField
                  label="Listing title"
                  value={moduleName}
                  onChange={(event) => setModuleName(event.target.value)}
                />
                <InputField
                  label="Short description"
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                />
                <label className="flex cursor-pointer items-center gap-2 text-xs text-zinc-600">
                  <input
                    type="checkbox"
                    checked={readme}
                    onChange={(event) => setReadme(event.target.checked)}
                    className="accent-violet-600"
                  />
                  Include documentation and examples
                </label>
                <div className="rounded-xl bg-violet-50 p-4">
                  <p className="text-xs leading-relaxed text-violet-700">
                    Publishing shares your code and module definitions. Device settings,
                    credentials, and workflow history stay with your workspace.
                  </p>
                </div>
                <label className="flex cursor-pointer items-start gap-2 text-xs leading-relaxed text-zinc-500">
                  <input
                    type="checkbox"
                    checked={agreed}
                    onChange={(event) => setAgreed(event.target.checked)}
                    className="mt-0.5 accent-violet-600"
                  />
                  I have reviewed the package contents and have the right to share them.
                </label>
                <p className="text-[10px] text-zinc-400">
                  Demo publication only. No files are uploaded and no public website is changed.
                </p>
              </>
            )}
          </div>
        </Modal>
      )}
    </div>
  );
}
