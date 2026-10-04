# TAREA O: frontend final con Ziva (inspirado en `Front v2/`, construido sobre `atlas/`)

Carpeta: `Hacknation/atlas/`. **UI en inglés por defecto, con opción de cambiar a español** (ver O8). Lee esto completo antes de empezar.

## Regla principal
`Front v2/` (TanStack Start + Supabase + Lovable AI Gateway + shadcn) es **solo referencia visual y de assets**. **No copies su stack**: nada de TanStack, Supabase, auth, Lovable gateway, shadcn ni ai-elements, y **ninguna dependencia npm nueva**. La app sigue siendo Vite + React + CSS propio y `api/ask.ts` (OpenAI), y se despliega en Vercel.

## No se toca (auditado)
- `src/Graph3D.tsx`: componente, colores, resaltado de 3 niveles, cámara.
- `src/subgraph.ts`, `api/ask.ts`, `vite.config.ts`.
- La lógica de `replayRun`, `play`, `ask` y del filtro de ids en `App.tsx`: **muévela a donde haga falta, pero no cambies su comportamiento**.
- Datos: `public/data/*`, `data/*`, `scripts/*`.

## Referencias a mirar
- `Front v2/mockup-atlas.svg` (escritorio) y `Front v2/mockup-atlas-mobile.svg` (móvil): ábrelos en Chrome.
- `Front v2/design-references/sistema-dado-visor.png`: los 6 estados de Ziva.
- `Front v2/AGENTS.md`: la regla de producto que adoptamos: *"one continuous Ziva-led chat with a bottom composer; the 3D graph is a complementary view, never a second question surface"*.

## O1. Assets
Copia a `atlas/public/brand/ziva/` desde `Front v2/src/assets/`: `ziva-tranquila.png`, `ziva-escuchando.png`, `ziva-pensando.png`, `ziva-encuentra.png`, `ziva-incertidumbre.png`, `ziva-saluda.png`. Copia también `iluminai-logo-completo-positivo.png` a `atlas/public/brand/logo-light.png`, sobrescribiendo el actual.
- Las Ziva tienen cuerpo claro (versión negativa): **siempre se muestran dentro de un avatar navy redondeado** (`#0A2E4E`, radio 14 px), nunca sobre fondo claro.

## O2. Layout de escritorio (≥ 1024 px): tres columnas, como el mockup
1. **Header blanco** (64 px):
   - logo positivo (≥ 160 px de ancho);
   - un separador;
   - el eyebrow `RARE DISEASE ATLAS` y el título `Evidence & support graph`;
   - a la derecha, `● Traceable sources` en mint, el **selector de rol** (Family · Organization · Researcher, segmented) y un menú secundario con `▶ Demo`, `▶ Run agent: DEE69`, `Review queue (43)` y `Reset`.
2. **Columna izquierda, chat de Ziva** (360 px, fondo blanco o mist):
   - **Cabecera:** avatar de Ziva (estado actual) + eyebrow `YOUR EVIDENCE GUIDE` + `Ziva · {state label}`.
   - **Estado vacío:**
     - título *"What do you want to understand today?"*;
     - texto *"Tell me which disease, gene or symptom you're exploring. We'll follow the evidence and look for connected support networks."*;
     - 3 sugerencias clicables (*"Can a therapy for FHM1 be used in EA2?"*, *"What groups exist for episodic ataxia type 2?"*, *"What is missing for SCA6 research?"*).
   - **Conversación continua** (todos los turnos, con scroll, auto-scroll al final):
     - burbuja `YOUR QUESTION`;
     - respuesta de Ziva como tarjeta con borde izquierdo mint: título corto, los pasos numerados (los que ya se muestran en el transcript, con sus chips de evidencia), la tarjeta ámbar de `mechanism_warning` y una tarjeta **Next step** destacada;
     - `What's still unclear` (gaps) plegable;
     - chips `3 steps in the path` / `Verifiable sources`.
   - **Demo, replay del agente y voz** se escriben en esta misma conversación, como turnos de Ziva.
   - **Composer abajo:**
     - textarea (Enter envía, Shift+Enter hace salto de línea);
     - botón enviar;
     - botón 🎤 con Web Speech API (`SpeechRecognition`, `en-US`). Si el navegador no lo soporta, el botón se oculta.
   - Debajo, en pequeño: *"Educational information. Ziva does not diagnose or replace a health professional."*
   - **Esta es la única superficie de preguntas.** Quita el buscador "Explore" de la topbar actual.
