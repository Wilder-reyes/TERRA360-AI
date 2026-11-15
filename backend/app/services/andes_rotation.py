"""Conservative four-campaign Andean rotation comparison for Chalhuas.

Only botanical-family and timetable arithmetic are computed here. The documented
papa/arveja alternation is historical, not observed for any current farmer.
No soil, water allocation, yield, profit or crop suitability is fabricated.
"""
from __future__ import annotations
from datetime import date

STUDY_URL = "https://cdn.www.gob.pe/uploads/document/file/5501553/4903730-estudio-agrologico.pdf?v=1701297728"
INIA_URL = "https://repositorio.inia.gob.pe/bitstream/20.500.12955/1146/1/MANUAL%20T%C3%89CNICO%20-%20MANEJO%20INTEGRADO%20DEL%20CULTIVO%20DE%20PAPA.pdf"

CROPS = {
    "papa": {"name_es":"Papa", "name_en":"Potato", "family":"Solanaceae", "role_es":"Tubérculo", "role_en":"Tuber"},
    "arveja": {"name_es":"Arveja", "name_en":"Pea", "family":"Fabaceae", "role_es":"Leguminosa", "role_en":"Legume"},
    "haba": {"name_es":"Haba", "name_en":"Fava bean", "family":"Fabaceae", "role_es":"Leguminosa", "role_en":"Legume"},
    "quinua": {"name_es":"Quinua", "name_en":"Quinoa", "family":"Amaranthaceae", "role_es":"Grano andino", "role_en":"Andean grain"},
    "cebada": {"name_es":"Cebada", "name_en":"Barley", "family":"Poaceae", "role_es":"Cereal", "role_en":"Cereal"},
    "avena": {"name_es":"Avena", "name_en":"Oats", "family":"Poaceae", "role_es":"Cereal o forraje", "role_en":"Cereal or forage"},
}
# These sequences are documented agronomic *hypotheses*, not fitted or ranked
# recommendations for a farm. Reference from INIA mentions fallow too.
REFERENCES = [
    ("R1", "Rotación andina de referencia INIA", "Andean INIA reference", ["papa","quinua","cebada","haba"]),
    ("R2", "Alternativa diversificada para estudiar", "Diversified sequence to study", ["papa","arveja","avena","quinua"]),
]
BASELINE = ["papa","arveja","papa","arveja"]


def describe(sequence:list[str], start_year:int, identity:str, name_es:str, name_en:str)->dict:
    if len(sequence)!=4 or any(cid not in CROPS for cid in sequence):
        raise ValueError("Se requieren cuatro campañas anuales con cultivos del catálogo local.")
    if start_year < 2020 or start_year > date.today().year + 5:
        raise ValueError("El año inicial está fuera de rango.")
    families=[CROPS[cid]["family"] for cid in sequence]
    repeated=sum(a==b for a,b in zip(families,families[1:]))
    potato_positions=[i for i,cid in enumerate(sequence) if cid=="papa"]
    potato_intervals=[b-a for a,b in zip(potato_positions,potato_positions[1:])]
    legumes=sum(f=="Fabaceae" for f in families)
    # A one-year campaign is NOT a full year under cultivation.
    return {
        "id":identity,"title_es":name_es,"title_en":name_en,
        "schedule":[{"campaign":i+1,"year":start_year+i,"crop_id":cid,
                     "name_es":CROPS[cid]["name_es"],"family":families[i],
                     "sowing_month":None,"harvest_month":None,
                     "dates_verified":False} for i,cid in enumerate(sequence)],
        "indicators":{"botanical_families":len(set(families)),
                      "adjacent_family_repetitions":repeated,
                      "legume_campaigns":legumes,
                      "potato_return_interval_campaigns":potato_intervals or None},
        "flags_es":[*(
            ["Se repite una misma familia botánica en campañas contiguas: revisar riesgos fitosanitarios."]
            if repeated else []),
            *(
            ["Hay retorno de papa en menos de cuatro campañas; revisar antecedentes de plagas y enfermedades."]
            if potato_intervals and min(potato_intervals)<4 else [])
        ],
        "limitations_es":[
            "Campañas anuales ilustrativas: no se conocen aún fechas de siembra ni de cosecha validadas para esta parcela.",
            "No se dispone de suelo analizado, volumen de riego, precios en chacra ni historial fitosanitario comprobados.",
            "La presencia de leguminosas no permite cuantificar nitrógeno aportado al suelo.",
        ],
        "flags_en":[*(
            ["The same botanical family occurs in consecutive campaigns; review crop health risks."]
            if repeated else []),
            *(["Potatoes return in fewer than four campaigns; review pest and disease history."]
              if potato_intervals and min(potato_intervals)<4 else [])],
        "limitations_en":[
            "Illustrative annual campaigns; local sowing and harvesting dates remain unverified.",
            "Soil test, irrigation volume, farmgate prices and pest history have not been verified.",
            "Including legumes does not quantify nitrogen inputs or soil fertility improvements.",
        ],
    }


