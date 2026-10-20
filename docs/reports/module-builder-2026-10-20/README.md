# Module Builder stakeholder presentation

Prepared on 2026-10-20 for a mixed stakeholder audience. The proposal is not implemented; presentation milestones group the implementation plan's steps and do not commit dates, staffing, or budget.

- [Editable PowerPoint](./module-builder-stakeholders.pptx): 18 main slides and 4 optional appendix slides; native editable text/shapes, speaker notes, and research references.
- [PDF](./module-builder-stakeholders.pdf): convenient read-only sharing copy.
- [Slide overview](./slide-overview.png): rendered contact sheet.
- [Markdown source and speaker notes](./stakeholder-brief.md).
- [Implementation plan](../../plans/module-builder.md).
- [Discussion and alternatives](../../plans/module-builder/discussion.md).

## Rebuild

Requires Python 3 (standard library only), Windows PowerShell, and installed desktop Microsoft PowerPoint. The build uses PowerPoint automation without opening a presentation window. It closes only its own presentation and does not quit PowerPoint when other presentations remain open.

From the repository root:

```powershell
python docs/reports/module-builder-2026-10-20/prepare-presentation.py
powershell.exe -NoProfile -ExecutionPolicy Bypass -File docs/reports/module-builder-2026-10-20/build-presentation.ps1
python docs/reports/module-builder-2026-10-20/validate-presentation.py
```

Edit the Markdown source first. The Python preparation step parses slide headings, metadata, cards, notes, and sources into layout data. The PowerShell build creates the PowerPoint, exports the PDF and slide previews, and checks native text heights. Generated intermediate files and individual previews are ignored; the final PowerPoint, PDF, and overview are retained.

The native text check detects overflow beyond text boxes; visual inspection still matters for typography, slide hierarchy, and spacing. This report is presentation material, not evidence that Module Builder has been implemented or passed hardware acceptance tests.
