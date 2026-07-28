---
name: frontend-design-system
description: >-
  Place and author frontend shared UI for integritas-pi. Use when adding or
  moving React components, implementing ESDS/Figma controls, deciding between
  components/ui vs components/patterns, or updating frontend design-system docs.
---

# Frontend Design System (placement)

Source of truth: `docs/frontend-design-system.md`. Read that file before adding shared UI.

## When this skill applies

- New shared React component under `frontend/src/components/`
- Implementing an Edge Studio / Figma control into the app
- Migrating an existing flat component into `ui/` or `patterns/`
- Updating design-system docs or frontend agent rules for component taxonomy

## Placement (new work)

| Kind | Put it in | Examples |
| ---- | --------- | -------- |
| ESDS leaf control | `frontend/src/components/ui/` | Button, Pill, Input, ProgressBar, TabList |
| Composed shared layout | `frontend/src/components/patterns/` | Page, Section, DataTable, ListPagerFilterBar |
| App / infra | keep out of `ui/` / `patterns/` | AppShell, ProtectedRoute, ToastProvider |

**Boundary test**

- Removing border / fill / radius still leaves a useful **control** → `ui/`
- Mostly **layout + several controls together** → `patterns/`

**Do not** add new design-system components to the flat `frontend/src/components/*.tsx` root.

## Migration (later, incremental)

- Existing flat files stay until deliberately moved — do not big-bang migrate.
- When touching a cluster, move that cluster, update imports, update the inventory in `docs/frontend-design-system.md`.
- No parallel copies with different behavior (`ui/Button` + flat `Button.tsx`).

## Authoring checklist

1. Prefer an existing shared component over a new one.
2. Tailwind utilities + `cx` from `frontend/src/lib/cx.ts`; no component CSS files.
3. Match ESDS tokens in `frontend/src/styles.css` and patterns in sibling `ui/` components.
4. Document new shared components in `docs/frontend-design-system.md` and `CHANGELOG.md` (Added).
5. Sync frontend rules if taxonomy changes: `.cursor/rules/frontend.mdc`, `.agents/rules/frontend.md`, `.claude/rules/frontend.md`.

## Sync notice

Keep this skill identical under `.cursor/skills/`, `.agents/skills/`, and `.claude/skills/` when you change it.
