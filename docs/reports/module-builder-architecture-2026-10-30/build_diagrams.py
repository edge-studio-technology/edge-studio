"""Render the architecture review's original diagrams. Requires Pillow; no network calls."""
from pathlib import Path
import hashlib
import json
import math
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent
OUT = ROOT / "diagrams"
W, H = 2600, 1600
INK, MUTED, BG = "#172C43", "#53677C", "#F5F7FB"
PALETTE = {
    "business": ("#FFF1C8", "#B07C16"),
    "app": ("#E4EFFD", "#3B70B7"),
    "tech": ("#DFF2E8", "#318364"),
    "data": ("#EEE8FA", "#8061B0"),
    "risk": ("#FFF0DC", "#B9751D"),
    "neutral": ("#E9EEF4", "#687C92"),
}
FONTS = [Path("C:/Windows/Fonts/segoeui.ttf"), Path("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf")]
REG = next((p for p in FONTS if p.exists()), None)
if REG is None:
    raise RuntimeError("Install Segoe UI or DejaVu Sans before rendering")
BOLD = REG.with_name("segoeuib.ttf" if REG.name == "segoeui.ttf" else "DejaVuSans-Bold.ttf")


def font(size, bold=False):
    return ImageFont.truetype(str(BOLD if bold else REG), size)


