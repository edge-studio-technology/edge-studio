"""Author slide content and produce editable-layout JSON plus a readable outline."""
from pathlib import Path
import json
import struct

ROOT = Path(__file__).resolve().parent
BG, INK, PURPLE, MUTED, WHITE = "F6F5FA", "201A35", "7544D3", "625E70", "FFFFFF"
TEAL, LINE = "087F75", "E1DDEB"

slides = []

def shot(title, image, step, focus, points, takeaway, notes=""):
    slides.append(dict(kind="screenshot", title=title, image=image, step=step,
                       focus=focus, points=points, takeaway=takeaway, notes=notes))

slides.append(dict(kind="cover", title="Module Builder", subtitle="From an unsupported sensor to a shareable capability",
    points=["A local creation journey", "A separate hosted ecosystem"], image="01-local-workspace",
    takeaway="User journey, delivery phases, milestones and planning estimates · 28 October 2026",
    notes="Stakeholder walkthrough based on the revised workshop decisions. Every UI image is a fresh capture from the frontend demo. The extension runtime, backup/restore, hosted library and commerce are not implemented. Estimates are planning hypotheses, not commitments."))

slides.append(dict(kind="journey", title="One package. Two delivery phases.",
    subtitle="The local builder delivers value before the public library exists.",
    cards=[("PHASE 1 · LOCAL", "Create and use", "Template → own AI harness → edit → preview/test → validate/package → back up → activate → export/import"),
           ("PHASE 2 · HOSTED", "Share and discover", "Prepare → automated checks → publish → community inspection/reputation → discover → install")],
    takeaway="No module CLI. No built-in AI generation service. Local use does not require publication.",
    notes="AI generation is expected in the user's own harness, guided by a planned module-builder-skill. Code editing and the module tools are in the app. Automated acceptance checks run BEFORE publication; initial human spam/content moderation occurs AFTER publication. The second card is a conceptual list, not a reversal of that ordering."))

shot("01 / Start in your local workspace", "01-local-workspace", "PHASE 1 · DISCOVER YOUR LOCAL CAPABILITIES",
     "Installed modules and local drafts",
     [("One place to manage", "See installed capabilities, drafts, manual updates and recent activity."),
      ("Choose your next step", "Create from a template or import a module from another instance."),
      ("Local first", "Creation and local activation need no publisher account or hosted library.")],
     "A missing capability can become a local project instead of a core-team feature request.")
shot("02 / Choose what the module contributes", "02-template-selection", "PHASE 1 · CREATE",
     "A useful starting point",
     [("Three contribution surfaces", "Start with a workflow block, device integration or hardware capability."),
      ("Reduce boilerplate", "Templates provide an example manifest, source, configuration schema and documentation."),
      ("Keep the contract clear", "Modules integrate through defined contracts; arbitrary code is not automatically a device.")],
     "Template authors and driver developers can use the same package model.")
shot("03 / Generate in your own AI harness", "03-ai-harness-handoff", "PHASE 1 · AUTHOR WITH YOUR TOOLS",
     "The module-builder-skill hand-off",
     [("Bring the contract to the AI", "Use our planned skill and template in the harness you already work with."),
      ("Bring code back to the app", "Paste or import generated source, then edit and check it locally."),
      ("A deliberate product boundary", "We provide the module journey without building an AI coding harness or CLI.")],
     "The downloadable skill in this screenshot is illustrative, not a released developer contract.")
shot("04 / Edit code with the outcome in view", "04-edit-and-preview", "PHASE 1 · EDIT",
     "Source, configuration and preview",
     [("Code editing stays in the app", "Inspect files and make changes after the external generation step."),
      ("Configuration is a schema", "Forms, guides and wizard steps use common rendering contracts."),
      ("Scope stays focused", "Arbitrary custom views and block editors wait for a concrete required example.")],
     "The code editor supports module work; it is not a commitment to a full IDE.")
