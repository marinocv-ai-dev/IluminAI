# TAREA I: agente curador `expand_disease`, segunda enfermedad + replay en el grafo

**Prerrequisito:** la TAREA H (citas) debe estar terminada y con `verify_ids.py` en 0 problemas.
Carpeta: `Hacknation/`. Código y UI en inglés. Python solo con stdlib. Sin dependencias npm nuevas.

## Objetivo
Un agente que, dada una enfermedad, construye su subgrafo **consultando primero APIs oficiales**. OpenAI solo extrae afirmaciones con cita literal verificada. El resultado entra como `contributed` (pendiente de revisión experta), y la app **reproduce la corrida** en el grafo 3D: los nodos aparecen paso a paso mientras se narra lo que hace el agente.

Enfermedad de prueba: **la encefalopatía epiléptica del desarrollo causada por CACNA1E (DEE69)**. Conecta con el grafo actual por la familia de canales de calcio (`same_family` CACNA1A–CACNA1E ya existe).

## Regla de oro
**El LLM nunca escribe un ID, PMID, NCT ni URL.** Todo identificador sale de una respuesta HTTP real. Si una API no devuelve algo, no se agrega: se anota en el log como gap. Cada cita de OpenAI debe ser substring literal del abstract (reusa la función de verificación de `scripts/openai_extract.py`).

## Script: `scripts/expand_disease.py`
Uso: `python scripts/expand_disease.py "developmental and epileptic encephalopathy 69" --slug dee69 [--max-papers 8]`

Pasos. Cada uno agrega un **evento** al log de la corrida (ver formato abajo). Antes de depender de los endpoints marcados [verificar], pruébalos y, si no funcionan, usa la alternativa:

1. **Resolve:** OLS4 `https://www.ebi.ac.uk/ols4/api/search?q={name}&ontology=mondo` → MONDO id + label. OMIM vía xref, o `esearch db=omim term="{name}"` + esummary para confirmar el título. Nodo `disease` con id `OMIM:{n}` (o `MONDO:` si no hay OMIM).
2. **Genes:** `esearch db=omim` / esummary, o Monarch API v3 [verificar] (`https://api-v3.monarchinitiative.org/v3/api/association?subject={MONDO}&category=biolink:CausalGeneToDiseaseAssociation`). Confirma cada gen con HGNC `fetch/symbol`. Arista `causes` gene→disease (`observed`). **Si el gen ya existe en el grafo (HGNC:1392), reúsalo.**
3. **Phenotypes:** anotaciones HPO de la enfermedad [verificar] (`https://ontology.jax.org/api/network/annotation/{OMIM:n}` o Monarch `DiseaseToPhenotypicFeatureAssociation`). Máximo 10, priorizando los que **ya existen** en el grafo (así se ven los síntomas compartidos). `has_phenotype` (`observed`).
4. **Trials:** ClinicalTrials.gov v2 `query.cond={name}` y `query.term={GENE}`. Máximo 5, con `overallStatus`. `trial_for` (`observed`).
5. **Papers:** PubMed `esearch` `"{GENE}"[tiab] AND (epilep* OR encephalopathy)`, ordenado por relevancia, `--max-papers`. Nodos `paper` con label `"{FirstAuthor} et al. {year} ({journal})"` desde esummary.
6. **Extract (OpenAI):** por cada paper, con el abstract, llama a OpenAI (`.env.local`, `json_schema` estricto) para extraer **solo** estas relaciones, cada una con cita literal:
   - `variant_effect` / `disrupts` hacia un mecanismo existente (`mech:loss-of-function` o `mech:gain-of-function`). **No crees mecanismos nuevos.**
   - `has_phenotype` adicional, solo si el término HPO ya existe en el grafo.
   - `treats` (tratamiento → enfermedad), reusando nodos `tx:*` existentes si coinciden.
   - Status `extracted` y `extracted_by: "{LLM_MODEL}"`. Si la cita no es literal, se descarta.
