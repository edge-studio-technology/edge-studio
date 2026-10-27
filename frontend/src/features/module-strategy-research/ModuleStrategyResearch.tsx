import { useEffect, useRef, useState } from "react";
import {
  ArrowUpRight,
  Check,
  ClipboardList,
  Download,
  FlaskConical,
  ListChecks,
  Radar,
  RotateCcw,
  SlidersHorizontal,
  Upload,
} from "lucide-react";
import { Link } from "react-router-dom";
import { BrandMark } from "../../components/BrandMark";
import { Button } from "../../components/ui/Button";
import { Modal } from "../../components/ui/Modal";
import { useToast } from "../../components/ToastProvider";
import { cx } from "../../lib/cx";
import { ApproachAssumptions, ApproachComparison } from "./ApproachComparison";
import { dimensions, initialApproaches, newWorkshop, type Workshop } from "./researchData";
import { parseWorkshop, serializeWorkshop, workshopReport } from "./researchModel";
import { TeamSurvey, WorkshopBrief } from "./WorkshopSurvey";

const STORAGE_KEY = "edge-studio.module-strategy-workshop.v1";
const tabs = [
  { id: "brief", label: "Workshop brief", icon: ClipboardList },
  { id: "survey", label: "Team priorities", icon: ListChecks },
  { id: "compare", label: "Compare paths", icon: Radar },
  { id: "assumptions", label: "Path assumptions", icon: SlidersHorizontal },
] as const;
type TabId = (typeof tabs)[number]["id"];

function restoreWorkshop() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    return { data: saved ? parseWorkshop(saved) : newWorkshop(), paused: false };
  } catch {
    return { data: newWorkshop(), paused: true };
  }
}

function download(text: string, name: string, type: string) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = name;
  anchor.click();
  URL.revokeObjectURL(url);
}

