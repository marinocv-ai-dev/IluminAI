"""Merges nodes.jsonl + edges.jsonl into graph.json for react-force-graph-3d.

Usage:  python scripts/build_graph.py [input_dir] [output]
        python scripts/build_graph.py data atlas/public/data/graph.json   (default)

Validates: JSON per line, existing endpoints, evidence URL, valid status and type.
Invalid rows are NOT written: they are reported on the console to be fixed.
"""
import json
import sys
from pathlib import Path

NODE_TYPES = {"disease", "gene", "variant", "mechanism", "phenotype", "patient_group", "paper",
              "study", "asset", "researcher", "funder", "treatment", "company"}
STATUSES = {"observed", "extracted", "inferred", "contributed"}


def read_jsonl(path):
    rows, bad = [], []
    for n, line in enumerate(path.read_text(encoding="utf-8").splitlines(), 1):
        line = line.strip().rstrip(",")
        if not line or line.startswith(("```", "--")):  # tolerates code fences pasted as-is from an LLM
            continue
        try:
            rows.append(json.loads(line))
        except json.JSONDecodeError as e:
            bad.append(f"{path.name}:{n} invalid JSON ({e.msg})")
    return rows, bad


def build(src, out, include_unreviewed=False, with_contrib=False, skip_runs=None):
    raw_nodes, errors = read_jsonl(src / "nodes.jsonl")
    raw_edges, e2 = read_jsonl(src / "edges.jsonl")
    errors += e2

    if skip_runs is None:
        skip_runs = {"dee69"}  # default: don't mix live replay runs into base graph

    if with_contrib:
        contrib_dir = src / "contrib"
        if not contrib_dir.exists():
            contrib_dir = Path("data/contrib")
        if contrib_dir.exists():
            for nf in contrib_dir.glob("*_nodes.jsonl"):
                run_name = nf.name.replace("_nodes.jsonl", "")
                if run_name in skip_runs:
                    continue
                cn, ce = read_jsonl(nf)
                raw_nodes.extend(cn)
                errors += ce
            for ef in contrib_dir.glob("*_edges.jsonl"):
                run_name = ef.name.replace("_edges.jsonl", "")
                if run_name in skip_runs:
                    continue
                ce_rows, ce_errs = read_jsonl(ef)
                raw_edges.extend(ce_rows)
                errors += ce_errs

    nodes = {}
    for n in raw_nodes:
        if not n.get("id") or n.get("type") not in NODE_TYPES:
            errors.append(f"node dropped (id/type): {n.get('id')} {n.get('type')}")
            continue
        if n["id"] in nodes:  # duplicate: merge synonyms, first one wins
            nodes[n["id"]]["synonyms"] = sorted(set(nodes[n["id"]].get("synonyms", []) + n.get("synonyms", [])))
            continue
        n.setdefault("synonyms", [])
        n.setdefault("summary_plain", "")
        n.setdefault("cluster", "other")
        nodes[n["id"]] = n

    links, seen = [], set()
    held = 0
    for e in raw_edges:
        s, t, typ = e.get("source"), e.get("target"), e.get("type")
        # links without a verified quote stay in data/ but are hidden until expert review (--include-unreviewed shows them)
        if e.get("needs_review") and not include_unreviewed:
            held += 1
            continue
        why = ("missing endpoint" if s not in nodes or t not in nodes else
               "no evidence[0].url" if not (e.get("evidence") or [{}])[0].get("url") else
               "invalid status" if e.get("status") not in STATUSES else
               "duplicate" if (s, t, typ) in seen else None)
        if why:
            errors.append(f"edge dropped ({why}): {s} -{typ}-> {t}")
            continue
        seen.add((s, t, typ))
        conf = float(e.get("confidence", 0.5))
        if e["status"] == "inferred":
            conf = min(conf, 0.6)  # data contract rule
        links.append({**e, "id": f"L{len(links) + 1}", "confidence": round(max(0.0, min(conf, 1.0)), 2),
                      "contradicts": e.get("contradicts", [])})

    # contradicts arrives as "source->target"; translate to link ids
    by_pair = {f"{l['source']}->{l['target']}": l["id"] for l in links}
    for l in links:
        l["contradicts"] = [by_pair.get(c, c) for c in l["contradicts"]]

    deg = {}
    for l in links:
        for k in (l["source"], l["target"]):
            deg[k] = deg.get(k, 0) + 1
    orphans = [i for i in nodes if i not in deg]
    if held:  # nodes whose only links are held for review are hidden too (no unsupported floating nodes)
        hidden = [i for i in orphans if any(i in (e.get("source"), e.get("target")) for e in raw_edges if e.get("needs_review"))]
        nodes = {k: v for k, v in nodes.items() if k not in hidden}
        orphans = [i for i in orphans if i not in hidden]
        if hidden:
            print(f"HELD {len(hidden)} nodes with only unreviewed links: {', '.join(hidden)}")

    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps({"nodes": list(nodes.values()), "links": links}, ensure_ascii=False, indent=1),
                   encoding="utf-8")

    print(f"OK {out}: {len(nodes)} nodes, {len(links)} links "
          f"({sum(l['status'] == 'observed' for l in links)} observed / "
          f"{sum(l['status'] == 'extracted' for l in links)} extracted / "
          f"{sum(l['status'] == 'inferred' for l in links)} inferred)")
    if held:
        print(f"HELD {held} links pending expert review (needs_review); rebuild with --include-unreviewed to show them")
    if orphans:
        print(f"WARNING {len(orphans)} nodes without links (will float): {', '.join(orphans[:10])}")
    for msg in errors:
        print("ERROR", msg)

    # Regenerate review_queue.json for held needs_review links (Task N1)
    try:
        from datetime import date
        all_raw_nodes = {n["id"]: n.get("label", n["id"]) for n in raw_nodes if n.get("id")}
        
        # Mapping reason string to human-readable explanation
        def format_reason(nr_str: str) -> str:
            if not nr_str:
                return "Needs expert verification"
            if nr_str.startswith("unrelated"):
                return "Cited abstract does not support this claim"
            if nr_str.startswith("no_abstract"):
                return "Source has no abstract"
            if nr_str.startswith("no_source"):
                return "No source found"
            if nr_str.startswith("indirect"):
                return "Indirect evidence"
            return nr_str

        # Grouping order: treatments, models, researchers, mechanisms, others
        def type_group_order(t: str) -> int:
            if t in ("treats", "contraindicated_in", "trial_for"):
                return 1
            if t in ("model_of", "has_model"):
                return 2
            if t in ("investigates", "authored"):
                return 3
            if t in ("causes", "disrupts", "variant_effect", "shares_mechanism"):
                return 4
            return 5

        held_items = []
        for e in raw_edges:
            if e.get("needs_review"):
                src_id = e.get("source")
                tgt_id = e.get("target")
                src_lbl = all_raw_nodes.get(src_id, src_id)
                tgt_lbl = all_raw_nodes.get(tgt_id, tgt_id)
                ev_list = e.get("evidence") or []
                src_url = ev_list[0].get("url", "") if ev_list else ""
                
                held_items.append({
                    "source": src_id,
                    "source_label": src_lbl,
                    "type": e.get("type", "related_to"),
                    "target": tgt_id,
                    "target_label": tgt_lbl,
                    "reason": format_reason(e.get("needs_review", "")),
                    "source_url": src_url,
                    "_order": type_group_order(e.get("type", ""))
                })

        # Sort by group order, then by type, then source_label
        held_items.sort(key=lambda x: (x["_order"], x["type"], x["source_label"]))
        for it in held_items:
            del it["_order"]

        rq_payload = {
            "generated": str(date.today()),
            "count": len(held_items),
            "items": held_items
        }
        rq_out = out.parent / "review_queue.json"
        rq_out.write_text(json.dumps(rq_payload, indent=2, ensure_ascii=False), encoding="utf-8")
        print(f"Generated review queue at {rq_out} ({len(held_items)} held links)")
    except Exception as e:
        print("WARNING: review_queue generation failed:", e)

    # Regenerate gaps.json alongside graph.json
    try:
        from gap_map import generate_gap_map
        gaps_out = out.parent / "gaps.json"
        generate_gap_map(out, gaps_out)
    except Exception as e:
        print("WARNING: gap_map failed:", e)

    return nodes, links, errors


if __name__ == "__main__":
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    src = Path(args[0] if args else "data")
    out = Path(args[1] if len(args) > 1 else "atlas/public/data/graph.json")
    # demo default: include reviewed-pending contributions (scraper); --no-contrib builds the verified-only graph
    with_contrib = "--no-contrib" not in sys.argv
    skip_runs = {"dee69"}
    for a in sys.argv:
        if a.startswith("--skip-run="):
            skip_runs = set(a.split("=")[1].split(","))
        elif a == "--skip-run" and sys.argv.index(a) + 1 < len(sys.argv):
            skip_runs = {sys.argv[sys.argv.index(a) + 1]}
    build(src, out, include_unreviewed="--include-unreviewed" in sys.argv, with_contrib=with_contrib, skip_runs=skip_runs)
