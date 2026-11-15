import type {ChakraSpatialPlan,ChakraZoneAdvice} from './ChakraZonePlan'
import {cropVisual} from './chakraCropVisuals'

export function addPlanMonths(iso:string,amount:number):string{
 const [y,m]=iso.split('-').map(Number)
 const d=new Date(Date.UTC(y,m-1+amount,1))
 return String(d.getUTCFullYear())+'-'+String(d.getUTCMonth()+1).padStart(2,'0')
}
export function planMonths(plan:ChakraSpatialPlan):string[]{
 if(!plan.plan_start_month||!plan.planning_months)return []
 return Array.from({length:Math.max(0,Math.min(60,plan.planning_months))},(_,i)=>addPlanMonths(plan.plan_start_month!,i))
}
export function campaignAt(zone:ChakraZoneAdvice,month:string){
 return zone.campaigns?.find(c=>c.sow_month<=month&&month<c.end_month)
}
export function displayMonth(iso:string,lang:'es'|'en'){
 const date=new Date(iso+'-01T00:00:00Z')
 return date.toLocaleDateString(lang==='es'?'es-PE':'en-US',{month:'short',timeZone:'UTC'})
}
export function zoneLabel(id:string,es:boolean,index:number):string{
 const suffix=String.fromCharCode(65+Math.min(index,25))
 return (es?'Zona ':'Area ')+suffix
}
export function quarterMonths(yearMonths:string[],quarter:number){
 return yearMonths.filter(month=>Math.floor((Number(month.slice(5,7))-1)/3)===quarter)
}
export function quarterName(quarter:number,lang:'es'|'en'){
 const names=lang==='es'?['Ene–Mar','Abr–Jun','Jul–Set','Oct–Dic']:['Jan–Mar','Apr–Jun','Jul–Sep','Oct–Dec']
 return names[quarter]
}
export function quarterCrops(zone:ChakraZoneAdvice,months:string[]){
 const map=new Map<string,{crop_id:string;label:string;label_en:string;when:string}>()
 for(const month of months){
  const campaign=campaignAt(zone,month)
  if(campaign&&!map.has(campaign.sow_month)){
   map.set(campaign.sow_month,{crop_id:campaign.crop_id,label:campaign.crop_es,label_en:campaign.crop_en,when:campaign.sow_month})
  }
 }
 return [...map.values()]
}
export default function ChakraRotationTimeline({plan,lang,monthIndex,onMonth}:{
 plan:ChakraSpatialPlan;lang:'es'|'en';monthIndex:number;onMonth:(v:number)=>void
}){
 const months=planMonths(plan)
 if(!months.length)return null
 const es=lang==='es',activeIndex=Math.max(0,Math.min(monthIndex,months.length-1))
 const current=months[activeIndex],activeYear=current.slice(0,4)
 const years=[...new Set(months.map(m=>m.slice(0,4)))]
 const yearMonths=months.filter(m=>m.startsWith(activeYear))
 const select=(month:string)=>{const index=months.indexOf(month);if(index>=0)onMonth(index)}
 return <section className="chakra-calendar chakra-calendar-v3" aria-label={es?'Calendario de cultivos por zonas':'Crop calendar by area'}>
  <header className="chakra-calendar-intro">
   <div><span className="b-eyebrow">{es?'MI PLAN DE SIEMBRA':'MY PLANTING PLAN'}</span>
    <h2>{es?'¿Qué podría sembrar en cada zona?':'What could I plant in each area?'}</h2>
    <p>{es?'Explora cada año y elige un mes. El mapa de arriba cambia para mostrar tus próximas opciones.':'Explore each year and choose a month. The map above changes to show your next options.'}</p></div>
   <div className="chakra-calendar-active"><span>{es?'ESTÁS VIENDO':'YOU ARE VIEWING'}</span><strong>{displayMonth(current,lang)} {activeYear}</strong></div>
  </header>
  <nav className="chakra-calendar-years" aria-label={es?'Elegir año':'Choose year'}>
   {years.map(year=><button type="button" key={year} aria-pressed={activeYear===year} onClick={()=>select(months.find(m=>m.startsWith(year))!)}>{year}</button>)}
  </nav>
  <div className="chakra-calendar-months" role="group" aria-label={es?'Elegir mes para el mapa':'Choose month for map'}>
   {yearMonths.map(month=><button type="button" key={month} className={current===month?'selected':''} aria-pressed={current===month} onClick={()=>select(month)}>{displayMonth(month,lang).replace('.','')}</button>)}
  </div>
  <div className="chakra-quarters" role="table" aria-label={es?'Cultivos organizados por trimestres':'Crops by quarter'}>
   <div className="chakra-quarter-heading" role="row"><div role="columnheader">{es?'TUS ZONAS':'YOUR AREAS'}</div>{[0,1,2,3].map(q=><div key={q} role="columnheader">{quarterName(q,lang)}</div>)}</div>
   {plan.zone_plans.map((zone,index)=><div className="chakra-quarter-row" role="row" key={zone.zone_id}>
    <div className="chakra-quarter-zone" role="rowheader">{zoneLabel(zone.zone_id,es,index)}<small>{es?'Antes':'Previously'}: {es?zone.current_crop:zone.current_crop_en||zone.current_crop}</small></div>
    {[0,1,2,3].map(quarter=>{
     const qMonths=quarterMonths(yearMonths,quarter),values=quarterCrops(zone,qMonths)
     return <div className="chakra-quarter-cell" role="cell" key={quarter}>
      <span className="chakra-quarter-period">{quarterName(quarter,lang)}</span>
      {qMonths.length===0?<span className="chakra-quarter-muted">—</span>:values.length?values.map(c=>{const visual=cropVisual(c.crop_id);return <div key={c.when} className="chakra-quarter-crop" style={{background:visual.color}}>
       <span>{visual.icon}</span><strong>{es?c.label:c.label_en}</strong><small>{displayMonth(c.when,lang).replace('.','')}</small>
      </div>}):<div className="chakra-quarter-empty">{es?'Entre campañas':'Between seasons'}<small>{es?'Último: ':'Last: '}{es?zone.current_crop:zone.current_crop_en||zone.current_crop}</small></div>}
     </div>
    })}
   </div>)}
  </div>
  <div className="chakra-calendar-legend" aria-live="polite">{plan.zone_plans.map((zone,i)=>{
   const currentCrop=campaignAt(zone,current),visual=cropVisual(currentCrop?.crop_id||zone.current_crop_id)
   return <span key={zone.zone_id}><i style={{background:visual.color}}/>{zoneLabel(zone.zone_id,es,i)}: <strong>{currentCrop?(es?currentCrop.crop_es:currentCrop.crop_en):((es?'Último cultivo: ':'Last grown: ')+(es?zone.current_crop:zone.current_crop_en||zone.current_crop))}</strong></span>
  })}</div>
  <p className="chakra-calendar-note">{es?'Las fechas son sugerencias para revisar según agua, suelo y temporada. No son predicciones de cosecha.':'Dates are references to review against water, soil and the planting season; they are not harvest predictions.'}</p>
 </section>
}