7. **Patient groups:** busca solo con fuentes verificables (sitio que responda 200 y mencione la enfermedad o el gen). Si no hay, anótalo como gap. (Aquí entrará Bright Data después.)
8. **Gates:** valida el resultado con las mismas reglas de `build_graph.py` (extremos, URL, status) y con los chequeos de `verify_ids.py` sobre los ids nuevos. Lo que falle no se escribe.
9. **Gaps:** calcula `missing` con la lógica de `scripts/gap_map.py` para la nueva enfermedad.

**Todas las aristas nuevas se escriben con `status: "contributed"`**, salvo las de bases curadas, que conservan `observed`. Agrega en cada arista nueva `"run": "{slug}"`.

## Salidas
1. `data/contrib/{slug}_nodes.jsonl` y `data/contrib/{slug}_edges.jsonl`. **No se mezclan** con `data/*.jsonl`: quedan pendientes de revisión.
2. `atlas/public/data/runs/{slug}.json`: el replay de la corrida:
```json
{"slug":"dee69","disease":"…","model":"gpt-5.4-mini","generated":"YYYY-MM-DD",
 "events":[
  {"phase":"resolve","say":"Resolving the disease name against MONDO and OMIM…","add_nodes":[{…}],"add_links":[],"focus":"OMIM:…"},
  {"phase":"genes","say":"Found 1 causal gene: CACNA1E, already in the atlas.","add_nodes":[],"add_links":[{…}],"focus":"HGNC:1392"},
  {"phase":"extract","say":"OpenAI read 8 abstracts and kept 5 verbatim quotes.","add_nodes":[…],"add_links":[…],"focus":"…"},
  {"phase":"gaps","say":"Missing: animal model, patient registry. These need a contributor.","add_nodes":[],"add_links":[],"focus":"OMIM:…"}]}
```
   Los nodos y links van completos (mismo formato que `graph.json`), con ids de link `R1, R2…` para no chocar con los `L*`. Cada `say` lleva los **números reales** de la corrida.
3. Reporte en consola: conteos por fase, gaps, tokens de OpenAI y todo lo descartado.

## UI (`atlas/src/App.tsx`)
1. En el panel "What's missing" de una enfermedad, y también en la topbar, un botón **"▶ Run research agent: DEE69"**. Si existe `/data/runs/dee69.json`, lo carga.
2. **Replay:** recorre `events` en orden. Por cada evento:
   - agrega `add_nodes` / `add_links` al estado del grafo (sin reemplazar el objeto de los nodos existentes, para que no salten de posición);
   - ilumina en mint lo agregado;
   - vuela a `focus`;
   - narra `say` con la misma función `speak` del guion.
   - El transcript muestra el `phase` como etiqueta.
3. Al terminar, lo agregado queda en el grafo dibujado como `contributed`. En el panel de evidencia aparece "Community contribution, pending expert review" (ya implementado en D).
4. Agrega `?run=dee69` a la URL para lanzar el replay sin voz, al estilo de `?step=N`.

## README
En "Built with OpenAI", agrega la fila con los números reales de la corrida:
`| **Extract + Reconcile (agent)** | scripts/expand_disease.py builds a new disease subgraph from official APIs; OpenAI extracts claims with verbatim-verified quotes; results enter as "contributed" pending expert review | scripts/expand_disease.py |`

## Aceptación
1. `python scripts/expand_disease.py "developmental and epileptic encephalopathy 69" --slug dee69` termina y pega el reporte.
2. Cada id nuevo pasa `verify_ids.py` (córrelo sobre los archivos contrib o agrégale una opción para hacerlo).
3. `cd atlas && npm run build` OK. Prueba `?run=dee69` en Chrome: los nodos aparecen por fases y se conectan con CACNA1E/CACNA1A existentes.
4. Si una fase no encuentra datos, el evento lo dice honestamente ("No patient group found in the sources searched") en lugar de omitirse.
5. **Explore después del replay:** `buildContext` debe recibir el grafo **actual en pantalla** (con lo agregado por el replay), no el `graph.json` original. Agrega al prompt base: *"Links with status 'contributed' are pending expert review: say so whenever you use one."* Prueba: tras `?run=dee69`, pregunta en Explore *"What do we know about DEE69?"*; la respuesta debe usar los nodos nuevos y mencionar que están pendientes de revisión. Pega la respuesta.
