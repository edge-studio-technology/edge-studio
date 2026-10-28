import { useState } from "react";
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  BadgeCheck,
  BookOpen,
  Boxes,
  Check,
  ChevronDown,
  Code2,
  Download,
  ExternalLink,
  FileText,
  Globe2,
  Layers3,
  Search,
  ShieldAlert,
  Sparkles,
  Sprout,
  Terminal,
  Workflow,
} from "lucide-react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { BrandMark } from "../../components/BrandMark";
import { Button } from "../../components/ui/Button";
import { Modal } from "../../components/ui/Modal";
import { cx } from "../../lib/cx";
import { categories, type DemoModule } from "./demoData";
import { CatalogCard, DemoBadge, ModuleGlyph, Publisher, SectionLabel } from "./DemoUi";
import { useDemo } from "./demoState";
import { ModuleRating, RateModule } from "./ModuleRatings";
import { averageRating } from "./moduleRatingMath";
import { ReleaseInspection } from "./ReleaseInspection";
import { downloadDemoFile } from "./demoPackaging";

function LibraryChrome({ children }: { children: React.ReactNode }) {
  const [params, setParams] = useSearchParams();
  const showGuide = params.get("view") === "guide";
  return (
    <div className="min-h-screen bg-[#fafaf9]">
      <header className="border-b border-zinc-200/80 bg-white">
        <div className="mx-auto flex max-w-[1320px] flex-wrap items-center justify-between gap-4 px-6 py-5 lg:px-10">
          <Link
            to="/demo/library"
            className="flex items-center gap-2 text-lg font-semibold tracking-tight"
          >
            <BrandMark size={30} />
            Edge Studio
            <span className="ml-1 border-l border-zinc-200 pl-3 text-sm font-normal text-zinc-400">
              Library
            </span>
          </Link>
          <nav
            aria-label="Library navigation"
            className="order-3 flex w-full gap-6 text-xs text-zinc-500 sm:order-none sm:w-auto"
          >
            <Link to="/demo/library" className="font-semibold text-violet-700">
              Discover
            </Link>
            <Link to="/demo/library#collections" className="hover:text-violet-600">
              Collections
            </Link>
            <button
              className="cursor-pointer hover:text-violet-600"
              onClick={() => setParams({ view: "guide" })}
            >
              For developers
            </button>
          </nav>
          <Link
            to="/demo/modules"
            className="inline-flex items-center gap-2 rounded-lg bg-zinc-900 px-4 py-2.5 text-xs font-semibold text-white transition hover:bg-violet-700"
          >
            Open Edge Studio <ArrowUpRight size={14} />
          </Link>
        </div>
      </header>
      <div className="border-b border-violet-100 bg-violet-50 px-6 py-3 text-center text-xs leading-relaxed text-violet-800">
        Phase 2 · Hosted library concept: discovery, publishing, ratings, and paid official
        distribution. Phase 1's local builder works without this service.
      </div>
      {children}
      <footer className="mt-16 border-t border-zinc-200 px-6 py-10">
        <div className="mx-auto flex max-w-[1240px] flex-wrap items-center justify-between gap-6">
          <div>
            <Link to="/demo/library" className="flex items-center gap-2 text-sm font-semibold">
              <BrandMark size={22} />A little more possibility.
            </Link>
            <p className="mt-2 text-xs text-zinc-400">
              Built for your edge. Made by people like you.
            </p>
          </div>
          <div className="flex gap-6 text-xs text-zinc-500">
            <button
              className="cursor-pointer hover:text-violet-700"
              onClick={() => setParams({ view: "guide" })}
            >
              Developer guide
            </button>
            <Link to="/demo/modules">Your workspace</Link>
            <span className="text-zinc-400">Concept library · Sample content</span>
          </div>
        </div>
      </footer>
      {showGuide && (
        <Modal
          title="Small ideas belong here."
          description="A preview of the developer experience."
          onClose={() => setParams({})}
          footer={<Button onClick={() => setParams({})}>Got it</Button>}
        >
          <div className="space-y-5 p-6">
            {[
              {
                icon: Code2,
                title: "Start with a template",
                text: "Choose a template. Generate code in your own AI harness with our planned module-builder-skill, then edit it in the app. No CLI actions.",
              },
              {
                icon: Terminal,
                title: "Try it on your edge",
                text: "Preview schema-defined forms and wizard steps. Test, validate, package, and activate locally in Phase 1; export your device and logs before installation or updates.",
              },
              {
                icon: Globe2,
                title: "Share when you're ready",
                text: "Export/import locally in Phase 1. Phase 2 adds publishing and reputation. Automated checks precede publication; initial human spam/content moderation follows it.",
              },
            ].map((item) => (
              <div key={item.title} className="flex gap-4">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-violet-50 text-violet-600">
                  <item.icon size={20} />
                </span>
                <div>
                  <h3 className="text-sm font-semibold">{item.title}</h3>
                  <p className="mt-1 text-sm leading-relaxed text-zinc-500">{item.text}</p>
                </div>
              </div>
            ))}
            <Link
              to="/demo/modules"
              className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-violet-600"
            >
              Open Module Builder <ArrowRight size={16} />
            </Link>
          </div>
        </Modal>
      )}
    </div>
  );
}

