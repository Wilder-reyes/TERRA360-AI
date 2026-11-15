/** Clear, print-safe spatial planting recommendations; do not mistake colors for satellite evidence. */
import type {ReactNode} from 'react'
import type {GeoPolygon} from './rotationZones'
import {printableGeometry} from './campaignPlan'

export type ChakraZoneAdvice={
 zone_id:string;area_ha:number;current_crop_id:string;current_crop:string;current_crop_en?:string;
 suggested_crop_id:string;suggested_crop:string;suggested_crop_en?:string;sow_month:string;sow_label_es:string;sow_label_en?:string;
 estimated_cycle_days:number;why_es:string;why_en?:string;how_es:string[];how_en?:string[];
 reference_water_mm:number|null;sowing_window_scope:string;source_tags:string[]
}
export type ChakraSpatialPlan={
 status:string;parcel_area_ha:number;zone_plans:ChakraZoneAdvice[];
 scope:'barranca_reference'|'exploratory_reference';
 climate_status:string;ai_status:string;disclaimer_es:string;disclaimer_en?:string;sources:string[]
}
export type ChakraParcel={id:string;polygon:GeoPolygon}
const SHADES=['#A3D99D','#E9B56D','#8CB9E1','#D0A4E8','#B9D76F','#E4A0A0','#94C4B6']
const label=(id:string,es:boolean)=>id==='rest'?(es?'Resto del terreno':'Remaining area'):id
const shade=(index:number)=>SHADES[index%SHADES.length]
const localizedCrop=(name:string,nameEn:string|undefined,es:boolean)=>!es&&nameEn?nameEn:name
const localizedDate=(row:ChakraZoneAdvice,es:boolean)=>!es&&row.sow_label_en?row.sow_label_en:row.sow_label_es

export function ChakraZoneSketch({field,subplots,plan,lang}:{field:GeoPolygon;subplots:ChakraParcel[];plan:ChakraSpatialPlan;lang:'es'|'en'}){
 const es=lang==='es',geometry=printableGeometry(field,subplots)
 const original=plan.zone_plans.find(row=>row.zone_id==='rest')
 return <figure className="chakra-plan-sketch" aria-label={es?'Mapa del terreno por zonas':'Field zone map'}>
  <svg viewBox="0 0 600 340" role="img" aria-label={es?'Croquis del terreno con zonas de cultivo':'Field sketch with crop zones'}>
   <title>{es?'Distribución de las zonas delimitadas':'Outlined field zones'}</title>
   <rect width="600" height="340" rx="20" fill="#F1F5EE"/>
   <polygon points={geometry.field} fill={original?shade(plan.zone_plans.indexOf(original)):'#D9E7D6'} fillOpacity=".8" stroke="#244A35" strokeWidth="3.5" strokeLinejoin="round"/>
   {subplots.map((sub,i)=>{
    const row=plan.zone_plans.find(p=>p.zone_id===sub.id)
    const index=row?plan.zone_plans.indexOf(row):i
    return <polygon key={sub.id} points={geometry.subplots[i]} fill={shade(index)} fillOpacity=".94" stroke="#244A35" strokeWidth="2.5" strokeLinejoin="round">
      <title>{sub.id}: {row?localizedCrop(row.suggested_crop,row.suggested_crop_en,es):es?'Área delimitada':'Outlined area'}</title>
    </polygon>
   })}
   <text x="554" y="30" fontSize="18" fill="#244A35">N ↑</text>
  </svg>
  <figcaption>{es?'Esquema de las zonas dibujadas, áreas aproximadas':'Sketch of drawn zones, approximate areas'}</figcaption>
  <div className="chakra-sketch-legend">{plan.zone_plans.map((row,i)=><span key={row.zone_id}><i style={{background:shade(i)}}/>{label(row.zone_id,es)} · {row.area_ha.toLocaleString(es?'es-PE':'en-US',{maximumFractionDigits:2})} ha · {localizedCrop(row.suggested_crop,row.suggested_crop_en,es)}</span>)}</div>
 </figure>
}
export default function ChakraZonePlan({plan,field,subplots,lang,onPrint,onEdit}:{
 plan:ChakraSpatialPlan;field:GeoPolygon;subplots:ChakraParcel[];lang:'es'|'en';
 onPrint:()=>void;onEdit:()=>void
}){
 const es=lang==='es',referenceOnly=plan.scope==='exploratory_reference'
 return <section className="chakra-zone-result" aria-label={es?'Plan agrícola por zonas':'Zone planting plan'}>
  <div className="chakra-result-heading"><span className="b-eyebrow">{es?'PASO 3 DE 3 · TU PLAN':'STEP 3 OF 3 · YOUR PLAN'}</span>
   <h1>{es?'Tu próxima siembra, zona por zona.':'Your next planting, zone by zone.'}</h1>
   <p>{es?'Conoce dónde, cuándo y cómo preparar cada cultivo.':'See where, when and how to plan each crop.'}</p>
  </div>
  <div className="chakra-plan-highlight">
   <span>{es?'TERRENO DELIMITADO':'SELECTED FIELD'}</span>
   <strong>{plan.parcel_area_ha.toLocaleString(es?'es-PE':'en-US',{maximumFractionDigits:2})} ha</strong>
   <span>{plan.zone_plans.length} {es?'zonas con cultivos registrados':'zones with crop history'}</span>
  </div>
  <ChakraZoneSketch field={field} subplots={subplots} plan={plan} lang={lang}/>
  <div className="chakra-result-advice">{plan.zone_plans.map((row,i)=><article className="chakra-advice-card" key={row.zone_id}>
   <header><span className="chakra-advice-zone"><i style={{background:shade(i)}}/>{label(row.zone_id,es)} · {row.area_ha.toLocaleString(es?'es-PE':'en-US',{maximumFractionDigits:2})} ha</span><span className="chakra-advice-current">{es?'Antes':'Current'}: {localizedCrop(row.current_crop,row.current_crop_en,es)}</span></header>
   <h2>{localizedCrop(row.suggested_crop,row.suggested_crop_en,es)}</h2>
   <div className="chakra-advice-when"><span>{es?'CUÁNDO SEMBRAR':'WHEN TO PLANT'}</span><strong>{localizedDate(row,es)}</strong></div>
   <p>{!es&&row.why_en?row.why_en:row.why_es}</p>
   <details><summary>{es?'Cómo prepararlo, paso a paso':'How to prepare the planting'}</summary><ol>{(!es&&row.how_en?row.how_en:row.how_es).map((line,j)=><li key={j}>{line}</li>)}</ol></details>
  </article>)}</div>
  <div className="chakra-plan-scope"><strong>{referenceOnly?(es?'Orientación para revisar en tu localidad':'General planning reference'):(es?'Calendario referencial para Barranca':'Barranca reference calendar')}</strong>
   <p>{es?plan.disclaimer_es:plan.disclaimer_en||'This planning comparison uses your crop history and reference methods. Check local water, soil, season and variety before planting.'}</p>
   <details><summary>{es?'Cómo se preparó este plan':'How this plan was prepared'}</summary>
    <p>{plan.ai_status==='trained_hls_on_exact_study_parcel'?(es?'La señal histórica NASA HLS se utilizó únicamente en su parcela de estudio; el cultivo se elige con reglas agronómicas.':'HLS historical signal is limited to the original study parcel; crops use reference rotation rules.'):(es?'La propuesta utiliza reglas de rotación y tu información. El modelo NASA HLS permanece reservado a su parcela de estudio.':'The proposal uses crop rotation rules and your input. The NASA HLS model remains limited to its study parcel.')}</p>
    <p>{es?'Referencias':'References'}: {plan.sources.join(' · ')}</p>
   </details>
  </div>
  <div className="chakra-result-actions"><button type="button" className="b-btn b-btn-primary" onClick={onPrint}>{es?'Imprimir mapa y plan PDF':'Print map and PDF plan'}</button>
   <button type="button" className="b-btn b-btn-light" onClick={onEdit}>{es?'Editar mis cultivos':'Edit my crops'}</button></div>
 </section>
}

