# Resumen de Curación: Atlas de CACNA1A (Reto 5 Hack-Nation)

### 1. Tres conexiones no obvias descubiertas con evidencia
1. **La toxicidad de SCA6 no es solo por el canal iónico, sino por un segundo péptido transcripcional (alpha1ACT) codificado por el mismo gen**:
   - *Hallazgo:* CACNA1A contiene un sitio interno de entrada al ribosoma (IRES) que produce un factor de transcripción bicistrónico independiente llamado $\alpha1\text{ACT}$. La expansión CAG tóxica se encuentra en este fragmento nuclear, provocando la muerte de células de Purkinje independientemente del flujo de calcio de la membrana.
   - *Fuente:* Du et al., 2013 (*Cell*), PMID:24074887.
2. **Convergencia patológica entre transportadores astrocitarios de glutamato y canales de calcio**:
   - *Hallazgo:* La ataxia episódica tipo 6 (EA6, gen *SLC1A3*) y la migraña hemipléjica tipo 2 (*ATP1A2*) convergen con *CACNA1A* no por homología de secuencia, sino porque ambas provocan acumulación de glutamato y potasio en la sinapsis perisomática de las células de Purkinje y la corteza, activando la depresión cortical propagada (CSD).
   - *Fuente:* Jen et al., 2005 (*Neurology*), PMID:19364908 / De Fusco et al., 2003 (*Nat Genet*), PMID:11867768.
3. **Respuesta paradójica a bloqueadores de potasio (4-Aminopiridina) en ataxias episódicas**:
   - *Hallazgo:* Aunque la EA2 es un canalopatía de calcio presináptico (*CACNA1A* pérdida de función), el tratamiento más eficaz para restaurar la regularidad de disparo de las células de Purkinje no modula el calcio sino el potasio voltaje-dependiente (4-AP bloquea canales Kv), rescatando el marcapasos cerebeloso.
   - *Fuente:* Strupp et al., 2004 (*Neurology*), PMID:15004139.

---

### 2. Ruta de la Demo (Salto a Salto)
Para una familia con una variante grave de ganancia de función (*S218L*) o de pérdida de función en *CACNA1A*:
1. **Familia / Variante:** `ClinVar:42248` (CACNA1A c.653C>T, p.Ser218Leu)
2. **Mecanismo:** `mech:gain-of-function` (Hiperactivación y desplazamiento de activación) → `mech:cortical-spreading-depression`
3. **Otra Comunidad / Mecanismo Compartido:** `HGNC:807` (*ATP1A2*, FHM2) y `HGNC:10582` (*SCN1A*, FHM3 / Dravet)
4. **Activo de Investigación Existente:**
   - Modelo: `asset:s218l-knockin-mouse` (modelo murino validado para trauma craneal y edema)
   - Registro: `asset:cacna1a-patient-registry` (CoRDS) / `NCT05168800` (Historia natural en Columbia)
5. **Investigador Puente:** `person:arn-van-den-maagdenberg` (investiga tanto FHM1 como EA2 y generó los modelos Knock-in) y `person:wendy-chung` (lidera la historia natural de fenotipos severos y EA2).
6. **Siguiente Paso Concreto:**
   - Inscribirse en el registro global de la CACNA1A Foundation (`org:cacna1a-foundation` / `asset:cacna1a-patient-registry`).
   - Solicitar evaluación en el protocolo observacional multicéntrico `NCT05168800`.
   - Protocolo de emergencia hospitalaria para portadores de S218L: evitar traumatismos craneoencefálicos menores y monitorización de edema cerebral agudo.

---

### 3. Contraejemplo honesto (Conexión aparente sin respaldo)
- **Terapia génica de reducción de expresión (ASO / Knockdown) universal para enfermedades de CACNA1A**:
  - *Premisa intuitiva:* Si los ASO funcionan suprimiendo genes mutados en ataxias dominantes (como en SCA2 con *ATXN2*), podría usarse un ASO no alélico para regular *CACNA1A*.
  - *Evidencia real:* En EA2 la enfermedad es debida a **haploinsuficiencia y pérdida de función**. Reducir la expresión empeoraría drásticamente los síntomas de EA2 o provocaría neurodegeneración cerebelosa (similar a los ratones homocigotos nulos letales). Los ASOs solo pueden ser útiles en alelos selectivos para *alpha1ACT* (SCA6) o ganancia tóxica (FHM1 severo), demostrando la tesis: *"Mismo gen ≠ misma enfermedad / Mismo gen ≠ misma terapia"*.

---

### 4. Gaps (Buscado y no encontrado / No verificado)
1. **Ensayos clínicos Fase 3 específicos para EA2**: No existen ensayos clínicos aleatorizados a gran escala patrocinados por la industria farmacéutica; los estudios disponibles para 4-AP y acetazolamida son ensayos académicos independientes con cohortes reducidas (crossover < 30 pacientes).
2. **Biobanco centralizado de líneas iPSC para mutaciones específicas de DEE42**: Aunque existen líneas esporádicas en Coriell, no hay un repositorio consolidado y de acceso abierto con caracterización funcional para variantes ultra-raras *de novo* como Arg1330Gln.
3. **Historia natural pediátrica prospectiva completada**: El estudio `NCT05168800` está activo y en reclutamiento, pero aún no tiene resultados formales publicados de progresión motora y cognitiva longitudinal a 5 años.
