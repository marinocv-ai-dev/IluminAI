# TAREA: roles, mapa de huecos, analogías por familia y revisión experta

Carpeta: `Hacknation/`. Lee primero `README.md` (arquitectura y contrato de datos). Todo el **código, los comentarios y los textos de la UI van en inglés**.

## Contexto
Una experta en enfermedades raras (programa de asesoría a fundaciones) confirmó estos huecos:
1. La herramienta debe **señalar activamente qué falta** (ej. "hay línea celular pero falta modelo animal") para orientar la inversión.
2. **Analogía por familia de proteínas:** si una proteína de la misma familia ya tiene modelos, ese conocimiento puede acelerar a la que no los tiene.
3. La IA debe responder distinto a una **familia** que a un **investigador**.

## Reglas
- No inventes IDs, URLs ni datos. Lo que venga de una API debe salir de una respuesta HTTP real.
- **No toques** `scripts/fix_ids.py`, `data/nodes.jsonl` ni `data/edges.jsonl` a mano. Los datos nuevos se agregan **con script**.
- Mantén el estilo existente: archivos pocos y cortos, sin dependencias nuevas.
- Después de cada parte: `cd atlas && npm run build` sin errores y `python scripts/build_graph.py data` sin ERROR.

---

## Parte A: roles (prioridad 1)
Tres roles, que corresponden a las personas del reto:

| role | Persona | Registro | Prioriza en el subgrafo | `next_step` típico |
|---|---|---|---|---|
| `family` (default) | Devon, familia recién diagnosticada | Lenguaje simple, sin jerga, tono calmado. No menciona IDs | patient_group, treatment, study | contactar un grupo, preguntar al neurólogo |
| `organization` | Maria, líder de una fundación | Semi-técnico. Enfocado en activos reutilizables, huecos y alianzas | asset, study, patient_group, funder, researcher | reutilizar un registro o protocolo, financiar un hueco, aliarse con otra fundación |
| `researcher` | Dr. Osei y Priya, ciencia e industria | Técnico. Cita IDs (PMID, NCT, ClinVar), mecanismo, LoF/GoF, modalidad | mechanism, variant, paper, researcher, asset | experimento de validación, colaborador, modelo a reutilizar |

Cambios:
1. **`atlas/api/ask.ts`**
   - Acepta `role` en el body. Valida que sea uno de `family | organization | researcher`; si no viene, usa `family`; si es inválido, responde 400.
   - Separa `SYSTEM` en una base común (reglas de evidencia, JSON, no inventar, LoF/GoF, `no_route`) más un bloque `ROLE[role]` con registro, profundidad y tipo de `next_step`.
   - **El bloque `family` reemplaza la frase actual "talking to a family with no medical background".**
   - `researcher` debe incluir los IDs del subgrafo en `say` cuando cite una fuente.
   - Actualiza el self-check del final para validar el rol.
2. **`atlas/src/subgraph.ts`**: `buildContext(g, question, role = 'family')`. Suma un bono de **+4** al puntaje si el tipo del nodo vecino está en la lista del rol (tabla de arriba). El bono de intención (+8) se mantiene. Agrega 1 assert al self-check: con `role='researcher'`, un link a un nodo `mechanism` puntúa más alto que con `family`.
3. **`atlas/src/App.tsx`**:
   - Agrega un selector de rol en la topbar: 3 botones tipo segmented control, `Family · Organization · Researcher`.
   - Usa las clases existentes (`.btn`, `.btn-mint` para el activo y `.btn-ghost` para los inactivos).
   - Envía `role` a `buildContext` y a `/api/ask`.
   - El guion `DEMO` no cambia.

**Aceptación A:** con el server corriendo,
```
curl -s -X POST localhost:5173/api/ask -H 'content-type: application/json' -d '{"question":"x","context":"N A|gene|X|","role":"hacker"}'
```
→ 400. Los self-checks de `subgraph.ts` y `ask.ts` imprimen OK (`node --experimental-strip-types <archivo>`).

---

