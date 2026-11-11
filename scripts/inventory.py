"""Register local recipe PDFs, including hidden files, without modifying them."""
import argparse
import hashlib
import json
import re
from collections import defaultdict
from pathlib import Path

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument("root", type=Path, help="Folder containing PDFs and optional Archive/ and Processed/ folders")
parser.add_argument("--inbox-only", action="store_true", help="Inventory only new top-level scans")
parser.add_argument("--output", type=Path, help="Local JSON register path")
args = parser.parse_args()
copies = defaultdict(list)
exact = defaultdict(list)

directories = ("",) if args.inbox_only else ("", "Archive", "Processed")
for directory in directories:
    for path in sorted((args.root / directory).glob("*")):
        if path.suffix.lower() != ".pdf" or not path.is_file():
            continue
        with path.open("rb") as file:
            digest = hashlib.file_digest(file, "sha256").hexdigest()
        relative = path.relative_to(args.root).as_posix()
        copies[path.name].append({"path": relative, "sha256": digest})
        exact[digest].append(relative)

candidates = defaultdict(list)
register = []
for name, versions in sorted(copies.items()):
    stem = Path(name).stem
    title = re.sub(r"-\d+$", "", stem)
    untitled = title.startswith(".pdf")
    candidates[title].append(name)
    register.append({
        "filename": name,
        "copies": versions,
        "copiesNeedComparison": len({v["sha256"] for v in versions}) > 1,
        "untitled": untitled,
    })

result = {
    "scanEntries": len(register),
    "fileCopies": sum(len(v) for v in copies.values()),
    "exactHashGroups": [v for v in exact.values() if len(v) > 1],
    "sameTitleCandidates": [v for v in candidates.values() if len(v) > 1],
    "entries": register,
}
serialized = json.dumps(result, indent=2, ensure_ascii=False) + "\n"
if args.output:
    args.output.write_text(serialized, encoding="utf-8")
else:
    print(serialized, end="")
