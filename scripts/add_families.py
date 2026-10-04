"""Identifies same protein family relationships and inferred model transfer candidates.

Usage: python scripts/add_families.py [data_dir]
Reads nodes.jsonl, fetches gene groups via HGNC REST API, and idempotently appends:
1. `same_family` edges between genes sharing a non-generic gene_group.
2. `model_transfer_candidate` edges from animal/cell model assets of gene A to gene B (which lacks models).
"""
import json
import sys
import time
import urllib.request
from pathlib import Path

UA = {"User-Agent": "iluminai-hackathon/1.0", "Accept": "application/json"}


def fetch_hgnc_symbol(symbol: str):
    url = f"https://rest.genenames.org/fetch/symbol/{symbol}"
    req = urllib.request.Request(url, headers=UA)
    with urllib.request.urlopen(req, timeout=15) as r:
        data = json.load(r)
        docs = data.get("response", {}).get("docs", [])
        return docs[0] if docs else {}


def main(data_dir: Path):
    nodes_file = data_dir / "nodes.jsonl"
    edges_file = data_dir / "edges.jsonl"

    nodes_raw = [json.loads(line.strip().rstrip(",")) for line in nodes_file.read_text(encoding="utf-8").splitlines() if line.strip() and not line.strip().startswith(("#", "//", "```"))]
    edges_raw = [json.loads(line.strip().rstrip(",")) for line in edges_file.read_text(encoding="utf-8").splitlines() if line.strip() and not line.strip().startswith(("#", "//", "```"))]

    gene_nodes = [n for n in nodes_raw if n.get("type") == "gene"]
    existing_edges = {(e.get("source"), e.get("target"), e.get("type")) for e in edges_raw}

    # 1. Fetch gene groups for each gene
    gene_info = {}
    print(f"Fetching gene groups for {len(gene_nodes)} genes from HGNC...")
    for gn in gene_nodes:
        sym = gn.get("label")
        gid = gn.get("id")
        try:
            doc = fetch_hgnc_symbol(sym)
            groups = doc.get("gene_group", [])
            group_ids = doc.get("gene_group_id", [])
            # Filter out generic domain groups ("domain containing")
            valid_groups = []
            for g_id, g_name in zip(group_ids, groups):
                if "domain containing" not in g_name.lower():
                    valid_groups.append((g_id, g_name))
            gene_info[gid] = {"symbol": sym, "groups": valid_groups}
            print(f"  {sym} ({gid}): {valid_groups}")
        except Exception as e:
            print(f"  Error fetching {sym}: {e}")
            gene_info[gid] = {"symbol": sym, "groups": []}
        time.sleep(0.15)

    new_edges = []
    same_family_pairs = []

    # 2. Pairwise comparison for same_family
    gene_ids = list(gene_info.keys())
    for i in range(len(gene_ids)):
        for j in range(i + 1, len(gene_ids)):
            id1, id2 = gene_ids[i], gene_ids[j]
            info1, info2 = gene_info[id1], gene_info[id2]
            common = []
            for gid1, name1 in info1["groups"]:
                for gid2, name2 in info2["groups"]:
                    if gid1 == gid2:
                        common.append((gid1, name1))
            if common:
                g_id, g_name = common[0]
                same_family_pairs.append((info1["symbol"], info2["symbol"], g_id, g_name))
                edge = {
                    "source": id1,
                    "target": id2,
                    "type": "same_family",
                    "status": "observed",
                    "confidence": 0.95,
                    "evidence": [{
                        "source": "HGNC",
                        "url": f"https://www.genenames.org/data/genegroup/#!/group/{g_id}",
                        "quote": g_name
                    }],
                    "contradicts": []
                }
                if (id1, id2, "same_family") not in existing_edges and (id2, id1, "same_family") not in existing_edges:
                    new_edges.append(edge)
                    existing_edges.add((id1, id2, "same_family"))

    # 3. Model transfer candidates:
    # A has an animal or cellular asset (via its disease) and B does not
    # Find which diseases each gene causes
    causes_map = {}  # gene_id -> set of disease_ids
    for e in edges_raw:
        if e.get("type") == "causes":
            causes_map.setdefault(e.get("source"), set()).add(e.get("target"))

    # Find models for each disease
    # asset -model_of-> disease
    disease_models = {}  # disease_id -> list of asset_nodes
    node_by_id = {n["id"]: n for n in nodes_raw}
    for e in edges_raw:
        if e.get("type") == "model_of":
            src = e.get("source")
            tgt = e.get("target")
            src_node = node_by_id.get(src, {})
            lbl = src_node.get("label", "").lower()
            if any(m in lbl for m in ("mouse", "rat", "zebrafish", "ipsc", "cell", "organoid")):
                disease_models.setdefault(tgt, []).append(src_node)

    # Gene -> models
    gene_models = {}
    for gid in gene_ids:
        models = []
        for did in causes_map.get(gid, set()):
            for m in disease_models.get(did, []):
                if m not in models:
                    models.append(m)
        gene_models[gid] = models

    model_transfer_pairs = []
    # Check pairs of the same family
    for s_sym, t_sym, g_id, g_name in same_family_pairs:
        # Map symbol back to id
        gid_a = next(k for k, v in gene_info.items() if v["symbol"] == s_sym)
        gid_b = next(k for k, v in gene_info.items() if v["symbol"] == t_sym)

        # Case 1: A has models and B has none
        pairs_to_check = []
        if gene_models[gid_a] and not gene_models[gid_b]:
            pairs_to_check.append((gid_a, gid_b, s_sym, t_sym))
        if gene_models[gid_b] and not gene_models[gid_a]:
            pairs_to_check.append((gid_b, gid_a, t_sym, s_sym))

        for src_gid, tgt_gid, name_a, name_b in pairs_to_check:
            for asset_node in gene_models[src_gid]:
                asset_id = asset_node["id"]
                cand_edge = {
                    "source": asset_id,
                    "target": tgt_gid,
                    "type": "model_transfer_candidate",
                    "status": "inferred",
                    "confidence": 0.5,
                    "evidence": [{
                        "source": "HGNC",
                        "url": f"https://www.genenames.org/data/genegroup/#!/group/{g_id}",
                        "quote": f"Same protein family ({g_name}); model of {name_a} may inform {name_b}. Requires expert review."
                    }],
                    "contradicts": []
                }
                if (asset_id, tgt_gid, "model_transfer_candidate") not in existing_edges:
                    new_edges.append(cand_edge)
                    existing_edges.add((asset_id, tgt_gid, "model_transfer_candidate"))
                    model_transfer_pairs.append((asset_node["label"], name_a, name_b, g_name))

    print(f"\nCreated {len([e for e in new_edges if e['type'] == 'same_family'])} same_family edges:")
    for a, b, gid, gname in same_family_pairs:
        print(f"  {a} <-> {b} ({gname}, group {gid})")

    print(f"\nCreated {len([e for e in new_edges if e['type'] == 'model_transfer_candidate'])} model_transfer_candidate edges:")
    for asset_lbl, ga, gb, gname in model_transfer_pairs:
        print(f"  {asset_lbl} ({ga}) -> {gb} [{gname}]")

    if new_edges:
        with open(edges_file, "a", encoding="utf-8") as f:
            for e in new_edges:
                f.write(json.dumps(e, ensure_ascii=False) + "\n")
        print(f"\nSuccessfully appended {len(new_edges)} edges to {edges_file}")
    else:
        print("\nNo new edges needed (already idempotent).")

    return same_family_pairs, model_transfer_pairs


if __name__ == "__main__":
    d_dir = Path(sys.argv[1] if len(sys.argv) > 1 else "data")
    main(d_dir)