## Parte B: mapa de huecos, "What's missing" (prioridad 2)
1. **`scripts/gap_map.py`** (nuevo). Lee `atlas/public/data/graph.json` y escribe `atlas/public/data/gaps.json`:
```json
{"generated":"2026-10-03","sources_searched":["OMIM","HGNC","HPO","ClinVar","PubMed","ClinicalTrials.gov","NIH RePORTER","JAX","patient-group websites"],
 "diseases":[{"id":"OMIM:183086","label":"Spinocerebellar Ataxia Type 6",
   "has":{"animal_model":false,"cell_model":false,"registry_or_group":true,"natural_history":false,"trial":true,"treatment":true,"researcher":true},
   "missing":["animal_model","cell_model","natural_history"]}]}
```
   Reglas para calcular `has`, a partir de los links del grafo:
   - `animal_model`: link `model_of` desde un `asset` cuyo label contenga "mouse", "rat" o "zebrafish".
   - `cell_model`: link desde un `asset` cuyo label contenga "iPSC", "cell" u "organoid".
   - `registry_or_group`: link `registry_for` hacia la enfermedad, **o** hacia su gen causal (vía `causes`).
   - `natural_history`: un `asset` o `study` con "natural history" en el label, enlazado a la enfermedad o a su gen.
   - `trial`: link `trial_for` desde un `study`.
   - `treatment`: link `treats`.
   - `researcher`: link `investigates` hacia la enfermedad.

   Imprime una tabla resumen en la consola.
2. **`scripts/build_graph.py`**: al final llama a `gap_map` (import), para que `gaps.json` se regenere siempre junto con el grafo.
3. **UI (`App.tsx`)**:
   - Al hacer **clic en un nodo de tipo `disease`**, se abre la tarjeta derecha (`.card.right`, la misma del panel de evidencia) en modo "What's missing".
   - Muestra la lista de los 7 ítems con ✓ (mint) o ✗ (gris), una línea por ítem.
   - Debajo, en texto pequeño: *"Not found in the sources searched: OMIM, HGNC, … Absence here does not prove absence in reality."*
   - Botón "Close".
   - Hoy `onNodeClick` no hace nada; conéctalo aquí.
4. **`api/ask.ts`**: agrega al bloque `organization` esta regla: "When the subgraph lacks an asset type for a disease, name it as a gap and suggest who could fill it". Sin cambiar la firma.

**Aceptación B:** `gaps.json` existe. SCA6 tiene `animal_model:false`. EA2 tiene `animal_model:true`. FHM2, FHM3, EA5 y EA6 tienen la mayoría en `false`. El clic en SCA6 muestra el panel.

---

## Parte C: analogía por familia de proteínas (prioridad 3)
1. **`scripts/add_families.py`** (nuevo). Por cada nodo `gene` del grafo:
   - `GET https://rest.genenames.org/fetch/symbol/{label}` con `Accept: application/json` → `gene_group` y `gene_group_id` (son listas).
   - Por cada par de genes que compartan al menos un `gene_group_id` **que no sea un grupo genérico de dominio** (excluye grupos cuyo nombre contenga "domain containing"), agrega a `data/edges.jsonl` un link `same_family`, `status:"observed"`, `confidence:0.95`, con evidencia `{"source":"HGNC","url":"https://www.genenames.org/data/genegroup/#!/group/{id}","quote":"{gene_group name}"}`.
     - Ejemplo verificado: CACNA1E está en `Calcium voltage-gated channel alpha1 subunits` (id 1512); también tiene "EF-hand domain containing", que se excluye.
   - Por cada par de la misma familia donde **el gen A tiene un `asset` animal o celular** (vía su enfermedad) **y el gen B no**: agrega un link `model_transfer_candidate` del asset hacia el gen B, `status:"inferred"`, `confidence:0.5`, `quote:"Same protein family ({group}); model of {geneA} may inform {geneB}. Requires expert review."` y `url` = la misma de HGNC.
   - El script es **idempotente**: no duplica si se corre dos veces.
   - Agrega `"same_family"` y `"model_transfer_candidate"` a la documentación de tipos en `README.md`.
2. Agrega un paso al final del `DEMO` en `App.tsx` **solo si** en el grafo existe un `model_transfer_candidate` hacia CACNA1E o CACNA1B:
   - *"CACNA1E belongs to the same calcium channel family. Mouse models built for CACNA1A could inform research on it. This is a hypothesis that needs expert review."*
   - nodes: el gen, el asset y CACNA1A.
   - Si no existe, no lo agregues y repórtalo.

**Aceptación C:** `python scripts/add_families.py && python scripts/build_graph.py data` sin ERROR; `verify_ids.py` sigue en 0 problemas; en el reporte, lista de pares `same_family` y de `model_transfer_candidate` creados.

---

