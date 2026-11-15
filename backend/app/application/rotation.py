"""Compose comparison, scoped AI inference and evidence without HTTP or network I/O."""
from typing import Any
from app.services import rotation_engine as engine,field_shift_ai as field_ai
from app.services.imerg_basin import basin_context

def compare_rotation(req:Any,clim:dict,parcel:dict|None)->dict:
    if not req.current:
        return {"status": "needs_current_rotation",
                "message_es": "Primero confirma qué sembraste en cada campaña. Sin tu rotación actual no comparamos (no inventamos datos).",
                "message_en": "First confirm what you planted in each campaign. Without your current rotation we do not compare (we do not invent data).",
                "strategies": []}
    result = engine.compare([p.model_dump() for p in req.current], clim,
                                priorities=req.priorities.model_dump(), water_turn=req.water_turn,
                                history=req.history, current_origin=req.current_source,
                                income_crop_id=req.income_crop_id,
                                fallback=engine.TEMPLATES if req.use_team_templates_as_fallback else None)
    result["zone"] = req.zone
    # The actual NASA-HLS model is only applicable to the exact polygon
    # from which its real Earth observations were collected.
    model_analysis = field_ai.assess_strategies(parcel, result["strategies"])
    result["ai_analysis"] = model_analysis
    if model_analysis["status"] == "trained_and_verified":
        earlier = result.get("recommended_strategy_id")
        scored = engine.highlight_for_farmer(
            result["strategies"], {**req.priorities.model_dump()}, req.water_turn,
            ai_bare_risk=model_analysis["weighted_uncovered_exposure"])
        result.update(scored)
        result["ai_analysis"]["used_for_decision"] = bool(scored.get("ai_weighted"))
        result["ai_analysis"]["influenced_recommendation"] = (
            earlier != result.get("recommended_strategy_id"))
    else:
        result["ai_analysis"]["influenced_recommendation"] = False
    # P1 «agua que viene»: IMERG rain in the upper basin (context only; abstains if not computed).
    if req.zone in ("huaral", "barranca"):
        basin = basin_context(req.zone)
    else:
        basin = {
            "status": "unavailable",
            "message_es": "No contamos con datos de lluvia de la cuenca para este lugar.",
            "message_en": "Upper-basin rainfall has not been calculated for this location.",
            "climatology_mm_month": {},
        }
    result["farm_inputs"] = {
        "soil": req.soil.model_dump(exclude_none=True) if req.soil else None,
        "irrigation_allowance_m3_ha_season": req.irrigation_allowance_m3_ha_season,
        "irrigation_source": req.irrigation_source,
        "status": "provided_by_user_not_used_to_rank",
        "note_es": "Datos anotados para revisar. Falta validar reglas locales antes de usarlos para recomendar o descartar cultivos.",
        "note_en": "Recorded for review. Local validation is required before these values can rank or exclude crops.",
    }
    # Never label public portals as live station measurements or prices.
    from app.services.agro_evidence import (crop_economic_comparison,
                                            soil_checks, public_evidence_summary)
    used_ids = sorted({p["crop_id"] for strategy in result["strategies"]
                       for p in strategy["plantings"]})
    budget_input = [p.model_dump() for p in req.crop_budgets]
    result["economic_comparison"] = crop_economic_comparison(result["strategies"], budget_input)
    result["soil_assessment"] = soil_checks(
        req.soil.model_dump(exclude_none=True) if req.soil else None, used_ids)
    result["official_evidence"] = public_evidence_summary()
    # Only an expert-reviewed agronomic rule can exclude a crop option.
    # Absence of curated ranges must never become a positive soil suitability claim.
    if result["soil_assessment"]["status"] == "screened_with_expert_reviewed_reference":
        blocked = {item["crop_id"] for item in result["soil_assessment"].get("alerts", [])}
        valid = [strategy for strategy in result["strategies"]
                 if strategy["id"] == "S0" or
                 not any(p["crop_id"] in blocked for p in strategy["plantings"])]
        if result.get("recommended_strategy_id") and not any(
                x["id"] == result["recommended_strategy_id"] for x in valid):
            chosen = engine.highlight_for_farmer(
                valid, {**req.priorities.model_dump()}, req.water_turn,
                ai_bare_risk=(model_analysis.get("weighted_uncovered_exposure")
                              if model_analysis["status"] == "trained_and_verified" else None))
            result.update(chosen)
            result["soil_reranked"] = True
    result["upper_basin_rain"] = basin
    if basin["status"] == "available":
        for month in result["window"]["context"]:
            month["basin_rain_mm"] = basin["climatology_mm_month"].get(str(month["calendar_month"]),
                                                                       basin["climatology_mm_month"].get(month["calendar_month"]))
    return result
