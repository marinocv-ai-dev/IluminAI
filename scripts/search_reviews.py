import sys, urllib.parse
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))
from api_client import fetch_json

url = f"https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?db=pubmed&retmode=json&term={urllib.parse.quote('CACNA1A[ti] AND review')}&retmax=10"
ids = fetch_json(url).get('esearchresult', {}).get('idlist', [])
print('CACNA1A reviews:', ids)
if ids:
    surl = f"https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi?db=pubmed&retmode=json&id={','.join(ids[:5])}"
    res = fetch_json(surl).get('result', {})
    for i in ids[:5]:
        print(i, res.get(i, {}).get('title'), res.get(i, {}).get('sortfirstauthor'), res.get(i, {}).get('source'), res.get(i, {}).get('pubdate')[:4])

# EUROSCA Klockgether 2011 Lancet Neurol
url2 = f"https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?db=pubmed&retmode=json&term={urllib.parse.quote('EUROSCA[ti] OR (EUROSCA AND Klockgether[au])')}&retmax=10"
ids2 = fetch_json(url2).get('esearchresult', {}).get('idlist', [])
print('\nEUROSCA papers:', ids2)
if ids2:
    surl2 = f"https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi?db=pubmed&retmode=json&id={','.join(ids2[:5])}"
    res2 = fetch_json(surl2).get('result', {})
    for i in ids2[:5]:
        print(i, res2.get(i, {}).get('title'), res2.get(i, {}).get('sortfirstauthor'), res2.get(i, {}).get('source'), res2.get(i, {}).get('pubdate')[:4])
