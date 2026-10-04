import sys, urllib.parse
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))
sys.stdout.reconfigure(encoding='utf-8')
from api_client import fetch_json

queries = [
    'CACNA1A[gene] AND nonsense[clinsig]',
    'CACNA1A[gene] AND "Ter" AND pathogenic[clinsig]',
    'CACNA1A[gene] AND "Arg1358"',
    'CACNA1A[gene] AND "c.4072"',
    'CACNA1A[gene] AND "c.3797"',
    'CACNA1A[gene] AND "Arg1266"',
    'CACNA1A[gene] AND "Arg1330"',
    'CACNA1A[gene] AND "Arg1666"',
    'CACNA1A[gene] AND "Arg1660"',
    'CACNA1A[gene] AND "Arg1456"',
    'CACNA1A[gene] AND "p.Arg192Gln"',
    'CACNA1A[gene] AND "p.Ser218Leu"',
    'CACNA1A[gene] AND "p.Thr666Met"'
]

for q in queries:
    url = f"https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?db=clinvar&retmode=json&term={urllib.parse.quote(q)}"
    d = fetch_json(url)
    ids = d.get('esearchresult', {}).get('idlist', [])
    print(f"\nQuery: {q} -> Found: {len(ids)}")
    if ids:
        surl = f"https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi?db=clinvar&retmode=json&id={','.join(ids[:3])}"
        res = fetch_json(surl).get('result', {})
        for cid in ids[:3]:
            vdata = res.get(cid, {})
            title = vdata.get('title', '')
            sig = vdata.get('clinical_significance', {}).get('description', '')
            print(f"  ClinVar:{cid} | {title} | {sig}")
