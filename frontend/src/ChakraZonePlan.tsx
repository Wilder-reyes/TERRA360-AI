/** Clear, print-safe spatial planting recommendations; do not mistake colors for satellite evidence. */
import {useState,type ReactNode} from 'react'
import ChakraRotationTimeline,{planMonths,campaignAt,displayMonth,quarterMonths,quarterCrops,quarterName,zoneLabel} from './ChakraRotationTimeline'
import {cropVisual} from './chakraCropVisuals'
import ChakraAerialPlanMap from './ChakraAerialPlanMap'
import type {GeoPolygon} from './rotationZones'
import {printableGeometry} from './campaignPlan'

export type ChakraZoneAdvice={
 zone_id:string;area_ha:number;current_crop_id:string;current_crop:string;current_crop_en?:string;
 suggested_crop_id:string;suggested_crop:string;suggested_crop_en?:string;sow_month:string;sow_label_es:string;sow_label_en?:string;
 estimated_cycle_days:number;why_es:string;why_en?:string;how_es:string[];how_en?:string[];
 reference_water_mm:number|null;sowing_window_scope:string;source_tags:string[];
 campaigns?:{crop_id:string;crop_es:string;crop_en:string;sow_month:string;end_month:string;estimated_cycle_days:number;reference_water_mm:number|null;source:string}[]
}
export type ChakraSpatialPlan={
 status:string;parcel_area_ha:number;zone_plans:ChakraZoneAdvice[];
 planning_months?:number;plan_start_month?:string;plan_end_month?:string;plan_kind?:string;
 scope:'barranca_reference'|'exploratory_reference';
 climate_status:string;ai_status:string;disclaimer_es:string;disclaimer_en?:string;sources:string[];sources_en?:string[]
}
export type ChakraParcel={id:string;polygon:GeoPolygon}
const SHADES=['#A3D99D','#E9B56D','#8CB9E1','#D0A4E8','#B9D76F','#E4A0A0','#94C4B6']
const label=(id:string,es:boolean,index=0)=>zoneLabel(id,es,index)
const areaName=(value:number,es:boolean)=>value.toLocaleString(es?'es-PE':'en-US',{maximumFractionDigits:2})+(es?' hectáreas':' hectares')
const shade=(index:number)=>SHADES[index%SHADES.length]
const localizedCrop=(name:string,nameEn:string|undefined,es:boolean)=>!es&&nameEn?nameEn:name
const localizedDate=(row:ChakraZoneAdvice,es:boolean)=>!es&&row.sow_label_en?row.sow_label_en:row.sow_label_es

