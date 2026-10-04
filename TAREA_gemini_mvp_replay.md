# TAREA L: secuencia clara del replay y pulido de MVP

**Prerrequisito:** TAREA K terminada. Carpeta: `Hacknation/atlas/`. Código y UI en inglés.
**No borres ni cambies datos auditados** (`data/*.jsonl`, `data/contrib/*`, `graph.json`, `runs/*.json`). Solo UI y lógica de visualización.

## Diagnóstico (auditoría de código y capturas)
Problemas del replay `?run=dee69` / botón "Run research agent":
1. **"Se ocultan los nodos":** en cada evento, `setHl` ilumina **solo** los nodos de ese evento, y `Graph3D` apaga todo lo demás (`DIM` = 0.28 sobre navy y links al 0.06). En los eventos sin nodos nuevos (`trials`, `gaps`) solo queda iluminado el foco, así que el grafo entero "desaparece". También borra lo que se construyó en los eventos anteriores.
2. **No se ve la construcción:** el resaltado no es acumulativo. En el evento N ya no se ve lo agregado en 1…N-1.
3. **Los nodos nuevos aparecen lejos:** entran sin posición, la simulación los coloca en el origen y viajan solos. No "crecen" desde su ancla (CACNA1E o DEE69). El nodo de DEE69 entra **sin links** en `resolve` y queda flotando hasta `genes`.
4. **La cámara no siempre vuela:** `flyTo` corre cuando el nodo nuevo todavía no tiene `x`, devuelve `false` y no reintenta.
5. **Ritmo:** 1.2 s por evento sin voz es menos de lo que tarda la cámara (1.4 s) más el reacomodo del grafo.
6. **El final no resume nada:** termina en `gaps`, con todo apagado.

## L1. Estado de resaltado de tres niveles (`Graph3D.tsx`)
Extiende `Highlight` con un campo opcional `trail?: Set<string>`, para los nodos ya construidos en pasos anteriores:
| Nivel | Nodo | Link |
|---|---|---|
| `nodes` (paso actual) | mint, con etiqueta | mint + partículas |
| `trail` (pasos anteriores) | mint al 55 % de opacidad, **sin** etiqueta | mint al 35 % |
| resto, con highlight activo | color de su grupo al **35 %** (no `DIM` 0.28 azul) | 0.15 |
Así el contexto nunca desaparece. Sin highlight, todo igual que hoy. El guion `DEMO` no usa `trail`, así que su comportamiento no cambia.

## L2. Replay acumulativo (`App.tsx`, `replayRun`)
- Mantén un `Set` acumulado. En cada evento: `trail` = acumulado anterior; `nodes` = lo agregado en este evento **más** su `focus`.
- **Sembrar posiciones:** antes de agregar un nodo nuevo, si su ancla ya está en el grafo (el otro extremo de su primer link nuevo, o el `focus` del evento), copia la posición del ancla con un pequeño offset aleatorio (±15) en `x`, `y`, `z`. Así crece desde ahí. Para `resolve`, ancla DEE69 en `HGNC:1392` (CACNA1E) si existe.
- **Reintento de cámara:** si `flyTo` falla porque aún no hay posición, reintenta cada 200 ms hasta 2 s.
- **Ritmo sin voz:** 2.5 s por evento. Con voz, espera a que termine el audio y luego 600 ms.
- **Evento final sintético (sin tocar el JSON):** después del último evento, ilumina como `nodes` todo lo agregado por la corrida, sin `trail`. Haz `zoomToFit(1200, 80)` y agrega al transcript una línea de resumen con los conteos **calculados del propio JSON**: *"Agent run complete: {n} nodes and {m} links added, {k} pending expert review."*

## L3. Que se vea la diferencia entre "dato" y "contribución"
- Los nodos agregados por el replay que tengan al menos un link `contributed` llevan un **anillo** ámbar fino (`#F2B134`) en su etiqueta, o una etiqueta `PENDING` en el SpriteText cuando están iluminados.
- La leyenda agrega: `● Pending expert review` (ámbar).

## L4. Revisión de toda la funcionalidad (checklist de MVP)
Verifica cada punto en Chrome y corrige solo lo necesario:
1. Carga inicial: el grafo completo, encuadrado (`zoomToFit` una vez), sin nodos sueltos.
2. `▶ Demo`: los 9 pasos en orden, cada uno con nodos y links iluminados (ningún paso queda con 0 links si sus nodos están conectados).
3. `?step=N` para N = 1…9.
4. Roles, Explore y respuesta real: los nodos se iluminan y aparece `mechanism_warning` cuando aplica.
5. Clic en una enfermedad → "What's missing" (incluye VUS y el registro nuevo de K). Clic en un link → evidencia con sus badges (verified verbatim / pending review / expert-reviewed).
6. `Run research agent: DEE69` con voz y `?run=dee69` sin voz: secuencia clara según L1–L3, termina en el resumen.
7. **Después del replay**, Explore *"What do we know about DEE69?"* usa los nodos nuevos y dice "pending expert review".
8. `Reset`: limpia el highlight, el transcript **y** quita lo agregado por el replay (vuelve al `graph.json` original).
9. No hay errores en la consola del navegador.

## Aceptación
- `npm run build` OK y los self-checks OK.
- Capturas (Chrome headless con `--use-angle=swiftshader --enable-unsafe-swiftshader`, `--virtual-time-budget` suficiente): `?run=dee69` a la mitad del replay y al final, y `?step=4`. Describe qué se ve en cada una.
- Pega el checklist de L4 marcado ✅/❌, con una nota por cada ❌.
