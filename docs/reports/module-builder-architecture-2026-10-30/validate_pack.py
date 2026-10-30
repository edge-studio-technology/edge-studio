"""Validate this report's links, coverage structure, source fingerprints and PNG artifacts."""
from pathlib import Path
from urllib.parse import unquote
import hashlib
import json
import re
from PIL import Image

ROOT = Path(__file__).resolve().parent
REPO = ROOT.parents[2]


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def validate():
    errors, links = [], 0
    for doc in ROOT.glob("*.md"):
        text = doc.read_text(encoding="utf-8")
        for target in re.findall(r"\]\((<[^>]+>|[^\s)]+)\)", text):
            target = target.strip("<>")
            if re.match(r"[a-z]+:", target):
                continue
            path = unquote(target.split("#")[0])
            if path and not (doc.parent / path).exists():
                errors.append(f"Broken link {doc.name}: {target}")
            links += 1
        if re.search(r"(?m)^\s*(<<<<<<<|=======|>>>>>>>)", text):
            errors.append(f"Conflict marker in {doc.name}")
        if any(line.rstrip() != line for line in text.splitlines()):
            errors.append(f"Trailing whitespace in {doc.name}")
    trace = (ROOT / "traceability.md").read_text(encoding="utf-8")
    frs = re.findall(r"(?m)^\| FR-(\d\d) \|", trace)
    if frs != [f"{i:02}" for i in range(1, 43)]:
        errors.append("FR rows missing, duplicated or out of order")
    gaps = (ROOT / "decisions-and-gaps.md").read_text(encoding="utf-8")
    oqs = re.findall(r"(?m)^\| OQ-(\d\d) \|", gaps)
    if oqs != [f"{i:02}" for i in range(1, 10)]:
        errors.append("OQ rows missing, duplicated or out of order")
    for prefix, numbers in [("US-", [f"{i:02}" for i in range(1, 13)]), ("#", [str(i) for i in range(1081, 1099)])]:
        for number in numbers:
            if f"{prefix}{number}" not in trace:
                errors.append(f"Missing trace {prefix}{number}")
    inventory = json.loads((ROOT / "diagram-inventory.json").read_text(encoding="utf-8"))
    if len(inventory["diagrams"]) != 10:
        errors.append("Expected exactly ten main diagrams")
    for item in inventory["diagrams"]:
        path = ROOT / "diagrams" / item["file"]
        with Image.open(path) as image:
            image.load()
            if image.size != (2600, 1600) or image.mode != "RGB" or image.format != "PNG":
                errors.append(f"Invalid PNG {path.name}")
        if sha(path) != item["sha256"]:
            errors.append(f"PNG fingerprint mismatch {path.name}")
    source_text = (ROOT / "sources-and-method.md").read_text(encoding="utf-8")
    pdfs = {}
    for path in sorted((ROOT.parent / "architecture-docs").glob("*.pdf")):
        pdfs[path.name] = sha(path)
        if pdfs[path.name] not in source_text:
            errors.append(f"Source fingerprint missing {path.name}")
    prd = REPO / "tasks" / "prd-module-builder.md"
    report = {
        "status": "pass" if not errors else "fail",
        "scope": "Artifact and documentation structure only; no implementation or standards-conformance proof",
        "fr_rows": len(frs), "oq_rows": len(oqs), "local_links_checked": links,
        "main_pngs_checked": len(inventory["diagrams"]),
        "pdf_sha256": pdfs, "prd_sha256": sha(prd), "errors": errors,
    }
    (ROOT / "validation-results.json").write_text(json.dumps(report, indent=2, ensure_ascii=False)+"\n", encoding="utf-8")
    print(json.dumps({k:v for k,v in report.items() if "sha256" not in k}, indent=2))
    if errors:
        raise SystemExit(1)


if __name__ == "__main__":
    validate()
