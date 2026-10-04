import pandas as pd
import streamlit as st

from agent import AgenteDataBridge

st.set_page_config(
    page_title="CACNA1A Rare Disease Atlas", page_icon="🧬", layout="wide"
)

st.title("🧬 CACNA1A Rare Disease Atlas")
st.caption(
    "Consolidado automático de datos estructurados vía AgenteDataBridge con IDs Canónicos"
)

# 1. Instanciación e invocación programática del AgenteDataBridge
bridge = AgenteDataBridge()

# 2. Extracción automática de información desde el DataBridge
resumen = bridge.recabar_resumen_canonico()
df_papers = bridge.recabar_papers()
df_trials = bridge.recabar_ensayos()
df_variants = bridge.recabar_variantes()
df_diseases = bridge.recabar_enfermedades()
df_phenotypes = bridge.recabar_fenotipos()
df_entities = bridge.recabar_entidades()

# --- VISTA 1: MÉTRICAS GENERALES RECABADAS ---
c1, c2, c3, c4, c5 = st.columns(5)
c1.metric("Gene (HGNC)", "HGNC:1388")
c2.metric("Papers (PMID)", resumen.get("papers", 0))
c3.metric("Ensayos (NCT)", resumen.get("ensayos", 0))
c4.metric("Variantes (ClinVar)", resumen.get("variantes", 0))
c5.metric("Entidades / Slugs", resumen.get("entidades", 0))

st.divider()

# --- VISTA 2: NAVEGACIÓN Y TABLAS RECOLECTADAS ---
(
    tab_papers,
    tab_trials,
    tab_variants,
    tab_diseases,
    tab_hpo,
    tab_entities,
) = st.tabs([
    "📄 Papers (PMID)",
    "🏥 Ensayos Clínicos (NCT)",
    "🧬 Variantes (ClinVar)",
    "🩺 Enfermedades (OMIM)",
    "🏷️ Fenotipos (HPO)",
    "🌐 Entidades / Slug",
])

with tab_papers:
    st.write(
        f"**Publicaciones recabadas desde PubMed (`PMID:`):** {len(df_papers)}"
    )
    st.dataframe(df_papers, use_container_width=True)

with tab_trials:
    st.write(
        f"**Ensayos clínicos recabados desde ClinicalTrials.gov (`NCT`):** {len(df_trials)}"
    )
    st.dataframe(
        df_trials,
        use_container_width=True,
        column_config={
            "source_url": st.column_config.LinkColumn(
                "Enlace Oficial", display_text="Ver Ensayo"
            )
        }
        if "source_url" in df_trials.columns
        else {},
    )

with tab_variants:
    st.write(
        f"**Variantes recabadas desde ClinVar (`ClinVar:`):** {len(df_variants)}"
    )
    st.dataframe(
        df_variants,
        use_container_width=True,
        column_config={
            "source_url": st.column_config.LinkColumn(
                "Enlace NCBI", display_text="Ver Variante"
            )
        }
        if "source_url" in df_variants.columns
        else {},
    )

with tab_diseases:
    st.write(
        f"**Enfermedades mapeadas (`OMIM:`):** {len(df_diseases)}"
    )
    st.dataframe(
        df_diseases,
        use_container_width=True,
        column_config={
            "source_url": st.column_config.LinkColumn(
                "Enlace OMIM", display_text="Ver Ficha"
            )
        }
        if "source_url" in df_diseases.columns
        else {},
    )

with tab_hpo:
    st.write(
        f"**Fenotipos mapeados (`HP:`):** {len(df_phenotypes)}"
    )
    st.dataframe(
        df_phenotypes,
        use_container_width=True,
        column_config={
            "source_url": st.column_config.LinkColumn(
                "Enlace JAX HPO", display_text="Ver Término"
            )
        }
        if "source_url" in df_phenotypes.columns
        else {},
    )

with tab_entities:
    st.write(
        f"**Entidades adicionales recabadas (`org:`, `mech:`, `tx:`, `asset:`):** {len(df_entities)}"
    )
    st.dataframe(
        df_entities,
        use_container_width=True,
        column_config={
            "source_url": st.column_config.LinkColumn(
                "Fuente Verificable", display_text="Abrir Recurso"
            )
        }
        if "source_url" in df_entities.columns
        else {},
    )