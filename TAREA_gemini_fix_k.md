# TAREA M: correcciones de la auditoría de K (hazla después de L; no la mezcles con L)

Carpeta: `Hacknation/`. Datos: los cambios se hacen **re-corriendo los scripts**, no editando a mano los `.jsonl`.

## Auditoría de K
✅ Aprobado:
- **Token de Bright Data:** no aparece en ningún archivo salvo `.env.local`.
- **Self-check del MCP:** OK.
- **`verify_ids`:** 68 ids, 0 problemas.
- **Ensayos del scraper:** `NCT06967727` y `NCT06585605` correctos.
- **Cita de `PMID:42377810`:** literal; lo comprobé contra el abstract en vivo.
- **README:** tiene la sección Bright Data.

❌ Por corregir:
1. **Los "grupos de pacientes" de Bright Data no son grupos de pacientes.** De 5 nodos `patient_group` en `data/contrib/dee69_nodes.jsonl`, solo uno lo es:

| id | Qué es en realidad | Acción |
|---|---|---|
| `org:www-cacna1e-org` | CACNA1E International (✅ grupo real) | Conservar |
| `org:www-malacards-org` | MalaCards, una **base de datos** | Eliminar como grupo |
| `org:omim-org` (label "Entry") | OMIM, una **base de datos**; la cita es un link en markdown | Eliminar como grupo |
| `org:www-thevgccc-org` | **Post de blog** sobre CACNA1E International | No es un nodo: úsalo como **segunda evidencia** de la arista de `org:www-cacna1e-org` |
| `org:www-lariotx-com` | **Lario Therapeutics**, empresa biotech presente en la conferencia de familias de CACNA1E | **Valioso** (perfil "biotech scout" del reto). Nuevo tipo de nodo `company` (ver M2), arista `investigates` → `OMIM:618285`, `contributed` |

   En `expand_disease.py`, fase `patient_groups`: descarta dominios de bases de datos y referencia (`malacards.org`, `omim.org`, `orpha.net`, `ncbi.nlm.nih.gov`, `wikipedia.org`, `genecards.org`, `clinicaltrials.gov`). Clasifica cada sitio como `patient_group` (asociación, foundation o family organization) o `company` (Inc, Ltd, Therapeutics, Pharma). Un artículo o blog sobre un grupo existente se convierte en evidencia extra de ese grupo, no en un nodo nuevo. Los labels deben ser el **nombre de la organización**, no el título de la página.

2. **El replay no dice cuánto hizo Bright Data.** El evento `patient_groups` dice *"searched and scraped… verifying…"* sin números. Debe decir los números reales de la corrida: *"Bright Data MCP: {N} searches, {M} pages scraped, {K} patient groups and {C} companies kept with verbatim quotes."* Usa los mismos números en la sección Bright Data del README.

3. **Falta el conteo de VUS (K1).** `gaps.json` no tiene `vus_count`. Calcúlalo con ClinVar (`esearch db=clinvar term=CACNA1A[gene] AND "uncertain significance"[clinsig]`, `retmax=0` → `count`). Guárdalo en las enfermedades causadas por CACNA1A, con `vus_query_url`. El panel "What's missing" muestra: *"{count} CACNA1A variants of uncertain significance in ClinVar: functional effect (LoF/GoF) unknown"*.

4. **README:** reemplaza `{TEAMMATE}` solo si el equipo da el nombre; si no, déjalo.

## M2. Tipo de nodo `company`
- Agrégalo a `NODE_TYPES` en `scripts/build_graph.py`.
- En `Graph3D.tsx`, agrégalo al grupo "Community & evidence" con el tag `BIO`.
- En el README, a la lista de tipos del modelo de datos.

## Aceptación
1. Re-corre `expand_disease.py` para dee69 (máximo 30 requests de Bright Data). En `dee69_nodes.jsonl` debe haber 1 `patient_group` (CACNA1E International) y 1 `company` (Lario Therapeutics), con labels limpios y citas literales de su página.
2. `runs/dee69.json` → `patient_groups` con los números reales.
3. `gaps.json` con `vus_count` > 0 en las enfermedades de CACNA1A.
4. `verify_ids.py` en 0, `build_graph.py` sin ERROR, `npm run build` OK.
5. Pega el reporte de la corrida, las citas de los dos organismos y los archivos tocados con su hora.
