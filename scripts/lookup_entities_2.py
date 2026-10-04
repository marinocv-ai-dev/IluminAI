import json
import urllib.parse
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))
from api_client import fetch_json, fetch_text

def search_pm(term):
    url = f"https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?db=pubmed&retmode=json&term={urllib.parse.quote(term)}"
    d = fetch_json(url)
    ids = d.get("esearchresult", {}).get("idlist", [])
    if not ids:
        return None
    pmid = ids[0]
    surl = f"https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi?db=pubmed&retmode=json&id={pmid}"
    sd = fetch_json(surl).get("result", {}).get(pmid, {})
    return {
        "pmid": pmid,
        "title": sd.get("title", ""),
        "author": sd.get("sortfirstauthor", ""),
        "source": sd.get("source", ""),
        "year": sd.get("pubdate", "")[:4]
    }

print("Searching missing papers...")
# Klockgether Lancet Neurol
p = search_pm('Klockgether T[au] AND "Lancet Neurol"[ta]')
print("Klockgether Lancet Neurol:", p)

# Indelicato & Boesch 2018 (Expert Opin)
p = search_pm('Indelicato E[au] AND Boesch S[au]')
print("Indelicato Boesch any:", p)
p = search_pm('CACNA1A AND "Expert Opin"[ta]')
print("CACNA1A Expert Opin:", p)

# Kessi 2021 Front Cell Neurosci
p = search_pm('CACNA1A AND "Front Cell Neurosci"[ta]')
print("CACNA1A Front Cell Neurosci:", p)
p = search_pm('Kessi M[au] AND 2021[dp]')
print("Kessi 2021:", p)

# Al-Twaijri & Shevell 2002 Pediatr Neurol
p = search_pm('Shevell M[au] AND "Pediatr Neurol"[ta] AND ataxia')
print("Shevell Pediatr Neurol ataxia:", p)
p = search_pm('Shevell M[au] AND "episodic ataxia"')
print("Shevell episodic ataxia:", p)

print("\nSearching ClinVar variants in CACNA1A...")
# Look for pathogenic CACNA1A variants in ClinVar
url = f"https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?db=clinvar&retmode=json&term={urllib.parse.quote('CACNA1A[gene] AND pathogenic[clinsig]')}&retmax=30"
d = fetch_json(url)
cids = d.get("esearchresult", {}).get("idlist", [])
print(f"Pathogenic CACNA1A variants found: {len(cids)}")
if cids:
    surl = f"https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi?db=clinvar&retmode=json&id={','.join(cids[:15])}"
    res = fetch_json(surl).get("result", {})
    for cid in cids[:15]:
        vdata = res.get(cid, {})
        title = vdata.get("title", "")
        sig = vdata.get("clinical_significance", {}).get("description", "")
        print(f"  ClinVar:{cid} | {title} | {sig}")

# Look specifically for R1358X, R1266Q, R1456H, R1330Q, R1666H, or alternatives in ClinVar
specific = [
    'CACNA1A[gene] AND "1358"',
    'CACNA1A[gene] AND "1266"',
    'CACNA1A[gene] AND "1456"',
    'CACNA1A[gene] AND "1330"',
    'CACNA1A[gene] AND "1666"',
    'CACNA1A[gene] AND "Arg1349Ter"',
    'CACNA1A[gene] AND "R1349X"',
    'CACNA1A[gene] AND ("episodic ataxia" OR "EA2") AND pathogenic[clinsig]'
]
print("\nSearching specific variants:")
for sq in specific:
    url = f"https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?db=clinvar&retmode=json&term={urllib.parse.quote(sq)}"
    sd = fetch_json(url)
    sids = sd.get("esearchresult", {}).get("idlist", [])
    if sids:
        surl = f"https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi?db=clinvar&retmode=json&id={sids[0]}"
        vdata = fetch_json(surl).get("result", {}).get(sids[0], {})
        print(f"  Query '{sq}' -> ClinVar:{sids[0]} | {vdata.get('title')} | {vdata.get('clinical_significance', {}).get('description')}")
    else:
        print(f"  Query '{sq}' -> None")

print("\nSearching ClinicalTrials for episodic ataxia and nystagmus...")
url = f"https://clinicaltrials.gov/api/v2/studies?query.term={urllib.parse.quote('episodic ataxia')}&pageSize=10"
ct_d = fetch_json(url)
for s in ct_d.get("studies", []):
    proto = s.get("protocolSection", {})
    ident = proto.get("identificationModule", {})
    status = proto.get("statusModule", {})
    print(f"  {ident.get('nctId')}: {ident.get('briefTitle')} ({status.get('overallStatus')})")

url_nys = f"https://clinicaltrials.gov/api/v2/studies?query.term={urllib.parse.quote('downbeat nystagmus')}&pageSize=5"
ct_nys = fetch_json(url_nys)
for s in ct_nys.get("studies", []):
    proto = s.get("protocolSection", {})
    ident = proto.get("identificationModule", {})
    status = proto.get("statusModule", {})
    print(f"  [Nystagmus] {ident.get('nctId')}: {ident.get('briefTitle')} ({status.get('overallStatus')})")
