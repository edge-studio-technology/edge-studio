# Frontend Design System

This project uses Tailwind utilities plus small internal React components. Plain CSS is reserved for root, body, and base element rules in `frontend/src/styles.css`.

## Goals

- Keep frontend styling predictable without adding a UI library.
- Prefer shared internal components for repeated UI behavior.
- Keep page-specific layout close to the page that owns it.
- Avoid global CSS selectors for component or route styling.

## Structure

| Layer                 | Location                   | Use                                                               |
| --------------------- | -------------------------- | ----------------------------------------------------------------- |
| Base globals          | `frontend/src/styles.css`  | Tailwind import, root/body defaults, base form/code element rules |
| Shared primitives     | `frontend/src/components/` | Buttons, cards, pills, modal, text helpers, copied code           |
| Shared patterns       | `frontend/src/components/` | Page shells, sections, tables, status rows, filter/pager bars     |
| Feature UI            | `frontend/src/features/**` | Feature-specific forms, panels, modals, and page sections         |
| Route pages           | `frontend/src/pages/`      | Page composition and route-owned layout                           |
| Local class constants | Same component file        | One-off repeated class strings or conditional class maps          |

The project currently keeps shared primitives and patterns in a flat `frontend/src/components/` folder. Do not introduce `components/ui/` or `components/patterns/` unless the component list becomes hard to navigate.

## Styling Rules

- Use Tailwind utilities for component and page styling.
- Do not add component-specific CSS files.
- Do not add global classes for page or component styling.
- Keep `frontend/src/styles.css` limited to base/global element rules.
- Use `cx` from `frontend/src/lib/cx.ts` for conditional classes.
- Keep local class constants unexported and in the component file that uses them.
- Prefer existing components before creating new ones.
- Add a shared component only when the same structure or behavior appears in multiple places.

## Shared Components

Use these before writing bespoke markup:

- `Page`: route-level header, title, eyebrow, and optional action.
- `Card`: primary white card surface.
- `Section`: grouped content block inside a page.
- `Button` / `IconButton`: button variants and icon-only actions.
- `ButtonRow`: wrapping button groups.
- `Pill`: compact status/category label.
- `Text`: shared muted, error, and eyebrow text helpers.
- `ErrorAlert`: in-page error alert with optional title and recovery action.
- `Modal`: portal-backed dialog shell.
- `Input`: ordinary text field (ESDS surface, soft shadow, focus ring).
- `CredentialInput`: PIN or password field (`mode="pin" | "password"`); wraps `Input`.
- `DataTable`: workflow-style table shell, wrapper, rows, and action cells.
- `StatusRow`: compact label/value/status presentation.
- `ListPagerFilterBar`: list filtering and pagination controls.
- `JsonPreview`: formatted JSON/code preview surface.

If a shared component needs a new variant, add the smallest variant that matches an existing repeated need. Do not introduce a variant system dependency unless the current component API becomes difficult to maintain.

## Page-Specific Layout

For one route or one feature surface, inline Tailwind classes are preferred. Local constants are acceptable when they avoid duplicated long strings or make conditional states easier to read.

Good local constants:

```tsx
const labelClass = "grid gap-2 font-bold text-slate-700";
const inputClass =
  "w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2.5 text-slate-950";
```

Avoid exporting these constants or moving them into shared files unless more than one feature uses the same structure.

## Forms

- Use `Input` for ordinary text fields; use `CredentialInput` for PIN/password.
- Add Tailwind classes locally when a form needs a special layout or visual treatment.
- Keep inline validation near the field or form when the user needs to compare the error with entered values.
- Use toast errors for transient action failures that should not occupy page layout.

## Tables And Lists

- Use `DataTable` for tabular workflow/history/list surfaces.
- Use compact cards/lists instead of tables when the content is entity-detail oriented, narrow, or action-heavy.
- Preserve the shared table visual style: rounded bordered wrapper, uppercase slate header row, `border-t` body rows, and `px-4 py-3` cells.

## Tokens

Colour, typography, corner-radius, and spacing tokens follow Edge Studio Design System (ESDS) foundations. They are defined in `frontend/src/styles.css` (`@theme` for colour/font/radius/spacing primitives; `@utility type-*` for named text styles).

Prefer **semantic** colour tokens, **named type styles**, and **ESDS radius/spacing utilities** in UI. Change hex / type metrics / radius / spacing values only in `styles.css`, not in component classes.

### Colour primitives (hex source of truth)

| Token                                                       | Role                         |
| ----------------------------------------------------------- | ---------------------------- |
| `core-white` / `core-black`                                 | Absolute white and black     |
| `grey-01` … `grey-06`                                       | Neutral scale (light → dark) |
| `brand-01`                                                  | Brand accent purple          |
| `feedback-error` / `feedback-warning` / `feedback-positive` | Status base colours          |

### Colour semantics (prefer these)