/** The same real polygon is rendered at every moment; only the recommended crop changes. */
function sketchCenter(points:string):{x:number;y:number}{
 const values=points.trim().split(/\s+/).map(pair=>pair.split(',').map(Number)).filter(v=>v.length===2&&v.every(Number.isFinite))
 if(!values.length)return {x:300,y:170}
 return {x:values.reduce((n,p)=>n+p[0],0)/values.length,y:values.reduce((n,p)=>n+p[1],0)/values.length}
}
function suggestedFor(row:ChakraZoneAdvice,month?:string){
 if(!month)return {cropId:row.suggested_crop_id,nameEs:row.suggested_crop,nameEn:row.suggested_crop_en}
 const active=campaignAt(row,month)
 return {cropId:active?.crop_id||row.current_crop_id,nameEs:active?.crop_es||'Último cultivo: '+row.current_crop,nameEn:active?.crop_en||'Last grown: '+(row.current_crop_en||row.current_crop)}
}
export function ChakraZoneSketch({field,subplots,plan,lang,month}:{field:GeoPolygon;subplots:ChakraParcel[];plan:ChakraSpatialPlan;lang:'es'|'en';month?:string}){
 const es=lang==='es',geometry=printableGeometry(field,subplots)
 const rest=plan.zone_plans.find(row=>row.zone_id==='rest')
 const restCrop=rest?suggestedFor(rest,month):null
 const restVisual=cropVisual(restCrop?.cropId)
 const restPos=sketchCenter(geometry.field)
 return <figure className="chakra-plan-sketch" aria-label={es?'Mapa del terreno por zonas':'Field zone map'}>
  <svg viewBox="0 0 600 340" role="img" aria-label={es?'Mapa de cultivos por zonas':'Crop map by area'}>
   <title>{es?'Distribución espacial del terreno':'Field spatial layout'}</title>
   <rect width="600" height="340" rx="20" fill="#152519"/>
   <polygon points={geometry.field} fill={restVisual.color} fillOpacity={rest?'.9':'0'} stroke="#D6F866" strokeWidth="5" strokeLinejoin="round"/>
   {rest&&subplots.length===0&&<text x={restPos.x} y={restPos.y} textAnchor="middle" fill="#142b1c" fontSize="21" fontWeight="800">{restCrop?(es?restCrop.nameEs:restCrop.nameEn):''}</text>}
   {subplots.map((sub,i)=>{
    const row=plan.zone_plans.find(p=>p.zone_id===sub.id),current=row?suggestedFor(row,month):null
    const v=cropVisual(current?.cropId),position=sketchCenter(geometry.subplots[i])
    return <g key={sub.id}>
     <polygon points={geometry.subplots[i]} fill={v.color} fillOpacity=".94" stroke="#F1F8EB" strokeWidth="3" strokeLinejoin="round">
      <title>{sub.id}: {current?(es?current.nameEs:current.nameEn):''}</title>
     </polygon>
     {current&&<text x={position.x} y={position.y} textAnchor="middle" dominantBaseline="middle" fill="#13261b" fontSize="18" fontWeight="800" pointerEvents="none">{es?current.nameEs:current.nameEn}</text>}
    </g>
   })}
   <text x="554" y="30" fontSize="18" fontWeight="800" fill="#D6F866">N ↑</text>
  </svg>
  <figcaption>{month?(es?'Propuesta para '+displayMonth(month,lang)+' '+month.slice(0,4):'Suggested planting for '+displayMonth(month,lang)+' '+month.slice(0,4)):(es?'Distribución de las próximas siembras':'Suggested next plantings')}</figcaption>
  <div className="chakra-sketch-legend">{plan.zone_plans.map((row,i)=>{
   const value=suggestedFor(row,month),visual=cropVisual(value.cropId)
   return <span key={row.zone_id}><i style={{background:visual.color}}/>{label(row.zone_id,es,i)} · {areaName(row.area_ha,es)} · {es?value.nameEs:value.nameEn}</span>
  })}</div>
 </figure>
}
export default function ChakraZonePlan({plan,field,subplots,lang,onPrint,onEdit}:{
 plan:ChakraSpatialPlan;field:GeoPolygon;subplots:ChakraParcel[];lang:'es'|'en';
 onPrint:()=>void;onEdit:()=>void
}){
 const es=lang==='es'
 const [monthIndex,setMonthIndex]=useState(()=>{
  const months=planMonths(plan)
  const first=months.findIndex(m=>plan.zone_plans.some(row=>row.campaigns?.some(c=>c.sow_month===m)))
  return Math.max(0,first)
 })
 const months=planMonths(plan)
 const sharePdf=()=>{
  const picker=document.createElement('input');picker.type='file';picker.accept='application/pdf';picker.setAttribute('aria-label',es?'Selecciona el PDF guardado':'Choose saved PDF')
  picker.onchange=async()=>{const file=picker.files?.[0];if(!file)return
   const nav=navigator as Navigator & {canShare?:(data:{files:File[]})=>boolean;share?:(data:{files:File[];title:string;text:string})=>Promise<void>}
   if(nav.canShare?.({files:[file]})&&nav.share){try{await nav.share({files:[file],title:'CHAKRA X',text:es?'Mi plan de siembra CHAKRA X':'My CHAKRA X planting plan'});return}catch{return}}
   window.open('https://wa.me/?text='+encodeURIComponent(es?'Te comparto mi plan CHAKRA X. Adjuntaré el PDF guardado.':'Here is my CHAKRA X plan. I will attach the saved PDF.'),'_blank','noopener,noreferrer')
  };picker.click()
 }
 return <section className="chakra-zone-result" data-bio-target="bio-result" aria-label={es?'Plan agrícola por zonas':'Zone planting plan'}>
  <div className="chakra-result-heading"><span className="b-eyebrow">{es?'PASO 3 DE 3 · TU PLAN':'STEP 3 OF 3 · YOUR PLAN'}</span>
   <h1>{es?'Mi plan de cultivos':'My crop plan'}</h1>
   <p>{es?'Visualiza cada polígono, los cultivos actuales y la siguiente siembra recomendada. Los meses sin campaña programada se muestran expresamente.':'View your polygons, current crops and suggested next planting. Months without a scheduled crop are explicitly marked.'}</p>
  </div>
  <div className="chakra-plan-highlight">
   <span>{es?'MI TERRENO':'MY FIELD'}</span>
   <strong>{areaName(plan.parcel_area_ha,es)}</strong>
   <span>{plan.zone_plans.length} {es?'zonas registradas':'areas recorded'}</span>
  </div>
  <ChakraAerialPlanMap field={field} subplots={subplots} plan={plan} lang={lang} month={months[Math.min(monthIndex,months.length-1)]}/>
  <ChakraRotationTimeline plan={plan} lang={lang} monthIndex={monthIndex} onMonth={setMonthIndex}/>
  <div className="chakra-result-advice">{plan.zone_plans.map((row,i)=><article className="chakra-advice-card" key={row.zone_id}>
   <header><span className="chakra-advice-zone"><i style={{background:shade(i)}}/>{label(row.zone_id,es,i)} · {areaName(row.area_ha,es)}</span><span className="chakra-advice-current">{es?'Antes':'Current'}: {localizedCrop(row.current_crop,row.current_crop_en,es)}</span></header>
   <h2><span aria-hidden="true">{cropVisual(row.suggested_crop_id).icon} </span>{localizedCrop(row.suggested_crop,row.suggested_crop_en,es)}</h2>
   <div className="chakra-advice-when"><span aria-hidden="true">🗓️ </span><span>{es?'CUÁNDO SEMBRAR':'WHEN TO PLANT'}</span><strong>{localizedDate(row,es)}</strong></div>
   <p>{!es&&row.why_en?row.why_en:row.why_es}</p>
   <details open><summary>{es?'🌱 Cómo prepararlo, paso a paso':'How to prepare the planting'}</summary><ol>{(!es&&row.how_en?row.how_en:row.how_es).map((line,j)=><li key={j}>{line}</li>)}</ol></details>
  </article>)}</div>
  <div className="chakra-result-actions"><button type="button" className="b-btn b-btn-primary" onClick={onPrint}>{es?'🖨️ Guardar como PDF':'🖨️ Save as PDF'}</button>
   <button type="button" className="b-btn b-btn-light" onClick={sharePdf}>{es?'📲 Compartir PDF por WhatsApp':'📲 Share PDF on WhatsApp'}</button>
   <button type="button" className="b-btn b-btn-light" onClick={onEdit}>{es?'Editar mis cultivos':'Edit my crops'}</button></div>
 </section>
}