shot("05 / Preview device setup", "05-device-schema-preview", "PHASE 1 · PREVIEW THE USER EXPERIENCE",
     "A schema becomes a setup experience",
     [("Preview before activation", "See the fields and guidance an operator would encounter when adding a device."),
      ("Keep the UI consistent", "Modules contribute configuration and instructions to the existing app experience."),
      ("Separate preview from execution", "A visual preview is not proof that a sensor, driver or host action works.")],
     "The demo renders a fixed example; real hardware acceptance belongs in the implementation.")
shot("06 / Preview a hardware capability", "06-hardware-preview", "PHASE 1 · DECLARE HOST BEHAVIOR",
     "Hardware support is a module contribution",
     [("Declare lifecycle actions", "Hardware packages need setup, enable/disable, status and cleanup behavior."),
      ("Full host access is intentional", "A privileged extension is trusted host software, not sandboxed code."),
      ("Show the operational outcome", "Explain prerequisites, failures, reboot needs and what uninstall can leave behind.")],
     "Process supervision manages operation; it does not contain malicious root code.")
shot("07 / Test, validate and package a revision", "07-validated-package", "PHASE 1 · PREPARE A RELEASE",
     "A visible preparation sequence",
     [("Try sample inputs", "Preview representative outputs and inspect logs before activation."),
      ("Validate package structure", "Check metadata, configuration and entry points; deeper implementation checks follow the runtime contract."),
      ("Package the exact revision", "Code or metadata changes invalidate preparation and require a fresh package.")],
     "The demo performs JSON/entry checks and exports a snapshot; it never compiles or executes code.")
shot("08 / Back up before changing the device", "08-backup-before-activation", "PHASE 1 · USER-DIRECTED RECOVERY",
     "Device export plus diagnostic logs",
     [("Prompt before execution", "Offer device and log exports before install/update hooks or local activation."),
      ("Restore managed state", "The planned app-wide device backup must have a tested restore path."),
      ("Be precise about coverage", "Logs are diagnostic. App backups do not universally undo OS, firmware or hardware changes.")],
     "These demo downloads are explicitly non-restorable samples; the production skip policy remains open.")
shot("09 / Activate locally and retain control", "09-local-activation", "PHASE 1 · USE AND MAINTAIN",
     "Installed is different from active",
     [("Activate explicitly", "A library installation first adds an inactive package; the operator chooses when to activate."),
      ("Keep lifecycle actions manual", "Enable, disable and update through clear user actions."),
      ("Preserve useful state", "Removal retains device/workflow configuration and history unless deletion is explicitly requested.")],
     "The local builder remains usable with no production library connection.")
shot("10 / Share directly between instances", "10-local-import-export", "PHASE 1 · EXPORT / IMPORT",
     "A package is not a device backup",
     [("Export source or a package", "Prepare a shareable module without exporting configured credentials or device history."),
      ("Import on another instance", "Prove author independence without publishing or changing core source."),
      ("Keep three artifacts distinct", "Source, installable packages and complete device backups serve different purposes.")],
     "Demo source/package JSON snapshots round-trip locally; production package formats are still to be defined.")
shot("11 / Discover a module in the hosted library", "14-library-discovery", "PHASE 2 · DISCOVER",
     "A public ecosystem around local packages",
     [("Find capabilities", "Search by module and contribution type rather than waiting for a core release."),
      ("Understand the publisher", "Publisher profiles, module ratings, aggregate builder ratings and downloads provide context."),
      ("Retain operator choice", "Inspect a release and its requested access before adding it to the device.")],
     "Ratings and download counts describe popularity and experience; they do not certify safety.")
shot("12 / Inspect the exact release source", "13-release-source", "PHASE 2 · INSPECT BEFORE INSTALLING",
     "Published source and community inspection",
     [("Inspect a versioned snapshot", "The published release remains unchanged when an author later edits a local draft."),
      ("Review dependencies and access", "Read the manifest, source and release notes; provenance must match the installed artifact."),
      ("Separate the signals", "Inspection reports are distinct from ratings and verified-purchase reviews.")],
     "Seeded source is illustrative; this newly published example captures the actual demo draft text.")