function HeroDiagram() {
  return (
    <div
      aria-hidden
      className="relative mx-auto flex min-h-64 w-full max-w-sm items-center justify-center"
    >
      <div className="absolute inset-0 rounded-full border border-violet-400/10" />
      <div className="absolute inset-8 rounded-full border border-violet-400/15" />
      <div className="absolute top-1/2 h-px w-full bg-violet-400/20" />
      <div className="absolute left-1/2 h-full w-px bg-violet-400/20" />
      <div className="relative z-10 flex size-24 rotate-[-8deg] items-center justify-center rounded-3xl border border-violet-300/30 bg-[#3a2c59] shadow-2xl shadow-black/30">
        <BrandMark variant="white" size={50} />
      </div>
      <div className="absolute top-2 left-10 flex items-center gap-2 rounded-xl border border-white/15 bg-[#292335] px-3 py-3 text-xs shadow-xl">
        <span className="rounded-lg bg-emerald-400/15 p-2 text-emerald-300">
          <Sprout size={19} />
        </span>
        Grow something
      </div>
      <div className="absolute top-14 -right-3 flex size-14 rotate-12 items-center justify-center rounded-xl border border-white/15 bg-[#292335] text-amber-200 shadow-xl">
        <Code2 size={25} />
      </div>
      <div className="absolute bottom-1 left-5 flex size-14 -rotate-12 items-center justify-center rounded-xl border border-white/15 bg-[#292335] text-sky-200 shadow-xl">
        <Globe2 size={25} />
      </div>
      <div className="absolute right-0 bottom-4 flex items-center gap-2 rounded-xl border border-white/15 bg-[#292335] px-3 py-3 text-xs shadow-xl">
        <span className="rounded-lg bg-violet-400/15 p-2 text-violet-200">
          <Workflow size={19} />
        </span>
        Make it happen
      </div>
      <span className="absolute top-4 right-12 size-2 rounded-full bg-violet-300" />
      <span className="absolute bottom-7 left-28 size-1.5 rounded-full bg-emerald-300" />
    </div>
  );
}

