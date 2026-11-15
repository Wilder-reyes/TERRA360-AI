export type Position = {lat:number;lng:number}
export type RecordRow = {date:string;PRECTOTCORR:number|null;T2M:number|null;T2M_MAX:number|null;T2M_MIN:number|null;RH2M:number|null}
export type ApiResult = {source:string;data_status:string;records:RecordRow[];location:{name:string;latitude:number;longitude:number};period:{start:string;end:string};spatial_representation:string;quality?:import('./scientificEvidence').DailyQuality}
export type GpmResult = {source:string;date:string;product:string;precipitation_mm_day:number|null;grid_cell:{latitude:number;longitude:number};spatial_resolution:string;missing_value:boolean;unit:string}
export type Crop = {name:string;scientific_name:string;family:string;role:string;common_names?:string[];evidence_level?:string;ecocrop_thresholds?:Record<string,number|null>;ecocrop_code?:number;kc:Record<'initial'|'mid'|'end',number>|null;kc_note:string;cycle_days:{min:number;max:number;basis:string}|null;references:string[]}
export type Reference = {title:string;organization:string;url:string;scope:string;year?:number}
export type Catalog = {crops:Record<string,Crop>;references:Record<string,Reference>}
export type Check = {id:string;status:'pass'|'review'|'context';detail:string;detail_en?:string;references:string[]}
export type Scenario = {sequence?:string[];reason?:string;reason_en?:string;potential_benefit?:string;potential_benefit_en?:string;risks?:string[];risks_en?:string[];missing_data?:string[];missing_data_en?:string[];confidence?:string;confidence_en?:string;id:'S0'|'S1'|'S2';title:string;title_en?:string;description:string;description_en?:string;status:string;outcome:string;outcome_en?:string;facts:Record<string,unknown>|null;references:string[]}
export type NextStep={id:string;text:string;text_en?:string;why:string;why_en?:string}
export type AIDecision={method:string;status:string;chosen_for_review:string|null;candidate_count:number;headline:string;headline_en?:string;reason:string;reason_en?:string;warnings:{code:string;message:string;message_en?:string}[];missing_information:string[];missing_information_en?:string[];comparison:Record<string,unknown>}
export type PlanningStage={order:number;crop_id:string;name:string;scientific_name:string;first_sowing_month_declared:number|null;sowing_date:null;harvest_date:null;local_cycle_verified:boolean;literature_cycle_days:{min:number;max:number;basis:string}|null;evidence_status:string;status_text:string;status_text_en:string}
export type PlanningPreview={planning_status:string;is_planting_instruction:false;is_prediction:false;sequence_origin:string;stages:PlanningStage[];missing_essentials:{id:string;text:string;text_en:string}[];explanation:string;explanation_en:string}
export type Evaluation={plan_preview?:PlanningPreview;ai_decision?:AIDecision;method:string;checks:Check[];facts:{crop_count:number;unique_families:number;adjacent_same_family:number;families:string[]};baseline_facts:Record<string,unknown>|null;scenario_comparison:Scenario[];next_steps:NextStep[];limitations:string[];limitations_en?:string[];proposed_sequence:{id:string;name:string;family:string}[];references:string[];climate_context?:Record<string,unknown>|null;is_yield_prediction:boolean;is_irrigation_prescription:boolean}
export const cropIcons:Record<string,string>={maize:'🌽',tarwi:'🌿',faba:'🫘',potato:'🥔',barley:'🌾'}
export const cropInfo:Record<string,{es:string;en:string;roleEs:string;roleEn:string;insightEs:string;insightEn:string}>={
 maize:{es:'Maíz Blanco Gigante',en:'Giant White Maize',roleEs:'Cereal principal',roleEn:'Main cereal',insightEs:'Referencia varietal del INIA. El ciclo depende del manejo y el lugar.',insightEn:'INIA variety reference. The actual cycle depends on local management.'},
 tarwi:{es:'Tarwi',en:'Andean lupin',roleEs:'Leguminosa',roleEn:'Legume',insightEs:'Cultivo andino estudiado; no existe Kc específico validado en este catálogo.',insightEn:'Andean crop studied in research; no validated crop-specific Kc in this catalog.'},
 faba:{es:'Haba',en:'Faba bean',roleEs:'Leguminosa',roleEn:'Legume',insightEs:'Parámetros FAO genéricos para haba de grano seco; no verificados para el terreno elegido.',insightEn:'Generic FAO coefficients for dry-seed faba; not verified for the selected field.'},
 potato:{es:'Papa',en:'Potato',roleEs:'Tubérculo',roleEn:'Tuber',insightEs:'Los valores Kc genéricos no sustituyen un calendario fenológico local.',insightEn:'Generic Kc values do not replace a local crop-stage calendar.'},
 barley:{es:'Cebada',en:'Barley',roleEs:'Cereal',roleEn:'Cereal',insightEs:'Referencias FAO para cereal; la respuesta hídrica depende del contexto.',insightEn:'FAO cereal references; water response depends on local conditions.'},
}
export function format(n:number|null|undefined,d=1){return n==null||!Number.isFinite(n)?'—':n.toFixed(d)}
export function computeClimate(records:RecordRow[]){
 const rain=records.filter(r=>r.PRECTOTCORR!=null&&Number.isFinite(r.PRECTOTCORR))
 const t=records.filter(r=>r.T2M!=null&&Number.isFinite(r.T2M))
 const hum=records.filter(r=>r.RH2M!=null&&Number.isFinite(r.RH2M))
 const mins=records.filter(r=>r.T2M_MIN!=null&&Number.isFinite(r.T2M_MIN))
 const maxs=records.filter(r=>r.T2M_MAX!=null&&Number.isFinite(r.T2M_MAX))
 const rainTotal=rain.length?rain.reduce((a,r)=>a+r.PRECTOTCORR!,0):null
 return {rainTotal,temperature:t.length?t.reduce((a,r)=>a+r.T2M!,0)/t.length:null,
 humidity:hum.length?hum.reduce((a,r)=>a+r.RH2M!,0)/hum.length:null,
 validRain:rain.length,heavyRainDays:rain.filter(r=>r.PRECTOTCORR!>=10).length,
 rainyDays:rain.filter(r=>r.PRECTOTCORR!>0).length,
 maxRain:rain.length?Math.max(...rain.map(r=>r.PRECTOTCORR!)):null,
 frostDays:mins.length?mins.filter(r=>r.T2M_MIN!<=0).length:null, validMin:mins.length,
 hotDays:maxs.length?maxs.filter(r=>r.T2M_MAX!>=35).length:null, validMax:maxs.length,
 }
}
export function cleanNumeric(value:string,min:number,max:number):number|undefined {if(value.trim()==='')return undefined;const n=Number(value);return Number.isFinite(n)&&n>=min&&n<=max?n:undefined}
export function safeDateUTC(delta:number){const d=new Date();d.setUTCHours(12,0,0,0);d.setUTCDate(d.getUTCDate()-delta);return d.toISOString().slice(0,10)}
