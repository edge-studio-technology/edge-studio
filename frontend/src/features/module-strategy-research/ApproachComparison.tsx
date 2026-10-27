import { useState } from "react";
import { AlertTriangle, ArrowRight, Download, Pencil, SlidersHorizontal } from "lucide-react";
import { Button } from "../../components/ui/Button";
import { cx } from "../../lib/cx";
import { dimensions, policies, resources, type Approach, type Workshop } from "./researchData";
import { compareApproach, rankApproaches } from "./researchModel";
import { ResearchRadar, type RadarProfile } from "./ResearchRadar";

const statusLabel = {
  eligible: "No recorded conflicts",
  review: "Policy detail needed",
  conflict: "Constraint conflict",
};
const statusClass = {
  eligible: "bg-emerald-50 text-emerald-700",
  review: "bg-amber-50 text-amber-800",
  conflict: "bg-rose-50 text-rose-700",
};
function profile(approach: Approach): RadarProfile {
  return {
    label: approach.short,
    color: approach.color,
    values: dimensions.map(({ id }) => approach.scores[id]),
  };
}

export function ApproachComparison({
  workshop,
  onEdit,
  onSurvey,
}: {
  workshop: Workshop;
  onEdit: (id: string) => void;
  onSurvey: () => void;
}) {
  const [selectedId, setSelectedId] = useState("packages");
  const ranked = rankApproaches(workshop);
  const a = workshop.approaches.find((item) => item.id === selectedId)!;
  const resultA = compareApproach(workshop, a);
  const answered = ranked[0].answered;
  const team: RadarProfile = {
    label: "Team vision",
    color: "#0f766e",
    values: dimensions.map(({ id }) =>
      workshop.answers[id].unresolved ? null : workshop.answers[id].value,
    ),
    dashed: true,
  };
  function exportRadar() {
    const element = document.querySelector("#comparison-chart [data-research-radar]");
    if (!element) return;
    const exported = element.cloneNode(true) as SVGElement;
    exported.setAttribute("width", "1040");
    exported.setAttribute("height", "880");
    exported.removeAttribute("class");
    [profile(a), team].forEach((item, index) => {
      const x = 40 + index * 150;
      const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
      for (const [key, value] of Object.entries({
        x1: String(x),
        x2: String(x + 14),
        y1: "424",
        y2: "424",
        stroke: item.color,
        "stroke-width": "2",
      }))
        line.setAttribute(key, value);
      const text = document.createElementNS("http://www.w3.org/2000/svg", "text");
      for (const [key, value] of Object.entries({
        x: String(x + 20),
        y: "427",
        fill: "#52525b",
        "font-size": "10",
        "font-family": "sans-serif",
      }))
        text.setAttribute(key, value);
      text.textContent = item.label;
      exported.append(line, text);
    });
    const blob = new Blob([new XMLSerializer().serializeToString(exported)], {
      type: "image/svg+xml",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "module-strategy-radar.svg";
    link.click();
    URL.revokeObjectURL(url);
  }
  return (
    <div className="space-y-7">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-[10px] font-semibold tracking-[0.18em] text-violet-500 uppercase">
            From preferences to trade-offs
          </p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight">Explore the seven paths.</h1>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-zinc-500">
            Compare what each path could deliver and what it asks of us. The draft profiles are
            editable assumptions, not measured outcomes.
          </p>
        </div>
        <Button variant="ghost" size="sm" onClick={onSurvey} iconStart={<SlidersHorizontal />}>
          Review team answers
        </Button>
      </div>
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs leading-relaxed text-amber-900">
        <strong>
          {answered === 0
            ? "No priority levels agreed yet."
            : answered < 8
              ? `Provisional comparison: ${answered}/8 agreed levels.`
              : "All eight capability levels are included."}
        </strong>{" "}
        {answered < 8
          ? "Unanswered and unresolved dimensions are excluded from the gap score. "
          : ""}
        Constraints are checked before priority fit. A lower gap is closer under this model; it is
        not a success probability.
      </div>
      {ranked.every((result) => result.status === "conflict") && (
        <div
          role="alert"
          className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800"
        >
          All seven draft paths conflict with at least one recorded boundary. There is no compatible
          path under these assumptions. Review the boundaries, revise a profile, or discuss a
          combination.
        </div>
      )}
      <div className="grid items-start gap-6 xl:grid-cols-[300px_minmax(0,1fr)]">
        <aside className="rounded-2xl border border-zinc-200 bg-white p-5">
          <h2 className="font-semibold">Priority gap</h2>
          <p className="mt-2 text-[11px] leading-relaxed text-zinc-400">
            0 = no gap on included answers. 4 = maximum gap. Order respects recorded conflicts
            first.
          </p>
          <div className="mt-5 space-y-2">
            {ranked.map((result, index) => (
              <button
                key={result.approach.id}
                onClick={() => setSelectedId(result.approach.id)}
                className={cx(
                  "w-full cursor-pointer rounded-xl border p-3 text-left transition",
                  selectedId === result.approach.id
                    ? "border-violet-300 bg-violet-50/50"
                    : "border-zinc-100 hover:border-zinc-300",
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="flex items-center gap-2 text-xs font-semibold">
                    <span className="text-zinc-300">{answered ? index + 1 : "·"}</span>
                    <span
                      className="size-2 rounded-full"
                      style={{ backgroundColor: result.approach.color }}
                    />
                    {result.approach.short}
                  </span>
                  <span className="font-mono text-xs text-zinc-600">
                    {result.distance?.toFixed(2) ?? "—"}
                  </span>
                </div>
                <div className="mt-2 flex flex-wrap gap-2">
                  <span
                    className={cx("rounded px-1.5 py-1 text-[9px]", statusClass[result.status])}
                  >
                    {statusLabel[result.status]}
                  </span>
                  <span className="py-1 text-[9px] text-zinc-400">
                    {result.approach.confidence} confidence
                  </span>
                </div>
              </button>
            ))}
          </div>
          <p className="mt-4 text-[10px] leading-relaxed text-zinc-400">
            Ties are ordered alphabetically, not treated as a winner. “No recorded conflicts” does
            not mean validated feasibility.
          </p>
        </aside>
        <section
          id="comparison-chart"
          className="min-w-0 rounded-2xl border border-zinc-200 bg-white p-5 md:p-7"
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold">What the paths deliver</h2>
              <p className="mt-1 text-[11px] text-zinc-400">
                Solid profile: selected path assumptions. Dashed teal: team vision.
              </p>
            </div>
            <button
              onClick={exportRadar}
              className="inline-flex cursor-pointer items-center gap-1.5 text-xs text-zinc-500 hover:text-violet-600"
            >
              <Download size={13} />
              Export SVG
            </button>
          </div>
          <div className="mt-5">
            <label className="text-[10px] text-zinc-400">
              Selected approach
              <select
                aria-label="Selected approach"
                value={selectedId}
                onChange={(event) => setSelectedId(event.target.value)}
                className="mt-1 w-full rounded-lg border border-zinc-200 bg-zinc-50 p-2.5 text-xs text-zinc-700"
              >
                {workshop.approaches.map((approach) => (
                  <option key={approach.id} value={approach.id}>
                    {approach.name}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="mx-auto max-w-[630px]">
            <ResearchRadar
              labels={dimensions.map((item) => item.short)}
              profiles={[profile(a), team]}
            />
          </div>
          <p className="mt-4 rounded-lg bg-zinc-50 p-3 text-[10px] leading-relaxed text-zinc-400">
            A larger polygon means more capability on these definitions, not a universally better
            solution. Missing team levels appear only as agreed points. Importance weights are used
            in the gap table, not the polygon area.
          </p>
        </section>
      </div>
      <section className="overflow-hidden rounded-2xl border border-zinc-200 bg-white">
        <div className="p-6">
          <h2 className="text-lg font-semibold">Where do the differences come from?</h2>
          <p className="mt-2 text-xs text-zinc-400">
            Every score is inspectable. Open the assumptions to challenge an approach profile.
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[700px] border-collapse text-left text-xs">
            <thead className="bg-zinc-50 text-zinc-400">
              <tr>
                {["Dimension", "Team need", "Importance", a.short, "Gap"].map((title, index) => (
                  <th key={`${title}-${index}`} className="px-5 py-3 font-normal">
                    {title}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {dimensions.map(({ id, label }, index) => {
                const answer = workshop.answers[id];
                return (
                  <tr key={id} className="border-t border-zinc-100">
                    <th className="px-5 py-4 font-semibold">{label}</th>
                    <td className="px-5 py-4 text-zinc-500">
                      {answer.unresolved
                        ? "Unresolved"
                        : answer.value === null
                          ? "Unanswered"
                          : `${answer.mode === "minimum" ? "≥ " : "= "}${answer.value}`}
                    </td>
                    <td className="px-5 py-4 text-zinc-400">
                      {["", "Optional", "Important", "Essential"][answer.importance]}
                    </td>
                    <td className="px-5 py-4 font-semibold" style={{ color: a.color }}>
                      {a.scores[id]}
                    </td>
                    <td className="px-5 py-4 text-zinc-500">{resultA.gaps[index].gap ?? "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="flex flex-wrap gap-4 border-t border-zinc-100 px-6 py-4">
          <button
            onClick={() => onEdit(a.id)}
            className="inline-flex cursor-pointer items-center gap-1.5 text-xs font-semibold text-violet-600"
          >
            <Pencil size={12} />
            Review {a.short} assumptions
          </button>
        </div>
      </section>
      <div className="grid items-start gap-6 lg:grid-cols-2">
        <section className="rounded-2xl border border-zinc-200 bg-white p-6">
          <h2 className="text-lg font-semibold">What the paths require</h2>
          <p className="mt-2 text-xs leading-relaxed text-zinc-400">
            Higher means more investment, workload, skill, or operations. This is separate from
            capability fit and is not an engineering estimate.
          </p>
          <ResearchRadar
            title="Resource requirements and team ceilings"
            labels={["Build investment", "Core workload", "Creator skill", "Service ops"]}
            profiles={[
              {
                label: a.short,
                color: a.color,
                values: resources.map(({ id }) => a.requirements[id]),
              },
              {
                label: "Team ceilings",
                color: "#0f766e",
                dashed: true,
                values: resources.map(({ id }) => workshop.limits[id]),
              },
            ]}
          />
        </section>
        <section className="rounded-2xl border border-zinc-200 bg-white p-6">
          <h2 className="text-lg font-semibold">Constraints and unknowns</h2>
          <p className="mt-2 text-xs leading-relaxed text-zinc-400">
            Unknown feature support is flagged for review when the team has set a constraint.
          </p>
          {[resultA].map((result) => (
            <div key={result.approach.id} className="mt-5 rounded-xl border border-zinc-100 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-sm font-semibold">{result.approach.short}</h3>
                <span
                  className={cx("rounded-md px-2 py-1 text-[10px]", statusClass[result.status])}
                >
                  {statusLabel[result.status]}
                </span>
              </div>
              {result.conflicts.length + result.unknowns.length === 0 ? (
                <p className="mt-3 text-xs text-zinc-400">
                  No conflict with recorded limits. Check any limits the team has left unspecified.
                </p>
              ) : (
                <ul className="mt-3 space-y-3 text-xs leading-relaxed text-zinc-500">
                  {[...result.conflicts, ...result.unknowns].map((item) => (
                    <li key={item} className="flex gap-2">
                      <AlertTriangle size={13} className="mt-0.5 shrink-0 text-amber-600" />
                      {item}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))}
          <details className="mt-6 rounded-xl bg-zinc-50 p-4 text-xs text-zinc-500">
            <summary className="cursor-pointer font-semibold">How the comparison works</summary>
            <p className="mt-3 leading-relaxed">
              Each included gap is multiplied by importance (1, 2, or 3), then divided by the total
              included importance. Minimum levels count only shortfalls; exact targets count
              distance both ways. Missing and unresolved answers are excluded. Policy conflicts and
              resource ceilings are assessed before gap ordering. All approach scores and
              requirements can be edited. Use cases, people, responsibilities, environments, and
              commercial scope are recorded as discussion context, not included in the numeric gap.
            </p>
          </details>
        </section>
      </div>
      <section>
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold tracking-tight">
              Seven profiles. More than seven possible combinations.
            </h2>
            <p className="mt-2 text-xs text-zinc-400">
              An SDK can accompany adapters or curated packages. These are discussion lenses, not
              mutually exclusive architectures.
            </p>
          </div>
        </div>
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {workshop.approaches.map((approach) => {
            const result = compareApproach(workshop, approach);
            return (
              <article
                key={approach.id}
                className="flex flex-col rounded-2xl border border-zinc-200 bg-white p-5"
              >
                <div className="flex items-center justify-between">
                  <span
                    className="size-2.5 rounded-full"
                    style={{ backgroundColor: approach.color }}
                  />
                  <span className="text-[9px] text-zinc-400">
                    {approach.confidence} confidence · draft
                  </span>
                </div>
                <h3 className="mt-4 text-lg font-semibold tracking-tight">{approach.name}</h3>
                <p className="mt-2 min-h-12 text-xs leading-relaxed text-zinc-500">
                  {approach.contribution}
                </p>
                <ResearchRadar
                  compact
                  labels={dimensions.map((item) => item.short)}
                  profiles={[profile(approach), team]}
                />
                <div className="space-y-3 text-xs leading-relaxed">
                  <p>
                    <strong className="text-zinc-700">Advantage:</strong>{" "}
                    <span className="text-zinc-500">{approach.advantage}</span>
                  </p>
                  <p>
                    <strong className="text-zinc-700">Limitation:</strong>{" "}
                    <span className="text-zinc-500">{approach.limitation}</span>
                  </p>
                </div>
                <div className="mt-4 grid grid-cols-2 gap-2">
                  {resources.map((resource) => (
                    <span
                      key={resource.id}
                      className="rounded-lg bg-zinc-50 p-2 text-[9px] leading-relaxed text-zinc-500"
                    >
                      {resource.label}
                      <strong className="ml-1 text-zinc-800">
                        {approach.requirements[resource.id]}/5
                      </strong>
                    </span>
                  ))}
                </div>
                <div className="mt-5 flex flex-wrap items-center justify-between gap-2 border-t border-zinc-100 pt-4">
                  <span
                    className={cx("rounded px-1.5 py-1 text-[9px]", statusClass[result.status])}
                  >
                    {statusLabel[result.status]}
                  </span>
                  <button
                    onClick={() => onEdit(approach.id)}
                    className="inline-flex cursor-pointer items-center gap-1 text-xs text-violet-600"
                  >
                    Inspect / edit <ArrowRight size={12} />
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      </section>
    </div>
  );
}

export function ApproachAssumptions({
  workshop,
  onChange,
  selected,
  onSelect,
  onReset,
}: {
  workshop: Workshop;
  onChange: (next: Workshop) => void;
  selected: string;
  onSelect: (id: string) => void;
  onReset: (id: string) => void;
}) {
  const approach = workshop.approaches.find((item) => item.id === selected)!;
  const patch = (value: Partial<Approach>) =>
    onChange({
      ...workshop,
      approaches: workshop.approaches.map((item) =>
        item.id === selected ? { ...item, ...value } : item,
      ),
    });
  return (
    <div className="grid items-start gap-6 lg:grid-cols-[230px_minmax(0,1fr)]">
      <aside className="rounded-2xl border border-zinc-200 bg-white p-3 lg:sticky lg:top-6">
        <p className="px-3 py-2 text-[10px] font-semibold tracking-[0.15em] text-zinc-400 uppercase">
          Seven working hypotheses
        </p>
        {workshop.approaches.map((item) => (
          <button
            key={item.id}
            onClick={() => onSelect(item.id)}
            className={cx(
              "flex w-full cursor-pointer items-start gap-2 rounded-lg px-3 py-3 text-left text-xs",
              item.id === selected
                ? "bg-violet-50 font-semibold text-violet-700"
                : "text-zinc-500 hover:bg-zinc-50",
            )}
          >
            <span
              className="mt-1 size-2 shrink-0 rounded-full"
              style={{ backgroundColor: item.color }}
            />
            {item.name}
          </button>
        ))}
      </aside>
      <section className="min-w-0 space-y-7 rounded-2xl border border-zinc-200 bg-white p-6 md:p-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-[10px] font-semibold tracking-[0.15em] text-violet-500 uppercase">
              Editable assumptions
            </p>
            <h1 className="mt-3 text-2xl font-semibold tracking-tight">{approach.name}</h1>
            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-zinc-500">
              {approach.contribution}
            </p>
          </div>
          <Button size="sm" variant="ghost" onClick={() => onReset(approach.id)}>
            Restore this draft profile
          </Button>
        </div>
        <label className="block text-xs font-semibold text-zinc-600">
          Overall assumptions / caveats
          <textarea
            aria-label="Approach caveats"
            rows={3}
            value={approach.note}
            onChange={(event) => patch({ note: event.target.value })}
            className="mt-2 w-full rounded-lg border border-zinc-200 p-3 text-xs leading-relaxed outline-violet-600"
          />
        </label>
        <label className="block text-xs font-semibold text-zinc-600">
          Confidence in this profile
          <select
            value={approach.confidence}
            onChange={(event) =>
              patch({ confidence: event.target.value as Approach["confidence"] })
            }
            className="mt-2 ml-3 rounded-lg border border-zinc-200 p-2 text-xs"
          >
            <option>Low</option>
            <option>Medium</option>
          </select>
        </label>
        <p className="rounded-xl bg-amber-50 p-4 text-xs leading-relaxed text-amber-800">
          These values are proposed interpretations of the seven approaches, not benchmark results.
          Scores can change with scope. Record why you change them, and avoid treating assumed
          validation or recovery as already implemented.
        </p>
        <div className="space-y-6">
          {dimensions.map((dimension) => (
            <div key={dimension.id} className="border-b border-zinc-100 pb-6">
              <div className="flex items-center justify-between gap-3">
                <label htmlFor={`path-${dimension.id}`} className="text-sm font-semibold">
                  {dimension.label}
                </label>
                <select
                  id={`path-${dimension.id}`}
                  value={approach.scores[dimension.id]}
                  onChange={(event) =>
                    patch({
                      scores: { ...approach.scores, [dimension.id]: Number(event.target.value) },
                    })
                  }
                  className="rounded-lg border border-zinc-200 p-2 text-xs"
                >
                  {[1, 2, 3, 4, 5].map((level) => (
                    <option key={level} value={level}>
                      {level}/5
                    </option>
                  ))}
                </select>
              </div>
              <p className="mt-2 text-[11px] leading-relaxed text-violet-600">
                {dimension.levels[approach.scores[dimension.id] - 1]}
              </p>
              <label className="mt-3 block text-[10px] text-zinc-400">
                Reason / evidence
                <textarea
                  aria-label={`${dimension.label} rationale`}
                  rows={2}
                  value={approach.rationale[dimension.id]}
                  onChange={(event) =>
                    patch({
                      rationale: { ...approach.rationale, [dimension.id]: event.target.value },
                    })
                  }
                  className="mt-1 w-full rounded-lg border border-zinc-200 p-3 text-xs leading-relaxed text-zinc-600 outline-violet-600"
                />
              </label>
            </div>
          ))}
        </div>
        <div>
          <h2 className="text-lg font-semibold">Relative requirements</h2>
          <p className="mt-2 text-xs text-zinc-400">
            Higher means more work or skill. These scores are separate from delivered capability.
          </p>
          <div className="mt-5 grid gap-5 sm:grid-cols-2">
            {resources.map((resource) => (
              <label key={resource.id} className="text-xs font-semibold text-zinc-600">
                {resource.label}
                <select
                  aria-label={`${resource.label} requirement`}
                  value={approach.requirements[resource.id]}
                  onChange={(event) =>
                    patch({
                      requirements: {
                        ...approach.requirements,
                        [resource.id]: Number(event.target.value),
                      },
                    })
                  }
                  className="mt-2 w-full rounded-lg border border-zinc-200 p-2 text-xs"
                >
                  {[1, 2, 3, 4, 5].map((level) => (
                    <option key={level} value={level}>
                      {level}/5
                    </option>
                  ))}
                </select>
                <span className="mt-2 block text-[10px] leading-relaxed font-normal text-zinc-400">
                  {resource.detail}
                </span>
              </label>
            ))}
          </div>
        </div>
        <div>
          <h2 className="text-lg font-semibold">Constraint-relevant scope</h2>
          <p className="mt-2 text-xs text-zinc-400">
            Unspecified support becomes “Policy detail needed” when the team sets a corresponding
            constraint.
          </p>
          <div className="mt-5 grid gap-5 sm:grid-cols-2">
            {policies.map((policy) => (
              <label key={policy.id} className="text-xs font-semibold text-zinc-600">
                {policy.label}
                <select
                  aria-label={`${policy.label} path support`}
                  value={
                    approach.features[policy.id] === null
                      ? "unknown"
                      : approach.features[policy.id]
                        ? "yes"
                        : "no"
                  }
                  onChange={(event) =>
                    patch({
                      features: {
                        ...approach.features,
                        [policy.id]:
                          event.target.value === "unknown" ? null : event.target.value === "yes",
                      },
                    })
                  }
                  className="mt-2 w-full rounded-lg border border-zinc-200 p-2 text-xs"
                >
                  <option value="unknown">Unspecified / needs discussion</option>
                  <option value="yes">Included in this profile</option>
                  <option value="no">Not included in this profile</option>
                </select>
              </label>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
