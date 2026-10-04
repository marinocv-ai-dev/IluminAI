import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))
sys.stdout.reconfigure(encoding='utf-8')
from lookup_entities import get_pubmed_abstract

pmids = ['8898206', '8988170', '15003170', '15136697', '23827678', '19285472', '12539047', '16054936', '7842011', '16116111', '26377379', '37555011', '41775907']
for p in pmids:
    txt = get_pubmed_abstract(p)
    lines = [line.strip() for line in txt.splitlines() if line.strip() and not line.startswith("1.") and not line.startswith("Author information") and not line.startswith("PMID:")]
    abstract = " ".join(lines[:6])
    print(f"\nPMID:{p} -> Abstract snippet:")
    print(abstract[:250])
