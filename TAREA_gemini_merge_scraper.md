# TAREA K: incorporar lo útil del scraper del equipo (`Scrapper/`) a nuestro pipeline

**Prerrequisito:** TAREA J terminada. Carpeta: `Hacknation/`. No modifiques `Scrapper/` (es del compañero). Todo lo nuevo pasa por nuestros controles y entra como `contributed`.

## Auditoría del scraper (ya verificada contra APIs oficiales)
**Se aprovecha:**
- `NCT06967727`: *Registry and Natural History of Epilepsy-Dyskinesia Syndromes* (Boston Children's, RECRUITING, menciona CACNA1A). Es un **registro e historia natural**: el tipo de activo que más pidió la experta.
- `NCT06585605`: estudio multicéntrico retrospectivo (Boston Children's, RECRUITING, menciona CACNA1A).
- `PMID:42377810`: *Clinical and Radiological Variability in Episodic Ataxia Type 2*, Cerebellum 2026. Reciente y directamente sobre EA2.
- `PMID:20301317`: *Hereditary Ataxia Overview* (GeneReviews).
- 10 variantes de CACNA1A **recientes de ClinVar con "Uncertain significance"** (VUS). No se usan como datos, sino como **señal de hueco**: variantes sin clasificar funcionalmente (pérdida o ganancia de función), justo lo que la experta propuso resolver con predicción por IA.
- `brightdata_tool.py`: conector de **Bright Data** (patrocinador). Úsalo en la fase de grupos de pacientes del agente.

**NO se importa (errores verificados):**
- `OMIM:601011` etiquetado como "EA2": en OMIM es la entrada del **gen** CACNA1A. EA2 es `OMIM:108500`.
- `NCT04311008` (asset "CACNA1A Natural History Study"): es un inventario de equilibrio de vida en Turquía. No relacionado.
- `NCT00004772` (fuente de 4-AP): es un ensayo de inmunoglobulina IV. No relacionado.
- Papers con títulos rotos en la base (`"and"`, `"-plus"`…): el parser falló. Ignóralos, salvo los dos de arriba.

## K1. `scripts/ingest_scraper.py`
Lee `Scrapper/cacna1a_atlas.db` (sqlite3, stdlib) **solo para tomar candidatos**, y **re-verifica cada uno contra la API oficial** antes de escribir. El título y el status se toman de la API, no de la base. Salida: `data/contrib/scraper_nodes.jsonl` y `data/contrib/scraper_edges.jsonl`, con `"run": "scraper"` y `status: "contributed"`, excepto las de bases curadas.
- **Trials:** nodos `study` con `meta.overallStatus`. Aristas `trial_for` hacia las enfermedades del grafo **que el estudio liste en sus `conditions`**, o hacia `HGNC:1388` si solo menciona CACNA1A (cita = la línea de conditions; `observed`). Si el estudio es un registro o historia natural, agrega un nodo `asset` con `registry_for` (para que `gap_map` lo cuente).
- **Papers:** nodos `paper` (label desde esummary). Relaciones **solo vía `openai_extract`** (cita verbatim del abstract). Si no hay cita, no hay arista.
- **VUS:** **sin nodos por variante.** Agrega a `gaps.json`, en CACNA1A, un campo `"vus_count": N` con la URL de la búsqueda de ClinVar. El panel "What's missing" lo muestra como *"N recent variants of uncertain significance: functional effect (LoF/GoF) unknown"*.

## K2. Bright Data **MCP** en el agente (no el conector REST del scraper)
Lo que hay que integrar es el **MCP oficial de Bright Data** (https://github.com/brightdata/brightdata-mcp), no `Scrapper/brightdata_tool.py` (ese usa un endpoint REST de collector).
- **Endpoint remoto** (sin instalar nada): `https://mcp.brightdata.com/mcp?token={TOKEN}&tools=search_engine,scrape_as_markdown`.
- **Herramientas base:** `search_engine` (query; Google devuelve JSON con URL, título y descripción) y `scrape_as_markdown` (url).
- **Plan gratis:** 5,000 requests al mes. **Ya hay token** en `atlas/.env.local` (`BRIGHT_DATA_API_TOKEN`), verificado: `initialize` responde `brightdata-mcp 1.0.0` y `tools/list` devuelve `search_engine` y `scrape_as_markdown`. Léelo de ahí (o del entorno), igual que `LLM_KEY`.

Implementación (`scripts/brightdata_mcp.py`, solo stdlib):
1. Cliente MCP mínimo sobre HTTP (JSON-RPC 2.0, "streamable HTTP"):
   - `initialize` → guarda el header `Mcp-Session-Id`;
   - `notifications/initialized`;
   - `tools/call` con `{"name": "...", "arguments": {...}}`.
   - Envía `Accept: application/json, text/event-stream` y acepta respuestas JSON o SSE (líneas `data:`).
2. Funciones: `search(query) -> list[{url,title,description}]` y `scrape(url) -> markdown`.
3. Token **solo** desde la variable de entorno `BRIGHT_DATA_API_TOKEN`. **Nunca imprimas ni registres la URL completa** (lleva el token en el query string): en logs, enmascárala como `token=***`.
4. Si no hay token, las funciones lanzan `BrightDataNotConfigured`, sin hacer ninguna llamada.

En `scripts/expand_disease.py`, fase `patient_groups`:
- **Con token:** `search("{disease name} patient organization")` y `search("{GENE} foundation families")`. Por cada resultado, `scrape(url)` y conserva la organización solo si el markdown menciona el gen o la enfermedad. La cita es un extracto **literal** de ese markdown. Arista `registry_for`, `contributed`, `"extracted_by": "brightdata-mcp"`.
- **Sin token:** usa la búsqueda actual, y el evento del replay lo dice honestamente: *"Bright Data MCP not configured (no API token): patient-group search used direct verified URLs only."*

**Pruebas:** (a) un self-check sin red que simule una respuesta SSE y la ruta sin token; (b) **corrida real**: vuelve a ejecutar `expand_disease.py` para dee69 usando Bright Data y pega cuántos resultados buscó y descargó, y qué grupos conservó con su cita. Gasto máximo de la corrida: 30 requests.

**README** (sección del agente): *"Patient-group discovery uses the Bright Data MCP (`search_engine`, `scrape_as_markdown`) when `BRIGHT_DATA_API_TOKEN` is set; quotes are kept only if they appear verbatim in the scraped page. The DEE69 demo run used it: {N} searches, {M} pages scraped, {K} groups kept (fill with real numbers)."* **No afirmes que se usó si no se usó.** Agrega `BRIGHT_DATA_API_TOKEN=` a `atlas/.env.example`, comentado y vacío, en una sección "Optional: agent tools".

## K3. Mostrar contribuciones en el grafo
`build_graph.py` hoy solo lee `data/`. Agrega la opción `--with-contrib`, que también carga `data/contrib/*_nodes.jsonl` y `*_edges.jsonl`, dejándolas con su status (`contributed`). Para la demo: `python scripts/build_graph.py data --with-contrib`. **No mezcles el replay de DEE69 en el grafo base**: el replay debe seguir mostrándolo aparecer. Si `--with-contrib` incluye `dee69`, exclúyelo con `--skip-run dee69`, o con un default que excluya los runs que tengan un archivo en `runs/`.

## Aceptación
1. `python scripts/ingest_scraper.py`: reporte de lo importado y lo rechazado con su motivo. Deben aparecer como rechazados `OMIM:601011`, `NCT04311008` y `NCT00004772`.
2. `verify_ids.py` en 0 problemas sobre el grafo construido con `--with-contrib`.
3. Clic en EA2 → "What's missing" muestra el registro nuevo. Clic en CACNA1A/EA2 → aparece la línea de VUS.
4. `npm run build` OK.
5. Self-check de `scripts/brightdata_mcp.py` OK, y la corrida real de dee69 con Bright Data, con los números en el reporte y en `runs/dee69.json`.
6. En el README, una línea de créditos: *"Bright Data connector and initial CACNA1A scrape by {nombre del compañero}"*. El nombre lo pondrá el equipo; deja `{TEAMMATE}`.
