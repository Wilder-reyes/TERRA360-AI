import {jsPDF} from 'jspdf'
import regularUrl from './assets/pdf-fonts/OpenSans-Regular.ttf?url'
import boldUrl from './assets/pdf-fonts/OpenSans-Bold.ttf?url'
import type {ChakraParcel,ChakraSpatialPlan} from './ChakraZonePlan'
import type {GeoPolygon} from './rotationZones'
import type {CompareStrategy} from './StrategyCompare'
import {printableGeometry} from './campaignPlan'
import {calendarState} from './calendarState'
import {cropVisual} from './chakraCropVisuals'

export type PlanPdfOptions={plan:ChakraSpatialPlan;field:GeoPolygon;subplots:ChakraParcel[];lang:'es'|'en';place?:string;comparisons?:CompareStrategy[];origin:string}
const clean=(text:string)=>text.replace(/[\u{1F000}-\u{1FFFF}\u2600-\u27ff]/gu,'').replace(/[–—]/g,'-').replace(/→/g,' > ').replace(/≥/g,'>=').replace(/≤/g,'<=').replace(/≈/g,'~')

let fonts:Promise<string[]>|undefined
function loadFonts(){
 return fonts??=(Promise.all([regularUrl,boldUrl].map(async url=>{
  const response=await fetch(url)
  if(!response.ok)throw new Error('PDF font unavailable')
  const bytes=new Uint8Array(await response.arrayBuffer())
  let binary=''
  for(let i=0;i<bytes.length;i+=8192)binary+=String.fromCharCode(...bytes.subarray(i,i+8192))
  return btoa(binary)
 })))
}