export function ModuleLibrary() {
  const { modules } = useDemo();
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("All modules");
  const [official, setOfficial] = useState(false);
  const [sort, setSort] = useState("Featured");
  const publicModules = modules.filter((module) => !module.localOnly);
  const filtered = publicModules.filter(
    (item) =>
      (category === "All modules" || item.category === category) &&
      (!official || item.official) &&
      `${item.name} ${item.author} ${item.summary}`.toLowerCase().includes(search.toLowerCase()),
  );
  const visible =
    sort === "Top rated"
      ? [...filtered].sort(
          (a, b) =>
            (averageRating(b) ?? -1) - (averageRating(a) ?? -1) || b.ratingCount - a.ratingCount,
        )
      : sort === "Most downloaded"
        ? [...filtered].sort((a, b) => b.downloads - a.downloads)
        : sort === "Name"
          ? [...filtered].sort((a, b) => a.name.localeCompare(b.name))
          : filtered;
  return (
    <LibraryChrome>
      <div className="mx-auto max-w-[1320px] px-6 pt-8 lg:px-10">
        <section className="relative overflow-hidden rounded-3xl bg-[#1d1928] px-7 py-10 text-white md:px-12 lg:grid lg:grid-cols-[1.2fr_1fr] lg:items-center lg:gap-14 lg:py-12">
          <div className="relative z-10">
            <div className="mb-5 flex items-center gap-2 text-[10px] font-semibold tracking-[0.15em] text-violet-300">
              <span className="size-1.5 rounded-full bg-violet-300" />
              OPEN IDEAS. LOCAL POSSIBILITIES.
            </div>
            <h1 className="text-[42px] leading-[1.06] font-semibold tracking-[-0.055em] sm:text-6xl">
              Make your edge
              <br />a little more <span className="text-violet-300">yours.</span>
            </h1>
            <p className="mt-6 max-w-md text-sm leading-7 text-zinc-400">
              New devices. Useful blocks. Unexpected possibilities.
              <br />
              Find your next idea in the Edge Studio module library.
            </p>
            <a
              href="#discover"
              className="mt-7 inline-flex items-center gap-2 rounded-lg bg-white px-5 py-3 text-xs font-semibold text-zinc-900 hover:bg-violet-100"
            >
              Find your next module <ArrowDown size={14} />
            </a>
            <p className="mt-5 text-[10px] text-zinc-500">
              Community-built. Yours to explore, adapt, and run locally.
            </p>
          </div>
          <div className="mt-10 lg:mt-0">
            <HeroDiagram />
          </div>
        </section>
        <section id="collections" className="scroll-mt-6 pt-9">
          <div className="mb-4 flex items-center justify-between">
            <SectionLabel>A GOOD PLACE TO START</SectionLabel>
            <span className="text-[11px] text-zinc-400">Curated collections</span>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            {[
              {
                title: "Meet your hardware",
                subtitle: "Sensors, cameras, and the real world",
                icon: Layers3,
                filter: "Hardware",
                color: "bg-emerald-50 text-emerald-700",
              },
              {
                title: "Build a better workflow",
                subtitle: "A few blocks. A lot of possibilities.",
                icon: Workflow,
                filter: "Workflow",
                color: "bg-violet-50 text-violet-700",
              },
              {
                title: "Connect the dots",
                subtitle: "Bring your tools and services together",
                icon: Globe2,
                filter: "Integrations",
                color: "bg-orange-50 text-orange-700",
              },
            ].map((item) => (
              <a
                key={item.title}
                href="#discover"
                onClick={() => setCategory(item.filter)}
                className="group flex items-center gap-4 rounded-xl border border-zinc-200 bg-white p-4 transition hover:border-violet-300"
              >
                <span
                  className={cx(
                    "flex size-10 shrink-0 items-center justify-center rounded-xl",
                    item.color,
                  )}
                >
                  <item.icon size={20} />
                </span>
                <span>
                  <strong className="block text-sm font-semibold">{item.title}</strong>
                  <span className="mt-1 block text-[11px] text-zinc-400">{item.subtitle}</span>
                </span>
                <ArrowUpRight
                  size={15}
                  className="ml-auto shrink-0 text-zinc-300 group-hover:text-violet-600"
                />
              </a>
            ))}
          </div>
        </section>
        <section id="discover" className="scroll-mt-6 pt-12">
          <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="text-2xl font-semibold tracking-tight">
                Find a little more possibility.
              </h2>
              <p className="mt-2 text-xs text-zinc-400">
                Official essentials and good ideas from the community.
              </p>
            </div>
            <label className="flex h-11 w-full items-center gap-2 rounded-xl border border-zinc-200 bg-white px-4 sm:w-80">
              <Search size={16} className="text-zinc-400" />
              <input
                aria-label="Search library"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search modules, devices, or ideas…"
                className="min-w-0 flex-1 border-none bg-transparent text-xs outline-none"
              />
              <span className="rounded border border-zinc-100 px-1.5 py-0.5 text-[10px] text-zinc-300">
                /
              </span>
            </label>
          </div>
          <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
            <div className="flex flex-wrap gap-1 rounded-lg bg-zinc-100 p-1">
              {["All modules", ...categories].map((item) => (
                <button
                  key={item}
                  onClick={() => setCategory(item)}
                  className={cx(
                    "cursor-pointer rounded-md px-3 py-2 text-xs transition",
                    category === item
                      ? "bg-white font-semibold text-zinc-900 shadow-sm"
                      : "text-zinc-500 hover:text-violet-600",
                  )}
                >
                  {item}
                </button>
              ))}
            </div>
            <label className="relative">
              <select
                aria-label="Sort modules"
                value={sort}
                onChange={(event) => setSort(event.target.value)}
                className="appearance-none bg-transparent py-2 pr-5 text-xs text-zinc-500"
              >
                <option>Featured</option>
                <option>Top rated</option>
                <option>Most downloaded</option>
                <option>Name</option>
              </select>
              <ChevronDown size={12} className="pointer-events-none absolute top-3 right-0" />
            </label>
          </div>
          <div className="grid items-start gap-6 md:grid-cols-[165px_1fr]">
            <aside className="flex flex-wrap gap-x-5 gap-y-4 py-2 md:block">
              <SectionLabel>PUBLISHERS</SectionLabel>
              <label className="mt-4 flex cursor-pointer items-center gap-2 text-xs text-zinc-600">
                <input
                  type="checkbox"
                  checked={official}
                  onChange={(event) => setOfficial(event.target.checked)}
                  className="accent-violet-600"
                />
                Official modules
                <BadgeCheck size={13} className="text-violet-500" />
              </label>
              <p className="mt-3 max-w-40 text-[11px] leading-relaxed text-zinc-400">
                Find modules maintained by the Edge Studio team.
              </p>
              <div className="mt-8 hidden rounded-xl border border-violet-100 bg-violet-50/50 p-4 md:block">
                <Code2 size={20} className="text-violet-600" />
                <p className="mt-3 text-xs font-semibold">Have an idea?</p>
                <p className="mt-2 text-[11px] leading-relaxed text-zinc-500">
                  The next useful module could be yours.
                </p>
                <Link
                  to="/demo/modules"
                  className="mt-4 inline-flex items-center gap-1 text-[11px] font-semibold text-violet-600"
                >
                  Start building <ArrowRight size={12} />
                </Link>
              </div>
            </aside>
            <div>
              <div className="mb-4 flex items-center justify-between text-[11px] text-zinc-400">
                <span>{visible.length} modules to explore</span>
                <span>Sample catalog</span>
              </div>
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {visible.map((module) => (
                  <CatalogCard key={module.id} module={module} />
                ))}
              </div>
              {!visible.length && (
                <div className="rounded-2xl border border-dashed border-zinc-200 p-14 text-center">
                  <Search className="mx-auto text-zinc-300" />
                  <h3 className="mt-4 font-semibold">No modules found</h3>
                  <p className="mt-2 text-sm text-zinc-400">Try a different search or category.</p>
                  <button
                    onClick={() => {
                      setSearch("");
                      setCategory("All modules");
                      setOfficial(false);
                    }}
                    className="mt-4 cursor-pointer text-sm text-violet-600"
                  >
                    Clear filters
                  </button>
                </div>
              )}
            </div>
          </div>
        </section>
        <div className="mt-12 flex flex-wrap items-center justify-between gap-6 rounded-2xl bg-[#eeebf6] px-7 py-8 md:px-9">
          <div className="flex items-center gap-5">
            <span className="hidden size-14 items-center justify-center rounded-2xl bg-white text-violet-600 sm:flex">
              <Sparkles size={28} />
            </span>
            <div>
              <h2 className="text-xl font-semibold tracking-tight">
                Built something useful? Let it travel.
              </h2>
              <p className="mt-2 text-xs text-zinc-500">
                Your small solution could be someone's next big idea.
              </p>
            </div>
          </div>
          <Link
            to="/demo/modules"
            className="inline-flex items-center gap-2 rounded-lg bg-zinc-900 px-5 py-3 text-xs font-semibold text-white"
          >
            Create a module <ArrowUpRight size={14} />
          </Link>
        </div>
      </div>
    </LibraryChrome>
  );
}

