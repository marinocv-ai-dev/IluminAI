import urllib.request
import urllib.parse
import json
import time

UA = {"User-Agent": "iluminai-hackathon/1.0", "Accept": "application/json"}

def get_json(url):
    req = urllib.request.Request(url, headers=UA)
    with urllib.request.urlopen(req, timeout=15) as r:
        return json.load(r)

# 1. PubMed papers search
# The 14 target papers from instructions:
# Ophoff 1996 Cell
# Zhuchenko 1997 Nat Genet
# van den Maagdenberg 2004 Neuron
# Strupp 2004 Neurology
# Du 2013 Cell
# Indelicato & Boesch 2018
# Kessi 2021 Front Cell Neurosci
# Tottene 2009 J Neurosci
# De Fusco 2003 Nat Genet
# Dichgans 2005 Lancet
# Browne 1994 Nat Genet
# Jen 2005 Neurology
# Klockgether 2011 Lancet Neurol
# Al-Twaijri & Shevell 2002 Pediatr Neurol

paper_queries = [
    ("Ophoff 1996", 'Ophoff[au] AND 1996[dp] AND (CACNA1A OR "familial hemiplegic migraine" OR "episodic ataxia")'),
    ("Zhuchenko 1997", 'Zhuchenko[au] AND 1997[dp] AND (SCA6 OR "spinocerebellar ataxia" OR CACNA1A)'),
    ("van den Maagdenberg 2004", 'van den Maagdenberg[au] AND 2004[dp] AND (CACNA1A OR R192Q OR migraine)'),
    ("Strupp 2004", 'Strupp[au] AND 2004[dp] AND ("aminopyridine" OR "episodic ataxia")'),
    ("Du 2013", 'Du[au] AND 2013[dp] AND (CACNA1A OR SCA6 OR alpha1ACT OR "bicistronic")'),
    ("Indelicato 2018", 'Indelicato[au] AND 2018[dp] AND (CACNA1A OR ataxia)'),
    ("Kessi 2021", 'Kessi[au] AND 2021[dp] AND (CACNA1A OR "epileptic encephalopathy")'),
    ("Tottene 2009", 'Tottene[au] AND 2009[dp] AND (Cav2.1 OR CACNA1A OR "spreading depression")'),
    ("De Fusco 2003", 'De Fusco[au] AND (ATP1A2 OR "FHM2" OR "hemiplegic migraine")'),
    ("Dichgans 2005", 'Dichgans[au] AND 2005[dp] AND (SCN1A OR "FHM3" OR "hemiplegic migraine" OR Lancet)'),
    ("Browne 1994", 'Browne[au] AND 1994[dp] AND (KCNA1 OR "episodic ataxia" OR myokymia)'),
    ("Jen 2005", 'Jen JC[au] AND (SLC1A3 OR EAAT1 OR "episodic ataxia")'),
    ("Klockgether 2011", 'Klockgether[au] AND 2011[dp] AND ("spinocerebellar ataxia" OR EUROSCA OR "Lancet Neurol")'),
    ("Al-Twaijri 2002", 'Al-Twaijri[au] AND 2002[dp] AND (ataxia OR Shevell)')
]

print("=== SEARCHING PUBMED ===")
pubmed_results = {}
for name, q in paper_queries:
    url = f"https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?db=pubmed&retmode=json&term={urllib.parse.quote(q)}"
    res = get_json(url)
    id_list = res.get("esearchresult", {}).get("idlist", [])
    if id_list:
        pmid = id_list[0]
        # get summary
        surl = f"https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi?db=pubmed&retmode=json&id={pmid}"
        sres = get_json(surl).get("result", {}).get(pmid, {})
        title = sres.get("title", "")
        author = sres.get("sortfirstauthor", "")
        source = sres.get("source", "")
        pubdate = sres.get("pubdate", "")[:4]
        pubmed_results[name] = (pmid, title, author, source, pubdate)
        print(f"{name} -> PMID:{pmid} | {author} et al. {pubdate} ({source}) | {title[:60]}")
    else:
        print(f"{name} -> NOT FOUND with query: {q}")
    time.sleep(0.35)