/** A4 vector output. Pagination uses physical units, never the screen width. */
export async function createPlanPdf({plan,field,subplots,lang,place,comparisons,origin}:PlanPdfOptions):Promise<File>{
 const es=lang==='es',doc=new jsPDF({unit:'mm',format:'a4',compress:true,putOnlyUsedFonts:true})
 const [regular,bold]=await loadFonts()
 doc.addFileToVFS('OpenSans-Regular.ttf',regular);doc.addFont('OpenSans-Regular.ttf','OpenSans','normal')
 doc.addFileToVFS('OpenSans-Bold.ttf',bold);doc.addFont('OpenSans-Bold.ttf','OpenSans','bold')
 const margin=18,width=174,bottom=276,lineHeight=5.1
 let y=48,continuation=''
 doc.setProperties({title:'CHAKRA X · '+(es?'Plan agrícola':'Agricultural plan'),subject:es?'Resultados por zona y calendario de referencia':'Zone results and reference calendar',creator:'CHAKRA X'})
 const area=(n:number)=>n.toLocaleString(es?'es-PE':'en-US',{maximumFractionDigits:2})+' ha'
 function newPage(){
  doc.addPage();doc.setDrawColor(112,141,104);doc.setLineWidth(.3);doc.line(margin,27,192,27)
  doc.setFont('OpenSans','bold');doc.setFontSize(12);doc.setTextColor(38,70,42);doc.text('CHAKRA X',margin,21)
  y=36
  if(continuation)text(continuation+(es?' · continuación':' · continued'),11,true)
 }
 function ensure(height:number){if(y+height>bottom)newPage()}
 function text(value:string,size=10.5,bold=false){
  doc.setFont('OpenSans',bold?'bold':'normal');doc.setFontSize(size);doc.setTextColor(30,52,35)
  const lines=doc.splitTextToSize(clean(value),width) as string[]
  const step=size>14?7.5:lineHeight
  for(const line of lines){ensure(step);doc.setFont('OpenSans',bold?'bold':'normal');doc.setFontSize(size);doc.text(line,margin,y);y+=step}
  y+=2
 }
 function heading(value:string){ensure(23);text(value,17,true);y+=2}
 function monthName(month:string){return new Date(month+'-01T00:00:00Z').toLocaleDateString(es?'es-PE':'en-US',{month:'long',year:'numeric',timeZone:'UTC'})}
 doc.setFillColor(5,8,6);doc.rect(0,0,210,36,'F');doc.setFont('OpenSans','bold');doc.setFontSize(24);doc.setTextColor(214,248,102);doc.text('CHAKRA X',margin,23)
 heading(es?'Mi plan agrícola':'My agricultural plan')
 text(place?.trim()||(es?'Terreno delimitado por el usuario':'Farmer-outlined field'),12,true)
 text((es?'Superficie aproximada: ':'Approximate field area: ')+area(plan.parcel_area_ha))
 text(plan.zone_plans.length+' '+(es?'zonas registradas':'recorded areas')+' · '+new Date().toLocaleDateString(es?'es-PE':'en-US'))
 if(plan.plan_start_month&&plan.plan_end_month)text((es?'Periodo del plan: ':'Planning period: ')+monthName(plan.plan_start_month)+' - '+monthName(plan.plan_end_month),10)
 const mapHeight=90
 ensure(mapHeight+25)
 const geometry=printableGeometry(field,subplots),mapTop=y,scale=Math.min(width/600,mapHeight/340)
 const mapX=margin+(width-600*scale)/2
 function polygon(value:string,fill:boolean){
  const vertices=value.trim().split(/\s+/).map(pair=>pair.split(',').map(Number))
  if(vertices.length<3)return
  doc.lines(vertices.slice(1).map((p,i)=>[(p[0]-vertices[i][0])*scale,(p[1]-vertices[i][1])*scale]),mapX+vertices[0][0]*scale,mapTop+vertices[0][1]*scale,[1,1],fill?'FD':'S',true)
 }
 doc.setDrawColor(64,104,60);doc.setLineWidth(.6);polygon(geometry.field,false)
 subplots.forEach((zone,i)=>{
  const row=plan.zone_plans.find(z=>z.zone_id===zone.id)
  const color=cropVisual(row?.current_crop_id).color
  doc.setFillColor(color);polygon(geometry.subplots[i],true)
  const vertices=geometry.subplots[i].trim().split(/\s+/).map(pair=>pair.split(',').map(Number))
  const labelIndex=plan.zone_plans.findIndex(z=>z.zone_id===zone.id)
  doc.setFont('OpenSans','bold');doc.setFontSize(13);doc.setTextColor(15,40,23)
  doc.text(String.fromCharCode(65+Math.max(0,labelIndex)),mapX+vertices.reduce((a,p)=>a+p[0],0)/vertices.length*scale,mapTop+vertices.reduce((a,p)=>a+p[1],0)/vertices.length*scale)
 })
 y+=mapHeight+7
 text(es?'Croquis de los polígonos declarados. No es un levantamiento catastral.':'Declared polygon sketch. Not a cadastral survey.',9)
 plan.zone_plans.forEach((zone,i)=>text(String.fromCharCode(65+i)+' · '+area(zone.area_ha)+' · '+(es?zone.current_crop:zone.current_crop_en||zone.current_crop),10))
 text(es?'El terreno exterior a los polígonos no se cuenta como zona sembrada.':'Land outside the polygons is not counted as planted.',9)
 for(const [i,zone] of plan.zone_plans.entries()){
  continuation='';newPage();continuation=(es?'Zona ':'Area ')+String.fromCharCode(65+i)
  heading(continuation+' · '+area(zone.area_ha))
  text((es?'Cultivo actual: ':'Current crop: ')+(es?zone.current_crop:zone.current_crop_en||zone.current_crop),12,true)
  if(zone.last_planting_month)text((es?'Siembra declarada: ':'Declared sowing: ')+monthName(zone.last_planting_month))
  text((es?'Próximo cultivo recomendado: ':'Suggested next crop: ')+(es?zone.suggested_crop:zone.suggested_crop_en||zone.suggested_crop),12,true)
  text((es?'Siembra orientativa: ':'Reference sowing: ')+(es?zone.sow_label_es:zone.sow_label_en||zone.sow_label_es))
  text(es?zone.why_es:zone.why_en||zone.why_es)
  heading(es?'Preparación paso a paso':'Preparation steps')
  ;(es?zone.how_es:zone.how_en||zone.how_es).forEach((step,j)=>text((j+1)+'. '+step))
  text(es?plan.disclaimer_es:plan.disclaimer_en||plan.disclaimer_es,9.5)
  text((es?'Referencias: ':'References: ')+zone.source_tags.join(' · '),9)
 }
 continuation='';newPage();heading(es?'Calendario de cultivos':'Crop calendar')
 text(es?'El crecimiento se estima con la fecha declarada y la duración de catálogo. Un mes sin programación no significa descanso planificado.':'Growth is estimated from the declared sowing date and catalog duration. An unscheduled month does not imply planned fallow.',9.5)
 if(plan.plan_start_month&&plan.planning_months){
  const [year,month]=plan.plan_start_month.split('-').map(Number)
  for(let i=0;i<plan.planning_months;i++){
   const iso=new Date(Date.UTC(year,month-1+i,1)).toISOString().slice(0,7)
   const rows=plan.zone_plans.map((zone,j)=>{const state=calendarState(zone,iso,es);return (es?'Zona ':'Area ')+String.fromCharCode(65+j)+': '+state.name+' · '+state.state})
   doc.setFont('OpenSans','normal');doc.setFontSize(10.5)
   const height=10+rows.reduce((sum,row)=>sum+(doc.splitTextToSize(clean(row),width).length*lineHeight+2),0)
   ensure(Math.min(height,210));text(monthName(iso),12,true)
   rows.forEach(row=>text(row));y+=3
  }
 }else text(es?'No se recibió un periodo de calendario confirmado. Consulta las fechas orientativas por zona.':'No confirmed calendar period was received. See the reference dates for each area.')
 if(comparisons?.length){
  continuation='';newPage();heading(es?'Comparación de estrategias':'Strategy comparison')
  text(es?'Referencia del terreno sobre 24 meses; no agrega cultivos simultáneos por superficie. Estimaciones relativas, no ahorros de riego medidos.':'24-month representative field reference, not an area-weighted aggregation of simultaneous crops. Relative estimates, not measured irrigation savings.',9.5)
  for(const strategy of comparisons){
   ensure(40);text(strategy.id+' · '+(es?strategy.title_es||strategy.id:strategy.title_en||strategy.title_es||strategy.id),12,true)
   text((es?'Agua de referencia en meses secos: ':'Reference dry-month crop water: ')+Math.round(strategy.indicators.water_low_river_mm)+' mm · '+(es?'Meses sin cultivo: ':'Uncovered months: ')+strategy.indicators.bare_months+'/24',10)
   for(const [key,esLabel,enLabel] of [['why','Por qué','Why'],['evidence','Evidencia','Evidence'],['benefits','Beneficios','Benefits'],['gaps','Información pendiente','Gaps'],['risks','Riesgos','Risks']] as const){
    const values=strategy.sections?.[key]?.[lang]||[]
    if(values.length){text(es?esLabel:enLabel,10,true);values.forEach(value=>text('- '+value,9.5))}
   }
  }
 }
 continuation='';newPage();heading(es?'Fuentes y limitaciones':'Sources and limitations')
 text(es?plan.disclaimer_es:plan.disclaimer_en||plan.disclaimer_es)
 text(plan.climate_status==='nasa_power_reference'?(es?'NASA POWER: climatología regional disponible.':'NASA POWER: regional climatology available.'):(es?'Climatología no disponible para este cálculo; se usan reglas de referencia.':'Climatology unavailable for this calculation; reference rules are used.'))
 text(plan.ai_status==='trained_hls_on_exact_study_parcel'?(es?'Modelo HLS limitado al polígono de estudio de Barranca. No identifica especies ni predice cosechas.':'HLS model limited to the Barranca study polygon. It does not identify crops or predict yields.'):(es?'Planificación por reglas agronómicas; no se afirma un modelo local entrenado.':'Agronomic rule-based planning; no trained local model is claimed.'))
 ;(es?plan.sources:plan.sources_en||plan.sources).forEach(source=>text('- '+source,10))
 text(es?'Confirma agua disponible, suelo, variedad, cosecha y fechas con asesoría local. No se garantizan rendimientos, ganancias ni ahorro real de riego.':'Confirm water, soil, varieties, harvest and dates with local guidance. Yield, profit and actual irrigation savings are not guaranteed.',10)
 text(origin+'/fuentes',10)
 const pages=doc.getNumberOfPages()
 for(let i=1;i<=pages;i++){
  doc.setPage(i);doc.setDrawColor(178,193,171);doc.line(margin,283,192,283);doc.setFont('OpenSans','normal');doc.setFontSize(7.5);doc.setTextColor(80,100,78)
  doc.text('CHAKRA X · NASA Space Apps Challenge 2026 · Field Shift',margin,289);doc.text(i+' / '+pages,192,289,{align:'right'})
 }
 return new File([doc.output('arraybuffer')],'CHAKRA-X-plan.pdf',{type:'application/pdf'})
}
