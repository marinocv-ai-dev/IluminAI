import sqlite3
import requests


def inicializar_db(db_path: str = "cacna1a_atlas.db"):
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()

    # 1. Genes (HGNC:<número>)
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS Genes (
        gene_id TEXT PRIMARY KEY,
        symbol TEXT,
        name TEXT,
        source_url TEXT
    );""")

    # 2. Enfermedades (OMIM:<número> / MONDO:<número> / ORPHA:<número>)
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS Diseases (
        disease_id TEXT PRIMARY KEY,
        name TEXT,
        source_url TEXT
    );""")

    # 3. Fenotipos (HP:<7 dígitos>)
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS Phenotypes (
        hp_id TEXT PRIMARY KEY,
        term TEXT,
        source_url TEXT
    );""")

    # 4. Variantes (ClinVar:<número>)
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS Variants (
        clinvar_id TEXT PRIMARY KEY,
        title TEXT,
        gene_id TEXT,
        clinical_significance TEXT,
        source_url TEXT,
        FOREIGN KEY (gene_id) REFERENCES Genes(gene_id)
    );""")

    # 5. Papers (PMID:<número>)
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS Papers (
        pmid_id TEXT PRIMARY KEY,
        title TEXT,
        journal TEXT,
        pub_date TEXT,
        gene_id TEXT,
        FOREIGN KEY (gene_id) REFERENCES Genes(gene_id)
    );""")

    # 6. Ensayos Clínicos (NCT<8 dígitos>)
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS Clinical_Trials (
        nct_id TEXT PRIMARY KEY,
        title TEXT,
        status TEXT,
        conditions TEXT,
        source_url TEXT
    );""")

    # 7. Otros (org:<slug>, person:<slug>, asset:<slug>, mech:<slug>, tx:<slug>, funder:<slug>)
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS Entity_Assets (
        asset_id TEXT PRIMARY KEY,
        entity_type TEXT,
        name TEXT,
        source_url TEXT
    );""")

    conn.commit()
    conn.close()
    print(
        "✅ Base de datos SQLite inicializada con el esquema de ontología canónica."
    )


def ejecutar_scraper(db_path: str = "cacna1a_atlas.db"):
    inicializar_db(db_path)
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()

    # --- 1. GENES (HGNC:1388) ---
    cursor.execute(
        """
    INSERT OR REPLACE INTO Genes (gene_id, symbol, name, source_url)
    VALUES (?, ?, ?, ?)
    """,
        (
            "HGNC:1388",
            "CACNA1A",
            "calcium voltage-gated channel subunit alpha1 A",
            "https://www.genenames.org/data/gene-symbol-report/#!/hgnc_id/HGNC:1388",
        ),
    )

    # --- 2. ENFERMEDADES (OMIM / ORPHA / MONDO) ---
    enfermedades = [
        (
            "OMIM:601011",
            "Episodic Ataxia, Type 2 (EA2)",
            "https://omim.org/entry/601011",
        ),
        (
            "OMIM:141500",
            "Familial Hemiplegic Migraine 1 (FHM1)",
            "https://omim.org/entry/141500",
        ),
        (
            "OMIM:183086",
            "Spinocerebellar Ataxia 6 (SCA6)",
            "https://omim.org/entry/183086",
        ),
    ]
    for d_id, name, url in enfermedades:
        cursor.execute(
            "INSERT OR REPLACE INTO Diseases VALUES (?, ?, ?)", (d_id, name, url)
        )

    # --- 3. FENOTIPOS (HP:0002131, etc.) ---
    fenotipos = [
        (
            "HP:0002131",
            "Episodic ataxia",
            "https://hpo.jax.org/app/browse/term/HP:0002131",
        ),
        ("HP:0001251", "Ataxia", "https://hpo.jax.org/app/browse/term/HP:0001251"),
        (
            "HP:0002076",
            "Migraine",
            "https://hpo.jax.org/app/browse/term/HP:0002076",
        ),
    ]
    for hp_id, term, url in fenotipos:
        cursor.execute(
            "INSERT OR REPLACE INTO Phenotypes VALUES (?, ?, ?)",
            (hp_id, term, url),
        )

    # --- 4. VARIANTES CLINVAR (ClinVar:<número>) ---
    print("📥 Extrayendo variantes de ClinVar...")
    try:
        cv_search = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?db=clinvar&term=CACNA1A[gene]&retmode=json&retmax=10"
        resp = requests.get(cv_search, timeout=10).json()
        cv_ids = resp.get("esearchresult", {}).get("idlist", [])

        if cv_ids:
            cv_summary = f"https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi?db=clinvar&id={','.join(cv_ids)}&retmode=json"
            cv_data = (
                requests.get(cv_summary, timeout=10).json().get("result", {})
            )
            for cv_id in cv_ids:
                if cv_id in cv_data:
                    title = cv_data[cv_id].get("title", "Variante CACNA1A")
                    signif = (
                        cv_data[cv_id]
                        .get("clinical_significance", {})
                        .get("description", "Uncertain significance")
                    )
                    canonical_cv = f"ClinVar:{cv_id}"
                    source_url = f"https://www.ncbi.nlm.nih.gov/clinvar/variation/{cv_id}/"
                    cursor.execute(
                        "INSERT OR REPLACE INTO Variants VALUES (?, ?, ?, ?, ?)",
                        (canonical_cv, title, "HGNC:1388", signif, source_url),
                    )
            print(f"  └─ Guardadas {len(cv_ids)} variantes (ClinVar:<id>)")
    except Exception as e:
        print(f"⚠️ Error al consultar ClinVar: {e}")

    # --- 5. PAPERS PUBMED (PMID:<número>) ---
    print("📥 Extrayendo publicaciones de PubMed...")
    try:
        pm_search = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?db=pubmed&term=CACNA1A&retmode=json&retmax=15"
        resp = requests.get(pm_search, timeout=10).json()
        pm_ids = resp.get("esearchresult", {}).get("idlist", [])

        if pm_ids:
            pm_summary = f"https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi?db=pubmed&id={','.join(pm_ids)}&retmode=json"
            pm_data = (
                requests.get(pm_summary, timeout=10).json().get("result", {})
            )
            for pmid in pm_ids:
                if pmid in pm_data:
                    item = pm_data[pmid]
                    cursor.execute(
                        "INSERT OR REPLACE INTO Papers VALUES (?, ?, ?, ?, ?)",
                        (
                            f"PMID:{pmid}",
                            item.get("title", ""),
                            item.get("source", ""),
                            item.get("pubdate", ""),
                            "HGNC:1388",
                        ),
                    )
            print(f"  └─ Guardados {len(pm_ids)} papers (PMID:<id>)")
    except Exception as e:
        print(f"⚠️ Error al consultar PubMed: {e}")

    # --- 6. ENSAYOS CLINICALTRIALS (NCT<8 dígitos>) ---
    print("📥 Extrayendo ensayos clínicos de ClinicalTrials.gov...")
    try:
        ct_url = "https://clinicaltrials.gov/api/v2/studies?query.cond=CACNA1A&pageSize=15"
        ct_resp = requests.get(ct_url, timeout=10)
        if ct_resp.status_code == 200:
            studies = ct_resp.json().get("studies", [])
            for study in studies:
                protocol = study.get("protocolSection", {})
                raw_nct = (
                    protocol.get("identificationModule", {}).get("nctId", "")
                )
                title = (
                    protocol.get("identificationModule", {}).get(
                        "briefTitle", ""
                    )
                )
                status = protocol.get("statusModule", {}).get(
                    "overallStatus", ""
                )
                conds = ", ".join(
                    protocol.get("conditionsModule", {}).get("conditions", [])
                )
                if raw_nct:
                    nct_canonical = raw_nct.upper().strip()
                    cursor.execute(
                        "INSERT OR REPLACE INTO Clinical_Trials VALUES (?, ?, ?, ?, ?)",
                        (
                            nct_canonical,
                            title,
                            status,
                            conds,
                            f"https://clinicaltrials.gov/study/{nct_canonical}",
                        ),
                    )
            print(f"  └─ Guardados {len(studies)} ensayos (NCT<id>)")
    except Exception as e:
        print(f"⚠️ Error al consultar ClinicalTrials: {e}")

    # --- 7. ENTIDADES AUXILIARES (SLUGS MINÚSCULAS) ---
    entidades_slug = [
        (
            "org:cacna1a-foundation",
            "org",
            "CACNA1A Foundation",
            "https://www.cacna1a.org/",
        ),
        (
            "mech:cav21-channel-dysfunction",
            "mech",
            "CaV2.1 Channel Dysfunction",
            "https://omim.org/entry/601011",
        ),
        (
            "tx:4-aminopyridine",
            "tx",
            "4-Aminopyridine (4-AP)",
            "https://clinicaltrials.gov/study/NCT00004772",
        ),
        (
            "asset:cacna1a-patient-registry",
            "asset",
            "CACNA1A Natural History Study & Patient Registry",
            "https://clinicaltrials.gov/study/NCT04311008",
        ),
    ]
    for asset_id, e_type, name, url in entidades_slug:
        cursor.execute(
            "INSERT OR REPLACE INTO Entity_Assets VALUES (?, ?, ?, ?)",
            (asset_id, e_type, name, url),
        )

    conn.commit()
    conn.close()
    print(
        "✨ Proceso finalizado. Base de datos cargada con identificadores canónicos."
    )


if __name__ == "__main__":
    ejecutar_scraper()