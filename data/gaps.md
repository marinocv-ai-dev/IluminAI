# Gaps y Modificaciones de Curación: Atlas CACNA1A

Este archivo documenta las discrepancias, exclusiones y vacíos detectados al cotejar los datos contra las APIs oficiales (NCBI Entrez, HGNC, HPO/JAX, ClinicalTrials.gov, OMIM).

## 1. Nodos y Relaciones Eliminadas
- **Nodo eliminado `ClinVar:14067` (CACNA1A c.3797G>A (p.Arg1266Gln))**: no encontrado en la API oficial o no respalda las aristas del cluster.
- **Nodo eliminado `ClinVar:42250` (CACNA1A c.4367G>A (p.Arg1456His))**: no encontrado en la API oficial o no respalda las aristas del cluster.
- **Nodo eliminado `ClinVar:253335` (CACNA1A c.3989G>A (p.Arg1330Gln))**: no encontrado en la API oficial o no respalda las aristas del cluster.
- **Nodo eliminado `asset:coriell-cacna1a-ipsc-line` (Coriell CACNA1A iPSC Repository)**: no encontrado en la API oficial o no respalda las aristas del cluster.
- **Nodo eliminado `NCT05168800` (Natural History of CACNA1A-Related Disorders (NCT05168800))**: no encontrado en la API oficial o no respalda las aristas del cluster.
- **Nodo eliminado `NCT00707928` (Acetazolamide vs 4-Aminopyridine in Episodic Ataxia (NCT00707928))**: no encontrado en la API oficial o no respalda las aristas del cluster.
- **Nodo eliminado `NCT02580578` (Aminopyridines in Downbeat Nystagmus and Cerebellar Ataxia (NCT02580578))**: no encontrado en la API oficial o no respalda las aristas del cluster.
- **Nodo eliminado `person:alastair-compston` (Alastair Compston)**: no encontrado en la API oficial o no respalda las aristas del cluster.
- **Nodo eliminado `PMID:15371536` (Al-Twaijri & Shevell 2002 (Pediatr Neurol))**: no encontrado en la API oficial o no respalda las aristas del cluster.

## 2. Ensayos Clínicos No Disponibles
- **Historia natural específica para CACNA1A (NCT05168800)**: El ID previo correspondía en realidad a un estudio de COVID-19 en trabajadores de residencias. En ClinicalTrials.gov no existe actualmente un estudio observacional específico titulado "Natural History of CACNA1A-Related Disorders" con registro NCT activo; se conservaron estudios relacionados con ataxia y síndromes de epilepsia-disquinesia.
- **Acetazolamida vs 4-Aminopiridina en EA2 (NCT00707928)**: El ID previo correspondía a nitroglicerina intravenosa para extracción de placenta. No existe un ensayo de fase clínica registrado con este protocolo cruzado.
- **Aminopiridinas en nistagmo hacia abajo (NCT02580578)**: El ID previo correspondía a un estudio observacional de manejo de dolor.

## 3. Variantes en ClinVar Sin Notación Homologada
- Las variantes históricas `p.Arg1266Gln`, `p.Arg1456His` y `p.Arg1330Gln` no figuran con esas coordenadas en el transcrito de referencia canónico actual de ClinVar (`NM_001127222.2`), por lo que fueron eliminadas para prevenir falsos positivos y mantener integridad verificable al 100%.

## 4. Investigadores Ajustados
- `person:alastair-compston`: Fue retirado al comprobarse que su foco principal de investigación y financiamiento corresponde a esclerosis múltiple y no a las canalopatías cerebelosas de Cav2.1.

## Manual audit (2026-10-03, after fix_ids.py)
Checked against ClinicalTrials.gov API v2 and https://www.cacna1a.org/participate-research.
- `asset:cacna1a-natural-history-study`: the study exists, but at **Boston Children's Hospital** (Chung Lab), not Columbia. Its evidence pointed to the HGNC CACNA1A page; it now cites the CACNA1A Foundation page with a literal quote. Status `extracted`.
- `asset:cacna1a-patient-registry`: the foundation's registry is **CACNA1A Connect**, not CoRDS. Same evidence fix.
- `person:michael-strupp → NCT01543750` removed. The registered principal investigator is **Joanna C. Jen** (UCLA), and that edge was added instead.
- `NCT01543750` (4-AP in EA2) is **WITHDRAWN**; its summary now says so. Evidence for 4-AP in EA2 rests on the papers, not on this trial.
- 14 edges sourced from patient-group websites, CZI and EJP RD moved from `observed` to `extracted` (web pages are not curated databases).
- Added `NCT07221292` (Phase 3 N-acetyl-L-leucine, IntraBio, RECRUITING), which pools SCA6, EA2 and FHM1 in one trial.
