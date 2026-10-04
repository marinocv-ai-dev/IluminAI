# TAREA F: corregir la calidad del guion del LLM (resultado de la prueba en vivo con gpt-5-nano)

Carpeta: `Hacknation/atlas/`. Código y UI en inglés. Sin dependencias nuevas.

## Resultado de la auditoría (9 llamadas reales: 3 preguntas × 3 roles, OpenAI `gpt-5-nano`)
- ✅ Funciona de punta a punta. JSON válido 9/9 gracias al esquema estricto. 6–10 s por pregunta, ~3.9k + 1k tokens (≈ $0.0006).
- ❌ **IDs con prefijo:** el modelo copia el prefijo de las líneas del subgrafo y devuelve `"L L118"` en lugar de `"L118"` y `"N NCT01543750"` en lugar de `"NCT01543750"`. El filtro del navegador los descarta, así que **casi ningún link se ilumina** (0/7, 0/9, 0/14) y en un caso no se iluminó ningún nodo (0/14).
- ❌ **Advertencia LoF/GoF:** a la pregunta *"Can a therapy for FHM1 be used in EA2?"* solo el rol `researcher` advirtió que los mecanismos son opuestos. `family` y `organization` no lo hicieron, y es la tesis central del producto.
- ❌ **Estado de la evidencia:** el modelo casi nunca dice si un dato es observed, extracted o inferred (1/9).

## F1. Normalizar IDs (crítico)
En `api/ask.ts`, dentro de `parseScript()`, normaliza cada id de `nodes`, `links` y `focus`:
```ts
const cleanId = (s: string) => s.replace(/^[NL]\s+/, '').split('|')[0].trim()
```
Aplícala antes de devolver el guion. Agrega al self-check:
- `"L L118"` → `"L118"`
- `"N NCT01543750"` → `"NCT01543750"`
- `"HGNC:1388|gene|CACNA1A"` → `"HGNC:1388"`

## F2. Advertencia de mecanismo obligatoria (crítico)
1. **Esquema:** agrega al nivel raíz de `SCRIPT_SCHEMA` la propiedad `mechanism_warning: { type: 'string' }` y ponla en `required`. Agrégala también a `Script` y a `parseScript` (string; `''` si falta).
2. **Prompt base (`BASE_SYSTEM`):** agrega la regla: *"mechanism_warning: if the subgraph shows different mechanisms (e.g. loss-of-function vs gain-of-function) for diseases in the question, explain in one sentence why a therapy for one may not help or may harm the other. Otherwise return an empty string."* Adáptala al tono de cada rol vía el bloque del rol.
3. **Subgrafo (`src/subgraph.ts`):** si alguna semilla es una enfermedad o un gen, **siempre** incluye (antes del presupuesto, como las semillas) los links `disrupts` que salen de nodos `mechanism` hacia esas enfermedades, y hacia las enfermedades que causa el gen semilla. Así el modelo siempre tiene la información de LoF/GoF a la vista. Agrega 1 assert al self-check.
4. **App (`src/App.tsx`):** si `mechanism_warning` no viene vacío, insértalo como un paso del guion **antes** de `next_step`. Ilumina los nodos `mech:*` presentes en el subgrafo y usa `focus` en el primero. En el transcript se muestra con la clase `.warn` existente.

## F3. Estado de la evidencia determinista (no depender del LLM)
En el transcript de `App.tsx`, debajo del texto de cada paso, muestra chips pequeños con el conteo de los links iluminados en ese paso, según su `status` en `graph.json`, por ejemplo: `● 2 observed · ● 1 from paper · ● 1 hypothesis`. Usa los colores del brand (mint/blue/gris) y `font-size: 11px`. Así cada paso muestra su respaldo aunque el modelo no lo mencione. La regla del prompt se mantiene.

## Aceptación
1. Self-checks OK (`node --experimental-strip-types src/subgraph.ts` y `api/ask.ts`) y `npm run build` sin errores.
2. Con el dev server corriendo y la key en `.env.local`: `node --experimental-strip-types eval/ask_eval.ts 5173`.
   - Esperado: `links` ≥ 80 % válidos en todas las filas, `nodes` ≥ 80 %, y `lof/gof:true` en **los 3 roles** de la pregunta FHM1/EA2.
   - Pega la salida completa y el costo estimado.
3. Si después de F2 `family` u `organization` siguen sin `lof/gof:true`, **no cambies el modelo tú**: repórtalo. El equipo decide si subir a `gpt-5-mini`.
