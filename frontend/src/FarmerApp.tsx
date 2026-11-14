/** Simple, evidence-first mobile experience for a Peruvian farmer.
 * The advanced geospatial lab is still available with ?vista=tecnica.
 */
import {useEffect,useMemo,useRef,useState} from 'react'
import {Area,AreaChart,Bar,BarChart,CartesianGrid,Line,LineChart,ResponsiveContainer,Tooltip,XAxis,YAxis} from 'recharts'
import {FarmerMap} from './FarmerMap'
import {HUANDO_PILOT} from './pilot'
import {API,readableApiError,httpErrorMessage} from './network'
import {computeClimate,safeDateUTC,type ApiResult,type Position,type RecordRow} from './domain'
import './farmer-app.css'

type Page='terreno'|'cultivos'|'resumen'
type Metric='rain'|'temperature'|'humidity'
type CropItem={id:string;name:string;scientific_name:string;category:string;description:string}
type Candidate={id:string;name:string;scientific_name:string;status:string;reason:string;temperature_review:string;rain_review:string;temperature_reference_c:number[]|null;rain_reference_mm_year:number[]|null;can_recommend_sowing:false;local_suitability_confirmed:false}
type Guidance={
 status:'available'|'insufficient_data';
 source:string;period:{start_year:number;end_year:number};
 climate:{status:string;complete_years:number;temperature_mean_c:number|null;annual_rain_mm:number|null;years:number[]};
 history:{year:number;status:string;precipitation_total_mm:number|null;temperature_mean_c:number|null}[];
 candidates:Candidate[];selected_crop:Candidate|null;can_recommend_sowing:false;needs_local_review:string[];limitation:string;source_urls:string[];
}
const popular=[['sweet_potato','Camote'],['tomato','Tomate'],['common_bean','Frijol'],['potato','Papa'],['maize','Maíz'],['avocado','Palta']]
const number=(n:number|null|undefined,digits=1)=>n==null||!Number.isFinite(n)?'—':n.toLocaleString('es-PE',{minimumFractionDigits:digits,maximumFractionDigits:digits})
const nowStamp=()=>new Date().toLocaleDateString('es-PE',{year:'numeric',month:'long',day:'numeric'})
const charts:{id:Metric;label:string;key:keyof RecordRow;unit:string;color:string}[]=[
 {id:'rain',label:'Lluvia',key:'PRECTOTCORR',unit:'mm',color:'#2685b5'},
 {id:'temperature',label:'Temperatura',key:'T2M',unit:'°C',color:'#d88937'},
 {id:'humidity',label:'Humedad del aire',key:'RH2M',unit:'%',color:'#399477'},
]

