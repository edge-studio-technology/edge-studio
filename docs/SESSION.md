# Session

Scratch log for the session in progress. Update it as you go; reset it when a session's work is done and merged. Not a changelog — see `CHANGELOG.md` for user-facing history.

## Progress

- #687 on `task/687-retire-old-feature-plan-documents`: plan doc written. Previous session log reset; every ticket it covered (#206, #216, #239, #283, #524, #536, #652, #686, #886) has merged to `dev`.
- ADRs consolidated (`8cbf4bcc`): 10 amendment/superseded records folded into their surviving ADR (retired numbers listed in `docs/README.md`), code-location sections dropped, 0002/0010/0030/0034 rewritten as current state; 3,207 → ~2,000 lines. New: 0019 broadened to host hardware access, 0037 Minima backups, 0038 feedback delivery, 0039 workflow canvas/watch mode. `adr` skill and rule now amend in place.
- `minima` rule trimmed from ~11 KB of rationale to ~3.7 KB of requirements pointing at ADRs (×3 mirrors).
- Deleted all finished plans, `plans/archive/`, `plans/security/`, `docs/notes/`, and the replay positioning report; `feedback.md` reduced to `plans/feedback-hosted-receiver.md`. QA evidence moved to `docs/reports/`. Open items carried into `docs/TASKS.md` as standalone lines.
- Fixed drift found on the way: broken links in `SECURITY.md`, `README.md`, `docs/security/`, `docs/qa/gaps.md`, fixture README, update-agent comment, nginx entrypoint comment; `.cursor` index linking nonexistent auth plans; `.cursor/skills` missing `add-device-support`; automation rule's `workflow-canvas/` path; frontend rule's `integritasAuth` folder; GPIO guide's never-committed SVG link; ADR 0030 still listing seed import.
- `plan-doc`/`openproject` skills and `documenting-work` rule: plans are retired before the PR into `dev`.
- `docs/README.md` and `docs/TASKS.md` rewritten. Verification: no broken relative doc links outside the pre-existing root-relative table in `.cursor/rules/index.mdc`; `npm run lint` passes; `.agents`/`.claude` mirrors identical except the intended `docker.md` path.

## Next Steps

- User decision on the ~30 old "Manual browser check" items in `docs/TASKS.md` (keep, collapse into one sweep checklist, drop obsolete ones, or both).
- Review, then PR to `dev`; retire the #687 plan doc itself in that PR.

## Notes / Open Questions

- `.cursor/skills/ui-ux-pro-max` has no `.claude`/`.agents` counterpart; left alone.
- No `CHANGELOG.md` entry: internal developer docs only.
