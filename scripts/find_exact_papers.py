import sys
import urllib.parse
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))
sys.stdout.reconfigure(encoding='utf-8')
from api_client import fetch_json

# Jacobi Klockgether EUROSCA Lancet Neurol
q1 = 'Jacobi[au] AND Klockgether[au] AND "Lancet Neurol"[ta]'
url = f"https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?db=pubmed&retmode=json&term={urllib.parse.quote(q1)}"
ids = fetch_json(url).get('esearchresult', {}).get('idlist', [])
print('Jacobi Klockgether Lancet Neurol:', ids)
for i in ids:
    surl = f"https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi?db=pubmed&retmode=json&id={i}"
    sd = fetch_json(surl).get('result', {}).get(i, {})
    print(i, sd.get('title'), sd.get('sortfirstauthor'), sd.get('source'), sd.get('pubdate')[:4])

# Kessi CACNA1A
q2 = 'Kessi M[au] AND (CACNA1A OR calcium)'
url = f"https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?db=pubmed&retmode=json&term={urllib.parse.quote(q2)}"
ids = fetch_json(url).get('esearchresult', {}).get('idlist', [])
print('\nKessi CACNA1A:', ids)
for i in ids:
    surl = f"https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi?db=pubmed&retmode=json&id={i}"
    sd = fetch_json(surl).get('result', {}).get(i, {})
    print(i, sd.get('title'), sd.get('sortfirstauthor'), sd.get('source'), sd.get('pubdate')[:4])

# Indelicato Boesch
q3 = 'Indelicato E[au] AND Boesch S[au]'
url = f"https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?db=pubmed&retmode=json&term={urllib.parse.quote(q3)}"
ids = fetch_json(url).get('esearchresult', {}).get('idlist', [])
print('\nIndelicato Boesch:', ids)
for i in ids:
    surl = f"https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi?db=pubmed&retmode=json&id={i}"
    sd = fetch_json(surl).get('result', {}).get(i, {})
    print(i, sd.get('title'), sd.get('sortfirstauthor'), sd.get('source'), sd.get('pubdate')[:4])