def compare(rotation:list[str],start_year:int,priority:str,history_source:str='example')->dict:
    if priority not in ("water","soil","both"):
        raise ValueError("Prioridad no reconocida")
    if history_source not in ('example','farmer_declared'):
        raise ValueError('Origen de historial no reconocido')
    if len(rotation)!=4 or any(cid not in CROPS for cid in rotation):
        raise ValueError("Utiliza cuatro cultivos válidos del catálogo andino")
    initial=describe(rotation,start_year,"S0",
        "Lo registrado por ti" if history_source=="farmer_declared" else "Ejemplo histórico para investigar",
        "Your recorded sequence" if history_source=="farmer_declared" else "Historical example to explore")
    scenarios=[describe(crops,start_year,identity,title_es,title_en)
               for identity,title_es,title_en,crops in REFERENCES]
    # Only botanical sequence comparisons have evidence. Water priority may be
    # selected but cannot be used to rank without validated local crop calendars,
    # variety/stage Kc, effective rainfall and irrigation allocation.
    priority_messages={
        'water': (
            'Tu prioridad es el agua. Falta evidencia local para comparar demanda o ahorro de riego; '
            'las opciones quedan sin clasificación hídrica.',
            'Water is your priority. Local evidence is insufficient to compare irrigation demand or savings; '
            'none of these options is ranked by water use.'),
        'soil': (
            'Tu prioridad es el suelo. Comparamos estructura botánica comprobable: familias distintas, '
            'repeticiones contiguas y retorno de papa. Esto no demuestra fertilidad ni reduce por sí solo enfermedades.',
            'Soil is your priority. We compare documented botanical structure: distinct families, '
            'consecutive repeats and potato return. This does not prove soil fertility or disease reduction.'),
        'both': (
            'Buscas equilibrio: es posible comparar diversidad botánica, pero todavía faltan datos locales '
            'para valorar el agua. Ninguna opción es una recomendación automática.',
            'For a balance, botanical diversity can be compared, but local water evidence is still missing. '
            'There is no automatic recommendation.'),
    }
    for scenario in [initial,*scenarios]:
        a,b=initial['indicators'],scenario['indicators']
        scenario['comparison_to_user_sequence']={
            'additional_botanical_families': b['botanical_families']-a['botanical_families'],
            'adjacent_family_repetitions_change': b['adjacent_family_repetitions']-a['adjacent_family_repetitions'],
            'legume_campaigns_change': b['legume_campaigns']-a['legume_campaigns'],
            'status':'observed_sequence_structure_only',
        }
    return {
        "status":"illustrative_comparison",
        "scope":"Chalhuas, Huáchac, Chupaca, Junín — reference sector, not a certified parcel",
        "selected_priority":priority,"history_source":history_source,"start_year":start_year,"end_year":start_year+3,
        "model_status":"not_trained_for_chalhuas","automatic_recommendation":None,
        "confidence":"requires_local_agronomic_validation",
        "strategies":[initial,*scenarios],
        "comparison_summary_es":priority_messages[priority][0],
        "comparison_summary_en":priority_messages[priority][1],
        "priority_evidence":{
            "selected":priority,
            "soil":"botanical_sequence_structure_only",
            "water":"insufficient_local_inputs_no_irrigation_ranking",
            "quantitative_water_savings_available":False,
            "automatic_farm_suitability_ranking":False,
        },
        "water_note_es":"No se calculó ahorro de agua ni demanda de riego para Chalhuas: aún faltan calendarios locales, variedad, manejo y disponibilidad efectiva de agua.",
        "source_records":[
            {"title":"Estudio agrológico del proyecto Chalhuas (referencias históricas)","url":STUDY_URL},
            {"title":"INIA: Manejo integrado de la papa, rotación andina","url":INIA_URL},
        ],
        "field_evidence_available":False,
        "sowing_calendar_verified":False,
        "yield_forecast_available":False,
    }


def catalogue()->dict:
    return {"zone":"chalhuas","version":"2026-11-15-exploratory",
            "status":"local_catalogue_for_study_not_farm_suitability",
            "crops":[{"id":cid,**info,"sowing_months_local":None,"sowing_calendar_verified":False}
                     for cid,info in CROPS.items()],
            "historical_reference":BASELINE,
            "four_campaign_reference":[x[3] for x in REFERENCES],
            "sources":[{"title":"INIA, manejo integrado de papa","url":INIA_URL},
                       {"title":"Estudio agrológico Chalhuas","url":STUDY_URL}],
            "note_es":"La documentación histórica avala investigar los cultivos, no su aptitud en una parcela específica. No se han verificado calendarios por variedad ni turnos de riego."}
