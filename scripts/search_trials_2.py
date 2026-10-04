import sys, urllib.parse
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))
sys.stdout.reconfigure(encoding='utf-8')
from api_client import fetch_json

term = "4-aminopyridine nystagmus"
url = f"https://clinicaltrials.gov/api/v2/studies?query.term={urllib.parse.quote(term)}&pageSize=5"
d = fetch_json(url)
print("4-aminopyridine nystagmus:")
for s in d.get('studies', []):
    id_m = s.get('protocolSection', {}).get('identificationModule', {})
    print(" ", id_m.get('nctId'), id_m.get('briefTitle'))

term2 = "episodic ataxia acetazolamide"
url2 = f"https://clinicaltrials.gov/api/v2/studies?query.term={urllib.parse.quote(term2)}&pageSize=5"
d2 = fetch_json(url2)
print("episodic ataxia acetazolamide:")
for s in d2.get('studies', []):
    id_m = s.get('protocolSection', {}).get('identificationModule', {})
    print(" ", id_m.get('nctId'), id_m.get('briefTitle'))

term3 = "CACNA1A"
url3 = f"https://clinicaltrials.gov/api/v2/studies?query.term={urllib.parse.quote(term3)}&pageSize=5"
d3 = fetch_json(url3)
print("CACNA1A studies:")
for s in d3.get('studies', []):
    id_m = s.get('protocolSection', {}).get('identificationModule', {})
    print(" ", id_m.get('nctId'), id_m.get('briefTitle'))