shot("13 / Publish after automated acceptance checks", "11-publishing-checks", "PHASE 2 · PUBLISH",
     "No human approval gate",
     [("Package first", "Publication uses a prepared revision plus metadata and documentation."),
      ("Run acceptance checks", "Automated checks precede publication; exact production rules still need definition."),
      ("Acknowledge the contents", "The author confirms their right to share; this is not a manual reviewer approval.")],
     "AI-assisted checks are an option to evaluate, not an implemented safety guarantee.")
shot("14 / Community feedback after publication", "12-community-listing", "PHASE 2 · MODERATE AND LEARN",
     "Immediate listing, later content moderation",
     [("Initial rollout", "Human moderation after publication filters spam and inappropriate uploads."),
      ("Long-term operating model", "Community-managed inspection, reports and moderation supported by automation."),
      ("Separate service ownership", "The web library is maintained separately from community module creation.")],
     "Named moderation owners, removal rules and transition criteria still need agreement.")
shot("15 / Paid official distribution, inspectable source", "15-paid-module-concept", "PHASE 2 · COMMERCIAL OPTION",
     "Entitlements without strong copy protection",
     [("Inspect before purchasing", "Source remains inspectable; publisher identity and release provenance matter."),
      ("Use installed versions offline", "The direction supports local entitlements without continuous license-server access."),
      ("Commerce is part of Phase 2", "Paid distribution is required. Pricing, provider, subscription and redistribution/fork policies still need definition.")],
     "This is a simulated purchase. No money, checkout service or verified receipt is involved.")

slides.append(dict(kind="phases", title="Delivery: local value first, hosted services second", subtitle="The phase boundary is agreed. The public service is not a prerequisite for local use.",
    cards=[("PHASE 1", "M1 → M2 → M3", "Lifecycle proof\nDefault-capability parity\nIndependent local authoring proof"),
           ("PHASE 2", "M4", "Hosted catalog and publishing\nSource inspection and reputation\nModeration and required commerce")],
    takeaway="The Phase 1 demo library is a lifecycle-test fixture, not the production publishing service.",
    notes="App-wide device/log export and tested restore are an enabling dependency for D7. M3 may begin once M1 contracts are usable and run alongside migration, but calendar estimates below conservatively avoid assuming free parallel capacity."))

slides.append(dict(kind="assumptions", title="How to read the development estimates", subtitle="Bottom-up planning ranges based on scope; low confidence until the first lifecycle slice works.",
    cards=[("CAPACITY", "Two full-time engineers", "One backend/runtime/hardware focus; one frontend/tools focus. Part-time QA/hardware and infrastructure support available."),
           ("MEASUREMENT", "Effort, then elapsed time", "One engineer-week is five focused workdays. Raw elapsed weeks = effort ÷ 2. Scheduling envelopes add about 20% for interruptions/integration."),
           ("INCLUDED", "Delivery, not just code", "Engineering review, automated tests, docs, integration and representative Pi acceptance are included in effort. The current frontend demo is reused."),
           ("EXCLUDED", "Separate budgets and scope", "No fully featured IDE, in-app AI harness, module CLI, arbitrary custom UI, universal hardware qualification or managed automatic rollback. Ongoing library operations are separate.")],
    takeaway="No start date, staffing commitment or budget is implied. Re-estimate after M1.",
    notes="These are original engineering judgments, not the workshop's ordinal resource scores or industry benchmarks. Two engineers are an explicit assumption pending stakeholder confirmation. QA/infrastructure availability is assumed, not counted as a zero-cost service; their separate staffing/cost is not estimated here. AI usage is not assigned an unsupported productivity multiplier."))