class Diagram:
    def __init__(self, number, title, subtitle, state, legend, refs):
        self.number, self.title = number, title
        self.img = Image.new("RGB", (W, H), BG)
        self.d = ImageDraw.Draw(self.img)
        self.boxes, self.edges, self.checks = {}, [], []
        self.d.rectangle((0, 0, W, 16), fill="#176E89")
        self.txt((100, 55), f"EDGE STUDIO  /  MODULE BUILDER  /  {number:02}", 27, True, MUTED)
        self.txt((100, 108), title, 60, True)
        self.txt((100, 190), subtitle, 31, False, MUTED)
        self.txt((100, 252), state, 27, True, "#176E89")
        self.legend, self.refs = legend, refs

    def txt(self, xy, text, size=30, bold=False, colour=INK):
        f = font(size, bold)
        bounds = self.d.textbbox(xy, text, font=f)
        if bounds[0] < 0 or bounds[1] < 0 or bounds[2] > W or bounds[3] > H:
            raise ValueError(f"Canvas overflow: {text}")
        self.d.text(xy, text, font=f, fill=colour)
        return bounds

    def wrapped(self, text, width, size=30, bold=False):
        f, lines = font(size, bold), []
        for paragraph in text.split("\n"):
            line = ""
            for word in paragraph.split():
                candidate = f"{line} {word}".strip()
                if self.d.textlength(candidate, font=f) > width:
                    if not line:
                        raise ValueError(f"Word exceeds width: {word}")
                    lines.append(line)
                    line = word
                else:
                    line = candidate
            lines.append(line)
        return lines

    def card(self, key, x, y, w, h, title, body, kind="app", tag="", size=30):
        fill, stroke = PALETTE[kind]
        self.d.rounded_rectangle((x, y, x+w, y+h), radius=18, fill=fill, outline=stroke, width=2)
        self.d.rounded_rectangle((x, y, x+9, y+h), radius=4, fill=stroke)
        yy = y+18
        if tag:
            self.txt((x+28, yy), tag.upper(), 22, True, stroke)
            yy += 35
        for line in self.wrapped(title, w-56, 34, True):
            self.txt((x+28, yy), line, 34, True)
            yy += 43
        yy += 9
        for line in self.wrapped(body, w-56, size):
            self.txt((x+28, yy), line, size)
            yy += size+10
        if yy > y+h-10:
            raise ValueError(f"Card overflow {self.number}/{key}: {yy} > {y+h-10}")
        self.boxes[key] = (x, y, w, h)
        self.checks.append({"id": key, "text_bottom": yy, "box_bottom": y+h})

    def grid(self, rows, headers=None, h=245, ys=(350, 700, 1050)):
        if headers:
            for x, header in zip((100, 925, 1750), headers):
                self.txt((x+3, 307), header, 26, True, MUTED)
        for r, row in enumerate(rows):
            for c, spec in enumerate(row):
                key, title, body, kind, tag = spec
                self.card(key, (100, 925, 1750)[c], ys[r], 750, h, title, body, kind, tag)

    def edge(self, a, b, label="", relation="flow", side="vertical"):
        ax, ay, aw, ah = self.boxes[a]
        bx, by, bw, bh = self.boxes[b]
        if side == "vertical":
            start, end = (ax+aw/2, ay+ah), (bx+bw/2, by)
            if by < ay:
                start, end = (ax+aw/2, ay), (bx+bw/2, by+bh)
        else:
            start, end = (ax+aw, ay+ah/2), (bx, by+bh/2)
        route = None
        if side == "elbow":
            midx = (start[0]+end[0])/2
            route = [start, (midx,start[1]), (midx,end[1]), end]
        self.edges.append((a, b, label, relation, start, end, route))

    def draw_edge(self, edge):
        a, b, label, relation, start, end, route = edge
        dx, dy = end[0]-start[0], end[1]-start[1]
        if route:
            dx,dy = end[0]-route[-2][0], end[1]-route[-2][1]
        length = math.hypot(dx, dy)
        ux, uy = dx/length, dy/length
        colour = "#61778E"
        if relation == "realization":
            for at in range(0, int(length-18), 20):
                to = min(at+10, length-18)
                self.d.line((start[0]+ux*at, start[1]+uy*at, start[0]+ux*to, start[1]+uy*to), fill=colour, width=3)
        else:
            self.d.line(route if route else [start,end], fill=colour, width=3)
        if relation != "association":
            left = (end[0]-ux*19-uy*9, end[1]-uy*19+ux*9)
            right = (end[0]-ux*19+uy*9, end[1]-uy*19-ux*9)
            if relation == "realization":
                self.d.polygon((end, left, right), fill=BG, outline=colour, width=3)
            else:
                self.d.line((*left, *end, *right), fill=colour, width=3)
        if label:
            tw = self.d.textlength(label, font=font(24, True))
            cx, cy = (start[0]+end[0])/2, (start[1]+end[1])/2
            self.d.rounded_rectangle((cx-tw/2-12, cy-20, cx+tw/2+12, cy+20), radius=6, fill=BG)
            self.txt((cx-tw/2, cy-18), label, 24, True, MUTED)

    def finish(self, filename, note):
        for e in self.edges:
            self.draw_edge(e)
        self.d.rounded_rectangle((100, 1380, 2500, 1492), radius=14, fill="#E8EEF5")
        lines = self.wrapped(note, 2330, 28)
        if len(lines) > 2:
            raise ValueError("Note overflow")
        for i, line in enumerate(lines):
            self.txt((130, 1395+i*39), line, 28)
        self.txt((100, 1510), self.legend, 23, False, MUTED)
        self.txt((100, 1550), self.refs, 22, False, MUTED)
        path = OUT / filename
        self.img.save(path, dpi=(180, 180))
        return {"file": filename, "title": self.title, "size": [W, H], "sha256": hashlib.sha256(path.read_bytes()).hexdigest(), "text_fit_checks": len(self.checks), "edges": len(self.edges)}