export default function ModuleStrategyResearch() {
  const [initial] = useState(restoreWorkshop);
  const [workshop, setWorkshop] = useState<Workshop>(initial.data);
  const [paused, setPaused] = useState(initial.paused);
  const [saved, setSaved] = useState(false);
  const [tab, setTab] = useState<TabId>("brief");
  const [selected, setSelected] = useState("internal");
  const [resetTarget, setResetTarget] = useState<string | null>(null);
  const importRef = useRef<HTMLInputElement>(null);
  const { showToast } = useToast();
  const answered = dimensions.filter(
    ({ id }) => workshop.answers[id].value !== null && !workshop.answers[id].unresolved,
  ).length;
  useEffect(() => {
    if (paused) return;
    try {
      localStorage.setItem(STORAGE_KEY, serializeWorkshop(workshop));
      setSaved(true);
    } catch {
      setSaved(false);
    }
  }, [workshop, paused]);
  function go(next: TabId) {
    setTab(next);
    window.scrollTo({ top: 0, behavior: "instant" });
  }
  async function importWorkshop(file: File | undefined) {
    if (!file) return;
    try {
      const restored = parseWorkshop(await file.text());
      setWorkshop(restored);
      setPaused(false);
      go("brief");
      showToast({
        title: "Workshop imported",
        message: "Answers and all seven edited profiles have been restored.",
        tone: "success",
      });
    } catch (error) {
      showToast({
        title: "Could not import this workshop",
        message: error instanceof Error ? error.message : "Choose a workshop JSON export.",
        tone: "error",
      });
    } finally {
      if (importRef.current) importRef.current.value = "";
    }
  }
  function resetConfirmed() {
    if (resetTarget === "workshop") {
      setWorkshop(newWorkshop());
      setPaused(false);
      go("brief");
    } else {
      const source = initialApproaches.find((approach) => approach.id === resetTarget);
      if (source)
        setWorkshop({
          ...workshop,
          approaches: workshop.approaches.map((approach) =>
            approach.id === resetTarget ? structuredClone(source) : approach,
          ),
        });
    }
    setResetTarget(null);
  }
  return (
    <div className="min-h-screen bg-[#f7f8fa] font-sans text-zinc-800 selection:bg-violet-200">
      <header className="border-b border-zinc-200 bg-white">
        <div className="mx-auto flex max-w-[1480px] flex-wrap items-center justify-between gap-4 px-5 py-5 md:px-9">
          <Link to="/demo/research" className="flex items-center gap-3 text-base font-semibold">
            <BrandMark size={29} />
            Edge Studio
            <span className="hidden border-l border-zinc-200 pl-3 text-sm font-normal text-zinc-400 sm:block">
              Strategy lab
            </span>
          </Link>
          <div className="flex flex-wrap items-center gap-4 text-[11px]">
            <span className="inline-flex items-center gap-1.5 text-zinc-400">
              <span
                className={cx(
                  "size-1.5 rounded-full",
                  saved && !paused ? "bg-emerald-500" : "bg-amber-500",
                )}
              />
              {paused
                ? "Autosave paused"
                : saved
                  ? "Saved in this browser"
                  : "In memory · export to keep"}
            </span>
            <Link to="/demo/modules" className="inline-flex items-center gap-1 text-violet-600">
              Module concept <ArrowUpRight size={12} />
            </Link>
          </div>
        </div>
      </header>
      <div className="mx-auto max-w-[1480px] px-5 py-7 md:px-9">
        <div className="mb-7 flex flex-wrap items-start justify-between gap-5">
          <div>
            <p className="flex items-center gap-1.5 text-[10px] font-semibold tracking-[0.17em] text-violet-500 uppercase">
              <FlaskConical size={13} />
              Local research workshop
            </p>
            <p className="mt-2 text-xl font-semibold tracking-tight">
              {workshop.name || "Module strategy workshop"}
            </p>
            <p className="mt-1 text-xs text-zinc-400">
              Long-term vision · One shared team profile · {answered}/8 agreed priorities
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <input
              ref={importRef}
              type="file"
              accept=".json,application/json"
              aria-label="Import workshop JSON"
              className="hidden"
              onChange={(event) => void importWorkshop(event.target.files?.[0])}
            />
            <Button
              variant="ghost"
              size="sm"
              iconStart={<Upload />}
              onClick={() => importRef.current?.click()}
            >
              Import
            </Button>
            <Button
              variant="ghost"
              size="sm"
              iconStart={<Download />}
              onClick={() =>
                download(
                  serializeWorkshop(workshop),
                  "module-strategy-workshop.json",
                  "application/json",
                )
              }
            >
              Export session
            </Button>
            <Button
              size="sm"
              iconStart={<Download />}
              onClick={() =>
                download(workshopReport(workshop), "module-strategy-report.md", "text/markdown")
              }
            >
              Export report
            </Button>
            <button
              aria-label="Reset workshop"
              onClick={() => setResetTarget("workshop")}
              className="inline-flex size-8 cursor-pointer items-center justify-center rounded-lg border border-zinc-200 bg-white text-zinc-400 hover:text-rose-600"
            >
              <RotateCcw size={13} />
            </button>
          </div>
        </div>
        {paused && (
          <div
            role="alert"
            className="mb-6 flex flex-wrap items-center justify-between gap-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs leading-relaxed text-amber-900"
          >
            <p>
              The saved draft could not be read. Autosave is paused to avoid replacing it. Import a
              valid export, or explicitly start a new workshop.
            </p>
            <Button size="sm" variant="ghost" onClick={() => setResetTarget("workshop")}>
              Start a new workshop
            </Button>
          </div>
        )}
        <nav
          aria-label="Workshop sections"
          className="mb-7 flex flex-wrap items-center gap-1 rounded-xl border border-zinc-200 bg-white p-1.5"
        >
          {tabs.map((item) => (
            <button
              key={item.id}
              onClick={() => go(item.id)}
              aria-current={tab === item.id ? "page" : undefined}
              className={cx(
                "inline-flex cursor-pointer items-center gap-2 rounded-lg px-4 py-3 text-xs transition",
                tab === item.id
                  ? "bg-violet-50 font-semibold text-violet-700"
                  : "text-zinc-400 hover:bg-zinc-50 hover:text-zinc-700",
              )}
            >
              <item.icon size={15} />
              {item.label}
              {item.id === "survey" && answered === 8 && (
                <Check size={12} className="text-emerald-500" />
              )}
            </button>
          ))}
          <span className="ml-auto hidden pr-4 text-[10px] text-zinc-400 lg:block">
            Preferences ≠ constraints ≠ responsibilities
          </span>
        </nav>
        {tab === "brief" && (
          <WorkshopBrief workshop={workshop} onChange={setWorkshop} onStart={() => go("survey")} />
        )}
        {tab === "survey" && (
          <TeamSurvey workshop={workshop} onChange={setWorkshop} onCompare={() => go("compare")} />
        )}
        {tab === "compare" && (
          <ApproachComparison
            workshop={workshop}
            onSurvey={() => go("survey")}
            onEdit={(id) => {
              setSelected(id);
              go("assumptions");
            }}
          />
        )}
        {tab === "assumptions" && (
          <ApproachAssumptions
            workshop={workshop}
            onChange={setWorkshop}
            selected={selected}
            onSelect={setSelected}
            onReset={setResetTarget}
          />
        )}
        <footer className="mt-12 flex flex-wrap items-center justify-between gap-4 border-t border-zinc-200 py-6 text-[10px] leading-relaxed text-zinc-400">
          <span>Research prototype · No votes, files, or answers are sent to a server.</span>
          <span>
            Export before changing browser/device. Private browsing or clearing site data can remove
            the saved draft.
          </span>
        </footer>
      </div>
      {resetTarget && (
        <Modal
          title={
            resetTarget === "workshop" ? "Start a new workshop?" : "Restore this approach profile?"
          }
          description={
            resetTarget === "workshop"
              ? "This replaces this browser's saved answers and edited assumptions. Export your session first if you want to keep it."
              : "Only this path's assumptions will return to the supplied draft. Team answers and other paths are preserved."
          }
          onClose={() => setResetTarget(null)}
          footer={
            <>
              <Button variant="ghost" onClick={() => setResetTarget(null)}>
                Cancel
              </Button>
              <Button variant="danger" onClick={resetConfirmed}>
                {resetTarget === "workshop" ? "Reset all workshop data" : "Restore draft profile"}
              </Button>
            </>
          }
        />
      )}
    </div>
  );
}