export function ChakraZonePrint({plan,field,subplots,lang,place,extra}:{
 plan:ChakraSpatialPlan;field:GeoPolygon;subplots:ChakraParcel[];
 lang:'es'|'en';place:string;extra?:ReactNode
}){
 const es=lang==='es'
 return <article className="chakra-spatial-print">
  <header><strong>chakra</strong><span>{es?'Plan agrícola por zonas · NASA Space Apps 2026':'Zone planting plan · NASA Space Apps 2026'}</span></header>
  <h1>{es?'Dónde, cuándo y cómo sembrar':'Where, when and how to plant'}</h1>
  <p>{place} · {es?'Área aproximada':'Approximate area'}: {plan.parcel_area_ha.toFixed(2)} ha · {new Date().toLocaleDateString(es?'es-PE':'en-US')}</p>
  <ChakraZoneSketch field={field} subplots={subplots} plan={plan} lang={lang}/>
  {plan.zone_plans.map((row,i)=><section className="chakra-print-zone" key={row.zone_id}>
   <h2><span style={{background:shade(i)}}/> {label(row.zone_id,es)} ({row.area_ha.toFixed(2)} ha)</h2>
   <p><strong>{es?'Cultivo registrado':'Current crop'}:</strong> {localizedCrop(row.current_crop,row.current_crop_en,es)}</p>
   <p><strong>{es?'Próximo cultivo a evaluar':'Crop to consider'}:</strong> {localizedCrop(row.suggested_crop,row.suggested_crop_en,es)}</p>
   <p><strong>{es?'Siembra orientativa':'Reference sowing'}:</strong> {localizedDate(row,es)}</p>
   <p>{!es&&row.why_en?row.why_en:row.why_es}</p>
   <ol>{(!es&&row.how_en?row.how_en:row.how_es).map((s,j)=><li key={j}>{s}</li>)}</ol>
  </section>)}
  {extra}
  <footer><p>{es?plan.disclaimer_es:plan.disclaimer_en||plan.disclaimer_es}</p><p>{plan.sources.join(' · ')}</p></footer>
 </article>
}