3. **Centro, grafo** (`Graph3D` sin cambios, a pantalla completa en el espacio libre):
   - overlay arriba a la izquierda: `● Evidence path · {N} nodes · {M} links`, calculado del grafo actual;
   - **barra inferior "Find in graph"**: busca por label o sinónimo **sin LLM**; al elegir un nodo, ilumínalo (`setHl` con ese nodo y sus vecinos, `focus` en él) y abre su panel derecho si es una enfermedad. No es una segunda superficie de preguntas: no llama a `/api/ask`.
4. **Columna derecha, paneles con pestañas** (380 px, cerrable). Una sola tarjeta con tabs, en lugar de las tarjetas sueltas de hoy:
   - **Evidence:** el panel de evidencia actual (clic en un link), con sus badges (verified verbatim / pending review / expert-reviewed / contradicts). Estado vacío: *"Select an illuminated connection to review its source and confidence."*
   - **Community:** para la enfermedad seleccionada, los nodos `patient_group` y `company` conectados (nombre, tipo, cita y link "Visit"), más una tarjeta navy al estilo del mockup: *"FAMILIES & PATIENTS · A shared space per disease · Voluntary connection, under your control · [In design]"*. **Honesto: sin perfiles ni actividad simulada.**
   - **What's missing:** el panel actual (gaps + VUS).
   - **Review:** la cola de revisión actual.

   Clic en un nodo `disease` abre Community/What's missing de esa enfermedad. Clic en un link abre Evidence.

## O3. Ziva reacciona al estado (`sistema-dado-visor.png`)
| Estado de la app | Imagen | Etiqueta |
|---|---|---|
| Sin actividad | `ziva-tranquila` | `Ready to explore` |
| Escribiendo o micrófono activo | `ziva-escuchando` | `Listening` |
| Esperando `/api/ask` o replay en curso | `ziva-pensando` | `Thinking` |
| Respuesta `supported` | `ziva-encuentra` | `Found a path` |
| `partial`, `no_route` o error | `ziva-incertidumbre` | `Not fully clear` |
| Primera carga (2 s) | `ziva-saluda` | `Hi, I'm Ziva` |
Transición suave (opacidad 150 ms) y nada con `prefers-reduced-motion`.

## O4. Estados claros
- **Cargando grafo:** skeleton con Ziva saludando.
- **Sin coincidencias** (subgrafo vacío): *"I couldn't find a direct match in this graph. Try CACNA1A, episodic ataxia or hemiplegic migraine."*
- **`no_route`:** Ziva en incertidumbre, mostrando los gaps.
- **Error de red o 429:** mensaje recuperable con botón *Try again*.

## O5. Móvil (< 1024 px; referencia: `mockup-atlas-mobile.svg`)
- **Header compacto:** logo + menú.
- **Grafo** arriba (55 vh), con chips `Ziva · guide` | `Evidence` | `Community` encima.
- **Bottom sheet** con el contenido de la pestaña elegida: el chat de Ziva por defecto.
- **Composer** fijo abajo.
- Sin scroll horizontal a 390 px.

## O6. Identidad (Brand Book)
- **Tipografía:** Sora en títulos, Manrope en texto. Jerarquía: título 22–28, cuerpo 15–16, labels 11–12 en mayúsculas con tracking.
- **Colores:** navy `#0A2E4E`, blue `#1E6091`, mint `#4CC9B0` **solo para descubrimiento** (iluminado, encontrado, siguiente paso), mist `#F4F7FA`. Ámbar solo para pendiente o advertencia.
- **Forma:** radios de 12–16 en tarjetas y 8 en botones; bordes de 1 px `#dde5ee`. Sin sombras fuertes, sin gradientes en el logo y sin neón.
- **Contraste AA** en todo el texto (el gris de las ayudas no puede ser más claro que `#5b6b7c` sobre blanco).

