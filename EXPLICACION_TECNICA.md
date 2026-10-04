# IluminAI: explicación técnica

> Qué estamos construyendo, cómo funciona cada pieza y por qué se diseñó así.
> Reto 5 de Hack-Nation: *AI Atlas for the World's Rare Diseases*. Caso: gen **CACNA1A**.

---

## 1. El problema en una frase
Una familia con una enfermedad rara sin tratamiento tiene la información **dispersa** en OMIM, PubMed, ClinVar, ClinicalTrials.gov, sitios de grupos de pacientes, etc. IluminAI la junta en un **grafo de conocimiento** y deja que una IA **recorra ese grafo en voz alta**, iluminando cada conexión mientras la explica, con la fuente de cada afirmación.

## 2. Por qué CACNA1A
Un solo gen (canal de calcio Cav2.1) causa enfermedades distintas según **cómo** falla:

| Efecto de la variante | Enfermedad |
|---|---|
| Pérdida de función | Ataxia episódica tipo 2 (EA2) |
| Ganancia de función | Migraña hemipléjica familiar tipo 1 (FHM1) |
| Expansión CAG (poliglutamina) | Ataxia espinocerebelosa tipo 6 (SCA6) |
| De novo | Encefalopatía epiléptica 42 (DEE42) |

Esto demuestra las dos tesis del reto:
1. **"Mismo gen ≠ misma enfermedad":** una terapia que apaga el gen ayudaría en FHM1 y dañaría en EA2. El grafo modela esto a nivel de **variante → mecanismo**, no solo de gen.
2. **"Genes distintos, mismo mecanismo":** ATP1A2 y SCN1A también causan migraña hemipléjica; KCNA1, CACNB4 y SLC1A3, ataxias episódicas. Son comunidades que podrían colaborar sin saberlo.

---

## 3. Arquitectura general

```
┌──────────────── DATOS (offline, Python) ────────────────┐
│ Gemini investiga → nodes.jsonl / edges.jsonl            │
│ fix_ids.py    → corrige IDs contra APIs oficiales       │
│ verify_ids.py → audita (0 errores = apto)               │
│ build_graph.py→ valida contrato → atlas/public/data/graph.json
└─────────────────────────────────────────────────────────┘
                         │ archivo estático
┌──────────────── NAVEGADOR (React) ──────────────────────┐
│ 🎤 Web Speech API → texto de la pregunta                │
│ subgraph.ts  → recorta el grafo relevante (≤2.5k tokens)│
│ fetch /api/ask ───────────────┐                         │
│ filtra ids inventados ◄───────┤ guion JSON por pasos    │
│ por cada paso:                │                         │
│   Graph3D ilumina + cámara    │                         │
│   voz lee el texto del paso   │                         │
└───────────────────────────────┼─────────────────────────┘
┌──────────── SERVIDOR (Vercel Functions) ────────────────┐
│ api/ask.ts → LLM (Groq gpt-oss-120b / OpenAI)           │
│ api/tts.ts → ElevenLabs (pendiente)                     │
└─────────────────────────────────────────────────────────┘
```

Tres decisiones clave:
- **El grafo es un archivo estático**, no una base de datos. Es de solo lectura y pequeño (~100 nodos), así que cabe en memoria del navegador. Cero infraestructura.
- **El LLM nunca ve todo el grafo**, solo un recorte relevante. Ahorra tokens y reduce alucinaciones.
- **El LLM no controla la interfaz directamente.** Devuelve un guion, y el navegador lo valida y lo ejecuta.

---

## 4. Modelo de datos (el "contrato")

### Nodos
```json
{"id":"HGNC:1388","type":"gene","label":"CACNA1A","synonyms":["Cav2.1"],
 "summary_plain":"Gene for a calcium channel…","cluster":"cav21"}
```
- **12 tipos:** disease, gene, variant, mechanism, phenotype, patient_group, paper, study, asset, researcher, funder, treatment.
- **IDs estables** de bases oficiales, para que cualquiera pueda verificarlos:

| Prefijo | Fuente | Ejemplo |
|---|---|---|
| `OMIM:` | OMIM (enfermedades) | `OMIM:108500` = EA2 |
| `HGNC:` | HUGO Gene Nomenclature | `HGNC:1388` = CACNA1A |
| `HP:` | Human Phenotype Ontology | `HP:0001251` = Ataxia |
| `ClinVar:` | ClinVar (variantes) | `ClinVar:8504` = p.Ser218Leu |
| `PMID:` | PubMed | `PMID:15136697` = Strupp 2004 |
| `NCT…` | ClinicalTrials.gov | `NCT01543750` |
| `org:` `person:` `asset:` `tx:` `mech:` `funder:` | slugs propios | `org:ataxia-uk` |

