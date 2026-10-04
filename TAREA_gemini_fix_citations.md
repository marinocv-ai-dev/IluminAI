# TAREA H: corregir las citas con PMIDs viejos (hallazgo de la extracción con OpenAI)

Carpeta: `Hacknation/`. Solo stdlib de Python.

## Hallazgo de la auditoría
La TAREA G funcionó como detector. De 78 aristas con fuente PubMed, **52 todavía apuntan en `evidence[0].url` a los PMIDs inventados originales**. `fix_ids.py` corrigió los nodos `PMID:*`, pero **no actualizó las URLs de evidencia de las aristas**, y `verify_ids.py` solo revisaba nodos. Por eso OpenAI respondió "unrelated" (los abstracts eran de plantas, VIH, etc.), y las citas de esas aristas **no salen de ningún abstract**: las escribió el modelo original de memoria.

Además, `data/extract_report.md` dice "Supports (verbatim): 0", pero en `edges.jsonl` hay 23 aristas con `verified_verbatim: true`. El reporte no coincide con los datos.

## H1. Remapear URLs de evidencia (con script, no a mano)
Crea `scripts/remap_evidence_pmids.py` con esta tabla. La saqué cruzando los labels de autor de `data/nodes.jsonl.bak` con los nodos corregidos:

| PMID viejo (URL de evidencia) | Label original | PMID real (nodo actual) |
|---|---|---|
| 8934531 | Ophoff 1996 | 8898206 |
| 8988179 | Zhuchenko 1997 | 8988170 |
| 14999285 | van den Maagdenberg 2004 | 15003170 |
| 15004139 | Strupp 2004 | 15136697 |
| 24074887 | Du 2013 | 23827678 |
| 17967913 | Tottene 2009 | 19285472 |
| 11867768 | De Fusco 2003 | 12539047 |
| 16141073 | Dichgans 2005 | 16054936 |
| 12702710 | Browne 1994 | 7842011 |
| 19364908 | Jen 2005 | 16116111 |
| 29780183 | Indelicato & Boesch 2018 | 41775907 ⚠ |
| 33246834 | Kessi 2021 | 37555011 ⚠ |
| 21330775 | Klockgether 2011 | 26377379 ⚠ |
| 15371536 | Al-Twaijri & Shevell 2002 | — (eliminado) |

⚠ = el paper sustituto es **otro paper** (otro año o primer autor). La re-extracción decidirá si respalda la afirmación.

Para cada arista cuya URL tenga un PMID viejo:
1. Reemplaza la URL por `https://pubmed.ncbi.nlm.nih.gov/{nuevo}/`.
2. **Vacía la cita** (`quote: ""`) y quita `verified_verbatim`. La cita vieja no salió de ningún abstract y no se puede mostrar.
3. Si el PMID viejo no tiene sustituto (15371536), marca `needs_review: "no_source"` con cita vacía.

Guarda un respaldo como `data/edges.jsonl.bak-remap`. El script es idempotente.

## H2. Re-extraer con OpenAI
Corre `python scripts/openai_extract.py` sobre las aristas remapeadas. Ajusta el script para que:
- Procese las aristas con `quote == ""` o con `needs_review`, aunque ya se hayan intentado antes.
- **Si el resultado no es `supports` con cita literal, deje `quote: ""`.** Nunca vuelve a la cita anterior (antes hacía "fallback": eso queda prohibido).
- Escriba un reporte cuyos conteos salgan del archivo final (supports-verbatim, contradicts, unrelated, no_abstract, no_source), para que coincida con los datos.

## H3. Que no vuelva a pasar
En `scripts/verify_ids.py`, agrega un chequeo: cada URL de evidencia de PubMed debe apuntar a un PMID que **exista como nodo** en el grafo, o que resuelva en esummary con un título coherente. Repórtalo como `STALE EVIDENCE` y súmalo al conteo de problemas.

## H4. UI
En el panel de evidencia, si `quote` está vacío, muestra *"No verified quote yet: needs expert review"* en lugar de comillas vacías. El badge ámbar de `needs_review` ya existe.

## Aceptación
1. `python scripts/verify_ids.py` → 0 problemas, **incluido 0 STALE EVIDENCE**.
2. `python scripts/build_graph.py data` sin ERROR. `cd atlas && npm run build` OK.
3. Ninguna arista PubMed tiene una cita que no sea `verified_verbatim` o vacía. Verifícalo con un conteo y pega el resultado.
4. Pega el nuevo `data/extract_report.md` y la lista de aristas que quedaron `needs_review`, con el motivo de cada una. **No las resuelvas**: las revisa el biólogo.
