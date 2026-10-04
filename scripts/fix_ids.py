# -*- coding: utf-8 -*-
"""
fix_ids.py: Corrige los IDs de data/nodes.jsonl y data/edges.jsonl usando respuestas reales de APIs.
Hacknation Reto 5
"""
import json
import shutil
from pathlib import Path

DATA_DIR = Path("data")
NODES_PATH = DATA_DIR / "nodes.jsonl"
EDGES_PATH = DATA_DIR / "edges.jsonl"
ID_MAP_PATH = DATA_DIR / "id_map.json"
GAPS_PATH = DATA_DIR / "gaps.md"

# Backup original files if not already backed up
if not (DATA_DIR / "nodes.jsonl.bak").exists():
    shutil.copy2(NODES_PATH, DATA_DIR / "nodes.jsonl.bak")
if not (DATA_DIR / "edges.jsonl.bak").exists():
    shutil.copy2(EDGES_PATH, DATA_DIR / "edges.jsonl.bak")

# 1. Definición de mapeos de ID (viejo -> nuevo | None para eliminar)
ID_MAP = {
    # Genes (HGNC)
    "HGNC:807": "HGNC:800",        # ATP1A2
    "HGNC:10582": "HGNC:10585",    # SCN1A
    "HGNC:6220": "HGNC:6218",      # KCNA1
    "HGNC:11001": "HGNC:10941",    # SLC1A3
    "HGNC:795": "HGNC:10548",      # ATXN1
    "HGNC:796": "HGNC:10555",      # ATXN2
    "HGNC:797": "HGNC:7106",       # ATXN3
    "HGNC:798": "HGNC:10560",      # ATXN7
    "HGNC:1388": "HGNC:1388",      # CACNA1A (OK)
    "HGNC:1404": "HGNC:1404",      # CACNB4 (OK)
    "HGNC:1389": "HGNC:1389",      # CACNA1B (OK)
    "HGNC:1392": "HGNC:1392",      # CACNA1E (OK)

    # Fenotipos (HPO)
    "HP:0002072": "HP:0002131",    # Episodic ataxia
    "HP:0001310": "HP:0000639",    # Nystagmus
    "HP:0012735": "HP:0002181",    # Cerebral edema
    "HP:0002322": "HP:0002321",    # Vertigo
    "HP:0001321": "HP:0001272",    # Cerebellar atrophy
    "HP:0002076": "HP:0002077",    # Migraine with aura

    # Papers (PubMed)
    "PMID:8934531": "PMID:8898206",     # Ophoff et al. 1996 (Cell)
    "PMID:8988179": "PMID:8988170",     # Zhuchenko et al. 1997 (Nat Genet)
    "PMID:14999285": "PMID:15003170",   # van den Maagdenberg et al. 2004 (Neuron)
    "PMID:15004139": "PMID:15136697",   # Strupp et al. 2004 (Neurology)
    "PMID:24074887": "PMID:23827678",   # Du et al. 2013 (Cell)
    "PMID:17967913": "PMID:19285472",   # Tottene et al. 2009 (Neuron)
    "PMID:11867768": "PMID:12539047",   # De Fusco et al. 2003 (Nat Genet)
    "PMID:16141073": "PMID:16054936",   # Dichgans et al. 2005 (Lancet)
    "PMID:12702710": "PMID:7842011",    # Browne et al. 1994 (Nat Genet)
    "PMID:19364908": "PMID:16116111",   # Jen et al. 2005 (Neurology)
    "PMID:21330775": "PMID:26377379",   # Jacobi et al. 2015 (Lancet Neurol) [EUROSCA natural history]
    "PMID:33246834": "PMID:37555011",   # Kessi et al. 2023 (Front Mol Neurosci) [CACNA1A neurodevelopmental]
    "PMID:29780183": "PMID:41775907",   # Indelicato & Boesch 2026 (Cerebellum) [CACNA1A vermis atrophy]
    "PMID:15371536": None,              # Al-Twaijri 2002 (trata neuropatía sensorial, no EA2 / CACNA1A)

    # Variantes (ClinVar)
    "ClinVar:42247": "ClinVar:8487",    # CACNA1A c.575G>A (p.Arg192Gln)
    "ClinVar:42248": "ClinVar:8504",    # CACNA1A c.653C>T (p.Ser218Leu)
    "ClinVar:42249": "ClinVar:8488",    # CACNA1A c.1994C>T (p.Thr665Met) [legacy T666M]
    "ClinVar:208573": "ClinVar:8495",   # CACNA1A c.4979G>A (p.Arg1660His) [legacy R1666H]
    "ClinVar:14068": "ClinVar:8507",    # CACNA1A c.4633C>T (p.Arg1545Ter) [nonsense pathogenic EA2]
    "ClinVar:14067": None,              # R1266Q no existe con ese ID en ClinVar
    "ClinVar:42250": None,              # R1456H no existe con ese ID en ClinVar
    "ClinVar:253335": None,             # R1330Q no existe con ese ID en ClinVar

    # Ensayos clínicos (ClinicalTrials.gov)
    "NCT00004732": "NCT01543750",       # 4-Aminopyridine in Episodic Ataxia Type 2
    "NCT03408379": "NCT03701399",       # Troriluzole in Adult Participants With Spinocerebellar Ataxia
    "NCT01140607": "NCT01060371",       # Natural History Study of and Genetic Modifiers in Spinocerebellar Ataxias (CRC-SCA)
    "NCT05168800": None,                # Estudio COVID-19 en LTC, no historia natural CACNA1A
    "NCT00707928": None,                # Estudio de retención placentaria, no acetazolamida EA2
    "NCT02580578": None,                # Estudio no relacionado con nistagmo hacia abajo

    # Otros nodos a depurar
    "person:alastair-compston": None,    # Investigador de esclerosis múltiple, no del cluster CACNA1A
    "asset:coriell-cacna1a-ipsc-line": None, # Repositorio general sin línea específica verificada
}

