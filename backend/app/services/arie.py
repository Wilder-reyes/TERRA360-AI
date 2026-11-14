"""ARIE: auditable qualitative constraint screening, NOT agronomic forecasting.



The outputs are deliberately bounded to descriptive facts and evidence gaps.

No yield, irrigation requirement, soil-health improvement or optimality score

is inferred from regional NASA grids or generic FAO crop coefficients.

"""

from app.schemas.scenarios import ScenarioRequest
from app.data.crop_directory import exploratory_crops
from app.services.planning_preview import plan_preview




REFERENCES = {

 'inia': {'title':'Manual técnico: maíz Blanco Urubamba (Blanco Gigante Cusco)', 'organization':'INIA', 'year':2013, 'url':'https://repositorio.inia.gob.pe/handle/20.500.12955/87', 'scope':'Variety-specific management guidance; not parcel measurements'},

 'fao56': {'title':'Crop evapotranspiration: Guidelines for computing crop water requirements (FAO-56)', 'organization':'FAO', 'year':1998, 'url':'https://www.fao.org/4/X0490E/X0490E00.htm', 'scope':'Generic crop coefficients; require local ETo and stage calibration'},

 'visscher': {'title':'Traditional soil fertility management ameliorates climate change impacts on traditional Andean crops within smallholder farming systems', 'organization':'Science of the Total Environment', 'year':2024, 'url':'https://doi.org/10.1016/j.scitotenv.2023.168725', 'scope':'Andean experimental evidence, not Calca-specific yield estimates'},

 'meza': {'title':'Perennial forage-based fallows support long-term soil carbon and nutrient trajectories in smallholder rotations of the Peruvian Andes', 'organization':'Agriculture, Ecosystems & Environment', 'year':2025, 'url':'https://doi.org/10.1016/j.agee.2025.109884', 'scope':'Rotation and fallow context; no locally optimal sequence established'},

}

CROPS = {

 'maize': {'name':'Maíz Blanco Gigante del Cusco', 'scientific_name':'Zea mays L.', 'role':'cultivo principal', 'family':'Poaceae', 'kc':{'initial':0.30,'mid':1.20,'end':0.35}, 'kc_note':'FAO-56 generic grain maize; end 0.35 assumes field drying; NOT locally calibrated', 'cycle_days':{'min':240,'max':270,'basis':'INIA Blanco Urubamba reference, not a planting date'}, 'references':['inia','fao56']},

 'tarwi': {'name':'Tarwi', 'scientific_name':'Lupinus mutabilis Sweet', 'role':'leguminosa candidata', 'family':'Fabaceae', 'kc':None, 'kc_note':'No validated tarwi-specific Kc in current evidence catalogue; do not substitute generic legume Kc as measured', 'cycle_days':None, 'references':['visscher']},

 'faba': {'name':'Haba', 'scientific_name':'Vicia faba L.', 'role':'leguminosa candidata', 'family':'Fabaceae', 'kc':{'initial':0.50,'mid':1.15,'end':0.30}, 'kc_note':'FAO-56 dry-seed faba bean; fresh harvest differs', 'cycle_days':None, 'references':['fao56','meza']},

 'potato': {'name':'Papa', 'scientific_name':'Solanum tuberosum L.', 'role':'tubérculo candidato', 'family':'Solanaceae', 'kc':{'initial':0.50,'mid':1.15,'end':0.75}, 'kc_note':'FAO-56 generic potato; vine kill and management change end Kc', 'cycle_days':None, 'references':['fao56','meza']},

 'barley': {'name':'Cebada', 'scientific_name':'Hordeum vulgare L.', 'role':'cereal candidato', 'family':'Poaceae', 'kc':{'initial':0.30,'mid':1.15,'end':0.25}, 'kc_note':'FAO-56 generic barley', 'cycle_days':None, 'references':['fao56','meza']},

}





# Exploratory profiles contain names and family only; no FAO suitability or Kc inferred.
CROPS.update(exploratory_crops())
REFERENCES['directory'] = {
 'title':'Directorio inicial de nombres de cultivos; pendiente de vinculación individual con ECOCROP/GAEZ',
 'organization':'TERRA360 - datos taxonómicos preliminares',
 'url':'https://www.fao.org/land-water/resources/tools/databases/ecocrop/en',
 'scope':'ECOCROP/GAEZ are candidate sources only. None of these additional profiles includes imported FAO climate or soil requirements.'
}