- `synonyms` permite la **búsqueda unificada**: "EA2", "Cav2.1" o "episodic ataxia" llevan al mismo nodo.
- `summary_plain` está escrito para una familia, no para un especialista.

### Aristas (links)
```json
{"id":"L12","source":"HGNC:1388","target":"OMIM:108500","type":"causes",
 "status":"observed","confidence":0.95,
 "evidence":[{"source":"OMIM","url":"https://omim.org/entry/108500","quote":"…"}],
 "contradicts":[]}
```
El campo más importante es **`status`**, que distingue dato de hipótesis (criterio *evidence integrity* del reto):

| status | Significado | Ejemplo |
|---|---|---|
| `observed` | Viene de una base **curada** | OMIM dice que CACNA1A causa EA2 |
| `extracted` | Sacado de un **paper**, con cita literal | Abstract de Strupp 2004 sobre 4-AP |
| `inferred` | **Hipótesis** del sistema (confianza ≤0.6) | FHM1 y FHM2 comparten mecanismo |

- `contradicts`: ids de otras aristas que esta evidencia contradice. Se pinta en ámbar.
- **Regla dura:** ninguna arista sin `evidence[0].url`. `build_graph.py` la rechaza.

---

## 5. Pipeline de datos

| Paso | Archivo | Qué hace |
|---|---|---|
| 1. Investigación | `PROMPT_gemini_cacna1a.md` | Gemini produce nodos y aristas en JSONL |
| 2. Corrección | `scripts/fix_ids.py` (Gemini) | Reemplaza cada ID por el que devuelve la API oficial; elimina lo no encontrado (`data/gaps.md`) |
| 3. Auditoría | `scripts/verify_ids.py` | Consulta HGNC, HPO/JAX, NCBI E-utilities (PubMed, ClinVar, OMIM) y ClinicalTrials.gov; compara el label del grafo con el oficial |
| 4. Construcción | `scripts/build_graph.py` | Valida el contrato, deduplica, limita la confianza de las inferidas, traduce `contradicts` a ids y escribe `graph.json` |

**Por qué existe el paso 2:** la primera versión de Gemini tenía la biología correcta pero los **IDs inventados** (0/14 PMIDs reales, 0/8 variantes, 0/6 ensayos). Un LLM escribiendo de memoria "alucina" números con apariencia válida. La solución fue obligar a que **todo ID salga de una respuesta HTTP real**.

---

## 6. Renderizado 3D (`atlas/src/Graph3D.tsx`)

### Tecnología
- **`react-force-graph-3d`**: wrapper de React sobre `3d-force-graph`, que usa:
  - **Three.js / WebGL**: dibuja esferas y líneas en la GPU.
  - **d3-force-3d**: simulación física. Los nodos se repelen (carga negativa), los links actúan como resortes y la simulación converge en un layout donde los nodos conectados quedan cerca. **No hay coordenadas predefinidas: la estructura emerge de las conexiones.** Por eso los clusters (migraña hemipléjica, ataxias episódicas, SCAs) se agrupan solos.
- **`three-spritetext`**: etiquetas de texto como sprites, que siempre miran a la cámara.

### Codificación visual (Brand Book IluminAI)
| Elemento | Codificación |
|---|---|
| Fondo | Navy `#0A2E4E` |
| Enfermedades | Mist `#F4F7FA` (blanco) |
| Biología (gen, variante, mecanismo, fenotipo) | Azul `#3D85C6` |
| Comunidad y evidencia | Azul claro `#8FB3D1` |
| **Iluminado por la IA** | **Mint `#4CC9B0`**: el brand book reserva el mint para "señales de descubrimiento" |
| Tamaño del nodo | Grado (número de conexiones) |
| Link observed / extracted / inferred | Opacidad alta / media / baja |
| Contradicción | Ámbar `#F2B134` |

### Mecánica de iluminación
El componente recibe un único estado:
```ts
highlight = { nodes: Set<string>, links: Set<string>, focus?: string }
```
y todo se deriva de él:
- `nodeColor`: mint si está en `nodes`; si hay highlight activo, el resto se apaga.
- `nodeThreeObject`: etiqueta del brand book (caja navy + texto mint) **solo** en nodos iluminados, para mantener la legibilidad.
- `linkDirectionalParticles`: partículas mint que viajan por los links iluminados (sensación de "flujo de evidencia").
- `focus`: un `useEffect` llama a `cameraPosition(...)` con transición de 1.4 s; la cámara vuela al nodo.

