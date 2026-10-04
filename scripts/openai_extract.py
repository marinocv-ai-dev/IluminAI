"""Re-extracts supporting quotes for PubMed-backed edges using OpenAI gpt-5.4-mini
and verifies literal substring match against PubMed abstracts.

Usage: python scripts/openai_extract.py [--limit N] [--dry-run]
"""
import argparse
import json
import re
import shutil
import sys
import time
import urllib.error
import urllib.request
import xml.etree.ElementTree as ET
from datetime import date
from pathlib import Path


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
    # Normalize unicode quotes and dashes
    t = text.replace("“", '"').replace("”", '"').replace("‘", "'").replace("’", "'")
    t = t.replace("—", "-").replace("–", "-")
    # Collapse multiple whitespace
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
    except Exception as e:
        abstract = ""

    cache_file.write_text(abstract, encoding="utf-8")
    time.sleep(0.35)  # NCBI rate limit: max 3 req/s
    return abstract


SCHEMA = {
    "type": "object",
    "additionalProperties": False,
    "required": ["verdict", "quote", "reason"],
    "properties": {
        "verdict": {"type": "string", "enum": ["supports", "contradicts", "unrelated"]},
        "quote": {"type": "string"},
        "reason": {"type": "string"},
    },
}


def call_openai(claim: str, abstract: str, base_url: str, model: str, key: str, extra: dict) -> tuple[dict, dict]:
    system_prompt = (
        "You verify biomedical claims. Given a CLAIM (subject, relation, object) and an ABSTRACT, "
        "copy the single sentence from the abstract that best supports or contradicts the claim, "
        "exactly as written (verbatim, no edits). If none is relevant, return verdict 'unrelated' and an empty quote."
    )
    user_prompt = f"CLAIM: {claim}\n\nABSTRACT:\n{abstract}"

    payload = {
        "model": model,
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ],
        "response_format": {
            "type": "json_schema",
            "json_schema": {"name": "extract_verification", "strict": True, "schema": SCHEMA},
        },
        "max_completion_tokens": 400,
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
            return json.loads(content), usage
        except urllib.error.HTTPError as e:
            if e.code == 429 and attempt < 4:
                sleep_time = 2 ** attempt + 1
                time.sleep(sleep_time)
                continue
            raise

    raise RuntimeError("OpenAI call failed after retries")


def safe_print(text: str):
    try:
        print(text)
    except UnicodeEncodeError:
        print(text.encode("ascii", errors="replace").decode("ascii"))