## Parte D: revisión experta y contribuciones (prioridad 4, mínima)
Solo el modelo de datos y su visualización. Nada de login ni formularios.
1. Campo opcional en los links: `"review": {"by": "string", "date": "YYYY-MM-DD", "verdict": "confirmed|disputed"}`. `build_graph.py` lo conserva tal cual (no lo valida estrictamente).
2. Status nuevo permitido: `"contributed"` (aporte de la comunidad, pendiente de revisión). Agrégalo a `STATUSES` en `build_graph.py`. En `Graph3D.tsx` se dibuja como `inferred` (tenue). En el panel de evidencia se muestra: *"Community contribution, pending expert review"*.
3. Panel de evidencia: si `review` existe, muestra un badge mint **"Expert-reviewed: {by} · {date}"**; si `verdict` es `disputed`, badge ámbar.
4. **No agregues reviews a los datos.** Las hará el biólogo del equipo.
5. Documenta en `README.md`, sección "Data model", los status `contributed` y `review`. Una línea de visión: "Ingestion agents (e.g. Bright Data) and community contributions enter as `contributed`; they never become `observed` without automated ID validation and expert review."

**Aceptación D:** build sin errores. Un link de prueba con `review` agregado temporalmente muestra el badge. **Quita el link de prueba antes de entregar.**

---

## Parte E: structured outputs, `json_schema` estricto (hazla justo después de A)
**Motivo:** en el live usaremos `gpt-5-nano` (API oficial de OpenAI). Con un esquema estricto, OpenAI garantiza el formato exacto del guion aunque el modelo sea chico.

1. **`atlas/api/ask.ts`**: define una constante `SCRIPT_SCHEMA` y reemplaza `response_format: { type: 'json_object' }` por:
```ts
response_format: { type: 'json_schema', json_schema: { name: 'evidence_script', strict: true, schema: SCRIPT_SCHEMA } },
```
   El esquema (modo strict: **todas** las propiedades en `required`, `additionalProperties: false` en cada objeto, sin `minItems`/`maxItems`/`pattern`):
```ts
const SCRIPT_SCHEMA = {
  type: 'object', additionalProperties: false,
  required: ['status', 'steps', 'next_step', 'gaps'],
  properties: {
    status: { type: 'string', enum: ['supported', 'partial', 'no_route'] },
    steps: { type: 'array', items: {
      type: 'object', additionalProperties: false,
      required: ['say', 'nodes', 'links', 'focus'],
      properties: {
        say: { type: 'string' },
        nodes: { type: 'array', items: { type: 'string' } },
        links: { type: 'array', items: { type: 'string' } },
        focus: { type: 'string' },
      } } },
    next_step: { type: 'string' },
    gaps: { type: 'array', items: { type: 'string' } },
  },
}
```
2. **Respaldo sin tocar código:** `...JSON.parse(env.LLM_EXTRA || '{}')` ya va **después** de `response_format`, así que un proveedor que no soporte `json_schema` se arregla desde el entorno con `LLM_EXTRA={"response_format":{"type":"json_object"}, ...}`. **Conserva ese orden** y documéntalo en un comentario de una línea y en `.env.example`.
3. **No quites `parseScript()`**: sigue validando (límite de 8 pasos, pasos vacíos, focus por defecto). El esquema garantiza la forma; `parseScript` y el filtro de ids del navegador garantizan el contenido.
4. Mantén en el `SYSTEM` la descripción del JSON. Ayuda al modelo aunque haya esquema.
5. **`.env.example`**: cambia el bloque de OpenAI a `LLM_MODEL=gpt-5-nano` con el comentario `# cheapest; switch to gpt-5-mini if answers miss rules (LoF/GoF warning, evidence status)`.

**Aceptación E:**
- Build y self-check de `ask.ts` en OK.
- Si hay `LLM_KEY` de OpenAI en `.env.local`, prueba en los 3 roles: *"What groups exist for episodic ataxia type 2?"*, *"Can a therapy for FHM1 be used in EA2?"* y *"What is missing for SCA6 research?"*. Pega el JSON de cada respuesta y el `usage` (tokens).
  - Por cada respuesta, marca: ¿JSON válido? ¿ilumina nodos? ¿menciona observed/extracted/inferred? ¿advierte LoF vs GoF en la segunda pregunta?
- Si no hay key, dilo y no inventes salidas.

---

## Entrega
Reporte con:
- Archivos tocados.
- Salida de los self-checks, de `build_graph.py`, `gap_map.py`, `add_families.py` y `verify_ids.py`.
- La tabla de huecos.
- Los pares de familia creados.
- Lo que NO se pudo hacer, y por qué.

Orden de ejecución: A → E → B → C → D. Si te quedas sin tiempo, entrega A + E + B completas antes que todo a medias.
