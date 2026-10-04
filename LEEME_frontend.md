# Atlas: arranque del frontend

Requisitos: Node 20+ y Chrome.

```
cd atlas
npm install
npm run dev        # abre http://localhost:5173
```

- `▶ Demo`: ruta de una familia con EA2 sobre el grafo real (luz + cámara + voz del navegador).
- `?step=N` en la URL muestra el paso N del demo sin voz (para capturas y video).
- `Explore`: pregunta real al LLM (requiere `.env.local`, ver `.env.example`).
- Clic en una conexión: panel de evidencia.

## Archivos
| Archivo | Qué es |
|---|---|
| `atlas/src/Graph3D.tsx` | grafo 3D. Recibe `highlight = {nodes, links, focus}` y se ilumina solo |
| `atlas/src/App.tsx` | layout, guion `DEMO` (IDs reales), flujo de pregunta → `/api/ask` |
| `atlas/api/ask.ts` | función serverless: pregunta + subgrafo → guion JSON |
| `atlas/src/subgraph.ts` | recorta el grafo a ≤2.5k tokens antes de mandarlo al LLM |
| `atlas/public/data/graph.json` | grafo real auditado (107 nodos, 193 links) |
| `scripts/build_graph.py` | `python scripts/build_graph.py data` → regenera graph.json con los datos de Gemini |
| `ARQUITECTURA_GRAFO.md` | diseño completo: formato del guion, LLM, voz, presupuesto de tokens |

## Pendiente del frontend
1. Búsqueda única con sinónimos + botón 🎤 (Web Speech API).
2. `/api/tts` (ElevenLabs) → sustituye `speechSynthesis`.
3. Vista "Plan de acción" y estado "no hay ruta".

Deploy: subir a GitHub → importar en Vercel con Root Directory = `atlas`.