def render():
    OUT.mkdir(exist_ok=True)
    inventory = []
    d = Diagram(1, "Current state: capabilities ship with the app", "Baseline repository review — the module demo does not implement an extension platform.", "CURRENT STATE  |  2026-10-30  |  Not a live Pi audit", "Notation: logical components and labelled information/control arrows; not a formal ArchiMate model.", "Evidence: PRD §1; Compose; ADR 0019; device templates; automation.service.ts; SECURITY.md. See HLD §3.")
    d.grid([
        [("ui", "Browser UI", "React device/setup choices, workflow canvas and generic administration.", "app", "Application"), ("agent", "Fixed-action host agent", "Root host service; Camera, GPIO, I2C Sensors and Local MQTT actions.", "tech", "Host"), ("demo", "Module Builder concept", "Frontend simulation of journeys; imported sample code stays inert.", "neutral", "Demo only")],
        [("api", "Backend API", "Express / TypeScript; compiled device logic and named workflow dispatch.", "app", "Application"), ("hardware", "Helpers and hardware", "Camera / I2C helpers; GPIO device access; optional MQTT broker.", "tech", "Host / device"), ("services", "Existing integrations", "Minima RPC / wallet; external Integritas stamping; app update-agent.", "app", "Retained services")],
        [("db", "Persistent state", "SQLite under /data; device and workflow configuration, history and credentials.", "data", "Local data"), ("gap", "Extraction gap", "No completed dynamic-package inventory or all-default lifecycle proof.", "risk", "Target work"), ("backup", "Recovery gap", "Minima backup and demo exports do not prove app-wide managed-state restore.", "risk", "Prerequisite")]
    ], ["APP PATH", "HOST PATH", "CONTEXT AND LIMITS"])
    d.edge("ui", "api", "authenticated API")
    d.edge("api", "db", "read / persist")
    d.edge("agent", "hardware", "fixed setup actions")
    d.edge("api", "hardware", side="horizontal")
    inventory.append(d.finish("01-current-state.png", "Baseline trust model: fixed host actions. Target privileged-module execution is a deliberate future replacement requiring security and rule updates."))

    d = Diagram(2, "Target: layered responsibilities and services", "Three extension surfaces, a permanent local core, and required hosted commerce in Phase 2.", "TARGET STATE  |  Logical responsibilities; not selected deployment units", "ArchiMate subset: typed elements; dashed hollow triangle = realization; solid open arrow = serving. Arrows point to consumers/abstractions.", "Sources: PRD FR-01–42; Cookbook §§2.3, 2.9, 3–4. Full normative relationship validation remains open. See HLD §4–5.")
    xs, ys = (100, 925, 1750), (335, 535, 735, 935, 1135)
    columns = [
        [("r1", "Operator / authors", "Local administration and creation", "business", "Business role"), ("s1", "Local module service", "Inspect, prepare and manage modules", "app", "Application service"), ("c1", "Edge Studio core", "Lifecycle, registry, state, generic UI", "app", "Application component"), ("t1", "Local execution / storage", "Supervision; persistent state", "tech", "Technology service"), ("n1", "Supported Pi platform", "App-wide support policy: OQ-02", "tech", "Node")],
        [("r2", "Publisher / member / buyer", "Release, inspect, report and buy", "business", "Business role"), ("s2", "Library / commerce service", "Discovery, delivery and money flows", "app", "Application service"), ("c2", "Hosted library platform", "Identity, releases, reputation, rights", "app", "Application component"), ("t2", "Hosted compute / storage", "Hosting and service targets: open", "tech", "Technology service"), ("n2", "Hosted platform", "Provider / topology: unselected", "tech", "Node")],
        [("r3", "Operator / module user", "Use devices and workflow blocks", "business", "Business role"), ("s3", "Contributed capability", "Hardware, device/setup, workflow", "app", "Application service"), ("c3", "Installed module release", "Immutable source / artifact identity", "app", "Application component"), ("t3", "Privileged host execution", "Full access; supervision is no sandbox", "tech", "Technology service"), ("n3", "Supported Pi host", "Hardware, OS, helpers, runtime", "tech", "Node")],
    ]
    for x, col in zip(xs, columns):
        for y, (k,t,b,c,tag) in zip(ys,col):
            d.card(k,x,y,750,165,t,b,c,tag,size=28)
    for i in range(1,4):
        d.edge(f"s{i}", f"r{i}", relation="serving")
        d.edge(f"c{i}", f"s{i}", relation="realization")
        d.edge(f"t{i}", f"c{i}", relation="serving")
        d.edge(f"n{i}", f"t{i}", relation="realization")
    inventory.append(d.finish("02-target-layered.png", "Phase 1 local authoring and installed operation need no public account or hosted library. Phase 2 adds hosted services; installed paid versions continue offline."))

    d = Diagram(3, "Transition: release gates carry the scope", "Evidence gates define completion; no dates or estimates are implied.", "TARGET ROADMAP  |  Phase 1 = backup + M1 + M2 + M3  |  Phase 2 = M4a + M4b + M4c", "Notation: cards are required evidence gates; arrows show prerequisites; plain line links required proofs. No calendar duration implied.", "Sources: PRD §§4.9, 8–9; Cookbook §2.2.5; Agile EA Playbook §3.2. See HLD §8.")
    d.grid([
        [("b", "Backup prerequisite", "Restore agreed managed state; protect credentials; document exclusions and repair.", "risk", "Before reliance"), ("m2", "M2 · Default parity", "Every existing choice assigned; every default removable/reinstallable; zero extensions work.", "app", "Phase 1"), ("m4a", "M4a · Publish / discover", "Independent publication; automated checks; immutable source; post-publication moderation.", "app", "Phase 2")],
        [("m1", "M1 · HTTP lifecycle slice", "HTTP JSON Source / Fetch: actual catalog bytes, retained usage and explicit activation.", "app", "Phase 1"), ("m3", "M3 · Independent author", "New physical device + new block; second supported Pi; real reading and successful run.", "app", "Phase 1 release gate"), ("m4b", "M4b · Inspect / reputation", "Exact-release reports, vote replacement, weighted builder score and download policy.", "app", "Phase 2")],
        [("oq1", "Foundation holds", "OQ-01 backup; OQ-02 support matrix; OQ-03 contracts, artifacts and build path.", "risk", "Unresolved"), ("p1", "Phase 1 completion", "Requires backup, M1, M2 and M3. Authoring may proceed alongside migration after M1 contracts.", "business", "No demo substitute"), ("m4c", "M4c · Required commerce", "Real purchase, payout/refund, duplicate-event safety and offline paid-module run.", "business", "Phase 2 release gate")]
    ], ["FOUNDATION", "LOCAL COMPLETION", "HOSTED COMPLETION"])
    d.edge("b", "m1", "restore proof")
    d.edge("m2", "m3", "both required", relation="association")
    d.edge("m3", "p1", "all local gates")
    d.edge("m4a", "m4b", "identity / releases")
    d.edge("m4b", "m4c", "all hosted gates")
    inventory.append(d.finish("03-transition-roadmap.png", "M4a/M4b alone do not complete Phase 2. OQ-04–09 hold dependent hosted policies, commercial rights, ownership, licensing and website-to-app handoff."))

    d = Diagram(4, "Target local components and interfaces", "Logical responsibility boundaries — compatible new types use registry-driven rendering and dispatch.", "TARGET PHASE 1  |  Existing backend business ownership retained", "Notation: arrows label control/data interfaces; boxes are logical responsibilities, not separate processes or formal ArchiMate elements.", "Sources: PRD FR-01–24; implementation plan (proposed boundaries). Contract details: LLD §2–3.")
    d.grid([
        [("ui", "C1 · Browser administration", "My Modules, generic device/setup forms, canvas and recovery controls. Calls C2 APIs.", "app", "Interface I1"), ("life", "C2 · Lifecycle manager", "Authenticated mutations; inert inspection; install/update; operation reconciliation.", "app", "Core"), ("host", "C4 · Host supervision", "Acknowledged runtime/setup/test invocation; status, health and cancellation.", "tech", "Privileged boundary")],
        [("author", "C6 · Authoring / preparation", "Edit source/schema; revision evidence and app-driven packaging. Prepared material goes to C2.", "app", "Interface I2"), ("reg", "C3 · Contribution registry", "Resolve hardware/device/block contracts; missing state; pin versions for runs.", "app", "Core"), ("mod", "P1 · Package contributions", "Hardware controls; device descriptors; executable workflow handlers.", "app", "Interface I5")],
        [("cat", "X1 · Separate catalog", "Sends actual versioned artifact bytes to C2's installer. No public account in Phase 1.", "app", "Interface I3"), ("state", "C5 · State and recovery", "Persistent releases, instances, history, operation records and app-wide restore.", "data", "Interface I4"), ("io", "Host / hardware / services", "Helpers and device I/O; module dependencies; core Wallet / Integritas services.", "tech", "Interface I6")]
    ], ["CLIENTS AND INPUTS TO C2", "LOCAL CORE", "EXECUTION / EXTERNAL"])
    for a,b,l in [("life","reg","selected release"),("reg","state","resolve / persist"),("host","mod","selected entry point"),("mod","io","device / service I/O")]:
        d.edge(a,b,l)
    d.edge("ui", "life", side="horizontal")
    d.edge("life", "host", side="horizontal")
    d.edge("reg", "mod", side="horizontal")
    inventory.append(d.finish("04-local-components.png", "I1–I6 identify logical interfaces only. Wire protocols, schemas, paths, timeouts and runtime bindings are open; the catalog never directly dispatches host code."))

    d = Diagram(5, "Data: immutable versions, retained instances", "Logical associations; fields, SQL tables, cardinalities and hosted database are not selected.", "TARGET INFORMATION MODEL  |  Local and hosted authorities separated", "Notation: undirected lines = conceptual associations, not flows; no unselected cardinalities implied. Lavender = data.", "Sources: PRD FR-03/06/07/10–13/23/26–40; Cookbook §§2.6–2.7. See LLD §4.")
    d.grid([
        [("draft", "Local · Draft + evidence", "Editable revision; validation and tests link to that revision. Old evidence stays revision-specific.", "data", "Authoring"), ("pub", "Hosted · Publisher / module", "Stable account identity and authorized ownership; separate from local admin.", "data", "Library authority"), ("buyer", "Hosted · Purchase / rights", "Buyer, publisher, module, release/rights, amount and actual payment outcome.", "data", "Commerce authority")],
        [("rel", "Local · Release / selection", "Immutable artifact/source association; installation, activation and dependency references.", "data", "Local authority"), ("hrel", "Hosted · Release / source", "Immutable version; metadata/source; availability and moderation can change.", "data", "Library authority"), ("money", "Hosted · Financial outcomes", "Provider event, entitlement, payout and refund links; duplicate effects prevented.", "data", "Commerce authority")],
        [("inst", "Local · Instances / runs", "Device/workflow IDs, credentials, module state, history, operation acknowledgements.", "data", "Retained by default"), ("rating", "Hosted · Community evidence", "One member vote/module; exact-release reports; defined download events.", "data", "Service-side totals"), ("offline", "Local · Installed rights", "Sufficient purchase-right evidence for offline operation; encoding remains open.", "data", "No continuous check")]
    ], ["LOCAL STATE", "HOSTED LIBRARY STATE", "COMMERCE / LOCAL CONTINUITY"])
    for a,b in [("draft","rel"),("rel","inst"),("pub","hrel"),("hrel","rating"),("buyer","money"),("money","offline")]:
        d.edge(a,b,relation="association")
    d.edge("rel", "hrel", relation="association", side="horizontal")
    d.edge("hrel", "money", relation="association", side="horizontal")
    inventory.append(d.finish("05-data-model.png", "Sharing a module omits configured instances and credentials by default. Export device is a separate restorable managed-state backup; Export logs is diagnostic evidence."))

    d = Diagram(6, "Lifecycle: installation is one state dimension", "Preserve the distinctions users must understand before enabling executable contributions.", "TARGET PHASE 1 + RETAINED PHASE 2  |  Explicit manual lifecycle", "Notation: arrows label preparation or state transition direction; rows distinguish independent state dimensions, not one linear state machine.", "Sources: PRD terms and FR-05–14/21–24/39. Guards and interruption semantics: LLD §5–7.")
    d.grid([
        [("draft", "Draft revision", "Editable source, metadata and schemas. Tests and preparation apply to this revision.", "app", "Authoring"), ("inspect", "Inspect / validate / preview", "Download, import, source and fixture/schema preview are inert: no package code.", "app", "Execution boundary"), ("installed", "Installed release", "Verified release present. Approved setup may have run; contributions are not yet active.", "app", "Package state")],
        [("release", "Packaged release", "Immutable snapshot. New draft edits require new preparation and a new changed release version.", "data", "Authoring"), ("consent", "Acknowledge execution", "Explain full host access; offer device/log exports where required; cancel runs no code.", "risk", "Mandatory guard"), ("active", "Explicitly active", "Operator enables installed contributions; required compatibility and dependencies checked.", "app", "Contribution state")],
        [("retained", "Disable / remove", "Retain saved IDs, configuration, history and module state; unavailable references stay visible.", "data", "Default preservation"), ("hardware", "Hardware enabled", "Separate start/enable state. Setup may be incomplete or need reboot; report truthfully.", "tech", "Capability state"), ("device", "Configured device", "Separate saved instance; installing/activating alone never creates it. Reuse preserved instances.", "app", "Instance state")]
    ], ["SOURCE / PRESERVATION", "EXECUTION GUARDS / HARDWARE", "INSTALL / ACTIVATE / CONFIGURE"])
    d.edge("draft","release","prepare snapshot")
    d.edge("inspect","consent","before any code")
    d.edge("installed","active","explicit activation")
    inventory.append(d.finish("06-lifecycle.png", "Execution consent applies to executable setup, tests and runtime actions. Exact consent scope and backup-skip policy remain open. Paid installed operation has no license heartbeat."))

    d = Diagram(7, "Install flow: verify, acknowledge, execute, reconcile", "An ordered engineering activity view; activation remains a separate operator action.", "TARGET LOCAL INSTALLER  |  Also reused for Phase 2 downloads", "Notation: numbered ordered steps; arrows show activity direction. Separate columns show intake, execution and interruption handling.", "Sources: PRD FR-03/05/07–14/19/23–24 and §4.10. See LLD §6–7; crash protocol remains G-04.")
    d.grid([
        [("one", "1 · Receive inert material", "Import or fetch actual bytes. Classify source versus artifact; incomplete bytes stay incomplete.", "app", "No package execution"), ("four", "4 · Persist operation / consent", "Record selected identity/version, action and acknowledgement before executable dispatch.", "data", "Durable operation"), ("seven", "7 · Explicit activation", "Recheck dependencies; register contributions. Hardware enable and device creation stay separate.", "app", "Separate action")],
        [("two", "2 · Validate before execution", "Safe archive paths, integrity, identity, schema, runtime/API/target and dependencies.", "app", "Reject without active change"), ("five", "5 · Execute approved setup", "Supervisor invokes selected code; progress, partial effects, failure/reboot are reported.", "tech", "Privileged code"), ("restart", "Restart / lost response", "Observe persisted intent and actual work; reconcile. Partial files never prove success.", "risk", "At any executable step")],
        [("three", "3 · Explain / offer backup", "Show effective host access; Export device and Export logs. Cancel means no code runs.", "risk", "Skip policy OQ-01"), ("six", "6 · Record installation result", "Installed is distinct from active. Failed/incomplete/uncertain work remains truthful.", "data", "No inferred success"), ("recover", "Recovery / uncertainty", "Preserve active selection and saved state as applicable; no blind replay of irreversible effects.", "risk", "No automatic rollback")]
    ], ["INERT INTAKE AND GUARDS", "ACKNOWLEDGED EXECUTION", "ACTIVATION AND FAILURE BRANCH"])
    for a,b,l in [("one","two","inspect bytes"),("two","three","checks pass"),("four","five","dispatch"),("five","six","observe outcome"),("restart","recover","reconcile / report")]: d.edge(a,b,l)
    d.edge("three", "four", side="elbow")
    d.edge("six", "seven", side="elbow")
    inventory.append(d.finish("07-install-flow.png", "Normal order is 1 → 2 → 3 → 4 → 5 → 6, then separate action 7. Cancel/rejection executes nothing. Restart and unknown side effects require observation, not automatic replay."))

    d = Diagram(8, "Deployment: baseline hosts and target additions", "Physical baseline is evidenced; target storage/transport/hosting bindings remain open.", "CURRENT DEPLOYMENT + SEPARATELY LABELLED TARGET ADDITIONS", "Notation: boxes identify deployment or trust zones; labelled arrows show exchanges. Zone separation does not sandbox privileged module code.", "Sources: Compose; backend Dockerfile; ADR 0019; PRD FR-02–14/19/26–41. See HLD §7.")
    d.grid([
        [("browser", "CURRENT · Browser / LAN", "HTTPS frontend defaults to host :8080 → :443. Browser uses backend API via frontend.", "tech", "Local boundary"), ("host", "CURRENT · Pi host", "Root fixed-action agent :38182; camera :38180 and sensor :38181 helpers; hardware.", "tech", "Host boundary"), ("external", "CURRENT · External services", "Integritas API; Minima peer network. Modules may have their own external services.", "tech", "Network boundary")],
        [("compose", "CURRENT · Pi Compose", "Frontend, non-root backend :3000, Minima; optional MQTT and update-agent profiles.", "tech", "Container network"), ("target", "TARGET P1 · Host runtime", "Extension-aware supervision and privileged module code replace fixed dispatch deliberately.", "risk", "Full host access"), ("fixture", "TARGET P1 · Local catalog", "Separate hosted fixture serves actual artifacts; no installed-directory sharing or public login.", "tech", "Separate test service")],
        [("storage", "CURRENT + TARGET · Storage", "Current /data SQLite and state; target adds durable drafts/releases/evidence/module state.", "data", "Persistent / paths open"), ("cloud", "TARGET P2 · Hosted platform", "Library identity, source/artifacts, reports, reputation and commerce; topology unselected.", "tech", "Hosted boundary"), ("pay", "TARGET P2 · Payment provider", "Checkout, verified outcomes, payouts/refunds; provider, markets and terms open.", "tech", "External financial boundary")]
    ], ["LOCAL APP DEPLOYMENT", "HOST / HOSTED CHANGES", "SEPARATE EXTERNAL DEPLOYMENTS"])
    d.edge("browser","compose","HTTPS / API")
    d.edge("compose","storage","read / persist")
    d.edge("host","target","planned replacement")
    d.edge("compose","target",side="horizontal")
    d.edge("cloud","pay",side="horizontal")
    inventory.append(d.finish("08-deployment.png", "Existing Docker-socket access is material privilege exposure. Host-file browsing remains read-only; target privileged modules can access host/application secrets. No cloud topology is selected."))

    d = Diagram(9, "Commerce online; installed operation offline", "Hosted paid delivery must feed the same local package path, with truthful transaction outcomes.", "TARGET PHASE 2  |  Commerce is required for completion", "Notation: arrows indicate messages/evidence or local preparation flow; columns distinguish publisher, hosted commerce and local operation.", "Sources: PRD FR-26–42 / M4a–c. Detailed invariants: LLD §10–11. OQ-04–09 remain unresolved.")
    d.grid([
        [("pub", "Publisher submits release", "Stable authorized identity; immutable artifact plus matching inspectable source and metadata.", "business", "Publication"), ("buyer", "Buyer inspects / checks out", "Exact release and price/rights; paid source-access terms and provider selected in OQ-06.", "business", "Online action"), ("download", "Official entitled download", "Confirmed rights enable actual artifact delivery; purchase/download never runs device code.", "app", "Online action")],
        [("check", "Automated checks / listing", "Useful rejection; no mandatory human pre-approval. Reports and moderation after publication.", "app", "Hosted library"), ("payment", "Verify actual money outcome", "Success, decline, cancellation, pending or uncertain; no entitlement from browser claims.", "app", "Provider / service"), ("install", "Local inspect / install / activate", "Authenticated Phase 1 path; access/backup guard; explicit installation and activation.", "app", "Local administration")],
        [("rep", "Service-side reputation", "Replace vote; weighted builder scores; defined download events. Popularity is not safety.", "data", "Hosted evidence"), ("payout", "Payout / refund / reconciliation", "Traceable outcomes. Duplicate callbacks and retries have one financial/rights effect.", "data", "Required real evidence"), ("offline", "Installed paid module runs", "No continuous library/license checks. Disclose any module-specific external service dependency.", "tech", "Offline continuity")]
    ], ["PUBLICATION / COMMUNITY", "BUYER / FINANCIAL OUTCOMES", "DEVICE DELIVERY / EXECUTION"])
    d.edge("pub","check","accept / reject")
    d.edge("buyer","payment","checkout outcome")
    d.edge("payment","payout","trace / reconcile")
    d.edge("download","install","verified bytes")
    d.edge("install","offline","installed valid rights")
    d.edge("payment","download",side="elbow")
    inventory.append(d.finish("09-hosted-commerce.png", "OQ-06 holds fees, tax/compliance, source access, post-refund, update and re-download rights. Inspectable source does not choose a license or promise DRM; OQ-07 remains open."))

    d = Diagram(10, "Runtime data flows: input, effect, evidence", "Package delivery and deployment are separate views; this view follows configured local use.", "TARGET DATA FLOWS  |  Phase 1 and installed Phase 2 modules", "Notation: solid open arrows = labelled payload/control transfer, not ArchiMate serving. Data objects are lavender; services blue.", "Sources: PRD FR-02/07/10–18/33/39. Runtime and data contracts: LLD §3–4/6–7; HLD §5–6.")
    d.grid([
        [("inputs", "Device / protocol input", "Physical readings/events, camera capture, HTTP JSON and MQTT data as applicable.", "tech", "F1 · External input"), ("handler", "Selected module handlers", "Read/event/capture/output or block execution; validate settings/inputs; retain run version.", "app", "F2 · Executable processing"), ("core", "Core service interfaces", "Wallet / Integritas services can remain core while their blocks become package contributions.", "app", "F3 · Service invocation")],
        [("refs", "Saved device / workflow", "Identity, config and contribution references. Missing required contributions block execution.", "data", "F4 · Configuration"), ("context", "Core dispatch / run context", "Resolve registered contributions; scheduler and canvas/watch/replay stay in core.", "app", "F5 · Control flow"), ("external", "Minima / Integritas", "Existing RPC wallet and external stamping/proof exchanges preserve current semantics.", "tech", "F6 · External effect")],
        [("payload", "Payload / media / hash", "Handler results include relevant readings, capture references, previews and hashes.", "data", "F7 · Runtime result"), ("history", "Retained state / history", "Record results, run versions, config and redacted diagnostics; store media references as applicable.", "data", "F8 · Evidence"), ("exports", "Device backup / logs", "Export device: agreed restorable managed state. Export logs: diagnostic evidence only.", "data", "F9 · User-directed export")]
    ], ["INPUTS AND OUTPUT MATERIAL", "LOCAL PROCESSING AND EVIDENCE", "SERVICES AND EXPORTS"])
    d.edge("inputs","handler",side="horizontal")
    d.edge("handler","core",side="horizontal")
    d.edge("refs","context",side="horizontal")
    d.edge("context","handler","selected contribution")
    d.edge("core","external","service request / result")
    d.edge("context","history","run / operation records")
    d.edge("payload","history",side="horizontal")
    d.edge("history","exports",side="horizontal")
    inventory.append(d.finish("10-runtime-data-flows.png", "App-managed diagnostics redact known secrets. Privileged modules can bypass app policies and read host/app secrets; arrows are functional flows, not security confinement."))

    (ROOT / "diagram-inventory.json").write_text(json.dumps({"renderer": "Pillow", "font": REG.name, "diagrams": inventory}, indent=2)+"\n", encoding="utf-8")
    sheet = Image.new("RGB", (1560, math.ceil(len(inventory)/3)*320), BG)
    for index, item in enumerate(inventory):
        with Image.open(OUT / item["file"]) as im:
            sheet.paste(im.resize((520, 320), Image.Resampling.LANCZOS), ((index % 3)*520, (index//3)*320))
    sheet.save(OUT / "overview.png")
    print(f"Rendered {len(inventory)} diagrams; {sum(i['text_fit_checks'] for i in inventory)} cards passed text-fit checks.")


if __name__ == "__main__":
    render()
