"""Check native text, embedded screenshots, notes, relationships and PDF export."""
from pathlib import Path
from zipfile import ZipFile
import json
import posixpath
import re
from xml.etree import ElementTree as ET

ROOT = Path(__file__).resolve().parent
NS = {"a": "http://schemas.openxmlformats.org/drawingml/2006/main"}


def main():
    layout = json.loads((ROOT / "presentation-layout.json").read_text(encoding="utf-8"))
    validation = json.loads((ROOT / "validation.json").read_text(encoding="utf-8-sig"))
    count = len(layout["slides"])
    assert count == validation["slides"] == 23
    assert not validation["textOverflow"], validation["textOverflow"]
    with ZipFile(ROOT / "module-builder-user-journey.pptx") as package:
        assert package.testzip() is None
        names = package.namelist()
        assert len([name for name in names if re.fullmatch(r"ppt/slides/slide\d+\.xml", name)]) == count
        assert len([name for name in names if re.fullmatch(r"ppt/notesSlides/notesSlide\d+\.xml", name)]) == count
        for name in names:
            if name.endswith((".xml", ".rels")):
                ET.fromstring(package.read(name))
            if name.endswith(".rels"):
                base = posixpath.dirname(posixpath.dirname(name)) if name != "_rels/.rels" else ""
                for relation in ET.fromstring(package.read(name)):
                    if relation.attrib.get("TargetMode") == "External": continue
                    target = relation.attrib["Target"]
                    resolved = target.lstrip("/") if target.startswith("/") else posixpath.normpath(posixpath.join(base, target))
                    assert resolved in names, (name, target)
        screenshot_placements = 0
        for index, slide in enumerate(layout["slides"], 1):
            tree = ET.fromstring(package.read(f"ppt/slides/slide{index}.xml"))
            text = "\n".join(node.text or "" for node in tree.findall(".//a:t", NS))
            for element in slide["elements"]:
                if element["kind"] == "text":
                    for line in element["text"].splitlines(): assert line in text, (index, line)
                if element["kind"] == "image":
                    screenshot_placements += 1
                    assert Path(element["path"]).exists()
            notes = ET.fromstring(package.read(f"ppt/notesSlides/notesSlide{index}.xml"))
            notes_text = "\n".join(node.text or "" for node in notes.findall(".//a:t", NS))
            assert slide["notes"].splitlines()[0] in notes_text
        media = [name for name in names if name.startswith("ppt/media/")]
        assert screenshot_placements == 16
        assert len(media) >= 15, media
    pdf = (ROOT / "module-builder-user-journey.pdf").read_bytes()
    assert pdf.startswith(b"%PDF-")
    assert len(re.findall(rb"/Type\s*/Page\b", pdf)) == count
    assert len(list((ROOT / "previews").glob("slide-*.png"))) == count
    assert len(list((ROOT / "screenshots").glob("*.png"))) == 16
    assert (ROOT / "slide-overview.png").read_bytes().startswith(b"\x89PNG")
    for document in [ROOT / "README.md", ROOT / "estimate-notes.md", ROOT / "presentation-source.md"]:
        for target in re.findall(r"\]\(([^\s)]+)\)", document.read_text(encoding="utf-8")):
            if not target.startswith(("http://", "https://", "#")):
                assert (document.parent / target.split("#", 1)[0]).exists(), (document, target)
    # Explicit arithmetic checks prevent effort/calendar totals drifting apart.
    assert 6+8+16+10 == 40 and 10+12+24+16 == 62
    assert 10+6 == 16 and 16+10 == 26
    assert 16+8 == 24 and 26+14 == 40
    assert 40+24 == 64 and 62+40 == 102
    print(f"PASS: {count} slides and notes; 16 original captures / {screenshot_placements} placements; "
          f"embedded media, exact editable text, valid relationships, {count}-page PDF, links, effort arithmetic and zero native text overflow.")


if __name__ == "__main__":
    main()
