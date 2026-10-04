# TAREA J: correcciones del agente DEE69 y del replay (auditoría)

Carpeta: `Hacknation/`. Cambios pequeños. Código y UI en inglés.

## Resultado de la auditoría
- ✅ TAREA H: 78 aristas PubMed → 35 con cita verbatim (verifiqué 35/35 contra los abstracts en caché) y 43 vacías con `needs_review: unrelated`. `verify_ids.py`: 0 problemas, 0 STALE.
- ✅ Agente: OMIM:618285 = DEE69 ✔. Las 6 citas `contributed` de OpenAI son verbatim ✔. `cacna1e.org` responde 200 ✔.
- ❌ Los problemas siguientes.

## J1. Papers irrelevantes (filtro del agente)
La búsqueda `"CACNA1E"[tiab]` trajo papers que solo mencionan el gen de pasada:
- `PMID:38637617`: GWAS de estrés postraumático
- `PMID:40052263`: transcriptómica tras infarto cerebral
- `PMID:37315111`: aneurismas intracraneales

En `scripts/expand_disease.py`, conserva un paper solo si su **abstract** menciona el gen **y** (`epilep*`, `encephalopath*` o `DEE`), o si OpenAI extrajo de él al menos una relación verbatim. Vuelve a correr el agente para regenerar los archivos `contrib` y `runs/dee69.json`, con conteos reales.

## J2. Status y citas de las aristas `paper → disease`
Hoy son `investigates`, `status: observed` y la cita es el **título**. Una búsqueda de PubMed no es una base curada:
- `status: "contributed"`.
- La cita debe ser una frase verbatim del abstract que mencione la enfermedad o el gen, o `""` con `needs_review`.

## J3. Relación indirecta
`HGNC:1392 → mech:gain-of-function` respaldada por `PMID:38081835` (fosforilación de Cav2.3 por CDKL5) no viene de variantes de pacientes con DEE69. Agrégale `needs_review: "indirect: CDKL5 phosphorylation study, not a CACNA1E patient variant"`.

## J4. Grupos de pacientes
Las citas `"Patient support organization for …"` son plantilla, no texto de la página.
- La cita debe ser un extracto **literal** del HTML de la página (texto visible que mencione el gen o la enfermedad). Si no hay, déjala vacía con `needs_review`.
- `org:rare-epilepsy-network → OMIM:618285`: consérvala solo si la página menciona CACNA1E o DEE69. Si no, elimina la arista.

## J5. Replay fuera de orden (bug UI)
La captura de `?run=dee69` muestra el transcript en orden `resolve, extract, genes, patient_groups, phenotypes, gaps, trials, papers`, pero el JSON es `resolve, genes, phenotypes, trials, papers, extract, patient_groups, gaps`. Los eventos deben ejecutarse **estrictamente en secuencia**: `for…of` con `await` por evento (iluminar → volar → narrar), sin `Promise.all` ni `setTimeout` en paralelo. En modo `?run=` sin voz, espera ~1.2 s por evento.

## J6. Etiquetas de estado
En las etiquetas del transcript, `contributed` se cuenta hoy como "hypothesis". Agrega una etiqueta propia: **"● N pending review"** (color ámbar `#F2B134`), separada de `inferred` ("hypothesis").

## Aceptación
1. `python scripts/expand_disease.py … --slug dee69` regenera los archivos sin los 3 papers irrelevantes. Pega el reporte.
2. `verify_ids.py` en 0 problemas. `build_graph.py` y `npm run build` OK.
3. Ninguna cita `contributed` deja de ser verbatim o vacía. Pega el conteo.
4. `?run=dee69` muestra el transcript en el orden del JSON.

## J7. Paso 5 del DEMO (agregado después: no lo hagas en paralelo con otro cambio a App.tsx)
Las 43 aristas sin cita verificada ahora se **ocultan** al construir el grafo (`build_graph.py` las salta si tienen `needs_review`; `--include-unreviewed` las muestra). Con eso desaparecen `person:arn-van-den-maagdenberg` y `person:michael-strupp`, y el paso 5 del `DEMO` en `atlas/src/App.tsx` ("one researcher studies both conditions…") queda sin respaldo.

Reemplaza el paso 5 por esto (todas las aristas existen en el grafo actual):
```ts
{ say: 'Mouse models already exist for both conditions: tottering and leaner mice for your condition, and a knock-in mouse for hemiplegic migraine. Researchers do not have to start from zero.', nodes: ['asset:tottering-mouse-model', 'asset:leaner-mouse-model', 'OMIM:108500', 'asset:r192q-knockin-mouse', 'OMIM:141500'], links: [], focus: 'asset:tottering-mouse-model' },
```
Aceptación: `?step=5` ilumina 5 nodos y al menos 3 links.
