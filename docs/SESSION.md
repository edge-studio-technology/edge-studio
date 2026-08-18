# Session

Scratch log for the session in progress. Update it as you go; reset it when a session's work is done and merged. Not a changelog — see `CHANGELOG.md` for user-facing history.

## Progress

Branch `ui/polish`.

- Audited `frontend/src/components/` for unused files: 12 with no importers, plus `TablePager` only reached via unused `ListPagerFilterBar`.
- Updated `docs/frontend-design-system.md` (unused/superseded inventory, live list replacements), frontend agent rules (`ErrorDetails` → `ErrorDetailPanel`), and `docs/TASKS.md` removal-decision item.
- Implemented Feedback V2 sender-side hosted delivery: local save first, optional Integritas upload, per-submission consent, delivery status in the local JSON, and manual retry from Settings.
- Added feedback config/retry backend endpoints and fixed hosted endpoint client `POST https://integritas.technology/core/v2/web/feedback` with existing `x-api-key`/`x-request-id` headers.
- Updated `README.md`, `SECURITY.md`, `CHANGELOG.md`, and `docs/plans/feedback.md` for hosted feedback behavior and receiver requirements.
- Verified with `npm run check`, `npm --prefix backend run build`, `npm --prefix frontend run build`, and `docker compose config`.

## Next Steps

- Decide whether to delete the superseded unused component files listed in `docs/TASKS.md`.
- Implement the Integritas API receiver endpoint described in `docs/plans/feedback.md` before enabling hosted delivery in production.

## Notes / Open Questions

- `RadioField` and `Menu` have no call sites but remain the right controls when needed (table row actions use `TableIconMenu`, not `Menu`).
- Hosted feedback sender is implemented in Edge Studio only; the receiving Integritas API must append/idempotently store submissions by account plus Pi submission id.