slides.append(dict(kind="table", title="Phase 1 estimates: prove local extensibility", subtitle="Engineering effort includes testing and integration; elapsed ranges assume two dedicated engineers.",
    headers=["Milestone / enabling work", "Engineer-weeks", "Raw elapsed", "Acceptance evidence"],
    rows=[("App-wide backup/restore prerequisite", "6–10", "3–5 weeks", "Export managed state + logs; restore on a test device."),
          ("M1 · Contracts + lifecycle slice", "8–12", "4–6 weeks", "HTTP/Fetch removal, real demo download, activation and restart."),
          ("M2 · Default capability parity", "16–24", "8–12 weeks", "Hardware/devices/blocks extracted; Pi parity and missing states."),
          ("M3 · Local authoring proof", "10–16", "5–8 weeks", "New sensor/block from another author; package and install elsewhere.")],
    takeaway="Phase 1 total: 40–62 engineer-weeks · 20–31 raw weeks · about 24–38 scheduled weeks.",
    notes="M1 covers capability inventory, contracts, local storage/installer/supervisor foundation and one vertical slice. M2 covers hardware supervisor migration, device registries, workflow dispatch, legacy-ID/state migration and parity/failure tests. M3 covers editing, templates, skill guidance, schema previews, test/log tooling, packaging/import/export and independent-author acceptance. Backup/restore is app-wide work, not a module-specific replacement. If delivered by another team, subtract its 6–10 engineer-weeks from this team's Phase 1 effort but retain the integration dependency. No overlap is subtracted from this total."))

slides.append(dict(kind="table", title="Phase 2 estimates: library and commerce", subtitle="All three M4 work packages are included in the Phase 2 baseline.",
    headers=["M4 work package", "Engineer-weeks", "Raw elapsed", "Acceptance evidence"],
    rows=[("M4a · Hosting + self-service publishing", "10–16", "5–8 weeks", "Accounts, immutable artifacts, checks, listings and app delivery."),
          ("M4b · Reputation + community tools", "6–10", "3–5 weeks", "Ratings, builder aggregates, counters, inspection and report flows."),
          ("M4c · Required commerce", "8–14", "4–7 weeks", "Checkout, contributor payouts, refunds and offline entitlement."),
          ("M4 total · Includes commerce", "24–40", "12–20 weeks", "Publish, inspect, buy, install and continue installed-version use offline.")],
    takeaway="Phase 2 total: 24–40 engineer-weeks · 12–20 raw weeks · about 15–24 scheduled weeks.",
    notes="M4a includes production-service setup, backups/monitoring and app-library integration, but not continuous operation after launch. M4b includes implementing post-publication moderation/reporting tools, not indefinite reviewer staffing. M4c commerce is REQUIRED in Phase 2. Its estimate assumes one established payment provider, a simple purchase model and agreed policies. Subscriptions, strict copy enforcement, multi-provider payments, hosted builds and automated AI review pipelines are not included. Legal/accounting policy, payment-provider approval and commercial terms are unestimated dependencies, not hidden zero-cost work."))

slides.append(dict(kind="summary", title="A planning envelope, not a promised launch date", subtitle="Conservative sequential arithmetic; no unsupported overlap or AI productivity discount.",
    cards=[("PHASE 1 · LOCAL BUILDER", "40–62 engineer-weeks", "Includes device export/restore prerequisite. Two engineers: about 24–38 scheduled weeks."),
           ("PHASE 2 · LIBRARY + COMMERCE", "24–40 engineer-weeks", "Includes checkout, contributor payouts and offline entitlements. Two engineers: about 15–24 scheduled weeks.")],
    takeaway="Both phases: 64–102 engineer-weeks · 32–51 raw weeks · about 39–62 scheduled weeks.",
    notes="Totals include the app-wide backup/restore prerequisite. Ranges are sums of milestone ranges, not calibrated statistical confidence intervals. They are not fixed commitments or monetary quotes. Reuse of existing backup work or scope reductions can reduce effort; unknown hardware/migration requirements can increase it. Sustainable operating staffing is separate from development effort."))