## O8. Idioma (EN por defecto, ES opcional)
- Selector **EN | ES** en el header (y en el menú móvil). Por defecto **EN**, aunque el navegador esté en español: los jueces son internacionales. La elección se guarda en `localStorage`.
- **Todos los textos de la UI** salen de un diccionario `src/i18n.ts` (`{ en: {...}, es: {...} }`): header, estado vacío, sugerencias, pestañas, estados de Ziva, mensajes de error, disclaimer, panel Review, Community y What's missing. Ningún texto visible queda fijo en los componentes.
- Las **sugerencias** del chat existen en los dos idiomas (en ES: *"¿Una terapia para FHM1 sirve en EA2?"*, *"¿Qué grupos existen para la ataxia episódica tipo 2?"*, *"¿Qué falta para investigar SCA6?"*).
- **LLM:** `api/ask.ts` **no se modifica**; el prompt ya responde en el idioma de la pregunta. Si el usuario escribe en español, Ziva responde en español.
- **Voz:** `speak()` usa `en-US` o `es-MX` según el idioma de la UI, y el micrófono (`SpeechRecognition.lang`) también.
- **Guion `DEMO`:** agrega `say_es` a cada paso, con traducción fiel al español mexicano (tú, sin voseo). Los `nodes`, `focus` y `links` son los mismos; solo cambia el texto. El demo usa el idioma activo.
- Los nombres de enfermedades, genes, IDs y citas de evidencia **no se traducen** (vienen de las fuentes).

## O9. Chat real + Demo para el video
- **El composer del chat siempre llama al LLM real** (`buildContext` → `/api/ask`, con el rol activo), con el flujo actual de iluminación, voz y filtro de ids. Nunca hay respuestas simuladas en el chat.
- **Botón `▶ Watch demo`** visible en el header y también en el estado vacío del chat. Reproduce el guion `DEMO` fijo, sin LLM ni red, con voz e iluminación. Sus turnos aparecen en el chat con una etiqueta pequeña `DEMO`, para que nunca se confundan con respuestas del LLM.
- El replay del agente (`▶ Run agent: DEE69`) queda en el menú secundario, con la etiqueta `AGENT RUN` en sus turnos.
- Mientras corre el demo o el replay, el composer se deshabilita y aparece un botón **Stop**, que cancela la voz y deja el estado limpio.

## O7. Limpieza
- Usa CSS propio en `index.css`, organizado por secciones (header, chat, graph overlay, panels, mobile).
- Divide `App.tsx` en un máximo de 3 componentes nuevos: `ZivaChat.tsx`, `SidePanel.tsx`, `FindInGraph.tsx`. `App.tsx` queda como orquestador del estado.

## Aceptación
1. `npm run build` OK y los self-checks OK (`node --experimental-strip-types src/subgraph.ts` y `api/ask.ts`).
2. **Capturas en tiempo real** (CDP o Chrome normal; **no** uses `--virtual-time-budget`):
   - (a) escritorio 1440×900 en estado vacío;
   - (b) después de la sugerencia FHM1/EA2 respondida (con key en `.env.local`);
   - (c) al final del replay del agente;
   - (d) la pestaña Community con DEE69 seleccionada;
   - (e) móvil 390×844.
   Describe cada una.
3. Capturas extra: (f) estado vacío en **ES**; (g) un paso del demo en ES.
4. Checklist ✅/❌:
   - el demo de 9 pasos sale en el chat, con la etiqueta DEMO, en EN y en ES;
   - una pregunta escrita en el chat llama a `/api/ask` (verificable en la pestaña Network) y no al guion;
   - una pregunta en español recibe respuesta en español;
   - el idioma persiste al recargar;
   - `?step=N` y `?run=dee69` siguen funcionando;
   - Find in graph no llama al LLM;
   - el micrófono funciona o se oculta;
   - Reset deja todo limpio;
   - no hay errores en la consola.
5. Lista de archivos tocados con su hora. Confirma que `Graph3D.tsx`, `subgraph.ts`, `api/ask.ts` y `public/data/*` **no cambiaron**.