SCENARIOS = [

 {'id':'S0','title':'Práctica actual','description':'Historial declarado del productor; sin historial se considera referencia ausente.'},

 {'id':'S1','title':'Diversidad en la propuesta','description':'Recuento descriptivo de familias de los cultivos propuestos, sin predicción.'},

 {'id':'S2','title':'Revisión de agua y suelo','description':'Revisión cualitativa de restricciones hídricas y edáficas, sin prescripción.'},

]





def family_facts(crop_ids: list[str]) -> dict:

    """Descriptive counts only, not an agronomic index of performance."""

    families = [CROPS[c]['family'] for c in crop_ids]

    return {

        'crop_count': len(crop_ids),

        'unique_families': len(set(families)),

        'adjacent_same_family': sum(a == b for a, b in zip(families, families[1:])),

        'families': families,

    }





def check(id_: str, status: str, detail: str, detail_en: str, refs: list[str] | None = None) -> dict:

    return {'id': id_, 'status': status, 'detail': detail, 'detail_en': detail_en, 'references': refs or []}





def enrich_scenarios(scenarios: list[dict], request: ScenarioRequest) -> None:

    """Taxonomic exploration and a conditional water policy, never water optimization.



    Stable tie-breaking keeps the user's ordering where equally diverse.

    Last historical family is included in S1's boundary transition count.

    """

    def transitions(sequence):

        full = request.baseline_crops[-1:] + list(sequence)

        return family_facts(full)['adjacent_same_family']

    proposed = list(request.crops)

    # The displayed S1 must match the decision engine's actual selected order.
    from app.services.decision_ai import evaluate_candidates
    result = evaluate_candidates(request, CROPS)
    soil = result['comparison']['frontier_sample'][0]['sequence']

    previous_transition_count = transitions(proposed)
    explored_transition_count = transitions(soil)
    sequences = [list(request.baseline_crops), soil, proposed]

    reasons = [

        ('Conservar el historial declarado como referencia real.', 'Preserve the reported history as the actual baseline.'),

        ('Explorar un orden con menos transiciones de la misma familia, incluida la última del historial. No es una rotación óptima.', 'Explore an order with fewer same-family transitions, including the last historic crop. This is not an optimal rotation.'),

        ('Mantener la propuesta condicionada a comprobar agua disponible y demanda por etapa antes de sembrar.', 'Keep the proposal conditional on checking available water and stage-specific demand before planting.'),

    ]

    benefits = [

        ('Permite comparar cambios con la experiencia del productor; no demuestra productividad.', 'Enables comparison with farmer experience; does not demonstrate productivity.'),

        ('La separación taxonómica permite discutir diversidad y manejo sanitario; el beneficio local no está medido.', 'Taxonomic separation supports discussion of diversity and crop health; local benefit is unmeasured.'),

        ('La comprobación previa puede evitar decidir con información hídrica incompleta; no implica ahorro demostrado.', 'Prior verification may avoid decisions based on incomplete water evidence; does not imply demonstrated savings.'),

    ]

    for i, scenario in enumerate(scenarios):

        sequence = sequences[i]

        scenario['sequence'] = sequence

        scenario['reason'], scenario['reason_en'] = reasons[i]

        scenario['potential_benefit'], scenario['potential_benefit_en'] = benefits[i]

        scenario['formation_rule'] = ['reported_history', 'minimize_same_family_transitions_not_agronomic_optimization', 'user_sequence_subject_to_water_validation'][i]

        scenario['confidence'] = 'Datos declarados; validación local pendiente. Eficacia agronómica no evaluable.'

        scenario['confidence_en'] = 'Self-reported data; local validation pending. Agronomic efficacy not evaluable.'

        scenario['risks'] = ['Sin calendario local no se verifica la duración ni la compatibilidad estacional.']

        scenario['risks_en'] = ['Without a local calendar, duration and seasonal compatibility cannot be verified.']

        scenario['missing_data'] = ['Fechas de cada ciclo, variedades y observaciones locales.']

        scenario['missing_data_en'] = ['Dates for each cycle, varieties and local observations.']

        if not sequence:

            scenario['missing_data'].append('Historial real del productor.')

            scenario['missing_data_en'].append('Actual farmer history.')

        if i == 1 and explored_transition_count == previous_transition_count:
            scenario['reason'] = 'La secuencia ya minimiza las transiciones contiguas entre familias para estos cultivos. S1 no propone un orden distinto ni demuestra mejoras del suelo.'
            scenario['reason_en'] = 'The proposed sequence already minimizes adjacent same-family transitions for this crop set. S1 does not propose a distinct order or demonstrate soil improvements.'
            scenario['order_changed'] = False
        elif i == 1:
            scenario['order_changed'] = True

        if i == 1:

            scenario['title'], scenario['title_en'] = 'Diversificación del suelo', 'Soil diversification'

            scenario['facts'] = family_facts(sequence)

            scenario['description'] = 'Orden exploratorio de los cultivos elegidos; no agrega cultivos no solicitados.'

            scenario['description_en'] = 'Exploratory order of selected crops; no unrequested crops are added.'

            scenario['risks'].append('Familias diferentes no garantizan ausencia de plagas compartidas ni mejora del suelo.')

            scenario['risks_en'].append('Different families do not guarantee absence of shared pests or soil improvement.')

            scenario['missing_data'].append('Análisis de suelo con fecha y método; historial sanitario.')

            scenario['missing_data_en'].append('Dated soil analysis and method; crop health history.')

        if i == 2:

            scenario['title'], scenario['title_en'] = 'Adaptación al agua', 'Water adaptation'

            scenario['risks'].append('La lluvia regional no mide reservas de agua ni suministro de riego.')

            scenario['risks_en'].append('Regional rainfall does not measure water reserves or irrigation supply.')

            scenario['missing_data'].extend(['Agua disponible por temporada, ETo, calendario y Kc locales.', 'Capacidad de retención del suelo y profundidad de raíces.'])

            scenario['missing_data_en'].extend(['Seasonal water availability, ETo, calendar and local Kc.', 'Soil water retention and rooting depth.'])

            scenario['water_demand_status'] = 'not_evaluable'

        scenario['duration_status'] = 'not_evaluable'

        scenario['provenance'] = {'sequence': 'farmer_input' if i != 1 else 'system_taxonomic_rule', 'climate': 'client_supplied_NASA_summary_not_independently_verified' if request.climate_context else 'unavailable', 'evidence': scenario['references'], 'validation': 'local_review_required'}





