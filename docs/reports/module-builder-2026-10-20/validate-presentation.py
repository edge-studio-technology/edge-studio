"""Validate presentation structure, content, and build checks without dependencies."""

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
    assert validation["slides"] == 22
    assert not validation["textOverflow"], validation["textOverflow"]

    with ZipFile(ROOT / "module-builder-stakeholders.pptx") as package:
        assert package.testzip() is None
        slides = [p for p in package.namelist() if re.fullmatch(r"ppt/slides/slide\d+\.xml", p)]
        notes = [p for p in package.namelist() if re.fullmatch(r"ppt/notesSlides/notesSlide\d+\.xml", p)]
        assert len(slides) == len(notes) == 22
        for name in package.namelist():
            if name.endswith((".xml", ".rels")):
                ET.fromstring(package.read(name))
            if name.endswith(".rels"):
                relationships = ET.fromstring(package.read(name))
                base = posixpath.dirname(posixpath.dirname(name)) if name != "_rels/.rels" else ""
                for relationship in relationships:
                    if relationship.attrib.get("TargetMode") == "External":
                        continue
                    target = relationship.attrib["Target"]
                    resolved = target.lstrip("/") if target.startswith("/") else posixpath.normpath(posixpath.join(base, target))
                    assert resolved in package.namelist(), (name, target)
        for index, slide in enumerate(layout["slides"], 1):
            root = ET.fromstring(package.read(f"ppt/slides/slide{index}.xml"))
            actual = "\n".join(n.text or "" for n in root.findall(".//a:t", NS))
            for element in slide["elements"]:
                if element["kind"] == "text":
                    for line in element["text"].splitlines():
                        assert line in actual, (index, line)
            root = ET.fromstring(package.read(f"ppt/notesSlides/notesSlide{index}.xml"))
            actual_notes = "\n".join(n.text or "" for n in root.findall(".//a:t", NS))
            assert slide["notes"].splitlines()[0] in actual_notes, index
            for url in re.findall(r"https://\S+", slide["notes"]):
                assert url in actual_notes, (index, url)

    pdf = (ROOT / "module-builder-stakeholders.pdf").read_bytes()
    assert pdf.startswith(b"%PDF-")
    pdf_pages = len(re.findall(rb"/Type\s*/Page\b", pdf))
    assert pdf_pages == 22, pdf_pages
    previews = list((ROOT / "previews").glob("slide-*.png"))
    assert len(previews) == 22
    assert (ROOT / "slide-overview.png").read_bytes().startswith(b"\x89PNG")

    for document in (ROOT / "stakeholder-brief.md", ROOT / "README.md",
                     ROOT.parents[1] / "plans/module-builder/discussion.md",
                     ROOT.parents[1] / "plans/module-builder.md"):
        for target in re.findall(r"\]\(([^\s)]+)\)", document.read_text(encoding="utf-8")):
            if not target.startswith(("https://", "http://", "#")):
                assert (document.parent / target.split("#", 1)[0]).exists(), (document, target)

    print("PASS: 22 slides, 22 speaker notes, exact slide text, source URLs, valid XML/ZIP, "
          "22-page PDF, 22 previews, document links, and zero native text overflow.")


if __name__ == "__main__":
    main()
