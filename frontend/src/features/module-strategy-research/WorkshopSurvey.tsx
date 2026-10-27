import { Children, useState, type ReactNode } from "react";
import { ArrowLeft, ArrowRight, Check, CircleHelp, Flag } from "lucide-react";
import { Button } from "../../components/ui/Button";
import { InputField } from "../../components/ui/InputField";
import { cx } from "../../lib/cx";
import { dimensions, policies, resources, type Answer, type Workshop } from "./researchData";
import { ResearchRadar } from "./ResearchRadar";

const selectClass =
  "mt-2 min-h-10 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-700 outline-violet-600";
const textClass =
  "mt-2 w-full resize-y rounded-lg border border-zinc-200 bg-white p-3 text-sm leading-relaxed text-zinc-700 outline-violet-600";

type ExplainedOption = readonly [label: string, explanation: string];

const resourceLevels = {
  investment: [
    "Accept small integration changes using the existing app structure.",
    "Accept a limited contribution mechanism, such as configurable profiles and basic checks.",
    "Accept a focused extension foundation with defined contracts and installation tooling.",
    "Accept substantial platform work covering developer tools, compatibility, and recovery.",
    "Accept a multi-phase extension platform, potentially including authoring tools and a public library.",
  ],
  maintenance: [
    "Accept occasional maintenance of stable contribution contracts.",
    "Accept periodic compatibility checks and limited contribution support.",
    "Accept regular review, releases, and troubleshooting alongside other work.",
    "Accept substantial recurring integration, review, and support responsibilities.",
    "Accept continuous core-team implementation, review, and support.",
  ],
  creatorSkill: [
    "Creators should need configuration skills only.",
    "Creators may need structured configuration and simple field or data mappings.",
    "Creators may need scripting skills and familiarity with APIs and debugging.",
    "Creators may need software development skills, dependency management, and integration testing.",
    "Creators may need experienced software or hardware development skills.",
  ],
  operations: [
    "Rely on existing release and repository infrastructure.",
    "Accept a small distribution service or simple catalog with limited administration.",
    "Accept regular package hosting, release management, and service monitoring.",
    "Accept substantial catalog administration, publishing checks, and incident handling.",
    "Accept public catalog operations, accounts, builds, moderation, and incident response.",
  ],
};

function OptionExplanations({ options }: { options: readonly ExplainedOption[] }) {
  return (
    <dl
      aria-label="What each choice means"
      className="mt-4 space-y-3 rounded-xl bg-zinc-50 p-4 text-xs leading-relaxed"
    >
      {options.map(([label, explanation]) => (
        <div key={label}>
          <dt className="font-semibold text-zinc-700">{label}</dt>
          <dd className="mt-1 text-zinc-500">{explanation}</dd>
        </div>
      ))}
    </dl>
  );
}

function Choice({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: ExplainedOption[];
  onChange: (value: string) => void;
}) {
  return (
    <div>
      <label className="block text-xs font-semibold text-zinc-600">
        {label}
        <select
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className={selectClass}
        >
          {options.map(([option]) => (
            <option key={option}>{option}</option>
          ))}
        </select>
      </label>
      <OptionExplanations options={options} />
    </div>
  );
}

function BriefQuestion({ index, children }: { index: number; children: ReactNode }) {
  return <div className="mt-6">{Children.toArray(children)[index]}</div>;
}

