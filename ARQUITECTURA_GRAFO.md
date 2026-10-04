# Arquitectura: grafo 3D + IA que ilumina + voz

## Idea central (v2: sin ElevenLabs Agents)
Separamos **oído, cerebro y voz**. El cerebro no habla directo: devuelve un **guion por pasos**, y cada paso trae lo que se dice y qué nodos iluminar. El navegador reproduce el guion: ilumina el paso 1 y suena su audio, luego el paso 2, y así.

```
🎤 Voz del usuario ──► Web Speech API (navegador, gratis) ──► texto
                                                              │
graph.json (en memoria) ──► recorta subgrafo relevante ───────┤
                                                              ▼
                                     /api/ask (Vercel) ── LLM (gpt-oss, OpenAI open-weight)
                                                              │  JSON: guion por pasos
                                                              ▼
                       por cada paso: highlight + cámara ──► /api/tts (ElevenLabs) ──► 🔊
                                                              (fallback: speechSynthesis del navegador)
```

Por qué así:
- **1 sola llamada al LLM** por pregunta en vez de un loop de tools: menos latencia y menos fallos en vivo.
- Iluminación y voz sincronizadas **por construcción**: el paso es la unidad.
- La voz de ElevenLabs es solo TTS (texto → mp3). Ya no se necesita la plataforma de Agents.

## 1. Datos: `public/data/graph.json`
Formato nativo de `react-force-graph-3d`:
```json
{
  "nodes": [{"id":"HGNC:1388","type":"gene","label":"CACNA1A","synonyms":["Cav2.1"],"summary_plain":"...","cluster":"cav21"}],
  "links": [{"id":"L1","source":"HGNC:1388","target":"OMIM:141500","type":"causes","status":"observed","confidence":0.95,
             "evidence":[{"source":"OMIM","url":"https://omim.org/entry/141500","quote":"..."}],"contradicts":[]}]
}
```
| Campo | Uso visual |
|---|---|
| `node.type` | color (1 por tipo) |
| tamaño | grado del nodo (`nodeVal`) |
| `link.status` | observed = sólido · extracted = semi · inferred = punteado/tenue |
| `link.confidence` | grosor |
| `link.contradicts` no vacío | rojo + aviso |

`scripts/build_graph.py`: une `nodes.jsonl` + `edges.jsonl` de Gemini → `graph.json`. Valida que cada link tenga URL y que sus extremos existan, y le asigna un `id`.

## 2. Flujo de una pregunta
1. **Entrada:** botón 🎤 → `SpeechRecognition` (`lang` es-MX o en-US) → texto. También hay una caja de texto.
2. **Recorte (navegador):** buscar términos en `label`/`synonyms` → nodos semilla → vecinos a 2 saltos (máx. ~60 nodos) + rutas BFS si la pregunta menciona 2 nodos. Se serializa compacto:
   `L12 | CACNA1A -causes-> FHM1 | observed 0.95`
3. **`/api/ask`:** pregunta + subgrafo → LLM → JSON:
```json
{
  "status": "supported | partial | no_route",
  "steps": [
    {"say": "Your child's gene, CACNA1A, builds a calcium channel...", "nodes": ["HGNC:1388"], "links": [], "focus": "HGNC:1388"},
    {"say": "The same channel is broken in a different way in...",   "nodes": ["HGNC:1388","OMIM:141500"], "links": ["L1"], "focus": "OMIM:141500"}
  ],
  "next_step": "Contact X about their registry...",
  "gaps": ["No natural history study found for DEE42"]
}
```
4. **Validación (navegador):** se descartan los ids que no existan en el grafo (anti-alucinación).
5. **Reproducción:** por cada paso → `highlight(nodes, links)` + vuelo de cámara a `focus` → `/api/tts` con `say` → reproducir. Mientras suena el paso N se pide el audio del N+1. El texto aparece en el transcript y los links citados abren el panel de evidencia al hacer clic.

## 3. Componentes
```
atlas/
  public/data/graph.json
  public/audio/demo/*.mp3   audio pre-generado de la ruta de demo (la demo no depende de la red)
  src/App.tsx               grafo 3D (centro) · transcript (izq) · evidencia (der) · botón 🎤
  src/graph.ts              carga, índice de sinónimos, search, subgraph, findPath (BFS)
  src/player.ts             reproduce el guion: highlight → tts → siguiente
  api/ask.ts                proxy al LLM (key en env de Vercel)
  api/tts.ts                proxy a ElevenLabs TTS (key en env de Vercel)
  scripts/build_graph.py
```
Dependencias: `react-force-graph-3d`. Nada más: voz de entrada y fallback de salida son nativas del navegador.

