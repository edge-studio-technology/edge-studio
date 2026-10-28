import { useState } from "react";
import { BadgeCheck, Boxes, Download, Star } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "../../components/ui/Button";
import { Modal } from "../../components/ui/Modal";
import { cx } from "../../lib/cx";
import type { DemoModule } from "./demoData";
import { useDemo } from "./demoState";
import { averageRating, builderReputation } from "./moduleRatingMath";

export function ModuleRating({ module }: { module: DemoModule }) {
  const average = averageRating(module);
  return (
    <span
      className="inline-flex items-center gap-1 text-xs"
      title={
        average === null
          ? "No ratings yet"
          : `${average.toFixed(1)} out of 5 · ${module.ratingCount} ratings`
      }
    >
      <Star
        size={13}
        className={average === null ? "text-zinc-300" : "fill-amber-400 text-amber-400"}
      />
      <strong className="font-semibold text-zinc-700">
        {average === null ? "Not rated" : average.toFixed(1)}
      </strong>
      <span className="text-zinc-400">({module.ratingCount.toLocaleString("en-US")})</span>
    </span>
  );
}

export function BuilderProfile({ module }: { module: DemoModule }) {
  const { modules } = useDemo();
  const [open, setOpen] = useState(false);
  const reputation = builderReputation(modules, module.author);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={`View ${module.author} builder profile`}
        className="relative z-10 inline-flex cursor-pointer flex-wrap items-center gap-1 text-left text-xs text-zinc-500 hover:text-violet-700"
      >
        {module.author}
        {module.official && (
          <BadgeCheck size={14} className="text-violet-600" aria-label="Official publisher" />
        )}
        {!module.localOnly && (
          <span className="ml-1 text-[10px] text-zinc-400">
            · Builder{" "}
            {reputation.average === null ? "not rated" : `${reputation.average.toFixed(1)}/5`}
          </span>
        )}
      </button>
      {open && (
        <Modal
          title={module.author}
          description="Builder profile · Sample community data"
          onClose={() => setOpen(false)}
          footer={<Button onClick={() => setOpen(false)}>Done</Button>}
        >
          <div className="space-y-6 p-6">
            <div className="flex items-center gap-4">
              <span className="flex size-14 items-center justify-center rounded-2xl bg-violet-100 text-xl font-semibold text-violet-700">
                {module.author
                  .split(" ")
                  .map((part) => part[0])
                  .join("")
                  .slice(0, 2)}
              </span>
              <div>
                <h3 className="flex items-center gap-2 text-lg font-semibold">
                  {module.author}
                  {module.official && <BadgeCheck size={18} className="text-violet-600" />}
                </h3>
                <p className="mt-1 text-xs text-zinc-400">
                  {module.official ? "Official Edge Studio builder" : "Community module builder"}
                </p>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3 rounded-xl bg-zinc-50 p-4 text-center">
              <div>
                <p className="flex items-center justify-center gap-1 text-lg font-semibold">
                  <Star size={16} className="fill-amber-400 text-amber-400" />
                  {reputation.average?.toFixed(1) ?? "—"}
                </p>
                <p className="mt-1 text-[10px] text-zinc-400">
                  {reputation.ratingCount.toLocaleString("en-US")} ratings
                </p>
              </div>
              <div>
                <p className="text-lg font-semibold">{reputation.modules.length}</p>
                <p className="mt-1 text-[10px] text-zinc-400">Published modules</p>
              </div>
              <div>
                <p className="text-lg font-semibold">
                  {reputation.downloads.toLocaleString("en-US")}
                </p>
                <p className="mt-1 text-[10px] text-zinc-400">Module downloads</p>
              </div>
            </div>
            <p className="text-xs leading-relaxed text-zinc-500">
              The builder rating combines every rating across their published modules. Modules with
              more ratings contribute more to the overall score. Unrated and local-only modules do
              not affect the average.
            </p>
            <div>
              <h4 className="mb-3 text-sm font-semibold">Modules by this builder</h4>
              <div className="divide-y divide-zinc-100">
                {reputation.modules.map((item) => (
                  <Link
                    key={item.id}
                    to={`/demo/library/${item.id}`}
                    onClick={() => setOpen(false)}
                    className="flex flex-wrap items-center justify-between gap-2 py-3 text-sm hover:text-violet-600"
                  >
                    <span className="flex items-center gap-2">
                      <Boxes size={14} className="text-violet-400" />
                      {item.name}
                    </span>
                    <span className="flex items-center gap-4">
                      <ModuleRating module={item} />
                      <span className="inline-flex items-center gap-1 text-[11px] text-zinc-400">
                        <Download size={11} />
                        {item.downloads.toLocaleString("en-US")}
                      </span>
                    </span>
                  </Link>
                ))}
              </div>
            </div>
            <p className="rounded-lg bg-amber-50 p-3 text-[11px] leading-relaxed text-amber-800">
              Ratings and download counts show community feedback and popularity. They do not verify
              code safety or replace reviewing requested access.
            </p>
          </div>
        </Modal>
      )}
    </>
  );
}