export function ModuleDetails({ onInstall }: { onInstall: (module: DemoModule) => void }) {
  const navigate = useNavigate();
  const { moduleId } = useParams();
  const { modules, purchase } = useDemo();
  const module = modules.find((item) => item.id === moduleId && !item.localOnly);
  const [tab, setTab] = useState("Overview");
  const [purchaseOpen, setPurchaseOpen] = useState(false);
  if (!module)
    return (
      <LibraryChrome>
        <div className="mx-auto max-w-3xl px-6 py-24 text-center">
          <Boxes className="mx-auto text-violet-500" size={40} />
          <h1 className="mt-6 text-3xl font-semibold">This module is staying local.</h1>
          <p className="mt-3 text-zinc-500">Explore other modules in the community library.</p>
          <Link to="/demo/library" className="mt-6 inline-flex text-violet-600">
            Back to the library
          </Link>
        </div>
      </LibraryChrome>
    );
  return (
    <LibraryChrome>
      <div className="mx-auto max-w-[1180px] px-6 pt-8 lg:px-10">
        <Link
          to="/demo/library#discover"
          className="inline-flex items-center gap-2 text-xs text-zinc-400 hover:text-violet-600"
        >
          <ArrowLeft size={13} />
          Back to discovery
        </Link>
        <div className="mt-9 flex flex-wrap items-start justify-between gap-6">
          <div className="flex flex-wrap items-center gap-5">
            <ModuleGlyph icon={module.icon} color={module.color} large />
            <div>
              <div className="mb-2 flex items-center gap-2">
                <DemoBadge>{module.category}</DemoBadge>
                {module.official && (
                  <DemoBadge tone="purple">
                    <BadgeCheck size={11} />
                    Official module
                  </DemoBadge>
                )}
              </div>
              <h1 className="text-3xl font-semibold tracking-[-0.035em] md:text-4xl">
                {module.name}
              </h1>
              <p className="mt-2 text-sm text-zinc-500">{module.summary}</p>
              <div className="mt-3">
                <Publisher module={module} />
              </div>
            </div>
          </div>
          <div className="flex flex-col gap-2 pt-2">
            <Button
              variant="accent"
              onClick={() =>
                module.installed
                  ? navigate("/demo/modules")
                  : module.commercial && !module.entitled
                    ? setPurchaseOpen(true)
                    : onInstall(module)
              }
              iconStart={module.installed ? <Check /> : <Download />}
            >
              {module.installed
                ? "View in workspace"
                : module.commercial && !module.entitled
                  ? "Preview purchase"
                  : "Add to Edge Studio"}
            </Button>
            <span className="text-center text-[10px] text-zinc-400">
              {module.commercial
                ? "Paid module concept · Source inspectable before purchase"
                : "Free sample · Inspectable source · Runs on your edge"}
            </span>
          </div>
        </div>
        <div className="mt-8 flex flex-wrap gap-6 border-b border-zinc-200 pb-6 text-xs text-zinc-500">
          <span className="flex items-center gap-1.5">
            <Download size={14} />
            {module.downloads.toLocaleString("en-US")} downloads
          </span>
          <ModuleRating module={module} />
          <RateModule module={module} />
          <span>v{module.version}</span>
          <span>Sample license metadata · Policy open (D8)</span>
          <span className="ml-auto text-zinc-400">Sample community listing</span>
        </div>
        <p className="mt-3 text-[11px] leading-relaxed text-zinc-400">
          Community ratings and downloads indicate popularity and experience, not verified code
          safety. Review the builder and requested access before installing.
        </p>
        {module.moderationPending && (
          <p className="mt-3 rounded-xl bg-amber-50 p-4 text-xs leading-relaxed text-amber-900">
            Published · Post-publication spam/content moderation pending (demo). Basic structure
            checks are not a code-safety review. Community management is the long-term goal.
          </p>
        )}
        {module.commercial && (
          <section className="mt-5 rounded-xl border border-violet-200 bg-violet-50 p-5 text-xs leading-relaxed text-violet-900">
            <h2 className="font-semibold">Phase 2 · Paid official distribution</h2>
            <p className="mt-2">
              Inspect source before buying. A purchase grants access to the official release; the
              installed version can work offline. No strong copy protection or restrictive
              redistribution policy is promised. Commerce is included in Phase 2. Provider, pricing,
              subscriptions, and update terms remain to be defined.
            </p>
            {module.entitled && (
              <>
                <p className="mt-3 font-semibold">
                  Sample purchase entitlement recorded · No payment made
                </p>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() =>
                    downloadDemoFile(`${module.id}.receipt.demo.json`, {
                      demo: true,
                      module: module.id,
                      version: module.version,
                      entitlement: "Sample only",
                      signed: false,
                      notice:
                        "Not a real purchase receipt or verified signature. Offline entitlement verification is planned.",
                    })
                  }
                >
                  Export sample receipt
                </Button>
              </>
            )}
          </section>
        )}
        <div className="mt-8 grid items-start gap-10 lg:grid-cols-[1fr_280px]">
          <div className="min-w-0">
            <div className="mb-7 flex flex-wrap gap-5 border-b border-zinc-200">
              {["Overview", "Setup", "Versions", "Source", "Access"].map((item) => (
                <button
                  key={item}
                  onClick={() => setTab(item)}
                  className={cx(
                    "cursor-pointer border-b-2 pb-4 text-sm",
                    tab === item
                      ? "border-violet-600 font-semibold text-violet-600"
                      : "border-transparent text-zinc-400",
                  )}
                >
                  {item}
                </button>
              ))}
            </div>
            {tab === "Source" && (
              <ReleaseInspection key={`${module.id}-${module.version}`} module={module} />
            )}
            {tab === "Overview" && (
              <div className="space-y-7">
                <div>
                  <h2 className="text-xl font-semibold tracking-tight">
                    A little more you can do.
                  </h2>
                  <p className="mt-4 text-sm leading-7 text-zinc-500">{module.description}</p>
                </div>
                <div className="relative overflow-hidden rounded-2xl border border-zinc-200 bg-white p-7">
                  <div className="absolute top-0 right-0 h-32 w-32 rounded-bl-full bg-violet-50" />
                  <SectionLabel>FROM YOUR DEVICE TO YOUR NEXT IDEA</SectionLabel>
                  <div className="relative mt-7 flex flex-wrap items-center gap-3">
                    <span className="rounded-xl border border-zinc-200 bg-zinc-50 p-4">
                      <ModuleGlyph icon={module.icon} color={module.color} />
                    </span>
                    <ArrowRight size={18} className="text-zinc-300" />
                    <span className="rounded-xl border border-violet-200 bg-violet-50 px-5 py-4">
                      <span className="flex items-center gap-2 text-sm font-semibold text-violet-700">
                        <Workflow size={17} />
                        Your workflow
                      </span>
                      <span className="mt-1 block text-[11px] text-violet-400">
                        Connect the possibilities
                      </span>
                    </span>
                    <ArrowRight size={18} className="text-zinc-300" />
                    <span className="rounded-xl border border-zinc-200 px-5 py-4 text-sm">
                      <Check size={18} className="mb-2 text-emerald-500" />
                      Something useful.
                    </span>
                  </div>
                  <p className="mt-6 text-xs leading-relaxed text-zinc-400">
                    Illustrative preview · Add the module, configure your device, and connect its
                    blocks.
                  </p>
                </div>
                <div>
                  <h3 className="font-semibold">Everything you need to get started</h3>
                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    {[...module.contributions, "Guided setup & examples"].map((item) => (
                      <div
                        key={item}
                        className="flex items-center gap-2 rounded-lg border border-zinc-200 bg-white p-4 text-xs text-zinc-600"
                      >
                        <Check size={15} className="text-violet-500" />
                        {item}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
            {tab === "Setup" && (
              <div className="space-y-6">
                <h2 className="text-xl font-semibold">From installed to inspired.</h2>
                {[
                  "Add this module to your Edge Studio workspace.",
                  "Open Devices and choose its setup guide.",
                  "Configure your device and try a sample reading.",
                  "Add its blocks to a workflow and make it your own.",
                ].map((item, index) => (
                  <div key={item} className="flex items-center gap-4">
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-violet-50 text-sm font-semibold text-violet-600">
                      {index + 1}
                    </span>
                    <p className="text-sm text-zinc-500">{item}</p>
                  </div>
                ))}
                <p className="rounded-xl border border-zinc-200 bg-white p-4 text-xs leading-relaxed text-zinc-400">
                  This guide illustrates the planned experience. Device setup and workflow blocks
                  are not installed by the demo.
                </p>
              </div>
            )}
            {tab === "Versions" && (
              <div>
                <h2 className="text-xl font-semibold">A module that keeps growing.</h2>
                {[module.version].map((version, index) => (
                  <div
                    key={`${version}-${index}`}
                    className="mt-6 rounded-xl border border-zinc-200 bg-white p-5"
                  >
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-sm">v{version}</span>
                      {index === 0 && <DemoBadge tone="green">Latest</DemoBadge>}
                    </div>
                    <p className="mt-3 text-sm text-zinc-500">
                      {index === 0
                        ? "Refined setup guides, improved block configuration, and more useful examples."
                        : "First community release, including core capability support and a getting started guide."}
                    </p>
                    <p className="mt-3 text-[10px] text-zinc-400">
                      Illustrative release notes · Edge Studio ≥ 0.42
                    </p>
                    <Button size="sm" variant="ghost" onClick={() => setTab("Source")}>
                      Inspect this release source
                    </Button>
                  </div>
                ))}
              </div>
            )}
            {tab === "Access" && (
              <div className="space-y-5">
                <h2 className="text-xl font-semibold">Know what you're inviting in.</h2>
                <div
                  className={cx(
                    "rounded-xl border p-5",
                    module.hostAccess
                      ? "border-amber-200 bg-amber-50"
                      : "border-emerald-200 bg-emerald-50",
                  )}
                >
                  <h3 className="flex items-center gap-2 font-semibold">
                    <ShieldAlert size={18} />
                    {module.hostAccess
                      ? "Full host access requested"
                      : "Application services requested"}
                  </h3>
                  <p className="mt-3 text-sm leading-relaxed text-zinc-600">
                    {module.hostAccess
                      ? "The planned module can run privileged code, install dependencies, manage services, and access attached hardware. This is trusted host software, not sandboxed code."
                      : "This sample module is designed around app services and workflow data. Its actual access would be declared and reviewed during installation."}
                  </p>
                </div>
                <p className="text-sm leading-relaxed text-zinc-500">
                  Publisher identity and declared access help you make an informed choice. They are
                  not a guarantee that a module is safe. Nothing is executed in this demo.
                </p>
              </div>
            )}
          </div>
          <aside className="space-y-5">
            <div className="rounded-2xl border border-zinc-200 bg-white p-5">
              <SectionLabel>AT A GLANCE</SectionLabel>
              <dl className="mt-5 space-y-4 text-xs">
                {[
                  ["Publisher", module.author],
                  ["Version", module.version],
                  ["Works with", "Edge Studio ≥ 0.42"],
                  ["Architecture", "Raspberry Pi · ARM64"],
                  ["License", "MIT"],
                  ["Published", "Sample release"],
                ].map(([label, value]) => (
                  <div key={label} className="flex justify-between gap-3">
                    <dt className="text-zinc-400">{label}</dt>
                    <dd className="text-right text-zinc-700">{value}</dd>
                  </div>
                ))}
              </dl>
            </div>
            <div className="rounded-2xl border border-zinc-200 bg-white p-5">
              <SectionLabel>MADE TO BE UNDERSTOOD</SectionLabel>
              <button
                onClick={() => setTab("Setup")}
                className="mt-4 flex w-full cursor-pointer items-center justify-between text-xs text-zinc-600"
              >
                <span className="flex items-center gap-2">
                  <BookOpen size={14} />
                  Getting started
                </span>
                <ArrowUpRight size={13} />
              </button>
              <button
                onClick={() => setTab("Versions")}
                className="mt-4 flex w-full cursor-pointer items-center justify-between text-xs text-zinc-600"
              >
                <span className="flex items-center gap-2">
                  <FileText size={14} />
                  Release notes
                </span>
                <ArrowUpRight size={13} />
              </button>
              <Link
                to="/demo/library?view=guide"
                className="mt-4 flex items-center justify-between text-xs text-zinc-600"
              >
                <span className="flex items-center gap-2">
                  <ExternalLink size={14} />
                  Developer guide
                </span>
                <ArrowUpRight size={13} />
              </Link>
            </div>
            {module.hostAccess && (
              <div className="rounded-xl bg-amber-50 p-4">
                <p className="flex items-center gap-2 text-xs font-semibold text-amber-900">
                  <ShieldAlert size={15} />
                  Host access
                </p>
                <p className="mt-2 text-[11px] leading-relaxed text-amber-800">
                  Review access and publisher details before adding modules to your edge.
                </p>
                <button
                  onClick={() => setTab("Access")}
                  className="mt-3 cursor-pointer text-[11px] font-semibold text-amber-900 underline underline-offset-2"
                >
                  View requested access
                </button>
              </div>
            )}
          </aside>
        </div>
      </div>
      {purchaseOpen && (
        <Modal
          title="Preview a paid module purchase"
          description="Phase 2 concept only · No checkout, payment provider, or money transfer."
          onClose={() => setPurchaseOpen(false)}
          footer={
            <>
              <Button variant="ghost" onClick={() => setPurchaseOpen(false)}>
                Cancel
              </Button>
              <Button
                variant="accent"
                onClick={() => {
                  purchase(module.id);
                  setPurchaseOpen(false);
                }}
              >
                Record demo purchase
              </Button>
            </>
          }
        >
          <div className="space-y-4 p-6 text-sm leading-relaxed text-zinc-600">
            <h3 className="font-semibold">
              {module.name} · v{module.version}
            </h3>
            <p>
              This example grants a sample entitlement to the official release. Inspect the Source
              tab freely before purchasing. Installed-version offline use is planned; receipts and
              payment verification here are simulated.
            </p>
            <p>
              Price, updates, subscriptions, and licensing terms remain undecided. A user-controlled
              host cannot guarantee prevention of copying or bypassed license checks.
            </p>
          </div>
        </Modal>
      )}
    </LibraryChrome>
  );
}