print("\n=== SEARCHING CLINVAR ===")
# ClinVar variants
# R192Q, S218L, T666M, R1358Ter, R1266Q, R1456His, R1330Gln, R1666His
clinvar_queries = [
    ("R192Q", 'CACNA1A[gene] AND ("Arg192Gln" OR "R192Q" OR "Arg195Gln")'),
    ("S218L", 'CACNA1A[gene] AND ("Ser218Leu" OR "S218L" OR "Ser221Leu")'),
    ("T666M", 'CACNA1A[gene] AND ("Thr666Met" OR "T666M" OR "Thr669Met" OR "Thr674Met" OR "Thr713Met")'),
    ("R1358Ter", 'CACNA1A[gene] AND ("Arg1358Ter" OR "R1358X" OR "Arg1358*")'),
    ("R1266Q", 'CACNA1A[gene] AND ("Arg1266Gln" OR "R1266Q")'),
    ("R1456H", 'CACNA1A[gene] AND ("Arg1456His" OR "R1456H")'),
    ("R1330Q", 'CACNA1A[gene] AND ("Arg1330Gln" OR "R1330Q")'),
    ("R1666H", 'CACNA1A[gene] AND ("Arg1666His" OR "R1666H")')
]

for name, q in clinvar_queries:
    url = f"https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?db=clinvar&retmode=json&term={urllib.parse.quote(q)}"
    res = get_json(url)
    id_list = res.get("esearchresult", {}).get("idlist", [])
    if id_list:
        cid = id_list[0]
        surl = f"https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi?db=clinvar&retmode=json&id={cid}"
        sres = get_json(surl).get("result", {}).get(cid, {})
        title = sres.get("title", "")
        sig = sres.get("clinical_significance", {}).get("description", "")
        print(f"{name} -> ClinVar:{cid} | {title} | Sig: {sig}")
    else:
        print(f"{name} -> NOT FOUND")
    time.sleep(0.35)

print("\n=== SEARCHING CLINICALTRIALS.GOV ===")
trials = [
    ("CACNA1A natural history", "https://clinicaltrials.gov/api/v2/studies?query.term=CACNA1A&fields=protocolSection.identificationModule,protocolSection.statusModule,protocolSection.sponsorCollaboratorsModule&pageSize=5"),
    ("4-AP episodic ataxia", "https://clinicaltrials.gov/api/v2/studies?query.cond=episodic+ataxia&query.intr=4-aminopyridine&fields=protocolSection.identificationModule,protocolSection.statusModule,protocolSection.sponsorCollaboratorsModule&pageSize=5"),
    ("Acetazolamide episodic ataxia", "https://clinicaltrials.gov/api/v2/studies?query.cond=episodic+ataxia&query.intr=acetazolamide&fields=protocolSection.identificationModule,protocolSection.statusModule,protocolSection.sponsorCollaboratorsModule&pageSize=5"),
    ("Troriluzole SCA", "https://clinicaltrials.gov/api/v2/studies?query.cond=spinocerebellar+ataxia&query.intr=troriluzole&fields=protocolSection.identificationModule,protocolSection.statusModule,protocolSection.sponsorCollaboratorsModule&pageSize=5"),
    ("Aminopyridines downbeat nystagmus", "https://clinicaltrials.gov/api/v2/studies?query.cond=downbeat+nystagmus&query.intr=aminopyridine&fields=protocolSection.identificationModule,protocolSection.statusModule,protocolSection.sponsorCollaboratorsModule&pageSize=5"),
    ("CRC-SCA", "https://clinicaltrials.gov/api/v2/studies?query.term=Clinical+Research+Consortium+for+Spinocerebellar+Ataxias&fields=protocolSection.identificationModule,protocolSection.statusModule,protocolSection.sponsorCollaboratorsModule&pageSize=5")
]

for name, url in trials:
    d = get_json(url)
    studies = d.get("studies", [])
    print(f"\n{name} (found {len(studies)}):")
    for s in studies[:2]:
        nct_id = s["protocolSection"]["identificationModule"]["nctId"]
        brief_title = s["protocolSection"]["identificationModule"]["briefTitle"]
        overall_status = s["protocolSection"]["statusModule"]["overallStatus"]
        print(f"  {nct_id}: {brief_title} ({overall_status})")