slides.append(dict(kind="decisions", title="Validate the first slice before committing the full build", subtitle="The next estimate should be grounded in implementation evidence, not a closer radar polygon.",
    cards=[("PROVE", "M1 acceptance", "Remove → download → install inactive → activate → restart. Preserve existing configuration/history and expose missing-module states."),
           ("RESOLVE", "Cross-app dependencies", "App-wide support policy, export/restore coverage and recovery route, module/runtime contracts and named owners."),
           ("DECIDE", "Phase 2 implementation policies", "Commerce is required. Define provider/purchase terms, redistribution policy, publication checks and moderation ownership.")],
    takeaway="Proposed checkpoint: review M1 evidence, re-estimate M2–M4, then confirm the next funding/staffing step.",
    notes="No funding, staffing or delivery-date commitment is implied by this deck. D1–D7 directions have qualifications; D8, detailed purchase/provider terms, checks/ownership and the backup skip policy remain open. Commerce is required within Phase 2. The source plan and workshop revision are the current references, not the older stakeholder deck."))


def png_dimensions(path):
    with path.open("rb") as image:
        image.seek(16)
        return struct.unpack(">II", image.read(8))


def layout(data, number):
    elements = []
    dark = data["kind"] == "cover"
    foreground, secondary = (WHITE, "D0C7E5") if dark else (INK, MUTED)
    def rect(x, y, w, h, fill, border=None):
        elements.append(dict(kind="rect", x=x, y=y, w=w, h=h, fill=fill, border=border))
    def text(value, x, y, w, h, size=20, bold=False, color=None):
        elements.append(dict(kind="text", text=value, x=x, y=y, w=w, h=h, size=size, bold=bold, color=color or foreground))
    def picture(name, x, y, w, h):
        filename = ROOT / "screenshots" / f"{name}.png"
        pw, ph = png_dimensions(filename)
        scale = min(w / pw, h / ph)
        iw, ih = pw * scale, ph * scale
        rect(x, y, w, h, WHITE, LINE)
        elements.append(dict(kind="image", path=str(filename), x=x+(w-iw)/2, y=y+(h-ih)/2, w=iw, h=ih, source=f"screenshots/{name}.png"))
    rect(40, 27, 12, 12, PURPLE if not dark else "B99CF3")
    text("EDGE STUDIO  /  MODULE BUILDER", 65, 24, 900, 25, 12, True, secondary)
    text(f"{number:02d} / {len(slides):02d}", 1150, 24, 90, 25, 12, color=secondary)
    rect(40, 665, 1200, 1, "55476D" if dark else LINE)
    text(data["takeaway"], 40, 678, 1200, 28, 14, True, "C8B1F5" if dark else TEAL)
    if dark:
        text(data["title"], 40, 95, 620, 90, 68, True)
        text(data["subtitle"], 42, 206, 570, 130, 34, color=secondary)
        for i, value in enumerate(data["points"]):
            text(value, 44, 390+i*58, 530, 45, 25, True, "C8B1F5")
        picture(data["image"], 650, 140, 590, 410)
        text("Frontend concept screenshots · Implementation not started", 650, 570, 590, 45, 15, color=secondary)
    else:
        text(data["title"], 40, 69, 1200, 75, 38, True)
        if data.get("subtitle"):
            text(data["subtitle"], 42, 145, 1195, 47, 19, color=secondary)
        kind = data["kind"]
        if kind == "screenshot":
            text(data["step"], 43, 147, 1195, 24, 13, True, PURPLE)
            picture(data["image"], 40, 190, 830, 440)
            text("Focus: " + data["focus"], 900, 189, 340, 75, 23, True)
            for i, (label, body) in enumerate(data["points"]):
                y = 284+i*117
                text(label, 900, y, 340, 29, 19, True, PURPLE)
                text(body, 900, y+32, 340, 81, 18, color=secondary)
            text("Captured from the demo frontend; explanatory text is editable.", 42, 636, 830, 21, 11, color=secondary)
        elif kind == "table":
            widths = [388, 168, 164, 480]
            starts = [40, 428, 596, 760]
            rect(40, 212, 1200, 52, INK)
            for i, label in enumerate(data["headers"]):
                text(label, starts[i]+14, 226, widths[i]-28, 32, 17, True, WHITE)
            for row, values in enumerate(data["rows"]):
                y = 264+row*87
                rect(40, y, 1200, 85, WHITE if row % 2 == 0 else "EEEBF5")
                for i, value in enumerate(values):
                    text(value, starts[i]+14, y+15, widths[i]-28, 63, 18 if i == 3 else 20, i < 3, secondary if i == 3 else INK)
        else:
            cards = data["cards"]
            count = len(cards)
            if count == 4:
                positions = [(40, 216, 585, 199), (655, 216, 585, 199), (40, 438, 585, 199), (655, 438, 585, 199)]
            else:
                width = (1200-(count-1)*24)/count
                positions = [(40+i*(width+24), 227, width, 390) for i in range(count)]
            for (tag, title, body), (x, y, w, h) in zip(cards, positions):
                rect(x, y, w, h, WHITE, LINE)
                text(tag, x+22, y+21, w-44, 26, 13, True, PURPLE)
                text(title, x+22, y+60, w-44, 79 if count != 4 else 42, 29 if count != 4 else 24, True)
                by = y+(159 if count != 4 else 111)
                text(body, x+22, by, w-44, y+h-by-22, 23 if count == 2 else 19, color=secondary)
    notes = f"Slide {number}: {data['title']}\n\n"
    if data.get("image"):
        notes += f"Screenshot: screenshots/{data['image']}.png. Original demo capture; no generated UI artwork.\n\n"
    if data.get("points") and data["kind"] == "screenshot":
        notes += "\n".join(f"{label}: {body}" for label, body in data["points"]) + "\n\n"
    notes += data.get("notes", "All interactions shown are simulated frontend concepts. No real module code, host change, payment or device restore occurs.")
    return dict(background=INK if dark else BG, elements=elements, notes=notes)


