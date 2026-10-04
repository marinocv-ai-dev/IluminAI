import urllib.request
import urllib.parse
import json
import time

UA = {"User-Agent": "iluminai-hackathon/1.0", "Accept": "application/json"}

def get_json(url):
    req = urllib.request.Request(url, headers=UA)
    with urllib.request.urlopen(req, timeout=15) as r:
        return json.load(r)

# 1. HGNC
genes = ['CACNA1A', 'ATP1A2', 'SCN1A', 'KCNA1', 'CACNB4', 'SLC1A3', 'ATXN1', 'ATXN2', 'ATXN3', 'ATXN7', 'CACNA1B', 'CACNA1E']
hgnc_map = {}
for g in genes:
    url = f"https://rest.genenames.org/fetch/symbol/{g}"
    docs = get_json(url)["response"]["docs"]
    if docs:
        hgnc_map[g] = docs[0]["hgnc_id"]
    time.sleep(0.1)
print("HGNC Map:")
for g, hid in hgnc_map.items():
    print(f"  {g}: {hid}")

# 2. OMIM check via NCBI
omim_ids = ['108500','141500','183086','617106','160120','602481','609634','613855','612656','164400','183090','109150','164500','607208']
omim_url = f"https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi?db=omim&retmode=json&id={','.join(omim_ids)}"
omim_res = get_json(omim_url).get("result", {})
print("\nOMIM entries:")
for oid in omim_ids:
    if oid in omim_res:
        print(f"  {oid} -> {omim_res[oid].get('title', 'no title')}")
