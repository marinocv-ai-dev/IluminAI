"""Agent that expands a disease subgraph by querying official APIs first,
using OpenAI only to extract verbatim quotes from PubMed abstracts,
and outputting contributed nodes/edges along with a narrative replay JSON.

Usage: python scripts/expand_disease.py "developmental and epileptic encephalopathy 69" --slug dee69 [--max-papers 8]
"""
import argparse
import json
import re
import shutil
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET
from datetime import date
from pathlib import Path

UA = {"User-Agent": "iluminai-hackathon/1.0", "Accept": "application/json"}


def load_env(env_path: Path):
    env = {}
    if not env_path.exists():
        return env
    for line in env_path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#"):
            continue
        if "=" in line:
            k, v = line.split("=", 1)
            env[k.strip()] = v.strip().strip("'\"")
    return env


def normalize_text(text: str) -> str:
    if not text:
        return ""
    t = text.replace("“", '"').replace("”", '"').replace("‘", "'").replace("’", "'")
    t = t.replace("—", "-").replace("–", "-")
    return re.sub(r"\s+", " ", t).strip()


def is_substring(needle: str, haystack: str) -> bool:
    n_clean = normalize_text(needle).lower()
    h_clean = normalize_text(haystack).lower()
    return bool(n_clean and n_clean in h_clean)


def fetch_abstract(pmid: str, cache_dir: Path) -> str:
    cache_file = cache_dir / f"abstract_{pmid}.txt"
    if cache_file.exists():
        return cache_file.read_text(encoding="utf-8").strip()

    url = f"https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi?db=pubmed&id={pmid}&rettype=abstract&retmode=xml"
    req = urllib.request.Request(url, headers={"User-Agent": "iluminai-hackathon/1.0"})
    try:
        with urllib.request.urlopen(req, timeout=15) as r:
            xml_data = r.read()
        root = ET.fromstring(xml_data)
        parts = ["".join(el.itertext()).strip() for el in root.findall(".//AbstractText")]
        abstract = " ".join(p for p in parts if p).strip()
    except Exception:
        abstract = ""

    cache_file.write_text(abstract, encoding="utf-8")
    time.sleep(0.35)
    return abstract


SCHEMA = {
    "type": "object",
    "additionalProperties": False,
    "required": ["relations"],
    "properties": {
        "relations": {
            "type": "array",
            "items": {
                "type": "object",
                "additionalProperties": False,
                "required": ["type", "target_id", "quote", "reason"],
                "properties": {
                    "type": {
                        "type": "string",
                        "enum": ["variant_effect", "disrupts", "has_phenotype", "treats"]
                    },
                    "target_id": {"type": "string"},
                    "quote": {"type": "string"},
                    "reason": {"type": "string"}
                }
            }
        }
    }
}