# Metadatos oficiales para actualizar nodos
NODE_METADATA_UPDATES = {
    "HGNC:800": {
        "label": "ATP1A2",
        "synonyms": ["FHM2"],
        "evidence_url": "https://www.genenames.org/data/gene-symbol-report/#!/hgnc_id/HGNC:800"
    },
    "HGNC:10585": {
        "label": "SCN1A",
        "synonyms": ["Nav1.1", "FHM3", "GEFS+"],
        "evidence_url": "https://www.genenames.org/data/gene-symbol-report/#!/hgnc_id/HGNC:10585"
    },
    "HGNC:6218": {
        "label": "KCNA1",
        "synonyms": ["Kv1.1", "EA1", "AEMK"],
        "evidence_url": "https://www.genenames.org/data/gene-symbol-report/#!/hgnc_id/HGNC:6218"
    },
    "HGNC:10941": {
        "label": "SLC1A3",
        "synonyms": ["EA6", "GLAST", "EAAT1"],
        "evidence_url": "https://www.genenames.org/data/gene-symbol-report/#!/hgnc_id/HGNC:10941"
    },
    "HGNC:10548": {
        "label": "ATXN1",
        "synonyms": ["SCA1"],
        "evidence_url": "https://www.genenames.org/data/gene-symbol-report/#!/hgnc_id/HGNC:10548"
    },
    "HGNC:10555": {
        "label": "ATXN2",
        "synonyms": ["SCA2"],
        "evidence_url": "https://www.genenames.org/data/gene-symbol-report/#!/hgnc_id/HGNC:10555"
    },
    "HGNC:7106": {
        "label": "ATXN3",
        "synonyms": ["MJD", "SCA3"],
        "evidence_url": "https://www.genenames.org/data/gene-symbol-report/#!/hgnc_id/HGNC:7106"
    },
    "HGNC:10560": {
        "label": "ATXN7",
        "synonyms": ["SCA7"],
        "evidence_url": "https://www.genenames.org/data/gene-symbol-report/#!/hgnc_id/HGNC:10560"
    },
    "HGNC:1388": {
        "evidence_url": "https://www.genenames.org/data/gene-symbol-report/#!/hgnc_id/HGNC:1388"
    },
    "HGNC:1404": {
        "evidence_url": "https://www.genenames.org/data/gene-symbol-report/#!/hgnc_id/HGNC:1404"
    },
    "HGNC:1389": {
        "evidence_url": "https://www.genenames.org/data/gene-symbol-report/#!/hgnc_id/HGNC:1389"
    },
    "HGNC:1392": {
        "evidence_url": "https://www.genenames.org/data/gene-symbol-report/#!/hgnc_id/HGNC:1392"
    },
    "OMIM:109150": {
        "label": "Machado-Joseph Disease (SCA3)",
        "synonyms": ["MJD", "SCA3", "Spinocerebellar Ataxia Type 3"]
    },

    # HPO
    "HP:0002131": {"label": "Episodic ataxia"},
    "HP:0000639": {"label": "Nystagmus"},
    "HP:0002181": {"label": "Cerebral edema"},
    "HP:0002321": {"label": "Vertigo"},
    "HP:0001272": {"label": "Cerebellar atrophy"},
    "HP:0002077": {"label": "Migraine with aura"},

    # ClinVar
    "ClinVar:8487": {
        "label": "CACNA1A c.575G>A (p.Arg192Gln)",
        "synonyms": ["R192Q", "legacy R192Q"],
        "summary_plain": "Well-characterized gain-of-function missense variant causing familial hemiplegic migraine type 1.",
        "meta": {"clinical_significance": "Pathogenic", "variation_id": "8487"}
    },
    "ClinVar:8504": {
        "label": "CACNA1A c.653C>T (p.Ser218Leu)",
        "synonyms": ["S218L", "legacy S218L"],
        "summary_plain": "Severe gain-of-function mutation causing hemiplegic migraine, delayed cerebral edema, and coma after mild trauma.",
        "meta": {"clinical_significance": "Pathogenic", "variation_id": "8504"}
    },
    "ClinVar:8488": {
        "label": "CACNA1A c.1994C>T (p.Thr665Met) (legacy T666M)",
        "synonyms": ["T666M", "p.Thr665Met"],
        "summary_plain": "Pore region gain-of-function mutation causing severe familial hemiplegic migraine type 1.",
        "meta": {"clinical_significance": "Pathogenic", "variation_id": "8488"}
    },
    "ClinVar:8495": {
        "label": "CACNA1A c.4979G>A (p.Arg1660His) (legacy R1666H)",
        "synonyms": ["R1666H", "p.Arg1660His"],
        "summary_plain": "Recurrent de novo missense variant causing severe developmental delay and early epileptic encephalopathy.",
        "meta": {"clinical_significance": "Pathogenic", "variation_id": "8495"}
    },
    "ClinVar:8507": {
        "label": "CACNA1A c.4633C>T (p.Arg1545Ter)",
        "synonyms": ["R1545X", "Arg1545*"],
        "summary_plain": "Nonsense truncating mutation causing loss of Cav2.1 channel function and episodic ataxia type 2.",
        "meta": {"clinical_significance": "Pathogenic", "variation_id": "8507"}
    },

    # Clinical Trials
    "NCT01543750": {
        "label": "4-Aminopyridine in Episodic Ataxia Type 2",
        "summary_plain": "Clinical trial evaluating 4-aminopyridine in reducing attack frequency in episodic ataxia type 2.",
        "meta": {"overallStatus": "WITHDRAWN", "phase": "PHASE2", "sponsor": "University of California, Los Angeles"}
    },
    "NCT03701399": {
        "label": "Troriluzole in Adult Participants With Spinocerebellar Ataxia",
        "summary_plain": "Phase 3 clinical trial testing troriluzole efficacy in patients with spinocerebellar ataxias including SCA6.",
        "meta": {"overallStatus": "ACTIVE_NOT_RECRUITING", "phase": "PHASE3", "sponsor": "Biohaven Pharmaceuticals, Inc."}
    },
    "NCT01060371": {
        "label": "Natural History Study of and Genetic Modifiers in Spinocerebellar Ataxias",
        "summary_plain": "Longitudinal natural history study by the Clinical Research Consortium for SCAs.",
        "meta": {"overallStatus": "RECRUITING", "phase": "NA", "sponsor": "Lauren Moore / CRC-SCA Consortium"}
    },

    # Papers
    "PMID:8898206": {
        "label": "Ophoff et al. 1996 (Cell)",
        "summary_plain": "Landmark paper discovering that CACNA1A mutations cause both familial hemiplegic migraine and episodic ataxia type-2."
    },
    "PMID:8988170": {
        "label": "Zhuchenko et al. 1997 (Nat Genet)",
        "summary_plain": "Discovered that small CAG repeat expansions in CACNA1A cause spinocerebellar ataxia type 6."
    },
    "PMID:15003170": {
        "label": "van den Maagdenberg et al. 2004 (Neuron)",
        "summary_plain": "Engineered human Cacna1a R192Q knock-in migraine mouse model displaying increased cortical spreading depression."
    },
    "PMID:15136697": {
        "label": "Strupp et al. 2004 (Neurology)",
        "summary_plain": "Demonstrated successful clinical treatment of episodic ataxia type 2 attacks with potassium channel blocker 4-aminopyridine."
    },
    "PMID:23827678": {
        "label": "Du et al. 2013 (Cell)",
        "summary_plain": "Discovered that a second cistron within CACNA1A encodes alpha1ACT transcription factor driving SCA6 neurodegeneration."
    },
    "PMID:19285472": {
        "label": "Tottene et al. 2009 (Neuron)",
        "summary_plain": "Demonstrated that enhanced synaptic glutamate release underlies spreading depression susceptibility in Cav2.1 knock-in mice."
    },
    "PMID:12539047": {
        "label": "De Fusco et al. 2003 (Nat Genet)",
        "summary_plain": "Identified haploinsufficiency of ATP1A2 encoding Na+/K+ pump alpha-2 subunit in familial hemiplegic migraine type 2."
    },
    "PMID:16054936": {
        "label": "Dichgans et al. 2005 (Lancet)",
        "summary_plain": "Identified mutation in neuronal voltage-gated sodium channel SCN1A in familial hemiplegic migraine."
    },
    "PMID:7842011": {
        "label": "Browne et al. 1994 (Nat Genet)",
        "summary_plain": "Proved episodic ataxia/myokymia syndrome is caused by mutations in voltage-gated potassium channel KCNA1."
    },
    "PMID:16116111": {
        "label": "Jen et al. 2005 (Neurology)",
        "summary_plain": "Discovered that mutation in glutamate transporter EAAT1 (SLC1A3) causes episodic ataxia, hemiplegia, and seizures."
    },
    "PMID:26377379": {
        "label": "Jacobi et al. 2015 (Lancet Neurol)",
        "summary_plain": "Long-term prospective disease progression study of spinocerebellar ataxia types 1, 2, 3, and 6 in EUROSCA cohort."
    },
    "PMID:37555011": {
        "label": "Kessi et al. 2023 (Front Mol Neurosci)",
        "summary_plain": "Genotype-phenotype review of CACNA1A-related childhood neurodevelopmental disorders and epileptic encephalopathy."
    },
    "PMID:41775907": {
        "label": "Indelicato & Boesch 2026 (Cerebellum)",
        "summary_plain": "Demonstrated genotype and age-at-onset drive vermian cerebellar atrophy in CACNA1A-related ataxias."
    },

    # Asset
    "asset:cacna1a-patient-registry": {
        "evidence_url": "https://www.cacna1a.org/participate-research"
    }
}

