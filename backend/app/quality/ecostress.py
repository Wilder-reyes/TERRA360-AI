"""Catalogue QA, deliberately never a thermal raster interpretation."""
def summarize_ecostress_granules(payload:dict)->dict:
    """Only public catalogue metadata; no thermal image nor land temperature."""
    entries=(payload.get("feed") or {}).get("entry") or []
    if not isinstance(entries,list):entries=[]
    values=[]
    for x in entries[:8]:
        if not isinstance(x,dict):continue
        ts=x.get("time_start")
        title=x.get("producer_granule_id") or x.get("title") or x.get("id")
        if isinstance(title,str) and isinstance(ts,str) and len(ts)>=10:
            values.append({"granule_name":title[:160],"acquisition_time":ts,
                           "temperature_c":None,"quality_verified":False})
    return {
        "status":"metadata_only_quality_unverified" if values else "no_catalogued_granules",
        "source":"NASA CMR · ECOSTRESS ECO_L2T_LSTE V003",
        "source_url":"https://ecostress.jpl.nasa.gov/data",
        "resolution_m_nominal":70,
        "scenes":values,
        "temperature_values_available":False,
        "note_es":"Se encontraron metadatos de escenas, no mediciones térmicas verificadas. Hay que descargar y validar LST, máscara de nubes y calidad por píxel antes de generar una capa.",
    }
