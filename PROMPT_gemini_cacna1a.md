Eres un investigador biomédico senior y curador de grafos de conocimiento. Estamos en un hackathon (Hack-Nation, Reto 5: "AI Atlas for the World's Rare Diseases") construyendo un atlas en forma de grafo 3D que ayuda a familias y grupos de pacientes con enfermedades raras sin tratamiento a encontrar conexiones con evidencia: mecanismos compartidos, otras comunidades, activos de investigación existentes, investigadores y un siguiente paso concreto.

Tu trabajo: construir los DATOS SEMILLA del grafo para el gen **CACNA1A**. Usa búsqueda web y fuentes públicas (OMIM, ClinVar, HPO, MONDO, Orphanet, PubMed, ClinicalTrials.gov, NIH RePORTER, Jackson Laboratory, sitios de grupos de pacientes).

## REGLA DE ORO
Cada relación necesita una URL real y verificable. **No inventes IDs, PMIDs, NCTs, nombres ni URLs.** Si no puedes verificar algo, no lo incluyas: anótalo en "gaps". Prefiero 80 nodos verdaderos a 200 dudosos.

## Contexto científico (verifícalo; no lo des por hecho)
CACNA1A codifica Cav2.1 (canal de calcio tipo P/Q). Un solo gen causa enfermedades distintas según el efecto de la variante:
- pérdida de función → ataxia episódica tipo 2 (EA2)
- ganancia de función → migraña hemipléjica familiar tipo 1 (FHM1)
- expansión CAG / poliglutamina → ataxia espinocerebelosa tipo 6 (SCA6)
- de novo → encefalopatía epiléptica y del desarrollo 42 (DEE42), ataxia congénita, discapacidad intelectual

El atlas debe demostrar dos tesis:
1. **"Mismo gen ≠ misma enfermedad"**: una terapia que reduce la expresión del gen podría ayudar en ganancia de función y dañar en pérdida de función.
2. **"Genes distintos, mismo mecanismo"**: p.ej. ATP1A2 y SCN1A (migraña hemipléjica), KCNA1, CACNB4, SLC1A3 (ataxias episódicas), genes SCA poliQ (ATXN1/2/3/7), CACNA1E, CACNA1B.

## Qué buscar
1. **Enfermedades alélicas de CACNA1A:** nombre, sinónimos, IDs (MONDO, OMIM, ORPHA), herencia, mecanismo y 5–10 fenotipos HPO (HP:xxxxxxx) con frecuencia si existe.
2. **Variantes representativas** (ClinVar), p.ej. R192Q, S218L, T666M: efecto funcional y enfermedad.
3. **Vecinos por mecanismo:** genes y enfermedades de la lista anterior. Qué comparten con CACNA1A y la fuente.
4. **Grupos de pacientes** (p.ej. CACNA1A Foundation, National Ataxia Foundation, Ataxia UK, grupos de migraña hemipléjica): país, URL, y si tienen registro de pacientes, estudio de historia natural o biobanco.
5. **Ensayos clínicos** (ClinicalTrials.gov) para CACNA1A, EA2, SCA6, FHM y DEE42: NCT, fase, intervención, estado y patrocinador.
6. **Activos reutilizables:** modelos animales (Jackson Lab: tottering, leaner, rolling Nagoya; knock-in R192Q/S218L), líneas iPSC, registros, biomarcadores, programas de ASO o terapia génica.
7. **Investigadores clave** (5–15): institución, tema y financiamiento (NIH RePORTER). **Marca a quien trabaje en 2 o más enfermedades del cluster.** Son el "puente" entre comunidades.
8. **Tratamientos** aprobados u off-label (acetazolamida, 4-aminopiridina…): para qué subtipo, y si hay evidencia contradictoria.
9. **Papers clave** (10–20 PMID) que respalden las relaciones.

## FORMATO DE SALIDA (estricto, lo procesa un script)
Entrega exactamente tres bloques de código, en este orden.

### Bloque 1: `nodes.jsonl` (un objeto JSON por línea, sin comas al final ni corchetes)
```
{"id":"HGNC:1388","type":"gene","label":"CACNA1A","synonyms":["Cav2.1","CACNL1A4"],"summary_plain":"Gene for a calcium channel that lets nerve cells send signals.","cluster":"cav21"}
```
- `type` ∈ disease, gene, variant, mechanism, phenotype, patient_group, paper, study, asset, researcher, funder, treatment
- `id`: MONDO:/OMIM:/ORPHA: (enfermedad), HGNC: (gen), HP: (fenotipo), ClinVar:<id> (variante), PMID:<n> (paper), NCT<n> (estudio), y para el resto `org:<slug>`, `person:<slug>`, `asset:<slug>`, `mech:<slug>`, `tx:<slug>`, `funder:<slug>`
- `summary_plain`: 1–2 frases **en inglés**, al nivel de una familia sin formación médica.
- `cluster`: `cav21` (CACNA1A y alélicas), `hemiplegic_migraine`, `episodic_ataxia`, `polyq_sca`, `dee`, u otro slug si propones uno nuevo.
- El mismo nodo SIEMPRE con el mismo id.

### Bloque 2: `edges.jsonl`
```
{"source":"HGNC:1388","target":"OMIM:141500","type":"causes","status":"observed","confidence":0.95,"evidence":[{"source":"OMIM","url":"https://omim.org/entry/141500","quote":"short literal quote"}],"contradicts":[]}
```
- `type` ∈ causes, has_variant, variant_effect, disrupts, has_phenotype, shares_mechanism, investigates, funds, registry_for, trial_for, treats, model_of, member_of
- `status`: **observed** (base curada: OMIM, ClinVar, HPO, ClinicalTrials.gov, RePORTER) · **extracted** (sacado de un paper; cita literal obligatoria) · **inferred** (razonamiento tuyo; confidence ≤ 0.6; explica en `quote` por qué)
- `contradicts`: lista de `"source->target"` de otras relaciones que esta evidencia contradice (vacía si no hay).
- Toda arista con `evidence[0].url`. Ambos extremos deben existir en nodes.jsonl.

### Bloque 3: `resumen.md` (máx. 1 página, en español)
- **3 conexiones no obvias** que encontraste, con fuente.
- **Ruta de la demo:** familia con variante en CACNA1A → mecanismo → otra comunidad → activo existente (registro, estudio o modelo) → investigador puente → siguiente paso concreto. Indica los ids de nodos de cada salto.
- **Contraejemplo honesto:** una conexión que parece obvia pero que la evidencia no sostiene.
- **Gaps:** qué buscaste y no encontraste.

## Tamaño y cierre
Objetivo: 80–150 nodos y 150–300 aristas. Si la respuesta se corta, detente en una línea completa y escribe `--CONTINÚA--`. Yo responderé "sigue".
Antes de entregar, revisa: JSON válido por línea, ids consistentes, ninguna arista huérfana, ninguna URL inventada.