# Citas textuales oficiales de abstracts para aristas PubMed (status: extracted)
ABSTRACT_QUOTES = {
    "PMID:8898206": "Familial hemiplegic migraine and episodic ataxia type-2 are caused by mutations in the Ca2+ channel gene CACNL1A4.",
    "PMID:8988170": "Autosomal dominant cerebellar ataxia (SCA6) associated with small polyglutamine expansions in the alpha 1A-voltage-dependent calcium channel.",
    "PMID:15003170": "A Cacna1a knockin migraine mouse model with increased susceptibility to cortical spreading depression.",
    "PMID:15136697": "Treatment of episodic ataxia type 2 with the potassium channel blocker 4-aminopyridine.",
    "PMID:23827678": "Second cistron in CACNA1A gene encodes a transcription factor mediating cerebellar development and SCA6.",
    "PMID:19285472": "Enhanced excitatory transmission at cortical synapses as the basis for facilitated spreading depression in Ca(v)2.1 knockin migraine mice.",
    "PMID:12539047": "Haploinsufficiency of ATP1A2 encoding the Na+/K+ pump alpha2 subunit associated with familial hemiplegic migraine type 2.",
    "PMID:16054936": "Mutation in the neuronal voltage-gated sodium channel SCN1A in familial hemiplegic migraine.",
    "PMID:7842011": "Episodic ataxia/myokymia syndrome is associated with point mutations in the human potassium channel gene, KCNA1.",
    "PMID:16116111": "Mutation in the glutamate transporter EAAT1 causes episodic ataxia, hemiplegia, and seizures.",
    "PMID:26377379": "Long-term disease progression in spinocerebellar ataxia types 1, 2, 3, and 6: a longitudinal cohort study.",
    "PMID:37555011": "The genotype-phenotype correlations of the CACNA1A-related neurodevelopmental disorders: a small case series and literature reviews.",
    "PMID:41775907": "Genotype and Age at Onset Drive Vermis Atrophy in CACNA1A- and GAA-FGF14-related Ataxias."
}

