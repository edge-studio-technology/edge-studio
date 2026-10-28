import { useState } from "react";
import {
  ArrowUpRight,
  Boxes,
  Check,
  ChevronRight,
  CircleHelp,
  ExternalLink,
  HardDrive,
  RotateCcw,
  ShieldAlert,
  Sparkles,
} from "lucide-react";
import { Link, Navigate, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import { nav } from "../../app/nav";
import { BrandMark } from "../../components/BrandMark";
import { Button } from "../../components/ui/Button";
import { Modal } from "../../components/ui/Modal";
import { cx } from "../../lib/cx";
import { DemoProvider, useDemo } from "./demoState";
import type { DemoModule } from "./demoData";
import { DemoBadge, ModuleGlyph } from "./DemoUi";
import { ModuleManager } from "./ModuleManager";
import { ModuleEditor } from "./ModuleEditor";
import { ModuleLibrary, ModuleDetails } from "./ModuleLibrary";
import { BackupChecklist } from "./BackupChecklist";

function PreviewBar() {
  const { pathname } = useLocation();
  const { reset } = useDemo();
  const navigate = useNavigate();
  return (
    <div className="flex min-h-9 flex-wrap items-center justify-center gap-x-3 gap-y-1 border-b border-violet-200/70 bg-violet-50 px-4 py-2 text-[11px] text-violet-800">
      <Sparkles size={13} />
      <span className="font-semibold">Vision preview</span>
      <span className="text-violet-500">Sample content. Interactions stay in this demo.</span>
      <Link
        to="/demo/modules"
        className={pathname.startsWith("/demo/modules") ? "font-semibold underline" : "underline"}
      >
        Phase 1 · Local builder
      </Link>
      <Link
        to="/demo/library"
        className={pathname.startsWith("/demo/library") ? "font-semibold underline" : "underline"}
      >
        Phase 2 · Hosted library
      </Link>
      <button
        type="button"
        onClick={() => {
          reset();
          navigate("/demo/modules");
        }}
        className="ml-2 inline-flex cursor-pointer items-center gap-1 border-l border-violet-200 pl-4 underline-offset-2 hover:underline"
      >
        <RotateCcw size={11} /> Reset demo
      </button>
    </div>
  );
}

function BuilderShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-[calc(100vh-37px)] bg-[#f8f9fb]">
      <aside className="sticky top-0 hidden h-[calc(100vh-37px)] w-56 shrink-0 flex-col border-r border-zinc-200 bg-white px-4 py-7 lg:flex">
        <Link
          to="/demo/modules"
          className="mb-10 flex items-center gap-2.5 px-3 text-lg font-semibold tracking-tight text-zinc-900"
        >
          <BrandMark size={28} />
          Edge Studio
        </Link>
        <div className="mb-6 flex items-center gap-2 rounded-xl border border-zinc-200 px-3 py-3 text-xs">
          <span className="inline-flex size-7 items-center justify-center rounded-md bg-zinc-100">
            <HardDrive size={15} />
          </span>
          <span>
            <strong className="block font-semibold">My edge workspace</strong>
            <span className="text-zinc-400">studio-pi.local</span>
          </span>
          <span className="ml-auto size-1.5 rounded-full bg-emerald-500" />
        </div>
        <nav aria-label="Application navigation" className="flex flex-col gap-1">
          {nav
            .filter((item) => item.id !== "marketplace")
            .map((item) => {
              const active = item.id === "demo/modules";
              return (
                <Link
                  key={item.id}
                  to={`/${item.id}`}
                  className={cx(
                    "flex items-center gap-2 rounded-lg px-3 py-2.5 text-[13px] transition",
                    active
                      ? "bg-violet-50 font-semibold text-violet-700"
                      : "text-zinc-500 hover:bg-zinc-50 hover:text-zinc-900",
                  )}
                >
                  <item.icon size={17} strokeWidth={1.6} className="shrink-0" />
                  <span className="whitespace-nowrap">{item.label}</span>
                  {active && (
                    <span className="ml-auto rounded bg-white px-1.5 py-0.5 text-[9px] text-violet-500">
                      DEMO
                    </span>
                  )}
                </Link>
              );
            })}
        </nav>
        <div className="mt-auto space-y-4 pt-8">
          <Link
            to="/demo/library"
            className="flex items-center gap-2 px-3 text-xs text-zinc-500 hover:text-violet-600"
          >
            <ExternalLink size={15} />
            Explore the library
            <ArrowUpRight size={12} className="ml-auto" />
          </Link>
          <div className="flex items-center gap-2 border-t border-zinc-100 px-3 pt-5">
            <span className="flex size-8 items-center justify-center rounded-full bg-orange-100 text-xs font-semibold text-orange-800">
              AM
            </span>
            <span className="text-xs">
              <strong className="block font-semibold text-zinc-800">Alex Morgan</strong>
              <span className="text-zinc-400">Local administrator</span>
            </span>
          </div>
        </div>
      </aside>
      <div className="min-w-0 flex-1">
        <header className="flex h-16 items-center justify-between border-b border-zinc-200/70 bg-white px-5 text-xs text-zinc-400 md:px-9">
          <div className="flex items-center gap-2">
            <Boxes size={15} />
            <Link to="/demo/modules" className="hover:text-zinc-800">
              Workspace
            </Link>
            <ChevronRight size={12} />
            <span className="text-zinc-700">Module builder</span>
          </div>
          <Link
            to="/demo/research"
            className="hidden items-center gap-1 text-violet-600 md:inline-flex"
          >
            Strategy workshop <ArrowUpRight size={12} />
          </Link>
          <Link
            to="/demo/library"
            className="inline-flex items-center gap-2 text-zinc-600 hover:text-violet-600"
          >
            Public library
            <ArrowUpRight size={14} />
          </Link>
        </header>
        {children}
      </div>
    </div>
  );
}

