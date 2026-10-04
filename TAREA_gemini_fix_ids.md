# TAREA: corregir los IDs del grafo CACNA1A con APIs reales

Carpeta de trabajo: `Hacknation/`. Lee este archivo completo antes de empezar.

## Contexto
Los datos de `data/nodes.jsonl` y `data/edges.jsonl` se generaron **de memoria**, con `scripts/generate_dataset.py` y `scripts/build_full_cacna1a.py`. La biología general está bien (genes, enfermedades y mecanismos correctos), pero **los IDs están inventados**. `scripts/verify_ids.py` los comparó contra las APIs oficiales:

| Tipo | Correctos | Ejemplo |
|---|---|---|
| HGNC (genes) | 4/12 | `HGNC:807` = ATP1B3P1, no ATP1A2 |
| HP (síntomas) | 12/17 | `HP:0012735` = Cough, no "Cerebral edema" |
| PMID (papers) | 0/14 | `PMID:24074887` = estimulación cerebral, no Du et al. 2013 |
| ClinVar (variantes) | 0/8 | todas son variantes de APC/MYL2/DNAH11 |
| NCT (ensayos) | 0/6 | `NCT05168800` = estudio COVID, no historia natural CACNA1A |
| OMIM, org, person, asset, funder | sin verificar | — |

El reporte completo está en `data/verificacion_ids.txt`.

## REGLA DE ORO (no negociable)
**Ningún ID, PMID, NCT, URL ni cita se escribe a mano o de memoria.** Todo sale de una respuesta HTTP real de la API. Escribe `scripts/fix_ids.py` para que haga las consultas, y córrelo. Si la API no encuentra algo: **se elimina** el nodo (o la arista) y se anota en `data/gaps.md`. Es preferible un grafo de 70 nodos verdaderos que uno de 115 con IDs falsos.

## Entregables
1. `scripts/fix_ids.py`: lee `data/nodes.jsonl` y `data/edges.jsonl`, resuelve los IDs reales y reescribe ambos archivos. Antes guarda los originales como `data/*.jsonl.bak`.
2. `data/id_map.json`: `{"id_viejo": "id_nuevo" | null}`, para auditoría.
3. `data/gaps.md`: lo que se eliminó y por qué.
4. `scripts/verify_ids.py` extendido con OMIM y URLs (punto 7).
5. Reporte final: salida de `verify_ids.py` y de `build_graph.py`.

No toques `atlas/` ni `scripts/build_graph.py`.

## Correcciones, una por una

### 1. Genes (HGNC): buscar por símbolo
API: `GET https://rest.genenames.org/fetch/symbol/{SYMBOL}` con header `Accept: application/json` → `response.docs[0].hgnc_id`.
Corregir: ATP1A2 (`HGNC:807`), SCN1A (`HGNC:10582`), KCNA1 (`HGNC:6220`), SLC1A3 (`HGNC:11001`), ATXN1 (`HGNC:795`), ATXN2 (`HGNC:796`, no existe), ATXN3 (`HGNC:797`), ATXN7 (`HGNC:798`).
Correctos (no tocar): CACNA1A `HGNC:1388`, CACNB4 `HGNC:1404`, CACNA1B `HGNC:1389`, CACNA1E `HGNC:1392`.
URL de evidencia: `https://www.genenames.org/data/gene-symbol-report/#!/hgnc_id/{HGNC:n}`.

### 2. Síntomas (HPO): buscar por nombre exacto
API: `GET https://www.ebi.ac.uk/ols4/api/search?q={nombre}&ontology=hp&exact=true` → `response.docs[0].obo_id`. Confirmar con `GET https://ontology.jax.org/api/hp/terms/{HP:id}` → `name`.
Corregir:
- `HP:0002072` "Episodic ataxia" (es Chorea)
- `HP:0001310` "Nystagmus" (es Dysmetria)
- `HP:0012735` "Cerebral edema" (es Cough)
- `HP:0002322` "Vertigo" (es Resting tremor)
- `HP:0001321` "Cerebellar atrophy" (es Cerebellar hypoplasia)

Si el nombre exacto no existe, usa el término HPO más cercano y **actualiza `label` al nombre oficial**.
Revisar también `HP:0002076`: el oficial es "Migraine", no "Migraine with aura". Busca el término correcto o cambia el label.
URL: `https://hpo.jax.org/browse/term/{HP:id}`.

