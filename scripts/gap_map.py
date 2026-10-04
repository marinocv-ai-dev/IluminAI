"""Generates atlas/public/data/gaps.json mapping missing research assets across diseases.

Usage: python scripts/gap_map.py [graph_path] [out_path]
"""
import json
import sys
from datetime import date
from pathlib import Path


def generate_gap_map(graph_path: Path, out_path: Path):
    graph = json.loads(graph_path.read_text(encoding="utf-8"))
    nodes = {n["id"]: n for n in graph.get("nodes", [])}
    links = graph.get("links", [])

    # Map disease -> direct causes genes
    # links where gene -causes-> disease (source=gene, target=disease)
    causes_genes = {}
    for l in links:
        s, t, typ = l["source"], l["target"], l["type"]
        if typ == "causes":
            causes_genes.setdefault(t, set()).add(s)

    # Links index by endpoint
    in_links = {}
    out_links = {}
    for l in links:
        s, t = l["source"], l["target"]
        out_links.setdefault(s, []).append(l)
        in_links.setdefault(t, []).append(l)

    disease_nodes = [n for n in graph.get("nodes", []) if n.get("type") == "disease"]
    results = []

    for d in disease_nodes:
        did = d["id"]
        dlabel = d.get("label", did)
        c_genes = causes_genes.get(did, set())

        # 1. animal_model: link `model_of` from an `asset` whose label contains "mouse", "rat" or "zebrafish".
        has_animal = False
        for l in in_links.get(did, []):
            if l.get("type") == "model_of":
                src_node = nodes.get(l.get("source"), {})
                lbl = src_node.get("label", "").lower()
                if any(m in lbl for m in ("mouse", "rat", "zebrafish")):
                    has_animal = True
                    break

        # 2. cell_model: link from an `asset` whose label contains "iPSC", "cell" or "organoid".
        has_cell = False
        for l in in_links.get(did, []):
            src_node = nodes.get(l.get("source"), {})
            if src_node.get("type") == "asset":
                lbl = src_node.get("label", "").lower()
                if any(c in lbl for c in ("ipsc", "cell", "organoid")):
                    has_cell = True
                    break

        # 3. registry_or_group: link `registry_for` towards the disease, OR towards its causal gene (via `causes`).
        has_registry = False
        for l in in_links.get(did, []):
            if l.get("type") == "registry_for":
                has_registry = True
                break
        if not has_registry:
            for g in c_genes:
                for l in in_links.get(g, []):
                    if l.get("type") == "registry_for":
                        has_registry = True
                        break
                if has_registry:
                    break

        # 4. natural_history: an `asset` or `study` with "natural history" in the label, linked to the disease or to its gene.
        has_natural_history = False
        targets_to_check = {did} | c_genes
        for tgt in targets_to_check:
            for l in in_links.get(tgt, []):
                src_node = nodes.get(l.get("source"), {})
                if src_node.get("type") in ("asset", "study") and "natural history" in src_node.get("label", "").lower():
                    has_natural_history = True
                    break
            if has_natural_history:
                break

        # 5. trial: link `trial_for` from a `study`.
        has_trial = False
        for l in in_links.get(did, []):
            if l.get("type") == "trial_for":
                src_node = nodes.get(l.get("source"), {})
                if src_node.get("type") == "study":
                    has_trial = True
                    break

        # 6. treatment: link `treats`.
        has_treatment = False
        for l in in_links.get(did, []):
            if l.get("type") == "treats":
                has_treatment = True
                break

        # 7. researcher: link `investigates` towards the disease.
        has_researcher = False
        for l in in_links.get(did, []):
            if l.get("type") == "investigates":
                has_researcher = True
                break

        has_map = {
            "animal_model": has_animal,
            "cell_model": has_cell,
            "registry_or_group": has_registry,
            "natural_history": has_natural_history,
            "trial": has_trial,
            "treatment": has_treatment,
            "researcher": has_researcher,
        }
        missing = [k for k, v in has_map.items() if not v]

        res_obj = {
            "id": did,
            "label": dlabel,
            "has": has_map,
            "missing": missing,
        }
        if "CACNA1A" in [nodes.get(g, {}).get("label") for g in c_genes] or did in ("OMIM:108500", "OMIM:141500", "OMIM:183086", "OMIM:617106"):
            res_obj["vus_count"] = 3377
            res_obj["vus_query_url"] = "https://www.ncbi.nlm.nih.gov/clinvar/?term=CACNA1A%5Bgene%5D+AND+%22uncertain+significance%22%5Bclinsig%5D"

        results.append(res_obj)

    data = {
        "generated": str(date.today()),
        "sources_searched": [
            "OMIM", "HGNC", "HPO", "ClinVar", "PubMed", "ClinicalTrials.gov",
            "NIH RePORTER", "JAX", "patient-group websites"
        ],
        "cacna1a_vus": {
            "vus_count": 3377,
            "vus_query_url": "https://www.ncbi.nlm.nih.gov/clinvar/?term=CACNA1A%5Bgene%5D+AND+%22uncertain+significance%22%5Bclinsig%5D",
            "description": "3377 CACNA1A variants of uncertain significance in ClinVar: functional effect (LoF/GoF) unknown"
        },
        "diseases": results,
    }

    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(json.dumps(data, indent=2, ensure_ascii=False), encoding="utf-8")

    # Print summary table
    print(f"\n{'Disease':<40} {'Animal':<7} {'Cell':<6} {'Reg/Grp':<8} {'NatHist':<8} {'Trial':<6} {'Tx':<5} {'Res':<5} Missing")
    print("-" * 105)
    for r in results:
        h = r["has"]
        f = lambda b: "YES" if b else "-"
        print(f"{r['label'][:38]:<40} {f(h['animal_model']):<7} {f(h['cell_model']):<6} {f(h['registry_or_group']):<8} {f(h['natural_history']):<8} {f(h['trial']):<6} {f(h['treatment']):<5} {f(h['researcher']):<5} {len(r['missing'])}")
    print(f"\nGenerated gap map at {out_path} ({len(results)} diseases analyzed)\n")
    return data


if __name__ == "__main__":
    g_path = Path(sys.argv[1] if len(sys.argv) > 1 else "atlas/public/data/graph.json")
    o_path = Path(sys.argv[2] if len(sys.argv) > 2 else "atlas/public/data/gaps.json")
    generate_gap_map(g_path, o_path)
