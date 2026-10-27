import {
  dimensions,
  initialApproaches,
  policies,
  resources,
  type Approach,
  type DimensionId,
  type Workshop,
} from "./researchData";

export function compareApproach(workshop: Workshop, approach: Approach) {
  const gaps = dimensions.map((dimension) => {
    const answer = workshop.answers[dimension.id];
    const included = answer.value !== null && !answer.unresolved;
    const gap = !included
      ? null
      : answer.mode === "minimum"
        ? Math.max(0, answer.value! - approach.scores[dimension.id])
        : Math.abs(answer.value! - approach.scores[dimension.id]);
    return {
      id: dimension.id,
      included,
      gap,
      weight: answer.importance,
      capability: approach.scores[dimension.id],
    };
  });
  const weight = gaps.reduce((sum, item) => sum + (item.included ? item.weight : 0), 0);
  const distance = weight
    ? gaps.reduce((sum, item) => sum + (item.gap ?? 0) * item.weight, 0) / weight
    : null;
  const conflicts: string[] = [];
  const unknowns: string[] = [];
  for (const policy of policies) {
    const rule = workshop.policies[policy.id];
    if (rule === "unspecified") continue;
    const feature = approach.features[policy.id];
    if (feature === null)
      unknowns.push(`${policy.label}: the path's configuration is unspecified.`);
    else if ((rule === "required" && !feature) || (rule === "excluded" && feature))
      conflicts.push(
        `${policy.label}: ${rule === "required" ? "required, but not included" : "excluded, but included"} in this path profile.`,
      );
  }
  for (const resource of resources) {
    const maximum = workshop.limits[resource.id];
    if (maximum !== null && approach.requirements[resource.id] > maximum)
      conflicts.push(
        `${resource.label}: draft requirement ${approach.requirements[resource.id]} exceeds the team's ceiling ${maximum}.`,
      );
  }
  return {
    approach,
    gaps,
    distance,
    answered: gaps.filter((item) => item.included).length,
    conflicts,
    unknowns,
    status: conflicts.length
      ? ("conflict" as const)
      : unknowns.length
        ? ("review" as const)
        : ("eligible" as const),
  };
}

