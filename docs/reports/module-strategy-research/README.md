# Module strategy research workshop

An English-only, disposable frontend research tool for a shared-screen team discussion about the long-term vision. This is a decision-support prototype, not an extension runtime, individual voting platform, or empirical feasibility study.

## Run locally

From the repository root:

```bash
npm --prefix frontend run dev
```

Open `/demo/research` on Vite's Local URL, normally [http://localhost:3030/demo/research](http://localhost:3030/demo/research). No backend, login, cloud service, or external account is required. It can run alongside the [module concept](../module-builder-demo/README.md).

## Facilitate the workshop

1. **Workshop brief:** follow four sections: Context, People and responsibility, Boundaries, and Commitments. Each section has its own numbered questions, with only one question shown at a time (23 in total). Previous/Next moves through questions and across section boundaries; the section navigation and numbered question buttons let you revisit answers. Edits save automatically. Record participants, three concrete use cases, success criteria, exclusions, creators/operators, validation/support ownership, commercial scope, supported environments, and actual resource/timing notes. The final question continues to team priorities; undecided answers can remain blank.
2. **Boundaries:** independently decide whether contributed executable code, full host access, drivers without core releases, a public library, and offline operation are required/excluded/unspecified. Host access is not pre-approved by the earlier module proposal. Reviewed changes to core source are different from independently distributed executable code.
3. **Resource ceilings:** optionally cap platform investment, ongoing core-team workload, creator skill, and distribution operations on relative 1-5 scales. These are assumptions, not sprint or budget estimates.
4. **Team priorities:** answer the eight capability questions together. Each has five explicit anchors, a desired level, importance, minimum/target interpretation, and discussion notes. Leave unanswered questions blank. Mark disagreements unresolved rather than substituting 3.
5. **Compare paths:** select one path to overlay against the team vision. The gap table, requirements chart, conflicts, and SVG export follow that selection. All seven individual profiles remain available below. This is a long-term profile, not an MVP promise.
6. **Path assumptions:** challenge scores, individual rationales, requirements, overall caveats, confidence, and constraint-relevant scope. Changes immediately affect the comparison. Restoring one profile preserves team answers and the other six profiles.
7. **Keep a record:** export a JSON session for restoration, a Markdown report for sharing, and the comparison radar as standalone SVG. Session/report exports include scale definitions and all edited profiles. Record decisions and remaining uncertainty in the brief.

Every dropdown question in the brief and team priorities displays all choices and their explanations beneath the control. Resource ceilings describe each relative level; boundary, importance, and target choices explain how they affect comparison. These descriptions guide discussion without changing the calculation or selecting answers.

The eight radar dimensions are Contribution breadth, Operator guidance, Creator tools, UI customization, Sharing and distribution, Validation depth, Lifecycle and recovery, and Contributor independence. Importance defaults visibly to Important (weight 2); change it deliberately. Context and ownership are recorded for discussion and are not secretly added to the numeric score.

## The seven approaches

The path definitions came from the team's clarified alternatives on 2026-10-26, following the [presentation discussion](https://docs.google.com/presentation/d/1AgQZmwFAxMnzToRsb0E0VGVUv3bIMV7dYnubKs4MeHE/edit).

1. We develop everything ourselves.
2. Community contributions to core through pull requests.
3. Declarative device profiles for existing protocols.
4. External adapters exposing hardware through HTTP or MQTT.
5. Curated extension packages with a small package manager.
6. Developer SDK and CLI, with external authoring.
7. Full module builder, including authoring and a public library.

These are not mutually exclusive architectural building blocks. An SDK can accompany adapters or curated packages. The supplied Low/Medium-confidence scores are working hypotheses, with a rationale per axis. The internal-only path has low *new platform* investment but high ongoing team workload; that does not mean future device support is free. The full-builder profile does not assume that better authoring automatically delivers qualified third-party validation. Unknown adapter/package/SDK host-permission policies are explicitly left unspecified.

## Transparent comparison method

For each agreed answer, let `d` be the desired level and `c` the path capability:

- **At least this level:** gap = max(0, d - c).
- **Match this level:** gap = absolute(d - c).
- **Importance:** Optional = 1, Important = 2, Essential = 3.
- **Priority gap:** sum(gap × importance) / sum(included importance).

The gap is 0-4, where lower is closer on the included answers. No answer means no score; unresolved questions are excluded even if a tentative level was selected. The chart does not invent missing values or close the team polygon until all eight levels have consensus. Importance affects the calculation, not the radar area.

Recorded policy conflicts and requirement ceilings are checked first. A good priority gap cannot override a conflict. Unknown support under a recorded constraint requires review. Results are grouped by no recorded conflicts, policy review needed, then conflicts; within groups, gaps order the paths. Exact ties are alphabetical and do not imply a winner. If every path conflicts, the UI says that no compatible draft path exists under the recorded assumptions.

The calculation treats these ordinal levels as equally spaced for workshop convenience. It is not a calibrated measurement, success probability, cost model, or recommendation to pick the first result without discussion. No calendar/staffing estimate is generated. Requirements are shown separately because more capability and more workload are different things.

## Saving and privacy

The browser autosaves to the namespaced localStorage key `edge-studio.module-strategy-workshop.v1`. Reloading on the same browser/origin restores context, answers, notes, and edited path profiles. This storage is local, not encrypted account storage; private browsing, clearing site data, or using a different origin/port/browser can lose or separate the draft. Export JSON before a presentation or moving devices. Workshop content is not sent to a backend by this feature.

Import validates format/version, dimensions, levels, importance, requirements, policy values, and all seven distinct paths before replacing the current session. A failed import preserves current data. An unreadable saved draft pauses autosave rather than silently overwriting the old value. Reset requires confirmation and affects only this workshop's data. Clearing a single answer does not clear other questions or the path assumptions.

## Verification

Focused tests exercise missing/unresolved answers, minimum versus exact targets, importance weighting, hard conflicts despite a zero gap, unknown feature support, resource ceilings, independent-code exclusion, export round trips, malformed imports, and report content. Browser checks cover the facilitated flow, path editing, autosave/reload, reset, JSON restore, invalid-import preservation, Markdown/JSON/SVG downloads, all seven profiles, and 768/390px layouts. Verification outcomes are recorded in the session notes.

Final checks passed: 10 focused model tests, frontend lint, TypeScript/Vite production build, and diff checks. The browser reported no runtime errors or backend requests and also verified conflicting boundaries, recovery from unreadable browser data, and a standalone SVG with a visible legend. Repository-wide documentation lint still has existing Windows-path, mirror, and ADR issues.

## Screenshots

- [Workshop brief](./workshop-brief.png)
- [Team survey](./team-survey.png)
- [Comparison and radar overlay](./path-comparison.png)
- [Editable path assumptions](./editable-assumptions.png)
- [Tablet comparison](./comparison-tablet.png)
- [Phone survey](./survey-mobile.png)

## Removal

Remove `frontend/src/features/module-strategy-research/`, its focused tests, this report folder, and the research lazy import/route branch in App. Remove the research link from the module demo and the corresponding README/security/changelog/index/session/task entries. No backend, database, runtime dependency, hardware, or deployment configuration needs reverting. Export any actual workshop data first, then remove the namespaced browser draft if desired. The earlier module builder plan and mockup are separate work.
