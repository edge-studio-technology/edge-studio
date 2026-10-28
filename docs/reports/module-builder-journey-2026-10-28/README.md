# Module Builder user journey and delivery estimates

Prepared 2026-10-28 from the workshop-revised proposal and the current frontend demo. The presentation distinguishes implemented demo interactions from planned production functionality. It does not record implementation approval, a fixed delivery date, or a cost commitment.

- [PowerPoint](./module-builder-user-journey.pptx): 23 slides with embedded demo screenshots, editable explanations/tables and speaker notes.
- [Exported PDF](./module-builder-user-journey.pdf).
- [Slide overview](./slide-overview.png).
- [Slide content, captions and notes](./presentation-source.md).
- [Estimate basis, milestone breakdown and exclusions](./estimate-notes.md).
- [Implementation plan](../../plans/module-builder.md) and [workshop revision](../../plans/module-builder/workshop-revision.md).
- [Demo walkthrough](../module-builder-demo/README.md).

Slides 3–17 showcase the user journey: local workspace, templates, external AI harness/skill, in-app editing, device/hardware previews, validation/packaging, backup prompts, activation, local sharing, hosted discovery, source inspection, publishing, moderation and a paid-module concept. Slides 18–23 cover delivery phases, staffing/estimate assumptions, milestone effort and acceptance criteria, aggregate scheduling envelopes and the next decision checkpoint.

## Estimates

The explicit baseline is two full-time engineers plus available part-time QA/hardware and infrastructure support. Phase 1 including app-wide export/restore is estimated at 40–62 engineer-weeks; Phase 2 including required commerce at 24–40; both phases total 64–102. Commerce is included in the Phase 2 baseline, confirmed 2026-10-28. See the estimate notes for raw elapsed calculations, approximately 20% scheduling allowance, uncertainty, dependencies and exclusions. These are provisional engineering judgments; they are not derived from workshop radar levels. No monetary estimate is provided.

## Screenshots

The 16 PNG files under `screenshots/` are fresh captures from the real demo frontend, including dialog/region captures where that improves readability. No UI imagery was generated. Only screenshot placement/scaling occurs in PowerPoint; annotations and explanations are native editable text. Production code execution, full backups, restore, payments and hosted publication are not demonstrated as working implementations.

## Rebuild

Requires Node.js 22+, Python 3 (standard library), Windows PowerShell, Chrome and installed desktop PowerPoint. Run from the repository root. Screenshot capture and PowerPoint automation use hidden windows and should be run with the appropriate local tool approval. The build closes only its own presentation and never closes the user's other presentations.

```powershell
npm --prefix frontend run dev -- --host 127.0.0.1 --port 3042 --strictPort
```

In a second terminal:

```powershell
node docs/reports/module-builder-journey-2026-10-28/capture-demo.mjs
python docs/reports/module-builder-journey-2026-10-28/prepare-presentation.py
powershell.exe -NoProfile -ExecutionPolicy Bypass -File docs/reports/module-builder-journey-2026-10-28/build-presentation.ps1
python docs/reports/module-builder-journey-2026-10-28/validate-presentation.py
```

Edit the content definitions in `prepare-presentation.py`, then regenerate the readable Markdown outline and layout. The PowerShell build creates native editable shapes/text and embeds screenshot images, exports the PDF and slide previews, and measures text overflow. Layout data, validation output, individual slide previews, Chrome capture state and Office lock files are ignored; final artifacts, screenshots, content and reproducible scripts are retained.

## Verification

Fresh hidden-Chrome capture produced 16 screenshots with zero runtime errors or backend API requests. PowerPoint exported 23 slides and a 23-page PDF. Validation checked native slide text, 23 speaker notes, embedded screenshots, internal package relationships, PDF page count, local document links, estimate arithmetic and zero native text overflow. The rendered overview was visually inspected. The staffing basis is explicit and provisional; it was not confirmed as a resource commitment.
