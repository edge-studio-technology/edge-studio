# Session

Scratch log for the session in progress. Update it as you go; reset it when a session's work is done and merged. Not a changelog — see `CHANGELOG.md` for user-facing history.

## Progress

Branch `ui/polish`.

- Audited `frontend/src/components/` for unused files: 12 with no importers, plus `TablePager` only reached via unused `ListPagerFilterBar`.
- Updated `docs/frontend-design-system.md` (unused/superseded inventory, live list replacements), frontend agent rules (`ErrorDetails` → `ErrorDetailPanel`), and `docs/TASKS.md` removal-decision item.

## Next Steps

- Decide whether to delete the superseded unused component files listed in `docs/TASKS.md`.

## Notes / Open Questions

- `RadioField` and `Menu` have no call sites but remain the right controls when needed (table row actions use `TableIconMenu`, not `Menu`).
