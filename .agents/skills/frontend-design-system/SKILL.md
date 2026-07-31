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
- Implementing a design-system control into the app
- Migrating an existing flat component into `ui/` or `patterns/`
- Updating design-system docs or frontend agent rules for component taxonomy

## Placement (new work)

| Kind            | Put it in              | Examples                                |
| --------------- | ---------------------- | --------------------------------------- |
| Leaf control    | `components/ui/`       | Button, Pill, Input, TabList            |
| Composed layout | `components/patterns/` | Page, DataTable                         |
| App / infra     | neither                | AppShell, ProtectedRoute, ToastProvider |

- Still useful without border/fill/radius → `ui/`
- Layout + several controls → `patterns/`
- **Never** add new design-system components to the flat `components/*.tsx` root

## Scope (ask first)

Default: change the **shared component** + the **one page/surface the user named** (today: Dashboard).

- Do **not** fan out to other route pages, call sites, or “while we’re here” cleanups unless the user asked.
- After finishing that scope, **ask** whether they want the same change applied to more files (e.g. other pages dropping deprecated `Page` props, deleting flat re-exports).
- Prefer thin re-exports from the old flat path while imports still point there; remind the user those re-exports are temporary and can be deleted once call sites import from `ui/` or `patterns/`.

## Migration

Incremental only. Move a cluster when touching it; update imports + inventory. No parallel copies (`ui/Button` + flat `Button.tsx`). Keep a flat re-export during migration if call sites still use the old path.

## Authoring

1. Prefer an existing shared component.
2. Tailwind + `cx` (`frontend/src/lib/cx.ts`); no component CSS files.
3. Match tokens in `styles.css` and sibling `ui/` patterns.
4. Document in `docs/frontend-design-system.md` + `CHANGELOG.md` (Added).
5. Taxonomy change → sync `.cursor/rules/frontend.mdc`, `.agents/rules/frontend.md`, `.claude/rules/frontend.md`.

## Documenting

**Do not mention Figma** in design-system docs or in component/code comments.

**ESDS** may appear once in foundations / intro / placement (what the token system is). Do **not** prefix every component detail, inventory line, prop note, or JSDoc with “ESDS …”. Describe the control in product terms.

**Inventory** (`## Shared Components`): name + short description of **what it is**, not what it has (no props, slots, or feature lists). Link to detail when it exists. No paths, migration arrows, or usage. Use plain `[Name](#name)` (no backticks inside the link — they break preview).

```md
- [Page](#page): route content frame
- [Card](#card): white card surface
```

**Detail** (`### Name`): short explain → props table if needed → minimal `tsx` usage. Skip if nothing to document. Keep heading text simple so `#name` matches preview (prefer `### Button` over `### Button / IconButton`).

## Sync

Keep identical under `.cursor/skills/`, `.agents/skills/`, `.claude/skills/`.
