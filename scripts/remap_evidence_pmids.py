"""Remaps stale PubMed evidence URLs in data/edges.jsonl to verified PMIDs.

Usage: python scripts/remap_evidence_pmids.py
"""
import json
import re
import shutil
from pathlib import Path

REMAP_TABLE = {
    "8934531": "8898206",
    "8988179": "8988170",
    "14999285": "15003170",
    "15004139": "15136697",
    "24074887": "23827678",
    "17967913": "19285472",
    "11867768": "12539047",
    "16141073": "16054936",
    "12702710": "7842011",
    "19364908": "16116111",
    "29780183": "41775907",
    "33246834": "37555011",
    "21330775": "26377379",
    "15371536": None,  # no substitute
}


def extract_pmid(url: str) -> str:
    m = re.search(r"pubmed(?:\.ncbi\.nlm\.nih\.gov)?/(\d+)", url)
    return m.group(1) if m else ""


def main():
    project_root = Path(__file__).resolve().parent.parent
    data_dir = project_root / "data"
    edges_file = data_dir / "edges.jsonl"
    backup_file = data_dir / "edges.jsonl.bak-remap"

    if not backup_file.exists():
        shutil.copyfile(edges_file, backup_file)
        print(f"Created backup at {backup_file}")

    edges = [json.loads(line) for line in edges_file.read_text(encoding="utf-8").splitlines() if line.strip()]

    remapped_count = 0
    no_source_count = 0

    for edge in edges:
        ev_list = edge.get("evidence", [])
        if not ev_list:
            continue
        ev0 = ev_list[0]
        url = ev0.get("url", "")
        old_pmid = extract_pmid(url)
        if not old_pmid or old_pmid not in REMAP_TABLE:
            continue

        new_pmid = REMAP_TABLE[old_pmid]
        if new_pmid:
            ev0["url"] = f"https://pubmed.ncbi.nlm.nih.gov/{new_pmid}/"
            ev0["quote"] = ""
            if "verified_verbatim" in ev0:
                del ev0["verified_verbatim"]
            if "extracted_by" in ev0:
                del ev0["extracted_by"]
            if "extracted_at" in ev0:
                del ev0["extracted_at"]
            remapped_count += 1
        else:
            # no substitute
            ev0["quote"] = ""
            if "verified_verbatim" in ev0:
                del ev0["verified_verbatim"]
            if "extracted_by" in ev0:
                del ev0["extracted_by"]
            if "extracted_at" in ev0:
                del ev0["extracted_at"]
            edge["needs_review"] = "no_source"
            no_source_count += 1

    with open(edges_file, "w", encoding="utf-8") as f:
        for e in edges:
            f.write(json.dumps(e, ensure_ascii=False) + "\n")

    print(f"Remapping complete: {remapped_count} URLs remapped to verified PMIDs, {no_source_count} marked needs_review='no_source'.")


if __name__ == "__main__":
    main()