export function RateModule({ module }: { module: DemoModule }) {
  const { rate } = useDemo();
  const [open, setOpen] = useState(false);
  const [score, setScore] = useState(module.userRating ?? 0);
  return (
    <>
      <button
        type="button"
        onClick={() => {
          setScore(module.userRating ?? 0);
          setOpen(true);
        }}
        className="cursor-pointer text-xs font-semibold text-violet-600 hover:text-violet-800"
      >
        {module.userRating ? `Your rating: ${module.userRating}/5 · Edit` : "Rate this module"}
      </button>
      {open && (
        <Modal
          title={`Rate ${module.name}`}
          description="How useful has this module been for you?"
          onClose={() => setOpen(false)}
          footer={
            <>
              <Button variant="ghost" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button
                variant="accent"
                disabled={!score}
                onClick={() => {
                  rate(module.id, score);
                  setOpen(false);
                }}
              >
                Save rating
              </Button>
            </>
          }
        >
          <div className="space-y-5 p-6">
            {module.commercial && (
              <p className="text-xs leading-relaxed text-zinc-500">
                {module.entitled
                  ? "Sample purchase entitlement present. Production verified-purchase reviews are planned; this demo verifies no payment."
                  : "Community rating · No purchase verified. Use the Source tab for a separate release inspection report."}
              </p>
            )}
            <div role="radiogroup" aria-label="Module rating" className="flex justify-center gap-3">
              {[1, 2, 3, 4, 5].map((value) => (
                <button
                  key={value}
                  type="button"
                  role="radio"
                  aria-checked={score === value}
                  aria-label={`${value} ${value === 1 ? "star" : "stars"}`}
                  onClick={() => setScore(value)}
                  className="cursor-pointer rounded-lg p-2 outline-violet-600"
                >
                  <Star
                    size={32}
                    className={cx(
                      "transition-colors",
                      value <= score
                        ? "fill-amber-400 text-amber-400"
                        : "text-zinc-200 hover:text-amber-300",
                    )}
                  />
                </button>
              ))}
            </div>
            <p className="text-center text-sm font-semibold text-zinc-600">
              {score
                ? ["", "Poor", "Fair", "Good", "Very good", "Excellent"][score]
                : "Choose a rating from 1 to 5"}
            </p>
            <p className="rounded-xl bg-violet-50 p-4 text-xs leading-relaxed text-violet-700">
              One rating per module in this demo session. Editing it replaces your previous rating
              and updates the builder's aggregate; it does not add another vote.
            </p>
            <p className="text-[11px] text-zinc-400">
              Demo ratings are not submitted to a server and reset on refresh.
            </p>
          </div>
        </Modal>
      )}
    </>
  );
}
