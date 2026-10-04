"""Checks against official APIs that every graph ID exists and its label matches.

Usage: python scripts/verify_ids.py [graph.json]
Covers HGNC, HPO, PubMed, ClinVar, OMIM (NCBI E-utilities), ClinicalTrials.gov and evidence URLs.
"""
import json
import re
import sys
import time
import urllib.request
from pathlib import Path

UA = {"User-Agent": "iluminai-hackathon/1.0", "Accept": "application/json"}


def get(url):
    with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=20) as r:
        return json.load(r)


def norm(s):
    return "".join(ch for ch in s.lower() if ch.isalnum())


def overlap(label, official):
    p = re.search(r"p\.\w+", label)
    if p:
        return p.group(0).lower() in official.lower()
    stopwords = {"et", "al", "in", "of", "to", "or", "and", "the"}
    words = lambda s: {w for w in re.findall(r"[a-z0-9]{2,}", s.lower()) if w not in stopwords}
    common = words(label) & words(official)
    return len(common) >= 2 or (len(words(label)) == 1 and len(common) >= 1)


def check_hgnc(n):
    docs = get(f"https://rest.genenames.org/fetch/hgnc_id/{n['id'].split(':')[1]}")["response"]["docs"]
    return docs[0]["symbol"] if docs else None


def check_hp(n):
    try:
        return get(f"https://ontology.jax.org/api/hp/terms/{n['id']}")["name"]
    except Exception:
        return None


def check_nct(n):
    try:
        d = get(f"https://clinicaltrials.gov/api/v2/studies/{n['id']}?fields=protocolSection.identificationModule.briefTitle")
        return d["protocolSection"]["identificationModule"]["briefTitle"]
    except Exception:
        return None


def esummary(db, ids):
    res = get(f"https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi?db={db}&retmode=json&id={','.join(ids)}")["result"]
    return {i: (None if "error" in res.get(i, {"error": 1}) else
                f"{res[i].get('title', '')} {res[i].get('sortfirstauthor', '')} {res[i].get('pubdate', '')[:4]}") for i in ids}


def check_urls(nodes, links):
    # org/asset nodes have no official ID: check their evidence URL responds
    urls_to_check = []
    for n in nodes:
        if n["type"] in ("org", "patient_group", "asset"):
            for l in links:
                if l["source"] == n["id"] or l["target"] == n["id"]:
                    u = l.get("evidence", [{}])[0].get("url")
                    if u and u.startswith("http") and not any(k in u for k in ("omim.org", "pubmed", "clinvar", "clinicaltrials")):
                        urls_to_check.append((n["id"], n["label"], u))
                        break
    urls_to_check = list({u: (nid, lbl) for nid, lbl, u in urls_to_check}.items())
    bad_urls = []
    print(f"\nChecking {len(urls_to_check)} org/asset evidence URLs...")
    for u, (nid, lbl) in urls_to_check:
        req = urllib.request.Request(u, headers={"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"})
        try:
            with urllib.request.urlopen(req, timeout=12) as r:
                code = r.getcode()
                if code >= 400:
                    bad_urls.append((nid, u, code))
                else:
                    print(f"  OK {nid:28} | {code} | {u}")
        except Exception as e:
            bad_urls.append((nid, u, str(e)))
        time.sleep(0.1)
    return bad_urls