export function WorkshopBrief({
  workshop,
  onChange,
  onStart,
}: {
  workshop: Workshop;
  onChange: (next: Workshop) => void;
  onStart: () => void;
}) {
  const [step, setStep] = useState(0);
  const [question, setQuestion] = useState(0);
  const steps = ["Context", "People and responsibility", "Boundaries", "Commitments"];
  const questionCounts = [workshop.useCases.length + 4, 6, policies.length, resources.length + 1];
  const lastQuestion = question === questionCounts[step] - 1;
  const goToSection = (index: number, questionIndex = 0) => {
    setStep(index);
    setQuestion(questionIndex);
  };
  const patch = (value: Partial<Workshop>) => onChange({ ...workshop, ...value });
  return (
    <div className="space-y-7">
      {step === 0 && question === 0 && (
        <section className="relative overflow-hidden rounded-3xl bg-[#201a35] p-8 text-white md:p-11">
          <p className="text-[10px] font-semibold tracking-[0.2em] text-violet-300 uppercase">
            A shared direction before a solution
          </p>
          <h1 className="mt-5 max-w-2xl text-4xl leading-[1.08] font-semibold tracking-[-0.045em] md:text-5xl">
            Decide what matters.
            <br />
            <span className="text-violet-300">Then explore how to build it.</span>
          </h1>
          <p className="mt-5 max-w-xl text-sm leading-7 text-violet-100/65">
            One long-term vision. Eight capability dimensions. Seven possible paths. Use this
            workshop to make priorities, boundaries, and disagreements visible.
          </p>
          <div className="mt-7 flex flex-wrap items-center gap-5">
            <span className="text-xs text-violet-200/60">
              Facilitated together · No accounts or backend
            </span>
          </div>
          <div
            aria-hidden
            className="absolute top-7 right-7 hidden size-40 rounded-full border border-white/10 lg:block"
          >
            <div className="absolute inset-5 rounded-full border border-white/10" />
            <div className="absolute inset-10 rounded-full border border-violet-300/20" />
            <div className="absolute top-1/2 h-px w-full bg-white/10" />
            <div className="absolute left-1/2 h-full w-px bg-white/10" />
            <span className="absolute top-8 right-5 size-2 rounded-full bg-violet-300" />
          </div>
        </section>
      )}
      <nav
        aria-label="Workshop brief steps"
        className="rounded-2xl border border-zinc-200 bg-white p-4"
      >
        <p aria-live="polite" className="mb-3 text-xs font-semibold text-violet-600">
          Brief step {step + 1} of {steps.length}: {steps[step]}
        </p>
        <ol className="grid gap-2 sm:grid-cols-4">
          {steps.map((label, index) => (
            <li key={label}>
              <button
                onClick={() => goToSection(index)}
                aria-current={step === index ? "step" : undefined}
                className={cx(
                  "w-full cursor-pointer rounded-lg px-3 py-3 text-left text-xs",
                  step === index
                    ? "bg-violet-50 font-semibold text-violet-700"
                    : "text-zinc-500 hover:bg-zinc-50",
                )}
              >
                {index + 1}. {label}
              </button>
            </li>
          ))}
        </ol>
        <p aria-live="polite" className="mt-5 text-xs font-semibold text-zinc-600">
          Question {question + 1} of {questionCounts[step]} in this section
        </p>
        <div
          className="mt-3 flex flex-wrap gap-2"
          role="group"
          aria-label="Questions in this section"
        >
          {Array.from({ length: questionCounts[step] }, (_, index) => (
            <button
              key={index}
              onClick={() => setQuestion(index)}
              aria-label={`Brief question ${index + 1}`}
              aria-current={question === index ? "step" : undefined}
              className={cx(
                "size-10 cursor-pointer rounded-lg text-xs",
                question === index
                  ? "bg-violet-600 font-semibold text-white"
                  : "bg-zinc-50 text-zinc-500 hover:bg-zinc-100",
              )}
            >
              {index + 1}
            </button>
          ))}
        </div>
      </nav>
      {step === 0 && (
        <section className="rounded-2xl border border-zinc-200 bg-white p-6">
          <h2 className="text-lg font-semibold tracking-tight">First, frame the conversation.</h2>
          <p className="mt-2 text-xs leading-relaxed text-zinc-400">
            A radar profile cannot tell us whose problem we are solving. Record that here.
          </p>
          <BriefQuestion index={question}>
            <InputField
              label="Workshop name"
              value={workshop.name}
              onChange={(event) => patch({ name: event.target.value })}
            />
            <InputField
              label="Participants"
              placeholder="Who is in the room?"
              value={workshop.participants}
              onChange={(event) => patch({ participants: event.target.value })}
            />
            {workshop.useCases.map((value, index) => (
              <InputField
                key={index}
                label={`Priority use case ${index + 1}`}
                placeholder={
                  index === 0
                    ? "Example: support a new sensor without waiting for a core release"
                    : "What concrete task must this make possible?"
                }
                value={value}
                onChange={(event) =>
                  patch({
                    useCases: workshop.useCases.map((item, itemIndex) =>
                      itemIndex === index ? event.target.value : item,
                    ),
                  })
                }
              />
            ))}
            <label className="block text-xs font-semibold text-zinc-600">
              What would success look like?
              <textarea
                rows={3}
                value={workshop.success}
                onChange={(event) => patch({ success: event.target.value })}
                placeholder="What could someone demonstrate that would convince us?"
                className={textClass}
              />
            </label>
            <label className="block text-xs font-semibold text-zinc-600">
              Explicitly out of scope
              <textarea
                rows={2}
                value={workshop.exclusions}
                onChange={(event) => patch({ exclusions: event.target.value })}
                placeholder="What should this direction deliberately leave out?"
                className={textClass}
              />
            </label>
          </BriefQuestion>
        </section>
      )}
      {step === 1 && (
        <section className="rounded-2xl border border-zinc-200 bg-white p-6">
          <h2 className="text-lg font-semibold tracking-tight">People and responsibility</h2>
          <p className="mt-2 text-xs leading-relaxed text-zinc-400">
            Creating, installing, validating, and supporting are different jobs.
          </p>
          <BriefQuestion index={question}>
            <Choice
              label="Who should create contributions?"
              value={workshop.creators}
              options={[
                ["Not decided", "Leave the intended creator audience open for further discussion."],
                [
                  "Core developers",
                  "Your own team creates contributions using its knowledge of the app and hardware.",
                ],
                [
                  "External developers",
                  "Independent software developers need documented contracts and tools to build contributions.",
                ],
                [
                  "Technical enthusiasts",
                  "People comfortable with configuration and some code need examples and troubleshooting guidance.",
                ],
                [
                  "Ordinary users",
                  "People without programming experience need guided tools, clear language, and sensible defaults.",
                ],
                [
                  "A mix of skill levels",
                  "Support multiple creation experiences, with guidance for beginners and room for advanced developers.",
                ],
              ]}
              onChange={(creators) => patch({ creators })}
            />
            <Choice
              label="Who should install and use them?"
              value={workshop.operators}
              options={[
                ["Not decided", "Leave the intended installer and user audience open."],
                [
                  "Developers",
                  "Users can be expected to understand dependencies, logs, and development tools.",
                ],
                [
                  "Technical operators",
                  "Users can configure and administer devices, but should not need to write integration code.",
                ],
                [
                  "Ordinary users",
                  "Installation and everyday use should be guided and understandable without technical knowledge.",
                ],
                [
                  "A mix of skill levels",
                  "Provide a straightforward default experience plus technical controls and diagnostics.",
                ],
              ]}
              onChange={(operators) => patch({ operators })}
            />
            <Choice
              label="Who owns validation and approval?"
              value={workshop.validationOwner}
              options={[
                ["Not decided", "Validation and approval responsibilities still need agreement."],
                [
                  "Core team",
                  "Your team checks contributions and decides whether they meet the publishing or release requirements.",
                ],
                [
                  "Module author",
                  "Creators provide validation evidence and take responsibility for meeting the agreed requirements.",
                ],
                [
                  "Community",
                  "Community reviewers assess contributions; reviewer roles and approval rules must be defined.",
                ],
                [
                  "Hybrid: automated checks, authors, and core/community review",
                  "Automated checks cover repeatable tests, authors supply evidence, and reviewers handle the remaining decisions.",
                ],
              ]}
              onChange={(validationOwner) => patch({ validationOwner })}
            />
            <Choice
              label="Who supports broken community modules?"
              value={workshop.supportOwner}
              options={[
                ["Not decided", "Ownership of failures, fixes, and user questions remains open."],
                [
                  "Core team",
                  "Your team handles support and recovery for community modules, creating an ongoing workload.",
                ],
                [
                  "Module authors",
                  "Users turn to the creator for fixes; availability and response times depend on that author.",
                ],
                [
                  "Community",
                  "Users rely on shared troubleshooting and volunteer fixes, without an assumed response guarantee.",
                ],
                [
                  "Official modules: core team; community modules: authors",
                  "Your team supports official packages, while community authors support their own contributions.",
                ],
              ]}
              onChange={(supportOwner) => patch({ supportOwner })}
            />
            <Choice
              label="Commercial modules"
              value={workshop.commercial}
              options={[
                ["Not decided", "Leave support for paid modules and commercial distribution open."],
                [
                  "Part of the long-term vision",
                  "Plan for commercial contributions and clarify licensing, payment, and support responsibilities.",
                ],
                [
                  "Possible later; not a requirement",
                  "Do not make commercial distribution a condition for the current direction; revisit it later.",
                ],
                [
                  "Out of scope",
                  "The proposed scope does not include a commercial module offering.",
                ],
              ]}
              onChange={(commercial) => patch({ commercial })}
            />
            <label className="block text-xs font-semibold text-zinc-600">
              Supported environments
              <textarea
                rows={3}
                value={workshop.environments}
                onChange={(event) => patch({ environments: event.target.value })}
                placeholder="Pi models, OS/architecture, app versions, language runtimes…"
                className={textClass}
              />
            </label>
          </BriefQuestion>
        </section>
      )}
      {step === 2 && (
        <section className="rounded-2xl border border-zinc-200 bg-white p-6">
          <div className="mb-6 flex items-start gap-3">
            <span className="rounded-xl bg-violet-50 p-2.5 text-violet-600">
              <Flag size={20} />
            </span>
            <div>
              <h2 className="text-lg font-semibold tracking-tight">
                Set boundaries, not just preferences.
              </h2>
              <p className="mt-1 text-xs leading-relaxed text-zinc-400">
                A constraint conflict cannot be compensated for by a better radar score. Leave
                undecided questions unspecified.
              </p>
            </div>
          </div>
          <BriefQuestion index={question}>
            {policies.map((policy) => (
              <div key={policy.id}>
                <label className="text-xs font-semibold text-zinc-600">
                  {policy.label}
                  <span className="mt-1 block text-xs leading-relaxed font-normal text-zinc-400">
                    {policy.question}
                  </span>
                  <select
                    aria-label={policy.label}
                    className={selectClass}
                    value={workshop.policies[policy.id]}
                    onChange={(event) =>
                      patch({
                        policies: {
                          ...workshop.policies,
                          [policy.id]: event.target.value as Workshop["policies"][typeof policy.id],
                        },
                      })
                    }
                  >
                    <option value="unspecified">Not specified / discuss later</option>
                    <option value="required">Required in the proposed scope</option>
                    <option value="excluded">Excluded from the proposed scope</option>
                  </select>
                </label>
                <OptionExplanations
                  options={[
                    [
                      "Not specified / discuss later",
                      "Do not apply a hard boundary for this capability. Leave the decision open for the workshop.",
                    ],
                    [
                      "Required in the proposed scope",
                      "A path must support this capability. Missing support creates a conflict; unknown support needs review.",
                    ],
                    [
                      "Excluded from the proposed scope",
                      "A path must leave this capability out. Supporting it creates a conflict; unknown support needs review.",
                    ],
                  ]}
                />
              </div>
            ))}
          </BriefQuestion>
          {policies[question].id === "host" && (
            <p className="mt-5 rounded-xl bg-amber-50 p-4 text-xs leading-relaxed text-amber-800">
              An earlier proposal allowed full host access. This survey intentionally does not
              preselect it. “Full host access” concerns independently contributed runtime code, not
              our own reviewed core code.
            </p>
          )}
        </section>
      )}
      {step === 3 && (
        <section className="rounded-2xl border border-zinc-200 bg-white p-6">
          <h2 className="text-lg font-semibold tracking-tight">What commitments can we sustain?</h2>
          <p className="mt-2 text-xs leading-relaxed text-zinc-400">
            Optional ceilings on relative 1–5 requirements. These are discussion levels, not
            calendar or staffing estimates. Use notes for actual available people and deadlines.
          </p>
          <BriefQuestion index={question}>
            {resources.map((resource) => (
              <div key={resource.id}>
                <label className="text-xs font-semibold text-zinc-600">
                  Maximum {resource.label.toLowerCase()}
                  <span className="mt-1 block text-xs leading-relaxed font-normal text-zinc-400">
                    1: {resource.low}. 5: {resource.high}.
                  </span>
                  <select
                    aria-label={`Maximum ${resource.label.toLowerCase()}`}
                    className={selectClass}
                    value={workshop.limits[resource.id] ?? ""}
                    onChange={(event) =>
                      patch({
                        limits: {
                          ...workshop.limits,
                          [resource.id]: event.target.value ? Number(event.target.value) : null,
                        },
                      })
                    }
                  >
                    <option value="">No ceiling agreed</option>
                    {[1, 2, 3, 4, 5].map((level) => (
                      <option key={level} value={level}>
                        Up to level {level}
                      </option>
                    ))}
                  </select>
                </label>
                <OptionExplanations
                  options={[
                    [
                      "No ceiling agreed",
                      "Do not reject a path on this requirement. This leaves the limit open; it does not commit the team to unlimited resources.",
                    ],
                    ...resourceLevels[resource.id].map((explanation, index): ExplainedOption => [
                      `Up to level ${index + 1}`,
                      `${explanation} Paths requiring a higher level conflict with this ceiling.`,
                    ]),
                  ]}
                />
                <p className="mt-3 text-xs leading-relaxed text-zinc-400">
                  Relative workshop levels, not engineering estimates. {resource.detail}
                </p>
              </div>
            ))}
            <label className="mt-6 block text-xs font-semibold text-zinc-600">
              Decisions, actual resources, and open questions
              <textarea
                className={textClass}
                rows={4}
                value={workshop.decisions}
                onChange={(event) => patch({ decisions: event.target.value })}
                placeholder="Who owns discovery? What budget or timeline is real? Which issues remain unresolved?"
              />
            </label>
          </BriefQuestion>
        </section>
      )}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <Button
          variant="ghost"
          disabled={step === 0 && question === 0}
          onClick={() =>
            question > 0
              ? setQuestion(question - 1)
              : goToSection(step - 1, questionCounts[step - 1] - 1)
          }
          iconStart={<ArrowLeft />}
        >
          Previous question
        </Button>
        <span className="text-xs text-zinc-400">Answers save automatically · Undecided is OK</span>
        <Button
          variant="accent"
          onClick={() =>
            !lastQuestion
              ? setQuestion(question + 1)
              : step === steps.length - 1
                ? onStart()
                : goToSection(step + 1)
          }
          iconEnd={<ArrowRight />}
        >
          {lastQuestion
            ? step === steps.length - 1
              ? "Continue to priorities"
              : "Next section"
            : "Next question"}
        </Button>
      </div>
    </div>
  );
}

