# Frontend Design System

This project uses Tailwind utilities plus small internal React components. Plain CSS is reserved for root, body, and base element rules in `frontend/src/styles.css`.

## Goals

- Keep frontend styling predictable without adding a UI library.
- Prefer shared internal components for repeated UI behavior.
- Keep page-specific layout close to the page that owns it.
- Avoid global CSS selectors for component or route styling.

## Structure

| Layer                 | Location                            | Use                                                                   |
| --------------------- | ----------------------------------- | --------------------------------------------------------------------- |
| Base globals          | `frontend/src/styles.css`           | Tailwind import, root/body defaults, base form/code element rules     |
| ESDS primitives       | `frontend/src/components/ui/`       | Leaf controls with a clear ESDS / Figma counterpart                   |
| Shared patterns       | `frontend/src/components/patterns/` | Composed layouts built from ui (page chrome, tables, filter bars)     |
| Legacy shared (flat)  | `frontend/src/components/*.tsx`     | Existing files — import as-is until migrated into `ui/` / `patterns/` |
| App / infra           | `frontend/src/components/` (select) | Shell wiring, providers, route guards — not design-system leaves      |
| Feature UI            | `frontend/src/features/**`          | Feature-specific forms, panels, modals, and page sections             |
| Route pages           | `frontend/src/pages/`               | Page composition and route-owned layout                               |
| Local class constants | Same component file                 | One-off repeated class strings or conditional class maps              |

### Placement (`ui/` vs `patterns/`)

**Boundary test**

- Removing border / fill / radius still leaves a useful **control** → `ui/`
- Mostly **layout + several controls together** → `patterns/`
- Route, auth, or app wiring → keep out of `ui/` / `patterns/` (e.g. `ProtectedRoute`, `ToastProvider`, `AppShell`)

**New shared components**

- New ESDS primitives → `frontend/src/components/ui/`
- New composed shared UI → `frontend/src/components/patterns/`
- Do **not** add new design-system components to the flat `frontend/src/components/` root

**Import paths**

- Prefer `../components/ui/ProgressBar` (or `@/` equivalent if introduced) for new code
- Existing flat imports (`../components/Pill`) stay valid until those files move

### Migration policy

Migration is **incremental**, not a big-bang move:

1. Leave existing flat files where they are until a deliberate move.
2. When touching a cluster (e.g. form controls), move that cluster into `ui/` or `patterns/`, update call-site imports, and document the new path here.
3. Optional thin re-exports from the old path are allowed only if an external import would otherwise break; prefer updating call sites in the same change.
4. Do not invent parallel copies (no `ui/Button` while `Button.tsx` still exists with different behavior).

**Target homes (when migrated)**

