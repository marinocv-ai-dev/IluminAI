# PLAN — AI Atlas Enfermedades Raras (Reto 5, Hack-Nation)

> Datos marcados **[NV]** = NO VERIFICADO. El mecatrónico los confirma con búsqueda agéntica antes de usarlos en la demo.

## 1. Caso de demo (original, no obvio)

**Cluster: aminoacil-tRNA sintetasas mitocondriales (genes `*ARS2`).**
~19 genes, mismo mecanismo (falla en la traducción mitocondrial), pero cada uno tiene un nombre de enfermedad distinto y vive en una "especialidad" distinta:

| Gen | Enfermedad (nombre) | Especialidad que la ve |
|---|---|---|
| DARS2 | LBSL (leucoencefalopatía) | neurología |
| HARS2 / LARS2 | Síndrome de Perrault (sordera + falla ovárica) | audiología / ginecología |
| RARS2 | Hipoplasia pontocerebelosa tipo 6 | neuropediatría |
| YARS2 | Miopatía + acidosis láctica + anemia sideroblástica (MLASA2) | hematología / músculo |
| EARS2, AARS2, MARS2… | leucoencefalopatías, cardiomiopatía, etc. | varias |

Encaja exacto con el reto: los nombres ocultan el mecanismo, los fenotipos se solapan solo en parte (contraejemplos honestos) y ninguna tiene tratamiento aprobado **[NV]**. Las comunidades de pacientes y los registros están dispersos.

**Maria** = líder de un grupo de **LBSL (DARS2)**. Ruta de la demo:
LBSL → DARS2 → *traducción mitocondrial* → LARS2 → Perrault → grupo / estudio de historia natural existente → investigador compartido → propuesta concreta + qué validar.

Plan B si el mecatrónico encuentra poca evidencia en H4: **respuesta integrada al estrés (ISR)**: Vanishing White Matter (EIF2B1-5) ↔ Wolcott-Rallison (EIF2AK3) ↔ MEHMO (EIF2S3), con moduladores ISR en ensayo **[NV]**.

## 2. Arquitectura

```
[Mecatrónico] agentes de búsqueda ──► evidence/*.jsonl ──┐
   (Bright Data + APIs públicas + LLM extractor)          │
                                                         ▼
[Biólogo] backend: reconcilia IDs, valida, clustering ──► public/data/graph.json
                                                         │
[Admin] Vercel: grafo 3D + chat ◄── edge function "ask" (LLM con tools) ◄─┘
                     ▲ voz opcional: ElevenLabs Agent (client tools = resaltar nodos)
[Mercadólogo] identidad, copy, narrativa 10×, video
```

- **Deploy:** Vercel. Cada quien trabaja con sus herramientas y al final se integra en un repo: Vite/React estático + función `api/ask.ts` (guarda la key del LLM).
- **Datos:** `public/data/graph.json` estático (grafo de solo lectura, sin base de datos).
- **CASO DEFINIDO: CACNA1A** (sustituye a `*ARS2`). Los datos semilla vienen de Gemini, ver `PROMPT_gemini_cacna1a.md`; arquitectura en `ARQUITECTURA_GRAFO.md`.
- **OpenAI dentro del producto (necesario para premios), sin créditos:**
  1. `gpt-oss-120b` (modelo open-weight de OpenAI) vía Ollama Cloud / OpenRouter / Groq: barato o gratis, y cuenta como "modelo de OpenAI" **[NV: confirmar con jueces/Discord]**.
  2. El LLM del ElevenLabs Agent puede ser GPT (lo factura ElevenLabs) **[NV: confirmar en el plan Creator]**.
  3. Último recurso: unos $5–10 de API OpenAI (`gpt-5-mini`) solo para runtime.
  Construcción y desarrollo: Gemini / Claude / Qwen / DeepSeek, sin restricción.

## 3. CONTRATO DE DATOS (lo más importante: congelar en H1)

Todos escriben y leen este formato. Nadie lo cambia sin avisar.

**nodes**
```json
{"id":"MONDO:0011700","type":"disease","label":"LBSL","synonyms":["leukoencephalopathy with brainstem and spinal cord involvement and lactate elevation"],"summary_plain":"…lenguaje de familia…","cluster":"mt-aaRS","meta":{}}
```
`type` ∈ disease · gene · variant · mechanism · phenotype · patient_group · paper · study · asset · researcher · funder
IDs estables: MONDO:, HGNC:, HP:, ClinVar:, PMID:, NCT, ORPHA:, `org:<slug>`, `person:<orcid|slug>`, `asset:<slug>`