## 4. LLM
- Endpoint OpenAI-compatible, configurable por env (`LLM_BASE_URL`, `LLM_MODEL`, `LLM_KEY`).
- Modelo: **`gpt-oss-120b`** (open-weight de OpenAI) vía OpenRouter / Groq / Ollama Cloud. Así se cumple el "usar modelos de OpenAI" sin créditos **[NV: confirmar tier gratis del proveedor y que cuente para el premio]**.
- `response_format: json_object` + validación en el navegador.

### Cambio de proveedor = solo variables de entorno (mismo código)
| Fase | `LLM_BASE_URL` | `LLM_MODEL` | Extra |
|---|---|---|---|
| Desarrollo | `https://api.groq.com/openai/v1` | `openai/gpt-oss-120b` | `reasoning_effort: "low"` (latencia) |
| Demo/video + live | `https://api.openai.com/v1` | `gpt-5-mini` | recarga mínima |

- **Ollama Cloud no:** su API nativa (`/api/chat`) no es formato OpenAI y obligaría a tener dos códigos. Groq sí es compatible.
- Antes del cambio final: correr las 3 preguntas de la demo en ambos proveedores y comparar que el JSON del guion sea válido.
- **Groq verificado (docs, 2026-10-03):** id `openai/gpt-oss-120b` · `response_format: {type:"json_object"}` ✅ (también `json_schema`) · `reasoning_effort` low/medium/high ✅ · **NO enviar `reasoning_format`** (falla en gpt-oss) · `include_reasoning: false` para no recibir el razonamiento · contexto 131k · ~500 tok/s · $0.15/$0.60 por M.
- **Límite free tier: 8K tokens/min, 30 req/min, 200K tokens/día.** Cada pregunta ≈ 3–5k tokens → ~2 preguntas/min por key.
  → Subgrafo recortado a ~2.5k tokens · **una key de Groq por integrante** · para el live/video se usa OpenAI de todos modos.

### Presupuesto por pregunta (≤5k tokens, colchón de 3k bajo el límite de 8K/min)
| Parte | Tokens | Cómo se controla |
|---|---|---|
| System prompt | ~400 | fijo |
| Pregunta | ~50 | — |
| Subgrafo | ≤2,500 | `ref/subgraph.ts` → `BUDGET_TOKENS` |
| Respuesta (razonamiento + JSON) | ≤1,500 | `max_completion_tokens: 1500` + `reasoning_effort: "low"` |

**Recorte del subgrafo** (`ref/subgraph.ts`, con self-check):
1. Semillas: nodos cuyo nombre o sinónimo aparece en la pregunta.
2. Vecinos a 2 saltos, con puntaje: cercanía > observed/extracted/inferred > confianza, +bono si el tipo coincide con la intención ("grupo" → patient_group, "tratamiento" → treatment…).
3. Se agregan links por puntaje hasta llenar el presupuesto. Al LLM no le llegan URLs ni citas (la UI las saca de `graph.json`).
- ~2,500 tokens ≈ 40 nodos + 60 links.

### ElevenLabs TTS (recarga mínima)
- Modelo `eleven_flash_v2_5`: el más barato y de menor latencia **[NV: confirmar precio por carácter]**.
- Presupuesto: guion de demo ≈ 6 pasos × 200 caracteres × ~20 corridas de ensayo ≈ 24k caracteres. Se cachea en `public/audio/demo/`.

### System prompt (esqueleto)
```
You are the guide of the Rare Disease Atlas, talking to a family with no medical background.
You receive a question and a SUBGRAPH (nodes and links with ids, status, confidence).
Use ONLY the subgraph. Never invent ids or facts.
Return JSON {status, steps[], next_step, gaps[]}. 3-6 steps.
Each step: 1-2 short sentences in "say", the node/link ids it talks about, and one "focus" node.
Walk the route hop by hop. Say whether each link is observed, from a paper, or inferred.
If a link has contradictions, say so. If there is no route, status "no_route": explain what was searched and what is missing.
Always end with ONE concrete next_step (who to contact, what asset to reuse, what to validate).
Answer in the user's language.
```

## 5. Voz
- **Entrada:** Web Speech API. Funciona en Chrome/Edge; la demo se graba en Chrome.
- **Salida:** ElevenLabs TTS (`/v1/text-to-speech/{voice_id}`) con los créditos de caracteres del plan Creator **[NV: confirmar que el plan da API key para TTS; si no, recargar unos pocos dólares]**. Fallback automático: `speechSynthesis`.
- **Ahorro de créditos:** pre-generar los mp3 de la ruta de demo y guardarlos en `public/audio/demo/`. En el video se usan esos.