| Target         | Components (indicative)                                                                                                                                                                                                                                              |
| -------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ui/`          | `Button` / `IconButton`, `Pill`, `Input`, `InputField`, `CheckboxField`, `RadioField`, `SwitchField`, `TextareaField`, `PinField`, `Label`, `Text`, `Card`, `Menu`, `TabList`, `ToggleTabs`, `Modal`, `ProgressBar`, `CredentialInput` (or retire into `InputField`) |
| `patterns/`    | `Page`, `Section`, `ButtonRow`, `DataTable`, `StatusRow`, `StatusBadge`, `ListPagerFilterBar`, `ErrorAlert`, `ErrorDetails`, `JsonPreview`, `CopyableCode`, `EmptyPage`, `ProgressModal`, `DarkHeroCard`, `BrandLineGrid`                                            |
| Stay / special | `AppShell`, `AppShellSidebar`, `ProtectedRoute`, `ToastProvider`, `Clock`, `MinimaIcon`, temporary `Test`                                                                                                                                                            |

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

Use these before writing bespoke markup. Paths: most still live flat under `frontend/src/components/` until migrated; new ESDS work goes in `ui/` / `patterns/` (see Placement above).

- `Page`: route-level header, title, eyebrow, and optional action. _(→ `patterns/`)_
- `Card`: primary white card surface. _(→ `ui/`)_
- `Section`: grouped content block inside a page. _(→ `patterns/`)_
- `Button` / `IconButton`: ESDS button variants and icon-only actions (see below). _(→ `ui/`)_
- `ButtonRow`: wrapping button groups. _(→ `patterns/`)_
- `Pill`: ESDS Tag / pill (Default / Success / Warning / Error via `tone`; optional indicator dot). _(→ `ui/`)_
- `ProgressBar` (`components/ui/`): ESDS step progress (optional back IconButton, accent track, step count Tag).
- `CheckboxField` (`components/ui/`): ESDS checkbox + label + optional description (checked / unchecked / indeterminate).
- `RadioField` (`components/ui/`): ESDS radio + label + optional description (selected / unselected × default / disabled).
- `SwitchField` (`components/ui/`): ESDS switch + optional label / description (on / off × default / disabled).
- `Text`: shared muted, error, and eyebrow text helpers. _(→ `ui/`)_
- `ErrorAlert`: in-page error alert with optional title and recovery action. _(→ `patterns/`)_
- `Modal`: portal-backed dialog shell. _(→ `ui/`)_
- `Input`: ESDS text control (box only). Prefer `InputField` for labeled forms. _(→ `ui/`)_
- `InputField`: ESDS Input Field (label / description / control / error); wraps `Input`. _(→ `ui/`)_
- `TextareaField` (`components/ui/`): ESDS textarea field (label / description / control / error).
- `Menu` (`components/ui/`): ESDS menu list (built-in Plus icon per row); default / hover / disabled. Rows via `items` only — `MenuItem` is internal.
- `TabList` (`components/ui/`): ESDS underline tabs (`TabItem` internal; active / hover / inactive). Prefer this over `SubTabs` for page-level tab strips.
- `ToggleTabs` (`components/ui/`): ESDS segmented toggle (selected inverse / idle ghost on `surface-secondary` track).
- `PinField` (`components/ui/`): segmented 6-digit PIN / verification-code field with label / description / error.
- `CredentialInput`: PIN or password field (`mode="pin" | "password"`); wraps `Input`. _(→ `ui/` or retire)_
- `DataTable`: workflow-style table shell, wrapper, rows, and action cells. _(→ `patterns/`)_
- `StatusRow`: compact label/value/status presentation. _(→ `patterns/`)_
- `ListPagerFilterBar`: list filtering and pagination controls. _(→ `patterns/`)_
- `JsonPreview`: formatted JSON/code preview surface. _(→ `patterns/`)_

If a shared component needs a new variant, add the smallest variant that matches an existing repeated need. Do not introduce a variant system dependency unless the current component API becomes difficult to maintain.

### Button / IconButton

#### Text `Button`

ESDS matrix: Primary, Secondary, Tertiary (`ghost`), Accent × Default (`md` 44px) / Compact (`sm` 32px). App-only variants: `danger`, `onDark`.

| Prop                    | Values                                                                  | Notes                                                                                 |
| ----------------------- | ----------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| `variant`               | `primary` \| `secondary` \| `ghost` \| `accent` \| `danger` \| `onDark` | Prefer ESDS four for new UI                                                           |
| `size`                  | `md` (44px) \| `sm` / `xs` (32px)                                       | `xs` matches `sm` today; prefer `sm` for compact                                      |
| `iconStart` / `iconEnd` | optional `ReactNode`                                                    | Leading/trailing icon slots (16px). Prefer these over stuffing icons into `children`. |

Icons in `iconStart` / `iconEnd` are layout-only; keep the visible label in `children` so the accessible name stays clear. Mark decorative SVGs with `aria-hidden` when they add no meaning beyond the label.

```tsx
<Button variant="primary" iconEnd={<ArrowRightIcon aria-hidden />}>
  Continue
</Button>
```

#### Circular `IconButton`

ESDS [Icon Button]: Primary / Secondary / Tertiary (`ghost`) × Default / Compact. Fully circular (`rounded-full`). No accent / danger / onDark.

| Prop      | Values                                                                     | Notes                                          |
| --------- | -------------------------------------------------------------------------- | ---------------------------------------------- |
| `variant` | `primary` \| `secondary` \| `ghost`                                        | ESDS three only                                |
| `size`    | `default` (40px circle, 20px glyph) \| `compact` (32px circle, 16px glyph) | Component sizes the glyph — omit lucide `size` |

```tsx
<IconButton variant="primary" size="default" aria-label="Open Integritas config" onClick={...}>
  <SettingsIcon aria-hidden />
