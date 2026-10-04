import sqlite3
import pandas as pd


class AgenteDataBridge:
    """Capa de servicio y enlace de datos local con identificadores canónicos."""

    def __init__(self, db_path: str = "cacna1a_atlas.db"):
        self.db_path = db_path

    def _obtener_conexion(self):
        return sqlite3.connect(self.db_path)

    def recabar_resumen_canonico(self) -> dict:
        """Extrae el recuento consolidado de todas las entidades del grafo local."""
        conn = self._obtener_conexion()
        cursor = conn.cursor()
        resumen = {}
        try:
            cursor.execute("SELECT COUNT(*) FROM Genes")
            resumen["genes"] = cursor.fetchone()[0]

            cursor.execute("SELECT COUNT(*) FROM Papers")
            resumen["papers"] = cursor.fetchone()[0]

            cursor.execute("SELECT COUNT(*) FROM Clinical_Trials")
            resumen["ensayos"] = cursor.fetchone()[0]

            cursor.execute("SELECT COUNT(*) FROM Variants")
            resumen["variantes"] = cursor.fetchone()[0]

            cursor.execute("SELECT COUNT(*) FROM Diseases")
            resumen["enfermedades"] = cursor.fetchone()[0]

            cursor.execute("SELECT COUNT(*) FROM Phenotypes")
            resumen["fenotipos"] = cursor.fetchone()[0]

            cursor.execute("SELECT COUNT(*) FROM Entity_Assets")
            resumen["entidades"] = cursor.fetchone()[0]
        except Exception as e:
            resumen["error"] = str(e)
        finally:
            conn.close()

        return resumen

    def recabar_papers(self, filtro: str = "") -> pd.DataFrame:
        conn = self._obtener_conexion()
        query = (
            "SELECT pmid_id, title, journal, pub_date, gene_id FROM Papers"
        )
        params = []
        if filtro.strip():
            f = filtro.strip()
            query += " WHERE pmid_id LIKE ? OR title LIKE ?"
            params.extend([f"%{f}%", f"%{f}%"])
        query += " ORDER BY pub_date DESC"
        df = pd.read_sql(query, conn, params=params)
        conn.close()
        return df

    def recabar_ensayos(self, filtro: str = "") -> pd.DataFrame:
        conn = self._obtener_conexion()
        query = "SELECT nct_id, title, status, conditions, source_url FROM Clinical_Trials"
        params = []
        if filtro.strip():
            f = filtro.strip()
            query += " WHERE nct_id LIKE ? OR title LIKE ? OR conditions LIKE ?"
            params.extend([f"%{f}%", f"%{f}%", f"%{f}%"])
        df = pd.read_sql(query, conn, params=params)
        conn.close()
        return df

    def recabar_variantes(self, filtro: str = "") -> pd.DataFrame:
        conn = self._obtener_conexion()
        query = "SELECT clinvar_id, title, clinical_significance, source_url FROM Variants"
        params = []
        if filtro.strip():
            f = filtro.strip()
            query += " WHERE clinvar_id LIKE ? OR title LIKE ?"
            params.extend([f"%{f}%", f"%{f}%"])
        df = pd.read_sql(query, conn, params=params)
        conn.close()
        return df

    def recabar_enfermedades(self) -> pd.DataFrame:
        conn = self._obtener_conexion()
        df = pd.read_sql(
            "SELECT disease_id, name, source_url FROM Diseases", conn
        )
        conn.close()
        return df

    def recabar_fenotipos(self) -> pd.DataFrame:
        conn = self._obtener_conexion()
        df = pd.read_sql(
            "SELECT hp_id, term, source_url FROM Phenotypes", conn
        )
        conn.close()
        return df

    def recabar_entidades(self, tipo_slug: str = "") -> pd.DataFrame:
        conn = self._obtener_conexion()
        query = (
            "SELECT asset_id, entity_type, name, source_url FROM Entity_Assets"
        )
        params = []
        if tipo_slug.strip() and tipo_slug != "Todos":
            clean_type = tipo_slug.replace(":", "").lower()
            query += " WHERE entity_type = ? OR asset_id LIKE ?"
            params.extend([clean_type, f"%{clean_type}:%"])
        df = pd.read_sql(query, conn, params=params)
        conn.close()
        return df


if __name__ == "__main__":
    bridge = AgenteDataBridge()
    print("=== Resumen Recabado por DataBridge ===")
    print(bridge.recabar_resumen_canonico())