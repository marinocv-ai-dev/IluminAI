# TAREA N: panel "Review queue" (cola de revisión experta)

Carpeta: `Hacknation/`. Código y UI en inglés. **No modifiques datos** (`data/*.jsonl`) ni la lógica auditada del replay, de `Graph3D.tsx` ni del filtro de `build_graph.py`.

## Objetivo
Las 43 aristas sin cita verificada (`needs_review`) se quedan **fuera del grafo 3D**. Se muestran **solo** en un panel aparte, como cola de revisión experta: es la prueba visible del human-in-the-loop.

## N1. Datos (`scripts/build_graph.py`)
Al construir, además de `graph.json`, escribe `atlas/public/data/review_queue.json` con las aristas retenidas:
```json
{"generated":"YYYY-MM-DD","count":43,
 "items":[{"source":"tx:acetazolamide","source_label":"Acetazolamide","type":"treats",
           "target":"OMIM:108500","target_label":"Episodic Ataxia Type 2",
           "reason":"unrelated","source_url":"https://pubmed.ncbi.nlm.nih.gov/…/"}]}
```
- Los labels se toman de los nodos (incluidos los ocultos).
- `reason` se toma de `needs_review` y se traduce a texto legible: `unrelated` → "Cited abstract does not support this claim", `no_abstract` → "Source has no abstract", `no_source` → "No source found", `indirect:…` → "Indirect evidence".
- Agrupa por tipo (`treats`, `investigates`, `model_of`, …) en el orden: treatments, models, researchers, mechanisms, otros.

## N2. UI (`atlas/src/App.tsx`)
- En la topbar, un botón pequeño **"Review queue (43)"** (`.btn-ghost`) que lee el conteo del JSON.
- Abre la tarjeta derecha (`.card.right`) con:
  - Título **"Waiting for expert review"**.
  - Una línea explicativa: *"Our verifier could not find a verbatim source quote for these claims, so they are hidden from the map. An expert can confirm or dispute each one."*
  - La lista agrupada por tipo: `Acetazolamide → treats → Episodic Ataxia Type 2`, con el motivo en gris y el link a la fuente.
  - Junto a cada ítem, botones **Confirm** / **Dispute** **deshabilitados**, con el tooltip *"Expert sign-in coming soon"*. No guardan nada: es la vista del flujo.
- **No ilumina el grafo ni agrega nodos.** Es solo una lista.
- Cierra con "Close", igual que los demás paneles.

## N3. README
En "Expert-validated product requirements", la línea de human in the loop: cambia `confirm/dispute buttons 🚧` por `review queue panel ✅ · confirm/dispute actions 🚧 (sign-in required)`.

## Aceptación
1. `python scripts/build_graph.py data` → genera `review_queue.json` con `count` = número de aristas retenidas (hoy 43). `graph.json` no cambia respecto a la versión actual (mismos nodos y links).
2. `npm run build` OK.
3. Captura en tiempo real (no uses `--virtual-time-budget`; espera de verdad) del panel abierto.
4. Pega los archivos tocados con su hora.
