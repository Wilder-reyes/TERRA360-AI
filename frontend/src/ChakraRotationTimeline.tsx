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
export default function ChakraRotationTimeline({plan,lang,monthIndex,onMonth}:{
 plan:ChakraSpatialPlan;lang:'es'|'en';monthIndex:number;onMonth:(v:number)=>void
}){
 const months=planMonths(plan)
 if(!months.length)return null
 const es=lang==='es'
 const current=months[Math.min(monthIndex,months.length-1)]
 const years=[...new Set(months.map(m=>m.slice(0,4)))]
 return <section className="chakra-calendar" aria-label={es?'Calendario de rotación por zonas':'Crop rotation calendar by zone'}>
  <div className="chakra-calendar-intro">
   <div><span className="b-eyebrow">{es?'MI CALENDARIO':'MY CALENDAR'}</span>
    <h2>{es?'Así cambiarán tus cultivos':'How your crops could change'}</h2>
    <p>{es?'Elige un mes para ver cada zona en el mapa. Los colores muestran propuestas, no cultivos observados.':'Choose a month to see each area on the map. Colors show suggestions, not observed crops.'}</p></div>
   <div className="chakra-calendar-active"><span>{es?'Mes seleccionado':'Selected month'}</span><strong>{displayMonth(current,lang)} {current.slice(0,4)}</strong></div>
  </div>
  <div className="chakra-calendar-nav" aria-label={es?'Navegar por periodos':'Navigate periods'}>
   <button type="button" disabled={monthIndex===0} onClick={()=>onMonth(Math.max(0,monthIndex-1))} aria-label={es?'Mes anterior':'Previous month'}>‹</button>
   {years.map(year=><button key={year} type="button" className={current.startsWith(year)?'selected':''} onClick={()=>onMonth(months.findIndex(m=>m.startsWith(year)))}>{year}</button>)}
   <button type="button" disabled={monthIndex===months.length-1} onClick={()=>onMonth(Math.min(months.length-1,monthIndex+1))} aria-label={es?'Mes siguiente':'Next month'}>›</button>
  </div>
  <div className="chakra-calendar-scroll" tabIndex={0} aria-label={es?'Desplázate horizontalmente para ver todos los meses':'Scroll horizontally to see all months'}>
   <div className="chakra-calendar-grid" style={{gridTemplateColumns:'128px repeat('+months.length+', 66px)'}}>
    <div className="chakra-calendar-sticky chakra-calendar-label">{es?'Zona':'Area'}</div>
    {months.map((m,i)=><button type="button" key={m} className={'chakra-month-head'+(i===monthIndex?' current':'')} onClick={()=>onMonth(i)} aria-pressed={i===monthIndex}><strong>{displayMonth(m,lang)}</strong><small>{m.slice(0,4)}</small></button>)}
    {plan.zone_plans.map((zone,i)=><div className="chakra-calendar-row" key={zone.zone_id} style={{display:'contents'}}>
      <div className="chakra-calendar-sticky chakra-calendar-label">{zone.zone_id==='rest'?(es?'Resto':'Rest'):es?'Zona '+(i+1):'Area '+(i+1)}</div>
      {months.map((m,j)=>{
       const c=campaignAt(zone,m),info=cropVisual(c?.crop_id),start=c?.sow_month===m
       return <button type="button" key={m} className={'chakra-calendar-slot'+(j===monthIndex?' current':'')+(start?' starts':'')} onClick={()=>onMonth(j)} style={{background:c?info.color:'#E5E9DE'}} title={c?(es?c.crop_es:c.crop_en)+' · '+m:(es?'Sin cultivo propuesto':'No crop suggested')}>
        {c?<span aria-label={es?c.crop_es:c.crop_en}>{start?info.icon:'·'}</span>:<span>—</span>}
       </button>
      })}
     </div>)}
   </div>
  </div>
  <div className="chakra-calendar-legend">{plan.zone_plans.map((zone,i)=>{
   const c=campaignAt(zone,current),info=cropVisual(c?.crop_id)
   return <span key={zone.zone_id}><i style={{background:info.color}}/>{zone.zone_id==='rest'?(es?'Resto':'Rest'):es?'Zona '+(i+1):'Area '+(i+1)}: <strong>{c?(es?c.crop_es:c.crop_en):(es?'Sin siembra propuesta':'No planting suggested')}</strong></span>
  })}</div>
  <p className="chakra-calendar-note">{es?'Guía orientativa basada en cultivos registrados y referencias agrícolas. Revísala en cada campaña: no es un pronóstico de clima ni de cosecha.':'Reference guidance based on recorded crops and agronomic sources. Review each season: this is not a forecast of weather or harvests.'}</p>
 </section>
}