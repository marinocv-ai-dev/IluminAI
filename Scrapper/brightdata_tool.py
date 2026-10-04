import requests
import os

BRIGHT_DATA_API_KEY = os.getenv("BRIGHT_DATA_API_KEY", "TU_BRIGHT_DATA_API_KEY")

def buscar_estudios_brightdata(termino_busqueda: str):
    """
    Realiza una petición a la API de Bright Data para extraer información
    actualizada de publicaciones o ensayos sobre CACNA1A.
    """
    url = "https://api.brightdata.com/dca/trigger" # Endpoint de tu Collector en Bright Data
    headers = {
        "Authorization": f"Bearer {BRIGHT_DATA_API_KEY}",
        "Content-Type": "application/json"
    }
    payload = {
        "search_term": termino_busqueda
    }
    
    try:
        response = requests.post(url, json=payload, headers=headers)
        if response.status_code == 200:
            return response.json()
        else:
            return f"Error en Bright Data API: Status {response.status_code}"
    except Exception as e:
        return f"Excepción al conectar con Bright Data: {str(e)}"