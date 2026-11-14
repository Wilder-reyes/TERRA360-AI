"""Transparent multi-campaign *planning preview*, not a sowing calendar.

A planting date for a crop does not establish the next crop's dates. Local
cycle lengths and water constraints have not been validated; avoid forecast-like
month assignments, harvest dates, yield/price projections, or readiness claims.
"""

def plan_preview(request, crops: dict, ai_decision: dict) -> dict:
    suggested = ai_decision.get("sequence_for_review")
    sequence = suggested if suggested else list(request.crops)
    stages = []
    for index, crop_id in enumerate(sequence):
        crop = crops[crop_id]
        exploratory = bool(crop.get("evidence_level"))
        reference_cycle = crop.get("cycle_days") if not exploratory else None
        stages.append({
            "order": index + 1, "crop_id": crop_id, "name": crop["name"],
            "scientific_name": crop["scientific_name"],
            "first_sowing_month_declared": request.sowing_month if index == 0 else None,
            "sowing_date": None, "harvest_date": None,
            "local_cycle_verified": False,
            "literature_cycle_days": reference_cycle,
            "evidence_status": "reference_not_locally_validated" if exploratory else "literature_reference_not_local",
            "status_text": (
                "Falta comprobar sus condiciones de cultivo en esta zona."
                if exploratory else
                "Existen referencias publicadas, pero falta confirmar el calendario local."
            ),
            "status_text_en": (
                "Growing conditions for this location are not verified."
                if exploratory else
                "Published references exist, but the local calendar needs verification."
            ),
        })
    checks = []
    if not request.baseline_crops:
        checks.append(("crop_history", "Cuéntanos qué sembraste en campañas anteriores.",
                       "Tell us which crops you grew in previous seasons."))
    if request.water_access == "unknown":
        checks.append(("water", "Confirma si tienes riego o dependes de la lluvia.",
                       "Confirm whether you have irrigation or depend on rainfall."))
    if not request.sowing_month:
        checks.append(("sowing_month", "Indica en qué mes deseas comenzar.",
                       "Specify the month you want to start."))
    if not request.soil_test_available:
        checks.append(("soil", "Confirma las condiciones del suelo con una evaluación local.",
                       "Confirm soil conditions through a local assessment."))
    if any(s["evidence_status"] == "reference_not_locally_validated" for s in stages):
        checks.append(("crop_evidence", "Necesitamos fuentes agronómicas para los cultivos exploratorios.",
                       "Agronomic sources are needed for exploratory crops."))
    if not request.region_crop_validation:
        checks.append(("regional_validation", "Verifica que las especies o variedades funcionen en tu localidad.",
                       "Check that species or varieties work in your location."))
    if not request.farmer_validation:
        checks.append(("local_review", "Revisa el orden propuesto con un agricultor o especialista de tu zona.",
                       "Review the proposed order with a local farmer or specialist."))
    if request.market_intent == "sale" and not request.market_available_crops:
        checks.append(("market", "Confirma dónde podrás vender la cosecha.",
                       "Check where you could sell the harvest."))
    return {
        "planning_status": "needs_local_confirmation",
        "is_planting_instruction": False,
        "is_prediction": False,
        "sequence_origin": "symbolic_family_sequence_for_review" if suggested else "farmer_selected_order",
        "stages": stages,
        "missing_essentials": [{"id": code, "text": text, "text_en": en} for code, text, en in checks],
        "explanation": "Este orden sirve para conversar y planificar. No podemos establecer fechas de cosecha, rentabilidad ni la mejor rotación con estos datos.",
        "explanation_en": "This order is for discussion and planning. These data do not establish harvest dates, profitability or the best crop rotation.",
    }