export function ChakraZonePrint({plan,field,subplots,lang,place,extra}:{
 plan:ChakraSpatialPlan;field:GeoPolygon;subplots:ChakraParcel[];
 lang:'es'|'en';place:string;extra?:ReactNode
}){
 const es=lang==='es'
 return <article className="chakra-spatial-print">
  <header><strong>CHAKRA X</strong><span>{es?'Plan agrícola por zonas · NASA Space Apps 2026':'Zone planting plan · NASA Space Apps 2026'}</span></header>
  <h1>{es?'Mi plan de siembra':'My planting plan'}</h1>
  <p>{place} · {es?'Área aproximada':'Approximate area'}: {areaName(plan.parcel_area_ha,es)} · {new Date().toLocaleDateString(es?'es-PE':'en-US')}</p>
  <ChakraZoneSketch field={field} subplots={subplots} plan={plan} lang={lang}/>
  {plan.zone_plans.map((row,i)=><section className="chakra-print-zone" key={row.zone_id}>
   <h2><span style={{background:shade(i)}}/> {label(row.zone_id,es,i)} ({areaName(row.area_ha,es)})</h2>
   <p><strong>{es?'Cultivo registrado':'Current crop'}:</strong> {localizedCrop(row.current_crop,row.current_crop_en,es)}</p>
   <p><strong>🌱 {es?'Próximo cultivo a evaluar':'Crop to consider'}:</strong> {localizedCrop(row.suggested_crop,row.suggested_crop_en,es)}</p>
   <p><strong>🗓️ {es?'Siembra orientativa':'Reference sowing'}:</strong> {localizedDate(row,es)}</p>
   <p>{!es&&row.why_en?row.why_en:row.why_es}</p>
   <ol>{(!es&&row.how_en?row.how_en:row.how_es).map((s,j)=><li key={j}>{s}</li>)}</ol>
  </section>)}
  {planMonths(plan).length>0&&[...new Set(planMonths(plan).map(m=>m.slice(0,4)))].map(year=>{
   const slots=planMonths(plan).filter(m=>m.startsWith(year))
   return <section className="chakra-print-year" key={year}>
    <h2>{es?'Calendario de rotación':'Rotation calendar'} · {year}</h2>
    <table><thead><tr><th>{es?'Zona':'Area'}</th>{[0,1,2,3].map(q=><th key={q}>{quarterName(q,lang)}</th>)}</tr></thead>
     <tbody>{plan.zone_plans.map((row,i)=><tr key={row.zone_id}>
      <th>{zoneLabel(row.zone_id,es,i)}<small>{es?'Antes: ':'Previously: '}{es?row.current_crop:row.current_crop_en||row.current_crop}</small></th>
      {[0,1,2,3].map(q=>{
       const cells=quarterCrops(row,quarterMonths(slots,q))
       return <td key={q}>{cells.length?cells.map(c=>{const v=cropVisual(c.crop_id);return <span key={c.when} style={{background:v.color}}>{es?c.label:c.label_en} · {c.continues?(es?'Continúa':'Ongoing'):displayMonth(c.when,lang)}</span>} ):(es?'Sin siembra programada':'No planting scheduled')}</td>
      })}
     </tr>)}</tbody></table>
   </section>
  })}
  {extra}
  <footer><p>{es?'Fuentes disponibles en ':'Sources available at '}{'https://biotex-eta.vercel.app/fuentes'}</p><p>CHAKRA X · NASA Space Apps 2026 · Field Shift</p></footer>
 </article>
}
