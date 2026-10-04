import sys, urllib.parse
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))
sys.stdout.reconfigure(encoding='utf-8')
from api_client import fetch_json

# Check NCT01060371
url = "https://clinicaltrials.gov/api/v2/studies/NCT01060371"
d = fetch_json(url)
ident = d.get("protocolSection", {}).get("identificationModule", {})
status = d.get("protocolSection", {}).get("statusModule", {})
print("NCT01060371:", ident.get("briefTitle"), "| Status:", status.get("overallStatus"))

# Check NCT01543750
url2 = "https://clinicaltrials.gov/api/v2/studies/NCT01543750"
d2 = fetch_json(url2)
ident2 = d2.get("protocolSection", {}).get("identificationModule", {})
status2 = d2.get("protocolSection", {}).get("statusModule", {})
print("NCT01543750:", ident2.get("briefTitle"), "| Status:", status2.get("overallStatus"))

# Check NCT03701399
url3 = "https://clinicaltrials.gov/api/v2/studies/NCT03701399"
d3 = fetch_json(url3)
ident3 = d3.get("protocolSection", {}).get("identificationModule", {})
status3 = d3.get("protocolSection", {}).get("statusModule", {})
print("NCT03701399:", ident3.get("briefTitle"), "| Status:", status3.get("overallStatus"))

# Search Strupp trials on ClinicalTrials.gov
url4 = f"https://clinicaltrials.gov/api/v2/studies?query.term={urllib.parse.quote('Michael Strupp')}&pageSize=10"
d4 = fetch_json(url4)
for s in d4.get("studies", []):
    id_m = s.get("protocolSection", {}).get("identificationModule", {})
    st_m = s.get("protocolSection", {}).get("statusModule", {})
    print("Strupp trial:", id_m.get("nctId"), id_m.get("briefTitle"), st_m.get("overallStatus"))