</IconButton>
```

#### Accessibility (aria)

- **`Button` with visible text:** the label in `children` is the accessible name. Do not add a redundant `aria-label` unless the visible text is incomplete (e.g. icon + ambiguous text).
- **`IconButton` (icon-only):** always pass `aria-label` (or `aria-labelledby`) describing the action. `title` alone is not enough for screen readers.
- Prefer `aria-label="Configure Minima"` over generic labels like `"Settings"` when the control is page-specific.
- Keep `type="button"` unless the control submits a form (`type="submit"`).
- Disabled actions use the native `disabled` attribute (component styles handle the look).

```tsx
<IconButton variant="primary" aria-label="Open Integritas config" onClick={...}>
  <SettingsIcon aria-hidden />
</IconButton>
```

#### When migrating call sites (TODO)

When restyling a page or feature to ESDS buttons:

1. Replace local button class constants (`primaryButtonClass`, etc.) with `<Button>` / `<IconButton>`.
2. Remove `className` overrides that fight the component (`rounded-full`, custom `bg-*` / `px-*` / `py-*`). Use `variant` + `size` instead.
3. Map old sizes: default actions → `md`; dense table/toolbars → `sm`. Replace `size="xs"` with `sm` when touching those files.
4. Map old variants: tertiary/ghost stay `ghost`; brand purple CTAs → `accent` when appropriate.
5. Prefer `iconStart` / `iconEnd` for leading/trailing icons instead of mixing icons into `children`.
6. For `IconButton`, drop lucide `size={…}` (component owns 20/16px glyphs) and always set `aria-label` (known gap: Integritas page config).
7. Prefer `md` for primary CTAs on touch / Pi UI; reserve `sm` for dense desktop rows.
8. Do not restyle focus rings per page — shared `focus-visible` ring is intentional.
9. After call sites stop needing `xs`, remove the `xs` size alias from `Button.tsx`.
10. Consider dropping global `button:disabled { opacity }` in `styles.css` once all buttons use this component (disabled look is colour-based).

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

- Prefer `InputField` for labeled text fields (login, settings, device forms).
- Prefer `TextareaField` when multiline text needs a label, description, or inline error.
- Prefer `CheckboxField` for labeled boolean / tri-state choices with optional helper text.
- Prefer `RadioField` for mutually exclusive options in a named group with optional helper text.
- Prefer `SwitchField` for labeled on/off settings with optional helper text.
- Extract `Textarea` when needing no field wrapper around it.
- Use `PinField` for segmented numeric verification / approval codes.
- Use bare `Input` only when there is no label stack (rare toolbars / search).
- Use `CredentialInput` for PIN/password chrome until those call sites move onto `InputField`.
- Keep inline validation on the field via `InputField` `error` when the user needs to compare it with the value.
- Use toast errors for transient action failures that should not occupy page layout.

### CheckboxField

ESDS Checkbox Field (`frontend/src/components/ui/CheckboxField.tsx`): 16px control beside a body label, optional description indented under the label (16px spacer aligns with the control).

| Prop            | Values / notes                                                              |
| --------------- | --------------------------------------------------------------------------- |
| `label`         | Required; `type-body` beside the control                                    |
| `description`   | Optional helper under the row (`text-secondary` / disabled `text-disabled`) |
| `checked`       | Controlled checked state                                                    |
| `indeterminate` | Shows minus mark; sets native `indeterminate` + `aria-checked="mixed"`      |
| `disabled`      | Secondary surface box + tertiary/disabled text                              |
| `className`     | Outer stack                                                                 |
| …input props    | Standard checkbox `onChange`, `name`, `defaultChecked`, etc.                |

Default checked / indeterminate: `icon-primary` fill with inverse glyph. Unchecked: white fill + `stroke-primary` border. Disabled: `surface-secondary` fill + `stroke-primary` border (glyph `icon-disabled` when present).

```tsx
<CheckboxField
  label="Label"
  description="Description"
  checked={enabled}
  onChange={(event) => setEnabled(event.target.checked)}
