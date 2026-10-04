import sys
import urllib.request
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))
sys.stdout.reconfigure(encoding='utf-8')

urls = [
    ("org:cacna1a-foundation", "https://www.cacna1a.org"),
    ("org:national-ataxia-foundation", "https://ataxia.org"),
    ("org:ataxia-uk", "https://www.ataxia.org.uk"),
    ("org:euro-ataxia", "https://www.euroataxia.org"),
    ("org:ataxia-global-initiative", "https://ataxia-global-initiative.net"),
    ("org:rare-epilepsy-network", "https://rareepilepsynetwork.org"),
    ("org:dravet-syndrome-foundation", "https://dravetfoundation.org"),
    ("org:the-migraine-trust", "https://migrainetrust.org"),
    ("asset:tottering-mouse-model", "https://www.jax.org/strain/000544"),
    ("asset:leaner-mouse-model", "https://www.jax.org/strain/000545"),
    ("asset:cacna1a-patient-registry", "https://www.cacna1a.org/patient-registry")
]

UA = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"}

for slug, url in urls:
    req = urllib.request.Request(url, headers=UA)
    try:
        with urllib.request.urlopen(req, timeout=10) as r:
            code = r.getcode()
            print(f"OK {slug}: {url} -> {code}")
    except Exception as e:
        print(f"FAIL {slug}: {url} -> {e}")