def evaluate(request: ScenarioRequest) -> dict:

    ids = request.crops

    facts = family_facts(ids)

    baseline = family_facts(request.baseline_crops) if request.baseline_crops else None

    checks = []

    if len(ids) == 1:

        checks.append(check('crop_diversity','review','Una sola selección no constituye una rotación agrícola evaluable; agrega al menos otro cultivo.', 'A single crop does not form an evaluable rotation; add at least one more crop.'))

    elif facts['unique_families'] == 1:

        checks.append(check('crop_diversity','review','La secuencia utiliza una sola familia botánica; conviene examinar una mayor diversidad, sin asumir beneficios medidos.', 'All crops belong to one botanical family. Review possible diversity without assuming measured benefits.', ['visscher','meza']))

    else:

        checks.append(check('crop_diversity','pass',f"La secuencia propuesta incluye {facts['unique_families']} familias botánicas distintas.", f"The proposed sequence includes {facts['unique_families']} distinct botanical families.", ['visscher','meza']))

    if facts['adjacent_same_family'] and len(ids) > 1:

        checks.append(check('adjacency','review',f"Hay {facts['adjacent_same_family']} transición(es) entre cultivos de la misma familia; revisar el historial de manejo y posibles presiones sanitarias locales.", f"There are {facts['adjacent_same_family']} adjacent same-family transitions; review management history and local crop-health conditions.", ['meza']))

    checks.append(check('water', 'review' if request.water_access == 'unknown' else 'context',

        'Acceso al agua sin verificar; no es posible estimar restricciones hídricas de la parcela.' if request.water_access == 'unknown' else 'Tipo de acceso al agua declarado por el usuario; faltan volúmenes disponibles y estacionalidad.',

        'Water access is unverified; plot-level water constraints cannot be estimated.' if request.water_access == 'unknown' else 'Water access is self-reported; available volumes and seasonality are unknown.', ['fao56']))

    has_soil_values = any(v is not None for v in [request.soil_ph, request.soil_organic_matter_pct]) or (request.soil_texture not in (None, 'unknown'))

    checks.append(check('soil', 'context' if request.soil_test_available or has_soil_values else 'review',

        'Se aportaron datos de suelo declarados por el usuario; sin protocolo, fecha y laboratorio no se validan ni interpretan agronómicamente.' if has_soil_values else ('Se declaró contar con análisis de suelo; incorpora resultados y fecha para evaluar restricciones.' if request.soil_test_available else 'Sin análisis actual de parcela: textura, fertilidad y salinidad no verificables.'),

        'User-reported soil details were provided; without a dated lab method they are not verified or interpreted agronomically.' if has_soil_values else ('A soil test is reported; enter results and date to assess constraints.' if request.soil_test_available else 'No current parcel soil test: texture, fertility and salinity remain unverified.'), ['meza']))

    checks.append(check('local_validation','context' if request.farmer_validation else 'review',

        'Revisión con productor declarada; documentar fecha y observaciones.' if request.farmer_validation else 'La secuencia aún requiere revisión con un productor y calendario agrícola local.',

        'Farmer review is self-reported; record date and observations.' if request.farmer_validation else 'The sequence still needs farmer review and a locally verified cropping calendar.', ['inia']))

    if request.climate_context:

        cc = request.climate_context

        checks.append(check('climate_context','context',

            f"Contexto recibido de {cc.source}: {cc.valid_rain_days} días con lluvia válida entre {cc.start} y {cc.end}. No equivale a agua disponible en suelo ni a un pronóstico.",

            f"Received {cc.source} context: {cc.valid_rain_days} valid rainfall days from {cc.start} to {cc.end}. This is not soil water availability or a forecast."))

    else:

        checks.append(check('climate_context','review',

            'No se adjuntó un periodo ambiental NASA; la evaluación solo usa datos declarados del productor.',

            'No NASA observation window was attached; this screening uses only farmer-supplied inputs.'))

    if baseline:

        checks.append(check('baseline','context',

            f"Historial reportado: {baseline['crop_count']} cultivo(s) y {baseline['unique_families']} familia(s). Es una referencia declarada, no una medición independiente.",

            f"Reported baseline: {baseline['crop_count']} crop(s), {baseline['unique_families']} family/families. This is user-reported, not independently observed."))

    else:

        checks.append(check('baseline','review','No se registró la rotación histórica; S0 permanece como referencia sin verificar.', 'No observed rotation was provided; S0 remains an unverified baseline.'))

    priority_labels = {

        'balanced':('equilibrio de restricciones','balancing constraints'),

        'water':('disponibilidad de agua','water availability'),

        'soil':('salud del suelo','soil health'),

        'diversity':('diversificación de cultivos','crop diversification'),
        'income':('disponibilidad de mercado e ingresos','market access and income'),

    }

    checks.append(check('priority','context', f"Prioridad seleccionada: {priority_labels[request.priority][0]}; no sustituye mediciones o evidencia local.", f"Selected priority: {priority_labels[request.priority][1]}; this does not replace field evidence."))

    scenarios = [

        {'id':'S0','title':'Práctica actual','title_en':'Current practice',

         'description':f"Historial declarado: {', '.join(CROPS[c]['name'] for c in request.baseline_crops)}." if baseline else 'Registra la secuencia que actualmente utiliza el productor para contar con un punto de comparación real.',

         'description_en':'Self-reported observed sequence, not independently verified.' if baseline else 'Enter the farmer’s actual historic crop sequence to build a meaningful baseline.',

         'status':'user_reported' if baseline else 'requires_farmer_baseline',

         'facts':baseline,'references':['meza'],

         'outcome':'Se describen cultivos y familias, no producción ni eficiencia de agua.',

         'outcome_en':'Crop and family counts only; no yield or water efficiency claim.'},

        {'id':'S1','title':'Diversidad en la propuesta','title_en':'Proposed crop diversity',

         'description':f"Propuesta del usuario: {facts['crop_count']} cultivos de {facts['unique_families']} familias; {facts['adjacent_same_family']} transiciones contiguas de la misma familia.",

         'description_en':f"User-defined proposal: {facts['crop_count']} crops across {facts['unique_families']} families; {facts['adjacent_same_family']} adjacent same-family transitions.",

         'status':'exploratory','facts':facts,'references':['visscher','meza'],

         'outcome':'Estas cifras describen diversidad taxonómica, no rendimiento, suelo mejorado ni rotación óptima.',

         'outcome_en':'These counts describe taxonomy, not yield, improved soils or an optimal rotation.'},

        {'id':'S2','title':'Revisión de agua y suelo','title_en':'Water and soil screening',

         'description':'Exploración condicionada a acceso hídrico, etapa de crecimiento, ETo, textura y análisis local. La precipitación regional no cuantifica agua disponible en parcela.',

         'description_en':'Exploration contingent on water access, growth stage, ETo, texture and local soil tests. Regional rainfall is not plot-level available water.',

         'status':'exploratory','facts':{'water_access':request.water_access,'soil_test_available':request.soil_test_available},'references':['fao56','inia'],

         'outcome':'No se calcula ETc, necesidades de riego ni ahorros de agua sin parámetros comprobados.',

         'outcome_en':'No ETc, irrigation prescription or water savings without validated inputs.'},

    ]

    enrich_scenarios(scenarios, request)

    next_steps = []

    if not baseline:

        next_steps.append({'id':'baseline','text':'Registrar al menos dos ciclos de cultivos previos, con sus fechas.','text_en':'Record at least two previous cropping cycles and their dates.','why':'S0 necesita historial observado.','why_en':'S0 requires an observed baseline.'})

    if not request.soil_test_available or not has_soil_values:

        next_steps.append({'id':'soil','text':'Documentar análisis de suelo con fecha, método y ubicación.','text_en':'Document a dated soil test, method and sampling location.','why':'No se infiere fertilidad a partir de NASA POWER.','why_en':'Soil fertility cannot be inferred from NASA POWER.'})

    if request.water_access == 'unknown':

        next_steps.append({'id':'water','text':'Confirmar si existe riego y el calendario de agua disponible.','text_en':'Confirm irrigation access and seasonal water availability.','why':'El tipo de acceso al agua aún no está verificado.','why_en':'Water access is unverified.'})

    if not request.farmer_validation:

        next_steps.append({'id':'farmer','text':'Revisar calendario y propuesta con un productor de la zona.','text_en':'Review crop sequence and seasonal calendar with a local farmer.','why':'La evidencia regional no reemplaza el conocimiento local.','why_en':'Regional evidence does not replace local knowledge.'})

    limitations = [

        'El punto NASA representa un contexto ambiental en cuadrícula, no mediciones de la parcela.',

        'No se ha calculado ETo FAO Penman-Monteith ni ETc; faltan variables y validación local.',

        'La presencia de leguminosas no demuestra una cantidad de nitrógeno fijado.',

        'No existe evidencia para declarar una rotación óptima, ahorros de agua o mejoras de rendimiento para la ubicación seleccionada.',

    ]

    limitations_en = [

        'The NASA grid point represents regional environmental context, not plot measurements.',

        'FAO Penman–Monteith ETo and ETc were not computed; locally validated inputs are lacking.',

        'Legume presence alone does not establish an amount of fixed nitrogen.',

        'Evidence is insufficient to claim optimal rotations, water savings or yield gains at the selected location.',

    ]

    from app.services.decision_ai import evaluate_candidates
    ai_decision = evaluate_candidates(request, CROPS)

    return {
      'ai_decision': ai_decision,
      'plan_preview': plan_preview(request, CROPS, ai_decision),
      'method':'qualitative_constraint_screening_v3_plus_symbolic_AI',

      'is_yield_prediction':False, 'is_irrigation_prescription':False,

      'input':request.model_dump(),

      'proposed_sequence':[{'id':c, 'name':CROPS[c]['name'], 'family':CROPS[c]['family']} for c in ids],

      'checks':checks, 'facts':facts,'baseline_facts':baseline,

      'climate_context':request.climate_context.model_dump(mode='json') if request.climate_context else None,

      'scenario_comparison':scenarios, 'next_steps':next_steps,

      'limitations':limitations, 'limitations_en':limitations_en,

      'references':list(REFERENCES.keys()),

    }