/>
<CheckboxField label="Partial" indeterminate checked={false} readOnly />
```

### RadioField

ESDS Radio Field (`frontend/src/components/ui/RadioField.tsx`): 16px circular control beside a body label, optional description indented under the label (16px spacer aligns with the control). Group options with a shared `name`; the selected value is the field state.

| Prop          | Values / notes                                                              |
| ------------- | --------------------------------------------------------------------------- |
| `label`       | Required; `type-body` beside the control                                    |
| `description` | Optional helper under the row (`text-secondary` / disabled `text-disabled`) |
| `checked`     | Controlled selected state                                                   |
| `name`        | Shared group name for mutually exclusive options                            |
| `value`       | Option value within the group                                               |
| `disabled`    | Secondary surface ring + tertiary/disabled text                             |
| `className`   | Outer stack                                                                 |
| …input props  | Standard radio `onChange`, `defaultChecked`, etc.                           |

Default selected: `icon-primary` ring + inverse fill + primary center dot. Unselected: white fill + `stroke-primary` border. Disabled: `surface-secondary` fill + `stroke-primary` border (center `icon-disabled` when selected).

```tsx
<RadioField
  name="plan"
  value="pro"
  label="Pro"
  description="Multiple devices and automation."
  checked={plan === "pro"}
  onChange={() => setPlan("pro")}
/>
```

### SwitchField

ESDS Switch Field (`frontend/src/components/ui/SwitchField.tsx`): optional body label with a 40×24 switch on the right, optional full-width description under the row.

| Prop          | Values / notes                                                                 |
| ------------- | ------------------------------------------------------------------------------ |
| `label`       | Optional; `type-body` on the left (`text-primary` / disabled `text-disabled`)  |
| `description` | Optional helper under the row (`text-secondary` / disabled `text-disabled`)    |
| `checked`     | Controlled on/off state                                                        |
| `disabled`    | Secondary track + disabled text                                                |
| `className`   | Outer stack                                                                    |
| …input props  | Standard checkbox `onChange`, `name`, `defaultChecked`, etc. (`role="switch"`) |

Default on: `icon-primary` track + inverse knob. Off: inverse track + `stroke-primary` border + `icon-tertiary` knob. Disabled: `surface-secondary` track + `stroke-primary` border + `icon-disabled` knob.

```tsx
<SwitchField
  label="Email notifications"
  description="Get alerts when a proof completes or fails."
  checked={enabled}
  onChange={(event) => setEnabled(event.target.checked)}
/>
```

### ProgressBar

ESDS Progress Bar (`frontend/src/components/ui/ProgressBar.tsx`): optional back control, accent fill track, step count Tag. Prefer this for multi-step / wizard progress.

| Prop        | Values / notes                                          |
| ----------- | ------------------------------------------------------- |
| `current`   | Current step (clamped 0…`total`)                        |
| `total`     | Total steps (minimum 1)                                 |
| `showBack`  | boolean (default `true`) — ESDS `hasButton`             |
| `onBack`    | optional click handler; button disabled if omitted      |
| `backLabel` | `aria-label` for the IconButton (default `"Back"`)      |
| `label`     | `aria-label` for the progressbar (default `"Progress"`) |
| `className` | merged onto the row                                     |

Back control is `IconButton` ghost compact with ChevronLeft. Count uses `Pill`. Track fill is `surface-accent` at `(current / total) * 100%`.

```tsx
<ProgressBar current={1} total={2} onBack={() => goBack()} />
<ProgressBar current={2} total={2} showBack={false} />
```

### Pill

ESDS Tag: 24px-tall rounded pill (`type-meta`, `px-detail-next`). Prefer this for compact status/category labels.

| Prop        | Values                                   | Notes                                       |
| ----------- | ---------------------------------------- | ------------------------------------------- |
| `tone`      | `neutral` \| `good` \| `warn` \| `error` | Maps to Default / Success / Warning / Error |
| `indicator` | boolean (default `false`)                | Optional 4px status dot                     |
| `className` | optional                                 | Merged onto the pill                        |

Default (`neutral`): `surface-secondary` fill. Success / Warning / Error: white fill, matching stroke, 20% feedback wash. Label is always `text-primary`.

```tsx
<Pill>Default</Pill>
<Pill tone="good" indicator>
  Success
