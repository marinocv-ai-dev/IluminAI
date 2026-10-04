# TAREA G: Extract con OpenAI, citas verificadas de los abstracts

Carpeta: `Hacknation/`. Código y textos en inglés. Solo stdlib de Python (`urllib`, `json`, `re`); sin dependencias nuevas.

## Objetivo
El reto pide usar OpenAI para **Extract**: sacar de los papers las afirmaciones que respaldan cada arista, ligadas a su fuente. Hoy las citas (`evidence[0].quote`) de las aristas con fuente PubMed las escribió otro modelo durante la investigación. Las vamos a **re-extraer con OpenAI `gpt-5.4-mini`** y a **verificar que cada cita aparezca literal en el abstract**.

## Reglas (no negociables)
- **Nunca** cambies `source`, `target`, `type`, ids ni URLs. Solo `evidence[0].quote` y campos nuevos de trazabilidad.
- Una cita solo se acepta si es **substring literal del abstract** (compara tras normalizar espacios y comillas). Si no lo es, se rechaza y la arista queda marcada para revisión. No se guarda nada inventado.
- La key se lee de `atlas/.env.local` (`LLM_KEY`, `LLM_MODEL`, `LLM_BASE_URL`). **No la imprimas ni la escribas en ningún archivo.**
- Antes de escribir, respalda `data/edges.jsonl` como `data/edges.jsonl.bak-extract`.

## Script: `scripts/openai_extract.py`
Uso: `python scripts/openai_extract.py [--limit N] [--dry-run]`

1. **Selección:** aristas de `data/edges.jsonl` con `evidence[0].source == "PubMed"` y URL de PubMed. Saca el PMID de la URL.
2. **Abstract:** `efetch.fcgi?db=pubmed&id={PMID}&rettype=abstract&retmode=xml`. Junta todos los `<AbstractText>` (stdlib `xml.etree`). Cachea en `data/.cache/abstract_{PMID}.txt`. Máximo 3 req/s a NCBI y header `User-Agent`. Si no hay abstract → `needs_review` con motivo `no_abstract`.
3. **Llamada a OpenAI** (`{LLM_BASE_URL}/chat/completions`, modelo de `LLM_MODEL`):
   - `response_format`: `json_schema` estricto:
```json
{"type":"object","additionalProperties":false,
 "required":["verdict","quote","reason"],
 "properties":{
   "verdict":{"type":"string","enum":["supports","contradicts","unrelated"]},
   "quote":{"type":"string"},
   "reason":{"type":"string"}}}
```
   - system: *"You verify biomedical claims. Given a CLAIM (subject, relation, object) and an ABSTRACT, copy the single sentence from the abstract that best supports or contradicts the claim, exactly as written (verbatim, no edits). If none is relevant, return verdict 'unrelated' and an empty quote."*
   - user: `CLAIM: {label source} {type} {label target}\nABSTRACT:\n{abstract}`. Los labels salen de `data/nodes.jsonl`.
   - `reasoning_effort: "low"`, más `max_completion_tokens: 400`.
4. **Validación y escritura** (salvo `--dry-run`):

| Resultado | Acción |
|---|---|
| `supports` y la cita es literal | `quote` = la cita. Agrega `evidence[0].extracted_by = "{LLM_MODEL}"`, `evidence[0].extracted_at = "YYYY-MM-DD"` y `evidence[0].verified_verbatim = true` |
| `contradicts` y la cita es literal | **No cambies la arista.** Agrégala a la sección "Contradictions" del reporte, para revisión del biólogo |
| `unrelated`, o cita no literal | Conserva la cita anterior. Agrega `"needs_review": "<motivo>"` a la arista |

5. **Idempotente:** salta aristas que ya tengan `verified_verbatim: true` con el mismo modelo.
6. **Reporte** en consola y en `data/extract_report.md`: total, supports-verbatim, contradicts, unrelated, no-literal, no_abstract y tokens usados (de `usage`). Incluye la lista de aristas `needs_review` y de contradicciones con PMID y cita.

## Cambios relacionados
1. **`scripts/build_graph.py`**: conserva los campos nuevos tal cual (no deben provocar rechazo).
2. **Panel de evidencia (`atlas/src/App.tsx`)**: si `evidence[i].verified_verbatim` es true, muestra bajo la cita un badge pequeño en mint: **"Quote extracted by {extracted_by} · verified verbatim in abstract"**. Si la arista tiene `needs_review`, muestra un badge ámbar: **"Needs expert review"**.
3. **`README.md`, sección "Built with OpenAI"**: agrega una fila a la tabla, **con los números reales del reporte** (no inventes):
   `| **Extract** | Re-extracts the supporting sentence for every PubMed-backed link from its abstract; a quote is kept only if it appears verbatim (N of M verified) | scripts/openai_extract.py |`
   Añade también al bloque "How we use it": *"Extraction is verified deterministically: a model quote that is not a literal substring of the abstract is rejected."*

## Pasos de ejecución y aceptación
1. `python scripts/openai_extract.py --limit 5 --dry-run` → pega las 5 salidas (veredicto, cita y si es literal).
2. Si ≥4 de 5 son literales y tienen sentido: corrida completa `python scripts/openai_extract.py`.
3. `python scripts/build_graph.py data` sin ERROR. `python scripts/verify_ids.py` con 0 problemas.
4. `cd atlas && npm run build` sin errores.
5. Pega `data/extract_report.md` completo.
6. **No resuelvas tú las contradicciones ni los `needs_review`**: los decide el biólogo del equipo.

Costo esperado: ~80 aristas × ~1k tokens ≈ 80k tokens, dentro de la cuota diaria gratuita de OpenAI.
