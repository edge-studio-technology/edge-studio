"""Prepare editable PowerPoint layout data from stakeholder-brief.md; no dependencies."""

from pathlib import Path
import json
import re


ROOT = Path(__file__).resolve().parent
PAPER = "F4F3ED"
INK = "142D3A"
MUTED = "536873"
TEAL = "087F75"
MINT = "CDEBDC"
ORANGE = "FFB372"
WHITE = "FFFFFF"
LINE = "DCE1DC"


def parse_slides():
    source = (ROOT / "stakeholder-brief.md").read_text(encoding="utf-8")
    slides = []
    for match in re.finditer(r"^## (\d+) \| (.+)\n([\s\S]*?)(?=^## \d+ \||\Z)", source, re.M):
        number, title, section = match.groups()
        data = {"number": int(number), "title": title, "cards": []}
        for key in ("Layout", "Kicker", "Subtitle", "Takeaway"):
            data[key.lower()] = re.search(rf"^{key}: (.+)$", section, re.M).group(1)
        for card in re.finditer(r"^### (.+)\n([\s\S]*?)(?=^### |^Notes:|\Z)", section, re.M):
            heading, body = card.groups()
            data["cards"].append({"title": heading, "body": body.strip()})
        notes = re.search(r"^Notes: ([\s\S]*)", section, re.M).group(1).strip()
        data["notes"] = f"Slide {number}: {title}\n\n{notes}"
        slides.append(data)
    assert len(slides) == 22, f"Expected 22 slides, got {len(slides)}"
    return slides


def layout(slide):
    dark = slide["layout"] in ("cover", "trust", "closing")
    background, foreground = (INK, WHITE) if dark else (PAPER, INK)
    secondary = "C6D4D7" if dark else MUTED
    elements = []

    def rect(x, y, w, h, fill, border=None, rounded=False, dashed=False):
        elements.append(dict(kind="rect", x=x, y=y, w=w, h=h, fill=fill,
                             border=border, rounded=rounded, dashed=dashed))

    def text(value, x, y, w, h, size=18, color=None, bold=False, link=None):
        elements.append(dict(kind="text", text=value, x=x, y=y, w=w, h=h,
                             size=size, color=color or foreground, bold=bold, link=link))

    def arrow(x1, y1, x2, y2):
        elements.append(dict(kind="line", x1=x1, y1=y1, x2=x2, y2=y2, color=TEAL))

    def card(item, x, y, w, h, index, fill=None, compact=False, dashed=False):
        card_fill = fill or ("203D4B" if dark else WHITE)
        rect(x, y, w, h, card_fill, None if dark else LINE, True, dashed)
        rect(x + 18, y + 18, 26, 4, ORANGE if dark else TEAL)
        title_h = 57 if w < 290 else 48
        title_size = 20 if w < 300 else 22
        text(item["title"], x + 18, y + 35, w - 36, title_h, title_size, bold=True)
        body_y = y + 35 + title_h + 9
        text(item["body"], x + 18, body_y, w - 36, y + h - 17 - body_y,
             16.5 if compact else 18, secondary)

    rect(52, 29, 14, 14, ORANGE if dark else TEAL)
    text(slide["kicker"], 76, 28, 720, 22, 10.5, secondary, True)
    text("EDGE STUDIO", 810, 28, 98, 22, 10.5, secondary, True)

    footer_y = 489
    rect(52, footer_y - 12, 856, 1, "42606D" if dark else LINE)
    text(slide["takeaway"], 52, footer_y, 790, 32, 15, MINT if dark else TEAL, True)
    text(f"{slide['number']:02d} / 22", 854, footer_y + 1, 60, 23, 10.5, secondary)

    kind, cards = slide["layout"], slide["cards"]
    if kind in ("cover", "closing"):
        text(slide["title"], 52, 104, 856, 76, 58 if kind == "cover" else 42, bold=True)
        text(slide["subtitle"], 54, 192, 810, 74, 28, secondary)
        for i, item in enumerate(cards):
            card(item, 52 + i * 438, 300, 418, 157, i, compact=True)
        return dict(background=background, elements=elements, notes=slide["notes"])

    title_size = 34 if len(slide["title"]) < 62 else 32
    text(slide["title"], 52, 79, 856, 87, title_size, bold=True)
    text(slide["subtitle"], 52, 172, 850, 55, 18.5, secondary)

    if kind == "architecture":
        rect(52, 237, 856, 68, INK, rounded=True)
        text(cards[0]["title"], 70, 247, 820, 27, 21, WHITE, True)
        text(cards[0]["body"], 70, 278, 820, 23, 13.5, "C6D4D7")
        for i, item in enumerate(cards[1:]):
            x = 52 + i * 292
            arrow(x + 136, 309, x + 136, 333)
            rect(x, 342, 272, 119, WHITE, LINE, True)
            text(item["title"], x + 18, 353, 236, 46, 18, bold=True)
            text(item["body"], x + 18, 403, 236, 50, 13.5, MUTED)
    elif kind == "milestone":
        for i, item in enumerate(cards):
            x = 52 + i * 174
            rect(x, 242, 160, 218, MINT if i == 4 else WHITE, LINE, True)
            text(f"0{i+1}", x + 15, 260, 130, 42, 29, TEAL, True)
            text(item["title"].split(" / ", 1)[-1], x + 15, 315, 130, 35, 20, bold=True)
            text(item["body"], x + 15, 359, 130, 86, 16, MUTED)
            if i < 4:
                text("›", x + 161, 327, 13, 32, 22, TEAL, True)
    elif kind in ("journey", "roadmap"):
        for i, item in enumerate(cards):
            x = 52 + i * 219
            card(item, x, 241, 199, 219, i, fill="FFF0E1" if i == 3 and kind == "roadmap" else None,
                 compact=True, dashed=i == 3 and kind == "roadmap")
            if i < 3:
                text("›", x + 202, 331, 17, 30, 24, TEAL, True)
    elif kind == "sources":
        y = 235
        for i, item in enumerate(cards):
            h = 69 if i != 2 else 85
            rect(52, y, 856, h, WHITE, LINE, True)
            text(item["title"], 68, y + 9, 825, 25, 17, bold=True)
            text(item["body"], 68, y + 37, 825, h - 38, 11.5, MUTED)
            y += h + 8
    else:
        count = len(cards)
        gap = 20
        width = (856 - gap * (count - 1)) / count
        for i, item in enumerate(cards):
            card(item, 52 + i * (width + gap), 240, width, 220, i,
                 fill=MINT if kind == "package" and i == 1 else None,
                 compact=kind in ("split", "decision", "options", "migration"))

    return dict(background=background, elements=elements, notes=slide["notes"])


if __name__ == "__main__":
    slides = parse_slides()
    deck = {"title": "Module Builder | Edge Studio", "width": 960, "height": 540,
            "slides": [layout(s) for s in slides]}
    for index, slide in enumerate(deck["slides"], 1):
        for e in slide["elements"]:
            if e["kind"] != "line":
                assert e["w"] > 0 and e["h"] > 0, (index, e)
                assert e["x"] >= 0 and e["y"] >= 0, (index, e)
                assert e["x"] + e["w"] <= 960 and e["y"] + e["h"] <= 540, (index, e)
    destination = ROOT / "presentation-layout.json"
    destination.write_text(json.dumps(deck, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"Prepared {len(slides)} slides from stakeholder-brief.md; layout geometry passed.")
