import { useState } from "react";
import {
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  Check,
  ChevronDown,
  Code2,
  Download,
  FileCode2,
  FolderOpen,
  Layers3,
  PackagePlus,
  Plus,
  Search,
  Trash2,
  Upload,
} from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "../../components/ui/Button";
import { Modal } from "../../components/ui/Modal";
import { InputField } from "../../components/ui/InputField";
import { SwitchField } from "../../components/ui/SwitchField";
import { useToast } from "../../components/ToastProvider";
import { cx } from "../../lib/cx";
import { categories, sampleFiles, type DemoModule, type ModuleIcon } from "./demoData";
import { DemoBadge, ModuleGlyph, Publisher, SectionLabel } from "./DemoUi";
import { useDemo } from "./demoState";

export function ModuleManager() {
  const { modules, drafts, activity, uninstall, toggle, update, saveDraft } = useDemo();
  const [tab, setTab] = useState("Installed");
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("All capabilities");
  const [create, setCreate] = useState<"new" | "import" | null>(null);
  const [template, setTemplate] = useState("Workflow block");
  const [name, setName] = useState("");
  const [importName, setImportName] = useState("");
  const [removeTarget, setRemoveTarget] = useState<DemoModule | null>(null);
  const navigate = useNavigate();
  const { showToast } = useToast();
  const installed = modules.filter((item) => item.installed);
  const updates = installed.filter((item) => item.update);
  const visible = installed.filter(
    (item) =>
      (category === "All capabilities" || item.category === category) &&
      `${item.name} ${item.summary}`.toLowerCase().includes(search.toLowerCase()) &&
      (tab !== "Updates" || item.update),
  );
  function openCreate(mode: "new" | "import") {
    setCreate(mode);
    setName("");
    setImportName("");
  }
  function createDraft() {
    const draftName = name.trim() || "My first module";
    const id = `${draftName.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${Date.now()}`;
    const icon: ModuleIcon =
      template === "Hardware capability"
        ? "cpu"
        : template === "Device integration"
          ? "thermometer"
          : "workflow";
    const files = {
      ...sampleFiles,
      "src/index.ts": sampleFiles["src/index.ts"]
        .replace("local.greenhouse-monitor", `local.${id}`)
        .replace('name: "Greenhouse Monitor"', `name: ${JSON.stringify(draftName)}`),
      "module.json": JSON.stringify(
        {
          ...JSON.parse(sampleFiles["module.json"]),
          id: `local.${id}`,
          name: draftName,
          access: { host: template === "Hardware capability" },
        },
        null,
        2,
      ),
      "README.md": `# ${draftName}\n\nYour idea starts here.\n\nThis is an illustrative module draft.\n`,
    };
    saveDraft({
      id,
      name: draftName,
      description: `A new ${template.toLowerCase()} for your workspace.`,
      icon,
      color: "purple",
      files,
      saved: true,
    });
    setCreate(null);
    navigate(`/demo/modules/editor/${id}`);
    if (create === "import")
      showToast({
        title: "Import preview created",
        message: "This demo uses starter content; your selected file is not read or executed.",
        tone: "info",
      });
  }
  return (
    <div className="mx-auto max-w-[1440px] px-5 py-8 md:px-9 md:py-10">
      <div className="flex flex-wrap items-start justify-between gap-5">
        <div>
          <div className="mb-2 flex items-center gap-2">
            <SectionLabel>YOUR WORKSPACE, EXTENDED</SectionLabel>
            <DemoBadge tone="purple">Preview</DemoBadge>
          </div>
          <h1 className="text-3xl font-semibold tracking-[-0.04em] text-zinc-950 md:text-4xl">
            Module builder
          </h1>
          <p className="mt-3 text-sm text-zinc-500">
            Make Edge Studio work your way. Add capabilities, or build your own.
          </p>
        </div>
        <div className="flex gap-2 pt-2">
          <Button variant="ghost" iconStart={<Upload />} onClick={() => openCreate("import")}>
            Import module
          </Button>
          <Button variant="accent" iconStart={<Plus />} onClick={() => openCreate("new")}>
            Create module
          </Button>
        </div>
      </div>
      <div className="my-8 grid gap-4 xl:grid-cols-[1.65fr_1fr]">
        <div className="relative overflow-hidden rounded-2xl bg-[#1e1932] p-7 text-white">
          <div className="relative z-10 max-w-[65%]">
            <span className="text-[10px] font-semibold tracking-[0.18em] text-violet-300">
              FROM A SMALL IDEA TO SOMETHING USEFUL
            </span>
            <h2 className="mt-3 text-[26px] leading-tight font-semibold tracking-tight">
              A block. A device.
              <br />
              Your next possibility.
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-violet-200/70">
              Start with a template. Make it yours.
              <br />
              Keep it local, or share it with the world.
            </p>
            <button
              onClick={() => openCreate("new")}
              className="mt-5 inline-flex cursor-pointer items-center gap-2 text-sm font-semibold text-white"
            >
              Build your first module <ArrowRight size={16} />
            </button>
          </div>
          <div
            aria-hidden
            className="absolute top-10 -right-5 flex rotate-[-8deg] flex-col gap-3 md:right-8"
          >
            <span className="ml-12 flex size-16 items-center justify-center rounded-2xl border border-white/15 bg-white/10 shadow-xl">
              <Code2 className="text-violet-300" size={29} />
            </span>
            <div className="flex gap-3">
              <span className="flex size-16 items-center justify-center rounded-2xl border border-white/15 bg-white/5">
                <Layers3 className="text-white/80" size={29} />
              </span>
              <span className="mt-4 flex size-16 items-center justify-center rounded-2xl border border-violet-400/30 bg-violet-500/30">
                <PackagePlus className="text-violet-200" size={29} />
              </span>
            </div>
          </div>
        </div>
        <Link
          to="/demo/library"
          className="group flex flex-col justify-between rounded-2xl border border-violet-100 bg-[#f0edfb] p-7"
        >
          <div className="flex items-start justify-between">
            <span className="flex size-10 items-center justify-center rounded-xl bg-white text-violet-600">
              <FolderOpen size={21} />
            </span>
            <ArrowUpRight
              size={20}
              className="text-violet-500 transition group-hover:translate-x-1 group-hover:-translate-y-1"
            />
          </div>
          <div className="mt-5">
            <h2 className="text-xl font-semibold tracking-tight text-zinc-900">
              There's a module for that.
            </h2>
            <p className="mt-2 max-w-xs text-sm leading-relaxed text-zinc-500">
              Discover tools, devices, and good ideas from the Edge Studio community.
            </p>
            <p className="mt-4 text-xs font-semibold text-violet-700">
              Explore the public library <span className="ml-1">→</span>
            </p>
          </div>
        </Link>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-zinc-200">
        <div className="flex gap-6 overflow-x-auto">
          {["Installed", "Drafts", "Updates", "Activity"].map((item) => (
            <button
              key={item}
              onClick={() => setTab(item)}
              className={cx(
                "flex cursor-pointer items-center gap-2 border-b-2 py-4 text-sm whitespace-nowrap",
                tab === item
                  ? "border-violet-600 font-semibold text-violet-700"
                  : "border-transparent text-zinc-400 hover:text-zinc-800",
              )}
            >
              {item}
              {item !== "Activity" && (
                <span
                  className={cx(
                    "rounded-md px-1.5 py-0.5 text-[10px]",
                    tab === item ? "bg-violet-50" : "bg-zinc-100",
                  )}
                >
                  {item === "Installed"
                    ? installed.length
                    : item === "Drafts"
                      ? drafts.length
                      : updates.length}
                </span>
              )}
            </button>
          ))}
        </div>
        <span className="flex items-center gap-1.5 pb-2 text-[11px] text-zinc-400">
          <span className="size-1.5 rounded-full bg-emerald-500" />
          Everything stays on your edge
        </span>
      </div>
      {(tab === "Installed" || tab === "Updates") && (
        <>
          <div className="my-6 flex flex-wrap items-center justify-between gap-3">
            <label className="flex h-10 w-full items-center gap-2 rounded-lg border border-zinc-200 bg-white px-3 sm:w-72">
              <Search size={15} className="text-zinc-400" />
              <input
                aria-label="Search installed modules"
                placeholder="Find a module…"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                className="min-w-0 flex-1 border-none bg-transparent text-xs outline-none"
              />
            </label>
            <label className="relative">
              <select
                aria-label="Filter capabilities"
                value={category}
                onChange={(event) => setCategory(event.target.value)}
                className="h-10 cursor-pointer appearance-none rounded-lg border border-zinc-200 bg-white pr-9 pl-3 text-xs text-zinc-600"
              >
                <option>All capabilities</option>
                {categories.map((item) => (
                  <option key={item}>{item}</option>
                ))}
              </select>
              <ChevronDown
                size={13}
                className="pointer-events-none absolute top-3.5 right-3 text-zinc-400"
              />
            </label>
          </div>
          <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
            {visible.map((module) => (
              <article
                key={module.id}
                className="flex flex-col rounded-xl border border-zinc-200 bg-white p-5 transition hover:border-zinc-300"
              >
                <div className="flex items-center gap-3">
                  <ModuleGlyph icon={module.icon} color={module.color} />
                  <div className="min-w-0">
                    <Link
                      to={
                        module.localOnly
                          ? `/demo/modules/editor/${module.id.replace(/^local-/, "")}`
                          : `/demo/library/${module.id}`
                      }
                      className="text-[15px] font-semibold tracking-tight hover:text-violet-700"
                    >
                      {module.name}
                    </Link>
                    <div className="mt-1">
                      <Publisher module={module} />
                    </div>
                  </div>
                  <div className="ml-auto">
                    <SwitchField
                      aria-label={`Activate ${module.name}`}
                      checked={module.enabled}
                      onChange={() => toggle(module.id)}
                    />
                  </div>
                </div>
                <p className="mt-4 text-xs leading-relaxed text-zinc-500">{module.summary}</p>
                <div className="mt-4 flex flex-wrap gap-1.5">
                  {module.contributions.slice(0, 2).map((item) => (
                    <DemoBadge key={item}>{item}</DemoBadge>
                  ))}
                </div>
                <div className="mt-5 flex items-center justify-between border-t border-zinc-100 pt-4">
                  <span className="text-[11px] text-zinc-400">
                    v{module.version}
                    <span
                      className={cx("ml-2", module.enabled ? "text-emerald-600" : "text-zinc-400")}
                    >
                      · {module.enabled ? "Active" : "Disabled"}
                    </span>
                  </span>
                  <div className="flex items-center gap-3">
                    {module.update && (
                      <button
                        onClick={() => update(module.id)}
                        className="cursor-pointer text-[11px] font-semibold text-violet-600"
                      >
                        Update to {module.update}
                      </button>
                    )}
                    <button
                      aria-label={`Uninstall ${module.name}`}
                      onClick={() => setRemoveTarget(module)}
                      className="cursor-pointer text-zinc-300 hover:text-red-500"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              </article>
            ))}
          </div>
          {visible.length === 0 && (
            <div className="rounded-xl border border-dashed border-zinc-200 py-14 text-center">
              <Search className="mx-auto mb-3 text-zinc-300" />
              <h3 className="font-semibold">
                {tab === "Updates" ? "You're all up to date." : "No matching modules"}
              </h3>
              <p className="mt-2 text-sm text-zinc-400">
                {tab === "Updates"
                  ? "Your demo modules are on their latest versions."
                  : "Try another search, or explore the library."}
              </p>
            </div>
          )}
        </>
      )}
      {tab === "Drafts" && (
        <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {drafts.map((draft) => (
            <Link
              key={draft.id}
              to={`/demo/modules/editor/${draft.id}`}
              className="group rounded-xl border border-zinc-200 bg-white p-6 hover:border-violet-300"
            >
              <div className="flex justify-between">
                <ModuleGlyph icon={draft.icon} color={draft.color} />
                <DemoBadge>Draft</DemoBadge>
              </div>
              <h3 className="mt-5 font-semibold">{draft.name}</h3>
              <p className="mt-2 text-xs leading-relaxed text-zinc-500">{draft.description}</p>
              <p className="mt-6 flex items-center justify-between text-xs text-zinc-400">
                {Object.keys(draft.files).length} files{" "}
                <span className="flex items-center gap-1 font-semibold text-violet-600">
                  Open workspace <ArrowRight size={13} />
                </span>
              </p>
            </Link>
          ))}
          <button
            onClick={() => openCreate("new")}
            className="flex min-h-56 cursor-pointer flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-zinc-300 text-sm text-zinc-400 hover:border-violet-400 hover:text-violet-600"
          >
            <Plus />
            Create something new
          </button>
        </div>
      )}
      {tab === "Activity" && (
        <div className="mt-6 rounded-xl border border-zinc-200 bg-white p-6">
          <h2 className="mb-5 font-semibold">A little history of your workspace</h2>
          {activity.map((item, index) => (
            <div
              key={`${index}-${item}`}
              className="flex items-center gap-3 border-b border-zinc-100 py-4 text-sm text-zinc-600 last:border-0"
            >
              <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-violet-50 text-violet-600">
                <Check size={13} />
              </span>
              {item}
            </div>
          ))}
        </div>
      )}
      <div className="mt-8 flex flex-wrap items-center justify-between gap-3 text-xs text-zinc-400">
        <span>Official modules and community ideas. One workspace.</span>
        <Link
          to="/demo/library?view=guide"
          className="inline-flex items-center gap-1.5 hover:text-violet-600"
        >
          <BookOpen size={13} />
          Meet the module system <ArrowUpRight size={12} />
        </Link>
      </div>
      {removeTarget && (
        <Modal
          title={`Remove ${removeTarget.name}?`}
          description="You can add it back from the library whenever you like."
          onClose={() => setRemoveTarget(null)}
          footer={
            <>
              <Button variant="ghost" onClick={() => setRemoveTarget(null)}>
                Keep module
              </Button>
              <Button
                variant="danger"
                onClick={() => {
                  uninstall(removeTarget.id);
                  setRemoveTarget(null);
                }}
              >
                Remove module
              </Button>
            </>
          }
        >
          <div className="space-y-4 p-6 text-sm text-zinc-500">
            <p>
              Its sample devices and blocks will become unavailable. Your saved settings and
              workflows will be kept for when you reinstall.
            </p>
            <div className="flex gap-2 rounded-xl bg-violet-50 p-4 text-xs text-violet-700">
              <Download size={16} />
              Try the demo: remove this module, find it in the public library, and install it again.
            </div>
          </div>
        </Modal>
      )}
      {create && (
        <Modal
          title={create === "import" ? "Bring your own module" : "What will you build?"}
          description={
            create === "import"
              ? "Preview how a package joins your workspace."
              : "Start small. You can add more capabilities as your idea grows."
          }
          onClose={() => setCreate(null)}
          footer={
            <>
              <Button variant="ghost" onClick={() => setCreate(null)}>
                Cancel
              </Button>
              <Button
                variant="accent"
                onClick={createDraft}
                disabled={!name.trim()}
                iconStart={<Plus />}
              >
                {create === "import" ? "Import as draft" : "Create draft"}
              </Button>
            </>
          }
        >
          <div className="space-y-6 p-6">
            {create === "import" ? (
              <label className="flex cursor-pointer flex-col items-center gap-3 rounded-xl border border-dashed border-violet-200 bg-violet-50/40 p-8 text-center">
                <Upload size={26} className="text-violet-500" />
                <span className="text-sm font-semibold">
                  {importName || "Choose a module package"}
                </span>
                <span className="text-xs text-zinc-400">
                  Demo import creates a starter draft; selected files are not read.
                </span>
                <input
                  type="file"
                  className="max-w-full text-xs"
                  aria-label="Choose module package"
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (file) {
                      setImportName(file.name);
                      setName(file.name.replace(/\.[^.]+$/, ""));
                    }
                  }}
                />
              </label>
            ) : (
              <div className="grid gap-3 sm:grid-cols-3">
                {[
                  {
                    name: "Workflow block",
                    icon: Code2,
                    text: "An action, a trigger, a new possibility.",
                  },
                  {
                    name: "Device integration",
                    icon: Layers3,
                    text: "A device with a setup experience.",
                  },
                  {
                    name: "Hardware capability",
                    icon: FileCode2,
                    text: "Connect directly to your hardware.",
                  },
                ].map((item) => (
                  <button
                    key={item.name}
                    onClick={() => setTemplate(item.name)}
                    className={cx(
                      "cursor-pointer rounded-xl border p-4 text-left",
                      template === item.name
                        ? "border-violet-500 bg-violet-50"
                        : "border-zinc-200 hover:border-violet-200",
                    )}
                  >
                    <item.icon size={23} className="text-violet-600" />
                    <p className="mt-4 text-sm font-semibold">{item.name}</p>
                    <p className="mt-2 text-xs leading-relaxed text-zinc-400">{item.text}</p>
                  </button>
                ))}
              </div>
            )}
            <InputField
              label="Module name"
              placeholder="Something useful starts with a name"
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
            <p className="text-xs text-zinc-400">
              Your draft stays local. Publishing is always your choice.
            </p>
          </div>
        </Modal>
      )}
    </div>
  );
}