def extract_pmid_from_url(url: str) -> str:
    m = re.search(r"pubmed(?:\.ncbi\.nlm\.nih\.gov)?/(\d+)", url)
    return m.group(1) if m else ""


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--limit", type=int, default=0)
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()

    project_root = Path(__file__).resolve().parent.parent
    data_dir = project_root / "data"
    cache_dir = data_dir / ".cache"
    cache_dir.mkdir(parents=True, exist_ok=True)

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

    if not key:
        print("ERROR: LLM_KEY not found in atlas/.env.local", file=sys.stderr)
        sys.exit(1)

    nodes_file = data_dir / "nodes.jsonl"
    edges_file = data_dir / "edges.jsonl"
    backup_file = data_dir / "edges.jsonl.bak-extract"

    nodes = [json.loads(l) for l in nodes_file.read_text(encoding="utf-8").splitlines() if l.strip()]
    node_labels = {n["id"]: n.get("label", n["id"]) for n in nodes}

    edges = [json.loads(l) for l in edges_file.read_text(encoding="utf-8").splitlines() if l.strip()]

    # Backup edges before touching if not dry run
    if not args.dry_run and not backup_file.exists():
        shutil.copyfile(edges_file, backup_file)
        print(f"Created backup at {backup_file}")

    today = str(date.today())
    counts = {
        "total_pubmed": 0,
        "processed": 0,
        "skipped_idempotent": 0,
        "supports_verbatim": 0,
        "contradicts": 0,
        "unrelated": 0,
        "no_literal": 0,
        "no_abstract": 0,
        "total_prompt_tokens": 0,
        "total_completion_tokens": 0,
    }

    contradictions_list = []

    counts["total_pubmed"] = sum(
        1 for e in edges
        if (e.get("evidence") or [{}])[0].get("source") == "PubMed" and "pubmed" in (e.get("evidence") or [{}])[0].get("url", "").lower()
    )

    for idx, edge in enumerate(edges):
        evidence_list = edge.get("evidence", [])
        if not evidence_list:
            continue
        ev0 = evidence_list[0]
        if ev0.get("source") != "PubMed" or "pubmed" not in ev0.get("url", "").lower():
            continue

        pmid = extract_pmid_from_url(ev0.get("url", ""))
        if not pmid:
            continue

        # Criteria for skipping: has quote, verified_verbatim is True, extracted by same model, and NO needs_review
        if ev0.get("verified_verbatim") is True and ev0.get("extracted_by") == model and ev0.get("quote") and not edge.get("needs_review"):
            counts["skipped_idempotent"] += 1
            continue

        if args.limit and counts["processed"] >= args.limit:
            break

        counts["processed"] += 1

        s_id = edge.get("source")
        t_id = edge.get("target")
        s_lbl = node_labels.get(s_id, s_id)
        t_lbl = node_labels.get(t_id, t_id)
        e_type = edge.get("type", "related_to")
        claim = f"{s_lbl} ({s_id}) {e_type} {t_lbl} ({t_id})"

        safe_print(f"[{counts['processed']}] PMID:{pmid} | Claim: {s_lbl} -{e_type}-> {t_lbl}")

        abstract = fetch_abstract(pmid, cache_dir)
        if not abstract:
            safe_print("  -> Result: NO ABSTRACT")
            counts["no_abstract"] += 1
            if not args.dry_run:
                ev0["quote"] = ""
                if "verified_verbatim" in ev0:
                    del ev0["verified_verbatim"]
                edge["needs_review"] = "no_abstract"
            continue

        try:
            res_obj, usage = call_openai(claim, abstract, base_url, model, key, extra)
        except Exception as e:
            safe_print(f"  -> Error calling OpenAI: {e}")
            continue

        counts["total_prompt_tokens"] += usage.get("prompt_tokens", 0)
        counts["total_completion_tokens"] += usage.get("completion_tokens", 0)

        verdict = res_obj.get("verdict", "unrelated")
        quote = res_obj.get("quote", "").strip()
        reason = res_obj.get("reason", "").strip()

        literal = is_substring(quote, abstract) if quote else False

        safe_print(f"  Verdict: {verdict} | Literal: {literal}")
        if quote:
            safe_print(f"  Quote: \"{quote[:100]}...\"" if len(quote) > 100 else f"  Quote: \"{quote}\"")

        if verdict == "supports" and literal:
            counts["supports_verbatim"] += 1
            if not args.dry_run:
                ev0["quote"] = quote
                ev0["extracted_by"] = model
                ev0["extracted_at"] = today
                ev0["verified_verbatim"] = True
                if "needs_review" in edge:
                    del edge["needs_review"]
        elif verdict == "contradicts" and literal:
            counts["contradicts"] += 1
            # Do NOT modify edge to support contradiction, empty quote, needs_review
            if not args.dry_run:
                ev0["quote"] = ""
                if "verified_verbatim" in ev0:
                    del ev0["verified_verbatim"]
                edge["needs_review"] = f"contradicts: {reason}"
            contradictions_list.append((pmid, claim, quote, reason))
        elif verdict == "unrelated":
            counts["unrelated"] += 1
            if not args.dry_run:
                ev0["quote"] = ""
                if "verified_verbatim" in ev0:
                    del ev0["verified_verbatim"]
                edge["needs_review"] = f"unrelated: {reason}"
        else:  # quote not literal
            counts["no_literal"] += 1
            if not args.dry_run:
                ev0["quote"] = ""
                if "verified_verbatim" in ev0:
                    del ev0["verified_verbatim"]
                edge["needs_review"] = f"not_literal_in_abstract: {reason}"

    # Save edges if not dry run
    if not args.dry_run and counts["processed"] > 0:
        with open(edges_file, "w", encoding="utf-8") as f:
            for e in edges:
                f.write(json.dumps(e, ensure_ascii=False) + "\n")
        print(f"\nSaved updated edges to {edges_file}")

    # Reload edges from file or compute dataset-wide final counts
    final_supports = 0
    final_contradicts = 0
    final_unrelated = 0
    final_no_literal = 0
    final_no_abstract = 0
    final_no_source = 0
    needs_review_final = []

    for edge in edges:
        ev0 = (edge.get("evidence") or [{}])[0]
        if ev0.get("source") != "PubMed" or "pubmed" not in ev0.get("url", "").lower():
            continue
        pmid = extract_pmid_from_url(ev0.get("url", ""))
        s_lbl = node_labels.get(edge.get("source"), edge.get("source"))
        t_lbl = node_labels.get(edge.get("target"), edge.get("target"))
        claim = f"{s_lbl} ({edge.get('source')}) {edge.get('type')} {t_lbl} ({edge.get('target')})"

        nr = edge.get("needs_review")
        if not nr:
            if ev0.get("verified_verbatim") is True and ev0.get("quote"):
                final_supports += 1
        else:
            needs_review_final.append((pmid, claim, nr, ev0.get("quote", "")))
            if nr == "no_source":
                final_no_source += 1
            elif nr == "no_abstract":
                final_no_abstract += 1
            elif nr.startswith("unrelated"):
                final_unrelated += 1
            elif nr.startswith("contradicts"):
                final_contradicts += 1
            elif nr.startswith("not_literal"):
                final_no_literal += 1

    # Generate Markdown Report based on final dataset status
    report_lines = [
        "# OpenAI Extraction & Verbatim Verification Report",
        "",
        f"- **Date:** {today}",
        f"- **Model:** {model}",
        f"- **Total PubMed edges in dataset:** {counts['total_pubmed']}",
        f"- **Processed in this run:** {counts['processed']}",
        f"- **Skipped (already verified):** {counts['skipped_idempotent']}",
        f"- **Supports (verbatim in abstract):** {final_supports}",
        f"- **Contradictions detected (verbatim):** {final_contradicts}",
        f"- **Unrelated (abstract doesn't support claim):** {final_unrelated}",
        f"- **Non-literal quote (rejected):** {final_no_literal}",
        f"- **No abstract available:** {final_no_abstract}",
        f"- **No source paper:** {final_no_source}",
        f"- **Prompt tokens in this run:** {counts['total_prompt_tokens']}",
        f"- **Completion tokens in this run:** {counts['total_completion_tokens']}",
        "",
        "## Contradictions Flagged for Expert Review",
    ]

    if contradictions_list:
        report_lines.append("| PMID | Claim | Verbatim Quote | Model Reason |")
        report_lines.append("|---|---|---|---|")
        for pmid, clm, qte, rsn in contradictions_list:
            report_lines.append(f"| {pmid} | {clm} | \"{qte}\" | {rsn} |")
    else:
        report_lines.append("None detected.")

    report_lines.extend([
        "",
        "## Edges Flagged for Review (`needs_review`)",
    ])

    if needs_review_final:
        report_lines.append("| PMID | Claim | Issue / Reason | Quote / Fallback |")
        report_lines.append("|---|---|---|---|")
        for pmid, clm, reason, qte in needs_review_final:
            quote_display = f'"{qte[:80]}"' if qte else '""'
            report_lines.append(f"| {pmid} | {clm} | {reason} | {quote_display} |")
    else:
        report_lines.append("None flagged.")

    report_content = "\n".join(report_lines) + "\n"
    report_file = data_dir / "extract_report.md"
    report_file.write_text(report_content, encoding="utf-8")

    safe_print("\n" + "=" * 60)
    safe_print(report_content)
    safe_print("=" * 60)


if __name__ == "__main__":
    main()
