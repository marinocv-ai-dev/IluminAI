# IluminAI: video scripts

El reto pide **"A Team video and a 1-minute walkthrough"**. Aquí van los dos en inglés, con narración, lo que se ve en pantalla y el tiempo. **Todos los números son reales** y salen del repositorio (ver la tabla de verificación al final).

**Regla de honestidad:** decir solo lo que existe. Lo que todavía no está construido se presenta como **"next"**, nunca como hecho. Un juez puede abrir la app y el repo.

---

## 1. Technical team video (~2:30)

| # | Time | On screen | Voiceover |
|---|---|---|---|
| 1 | 0:00–0:15 | Logo IluminAI + equipo (4 caras o nombres) | "We're IluminAI: Marino, Brandon, Luis and Itzel. A molecular biologist, an agentic-search engineer, and two designers and developers. We built an AI evidence map for rare diseases." |
| 2 | 0:15–0:35 | Portada del brand book → texto: *"10,000 rare diseases · <5% with an approved treatment"* | "When a family gets a rare diagnosis, the knowledge they need is scattered across databases, papers, trials and patient groups. Groups rebuild what already exists, and researchers work in silos. We validated these gaps with a rare-disease research scientist who advises patient foundations." |
| 3 | 0:35–1:05 | Diagrama de arquitectura del README (o un esquema simple de 4 cajas) | "**OpenAI is the reasoning core of IluminAI.** It does three jobs. **It reads:** for every link backed by a paper, gpt-5.4-mini extracts the supporting sentence from the abstract, and we keep it only if it appears verbatim. **It explains:** it turns a path through the graph into a step-by-step answer, using Structured Outputs so every step names the exact nodes to light up. **It adapts:** the same evidence is explained for a family, a patient organization or a researcher." |
| 4 | 1:05–1:25 | Grafo 3D + clic en un link → panel de evidencia con el badge *verified verbatim* | "Every identifier comes from an official API: OMIM, HGNC, HPO, ClinVar, PubMed and ClinicalTrials.gov. And every link shows its source, its status and a quote. When OpenAI could not find a supporting sentence, we did not show the claim: 43 claims were rejected and sent to a review queue." |
| 5 | 1:25–1:50 | `▶ Run agent: DEE69`: los nodos aparecen fase por fase | "IluminAI scales beyond one gene. Our research agent builds a new disease from official APIs. OpenAI reads the papers, and the Bright Data MCP finds patient communities on the web. For DEE69 it kept 8 verbatim quotes, one patient group and one biotech company, and it said honestly that no clinical trial exists yet." |
| 6 | 1:50–2:15 | Panel *Review queue (43)* → pestaña *Community* (tarjeta "In design") | "Contributions never become facts on their own. Agent results and community input enter as *pending expert review*, and clinicians and researchers validate them. That's our human in the loop. **Next:** a shared space per disease, where verified patient organizations and families post what they've learned, so the community closes gaps together." |
| 7 | 2:15–2:30 | Panel *What's missing* (VUS 3,377) → logo | "Our first slice found that CACNA1A has 3,377 variants of uncertain significance in ClinVar: nobody knows yet if they cause loss or gain of function. IluminAI shows what is known, what is missing, and who can help. No breakthrough starts from zero." |

**Notas de producción**
- **Escena 3** es la que más pesa para el premio de OpenAI. Dila clara, sin prisa.
- Usa la frase *"OpenAI is the reasoning core"*: es verdad, porque OpenAI lee, verifica y explica. **No digas** "built entirely with OpenAI" ni "OpenAI generated the data": los datos vienen de bases oficiales, y eso es justo nuestro argumento de confianza.
- El video no tiene que mencionar las herramientas con las que programamos. El README lo declara por transparencia, y eso es suficiente.
- **Escena 6:** el espacio de publicaciones por enfermedad **todavía no existe**. Dilo siempre como *"Next"* o *"designed"*. El panel Review existe; los botones Confirm/Dispute están desactivados (*"expert sign-in coming soon"*).

---

## 2. 1-minute walkthrough (demo)

El reto pide seguir a una familia o grupo de pacientes **hasta una colaboración justificada y un siguiente paso, o hasta un hueco honesto con un plan**. Grábalo con el botón **▶ Watch demo**: es un guion fijo, sin red ni LLM, así que no hay sorpresas. El texto de la tabla es lo que la voz del demo ya dice; tú solo agregas la intro y el cierre.

| Time | Click / screen | Voice (tuya, encima del demo o en pausa) |
|---|---|---|
| 0:00–0:05 | App abierta, rol **Family**, idioma **EN** | "Meet a family whose child was just diagnosed with episodic ataxia type 2." |
| 0:05–0:45 | **▶ Watch demo** (9 pasos: gen → otras enfermedades → aviso LoF/GoF → ratones modelo → ensayo fase 3 → historia natural → siguiente paso) | *(deja que Ziva narre; si hace falta, corta los pasos 2–3 para que quepa)* |
| 0:45–0:55 | Clic en un link iluminado → panel de evidencia con la cita | "Every step has a source you can check." |
| 0:55–1:00 | Cierre en el paso final (siguiente paso) | "From an isolated diagnosis to a trial they can ask about this week." |

**Tips de grabación**
- Pantalla de 1440×900 en Chrome, zoom al 100 %, sin otras pestañas visibles.
- Antes de grabar, carga la app una vez y espera ~5 s a que el grafo se acomode.
- Para planos estáticos y limpios usa `?step=N` (por ejemplo, `?step=4` para el aviso de pérdida vs. ganancia de función).
- Si grabas una pregunta en vivo con el LLM (opcional), usa *"Can a therapy for FHM1 be used in EA2?"* en el rol Family. Ya la probamos con `gpt-5.4-mini`: responde en 2–4 s con el aviso de mecanismo.
- Voz del navegador = robótica. Si da tiempo, graba tu propia voz encima o usa ElevenLabs con el texto de la tabla.

---

## Verificación de los números usados
| Dato | Valor | Fuente en el repo |
|---|---|---|
| Nodos / links del grafo | 99 / 168 | `python scripts/build_graph.py` |
| Citas verbatim de OpenAI (dataset principal) | 35 | `data/edges.jsonl` (`verified_verbatim`) |
| Claims rechazados → review queue | 43 | `atlas/public/data/review_queue.json` |
| Agente DEE69: citas de OpenAI | 8 verbatim de 5 abstracts | `atlas/public/data/runs/dee69.json` |
| Agente DEE69: Bright Data | 3 búsquedas, 7 páginas, 1 grupo, 1 empresa | `runs/dee69.json` |
| VUS de CACNA1A en ClinVar | 3,377 | `atlas/public/data/gaps.json` (verificado en vivo con ClinVar) |
| Modelo | gpt-5.4-mini, Structured Outputs | `atlas/.env.example`, `atlas/api/ask.ts` |
| Eval en vivo | 100 % ids válidos, aviso LoF/GoF en 3/3 roles, 2–4 s | `atlas/eval/ask_eval.ts` |
