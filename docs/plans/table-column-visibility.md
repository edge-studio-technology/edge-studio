# Table Column Visibility Plan

**Status:** In progress  
**Created:** 2026-09-17  
**Goal:** Let users choose which columns are shown in every `DataTable`-based table, with preferences saved by the backend.

## Context

The app currently shares table visuals through `frontend/src/components/patterns/DataTable.tsx` and the flat re-export `frontend/src/components/DataTable.tsx`. Those primitives provide the table shell, rows, cells, row action buttons, and row overflow menus, but they do not know what columns exist.

Column definitions are hardcoded inside each feature table. The area above most list tables is partly shared through `frontend/src/components/patterns/ListFilterBar.tsx`, but each table owner still decides which filters, actions, loading state, empty state, pagination, and table columns to render.

Decision points resolved before this plan:

- Scope is every current table using the shared `DataTable` primitives, including wallet, address book, Minima backup/peers, and workflow watch history.
- Preferences should be backend-saved, not `localStorage`-only.
- Users may hide action/select columns, but the UI must keep at least one data column visible.
- The column chooser opens from a cog wheel icon button placed above the table.

## Current Table Construction

Shared table primitives:

- `DataTable`, `TableWrap`, `TableHead`, `TableBody`, `TableRow`, `TableHeaderCell`, `TableCell`, `RowActions`, `TableIconButton`, and `TableIconMenu` live in `frontend/src/components/patterns/DataTable.tsx`.
- `frontend/src/components/DataTable.tsx` only re-exports those primitives for legacy import paths.
- Tables are native `<table>` markup; columns are currently repeated manually as matching `<TableHeaderCell>` and `<TableCell>` blocks.

Shared toolbar/filter primitives:

- `ListFilterBar` owns the common search/filter/action-button layout used by Diagnostics, Devices, Workflows, Workflow Inbox, Wallet Assets/History, and Address Book.
- `ListPaginationFooter` owns the common pagination footer for most list tables.
- Diagnostics has one route-level `ListFilterBar` above its tab switch and swaps between three feature-owned tables below it.
- Minima backup/peer tables and workflow watch history use table primitives without the main `ListFilterBar` pattern.

Tables found in scope:

- Diagnostics Integritas proofs: `frontend/src/features/integritas/IntegritasHistoryTable.tsx`.
- Diagnostics device reads: `frontend/src/features/data-reads/DataReadsHistoryTable.tsx`.
- Diagnostics workflow logs: `frontend/src/features/automation/AutomationRunsTable.tsx`.
- Devices: `frontend/src/features/data-sources/DataSourcesList.tsx`.
- Workflow list: `frontend/src/features/automation/AutomationWorkflowsList.tsx`.
- Workflow inbox: `frontend/src/features/automation/AutomationInboxTable.tsx`.
- Wallet assets: `frontend/src/features/wallet/WalletAssetsPanel.tsx`.
- Wallet send history: `frontend/src/features/wallet/WalletHistoryPanel.tsx`.
- Address book: `frontend/src/features/address-book/AddressBookPanel.tsx`.
- Minima backups: `frontend/src/features/minima/MinimaBackupPanel.tsx`.
- Minima peers: `frontend/src/features/minima/MinimaPeerConnectionsSection.tsx`.
- Workflow watch run history: `frontend/src/features/automation/workflow/WorkflowWatchUi.tsx`.

## Backend Plan

1. Add a small authenticated preferences feature under `backend/src/features/preferences/` or another existing settings-appropriate folder after checking current naming patterns.
2. Reuse the existing SQLite `settings` table through `backend/src/features/settings/settings.repository.ts` unless implementation inspection shows user-scoped preferences are required.
3. Store table column visibility as JSON keyed by stable table IDs, for example `ui.tableColumns` or one key per table.
4. Expose protected routes for reading and saving table column visibility preferences, mounted from `backend/src/app.ts` behind `requireAuth`.
5. Validate payloads server-side as a map of known table IDs to arrays or records of known column IDs.
6. Treat unknown table IDs or column IDs defensively so stale preferences from an older build do not break rendering.
7. Add backend tests for load/save, invalid payloads, stale unknown columns, and auth protection if a test harness already exists for similar routes.