| Group   | Examples                                                                                                                                        | Role                              |
| ------- | ----------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------- |
| Surface | `surface-primary`, `surface-secondary`, `surface-tertiary`, `surface-inverse`, `surface-always-white`, `surface-always-black`, `surface-accent` | Backgrounds and fills             |
| Text    | `text-primary`, `text-secondary`, `text-tertiary`, `text-disabled`, `text-inverse`, `text-accent`, `text-error`, `text-warning`, `text-success` | Foreground colour (not type size) |
| Icon    | `icon-primary`, `icon-secondary`, `icon-tertiary`, `icon-disabled`, `icon-inverse`, `icon-error`, `icon-warning`, `icon-success`                | Icon colour                       |
| Stroke  | `stroke-primary`, `stroke-secondary`, `stroke-active`, `stroke-error`, `stroke-warning`, `stroke-success`, `stroke-always-white`                | Borders and dividers              |
| Overlay | `overlay-light`, `overlay-heavy`                                                                                                                | Scrims / dimmers                  |

Do not use Tailwind opacity modifiers on colour tokens (e.g. `surface-always-white/25`) — add a named token instead.

### Typography

| Primitive        | Value          | Utility                               |
| ---------------- | -------------- | ------------------------------------- |
| Font family/Core | Hanken Grotesk | `font-sans` (also default on `:root`) |
| Font family/Mono | Azeret Mono    | `font-mono`                           |
| Weight/Base      | 400            | `font-base`                           |
| Weight/Emphasis  | 600            | `font-emphasis`                       |

Named styles are **complete recipes** (family + size + line-height + letter-spacing + weight). Prefer these over ad-hoc `text-sm` / `font-bold` / `tracking-*`:

| Figma (`esds.type.*`) | Utility        | Notes                                         |
| --------------------- | -------------- | --------------------------------------------- |
| Meta                  | `type-meta`    | 12 / 400 / lh 1.2 / tracking 0                |
| Mono                  | `type-mono`    | Azeret Mono, 12 / 400 / lh 1.2 / tracking −2% |
| Body                  | `type-body`    | 14 / 400 / lh 1.2 / tracking −1%              |
| Body Emphasis         | `type-body-em` | 14 / 600 / lh 1.2 / tracking −1%              |
| Link                  | `type-link`    | Same as Body + underline                      |
| Callout               | `type-callout` | 18 / 400 / lh 1.2 / tracking −2%              |
| Title                 | `type-title`   | 24 / 600 / lh 1.2 / tracking −2%              |
| Heading               | `type-heading` | 32 / 600 / lh 0.95 / tracking −2%             |
| Display               | `type-display` | 48 / 600 / lh 0.95 / tracking −2%             |

Pair type utilities with colour utilities (e.g. `type-body text-text-secondary`). Heading/Display use tight Figma leading — prefer short single-line titles; loosen only with design approval.

### Corner radius

| Figma (`esds.radius.*`) | Utility            | Value |
| ----------------------- | ------------------ | ----- |
| sharp                   | `rounded-sharp`    | 0     |
| tight                   | `rounded-tight`    | 4px   |
| loose                   | `rounded-loose`    | 8px   |
| interior                | `rounded-interior` | 15px  |
| exterior                | `rounded-exterior` | 24px  |
| full                    | `rounded-full`     | 999px |

Prefer these over ad-hoc `rounded-xl` / `rounded-[14px]` when restyling UI. Tokens live in `@theme` in `styles.css`.

### Spacing

Named spacing tokens map to Tailwind spacing utilities (`p-*`, `m-*`, `gap-*`, `space-*`, sizing where spacing is used). Prefer Figma names over ad-hoc `p-4` / `gap-6` when restyling UI. Some values repeat across groups on purpose (semantic roles from Figma).

#### Detail (`esds.spacing.detail.*`)

| Figma | Utility suffix | Value |
| ----- | -------------- | ----- |
| fine  | `detail-fine`  | 2px   |
| tight | `detail-tight` | 4px   |
| next  | `detail-next`  | 8px   |
| close | `detail-close` | 16px  |
| near  | `detail-near`  | 24px  |

Example: `gap-detail-next`, `p-detail-close`.

#### Separator (`esds.spacing.separator.*`)

| Figma   | Utility suffix      | Value |
| ------- | ------------------- | ----- |
| related | `separator-related` | 40px  |
| relaxed | `separator-relaxed` | 64px  |
| distant | `separator-distant` | 80px  |
| removed | `separator-removed` | 120px |

Example: `gap-separator-related`, `mt-separator-removed`.

#### Margin (`esds.spacing.margin.*`)

| Figma   | Utility suffix   | Value |
| ------- | ---------------- | ----- |
| close   | `margin-close`   | 8px   |
| tight   | `margin-tight`   | 16px  |
| relaxed | `margin-relaxed` | 40px  |
| distant | `margin-distant` | 80px  |
| removed | `margin-removed` | 120px |

Example: `p-margin-tight`, `px-margin-distant`.

## Do Not Add Yet

- A UI library.
- `cva` or another variant helper dependency.
- A Tailwind config solely for organization.
- Global component utility classes like `.section-h2` or `.text-muted-light`.
- New folder taxonomy purely for aesthetics.

These can be reconsidered if the component set grows enough that the current simple structure becomes painful.

## Verification

For frontend styling changes, run:

```bash
npm --prefix frontend run build
```

For docs-only changes, inspect the rendered Markdown diff and skip the frontend build unless code or package files changed.
