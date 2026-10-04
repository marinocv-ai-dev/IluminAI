# -*- coding: utf-8 -*-
import json
import urllib.parse
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))
from api_client import fetch_json, fetch_text

def search_pubmed(term):
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

def get_pubmed_abstract(pmid):
    url = f"https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi?db=pubmed&id={pmid}&rettype=abstract&retmode=text"
    return fetch_text(url)

def search_clinvar(term):
    url = f"https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?db=clinvar&retmode=json&term={urllib.parse.quote(term)}"
    d = fetch_json(url)
    ids = d.get("esearchresult", {}).get("idlist", [])
    if not ids:
        return None
    cid = ids[0]
    surl = f"https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi?db=clinvar&retmode=json&id={cid}"
    sd = fetch_json(surl).get("result", {}).get(cid, {})
    return {
        "id": cid,
        "title": sd.get("title", ""),
        "clinical_significance": sd.get("clinical_significance", {}).get("description", "")
    }

def search_clinical_trials(cond=None, intr=None, term=None):
    params = ["fields=protocolSection.identificationModule,protocolSection.statusModule,protocolSection.sponsorCollaboratorsModule,protocolSection.designModule", "pageSize=5"]
    if cond:
        params.append(f"query.cond={urllib.parse.quote(cond)}")
    if intr:
        params.append(f"query.intr={urllib.parse.quote(intr)}")
    if term:
        params.append(f"query.term={urllib.parse.quote(term)}")
    url = f"https://clinicaltrials.gov/api/v2/studies?{'&'.join(params)}"
    d = fetch_json(url)
    studies = d.get("studies", [])
    out = []
    for s in studies:
        proto = s.get("protocolSection", {})
        ident = proto.get("identificationModule", {})
        status = proto.get("statusModule", {})
        design = proto.get("designModule", {})
        sponsor = proto.get("sponsorCollaboratorsModule", {}).get("leadSponsor", {}).get("name", "")
        phases = design.get("phases", [])
        out.append({
            "nct": ident.get("nctId"),
            "title": ident.get("briefTitle"),
            "status": status.get("overallStatus"),
            "phase": phases[0] if phases else "NA",
            "sponsor": sponsor
        })
    return out

if __name__ == "__main__":
    print("Testing PubMed searches...")
    # 1. van den Maagdenberg 2004 Neuron:
    p = search_pubmed('van den Maagdenberg[au] AND Neuron[ta] AND 2004[dp] AND (CACNA1A OR R192Q OR migraine)')
    print("van den Maagdenberg 2004:", p)

    # 2. De Fusco 2003 Nat Genet:
    p = search_pubmed('De Fusco M[au] AND "Nat Genet"[ta] AND (ATP1A2 OR "FHM2" OR migraine)')
    print("De Fusco:", p)

    # 3. Dichgans 2005 Lancet:
    p = search_pubmed('Dichgans M[au] AND Lancet[ta] AND (SCN1A OR "FHM3" OR "hemiplegic migraine")')
    print("Dichgans 2005:", p)

    # 4. Browne 1994 Nat Genet:
    p = search_pubmed('Browne DL[au] AND "Nat Genet"[ta] AND 1994[dp]')
    print("Browne 1994:", p)

    # 5. Jen 2005 Neurology:
    p = search_pubmed('Jen JC[au] AND Neurology[ta] AND 2005[dp] AND (SLC1A3 OR EAAT1 OR ataxia)')
    print("Jen 2005:", p)

    # 6. Klockgether 2011 Lancet Neurol:
    p = search_pubmed('Klockgether T[au] AND "Lancet Neurol"[ta] AND 2011[dp]')
    print("Klockgether 2011:", p)

    # 7. Indelicato & Boesch 2018:
    p = search_pubmed('Indelicato E[au] AND Boesch S[au] AND CACNA1A')
    if not p:
        p = search_pubmed('Indelicato E[au] AND Boesch S[au] AND "episodic ataxia"')
    if not p:
        p = search_pubmed('Indelicato[au] AND Boesch[au] AND 2018[dp]')
    print("Indelicato & Boesch:", p)

    # 8. Kessi 2021:
    p = search_pubmed('Kessi M[au] AND CACNA1A AND 2021[dp]')
    if not p:
        p = search_pubmed('Kessi M[au] AND "Front Cell Neurosci"[ta]')
    print("Kessi 2021:", p)

    # 9. Al-Twaijri 2002:
    p = search_pubmed('Al-Twaijri WA[au] AND Shevell MI[au] AND (ataxia OR "Pediatr Neurol"[ta])')
    print("Al-Twaijri 2002:", p)

    print("\nTesting ClinVar searches...")
    variants = [
        ("R192Q", 'CACNA1A[gene] AND "Arg192Gln"'),
        ("S218L", 'CACNA1A[gene] AND "Ser218Leu"'),
        ("T666M", 'CACNA1A[gene] AND "Thr666Met"'),
        ("R1358Ter", 'CACNA1A[gene] AND ("Arg1358Ter" OR "Arg1358*")'),
        ("R1266Q", 'CACNA1A[gene] AND "Arg1266Gln"'),
        ("R1456H", 'CACNA1A[gene] AND "Arg1456His"'),
        ("R1330Q", 'CACNA1A[gene] AND "Arg1330Gln"'),
        ("R1666H", 'CACNA1A[gene] AND "Arg1666His"')
    ]
    for vname, vq in variants:
        res = search_clinvar(vq)
        print(f"ClinVar {vname}:", res)

    print("\nTesting ClinicalTrials.gov...")
    print("CACNA1A:", search_clinical_trials(term="CACNA1A"))
    print("EA 4-AP:", search_clinical_trials(cond="episodic ataxia", intr="4-aminopyridine"))
    print("EA acetazolamide:", search_clinical_trials(cond="episodic ataxia", intr="acetazolamide"))
    print("SCA troriluzole:", search_clinical_trials(cond="spinocerebellar ataxia", intr="troriluzole"))
    print("Downbeat nystagmus aminopyridine:", search_clinical_trials(cond="downbeat nystagmus", intr="aminopyridine"))
    print("CRC-SCA:", search_clinical_trials(term="Clinical Research Consortium for Spinocerebellar Ataxias"))