</Pill>
<Pill tone="error">Failed</Pill>
```

### InputField

ESDS [Input Field]: label → optional description → control → optional error.

| Prop          | Notes                                                     |
| ------------- | --------------------------------------------------------- |
| `label`       | Optional; `type-meta` (tertiary when `disabled`)          |
| `description` | Optional helper under the label                           |
| `error`       | Optional; red alert text + `aria-invalid` on the control  |
| `disabled`    | Dims label/description; disables the control              |
| `className`   | Outer stack                                               |
| …input props  | Standard `value`, `onChange`, `type`, `placeholder`, etc. |

Control states live on `Input` (used by `InputField`): inset 1px outline `stroke-primary`, disabled fill `surface-primary`, error outline `stroke-error`, focus outline `stroke-active`.

```tsx
<InputField
  label="Password"
  type="password"
  value={credential}
  onChange={(event) => setCredential(event.target.value)}
  placeholder="Enter your credential"
  autoComplete="current-password"
  error={error ?? undefined}
/>
```

Do not use placeholder as the only label.

### Menu

ESDS Menu: vertical list of rows with a built-in Plus icon and label. No outer border; `stroke-secondary` dividers only between rows. `MenuItem` is not exported — pass rows through `items`.

| Prop        | Notes                                                              |
| ----------- | ------------------------------------------------------------------ |
| `items`     | `{ label, disabled?, className?, onClick? }[]` — one row per entry |
| `className` | Merged onto the menu container (`min-w-40`, stretch column)        |

States per row: default (`surface-always-white`) → hover / focus (`surface-secondary`) → disabled (`text-disabled`, icon inherits). Padding `p-margin-tight`, gap `gap-detail-next`. Focus uses an inset ring (no offset) so it stays clear of row dividers.

```tsx
<Menu
  className="w-40"
  items={[
    { label: "Menu item", onClick: ... },
    { label: "Unavailable", disabled: true },
  ]}
/>
```

### TabList

ESDS Tab: underline tabs in a horizontal row. `TabItem` is not exported — pass rows through `options`.

| Prop        | Notes                                                 |
| ----------- | ----------------------------------------------------- |
| `label`     | Accessible name for the `tablist`                     |
| `value`     | Currently selected option value                       |
| `options`   | `{ value, label, disabled?, iconStart?, iconEnd? }[]` |
| `onChange`  | Called with the selected value                        |
| `className` | Merged onto the list container                        |

States per tab: active (`stroke-active` / `text-primary`) → hover (`stroke-primary`) → inactive (`stroke-secondary` / `text-tertiary`) → disabled (`text-disabled`, no underline). Padding `p-detail-next`, optional 16px icon slots, `type-body`.

```tsx
<TabList
  label="Section"
  value={tab}
  options={[
    { value: "one", label: "Overview" },
    { value: "two", label: "Details" },
    { value: "three", label: "Unavailable", disabled: true },
  ]}
  onChange={setTab}
/>
```

### ToggleTabs

ESDS Toggle Tabs: equal-width segments on a `surface-secondary` track (`p-detail-tight`, `gap-detail-next`, `rounded-loose`). Prefer this for compact binary/segmented controls. `ToggleTabItem` is not exported — pass segments through `options`.

| Prop        | Notes                                                                 |
| ----------- | --------------------------------------------------------------------- |
| `label`     | Accessible name for the `tablist`                                     |
| `value`     | Currently selected option value                                       |
| `options`   | `{ value, label, disabled? }[]` — typically two segments              |
| `onChange`  | Called with the selected value                                        |
| `className` | Merged onto the track (set width when equal flex segments need a box) |

Selected: `surface-inverse` / `text-inverse`, 44px tall, `type-body`. Idle: transparent with `stroke-secondary` border / `text-primary` (border blends into the track).

```tsx
<ToggleTabs
  className="w-[170px]"
  label="View"
  value={view}
  options={[
    { value: "left", label: "List" },
    { value: "right", label: "Grid" },
  ]}
  onChange={setView}
/>
```

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

| Figma (`esds.radius.*`) | Utility         | Value |
| ----------------------- | --------------- | ----- |
| sharp                   | `rounded-sharp` | 0     |
| tight                   | `rounded-tight` | 2px   |
| loose                   | `rounded-loose` | 4px   |
| soft                    | `rounded-soft`  | 8px   |
| full                    | `rounded-full`  | 999px |

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