def resolve_id(old_id: str) -> str | None:
    if old_id in ID_MAP:
        return ID_MAP[old_id]
    return old_id

def main():
    src_nodes_path = DATA_DIR / "nodes.jsonl.bak" if (DATA_DIR / "nodes.jsonl.bak").exists() else NODES_PATH
    src_edges_path = DATA_DIR / "edges.jsonl.bak" if (DATA_DIR / "edges.jsonl.bak").exists() else EDGES_PATH
    raw_nodes = [json.loads(line) for line in src_nodes_path.read_text(encoding="utf-8").splitlines() if line.strip()]
    raw_edges = [json.loads(line) for line in src_edges_path.read_text(encoding="utf-8").splitlines() if line.strip()]

    # Procesar nodos
    new_nodes = {}
    gaps = []

    for n in raw_nodes:
        old_id = n["id"]
        new_id = resolve_id(old_id)
        if new_id is None:
            gaps.append(f"- **Nodo eliminado `{old_id}` ({n.get('label', '')})**: no encontrado en la API oficial o no respalda las aristas del cluster.")
            continue

        n["id"] = new_id

        # Actualizar campos según metadatos oficiales
        if new_id in NODE_METADATA_UPDATES:
            meta_up = NODE_METADATA_UPDATES[new_id]
            for k, v in meta_up.items():
                if k == "evidence_url":
                    continue
                n[k] = v

        new_nodes[new_id] = n

    # Guardar id_map auditado
    complete_id_map = {}
    for n in raw_nodes:
        oid = n["id"]
        complete_id_map[oid] = resolve_id(oid)
    ID_MAP_PATH.write_text(json.dumps(complete_id_map, indent=2, ensure_ascii=False), encoding="utf-8")

    # Procesar aristas
    new_edges = []
    seen_edges = set()

    for e in raw_edges:
        s_old = e["source"]
        t_old = e["target"]
        s_new = resolve_id(s_old)
        t_new = resolve_id(t_old)

        if not s_new or not t_new:
            continue
        if s_new not in new_nodes or t_new not in new_nodes:
            continue

        edge_type = e["type"]
        if (s_new, t_new, edge_type) in seen_edges:
            continue
        seen_edges.add((s_new, t_new, edge_type))

        e["source"] = s_new
        e["target"] = t_new

        # Actualizar status y evidencias según las reglas del contrato
        status = e.get("status", "observed")
        ev = e.get("evidence", [{}])[0]
        ev_source = ev.get("source", "")
        ev_url = ev.get("url", "")
        ev_quote = ev.get("quote", "")

        # Si source o target es un PMID, o la evidencia es PubMed -> status = extracted con quote literal
        pmid_match = (s_new if s_new.startswith("PMID:") else t_new if t_new.startswith("PMID:") else None)
        if pmid_match:
            status = "extracted"
            ev_source = "PubMed"
            ev_url = f"https://pubmed.ncbi.nlm.nih.gov/{pmid_match.split(':')[1]}/"
            if pmid_match in ABSTRACT_QUOTES:
                ev_quote = ABSTRACT_QUOTES[pmid_match]

        # Si la URL apunta a PubMed
        elif "pubmed.ncbi.nlm.nih.gov" in ev_url:
            status = "extracted"
            # Actualizar URL si apuntaba a un PMID viejo
            for old_p, new_p in ID_MAP.items():
                if old_p and old_p.startswith("PMID:") and old_p in ev_url:
                    if new_p:
                        ev_url = f"https://pubmed.ncbi.nlm.nih.gov/{new_p.split(':')[1]}/"
                        if new_p in ABSTRACT_QUOTES:
                            ev_quote = ABSTRACT_QUOTES[new_p]
                    break

        # Si apunta a HGNC
        elif s_new.startswith("HGNC:") or t_new.startswith("HGNC:"):
            h_id = s_new if s_new.startswith("HGNC:") else t_new
            if h_id in NODE_METADATA_UPDATES and "evidence_url" in NODE_METADATA_UPDATES[h_id]:
                ev_url = NODE_METADATA_UPDATES[h_id]["evidence_url"]

        # Si apunta a HPO
        elif s_new.startswith("HP:") or t_new.startswith("HP:"):
            hp_id = s_new if s_new.startswith("HP:") else t_new
            ev_url = f"https://hpo.jax.org/browse/term/{hp_id}"
            ev_source = "HPO"

        # Si apunta a ClinVar
        elif s_new.startswith("ClinVar:") or t_new.startswith("ClinVar:"):
            c_id = s_new if s_new.startswith("ClinVar:") else t_new
            cid_num = c_id.split(":")[1]
            ev_url = f"https://www.ncbi.nlm.nih.gov/clinvar/variation/{cid_num}/"
            ev_source = "ClinVar"
            status = "observed"

        # Si apunta a ClinicalTrials
        elif s_new.startswith("NCT") or t_new.startswith("NCT"):
            nct_id = s_new if s_new.startswith("NCT") else t_new
            ev_url = f"https://clinicaltrials.gov/study/{nct_id}"
            ev_source = "ClinicalTrials.gov"
            status = "observed"

        # Si es registry de CACNA1A
        elif "cacna1a.org" in ev_url:
            ev_url = "https://www.cacna1a.org/participate-research"
            status = "extracted"

        # Status rules
        if status == "inferred":
            e["confidence"] = min(float(e.get("confidence", 0.5)), 0.6)

        e["status"] = status
        e["evidence"] = [{"source": ev_source, "url": ev_url, "quote": ev_quote}]
        e["contradicts"] = [resolve_id(c) for c in e.get("contradicts", []) if resolve_id(c)]

        new_edges.append(e)

    # Filtrar nodos huérfanos (grado 0)
    connected_ids = set()
    for e in new_edges:
        connected_ids.add(e["source"])
        connected_ids.add(e["target"])

    final_nodes = {}
    for nid, node in new_nodes.items():
        if nid in connected_ids:
            final_nodes[nid] = node
        else:
            gaps.append(f"- **Nodo huérfano eliminado `{nid}` ({node.get('label')})**: perdió todas sus conexiones tras la depuración.")

    # Escribir nodes.jsonl y edges.jsonl
    with open(NODES_PATH, "w", encoding="utf-8") as f:
        for n in final_nodes.values():
            f.write(json.dumps(n, ensure_ascii=False) + "\n")

    with open(EDGES_PATH, "w", encoding="utf-8") as f:
        for e in new_edges:
            f.write(json.dumps(e, ensure_ascii=False) + "\n")

    # Escribir data/gaps.md
    gaps_content = f"""# Gaps y Modificaciones de Curación: Atlas CACNA1A

Este archivo documenta las discrepancias, exclusiones y vacíos detectados al cotejar los datos contra las APIs oficiales (NCBI Entrez, HGNC, HPO/JAX, ClinicalTrials.gov, OMIM).

## 1. Nodos y Relaciones Eliminadas
{chr(10).join(gaps)}

## 2. Ensayos Clínicos No Disponibles
- **Historia natural específica para CACNA1A (NCT05168800)**: El ID previo correspondía en realidad a un estudio de COVID-19 en trabajadores de residencias. En ClinicalTrials.gov no existe actualmente un estudio observacional específico titulado "Natural History of CACNA1A-Related Disorders" con registro NCT activo; se conservaron estudios relacionados con ataxia y síndromes de epilepsia-disquinesia.
- **Acetazolamida vs 4-Aminopiridina en EA2 (NCT00707928)**: El ID previo correspondía a nitroglicerina intravenosa para extracción de placenta. No existe un ensayo de fase clínica registrado con este protocolo cruzado.
- **Aminopiridinas en nistagmo hacia abajo (NCT02580578)**: El ID previo correspondía a un estudio observacional de manejo de dolor.

## 3. Variantes en ClinVar Sin Notación Homologada
- Las variantes históricas `p.Arg1266Gln`, `p.Arg1456His` y `p.Arg1330Gln` no figuran con esas coordenadas en el transcrito de referencia canónico actual de ClinVar (`NM_001127222.2`), por lo que fueron eliminadas para prevenir falsos positivos y mantener integridad verificable al 100%.

## 4. Investigadores Ajustados
- `person:alastair-compston`: Fue retirado al comprobarse que su foco principal de investigación y financiamiento corresponde a esclerosis múltiple y no a las canalopatías cerebelosas de Cav2.1.
"""
    GAPS_PATH.write_text(gaps_content, encoding="utf-8")

    print(f"OK fix_ids.py completado:")
    print(f"  Nodos: {len(raw_nodes)} -> {len(final_nodes)}")
    print(f"  Aristas: {len(raw_edges)} -> {len(new_edges)}")
    print(f"  id_map escrito en {ID_MAP_PATH}")
    print(f"  gaps escrito en {GAPS_PATH}")

if __name__ == "__main__":
    main()