function DataChart({records,metric}:{records:RecordRow[];metric:Metric}){
 const active=charts.find(c=>c.id===metric)!
 const rows=records.map(r=>({day:r.date.slice(5),value:r[active.key] as number|null}))
 const hasData=rows.some(r=>r.value!==null&&Number.isFinite(r.value))
 if(!hasData)return <div className="f-chart-empty">No tenemos datos suficientes para mostrar esta gráfica.</div>
 return <div className="f-chart" role="img" aria-label={active.label+' registrada durante los días consultados'}>
  <ResponsiveContainer width="100%" height="100%">
   {metric==='rain'?<AreaChart data={rows} margin={{top:16,right:12,bottom:4,left:-18}}>
    <defs><linearGradient id="farmer-rain" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={active.color} stopOpacity={.3}/><stop offset="100%" stopColor={active.color} stopOpacity={0}/></linearGradient></defs>
    <CartesianGrid vertical={false} stroke="#e5ece7" strokeDasharray="4 4"/>
    <XAxis dataKey="day" tick={{fontSize:11}} minTickGap={30}/><YAxis tick={{fontSize:11}}/>
    <Tooltip formatter={v=>number(Number(v),2)+' '+active.unit}/>
    <Area dataKey="value" type="monotone" stroke={active.color} fill="url(#farmer-rain)" strokeWidth={2.4} connectNulls={false} dot={false}/>
   </AreaChart>:<LineChart data={rows} margin={{top:16,right:12,bottom:4,left:-18}}>
    <CartesianGrid vertical={false} stroke="#e5ece7" strokeDasharray="4 4"/>
    <XAxis dataKey="day" tick={{fontSize:11}} minTickGap={30}/><YAxis tick={{fontSize:11}}/>
    <Tooltip formatter={v=>number(Number(v),2)+' '+active.unit}/>
    <Line dataKey="value" type="monotone" stroke={active.color} strokeWidth={2.7} connectNulls={false} dot={false}/>
   </LineChart>}
  </ResponsiveContainer>
 </div>
}
function HistoricalChart({guidance}:{guidance:Guidance}) {
 const records=guidance.history.filter(r=>r.status==='complete'&&r.precipitation_total_mm!==null)
 if(!records.length)return <p className="f-muted">Sin años completos para graficar.</p>
 return <div className="f-chart-small" role="img" aria-label="Lluvia estimada por año completo de NASA POWER">
  <ResponsiveContainer width="100%" height="100%">
   <BarChart data={records} margin={{top:12,right:10,bottom:4,left:-12}}>
    <CartesianGrid vertical={false} stroke="#e8efed" strokeDasharray="3 4"/>
    <XAxis dataKey="year" tick={{fontSize:11}}/><YAxis tick={{fontSize:11}}/>
    <Tooltip formatter={v=>number(Number(v),1)+' mm'}/>
    <Bar dataKey="precipitation_total_mm" name="Lluvia anual" fill="#3997b9" radius={[5,5,0,0]}/>
   </BarChart>
  </ResponsiveContainer>
 </div>
}
function StatusMessage({message,kind='info'}:{message:string;kind?:'info'|'error'|'good'}){
 return <p className={'f-message f-message-'+kind} role={kind==='error'?'alert':'status'}>{message}</p>
}
function MetricCard({label,value,unit,note,style}:{label:string;value:string;unit:string;note:string;style:string}){
 return <div className={'f-metric f-metric-'+style}><span className="f-metric-name">{label}</span><strong>{value}<small> {value==='—'?'':unit}</small></strong><p>{note}</p></div>
}
function CandidateCard({item,selected,onChoose}:{item:Candidate;selected:boolean;onChoose:(id:string,name:string)=>void}){
 const inRange=item.status==='climate_reference_to_review'
 const unknown=item.status==='insufficient_evidence'
 return <article className={'f-crop-option '+(selected?'selected':'')}>
  <div className="f-crop-option-head"><h3>{item.name}</h3><span className={'f-crop-tag '+(unknown?'neutral':inRange?'teal':'amber')}>{unknown?'Faltan referencias':inRange?'Revisar condiciones':'Revisar temperatura'}</span></div>
  <p>{item.reason}</p>
  <p className="f-small">Temperatura: {item.temperature_reference_c?number(item.temperature_reference_c[0])+' a '+number(item.temperature_reference_c[1])+' °C (FAO)':'sin rango validable'}. Estas referencias no indican si tu chacra es apta.</p>
  <button type="button" className="f-btn f-btn-outline" onClick={()=>onChoose(item.id,item.name)}>{selected?'Cultivo elegido':'Quiero revisar este cultivo'}</button>
 </article>
}
function FarmerDashboard({data,loading,metric,onMetric,days,onDays,guidance,selectedCrop,referenceOnly,fieldName,onPrint,onRefresh}:{data:ApiResult|null;loading:boolean;metric:Metric;onMetric:(x:Metric)=>void;days:14|30|90;onDays:(d:14|30|90)=>void;guidance:Guidance|null;selectedCrop:CropItem|null;referenceOnly:boolean;fieldName:string;onPrint:()=>void;onRefresh:()=>void}){
 const records=data?.records||[]
 const climate=useMemo(()=>computeClimate(records),[data])
 const completeness=climate.validRain+'/'+records.length
 const activeCropGuidance=guidance&&guidance.selected_crop?.id===selectedCrop?.id?guidance.selected_crop:guidance?.candidates.find(c=>c.id===selectedCrop?.id)
 return <section id="farmer-report" className="f-report" aria-labelledby="f-report-title">
  <div className="f-report-top"><div><span className="f-eyebrow">MI INFORME AGRÍCOLA</span><h2 id="f-report-title">Así está la información de tu zona</h2><p>Datos que conocemos, información que falta y cultivos que puedes revisar.</p></div><button type="button" className="f-btn f-btn-primary f-print" onClick={onPrint}>Imprimir o guardar en PDF</button></div>
  <div className="f-report-meta"><span><strong>Lugar:</strong> {fieldName.trim()||'Huando / punto elegido en el mapa'}</span><span><strong>Fecha del informe:</strong> {nowStamp()}</span><span><strong>Consulta:</strong> {referenceOnly?'Referencia estadística de Huando; no es una chacra':'Punto marcado por el agricultor; no delimita una propiedad'}</span></div>
  <div className="f-panel f-summary">
   <div className="f-panel-title"><h3>Lluvia y clima</h3><p>Estimaciones de NASA POWER de una zona amplia, no mediciones de tu terreno.</p></div>
   <div className="f-period-picker" aria-label="Elegir los días para revisar">{([14,30,90] as const).map(d=><button key={d} type="button" aria-pressed={days===d} className={days===d?'active':''} onClick={()=>onDays(d)}>{d} días</button>)}<button type="button" className="f-refresh" onClick={onRefresh}>Actualizar</button></div>
   <div className="f-metrics">
    <MetricCard label="Lluvia del periodo" value={loading?'…':number(climate.rainTotal)} unit="mm" note={'Con datos de '+completeness+' días'} style="blue"/>
    <MetricCard label="Temperatura media" value={loading?'…':number(climate.temperature)} unit="°C" note="Temperatura del aire" style="orange"/>
    <MetricCard label="Humedad del aire" value={loading?'…':number(climate.humidity)} unit="%" note="No es humedad del suelo" style="green"/>
   </div>
   <div className="f-chart-head"><div><h4>¿Cómo cambiaron los datos?</h4><small>{data?data.period.start+' al '+data.period.end:'Selecciona tu terreno para comenzar'}</small></div><div className="f-chart-tabs" role="group" aria-label="Cambiar gráfica">{charts.map(c=><button type="button" key={c.id} aria-pressed={metric===c.id} className={metric===c.id?'active':''} onClick={()=>onMetric(c.id)}>{c.label}</button>)}</div></div>
   <DataChart records={records} metric={metric}/>
  </div>
  <div className="f-report-bottom">
   <div className="f-panel">
    <div className="f-panel-title"><h3>Mi cultivo</h3><p>{selectedCrop?selectedCrop.name:'Aún no has elegido un cultivo.'}</p></div>
    {selectedCrop&&<p className="f-small">Elegirlo no significa que sea apto para sembrarlo. El suelo, el agua y la variedad deben comprobarse en campo.</p>}
    {activeCropGuidance&&<StatusMessage message={activeCropGuidance.reason}/>}
    {!guidance&&<StatusMessage message="Consulta «Cultivos para mi zona» para revisar referencias agrícolas. No hay una recomendación automática."/>}
    {guidance&&<p className="f-small">FAO ECOCROP: estimaciones generales para especies; no son un estudio local.</p>}
   </div>
   <div className="f-panel">
    <div className="f-panel-title"><h3>Clima de años anteriores</h3><p>{guidance?guidance.period.start_year+'–'+guidance.period.end_year:'Disponible al revisar cultivos para tu zona'}</p></div>
    {guidance?<><div className="f-historic-facts"><span>Temperatura media: <strong>{number(guidance.climate.temperature_mean_c)} °C</strong></span><span>Lluvia anual media: <strong>{number(guidance.climate.annual_rain_mm)} mm</strong></span></div><HistoricalChart guidance={guidance}/><p className="f-small">Promedio descriptivo de {guidance.climate.complete_years} años completos. No es pronóstico ni cantidad de agua disponible para riego.</p></>:<p className="f-muted">Todavía no se consultaron años completos.</p>}
   </div>
  </div>
  {guidance&&<div className="f-panel f-report-candidates">
   <div className="f-panel-title"><h3>Otros cultivos para conversar con un especialista</h3><p>Solo se compararon rangos generales de temperatura y lluvia de especies. No es una lista de cultivos aptos para tu chacra.</p></div>
   <ul className="f-report-crop-list">{guidance.candidates.filter(item=>item.status==='climate_reference_to_review').slice(0,5).map(item=><li key={item.id}><strong>{item.name}</strong><span>Temperatura regional dentro de referencia general; falta verificar agua, suelo y variedad.</span></li>)}</ul>
   {!guidance.candidates.some(item=>item.status==='climate_reference_to_review')&&<p className="f-muted">Todavía no contamos con referencias completas para mostrar opciones basadas en la temperatura regional.</p>}
  </div>}
  <div className="f-panel f-report-next">
   <h3>Antes de sembrar, ¿qué falta comprobar?</h3>
   <ul><li>¿Tienes agua de riego disponible durante la campaña?</li><li>¿Cómo está el suelo de tu chacra?</li><li>¿Qué variedad plantarás y en qué fecha?</li><li>¿Hay plagas, costos o mercado que debas considerar?</li></ul>
   <StatusMessage message="TERRA360 es una herramienta de orientación preliminar. No recomienda la siembra, ni estima cosechas o necesidades exactas de riego. Contrasta los datos con un técnico o una entidad agraria local."/>
   <p className="f-report-source">Fuentes: <a href="https://power.larc.nasa.gov/" target="_blank" rel="noreferrer">NASA POWER</a>; <a href="https://cgiar-climate-data-hub.github.io/catalog/ecocrop/" target="_blank" rel="noreferrer">FAO ECOCROP vía CGIAR</a>. Datos regionales; calidad y cobertura variables.</p>
  </div>
 </section>
}
export default function FarmerApp(){
 const [page,setPage]=useState<Page>('terreno')
 const [point,setPoint]=useState<Position|null>(null)
 const [referenceOnly,setReferenceOnly]=useState(false)
 const [polygon,setPolygon]=useState<Position[]|null>(null)
 const [fieldName,setFieldName]=useState('')
 const [days,setDays]=useState<14|30|90>(30)
 const [metric,setMetric]=useState<Metric>('rain')
 const [data,setData]=useState<ApiResult|null>(null)
 const [loading,setLoading]=useState(false)
 const [dataError,setDataError]=useState('')
 const [retry,setRetry]=useState(0)
 const [cropQuery,setCropQuery]=useState('')
 const [cropMatches,setCropMatches]=useState<CropItem[]>([])
 const [cropLoading,setCropLoading]=useState(false)
 const [cropError,setCropError]=useState('')
 const [selectedCrop,setSelectedCrop]=useState<CropItem|null>(null)
 const [guidance,setGuidance]=useState<Guidance|null>(null)
 const [guideLoading,setGuideLoading]=useState(false)
 const [guideError,setGuideError]=useState('')
 const [water,setWater]=useState<'unknown'|'yes'|'no'>('unknown')
 const [showAllCrops,setShowAllCrops]=useState(false)
 const [reportHelp,setReportHelp]=useState('')
 const guideEpoch=useRef(0)
 function go(next:Page){setPage(next);window.scrollTo({top:0,behavior:'smooth'})}
 function pick(p:Position,isReference:boolean){
  guideEpoch.current++;setGuideLoading(false);setGuidance(null);setGuideError('')
  setPoint(p);setReferenceOnly(isReference)
 }
 function chooseCrop(id:string,name:string){
  setSelectedCrop({id,name,scientific_name:'',category:'',description:''})
  setGuideError('')
  // Keep historical climate and candidate cards; the selected crop can change.
 }
 useEffect(()=>{
  const controller=new AbortController()
  if(!point){setData(null);setDataError('');setLoading(false);return()=>controller.abort()}
  setLoading(true);setDataError('');setData(null)
  const params=new URLSearchParams({latitude:String(point.lat),longitude:String(point.lng),start:safeDateUTC(days+1),end:safeDateUTC(2)})
  fetch(API+'/api/environment/nasa-power/daily?'+params,{signal:controller.signal})
   .then(async r=>{if(!r.ok)throw Error(await httpErrorMessage(r,false));return r.json()})
   .then((v:ApiResult)=>{if(!controller.signal.aborted)setData(v)})
   .catch(e=>{if(e.name!=='AbortError'&&!controller.signal.aborted)setDataError(readableApiError(e,false))})
   .finally(()=>{if(!controller.signal.aborted)setLoading(false)})
  return()=>controller.abort()
 },[point?.lat,point?.lng,days,retry])
 useEffect(()=>{
  const controller=new AbortController()
  if(page!=='cultivos'||cropQuery.trim().length<2){setCropMatches([]);setCropError('');setCropLoading(false);return()=>controller.abort()}
  setCropLoading(true);setCropError('')
  const timer=window.setTimeout(()=>{
   fetch(API+'/api/arie/crops?'+new URLSearchParams({query:cropQuery.trim(),limit:'12'}),{signal:controller.signal})
    .then(async r=>{if(!r.ok)throw Error(await httpErrorMessage(r,false));return r.json()})
    .then((v:{items:CropItem[]})=>{if(!controller.signal.aborted)setCropMatches(v.items||[])})
    .catch(e=>{if(e.name!=='AbortError'&&!controller.signal.aborted)setCropError(readableApiError(e,false))})
    .finally(()=>{if(!controller.signal.aborted)setCropLoading(false)})
  },280)
  return()=>{window.clearTimeout(timer);controller.abort()}
 },[cropQuery,page])
 async function getGuidance(id:string|null=selectedCrop?.id||null){
  if(!point){go('terreno');return}
  const epoch=++guideEpoch.current
  setGuideLoading(true);setGuideError('');setGuidance(null)
  const params=new URLSearchParams({latitude:String(point.lat),longitude:String(point.lng)})
  if(id)params.set('selected_crop',id)
  try{
   const r=await fetch(API+'/api/arie/crop-guidance?'+params)
   if(!r.ok)throw Error(await httpErrorMessage(r,false))
   const value=await r.json() as Guidance
   if(epoch===guideEpoch.current)setGuidance(value)
  }catch(e){if(epoch===guideEpoch.current)setGuideError(readableApiError(e,false))}
  finally{if(epoch===guideEpoch.current)setGuideLoading(false)}
 }
 const lastDate=data?.records?.[data.records.length-1]?.date||''
 const headline=page==='terreno'?'Tu terreno, más claro':page==='cultivos'?'Cultivos para mi zona':'Mi tablero e informe'
 const subhead=page==='terreno'?'Primero marca tu chacra. Después podrás revisar el clima y tus cultivos.':
  page==='cultivos'?'Puedes buscar un cultivo o explorar opciones. No necesitas elegir dos para continuar.':
  'Aquí está la información que puedes entender, revisar e imprimir.'
 return <div className="farmer-app">
  <header className="f-header"><div className="f-header-content">
   <button type="button" className="f-brand" onClick={()=>go('terreno')} aria-label="TERRA360 inicio"><span className="f-logo-mark">✳</span><span>TERRA<strong>360</strong><small>AGRICULTURA CON DATOS</small></span></button>
   <span className="f-pilot">Piloto · Huando, Huaral, Perú</span>
   <nav aria-label="Páginas principales" className="f-nav">
    {([['terreno','Mi terreno'],['cultivos','Cultivos para mi zona'],['resumen','Mi tablero']] as [Page,string][]).map(([id,label])=><button type="button" key={id} aria-current={page===id?'page':undefined} className={page===id?'active':''} onClick={()=>go(id)}>{label}</button>)}
   </nav>
  </div></header>
  <main className="f-main">
   <section className="f-hero"><div><span className="f-eyebrow">HECHO PARA AGRICULTORES DEL PERÚ</span><h1>{headline}</h1><p>{subhead}</p></div><div className="f-location"><span>Tu zona</span><strong>{point?(fieldName.trim()||'Punto elegido en Huaral'):'Huando, Huaral'}</strong><small>{point?(referenceOnly?'Referencia regional, no una chacra':'Ubicación aproximada marcada por ti'):'Elige dónde quieres consultar los datos'}</small></div></section>
   {page==='terreno'&&<>
    <div className="f-map-layout"><FarmerMap point={point} polygon={polygon} onPick={pick} onPolygon={setPolygon} lastDate={lastDate}/>
     <aside className="f-howto"><span className="f-eyebrow">ES MUY FÁCIL</span><h2>¿Cómo funciona?</h2>
      <div className="f-steps"><div><b>1</b><span><strong>Ubica tu chacra</strong><small>Toca un lugar en el mapa o dibuja su contorno.</small></span></div><div><b>2</b><span><strong>Revisa tus cultivos</strong><small>Busca uno por su nombre o explora opciones.</small></span></div><div><b>3</b><span><strong>Lee tu informe</strong><small>Consulta datos reales y guárdalos en PDF.</small></span></div></div>
      <label className="f-simple-label" htmlFor="f-field-name">¿Cómo llamas a tu chacra? (opcional)</label><input id="f-field-name" className="f-input" value={fieldName} maxLength={70} placeholder="Ej. Mi parcela" onChange={e=>setFieldName(e.target.value)}/>
      {point?<StatusMessage kind="good" message="Zona seleccionada. Puedes revisar información del clima."/>:<StatusMessage message="No seleccionamos ningún terreno por ti. El mapa inicia en Huando como referencia."/>}
      <button type="button" className="f-btn f-btn-primary f-btn-wide" disabled={!point} onClick={()=>go('cultivos')}>Ver cultivos para esta zona <span aria-hidden="true">→</span></button>
     </aside></div>
    {point&&<div className="f-preview-card"><div><h2>Un vistazo al clima</h2><p>Datos regionales estimados, no medidos en tu chacra.</p></div>{loading?<p>Consultando NASA POWER…</p>:data?<div className="f-preview-metrics"><span>Lluvia: <b>{number(computeClimate(data.records).rainTotal)} mm</b></span><span>Temperatura: <b>{number(computeClimate(data.records).temperature)} °C</b></span><button type="button" onClick={()=>go('resumen')}>Ver tablero completo</button></div>:<p>Consulta el mapa y vuelve a intentar si no aparecen datos.</p>}</div>}
    {dataError&&<StatusMessage message={dataError} kind="error"/>}
   </>}
   {page==='cultivos'&&<section className="f-crops-page">
    {!point?<div className="f-panel f-empty-focus"><h2>Primero elige dónde está tu terreno</h2><p>Necesitamos una ubicación para consultar los datos de NASA de esa zona.</p><button type="button" className="f-btn f-btn-primary" onClick={()=>go('terreno')}>Ir a mi terreno</button></div>:<>
    <div className="f-panel f-crop-start"><div><span className="f-eyebrow">2 · MIS CULTIVOS</span><h2>Encuentra tu cultivo por su nombre</h2><p>Elige un cultivo de la lista o escríbelo en el buscador. Con uno es suficiente para comenzar.</p></div>
     <div className="f-crop-pickers"><div className="f-manual-search"><label htmlFor="f-crop-search">¿Qué cultivo tienes o quieres sembrar?</label><input id="f-crop-search" className="f-input" type="search" value={cropQuery} onChange={e=>setCropQuery(e.target.value)} placeholder="Ej. tomate, camote, frijol"/>
       <div className="f-popular"><span>Buscar rápido:</span>{popular.map(([id,name])=><button type="button" key={id} onClick={()=>chooseCrop(id,name)}>{name}</button>)}</div>
       {cropLoading&&<p role="status">Buscando cultivos…</p>}{cropError&&<StatusMessage kind="error" message={cropError}/>}
       {cropMatches.length>0&&<ul className="f-crop-results">{cropMatches.map(item=><li key={item.id}><button type="button" onClick={()=>{chooseCrop(item.id,item.name);setCropQuery('');setCropMatches([])}}><strong>{item.name}</strong><span>Seleccionar</span></button></li>)}</ul>}
       {selectedCrop&&<div className="f-selected-crop"><span>Cultivo elegido: <strong>{selectedCrop.name}</strong></span><button type="button" onClick={()=>{setSelectedCrop(null);setGuidance(null)}}>Cambiar</button></div>}
     </div></div>
    </div>
    <div className="f-panel f-guidance-block"><div className="f-panel-title"><span className="f-eyebrow">OPCIONES PARA INVESTIGAR</span><h2>¿Qué cultivos podría revisar en esta zona?</h2><p>Usamos años completos de NASA POWER y referencias generales de FAO. Esto no comprueba si puedes sembrarlos en tu chacra.</p></div>
     <div className="f-water-prompt"><strong>¿Tu chacra tiene agua de riego?</strong><div role="group" aria-label="Agua de riego">{([['yes','Sí'],['no','No'],['unknown','No sé']] as const).map(([id,label])=><button type="button" key={id} className={water===id?'active':''} aria-pressed={water===id} onClick={()=>setWater(id)}>{label}</button>)}</div></div>
     {water==='no'&&<StatusMessage message="Sin riego, la lluvia disponible puede ser insuficiente para distintos cultivos. No uses estas opciones como indicación de siembra."/>}
     {water==='unknown'&&<StatusMessage message="Si aún no sabes cuánta agua de riego tienes, necesitaremos comprobarlo antes de tomar decisiones."/>}
     <button type="button" className="f-btn f-btn-primary" disabled={guideLoading} onClick={()=>void getGuidance()}>{guideLoading?'Revisando datos de varios años…':selectedCrop?'Revisar este cultivo y otras opciones':'Ver cultivos para investigar'}</button>
     {guideError&&<StatusMessage message={guideError} kind="error"/>}
     {guidance&&<><div className="f-evidence-summary"><strong>Datos regionales de {guidance.period.start_year} a {guidance.period.end_year}</strong><span>Temperatura media: {number(guidance.climate.temperature_mean_c)} °C</span><span>Lluvia anual media: {number(guidance.climate.annual_rain_mm)} mm</span><span>Años completos: {guidance.climate.complete_years}/5</span></div>
      {guidance.status==='insufficient_data'&&<StatusMessage message="No encontramos suficientes años completos. No se puede comparar el clima con las referencias de los cultivos."/>}
      <div className="f-candidates">{(showAllCrops?guidance.candidates:guidance.candidates.slice(0,6)).map(item=><CandidateCard key={item.id} item={item} selected={selectedCrop?.id===item.id} onChoose={chooseCrop}/>)}</div>
      {guidance.candidates.length>6&&<button type="button" className="f-btn f-btn-outline" onClick={()=>setShowAllCrops(v=>!v)}>{showAllCrops?'Mostrar menos cultivos':'Ver más cultivos'}</button>}
      {selectedCrop&&guidance.selected_crop?.id===selectedCrop.id&&!guidance.candidates.some(item=>item.id===guidance.selected_crop?.id)&&<div className="f-selected-guidance"><h3>Tu cultivo: {guidance.selected_crop.name}</h3><p>{guidance.selected_crop.reason}</p></div>}
      <StatusMessage message={guidance.limitation}/>
      <p className="f-small">Estas fichas se muestran en un orden fijo, no por rendimiento ni por aptitud. No se ha verificado la variedad, el suelo, el agua ni el calendario.</p>
     </>}
    </div>
    <div className="f-next-row"><button type="button" className="f-btn f-btn-outline" onClick={()=>go('terreno')}>Volver al mapa</button><button type="button" className="f-btn f-btn-primary" onClick={()=>go('resumen')}>Ver mi tablero e informe →</button></div>
    </>}
   </section>}
   {page==='resumen'&&<>{!point?<div className="f-panel f-empty-focus"><h2>Elige tu zona para comenzar</h2><p>Tu tablero se llena con los datos que consultemos. No mostraremos números inventados.</p><button className="f-btn f-btn-primary" type="button" onClick={()=>go('terreno')}>Elegir zona en el mapa</button></div>:
    <><FarmerDashboard data={data} loading={loading} metric={metric} onMetric={setMetric} days={days} onDays={setDays} guidance={guidance} selectedCrop={selectedCrop} referenceOnly={referenceOnly} fieldName={fieldName} onPrint={()=>{setReportHelp('En la ventana de impresión puedes elegir «Guardar como PDF» o tu impresora.');window.print()}} onRefresh={()=>setRetry(v=>v+1)}/>
    {dataError&&<StatusMessage kind="error" message={dataError}/>}
    {reportHelp&&<p className="f-print-help" role="status">{reportHelp}</p>}
    <div className="f-next-row f-hide-print"><button type="button" className="f-btn f-btn-outline" onClick={()=>go('cultivos')}>Revisar cultivos</button><button type="button" className="f-btn f-btn-primary" onClick={()=>window.print()}>Guardar este informe en PDF</button></div></>}</>}
  </main>
  <footer className="f-footer"><div><strong>TERRA360</strong><p>Información para comprender tu zona, no para reemplazar el consejo de un especialista agrario.</p></div><a href="/?vista=tecnica">Ver herramientas y datos técnicos</a></footer>
 </div>
}