**edges**
```json
{"id":"e123","source":"HGNC:25538","target":"MONDO:0011700","type":"causes",
 "evidence":[{"source":"OMIM","ref":"OMIM:611105","url":"…","date":"2024-05-01","quote":"…"}],
 "status":"observed","confidence":0.95,"contradicts":[],"extracted_by":"ClinVar API"}
```
- `type` ∈ causes · has_variant · disrupts · has_phenotype · studies · funds · investigates · registry_for · trial_for · similar_to · shares_researcher
- `status` ∈ **observed** (base de datos curada) · **extracted** (LLM sobre un paper, con cita) · **inferred** (calculado por el grafo, p. ej. `similar_to`)
- Ninguna arista sin `evidence[0].url`. Regla dura: es el criterio "Evidence integrity".

## 4. Roles y entregables

### Mecatrónico: búsqueda agéntica
- Agentes por fuente → `evidence/<fuente>.jsonl` en formato edge/node:
  - **APIs directas (gratis):** HPO/JAX (gen↔fenotipo), MONDO/OLS (sinónimos), ClinVar + PubMed E-utilities, ClinicalTrials.gov v2, NIH RePORTER.
  - **Bright Data:** sitios de grupos de pacientes (NORD, Global Genes, Orphanet, EURORDIS, sitios propios), notas de prensa, registros.
  - **Extractor LLM:** abstract → `{gen, variante, fenotipo, afirmación, investigador, cita literal}` con salida JSON estricta.
- H4: reporte de cobertura (¿hay suficiente para la ruta de Maria?) → decide caso A o B.

### Biólogo molecular: backend
- Congela el contrato (T0:30), genera graph.json y reconcilia sinónimos (MONDO/HGNC + embeddings para lo dudoso).
- **Similitud fenotípica ponderada por IC** (síntoma raro pesa más que "convulsiones"): Resnik/Jaccard-IC sobre HPO → aristas `similar_to` inferred.
- Clustering (Louvain/Leiden en NetworkX) por mecanismo + fenotipo. Lo valida como experto y marca contraejemplos.
- Edge function `ask`: LLM con tools `search(q)`, `neighbors(id)`, `path(a,b)`, `highlight(ids)`. La respuesta cita IDs de aristas.
- Escribe a mano el "siguiente experimento" de la demo (aquí manda su criterio biológico, no el LLM).

### Administradora: frontend (Vercel)
- Layout: **chat a la izquierda, grafo 3D (`react-force-graph-3d`) a la derecha.**
- Mientras el LLM responde, `highlight(ids)` ilumina los nodos y la cámara vuela al foco. Es el efecto "ve los nodos mientras responde".
- Una sola búsqueda (enfermedad / gen / síntoma / grupo) con sinónimos.
- Clic en una arista → panel con fuente, tipo, confianza, observed/extracted/inferred y contradicciones.
- **Vista "Plan de acción"** de Maria: con quién hablar, qué activo reutilizar, qué validar y la plantilla de correo.
- Estado vacío honesto: "No encontramos ruta con evidencia. Buscamos en X fuentes; falta Y".
- Voz (stretch): botón ElevenLabs para Devon a las 2 a.m.

### Mercadólogo: identidad + narrativa
- Nombre, logo y paleta. Regla del reto: "low ink, high signal", el color = tipo de nodo/estado, nada decorativo.
- Personas (Maria / Devon / Priya / Dr. Osei) → guion del walkthrough de 1 min + video del equipo.
- **Argumento 10×:** hito = lanzar un estudio de historia natural compartido. Ruta actual (~años: encontrar grupos, armar registro desde cero **[NV: buscar cifra con fuente]**) vs. ruta atlas (semanas: reutilizar registro/protocolo existente). Supuestos explícitos.
- README (con el biólogo) y slides.

## 5. Timeline (15 h restantes; T0 = ahora)

| Hora | Hito |
|---|---|
| T0–0:30 | Repo GitHub + Vercel conectado. Contrato congelado. `graph.json` mock (10 nodos) en `public/data/`. |
| T0:30–3 | Ingesta curada (HPO, MONDO, ClinVar). Grafo 3D leyendo el mock. Identidad v0. |
| **T3** | **Go/no-go caso A/B según cobertura.** |
| T3–7 | Papers, trials, RePORTER, grupos de pacientes. `graph.json` real. Edge function `ask` con tools. |
| T7–9 | Similitud IC + clusters. highlight chat↔grafo. Panel de evidencia. |
| **T9** | **Feature freeze. Ruta de Maria de punta a punta.** |
| T9–11 | Vista Plan de acción, estado vacío honesto, pulido visual. Voz solo si sobra. |
| T11–13 | README, grabar video + walkthrough. |
| T13–15 | Colchón: bugs, deploy final, enviar (no dejar para el último minuto). |

## 6. Recortes conscientes (YAGNI)
- Sin auth ni multiusuario. Grafo de solo lectura (contribución de grupos = mockup en el pitch).
- Un cluster completo > muchos a medias. "Escalar a todo" se cuenta en el README, no se construye.
- Inversionistas/RFAs: solo si sobra tiempo (NIH RePORTER ya da los funders).