**Clave del diseño:** el grafo es un componente **puramente reactivo**. No sabe nada de IA ni de voz; solo pinta lo que dice `highlight`. Por eso el mismo componente sirve para la demo, para el LLM y para clics manuales.

---

## 7. Flujo de una pregunta (Graph-RAG)

Ejemplo: *"¿Qué grupos de familias hay para EA2?"*

### 7.1 Voz → texto
`SpeechRecognition` (Web Speech API nativa de Chrome/Edge). Gratis, sin API.

### 7.2 Recorte del subgrafo (`atlas/src/subgraph.ts`)
Es la parte de **retrieval** de un sistema RAG, pero sobre un grafo en vez de documentos:
1. **Semillas:** nodos cuyo `label` o sinónimo aparece en la pregunta ("EA2" → `OMIM:108500`). Se normalizan acentos y mayúsculas.
2. **Intención:** expresiones regulares detectan qué tipo de nodo busca la pregunta ("grupo/familia" → `patient_group`, "tratamiento" → `treatment`…).
3. **BFS a 2 saltos** desde las semillas. Cada link candidato recibe un puntaje:
   `(3 − salto)×10 + rango_status×2 + confianza + 8 si el nodo vecino es del tipo buscado`
4. Se agregan links por puntaje hasta llenar **~2,500 tokens** (estimación: 4 caracteres ≈ 1 token).
5. Se serializa compacto, **sin URLs ni citas** (la interfaz las saca de `graph.json`):
```
N OMIM:108500|disease|Episodic Ataxia Type 2|Attacks of imbalance…
L L45|org:ataxia-uk>member_of>OMIM:108500|extracted|0.7
```

### 7.3 LLM (`atlas/api/ask.ts`)
- Recibe `{question, context}` y **valida en la frontera**: pregunta ≤500 caracteres, contexto ≤12k. Protege la cuota y la key.
- Llama a un endpoint **compatible con OpenAI** (`/chat/completions`) con `response_format: json_object` y `max_completion_tokens: 1500`.
- El system prompt obliga a: usar solo el subgrafo, decir el status de cada link, advertir sobre la pérdida o ganancia de función, decir "no hay ruta" si no la hay y cerrar con **un** siguiente paso concreto.
- Devuelve un **guion**:
```json
{"status":"supported","steps":[
  {"say":"La EA2 viene del gen CACNA1A…","nodes":["OMIM:108500","HGNC:1388"],"links":["L12"],"focus":"HGNC:1388"}
 ],"next_step":"Contacta a Ataxia UK sobre su registro…","gaps":[]}
```
- `parseScript()` normaliza la salida: quita pasos vacíos, completa `focus` y descarta campos con tipo incorrecto.

### 7.4 Reproducción (`App.tsx`)
1. **Filtro anti-alucinación:** se eliminan los ids del guion que no estaban en el subgrafo enviado.
2. Por cada paso: `setHighlight(paso)` (el grafo se ilumina y la cámara vuela) → se reproduce la voz → al terminar, el siguiente paso.

**Por qué un guion y no un agente con herramientas:** una sola llamada al LLM por pregunta, en lugar de un ciclo de llamadas a herramientas. Menos latencia y menos puntos de fallo en vivo, y la luz y la voz quedan sincronizadas por construcción (el paso es la unidad).

---

## 8. Capas contra alucinaciones

| Capa | Dónde | Qué evita |
|---|---|---|
| 1. IDs desde API | `fix_ids.py` | PMIDs, NCTs o variantes inventados en los datos |
| 2. Auditoría | `verify_ids.py` | Que un ID apunte a otra cosa (p.ej. PMID de un paper de maíz) |
| 3. Contrato | `build_graph.py` | Aristas sin fuente, extremos inexistentes, status inválido |
| 4. Contexto cerrado | system prompt | Que el LLM use conocimiento externo no verificado |
| 5. Filtro de ids | `App.tsx` | Que el LLM ilumine nodos que no le dimos |
| 6. Status visible | UI + voz | Que el usuario confunda hipótesis con dato |

---

## 9. LLM: proveedores y límites

| Fase | Proveedor | Modelo | Por qué |
|---|---|---|---|
| Desarrollo | Groq | `openai/gpt-oss-120b` | Modelo open-weight de OpenAI, gratis, ~500 tok/s |
| Demo / live | OpenAI | `gpt-5-mini` | Requisito del track de OpenAI; costo mínimo |