if __name__ == "__main__":
    prepared = [layout(data, i) for i, data in enumerate(slides, 1)]
    (ROOT / "presentation-layout.json").write_text(json.dumps(dict(width=1280, height=720, slides=prepared), indent=2), encoding="utf-8")
    outline = ["# Module Builder user journey and delivery estimates", "", "Prepared 2026-10-28. Content source: prepare-presentation.py. All screenshots are from the demo; estimates are planning hypotheses.", ""]
    for i, data in enumerate(slides, 1):
        outline.extend([f"## {i:02d}. {data['title']}", ""])
        if data.get("subtitle"): outline.extend([data["subtitle"], ""])
        if data.get("image"): outline.extend([f"![Demo screenshot](./screenshots/{data['image']}.png)", ""])
        if data["kind"] == "screenshot":
            outline.extend([f"Focus: {data['focus']}", ""] + [f"- **{label}:** {body}" for label, body in data["points"]] + [""])
        for card in data.get("cards", []): outline.extend([f"- **{card[0]} / {card[1]}:** {card[2].replace(chr(10), '; ')}", ""])
        if data.get("rows"):
            outline.extend(["| " + " | ".join(data["headers"]) + " |", "| " + " | ".join(["---"]*4) + " |"] + ["| " + " | ".join(row) + " |" for row in data["rows"]] + [""])
        outline.extend([f"**Takeaway:** {data['takeaway']}", "", "Speaker notes:", "", prepared[i-1]["notes"], ""])
    (ROOT / "presentation-source.md").write_text("\n".join(outline), encoding="utf-8")
    print(f"Prepared {len(slides)} slides with embedded screenshot layout and speaker notes.")