### 3. Papers (PubMed): buscar por autor + año + tema
API: `GET https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?db=pubmed&retmode=json&term={Autor}[au] AND {año}[dp] AND ({tema})` → PMID. Confirma con `esummary.fcgi?db=pubmed&id=...` (title, sortfirstauthor, pubdate, source).
Los 14 PMIDs están mal: 8934531 (Ophoff 1996 Cell), 8988179 (Zhuchenko 1997 Nat Genet), 14999285 (van den Maagdenberg 2004 Neuron), 15004139 (Strupp 2004 Neurology), 24074887 (Du 2013 Cell), 29780183 (Indelicato & Boesch 2018), 33246834 (Kessi 2021 Front Cell Neurosci), 17967913 (Tottene 2009 J Neurosci), 11867768 (De Fusco 2003 Nat Genet), 16141073 (Dichgans 2005 Lancet), 12702710 (Browne 1994 Nat Genet), 19364908 (Jen 2005 Neurology), 21330775 (Klockgether 2011 Lancet Neurol), 15371536 (Al-Twaijri & Shevell 2002 Pediatr Neurol).
- Temas: CACNA1A, "episodic ataxia", "hemiplegic migraine", SCA6, "spinocerebellar ataxia", "alpha1ACT", "4-aminopyridine", etc.
- **Aceptar solo si el título trata del tema de las aristas que respalda.** Si autor y año no coinciden exactamente, busca el paper real más cercano que respalde esa misma relación. Si no hay ninguno, elimínalo.
- **Ojo con el año:** De Fusco "2003" con un PMID de 2002, o Jen "2005" con un PMID de 2009, sugieren que los años también están mal.
- `label` = `"{PrimerAutor} et al. {año} ({revista})"` con los datos de esummary. URL: `https://pubmed.ncbi.nlm.nih.gov/{PMID}/`.

### 4. Variantes (ClinVar): buscar por gen + cambio de proteína
API: `esearch.fcgi?db=clinvar&retmode=json&term=CACNA1A[gene] AND "{p.Arg192Gln}"` → id; confirmar con `esummary.fcgi?db=clinvar&id=...` (title).
Las 8 están mal: 42247 (R192Q), 42248 (S218L), 42249 (T666M), 14068 (R1358Ter), 14067 (R1266Gln), 42250 (R1456His), 253335 (R1330Gln), 208573 (R1666His).
- ⚠ **Numeración:** R192Q, S218L y T666M son nombres históricos. En el transcrito de referencia actual de ClinVar el número de aminoácido puede ser distinto (isoformas). Si no aparece con el número histórico, busca por el título del registro o por el nombre alternativo en el registro de ClinVar. Si lo encuentras, deja el label como `"CACNA1A p.Arg195Gln (legacy R192Q)"`, con el número real que devuelva la API.
- Para cada variante, guarda en `meta` la `clinical_significance` real de esummary. Si es "Uncertain significance", la arista `variant_effect` baja a `extracted`, con confianza ≤0.7.
- URL: `https://www.ncbi.nlm.nih.gov/clinvar/variation/{id}/`.

### 5. Ensayos (ClinicalTrials.gov): buscar por condición + intervención
API: `GET https://clinicaltrials.gov/api/v2/studies?query.cond={condición}&query.intr={intervención}&fields=protocolSection.identificationModule,protocolSection.statusModule,protocolSection.sponsorCollaboratorsModule&pageSize=5`.
Los 6 están mal:
- `NCT05168800` "Natural History of CACNA1A-Related Disorders" → `query.term=CACNA1A`
- `NCT00004732` "4-Aminopyridine in EA2" → cond "episodic ataxia", intr "4-aminopyridine" / "fampridine"
- `NCT00707928` "Acetazolamide vs 4-AP in EA" → cond "episodic ataxia", intr "acetazolamide"
- `NCT03408379` "Troriluzole in SCA" → cond "spinocerebellar ataxia", intr "troriluzole"
- `NCT02580578` "Aminopyridines in downbeat nystagmus / cerebellar" → cond "nystagmus" o "cerebellar ataxia", intr "aminopyridine"
- `NCT01140607` "Clinical Research Consortium for SCA (CRC-SCA)" → term "CRC-SCA" o "spinocerebellar ataxia natural history"

`label` = `briefTitle` real. Guarda en `meta`: `overallStatus`, `phase` y el sponsor. URL: `https://clinicaltrials.gov/study/{NCT}`.
Si el ensayo no existe tal como se describió (por ejemplo, ningún ensayo de historia natural específico de CACNA1A), **no lo sustituyas por otro parecido sin decirlo**: anótalo en gaps.