- Cambiar de proveedor = cambiar 4 variables de entorno (`LLM_BASE_URL`, `LLM_MODEL`, `LLM_KEY`, `LLM_EXTRA`). El código es el mismo porque ambos hablan formato OpenAI.
- `LLM_EXTRA` lleva parámetros propios de cada proveedor (Groq: `reasoning_effort: "low"`, `include_reasoning: false`; **no** `reasoning_format`, que falla en gpt-oss).
- **Límite de Groq free:** 8K tokens/min. Presupuesto por pregunta ≈ 400 (sistema) + 50 (pregunta) + 2,500 (subgrafo) + 1,500 (respuesta) ≈ **4.5K**, con colchón.
- Las keys viven en `.env.local` (no se sube a git) y en las variables de entorno de Vercel. Nunca en el código.

---

## 10. Voz
- **Entrada:** Web Speech API (navegador).
- **Salida actual:** `speechSynthesis` del navegador (gratis, voz robótica).
- **Salida final:** `api/tts.ts` → ElevenLabs `eleven_flash_v2_5` (recarga mínima). Para la demo y el video, los audios se **pre-generan** y se guardan en `public/audio/demo/`: la demo no depende de la red ni gasta créditos.

---

## 11. Desarrollo local y deploy
```
cd atlas
cp .env.example .env.local    # poner LLM_KEY
npm install
npm run dev                   # http://localhost:5173
```
- `vite.config.ts` incluye un mini-plugin que sirve `api/*.ts` en local con el **mismo archivo** que Vercel despliega como función. No hace falta `vercel dev`.
- **Deploy:** GitHub → Vercel con Root Directory = `atlas`, más las 4 variables de entorno.

---

## 12. Mapa de archivos
```
Hacknation/
├─ atlas/                      app web (Vite + React + TS)
│  ├─ api/ask.ts               función serverless: pregunta → guion
│  ├─ src/Graph3D.tsx          grafo 3D reactivo + identidad visual
│  ├─ src/subgraph.ts          recorte Graph-RAG con presupuesto de tokens
│  ├─ src/App.tsx              layout, flujo de pregunta, reproductor del guion
│  ├─ src/index.css            tokens de marca (colores, Sora/Manrope)
│  ├─ public/data/graph.json   el grafo (generado)
│  ├─ public/brand/            logos extraídos del brand book
│  ├─ vite.config.ts           sirve /api en local
│  └─ .env.example             configuración de LLM
├─ data/                       nodes/edges.jsonl, gaps.md, id_map.json
├─ scripts/                    build_graph, verify_ids, fix_ids (+ auxiliares de Gemini)
├─ PLAN.md · ARQUITECTURA_GRAFO.md · PROMPT_gemini_*.md · TAREA_gemini_fix_ids.md
└─ Challenge 5.pdf · IluminAI-Brand-Book-v3-EN.pdf
```

---

## 13. Estado actual (2026-10-03)
- ✅ Grafo auditado: **107 nodos, 193 links** (90 observed / 100 extracted / 3 inferred). `verify_ids.py`: 65 IDs, 0 problemas; las URLs de org/asset responden.
- ✅ Auditoría manual (`data/gaps.md`): historia natural = Chung Lab, Boston Children's; registro = CACNA1A Connect; NCT01543750 retirado (PI: Joanna Jen); nuevo NCT07221292 (fase 3, reclutando, junta SCA6 + EA2 + FHM1).
- ✅ 3D con identidad, iluminación, cámara, panel de evidencia, demo de 8 pasos sobre datos reales (`?step=N` para previsualizar). Verificado con capturas en Chrome headless.
- ✅ Código y README en inglés; documentos internos en español.
- ⏳ Falta probar `/api/ask` con la key de Groq.
- ⏳ Pendientes de producto: `api/tts.ts`, botón 🎤, vista "Plan de acción", estado "no hay ruta", deploy a Vercel, cambio a OpenAI para la demo.

## 14. Límites conocidos (honestos para el pitch)
- **Clustering:** hoy es implícito (layout de fuerzas + campo `cluster` curado). Un clustering formal (Louvain o similitud fenotípica ponderada por contenido de información HPO) es el siguiente paso.
- **Escala:** el diseño de archivo estático sirve hasta unos miles de nodos. Más allá: base de grafos (Neo4j / Postgres) y el recorte en el servidor.
- **Cobertura:** un solo gen y sus vecinos. El pipeline (Gemini → fix_ids → verify → build) es replicable para cualquier gen.
- **No es consejo médico:** el brand book y el producto lo dicen explícitamente. Cada paso sugiere validar con un profesional.
