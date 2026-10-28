import {
  ArrowUpRight,
  Download,
  Bell,
  Camera,
  Cpu,
  Globe2,
  Radio,
  ShieldCheck,
  Sprout,
  Thermometer,
  Workflow,
  type LucideIcon,
} from "lucide-react";
import { Link } from "react-router-dom";
import { cx } from "../../lib/cx";
import type { DemoModule, ModuleIcon } from "./demoData";
import { BuilderProfile, ModuleRating } from "./ModuleRatings";

const icons: Record<ModuleIcon, LucideIcon> = {
  camera: Camera,
  radio: Radio,
  thermometer: Thermometer,
  globe: Globe2,
  workflow: Workflow,
  shield: ShieldCheck,
  sprout: Sprout,
  bell: Bell,
  cpu: Cpu,
};
const colors = {
  purple: "bg-violet-100 text-violet-600",
  green: "bg-emerald-50 text-emerald-700",
  blue: "bg-sky-50 text-sky-600",
  orange: "bg-orange-50 text-orange-600",
};

export function ModuleGlyph({
  icon,
  color,
  large = false,
}: {
  icon: ModuleIcon;
  color: DemoModule["color"];
  large?: boolean;
}) {
  const Icon = icons[icon];
  return (
    <span
      className={cx(
        "inline-flex shrink-0 items-center justify-center rounded-2xl",
        colors[color],
        large ? "size-20" : "size-12",
      )}
    >
      <Icon size={large ? 36 : 23} strokeWidth={1.6} />
    </span>
  );
}

export function DemoBadge({
  children,
  tone = "neutral",
}: {
  children: React.ReactNode;
  tone?: "neutral" | "purple" | "green" | "orange";
}) {
  return (
    <span
      className={cx(
        "inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] leading-none font-semibold",
        {
          neutral: "bg-zinc-100 text-zinc-500",
          purple: "bg-violet-50 text-violet-700",
          green: "bg-emerald-50 text-emerald-700",
          orange: "bg-amber-50 text-amber-700",
        }[tone],
      )}
    >
      {children}
    </span>
  );
}

export function Publisher({ module }: { module: DemoModule }) {
  return <BuilderProfile module={module} />;
}

export function CatalogCard({ module }: { module: DemoModule }) {
  return (
    <article className="group relative flex h-full flex-col rounded-2xl border border-zinc-200 bg-white p-6 transition duration-200 hover:-translate-y-1 hover:border-violet-300 hover:shadow-lg hover:shadow-violet-100/40">
      <div className="flex items-start justify-between gap-3">
        <ModuleGlyph icon={module.icon} color={module.color} />
        <DemoBadge>{module.category}</DemoBadge>
      </div>
      <Link
        to={`/demo/library/${module.id}`}
        className="mt-5 flex items-center gap-2 after:absolute after:inset-0 after:rounded-2xl focus-visible:outline-2 focus-visible:outline-violet-600"
      >
        <h3 className="text-lg font-semibold tracking-tight text-zinc-900">{module.name}</h3>
        <ArrowUpRight size={16} className="text-zinc-300 transition group-hover:text-violet-600" />
      </Link>
      <p className="mt-2 min-h-11 text-sm leading-relaxed text-zinc-500">{module.summary}</p>
      <div className="mt-5 flex flex-wrap gap-1.5">
        {module.commercial && (
          <span className="rounded bg-violet-50 px-2 py-1 text-[10px] text-violet-700">
            Paid concept · Inspectable source
          </span>
        )}
        {module.contributions.slice(0, 2).map((text) => (
          <span
            key={text}
            className="rounded border border-zinc-100 px-2 py-1 text-[10px] text-zinc-500"
          >
            {text}
          </span>
        ))}
      </div>
      <div className="mt-5 flex flex-wrap items-center justify-between gap-2 border-t border-zinc-100 pt-4">
        <ModuleRating module={module} />
        <span className="inline-flex items-center gap-1 text-[11px] text-zinc-400">
          <Download size={12} />
          {module.downloads.toLocaleString("en-US")} downloads
        </span>
      </div>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-2 text-[10px]">
        <Publisher module={module} />
        {module.installed && <span className="text-emerald-700">✓ Installed</span>}
      </div>
    </article>
  );
}

export function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[10px] font-semibold tracking-[0.18em] text-zinc-400 uppercase">
      {children}
    </p>
  );
}