function DemoContent() {
  const { pathname } = useLocation();
  const { install } = useDemo();
  const [target, setTarget] = useState<DemoModule | null>(null);
  const [acknowledged, setAcknowledged] = useState(false);
  const [complete, setComplete] = useState(false);
  const isLibrary = pathname.startsWith("/demo/library");
  function requestInstall(module: DemoModule) {
    setTarget(module);
    setAcknowledged(false);
    setComplete(false);
  }
  const routes = (
    <Routes>
      <Route path="/demo/modules" element={<ModuleManager />} />
      <Route path="/demo/modules/editor/:draftId" element={<ModuleEditor />} />
      <Route path="/demo/library" element={<ModuleLibrary />} />
      <Route
        path="/demo/library/:moduleId"
        element={<ModuleDetails onInstall={requestInstall} />}
      />
      <Route path="*" element={<Navigate to="/demo/modules" replace />} />
    </Routes>
  );
  return (
    <div className="min-h-screen font-sans text-zinc-800 selection:bg-violet-200">
      <PreviewBar />
      {isLibrary ? routes : <BuilderShell>{routes}</BuilderShell>}
      {target && (
        <Modal
          title={complete ? "Make yourself at home." : "Add to your Edge Studio"}
          description={
            complete
              ? "Your module is ready in the demo workspace."
              : "A new capability, a few clicks away."
          }
          onClose={() => setTarget(null)}
          footer={
            complete ? (
              <Button onClick={() => setTarget(null)} iconStart={<Check size={16} />}>
                Done
              </Button>
            ) : (
              <>
                <Button variant="ghost" onClick={() => setTarget(null)}>
                  Cancel
                </Button>
                <Button
                  variant="accent"
                  disabled={target.hostAccess && !acknowledged}
                  onClick={() => {
                    install(target.id);
                    setComplete(true);
                  }}
                  iconStart={<Boxes size={16} />}
                >
                  Install module
                </Button>
              </>
            )
          }
        >
          <div className="space-y-6 p-6">
            <div className="flex items-center gap-4">
              <ModuleGlyph icon={target.icon} color={target.color} />
              <div>
                <h3 className="text-xl font-semibold">{target.name}</h3>
                <p className="mt-1 text-sm text-zinc-500">
                  {target.author} · v{target.version}
                </p>
              </div>
              {complete && <Check className="ml-auto text-emerald-600" />}
            </div>
            {complete ? (
              <div className="rounded-xl bg-emerald-50 p-5 text-sm leading-relaxed text-emerald-800">
                Installed in your sample workspace, but not active. Open Module Builder and use its
                activation switch when you are ready. No package was downloaded or executed.
              </div>
            ) : (
              <>
                <BackupChecklist />
                <div className="rounded-xl border border-zinc-200 p-4">
                  <p className="text-xs text-zinc-400">INSTALL TO</p>
                  <p className="mt-2 flex items-center gap-2 font-semibold">
                    <HardDrive size={17} />
                    My edge workspace <DemoBadge>Demo target</DemoBadge>
                  </p>
                </div>
                <div>
                  <h4 className="mb-3 text-sm font-semibold">What this adds</h4>
                  <div className="flex flex-wrap gap-2">
                    {target.contributions.map((item) => (
                      <DemoBadge key={item} tone="purple">
                        {item}
                      </DemoBadge>
                    ))}
                  </div>
                </div>
                {target.hostAccess && (
                  <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
                    <p className="flex items-center gap-2 text-sm font-semibold text-amber-900">
                      <ShieldAlert size={17} />
                      Full host access
                    </p>
                    <p className="mt-2 text-xs leading-relaxed text-amber-800">
                      In the planned system, this module can run privileged code, manage services,
                      and access hardware. Install only software you trust.
                    </p>
                    <label className="mt-4 flex cursor-pointer items-center gap-2 text-xs font-semibold text-amber-900">
                      <input
                        type="checkbox"
                        checked={acknowledged}
                        onChange={(event) => setAcknowledged(event.target.checked)}
                        className="accent-violet-600"
                      />
                      I understand the access this module requests.
                    </label>
                  </div>
                )}
                <p className="flex items-center gap-2 text-xs text-zinc-400">
                  <CircleHelp size={14} />
                  Demo only. Nothing will be installed on your device.
                </p>
              </>
            )}
          </div>
        </Modal>
      )}
    </div>
  );
}

export default function ModuleDemo() {
  return (
    <DemoProvider>
      <DemoContent />
    </DemoProvider>
  );
}
