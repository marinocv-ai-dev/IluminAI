import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))
from lookup_entities import search_pubmed

print('1. Klockgether:', search_pubmed('Klockgether[au] AND (SCA OR "spinocerebellar ataxia") AND 2011[dp]'))
print('1b. EUROSCA Lancet Neurol:', search_pubmed('EUROSCA AND "Lancet Neurol"[ta]'))
print('1c. Klockgether Lancet Neurol:', search_pubmed('Klockgether[au] AND "Lancet Neurol"[ta] AND ataxia'))

print('2. Boesch CACNA1A:', search_pubmed('Boesch S[au] AND CACNA1A'))
print('2b. Boesch episodic ataxia:', search_pubmed('Boesch S[au] AND "episodic ataxia"'))

print('3. Kessi CACNA1A:', search_pubmed('Kessi[au] AND CACNA1A'))
print('3b. Kessi Orphanet:', search_pubmed('Kessi M[au] AND "Orphanet J Rare Dis"[ta]'))

print('4. Al-Twaijri Shevell:', search_pubmed('Al-Twaijri[au] AND Shevell[au]'))
print('4b. Al-Twaijri all:', search_pubmed('Al-Twaijri WA[au]'))