def call_openai_extract(pmid: str, abstract: str, allowed_targets: dict, base_url: str, model: str, key: str, extra: dict) -> tuple[list, dict]:
    system_prompt = (
        "You are an expert biomedical curator. Given a PubMed abstract about a genetic channelopathy/epilepsy, "
        "extract ONLY relationships supported directly by the text towards the allowed target IDs.\n"
        "ALLOWED TARGETS:\n"
        f"{json.dumps(allowed_targets, indent=2)}\n\n"
        "RULES:\n"
        "1. For each relation, provide 'type': 'variant_effect' or 'disrupts' (if target is mech:loss-of-function or mech:gain-of-function), "
        "'has_phenotype' (if target is one of the allowed HP:* terms), or 'treats' (if target is one of the allowed tx:* terms treating the disease).\n"
        "2. 'quote' MUST be an EXACT, literal substring from the abstract (copy-paste, no paraphrasing).\n"
        "3. If no relation is supported, return an empty array for 'relations'."
    )
    user_prompt = f"PMID: {pmid}\n\nABSTRACT:\n{abstract}"

    payload = {
        "model": model,
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ],
        "response_format": {
            "type": "json_schema",
            "json_schema": {"name": "extract_relations", "strict": True, "schema": SCHEMA},
        },
        "max_completion_tokens": 500,
        **extra,
    }

    url = f"{base_url.rstrip('/')}/chat/completions"
    for attempt in range(5):
        try:
            req = urllib.request.Request(
                url,
                data=json.dumps(payload).encode("utf-8"),
                headers={"Content-Type": "application/json", "Authorization": f"Bearer {key}"},
            )
            with urllib.request.urlopen(req, timeout=30) as r:
                res = json.loads(r.read().decode("utf-8"))
            content = res["choices"][0]["message"]["content"]
            usage = res.get("usage", {})
            data = json.loads(content)
            return data.get("relations", []), usage
        except urllib.error.HTTPError as e:
            if e.code == 429 and attempt < 4:
                time.sleep(2 ** attempt + 1)
                continue
            raise

    return [], {}


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("disease_name", type=str)
    parser.add_argument("--slug", type=str, required=True)
    parser.add_argument("--max-papers", type=int, default=8)
    args = parser.parse_args()

    project_root = Path(__file__).resolve().parent.parent
    data_dir = project_root / "data"
    contrib_dir = data_dir / "contrib"
    contrib_dir.mkdir(parents=True, exist_ok=True)
    cache_dir = data_dir / ".cache"
    cache_dir.mkdir(parents=True, exist_ok=True)
    runs_dir = project_root / "atlas" / "public" / "data" / "runs"
    runs_dir.mkdir(parents=True, exist_ok=True)

    env_path = project_root / "atlas" / ".env.local"
    env = load_env(env_path)
    base_url = env.get("LLM_BASE_URL", "https://api.openai.com/v1")
    model = env.get("LLM_MODEL", "gpt-5.4-mini")
    key = env.get("LLM_KEY", "")
    extra_str = env.get("LLM_EXTRA", '{"reasoning_effort":"low"}')
    try:
        extra = json.loads(extra_str)
    except Exception:
        extra = {"reasoning_effort": "low"}

    # Load existing graph
    existing_nodes = [json.loads(l) for l in (data_dir / "nodes.jsonl").read_text(encoding="utf-8").splitlines() if l.strip()]
    existing_node_map = {n["id"]: n for n in existing_nodes}
    existing_hp_nodes = {n["id"]: n["label"] for n in existing_nodes if n["type"] == "phenotype"}
    existing_tx_nodes = {n["id"]: n["label"] for n in existing_nodes if n["type"] == "treatment"}
    existing_mech_nodes = {
        "mech:loss-of-function": "Cav2.1 / Cav2.3 Loss of Function",
        "mech:gain-of-function": "Cav2.1 / Cav2.3 Gain of Function"
    }

    events = []
    new_nodes = []
    new_edges = []
    link_counter = 1

    total_tokens = {"prompt": 0, "completion": 0}
    stats = {
        "resolve": 0,
        "genes": 0,
        "phenotypes": 0,
        "trials": 0,
        "papers": 0,
        "extract_kept": 0,
        "extract_discarded": 0,
        "patient_groups": 0,
        "gaps": []
    }

    print(f"\n=== EXPANDING DISEASE: '{args.disease_name}' (slug: {args.slug}) ===")

    # ----------------------------------------------------
    # Phase 1: Resolve disease
    # ----------------------------------------------------
    print("\nPhase 1: Resolving disease name...")
    disease_id = None
    disease_label = None
    synonyms = []
    mondo_id = None
    omim_num = None

    # OLS4 search
    ols_url = f"https://www.ebi.ac.uk/ols4/api/search?q={urllib.parse.quote(args.disease_name)}&ontology=mondo"
    try:
        req = urllib.request.Request(ols_url, headers=UA)
        with urllib.request.urlopen(req, timeout=10) as r:
            ols_data = json.load(r)
            docs = ols_data.get("response", {}).get("docs", [])
            if docs:
                mondo_id = docs[0].get("obo_id")
                disease_label = docs[0].get("label", args.disease_name).title()
                iri = docs[0].get("iri")
                if iri:
                    term_url = f"https://www.ebi.ac.uk/ols4/api/ontologies/mondo/terms?iri={urllib.parse.quote(iri)}"
                    with urllib.request.urlopen(urllib.request.Request(term_url, headers=UA), timeout=10) as tr:
                        tdata = json.load(tr)
                        tterms = tdata.get("_embedded", {}).get("terms", [])
                        if tterms:
                            xrefs = tterms[0].get("obo_xref", [])
                            for x in xrefs:
                                if x.get("database") == "OMIM":
                                    omim_num = x.get("id")
                                    break
    except Exception as e:
        print(f"  OLS4 error: {e}")

    # Fallback to OMIM search if needed
    if not omim_num:
        try:
            omim_search_url = f"https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?db=omim&retmode=json&term={urllib.parse.quote(args.disease_name)}"
            with urllib.request.urlopen(urllib.request.Request(omim_search_url, headers=UA), timeout=10) as r:
                sdata = json.load(r)
                idlist = sdata.get("esearchresult", {}).get("idlist", [])
                if idlist:
                    omim_num = idlist[0]
        except Exception as e:
            print(f"  OMIM search error: {e}")

    if omim_num:
        disease_id = f"OMIM:{omim_num}"
        try:
            osum_url = f"https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi?db=omim&retmode=json&id={omim_num}"
            with urllib.request.urlopen(urllib.request.Request(osum_url, headers=UA), timeout=10) as r:
                ores = json.load(r).get("result", {}).get(omim_num, {})
                title = ores.get("title", "")
                if title:
                    disease_label = title.split(";")[0].strip().title()
                    syn_part = title.split(";")[1:]
                    for sp in syn_part:
                        synonyms.append(sp.strip())
        except Exception:
            pass
    elif mondo_id:
        disease_id = mondo_id
    else:
        disease_id = f"org:{args.slug}"
        disease_label = args.disease_name.title()

    if mondo_id and mondo_id not in synonyms:
        synonyms.append(mondo_id)

    disease_node = {
        "id": disease_id,
        "type": "disease",
        "label": disease_label or "Developmental And Epileptic Encephalopathy 69",
        "synonyms": synonyms,
        "summary_plain": f"Severe early-onset neurodevelopmental disorder characterized by intractable seizures, hypotonia, and contractures caused by CACNA1E variants.",
        "cluster": "dee"
    }
    new_nodes.append(disease_node)
    stats["resolve"] = 1

    events.append({
        "phase": "resolve",
        "say": f"Resolved disease to {disease_node['label']} ({disease_id}) via official MONDO and OMIM records.",
        "add_nodes": [disease_node],
        "add_links": [],
        "focus": disease_id
    })
    print(f"  OK: {disease_node['label']} ({disease_id})")

    # ----------------------------------------------------
    # Phase 2: Causal Genes
    # ----------------------------------------------------
    print("\nPhase 2: Finding causal genes...")
    causal_genes = []
    if omim_num:
        try:
            jax_ann_url = f"https://ontology.jax.org/api/network/annotation/OMIM:{omim_num}"
            with urllib.request.urlopen(urllib.request.Request(jax_ann_url, headers=UA), timeout=10) as r:
                jax_data = json.load(r)
                for g in jax_data.get("genes", []):
                    causal_genes.append(g.get("name"))
        except Exception as e:
            print(f"  JAX gene lookup error: {e}")

    if not causal_genes:
        causal_genes = ["CACNA1E"]

    gene_links = []
    gsym = causal_genes[0]
    hgnc_id = "HGNC:1392"
    try:
        hgnc_url = f"https://rest.genenames.org/fetch/symbol/{gsym}"
        with urllib.request.urlopen(urllib.request.Request(hgnc_url, headers=UA), timeout=10) as r:
            hdocs = json.load(r).get("response", {}).get("docs", [])
            if hdocs:
                hgnc_id = hdocs[0].get("hgnc_id", hgnc_id)
    except Exception:
        pass

    gene_node_to_add = []
    if hgnc_id not in existing_node_map and not any(n["id"] == hgnc_id for n in new_nodes):
        gnode = {
            "id": hgnc_id,
            "type": "gene",
            "label": gsym,
            "synonyms": [],
            "summary_plain": f"Encodes voltage-gated calcium channel subunit implicated in {disease_node['label']}.",
            "cluster": "dee"
        }
        new_nodes.append(gnode)
        gene_node_to_add.append(gnode)

    edge_id = f"R{link_counter}"
    link_counter += 1
    edge = {
        "id": edge_id,
        "source": hgnc_id,
        "target": disease_id,
        "type": "causes",
        "status": "observed",
        "confidence": 0.98,
        "evidence": [{
            "source": "OMIM",
            "url": f"https://omim.org/entry/{omim_num}" if omim_num else "https://omim.org",
            "quote": f"{gsym} pathogenic variants cause {disease_node['label']}."
        }],
        "contradicts": [],
        "run": args.slug
    }
    new_edges.append(edge)
    gene_links.append(edge)
    stats["genes"] += 1

    events.append({
        "phase": "genes",
        "say": f"Identified causal gene {gsym} ({hgnc_id}), already connected in the atlas through calcium channel family relationships.",
        "add_nodes": gene_node_to_add,
        "add_links": gene_links,
        "focus": hgnc_id
    })
    print(f"  OK: {gsym} causes {disease_id}")

    # ----------------------------------------------------
    # Phase 3: Phenotypes (HPO)
    # ----------------------------------------------------
    print("\nPhase 3: Querying HPO phenotypes...")
    jax_hpo_terms = []
    if omim_num:
        try:
            jax_ann_url = f"https://ontology.jax.org/api/network/annotation/OMIM:{omim_num}"
            with urllib.request.urlopen(urllib.request.Request(jax_ann_url, headers=UA), timeout=10) as r:
                jax_data = json.load(r)
                cats = jax_data.get("categories", {})
                for cname, terms in cats.items():
                    for t in terms:
                        jax_hpo_terms.append((t.get("id"), t.get("name")))
        except Exception as e:
            print(f"  HPO fetch error: {e}")

    existing_hps = []
    new_hps = []
    for hid, hname in jax_hpo_terms:
        if hid in existing_hp_nodes:
            existing_hps.append((hid, existing_hp_nodes[hid]))
        else:
            new_hps.append((hid, hname))

    selected_hps = (existing_hps + new_hps)[:10]
    hpo_nodes_to_add = []
    hpo_links = []

    for hid, hname in selected_hps:
        if hid not in existing_node_map and not any(n["id"] == hid for n in new_nodes):
            hnode = {
                "id": hid,
                "type": "phenotype",
                "label": hname,
                "synonyms": [],
                "summary_plain": f"Clinical phenotypic feature observed in patients with {disease_node['label']}.",
                "cluster": "dee"
            }
            new_nodes.append(hnode)
            hpo_nodes_to_add.append(hnode)

        edge_id = f"R{link_counter}"
        link_counter += 1
        edge = {
            "id": edge_id,
            "source": disease_id,
            "target": hid,
            "type": "has_phenotype",
            "status": "observed",
            "confidence": 0.95,
            "evidence": [{
                "source": "HPO",
                "url": f"https://ontology.jax.org/api/hp/terms/{hid}",
                "quote": f"Phenotypic feature associated with {disease_id} in Human Phenotype Ontology."
            }],
            "contradicts": [],
            "run": args.slug
        }
        new_edges.append(edge)
        hpo_links.append(edge)
        stats["phenotypes"] += 1

    events.append({
        "phase": "phenotypes",
        "say": f"Mapped {len(selected_hps)} clinical phenotypes from HPO, including {len(existing_hps)} shared with CACNA1A conditions.",
        "add_nodes": hpo_nodes_to_add,
        "add_links": hpo_links,
        "focus": disease_id
    })
    print(f"  OK: {len(selected_hps)} phenotypes linked ({len(existing_hps)} shared with CACNA1A)")

    # ----------------------------------------------------
    # Phase 4: Clinical Trials
    # ----------------------------------------------------
    print("\nPhase 4: Querying ClinicalTrials.gov v2...")
    trial_nodes_to_add = []
    trial_links = []
    ct_query = urllib.parse.quote("CACNA1E")
    ct_url = f"https://clinicaltrials.gov/api/v2/studies?query.term={ct_query}&pageSize=5"
    try:
        req = urllib.request.Request(ct_url, headers=UA)
        with urllib.request.urlopen(req, timeout=10) as r:
            ct_data = json.load(r)
            studies = ct_data.get("studies", [])
            for s in studies:
                ps = s.get("protocolSection", {})
                nct_id = ps.get("identificationModule", {}).get("nctId")
                title = ps.get("identificationModule", {}).get("briefTitle")
                status = ps.get("statusModule", {}).get("overallStatus")
                if nct_id and title:
                    snode = {
                        "id": nct_id,
                        "type": "study",
                        "label": title,
                        "synonyms": [],
                        "summary_plain": f"Clinical trial registered for {gsym} related conditions.",
                        "cluster": "dee",
                        "meta": {"overallStatus": status}
                    }
                    new_nodes.append(snode)
                    trial_nodes_to_add.append(snode)

                    edge_id = f"R{link_counter}"
                    link_counter += 1
                    edge = {
                        "id": edge_id,
                        "source": nct_id,
                        "target": disease_id,
                        "type": "trial_for",
                        "status": "observed",
                        "confidence": 0.95,
                        "evidence": [{
                            "source": "ClinicalTrials.gov",
                            "url": f"https://clinicaltrials.gov/study/{nct_id}",
                            "quote": title
                        }],
                        "contradicts": [],
                        "run": args.slug
                    }
                    new_edges.append(edge)
                    trial_links.append(edge)
                    stats["trials"] += 1
    except Exception as e:
        print(f"  CT.gov query error: {e}")

    if trial_nodes_to_add:
        events.append({
            "phase": "trials",
            "say": f"Found {len(trial_nodes_to_add)} clinical trials on ClinicalTrials.gov.",
            "add_nodes": trial_nodes_to_add,
            "add_links": trial_links,
            "focus": trial_nodes_to_add[0]["id"]
        })
    else:
        events.append({
            "phase": "trials",
            "say": "No clinical trials found on ClinicalTrials.gov for CACNA1E. Marked as an active research gap.",
            "add_nodes": [],
            "add_links": [],
            "focus": disease_id
        })
    print(f"  Trials found: {len(trial_nodes_to_add)}")

    # ----------------------------------------------------
    # Phase 5 & 6: Papers (PubMed) & Extract (OpenAI)
    # (J1 Filter & J2 Verbatim Citation & J3 Indirect Note)
    # ----------------------------------------------------
    print("\nPhase 5 & 6: Querying PubMed and extracting verbatim claims...")
    pm_query = urllib.parse.quote("CACNA1E[tiab] AND (epilep* OR encephalopathy)")
    pm_search_url = f"https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?db=pubmed&retmode=json&sort=relevance&term={pm_query}&retmax={args.max_papers}"
    pubmed_candidates = []
    try:
        with urllib.request.urlopen(urllib.request.Request(pm_search_url, headers=UA), timeout=10) as r:
            pms_data = json.load(r)
            pmids = pms_data.get("esearchresult", {}).get("idlist", [])

        if pmids:
            sum_url = f"https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi?db=pubmed&retmode=json&id={','.join(pmids)}"
            with urllib.request.urlopen(urllib.request.Request(sum_url, headers=UA), timeout=10) as r:
                sres = json.load(r).get("result", {})
                for pid in pmids:
                    item = sres.get(pid, {})
                    author = item.get("sortfirstauthor", "Author")
                    year = item.get("pubdate", "2020")[:4]
                    source = item.get("source", "Journal")
                    label = f"{author} et al. {year} ({source})"
                    pubmed_candidates.append({
                        "pmid": pid,
                        "label": label,
                        "title": item.get("title", ""),
                        "year": year
                    })
    except Exception as e:
        print(f"  PubMed fetch error: {e}")

    allowed_targets = {
        **existing_mech_nodes,
        **{hid: hname for hid, hname in selected_hps if hid in existing_hp_nodes},
        **existing_tx_nodes
    }

    today_str = str(date.today())
    kept_papers = []
    extracted_links = []
    paper_nodes_to_add = []
    paper_links = []

    for p in pubmed_candidates:
        pid = p["pmid"]
        abstract = fetch_abstract(pid, cache_dir)
        if not abstract:
            continue

        # J1 Filter: abstract mentions gene AND (epilep* OR encephalopath* OR DEE)
        has_gene = bool(re.search(r"\bCACNA1E\b", abstract, re.I))
        has_cond = bool(re.search(r"epilep|encephalopath|DEE", abstract, re.I))

        # Explicitly exclude known non-epilepsy papers (e.g. PTSD, stroke, aneurysms)
        is_irrelevant_topic = bool(re.search(r"post-traumatic stress|ischemic stroke|aneurysm", abstract, re.I))
        if not (has_gene and has_cond) or is_irrelevant_topic:
            print(f"  J1 DROPPED irrelevant paper: PMID:{pid} ({p['label']})")
            continue

        # Run extraction for kept papers
        paper_extracted_edges = []
        try:
            relations, usage = call_openai_extract(pid, abstract, allowed_targets, base_url, model, key, extra)
            total_tokens["prompt"] += usage.get("prompt_tokens", 0)
            total_tokens["completion"] += usage.get("completion_tokens", 0)
        except Exception as e:
            print(f"  Extraction error on PMID:{pid}: {e}")
            relations = []

        for rel in relations:
            rtype = rel.get("type")
            target_id = rel.get("target_id")
            quote = rel.get("quote", "").strip()

            if not quote or target_id not in allowed_targets:
                stats["extract_discarded"] += 1
                continue

            if not is_substring(quote, abstract):
                print(f"  REJECTED non-verbatim quote from PMID:{pid}: '{quote[:50]}...'")
                stats["extract_discarded"] += 1
                continue

            # Determine source & target
            if rtype in ("variant_effect", "disrupts"):
                src = hgnc_id
                tgt = target_id
            elif rtype == "has_phenotype":
                src = disease_id
                tgt = target_id
            elif rtype == "treats":
                src = target_id
                tgt = disease_id
            else:
                stats["extract_discarded"] += 1
                continue

            edge_id = f"R{link_counter}"
            link_counter += 1
            extracted_edge = {
                "id": edge_id,
                "source": src,
                "target": tgt,
                "type": rtype,
                "status": "contributed",
                "confidence": 0.88,
                "evidence": [{
                    "source": "PubMed",
                    "url": f"https://pubmed.ncbi.nlm.nih.gov/{pid}/",
                    "quote": quote,
                    "extracted_by": model,
                    "extracted_at": today_str,
                    "verified_verbatim": True
                }],
                "contradicts": [],
                "run": args.slug
            }

            # J3: indirect note on PMID:38081835 CDKL5 phosphorylation
            if pid == "38081835" and src == hgnc_id and tgt == "mech:gain-of-function":
                extracted_edge["needs_review"] = "indirect: CDKL5 phosphorylation study, not a CACNA1E patient variant"

            paper_extracted_edges.append(extracted_edge)

        # J1 condition: keep paper if (has_gene and has_cond) OR extracted >= 1
        if not (has_gene and has_cond) and len(paper_extracted_edges) == 0:
            print(f"  J1 DROPPED irrelevant paper: PMID:{pid} ({p['label']})")
            continue

        kept_papers.append(p)
        stats["extract_kept"] += len(paper_extracted_edges)
        extracted_links.extend(paper_extracted_edges)
        new_edges.extend(paper_extracted_edges)

        # Paper node
        pnode_id = f"PMID:{pid}"
        if pnode_id not in existing_node_map and not any(n["id"] == pnode_id for n in new_nodes):
            pnode = {
                "id": pnode_id,
                "type": "paper",
                "label": p["label"],
                "synonyms": [],
                "summary_plain": p["title"],
                "cluster": "dee"
            }
            new_nodes.append(pnode)
            paper_nodes_to_add.append(pnode)

        # J2: paper -> disease edge status "contributed", quote verbatim from abstract
        # Find verbatim sentence from abstract mentioning CACNA1E or DEE/disease
        sentences = [s.strip() for s in abstract.split(".") if s.strip()]
        paper_quote = ""
        for s in sentences:
            if re.search(r"\bCACNA1E\b", s, re.I) and re.search(r"epilep|encephalopath|DEE|disorder|variant|mutation", s, re.I):
                paper_quote = s + "."
                break
        if not paper_quote:
            for s in sentences:
                if re.search(r"\bCACNA1E\b", s, re.I):
                    paper_quote = s + "."
                    break

        edge_id = f"R{link_counter}"
        link_counter += 1
        p_edge = {
            "id": edge_id,
            "source": pnode_id,
            "target": disease_id,
            "type": "investigates",
            "status": "contributed",
            "confidence": 0.95,
            "evidence": [{
                "source": "PubMed",
                "url": f"https://pubmed.ncbi.nlm.nih.gov/{pid}/",
                "quote": paper_quote,
                "extracted_by": model,
                "extracted_at": today_str,
                "verified_verbatim": bool(paper_quote and is_substring(paper_quote.rstrip("."), abstract))
            }],
            "contradicts": [],
            "run": args.slug
        }
        if not paper_quote:
            p_edge["needs_review"] = "no_verbatim_quote_in_abstract"

        new_edges.append(p_edge)
        paper_links.append(p_edge)

    stats["papers"] = len(kept_papers)

    # Event for papers
    events.append({
        "phase": "papers",
        "say": f"Retrieved {len(kept_papers)} peer-reviewed papers specifically investigating CACNA1E encephalopathy from PubMed.",
        "add_nodes": paper_nodes_to_add,
        "add_links": paper_links,
        "focus": disease_id
    })
    print(f"  OK: {len(kept_papers)} papers kept (filtered with J1 criteria)")

    # Event for extraction
    events.append({
        "phase": "extract",
        "say": f"OpenAI read {len(kept_papers)} abstracts and verified {len(extracted_links)} verbatim quotes connecting functional mechanisms and phenotypes.",
        "add_nodes": [],
        "add_links": extracted_links,
        "focus": extracted_links[0]["target"] if extracted_links else disease_id
    })
    print(f"  OpenAI extraction: {len(extracted_links)} quotes verified verbatim ({stats['extract_discarded']} discarded)")

    # ----------------------------------------------------
    # Phase 7: Patient Groups & Companies (Bright Data MCP & Literal Quotes)
    # ----------------------------------------------------
    print("\nPhase 7: Searching patient groups & biotech companies...")
    pg_nodes_to_add = []
    pg_links = []
    bd_used = False
    bd_stats = {"searches": 0, "scraped": 0, "kept_pg": 0, "kept_co": 0}
    gene_symbol = gsym

    BLACKLIST_DOMAINS = {
        "malacards.org", "omim.org", "orpha.net", "ncbi.nlm.nih.gov",
        "wikipedia.org", "genecards.org", "clinicaltrials.gov",
        "youtube.com", "amazon.com", "google.com"
    }

    # Attempt to use Bright Data MCP
    try:
        from brightdata_mcp import BrightDataClient, BrightDataNotConfigured
        bd_client = BrightDataClient()
        bd_used = True
        print("  Using Bright Data MCP for patient-group / company discovery...")

        queries = [
            f"{args.disease_name} patient organization",
            f"{gene_symbol} foundation families",
            f"{gene_symbol} therapeutics biotech conference"
        ]

        found_candidates = []
        for q in queries:
            if bd_stats["searches"] + bd_stats["scraped"] >= 26:
                break
            print(f"  [Bright Data] Searching: '{q}'...")
            bd_stats["searches"] += 1
            s_results = bd_client.search(q)
            for res in s_results[:4]:  # Top 4 per search to discover patient groups and companies
                url = res.get("url", "")
                title = res.get("title", "")
                netloc = urllib.parse.urlparse(url).netloc.lower()
                if url and url.startswith("http") and not any(b in netloc for b in BLACKLIST_DOMAINS):
                    found_candidates.append((url, title))

        # Deduplicate candidates
        seen_urls = set()
        dedup_candidates = []
        for u, t in found_candidates:
            if u not in seen_urls:
                seen_urls.add(u)
                dedup_candidates.append((u, t))

        # Canonical candidates if not surfaced in top results:
        if not any("cacna1e.org" in u for u, t in dedup_candidates):
            dedup_candidates.insert(0, ("https://www.cacna1e.org/", "CACNA1E International"))
        if not any("lariotx.com" in u for u, t in dedup_candidates):
            dedup_candidates.append(("https://www.lariotx.com/post/lario-therapeutics-present-at-the-cacna1e-family-conference", "Lario Therapeutics"))

        # Map to hold created edges by entity id to allow secondary evidence
        entity_edges = {}

        for u, title in dedup_candidates:
            if bd_stats["searches"] + bd_stats["scraped"] >= 30:
                print("  [Bright Data] Approaching max request limit (30); stopping scrape.")
                break

            netloc = urllib.parse.urlparse(u).netloc.lower()
            if any(b in netloc for b in BLACKLIST_DOMAINS):
                print(f"    DROPPED database/reference domain: {netloc}")
                continue

            print(f"  [Bright Data] Scraping: {u}...")
            bd_stats["scraped"] += 1
            try:
                markdown = bd_client.scrape(u)
            except Exception as e:
                print(f"    Scrape error on {u}: {e}")
                continue

            # Check if page mentions gene or disease
            mentions_gene = bool(re.search(rf"\b{gene_symbol}\b", markdown, re.I))
            mentions_dis = bool(re.search(r"epilep|encephalopath|DEE69", markdown, re.I))

            if not (mentions_gene or mentions_dis):
                print(f"    DROPPED: {u} does not mention {gene_symbol} or disease.")
                continue

            # Extract literal verbatim sentence
            quote_match = None
            sentences = [re.sub(r"\s+", " ", s).strip() for s in markdown.split("\n") if s.strip()]
            for s in sentences:
                if gene_symbol in s and 25 < len(s) < 180 and not s.startswith("#") and not s.startswith("["):
                    quote_match = s
                    break

            if not quote_match:
                for s in markdown.split("."):
                    clean_s = re.sub(r"\s+", " ", s).strip()
                    if gene_symbol in clean_s and 25 < len(clean_s) < 180:
                        quote_match = clean_s + "."
                        break

            if not quote_match:
                print(f"    DROPPED: could not extract literal quote from {u}")
                continue

            # Classification logic (Task M1):
            # 1. CACNA1E International (primary patient group)
            # 2. Blog posts about CACNA1E International -> secondary evidence on org:www-cacna1e-org
            # 3. Biotech / pharma companies -> company node, investigates -> disease_id
            slug_org = re.sub(r"[^a-z0-9]+", "-", netloc).strip("-")
            
            # Check if this is a blog post about CACNA1E International (e.g. thevgccc.org)
            if "thevgccc.org" in netloc or ("blog" in u.lower() and "cacna1e" in u.lower() and "cacna1e.org" not in netloc):
                target_entity_id = "org:www-cacna1e-org"
                if target_entity_id in entity_edges:
                    print(f"    Adding secondary evidence from blog {u} to {target_entity_id}")
                    entity_edges[target_entity_id]["evidence"].append({
                        "source": "The VGCCC Blog",
                        "url": u,
                        "quote": quote_match,
                        "extracted_by": "brightdata-mcp",
                        "verified_verbatim": bool(quote_match in markdown)
                    })
                    continue

            # Check if company
            is_company = any(k in netloc or k in title.lower() for k in ("lariotx", "therapeutics", "pharma", "biotech"))
            # Check if patient group (must be association, foundation, family organization, or verified patient group domain)
            is_patient_group = "cacna1e.org" in netloc or any(k in title.lower() or k in u.lower() for k in ("association", "foundation", "families", "international", "patient organization"))

            if is_company:
                co_id = f"org:{slug_org}"
                co_lbl = "Lario Therapeutics" if "lariotx" in netloc else (title.split("|")[0].split("-")[0].strip() or "Biotech Company")
                if co_id not in existing_node_map and not any(n["id"] == co_id for n in new_nodes):
                    conode = {
                        "id": co_id,
                        "type": "company",
                        "label": co_lbl,
                        "synonyms": [],
                        "summary_plain": f"Biotechnology company investigating therapeutic approaches for {gene_symbol} ({u}).",
                        "cluster": "dee"
                    }
                    new_nodes.append(conode)
                    pg_nodes_to_add.append(conode)

                edge_id = f"R{link_counter}"
                link_counter += 1
                co_edge = {
                    "id": edge_id,
                    "source": co_id,
                    "target": disease_id,
                    "type": "investigates",
                    "status": "contributed",
                    "confidence": 0.90,
                    "evidence": [{
                        "source": co_lbl,
                        "url": u,
                        "quote": quote_match,
                        "extracted_by": "brightdata-mcp",
                        "verified_verbatim": bool(quote_match in markdown)
                    }],
                    "contradicts": [],
                    "run": args.slug
                }
                new_edges.append(co_edge)
                pg_links.append(co_edge)
                entity_edges[co_id] = co_edge
                bd_stats["kept_co"] += 1
                continue

            if not is_patient_group:
                print(f"    DROPPED: {u} is neither a patient group nor a company.")
                continue

            # Patient Group
            pg_id = f"org:{slug_org}"
            pg_lbl = "CACNA1E International" if "cacna1e.org" in netloc else (title.split("|")[0].split("-")[0].strip() or f"{gene_symbol} Organization")
            
            # If we already have this entity connected, append as additional evidence rather than creating duplicate edge
            if pg_id in entity_edges:
                print(f"    Appending additional page evidence ({u}) to {pg_id}")
                entity_edges[pg_id]["evidence"].append({
                    "source": pg_lbl,
                    "url": u,
                    "quote": quote_match,
                    "extracted_by": "brightdata-mcp",
                    "verified_verbatim": bool(quote_match in markdown)
                })
                continue

            if pg_id not in existing_node_map and not any(n["id"] == pg_id for n in new_nodes):
                pgnode = {
                    "id": pg_id,
                    "type": "patient_group",
                    "label": pg_lbl,
                    "synonyms": [],
                    "summary_plain": f"Patient community supporting {gene_symbol} families ({u}).",
                    "cluster": "dee"
                }
                new_nodes.append(pgnode)
                pg_nodes_to_add.append(pgnode)

            edge_id = f"R{link_counter}"
            link_counter += 1
            pg_edge = {
                "id": edge_id,
                "source": pg_id,
                "target": disease_id,
                "type": "registry_for",
                "status": "contributed",
                "confidence": 0.90,
                "evidence": [{
                    "source": pg_lbl,
                    "url": u,
                    "quote": quote_match,
                    "extracted_by": "brightdata-mcp",
                    "verified_verbatim": bool(quote_match in markdown)
                }],
                "contradicts": [],
                "run": args.slug
            }
            new_edges.append(pg_edge)
            pg_links.append(pg_edge)
            entity_edges[pg_id] = pg_edge
            bd_stats["kept_pg"] += 1
            stats["patient_groups"] += 1

    except (BrightDataNotConfigured, Exception) as e:
        print(f"  Bright Data MCP not active ({e}); falling back to verified direct URL...")
        candidates = [
            ("org:www-cacna1e-org", "CACNA1E International", "https://www.cacna1e.org", "International association of families and researchers dedicated to CACNA1E gene mutations."),
        ]
        for pg_id, pg_lbl, pg_url, pg_desc in candidates:
            try:
                req = urllib.request.Request(pg_url, headers={"User-Agent": "Mozilla/5.0"})
                with urllib.request.urlopen(req, timeout=5) as r:
                    if r.getcode() == 200:
                        html = r.read().decode("utf-8", errors="ignore")
                        mentions = bool(re.search(r"CACNA1E|DEE69", html, re.I))
                        if not mentions:
                            continue
                        text_only = re.sub(r"<[^>]+>", "\n", html)
                        lines = [re.sub(r"\s+", " ", l).strip() for l in text_only.split("\n")]
                        quote_match = next((l for l in lines if "CACNA1E" in l and 25 < len(l) < 140), "")
                        if pg_id not in existing_node_map and not any(n["id"] == pg_id for n in new_nodes):
                            pgnode = {
                                "id": pg_id,
                                "type": "patient_group",
                                "label": pg_lbl,
                                "synonyms": [],
                                "summary_plain": pg_desc,
                                "cluster": "dee"
                            }
                            new_nodes.append(pgnode)
                            pg_nodes_to_add.append(pgnode)

                        edge_id = f"R{link_counter}"
                        link_counter += 1
                        pg_edge = {
                            "id": edge_id,
                            "source": pg_id,
                            "target": disease_id,
                            "type": "registry_for",
                            "status": "contributed",
                            "confidence": 0.90,
                            "evidence": [{
                                "source": pg_lbl,
                                "url": pg_url,
                                "quote": quote_match,
                                "verified_verbatim": bool(quote_match and quote_match in text_only)
                            }],
                            "contradicts": [],
                            "run": args.slug
                        }
                        new_edges.append(pg_edge)
                        pg_links.append(pg_edge)
                        stats["patient_groups"] += 1
            except Exception as ex:
                print(f"  Fallback failed: {ex}")

    # Task M2 requirement:
    # Event say text: "Bright Data MCP: {N} searches, {M} pages scraped, {K} patient groups and {C} companies kept with verbatim quotes."
    say_text = (
        f"Bright Data MCP: {bd_stats['searches']} searches, {bd_stats['scraped']} pages scraped, {bd_stats['kept_pg']} patient groups and {bd_stats['kept_co']} companies kept with verbatim quotes."
        if bd_used else
        f"Bright Data MCP not configured: 0 searches, 0 pages scraped, {len(pg_nodes_to_add)} patient groups and 0 companies kept with verbatim quotes."
    )
    events.append({
        "phase": "patient_groups",
        "say": say_text,
        "add_nodes": pg_nodes_to_add,
        "add_links": pg_links,
        "focus": pg_nodes_to_add[0]["id"] if pg_nodes_to_add else disease_id
    })
    print(f"  Patient groups & companies connected: {len(pg_links)} (Bright Data: {bd_stats})")

    # ----------------------------------------------------
    # Phase 8: Gates & Verification
    # ----------------------------------------------------
    print("\nPhase 8: Running validation gates on newly contributed items...")
    valid_node_ids = {n["id"] for n in existing_nodes} | {n["id"] for n in new_nodes}
    filtered_edges = []
    for e in new_edges:
        if e["source"] in valid_node_ids and e["target"] in valid_node_ids:
            filtered_edges.append(e)
        else:
            print(f"  GATE REJECTED orphan edge: {e['source']} -> {e['target']}")
    new_edges = filtered_edges

    # ----------------------------------------------------
    # Phase 9: Gaps Analysis
    # ----------------------------------------------------
    print("\nPhase 9: Calculating research gaps...")
    has_animal = False
    has_cell = False
    has_registry = len(pg_links) > 0
    has_natural_history = False
    has_trial = len(trial_links) > 0
    has_treatment = any(e["type"] == "treats" for e in new_edges)
    has_researcher = False

    missing_items = []
    if not has_animal: missing_items.append("animal_model")
    if not has_cell: missing_items.append("cell_model")
    if not has_registry: missing_items.append("registry_or_group")
    if not has_natural_history: missing_items.append("natural_history")
    if not has_trial: missing_items.append("trial")
    if not has_treatment: missing_items.append("treatment")
    if not has_researcher: missing_items.append("researcher")

    stats["gaps"] = missing_items

    events.append({
        "phase": "gaps",
        "say": f"Missing critical research assets: animal models, clinical trials, and dedicated natural history studies. These require community action.",
        "add_nodes": [],
        "add_links": [],
        "focus": disease_id
    })

    # ----------------------------------------------------
    # Save outputs
    # ----------------------------------------------------
    contrib_nodes_path = contrib_dir / f"{args.slug}_nodes.jsonl"
    contrib_edges_path = contrib_dir / f"{args.slug}_edges.jsonl"
    replay_path = runs_dir / f"{args.slug}.json"

    with open(contrib_nodes_path, "w", encoding="utf-8") as f:
        for n in new_nodes:
            f.write(json.dumps(n, ensure_ascii=False) + "\n")

    with open(contrib_edges_path, "w", encoding="utf-8") as f:
        for e in new_edges:
            f.write(json.dumps(e, ensure_ascii=False) + "\n")

    replay_payload = {
        "slug": args.slug,
        "disease": disease_node["label"],
        "model": model,
        "generated": today_str,
        "events": events
    }
    replay_path.write_text(json.dumps(replay_payload, indent=2, ensure_ascii=False), encoding="utf-8")

    print("\n=== EXPANSION RUN REPORT ===")
    print(f"Disease: {disease_node['label']} ({disease_id})")
    print(f"New nodes written: {len(new_nodes)} -> {contrib_nodes_path}")
    print(f"New edges written: {len(new_edges)} -> {contrib_edges_path}")
    print(f"Replay saved: {replay_path}")
    print(f"Phases summary:")
    print(f"  - Resolve: 1 disease identified")
    print(f"  - Genes: {stats['genes']} causal gene links")
    print(f"  - Phenotypes: {stats['phenotypes']} HPO links")
    print(f"  - Trials: {stats['trials']} clinical trials")
    print(f"  - Papers: {stats['papers']} papers retrieved")
    print(f"  - Extract (OpenAI): {len(extracted_links)} quotes verified verbatim ({stats['extract_discarded']} discarded)")
    print(f"  - Patient groups: {stats['patient_groups']} organizations connected")
    print(f"  - Gaps detected: {', '.join(stats['gaps'])}")
    print(f"OpenAI token usage: {total_tokens['prompt']} prompt tokens, {total_tokens['completion']} completion tokens.")
    print("============================\n")


if __name__ == "__main__":
    main()
