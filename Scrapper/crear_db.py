import duckdb

# Conectar a la base de datos DuckDB
con = duckdb.connect("cacna1a_atlas.db")

# 1. Tabla de Enfermedades y Mecanismos Molecular-Fenotipo
con.execute("""
CREATE TABLE IF NOT EXISTS diseases_mechanisms (
    disease_id VARCHAR PRIMARY KEY,
    disease_name VARCHAR,
    gene_symbol VARCHAR,
    variant_effect VARCHAR, -- Gain of Function vs Loss of Function
    mechanism VARCHAR,      -- Channel dysfunction (CaV2.1 P/Q-type calcium channel)
    phenotype VARCHAR,      -- HPO symptoms
    source_citation VARCHAR
);
""")

# 2. Tabla de Ensayos, Activos y Registros Reutilizables
con.execute("""
CREATE TABLE IF NOT EXISTS research_assets (
    asset_id VARCHAR PRIMARY KEY,
    disease_id VARCHAR,
    asset_type VARCHAR,     -- Registry, Clinical Trial, Biomarker, Natural History
    asset_name VARCHAR,
    target_mechanism VARCHAR,
    status VARCHAR,
    source_url VARCHAR
);
""")

# Insertar datos basados en evidencia real de CACNA1A y Canalopatías
con.execute("""
INSERT INTO diseases_mechanisms VALUES 
('OMIM:601011', 'Episodic Ataxia Type 2 (EA2)', 'CACNA1A', 'Loss of Function', 'CaV2.1 Channel dysfunction / Decreased calcium influx', 'Episodic ataxia, Nystagmus, Vertigo, Cerebellar atrophy', 'OMIM:601011, ClinVar'),
('OMIM:141500', 'Familial Hemiplegic Migraine 1 (FHM1)', 'CACNA1A', 'Gain of Function', 'CaV2.1 Channel dysfunction / Hyperactivity glutamate release', 'Hemiplegic migraine, Aura, Seizures, Hemiparesis', 'OMIM:141500, ClinVar'),
('OMIM:160120', 'Episodic Ataxia Type 1 (EA1)', 'KCNA1', 'Loss of Function', 'Potassium Channel dysfunction / Neuronal hyperexcitability', 'Episodic ataxia, Myokymia, Nystagmus', 'OMIM:160120'),
('OMIM:617106', 'Developmental and Epileptic Encephalopathy 42', 'CACNA1A', 'Gain/Loss mixed', 'CaV2.1 Channel dysfunction', 'Infantile spasms, Intractable seizures, Global delay', 'OMIM:617106');

INSERT INTO research_assets VALUES 
('NCT04311008', 'OMIM:601011', 'Registry & Natural History', 'CACNA1A Natural History Study & Patient Registry', 'CaV2.1 Channel dysfunction', 'Active, Recruiting', 'https://clinicaltrials.gov/ct2/show/NCT04311008'),
('NCT00004772', 'OMIM:160120', 'Clinical Trial / Drug repurposing', '4-Aminopyridine (4-AP) Trial for Episodic Ataxia', 'Channel dysfunction (K+/Ca2+ compensation)', 'Completed', 'https://clinicaltrials.gov/ct2/show/NCT00004772'),
('ASSET-CACNA1A-01', 'OMIM:601011', 'Patient Organization Asset', 'CACNA1A Foundation Global Patient Registry', 'CaV2.1 Channel dysfunction', 'Active', 'https://www.cacna1a.org/');
""")

con.close()
print("Base de datos 'cacna1a_atlas.db' creada correctamente.")