Open implementation choice for backend storage:

- If preferences should follow the local admin user, add a user-scoped table or user-prefixed setting key.
- If this single-admin appliance should share preferences across sessions on the device, reuse `settings` with a global key.

## Frontend Plan

1. Add a shared table controls shell that can wrap existing filter/search/action controls and provide a consistent utility slot above every table.
2. Keep `ListFilterBar` focused on search/filter/action layout and compose it inside the broader table controls shell where a table already has filters.
3. Use the table controls shell for smaller tables without filters so the cog wheel has the same placement everywhere.
4. Add shared column-visibility types and helpers near the table pattern, likely in `frontend/src/components/patterns/DataTable.tsx` or a sibling such as `ColumnVisibilityDialog.tsx` if it grows beyond the primitive file.
5. Add a shared cog icon button and modal using existing `IconButton`, `Modal`, and `SwitchField` components.
6. Add a hook or small utility for loading/saving backend table preferences through `frontend/src/lib/api.ts`.
7. Model each table's columns as a stable local array with `id`, `label`, `defaultVisible`, and `renderHeader`/`renderCell` or equivalent metadata.
8. Keep feature-specific row rendering in the owning feature files; do not create a generic table renderer unless repeated code becomes clearly smaller.
9. Apply the shared chooser to every in-scope table through the table controls shell.
10. Enforce the visibility rule in the modal: disable the toggle that would hide the last visible data column, while allowing action/select columns to be hidden.
11. Make default visibility match current behavior so users see no column changes until they customize.
12. Ignore stale saved column IDs and show newly introduced columns according to their `defaultVisible` value.

Placement notes:

- New shared leaf controls belong under `frontend/src/components/ui/` only if they are standalone controls.
- The column chooser is a composed table/list pattern, so it should live under `frontend/src/components/patterns/`.
- Do not add new design-system components to the flat `frontend/src/components/` root; keep any flat root change to re-exports only if needed.

## UX Plan

1. Use a cog wheel icon-only button with a clear accessible name such as `Choose columns`.
2. Put the button above the table in the same control row as search/filter/actions when a `ListFilterBar` exists.
3. For tables without `ListFilterBar`, add a small right-aligned row above the table or align with that section's existing action controls.
4. The modal title should be table-specific, for example `Choose columns for Devices`.
5. Each possible column should be listed with an on/off switch.
6. Include helper text explaining that at least one data column must remain visible.
7. Save changes immediately on toggle or on an explicit modal action after implementation review; prefer the smaller behavior that avoids confusing unsaved state.

## Docs

Update these when implementation is done:

- `docs/frontend-design-system.md` for the new table column chooser pattern and any `ListFilterBar` extension.
- `CHANGELOG.md` under the branch-specific `[Unreleased]` section for the user-facing table customization behavior.
- `docs/TASKS.md` and `docs/SESSION.md` with actual work completed, using the session-notes workflow.
- `README.md` only if the final behavior affects operator-facing usage enough to warrant it.

## Verification

Automated checks:

```bash
npm run check
npm --prefix backend run build
npm --prefix frontend run build
docker compose config
```

Manual browser checks:

- Open every scoped table and confirm the cog button appears above the table.
- Toggle each informational column off and on and confirm matching headers and cells update together.
- Confirm action/select columns can be hidden.
- Confirm the last visible data column cannot be hidden.
- Refresh the page, sign out/in if relevant, and confirm backend-saved preferences return.
- Confirm empty, loading, filtered-empty, and paginated states still work.
- Confirm mobile width still allows the toolbar and modal to operate without clipping.
- Confirm stale preferences do not break the UI by testing with a removed or unknown saved column ID.