### 6. OMIM: verificar vía NCBI (sin API key)
API: `esummary.fcgi?db=omim&retmode=json&id=108500,141500,...` → `title`.
Verificar las 14: 108500 (EA2), 141500 (FHM1), 183086 (SCA6), 617106 (DEE42), 160120 (EA1), 602481 (FHM2), 609634 (FHM3), 613855 (EA5), 612656 (EA6), 164400 (SCA1), 183090 (SCA2), 109150 (SCA3/MJD), 164500 (SCA7), 607208 (Dravet).
Si el título no coincide, busca con `esearch.fcgi?db=omim&term="{nombre}"`. URL: `https://omim.org/entry/{n}`.

### 7. Nodos sin ID oficial (org, person, asset, funder, tx, mech)
- **org:** `GET` a la URL de evidencia. Debe responder 200 y el nombre de la organización debe aparecer en el HTML. Si no, busca la URL oficial real o elimina el nodo. Revisa especialmente `org:euro-ataxia`, `org:ataxia-global-initiative` y `org:rare-epilepsy-network`.
- **person:** debe tener **≥1 PMID real** como autor sobre la enfermedad de cada arista `investigates`: `esearch "{Apellido} {Inicial}[au] AND ({enfermedad})"`. La arista se respalda con ese PMID (status `extracted`). Si no hay, elimina la arista; si la persona se queda sin aristas, elimina el nodo.
  - ⚠ `person:alastair-compston` es un investigador de esclerosis múltiple: es muy probable que sobre.
  - Las aristas `funds` de NIH: confirmar en NIH RePORTER (`POST https://api.reporter.nih.gov/v2/projects/search` con `{"criteria":{"pi_names":[{"any_name":"Apellido"}],"advanced_text_search":{"search_text":"CACNA1A OR episodic ataxia"}},"limit":5}`) o eliminarlas.
- **asset:** los modelos de ratón se verifican en MGI/JAX con URL que responda 200 y mencione el alelo (tottering `Cacna1a<tg>`, leaner `Cacna1a<tg-la>`, rolling Nagoya, knock-in R192Q y S218L con su PMID original). `asset:coriell-cacna1a-ipsc-line` y `asset:cacna1a-patient-registry`: solo con URL real; si no, eliminar.
- **tx / mech:** son conceptos, no necesitan ID. Pero **cada arista `treats` o `disrupts` debe estar respaldada por un PMID o NCT verificado** en los pasos 3 y 5.

### 8. Status de las aristas (contrato)
- Evidencia de una base curada (HGNC, HPO, OMIM, ClinVar, ClinicalTrials.gov, RePORTER) → `observed`.
- **Evidencia de un paper (PubMed) → `extracted`**, y `quote` = frase literal del abstract, obtenida con `efetch.fcgi?db=pubmed&id={PMID}&rettype=abstract&retmode=text`. Hoy hay 69 aristas PubMed marcadas como `observed`: todas pasan a `extracted`.
- Fuentes "Patient Group", CZI y EJP RD (sitios web) → `extracted`, con la cita tomada de la página.
- `inferred` → confianza ≤0.6 y `quote` explica el razonamiento.
- Cuando cambie un ID, actualiza **todas** las aristas que lo usan (`source`, `target`, `evidence.url`, `contradicts`).

### 9. Cortesía con las APIs
- NCBI: máximo 3 requests por segundo (`time.sleep(0.34)`), con header `User-Agent`.
- Agrupa esummary por lotes de IDs.
- Cachea las respuestas en `data/.cache/` para poder re-correr sin repetir llamadas.

## Criterio de aceptación
```
python scripts/fix_ids.py
python scripts/verify_ids.py      # 0 "LABEL DIF" y 0 "NO EXISTE" (OMIM incluido)
python scripts/build_graph.py data   # 0 ERROR, 0 nodos huérfanos
```
- Cada arista con `evidence[0].url` que responde 200.
- El reporte final incluye: nodos antes→después, aristas antes→después, conteo observed/extracted/inferred y el resumen de `gaps.md`.
- **Verificar la ruta de la demo:** después de corregir, confirma que sigue existiendo un camino familia EA2 → CACNA1A → mecanismo → otra comunidad → activo → investigador. Si se rompió, dilo en el reporte; no lo rellenes con datos sin verificar.