def main(path):
    if path.endswith(".jsonl"):
        nodes = [json.loads(line) for line in open(path, encoding="utf-8") if line.strip()]
        g = {"nodes": nodes, "links": []}
    elif path == "contrib" or "contrib" in path:
        p = Path(path)
        if p.is_dir():
            nodes = []
            links = []
            for nf in p.glob("*_nodes.jsonl"):
                nodes.extend(json.loads(l) for l in nf.read_text(encoding="utf-8").splitlines() if l.strip())
            for ef in p.glob("*_edges.jsonl"):
                links.extend(json.loads(l) for l in ef.read_text(encoding="utf-8").splitlines() if l.strip())
            g = {"nodes": nodes, "links": links}
        else:
            g = json.load(open(path, encoding="utf-8"))
    else:
        g = json.load(open(path, encoding="utf-8"))

    by_prefix = {}
    for n in g["nodes"]:
        by_prefix.setdefault(n["id"].split(":")[0], []).append(n)

    rows = []  # (status, id, graph_label, official)

    # 1. HGNC and HPO
    for prefix, fn in (("HGNC", check_hgnc), ("HP", check_hp)):
        for n in by_prefix.get(prefix, []):
            off = fn(n)
            time.sleep(0.12)
            rows.append(("NOT FOUND" if off is None else "OK" if norm(n["label"]) in norm(off) or norm(off) in norm(n["label"]) else "MISMATCH", n["id"], n["label"], off))

    # 2. NCT
    for n in g["nodes"]:
        if n["id"].startswith("NCT") and ":" not in n["id"]:
            off = check_nct(n)
            rows.append(("NOT FOUND" if off is None else "OK" if overlap(n["label"], off) else "MISMATCH", n["id"], n["label"], off))

    # 3. PubMed, ClinVar and OMIM
    for prefix, db in (("PMID", "pubmed"), ("ClinVar", "clinvar"), ("OMIM", "omim")):
        ns = by_prefix.get(prefix, [])
        if ns:
            titles = esummary(db, [n["id"].split(":")[1] for n in ns])
            for n in ns:
                off = titles[n["id"].split(":")[1]]
                rows.append(("NOT FOUND" if off is None else "OK" if overlap(n["label"], off) else "MISMATCH", n["id"], n["label"], off))
            time.sleep(0.4)

    for status, i, label, off in sorted(rows, key=lambda r: r[0] == "OK"):
        line = f"{status:9} {i:16} graph: {label[:45]:45} | official: {(off or '-')[:70]}"
        try:
            print(line)
        except UnicodeEncodeError:
            print(line.encode("ascii", errors="replace").decode("ascii"))
    bad = sum(r[0] in ("NOT FOUND", "MISMATCH") for r in rows)

    # 4. Evidence URLs
    bad_urls = check_urls(g.get("nodes", []), g.get("links", []))
    if bad_urls:
        print(f"\nWARNING: {len(bad_urls)} URLs failed:")
        for nid, u, err in bad_urls:
            print(f"  {nid}: {u} -> {err}")
    else:
        print(f"\nOK: all org/asset evidence URLs respond.")

    # 5. Check PubMed evidence URLs (no STALE EVIDENCE)
    print("\nChecking PubMed evidence URLs...")
    node_pmids = {n["id"].split(":")[1] for n in g["nodes"] if n["id"].startswith("PMID:")}
    evidence_pmids = set()
    for link in g.get("links", []):
        for ev in link.get("evidence", []):
            url = ev.get("url", "")
            if "pubmed" in url.lower():
                m = re.search(r"pubmed(?:\.ncbi\.nlm\.nih\.gov)?/(\d+)", url)
                if m:
                    evidence_pmids.add((m.group(1), url, f"{link.get('source')} -> {link.get('target')}"))

    stale_count = 0
    non_node_pmids = [p for p, u, edge in evidence_pmids if p not in node_pmids]
    if non_node_pmids:
        # Check esummary for these non-node PMIDs
        esum_res = esummary("pubmed", non_node_pmids)
        for p, u, edge in evidence_pmids:
            if p not in node_pmids:
                title = esum_res.get(p)
                if not title or not title.strip():
                    print(f"  STALE EVIDENCE: PMID:{p} on edge {edge} ({u}) does not resolve in NCBI")
                    stale_count += 1
                else:
                    print(f"  OK (resolves NCBI): PMID:{p} on edge {edge}")
    else:
        print(f"  All {len(evidence_pmids)} PubMed evidence URLs point to verified graph paper nodes.")

    total_problems = bad + len(bad_urls) + stale_count
    print(f"\n{len(rows)} ids checked · {total_problems} with problems ({stale_count} STALE EVIDENCE) · "
          f"nodes without official ID (concept/org/person/asset): {sum(len(v) for k, v in by_prefix.items() if k not in ('HGNC', 'HP', 'PMID', 'ClinVar', 'OMIM') and not k.startswith('NCT'))}")


if __name__ == "__main__":
    main(sys.argv[1] if len(sys.argv) > 1 else "atlas/public/data/graph.json")
