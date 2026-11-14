"""ARIE AI: explainable constraint-based agricultural decision support.

This is a symbolic AI / combinatorial constraint search, NOT a trained crop-yield
model. Ranking of taxonomic transitions is only a *structural* proxy for rotation
screening; it is not a validated improvement in soil health, water use or income.

Provenance: Challand et al. Agricultural Systems 222 (2025), 104154,
https://doi.org/10.1016/j.agsy.2024.104154
"""
from __future__ import annotations

from itertools import permutations
from typing import Any

METHOD_VERSION = "arie_constraint_search_1.0"
METHOD_REFERENCE = "https://doi.org/10.1016/j.agsy.2024.104154"


def evaluate_candidates(request: Any, crops: dict[str, dict[str, Any]]) -> dict[str, Any]:
    """Enumerate all permutations (max 5!=120) and audit the trade-offs.

    Never assume a crop is climatically/financially viable on the basis of a
    generic Kc value, taxonomic family or remotely sensed regional grid.
    """
    initial = list(request.crops)
    exploratory = [c for c in initial if bool(crops[c].get('evidence_level'))]
    previous = request.baseline_crops[-1] if request.baseline_crops else None
    farmer_priority = request.priority
    target = {crop: i for i, crop in enumerate(initial)}

    def signature(sequence: tuple[str, ...]) -> dict[str, int]:
        full = ([previous] if previous else []) + list(sequence)
        families = [crops[c]["family"] for c in full]
        repeats = sum(a == b for a, b in zip(families, families[1:]))
        # Difference from the farmer's order is a *preference proxy*, not a cost.
        changes = sum(target[c] != i for i, c in enumerate(sequence))
        return {"adjacent_same_family": repeats, "position_changes": changes}

    ranked = sorted(
        ((signature(seq), seq) for seq in permutations(initial)),
        key=lambda item: (item[0]["adjacent_same_family"], item[0]["position_changes"],
                          tuple(target[c] for c in item[1])),
    )
    existing = signature(tuple(initial))
    chosen_facts, chosen = ranked[0]
    min_repeats = chosen_facts["adjacent_same_family"]
    frontier = [
        {"sequence": list(seq), "same_family_transitions": metrics["adjacent_same_family"],
         "changes_from_proposal": metrics["position_changes"]}
        for metrics, seq in ranked if metrics["adjacent_same_family"] == min_repeats
    ][:4]

    hard_constraints: list[dict[str, Any]] = []
    warnings: list[dict[str, Any]] = []
    if exploratory:
        warnings.append({'code':'exploratory_profiles', 'status':'needs_local_review',
                         'message':'Algunos cultivos tienen fichas exploratorias o umbrales generales FAO ECOCROP. No podemos verificar si son aptos para tu zona ni recomendar su rendimiento.'})
    missing: list[str] = []
    if exploratory:
        missing.append('Consultar requisitos climáticos y agrícolas verificados para los cultivos exploratorios.')

    seasonal = getattr(request, 'climate_seasonality', None)
    if seasonal and request.sowing_month is not None:
        current = seasonal.months[request.sowing_month - 1]
        valid = [v for v in seasonal.months if v is not None]
        if current is not None and len(valid) == 12 and seasonal.years_with_data >= 5:
            relative_to = 'por debajo' if current < sorted(valid)[5] else 'igual o por encima'
            warnings.append({'code':'sowing_month_rain', 'status':'regional_context',
                             'message':f'En el mes elegido, la lluvia histórica de la región estuvo {relative_to} de la mediana de los 12 meses; no indica disponibilidad de agua en la parcela ni predice la próxima campaña.'})
    if not request.baseline_crops:
        missing.append("Historial de cultivos para conocer la práctica real.")
    if request.water_access == "unknown":
        missing.append("Confirmar si existe riego y en qué meses hay agua.")
    elif request.water_access == "rainfed":
        warnings.append({"code": "rainfed", "status": "needs_local_review", "message": "Dependes de la lluvia: confirma con agricultores locales las fechas de siembra y los meses secos."})
    if not request.soil_test_available:
        missing.append("Análisis de suelo si deseas evaluar fertilidad y salinidad.")
    if getattr(request, "sowing_month", None) is None:
        missing.append("Mes previsto de siembra para comprobar el calendario de cada cultivo.")
    if not getattr(request, "farmer_validation", False):
        missing.append("Revisión de las opciones con un agricultor o especialista de la zona.")

    # This constraint only applies if the farmer *explicitly* enters a list of
    # crops they can sell and declares their production goal to be sale.
    market_list = getattr(request, "market_available_crops", None)
    market_intent = getattr(request, "market_intent", "unknown")
    if market_intent == "sale" and market_list is not None:
        unavailable = [c for c in initial if c not in market_list]
        hard_constraints.append({"id": "farmer_reported_market", "source": "farmer_reported",
                                 "satisfied": not unavailable, "affected_crops": unavailable,
                                 "note": "Acceso declarado por el agricultor; no son precios ni demanda de mercado verificados."})
        if unavailable:
            warnings.append({"code": "market", "status": "needs_change",
                             "message": "Algunos cultivos no tienen un mercado declarado. Revisa su destino o quítalos de la propuesta."})
    elif market_intent == "sale":
        missing.append("Confirmar dónde podrás vender los cultivos antes de comparar ingresos.")

    equipment = getattr(request, "equipment_access", "unknown")
    if equipment not in (None, "unknown"):
        warnings.append({"code": "equipment", "status": "not_evaluable",
                         "message": "Registramos los equipos disponibles; faltan requisitos locales de cada cultivo para verificar compatibilidad."})
    if getattr(request, "budget_limit", None) is not None:
        warnings.append({"code": "budget", "status": "not_evaluable",
                         "message": "Registramos el presupuesto, pero aún no hay costos locales verificables para comparar rentabilidad."})

    if getattr(request, "region_crop_validation", False) is False:
        missing.append("Confirmar que estas especies y variedades sirven en la localidad seleccionada.")

    # No inferred water ranking is permitted without independently confirmed
    # local crop-stage ETc + irrigation/soil supply.
    if exploratory:
        status = "exploratory_catalog_only"
        chosen_for_review = None
        headline = "Todavía no podemos comparar estos cultivos para tu terreno."
        reason = "Algunas especies solo tienen una ficha básica; antes debemos verificar sus necesidades y compatibilidad con tu zona."
    elif farmer_priority == "income":
        status = "income_comparison_not_evaluable"
        chosen_for_review = None
        headline = "No puedo afirmar qué cultivo dejará más ingresos sin precios y costos locales."
        reason = "El acceso al mercado declarado ayuda a detectar restricciones, pero no demuestra rentabilidad."
    elif farmer_priority == "water":
        status = "water_comparison_not_evaluable"
        chosen_for_review = None
        headline = "No puedo demostrar qué rotación necesita menos agua con la información disponible."
        reason = "El clima regional y los valores Kc de referencia no equivalen al riego necesario en tu terreno."
    elif any(not c["satisfied"] for c in hard_constraints):
        status = "farmer_constraint_conflict"
        chosen_for_review = None
        headline = "Tu propuesta necesita cambios antes de comparar opciones."
        reason = "Hay una limitación de mercado que tú declaraste y debemos respetar."
    elif existing["adjacent_same_family"] > min_repeats:
        status = "structural_option_for_review"
        chosen_for_review = "S1"
        headline = "Encontré otro orden que podrías revisar."
        reason = ("Separa más las familias de cultivos consecutivos. Eso puede ayudar a explorar una rotación distinta, "
                  "pero no demuestra menos plagas, mejor suelo ni mayor cosecha.")
    else:
        status = "no_evidence_to_rank_rotations"
        chosen_for_review = None
        headline = "No hay evidencia suficiente para elegir una rotación ganadora."
        reason = ("Con estos cultivos no encontré un orden con menos repeticiones de familia. "
                  "Para comparar agua, fertilidad o ingresos hacen falta más datos locales.")

    headline_en = {
        'exploratory_catalog_only': 'We cannot compare these crops for your field yet.',
        'water_comparison_not_evaluable': 'There is not enough evidence to identify a lower-water rotation.',
        'income_comparison_not_evaluable': 'We cannot identify a more profitable crop without local prices and costs.',
        'farmer_constraint_conflict': 'Some of the crops conflict with the market access you reported.',
        'structural_option_for_review': 'I found another crop order worth reviewing.',
        'no_evidence_to_rank_rotations': 'There is not enough evidence to name a best rotation.',
    }[status]
    reason_en = {
        'exploratory_catalog_only': 'Some profiles contain names and families only; local growing requirements need verification first.',
        'water_comparison_not_evaluable': 'Regional weather and generic crop coefficients do not quantify field irrigation needs.',
        'income_comparison_not_evaluable': 'Reported market access cannot establish profitability without local prices and costs.',
        'farmer_constraint_conflict': 'Your declared market restriction requires a change to the proposed crops.',
        'structural_option_for_review': 'This order separates botanical families more often, but it does not demonstrate better soil, fewer pests, or greater yield.',
        'no_evidence_to_rank_rotations': 'No arrangement with fewer adjacent family repetitions was found. Local water, soil and economic data are still needed.',
    }[status]
    missing_en = {
        'Historial de cultivos para conocer la práctica real.': 'Your actual cropping history.',
        'Consultar requisitos climáticos y agrícolas verificados para los cultivos exploratorios.': 'Verify local agroclimatic requirements for these exploratory crops.',
        'Confirmar si existe riego y en qué meses hay agua.': 'Whether irrigation is available and in which months.',
        'Análisis de suelo si deseas evaluar fertilidad y salinidad.': 'A soil analysis to assess fertility or salinity.',
        'Mes previsto de siembra para comprobar el calendario de cada cultivo.': 'Expected sowing month to check crop calendars.',
        'Revisión de las opciones con un agricultor o especialista de la zona.': 'Review with a local farmer or agronomist.',
        'Confirmar dónde podrás vender los cultivos antes de comparar ingresos.': 'Your available crop markets before comparing income.',
        'Confirmar que estas especies y variedades sirven en la localidad seleccionada.': 'Whether these crop species and varieties are locally suitable.',
    }
    warning_en = {
        'rainfed': 'Rainfed conditions reported: confirm local planting windows and dry months.',
        'exploratory_profiles': 'Some crops only have introductory taxonomy or FAO EcoCrop expert estimates. Local suitability and productivity are not evaluated.',
        'market': 'Some proposed crops have no declared market: verify sale options or change the sequence.',
        'equipment': 'Equipment is recorded but crop-specific requirements are unverified.',
        'budget': 'Budget is recorded but no verified local cost data are available.',
        'sowing_month_rain': 'The selected month has a historical regional rainfall pattern; this does not forecast the next season.',
    }
    for item in warnings:
        item['message_en'] = warning_en.get(item['code'], item['message'])
    return {
        "headline_en": headline_en,
        "reason_en": reason_en,
        "missing_information_en": [missing_en.get(t,t) for t in missing],
        "method": METHOD_VERSION,
        "method_type": "symbolic_constraint_search_not_trained_predictive_model",
        "method_reference": METHOD_REFERENCE,
        "candidate_count": len(ranked),
        "farmer_priority": farmer_priority,
        "status": status,
        "chosen_for_review": chosen_for_review,
        "headline": headline,
        "reason": reason,
        "sequence_for_review": list(chosen) if chosen_for_review == "S1" else None,
        "proposed_sequence": initial,
        "observed_history": list(request.baseline_crops),
        "comparison": {
            "farmer_proposal_same_family_transitions": existing["adjacent_same_family"],
            "candidate_same_family_transitions": min_repeats,
            "frontier_sample": frontier,
            "meaning": "Comparación taxonómica estructural; no es una predicción de rendimiento o salud del suelo.",
        },
        "hard_constraints": hard_constraints,
        "warnings": warnings,
        "missing_information": missing,
        "confidence": "limited_not_field_validated",
        "evidence": ["inia", "fao56", "visscher", "meza"],
        "no_field_yield_prediction": True,
        "no_water_savings_claim": True,
        "requires_local_validation": True,
        "audit": {"algorithm": "enumerate_permutations_lexicographic_minima",
                  "crop_ids": initial,
                  "boundary_crop_id": previous,
                  "unique_candidate_limit": 120,
                  "assumptions": ["family proximity is descriptive only", "no inferred plantable date or crop water volume",
                                  "user input is unverified until locally confirmed"]},
    }