export function TeamSurvey({
  workshop,
  onChange,
  onCompare,
}: {
  workshop: Workshop;
  onChange: (next: Workshop) => void;
  onCompare: () => void;
}) {
  const [index, setIndex] = useState(0);
  const dimension = dimensions[index];
  const answer = workshop.answers[dimension.id];
  const answered = dimensions.filter(
    ({ id }) => workshop.answers[id].value !== null && !workshop.answers[id].unresolved,
  ).length;
  const patch = (value: Partial<Answer>) =>
    onChange({
      ...workshop,
      answers: { ...workshop.answers, [dimension.id]: { ...answer, ...value } },
    });
  return (
    <div className="grid items-start gap-6 xl:grid-cols-[190px_minmax(0,1fr)_300px]">
      <aside className="rounded-2xl border border-zinc-200 bg-white p-3 xl:sticky xl:top-6">
        <p className="px-3 py-2 text-[10px] font-semibold tracking-[0.15em] text-zinc-400 uppercase">
          Team priorities · {answered}/8
        </p>
        <div className="flex flex-wrap xl:block">
          {dimensions.map((item, itemIndex) => {
            const value = workshop.answers[item.id];
            return (
              <button
                key={item.id}
                onClick={() => setIndex(itemIndex)}
                className={cx(
                  "flex cursor-pointer items-center gap-2 rounded-lg px-3 py-3 text-left text-xs xl:w-full",
                  index === itemIndex
                    ? "bg-violet-50 font-semibold text-violet-700"
                    : "text-zinc-500 hover:bg-zinc-50",
                )}
              >
                <span
                  className={cx(
                    "inline-flex size-5 shrink-0 items-center justify-center rounded-full text-[10px]",
                    value.unresolved
                      ? "bg-amber-100 text-amber-700"
                      : value.value !== null
                        ? "bg-emerald-50 text-emerald-700"
                        : "bg-zinc-100 text-zinc-400",
                  )}
                >
                  {value.unresolved ? (
                    "?"
                  ) : value.value !== null ? (
                    <Check size={11} />
                  ) : (
                    itemIndex + 1
                  )}
                </span>
                {item.short}
              </button>
            );
          })}
        </div>
      </aside>
      <section className="min-w-0 rounded-2xl border border-zinc-200 bg-white p-6 md:p-8">
        <div className="flex items-center justify-between">
          <p className="text-[10px] font-semibold tracking-[0.15em] text-violet-500 uppercase">
            Question {index + 1} of 8
          </p>
          <span className="rounded-md bg-zinc-100 px-2 py-1 text-[10px] text-zinc-400">
            Long-term vision
          </span>
        </div>
        <h1 className="mt-5 text-2xl leading-tight font-semibold tracking-tight">
          {dimension.question}
        </h1>
        <p className="mt-4 text-sm leading-relaxed text-zinc-500">{dimension.description}</p>
        <div className="mt-7 grid grid-cols-5 gap-2" role="group" aria-label={dimension.label}>
          {dimension.levels.map((level, levelIndex) => (
            <button
              key={levelIndex}
              type="button"
              aria-pressed={answer.value === levelIndex + 1}
              aria-label={`Level ${levelIndex + 1}: ${level}`}
              onClick={() => patch({ value: levelIndex + 1 })}
              className={cx(
                "min-h-16 cursor-pointer rounded-xl border p-3 text-left transition sm:min-h-36",
                answer.value === levelIndex + 1
                  ? "border-violet-500 bg-violet-50 text-violet-700 ring-1 ring-violet-500"
                  : "border-zinc-200 hover:border-violet-300",
              )}
            >
              <span className="block text-xl font-semibold">{levelIndex + 1}</span>
              <span className="mt-3 hidden text-[10px] leading-relaxed text-zinc-500 sm:block">
                {level}
              </span>
            </button>
          ))}
        </div>
        <div className="mt-4 min-h-14 rounded-xl bg-zinc-50 p-4 text-xs leading-relaxed text-zinc-600">
          {answer.value === null ? (
            "No level selected. An unanswered question is excluded from fit calculations."
          ) : (
            <>
              <strong>Level {answer.value}:</strong> {dimension.levels[answer.value - 1]}
            </>
          )}
        </div>
        <div className="mt-7 grid gap-5 sm:grid-cols-2">
          <div>
            <label className="text-xs font-semibold text-zinc-600">
              How important is this?
              <select
                aria-label="Importance"
                className={selectClass}
                value={answer.importance}
                onChange={(event) => patch({ importance: Number(event.target.value) })}
              >
                <option value={1}>Optional · weight 1</option>
                <option value={2}>Important · weight 2 (default)</option>
                <option value={3}>Essential · weight 3</option>
              </select>
            </label>
            <OptionExplanations
              options={[
                [
                  "Optional · weight 1",
                  "Give this dimension the lowest relative influence on the priority gap. It still counts when an agreed answer is present.",
                ],
                [
                  "Important · weight 2 (default)",
                  "Give this dimension twice the influence of an Optional dimension. This is the starting weight for every question.",
                ],
                [
                  "Essential · weight 3",
                  "Give this dimension three times the influence of an Optional dimension. It does not create a hard constraint; use the brief boundaries for those.",
                ],
              ]}
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-zinc-600">
              How should we interpret the level?
              <select
                aria-label="Level interpretation"
                className={selectClass}
                value={answer.mode}
                onChange={(event) => patch({ mode: event.target.value as Answer["mode"] })}
              >
                <option value="minimum">At least this level</option>
                <option value="target">Match this level</option>
              </select>
            </label>
            <OptionExplanations
              options={[
                [
                  "At least this level",
                  "Treat the chosen level as a minimum. Only a path that falls below it adds a gap; extra capability adds no gap.",
                ],
                [
                  "Match this level",
                  "Treat the chosen level as an exact target. Both lower and higher capability add a gap, reflecting a preference against excess scope.",
                ],
              ]}
            />
          </div>
        </div>
        <p className="mt-3 flex items-start gap-2 text-[11px] leading-relaxed text-zinc-400">
          <CircleHelp size={13} className="mt-0.5 shrink-0" />
          “At least” accepts extra capability. “Match” treats excess scope as a mismatch too.
          Neither replaces a hard constraint.
        </p>
        <label className="mt-6 flex cursor-pointer items-start gap-2 rounded-xl border border-amber-100 bg-amber-50/50 p-4 text-xs leading-relaxed text-zinc-600">
          <input
            type="checkbox"
            checked={answer.unresolved}
            onChange={(event) => patch({ unresolved: event.target.checked })}
            className="mt-0.5 accent-violet-600"
          />
          <span>
            <strong>We have not reached consensus.</strong>
            <br />
            Keep the proposed level and notes, but exclude it from ranking. Disagreement is not a
            score of 3.
          </span>
        </label>
        <label className="mt-6 block text-xs font-semibold text-zinc-600">
          Why this level? What are we disagreeing about?
          <textarea
            aria-label="Question discussion"
            rows={3}
            className={textClass}
            value={answer.note}
            onChange={(event) => patch({ note: event.target.value })}
            placeholder="Capture examples, caveats, and minority views…"
          />
        </label>
        <div className="mt-7 flex items-center justify-between border-t border-zinc-100 pt-6">
          <Button
            variant="ghost"
            size="sm"
            disabled={index === 0}
            onClick={() => setIndex(index - 1)}
            iconStart={<ArrowLeft />}
          >
            Previous
          </Button>
          <button
            onClick={() => patch({ value: null })}
            className="cursor-pointer text-xs text-zinc-400 hover:text-violet-600"
          >
            Clear level
          </button>
          <Button
            size="sm"
            variant="accent"
            iconEnd={<ArrowRight />}
            onClick={() => (index < 7 ? setIndex(index + 1) : onCompare())}
          >
            {index < 7 ? "Next question" : "Compare approaches"}
          </Button>
        </div>
      </section>
      <aside className="rounded-2xl border border-zinc-200 bg-white p-5 xl:sticky xl:top-6">
        <p className="text-xs font-semibold">The team's emerging profile</p>
        <p className="mt-2 text-[11px] leading-relaxed text-zinc-400">
          {answered}/8 agreed levels. Missing and unresolved answers are not filled with defaults.
        </p>
        <ResearchRadar
          compact
          labels={dimensions.map((item) => item.short)}
          profiles={[
            {
              label: "Team",
              color: "#0f766e",
              values: dimensions.map(({ id }) =>
                workshop.answers[id].unresolved ? null : workshop.answers[id].value,
              ),
            },
          ]}
        />
        <p className="text-[10px] leading-relaxed text-zinc-400">
          Points appear as you answer. The polygon closes when all eight levels have consensus. The
          chart shows desired levels; importance affects the gap calculation.
        </p>
      </aside>
    </div>
  );
}