export function rankApproaches(workshop: Workshop) {
  const order = { eligible: 0, review: 1, conflict: 2 };
  return workshop.approaches
    .map((approach) => compareApproach(workshop, approach))
    .sort(
      (a, b) =>
        order[a.status] - order[b.status] ||
        (a.distance ?? 5) - (b.distance ?? 5) ||
        a.approach.name.localeCompare(b.approach.name),
    );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function isLevel(value: unknown) {
  return typeof value === "number" && Number.isInteger(value) && value >= 1 && value <= 5;
}

export function serializeWorkshop(workshop: Workshop) {
  return JSON.stringify(
    {
      schemaVersion: 1,
      vision: "long-term",
      definitions: { dimensions, resources, policies },
      exportedAt: new Date().toISOString(),
      workshop,
    },
    null,
    2,
  );
}

export function parseWorkshop(text: string): Workshop {
  const parsed: unknown = JSON.parse(text);
  if (
    !isRecord(parsed) ||
    parsed.schemaVersion !== 1 ||
    parsed.vision !== "long-term" ||
    !isRecord(parsed.workshop)
  )
    throw new Error("Choose a version 1 long-term workshop export.");
  const data = parsed.workshop;
  const strings = [
    "name",
    "participants",
    "success",
    "exclusions",
    "creators",
    "operators",
    "validationOwner",
    "supportOwner",
    "environments",
    "commercial",
    "decisions",
  ];
  if (
    !strings.every((key) => typeof data[key] === "string") ||
    !Array.isArray(data.useCases) ||
    data.useCases.length !== 3 ||
    !data.useCases.every((value) => typeof value === "string")
  )
    throw new Error("Workshop context is incomplete or invalid.");
  if (
    !isRecord(data.answers) ||
    !dimensions.every(({ id }) => {
      const answer = (data.answers as Record<string, unknown>)[id];
      return (
        isRecord(answer) &&
        (answer.value === null || isLevel(answer.value)) &&
        [1, 2, 3].includes(Number(answer.importance)) &&
        typeof answer.importance === "number" &&
        ["minimum", "target"].includes(String(answer.mode)) &&
        typeof answer.unresolved === "boolean" &&
        typeof answer.note === "string"
      );
    })
  )
    throw new Error("Every dimension needs a valid answer, importance, and note.");
  if (
    !isRecord(data.policies) ||
    !policies.every(({ id }) =>
      ["unspecified", "required", "excluded"].includes(
        String((data.policies as Record<string, unknown>)[id]),
      ),
    )
  )
    throw new Error("Constraint choices are invalid.");
  if (
    !isRecord(data.limits) ||
    !resources.every(
      ({ id }) =>
        (data.limits as Record<string, unknown>)[id] === null ||
        isLevel((data.limits as Record<string, unknown>)[id]),
    )
  )
    throw new Error("Resource ceilings must be unset or 1–5.");
  if (
    !Array.isArray(data.approaches) ||
    data.approaches.length !== initialApproaches.length ||
    new Set(data.approaches.map((item: unknown) => (isRecord(item) ? item.id : null))).size !==
      initialApproaches.length ||
    !data.approaches.every((item: unknown) => {
      if (
        !isRecord(item) ||
        !initialApproaches.some((approach) => approach.id === item.id) ||
        !["name", "short", "contribution", "advantage", "limitation", "note"].every(
          (key) => typeof item[key] === "string",
        ) ||
        typeof item.color !== "string" ||
        !/^#[0-9a-f]{6}$/i.test(item.color) ||
        !["Low", "Medium"].includes(String(item.confidence))
      )
        return false;
      return (
        isRecord(item.scores) &&
        dimensions.every(({ id }) => isLevel((item.scores as Record<string, unknown>)[id])) &&
        isRecord(item.rationale) &&
        dimensions.every(
          ({ id }) => typeof (item.rationale as Record<string, unknown>)[id] === "string",
        ) &&
        isRecord(item.requirements) &&
        resources.every(({ id }) => isLevel((item.requirements as Record<string, unknown>)[id])) &&
        isRecord(item.features) &&
        policies.every(({ id }) =>
          [true, false, null].includes(
            (item.features as Record<string, unknown>)[id] as boolean | null,
          ),
        )
      );
    })
  )
    throw new Error("The seven approach profiles contain invalid scores or settings.");
  return data as unknown as Workshop;
}

const escapeCell = (text: string) => text.replace(/\|/g, "\\|").replace(/\r?\n/g, " / ");
export function workshopReport(workshop: Workshop) {
  const ranked = rankApproaches(workshop);
  const answerText = (id: DimensionId) => {
    const answer = workshop.answers[id];
    return answer.value === null
      ? "Unanswered"
      : `${answer.value}/5${answer.unresolved ? " (unresolved; excluded)" : ""}`;
  };
  return [
    `# ${workshop.name}`,
    "",
    "Long-term vision · Facilitated research workshop",
    `Exported: ${new Date().toISOString()}`,
    "",
    `Participants: ${workshop.participants || "Not recorded"}`,
    `Creators: ${workshop.creators}`,
    `Operators: ${workshop.operators}`,
    "",
    "## Scope and outcomes",
    ...workshop.useCases.map((value, index) => `${index + 1}. ${value || "Not recorded"}`),
    "",
    `Success: ${workshop.success || "Not recorded"}`,
    `Out of scope: ${workshop.exclusions || "Not recorded"}`,
    `Environments: ${workshop.environments || "Not recorded"}`,
    `Commercial scope: ${workshop.commercial}`,
    "",
    "## Team capability profile",
    "| Dimension | Desired level | Importance | Interpretation | Discussion |",
    "| --- | --- | --- | --- | --- |",
    ...dimensions.map(
      ({ id, label }) =>
        `| ${label} | ${answerText(id)} | ${["", "Optional", "Important", "Essential"][workshop.answers[id].importance]} | ${workshop.answers[id].mode === "minimum" ? "At least this level" : "Match this level"} | ${escapeCell(workshop.answers[id].note)} |`,
    ),
    "",
    "## Scale definitions",
    ...dimensions.flatMap((dimension) => [
      `### ${dimension.label}`,
      dimension.question,
      ...dimension.levels.map((level, index) => `${index + 1}. ${level}`),
      "",
    ]),
    "## Constraints and responsibilities",
    ...policies.map(({ id, label }) => `- ${label}: ${workshop.policies[id]}`),
    ...resources.map(
      ({ id, label }) =>
        `- Maximum ${label.toLowerCase()}: ${workshop.limits[id] ?? "not specified"}`,
    ),
    `- Validation owner: ${workshop.validationOwner}`,
    `- Support owner: ${workshop.supportOwner}`,
    "",
    "## Comparison",
    "| Path | Constraint status | Weighted gap (0 best, 4 maximum) | Included answers | Assumption confidence |",
    "| --- | --- | --- | --- | --- |",
    ...ranked.map(
      (result) =>
        `| ${result.approach.name} | ${result.status} | ${result.distance?.toFixed(2) ?? "Not scored"} | ${result.answered}/8 | ${result.approach.confidence} |`,
    ),
    "",
    "Fit is a weighted gap, not a probability or a measured success prediction. Importance weights are Optional=1, Important=2, Essential=3. Minimum needs penalize only shortfalls; target needs penalize distance in either direction. Unanswered/unresolved dimensions are excluded. Constraints are assessed first; no score overrides a conflict. Unspecified path features under a constraint require review. Resource levels are relative workshop assumptions, not sprint or cost estimates. Approaches can be combined.",
    "",
    ...workshop.approaches.flatMap((approach) => [
      `## ${approach.name}`,
      `Contribution: ${approach.contribution}`,
      `Advantage: ${approach.advantage}`,
      `Limitation: ${approach.limitation}`,
      `Assumption: ${approach.note}`,
      "",
      ...dimensions.map(
        ({ id, label }) => `- ${label}: ${approach.scores[id]}/5. ${approach.rationale[id]}`,
      ),
      ...resources.map(({ id, label }) => `- ${label}: ${approach.requirements[id]}/5`),
      ...policies.map(
        ({ id, label }) =>
          `- ${label}: ${approach.features[id] === null ? "Unspecified" : approach.features[id] ? "Included" : "Not included"}`,
      ),
      ...compareApproach(workshop, approach).conflicts.map((item) => `- CONFLICT: ${item}`),
      ...compareApproach(workshop, approach).unknowns.map((item) => `- REVIEW: ${item}`),
      "",
    ]),
    "## Decisions and unresolved issues",
    workshop.decisions || "Not recorded",
    "",
  ].join("\n");
}
