import {useEffect,useRef,useState} from 'react'
import {CircleMarker,Popup,Tooltip} from 'react-leaflet'
import type {GeoBox} from './AgriculturalSuitability'
import './agricultural-risks.css'

type Level='high'|'monitor'|'no_signal'|'insufficient_data'
type Hazard='drought'|'temperature'|'excess_rain'|'erosion'|'water_stress'
type Metric={label:string;label_en:string;value:number|null;unit:string;date:string|null}
type Alert={id:Hazard;name:string;name_en:string;level:Level;action:string;action_en:string;reason:string;reason_en:string;metrics:Metric[];coverage:{valid:number;expected:number;baseline_years:number|null};missing_factors?:string[]}
type RiskPoint={id:string;latitude:number;longitude:number;overall:Level;missing_hazards:number;alerts:Alert[]}
export type RiskReport={issued_at:string;expires_at:string;forecast_start:string;forecast_end:string;history_start:string;history_end:string;method_version:string;points:RiskPoint[];summary:Record<Hazard,Record<Level,number>>;sources:{id:string;name:string;url:string}[];attribution:string}
type Catalog={name:string;name_en:string;bbox:GeoBox;version:string;hazards:{id:Hazard;name:string;name_en:string}[];official_warnings_url:string;sources:{id:string;name:string;url:string}[]}
export type RiskFilter=Hazard|'all'
const levels:Level[]=['high','monitor','no_signal','insufficient_data']
const hazards:Hazard[]=['drought','temperature','excess_rain','erosion','water_stress']
const colors:Record<Level,string>={high:'#b2453e',monitor:'#bb8524',no_signal:'#4f7c87',insufficient_data:'#89939c'}
const labels:Record<Level,[string,string]>={high:['Revisión prioritaria','Priority review'],monitor:['Monitorear','Monitor'],no_signal:['Sin señal del indicador','No indicator signal'],insufficient_data:['Datos insuficientes','Insufficient data']}
const levelLabel=(level:Level,en:boolean)=>labels[level][en?1:0]
const dateLabel=(value:string,en:boolean)=>new Date(value.length===10?value+'T12:00:00-05:00':value).toLocaleDateString(en?'en-US':'es-PE',{timeZone:'America/Lima',day:'numeric',month:'short'})
const timeLabel=(value:string,en:boolean)=>new Date(value).toLocaleString(en?'en-US':'es-PE',{timeZone:'America/Lima',day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'})
export function riskLevel(point:RiskPoint,filter:RiskFilter):Level{return filter==='all'?point.overall:point.alerts.find(a=>a.id===filter)!.level}

export function RiskMarkers({report,filter,selected,onSelect,en}:{report:RiskReport;filter:RiskFilter;selected:string|null;onSelect:(id:string)=>void;en:boolean}){
 return <>{report.points.map(p=>{
  const level=riskLevel(p,filter)
  const shown=filter==='all'?p.alerts.filter(a=>['high','monitor'].includes(a.level)):p.alerts.filter(a=>a.id===filter)
  return <CircleMarker key={`${p.id}-${filter}-${en}`} center={[p.latitude,p.longitude]} radius={p.id===selected?15:11}
   pathOptions={{color:colors[level],fillColor:colors[level],fillOpacity:.8,weight:p.id===selected?4:2,bubblingMouseEvents:false}}
   eventHandlers={{click:()=>onSelect(p.id)}}>
   <Tooltip permanent direction="top" className="terra-risk-point-label">{p.id}</Tooltip>
   <Popup autoPan={false}><strong>{p.id} · {levelLabel(level,en)}</strong><p>{en?'Regional model point, not a field or a safe area.':'Punto de modelo regional, no parcela ni zona segura.'}</p>
    {shown.map(a=><p key={a.id}>{en?a.name_en:a.name}: {levelLabel(a.level,en)}</p>)}
    {p.missing_hazards>0&&<p>{en?'Some indicators lack sufficient data.':'Hay indicadores sin datos suficientes.'}</p>}
    <small>ERA5 {en?'through':'hasta'} {dateLabel(report.history_end,en)} · {en?'forecast':'pronóstico'} {dateLabel(report.forecast_start,en)}–{dateLabel(report.forecast_end,en)} · ~27 km</small>
   </Popup>
  </CircleMarker>
 })}</>
}

function validReport(value:any):value is RiskReport{
 return value&&Number.isFinite(Date.parse(value.issued_at))&&Number.isFinite(Date.parse(value.expires_at))
  && /^\d{4}-\d{2}-\d{2}$/.test(value.forecast_start)&&/^\d{4}-\d{2}-\d{2}$/.test(value.forecast_end)
  && Array.isArray(value.points)&&value.points.length===9&&new Set(value.points.map((p:any)=>p.id)).size===9
  && value.points.every((p:any)=>/^P0[1-9]$/.test(p.id)&&Number.isFinite(p.latitude)&&Number.isFinite(p.longitude)
   && p.latitude>=-13.875&&p.latitude<=-13.125&&p.longitude>=-72.5&&p.longitude<=-71.625&&levels.includes(p.overall)
   && Array.isArray(p.alerts)&&p.alerts.length===5&&new Set(p.alerts.map((a:any)=>a.id)).size===5
   && p.alerts.every((a:any)=>hazards.includes(a.id)&&levels.includes(a.level)&&Array.isArray(a.metrics)
    && a.metrics.every((m:any)=>m.value===null||Number.isFinite(m.value))&&Number.isFinite(a.coverage?.valid)&&Number.isFinite(a.coverage?.expected)))
  && hazards.every(h=>levels.every(l=>Number.isInteger(value.summary?.[h]?.[l])))
}

export function AgriculturalRisks({api,en,report,onReport,onFocus,filter,onFilter,selected,onSelect}:{api:string;en:boolean;report:RiskReport|null;onReport:(r:RiskReport|null)=>void;onFocus:(target:{bbox:GeoBox})=>void;filter:RiskFilter;onFilter:(v:RiskFilter)=>void;selected:string|null;onSelect:(id:string)=>void}){
 const [catalog,setCatalog]=useState<Catalog|null>(null)
 const [status,setStatus]=useState('loading')
 const [refresh,setRefresh]=useState(0)
 const request=useRef<AbortController|null>(null)
 useEffect(()=>{
  const controller=new AbortController();request.current=controller
  setStatus('loading');setCatalog(null);onReport(null)
  void Promise.all([fetch(api+'/api/agro/risks/catalog',{signal:controller.signal}),fetch(api+'/api/agro/risks/report',{signal:controller.signal})]).then(async responses=>{
   if(responses.some(r=>!r.ok))throw Error('unavailable')
   const [info,result]=await Promise.all(responses.map(r=>r.json()))
   if(controller.signal.aborted)return
   if(!Array.isArray(info.hazards)||info.hazards.length!==5||!Array.isArray(info.bbox))throw Error('invalid catalog')
   setCatalog(info);onFocus({bbox:info.bbox})
   if(result.status==='available'){
    if(!validReport(result.report))throw Error('invalid report')
    onReport(result.report)
    const priority=result.report.points.find((p:RiskPoint)=>p.overall==='high')||result.report.points.find((p:RiskPoint)=>p.overall==='monitor')||result.report.points[0]
    onSelect(priority.id)
   }else if(!['not_prepared','stale_report','invalid_report'].includes(result.status))throw Error('invalid status')
   setStatus(result.status)
  }).catch(()=>{if(!controller.signal.aborted){setStatus('error');onReport(null)}})
  return ()=>{controller.abort();onReport(null)}
 },[api,refresh,onReport,onFocus,onSelect])

 // An open tab must stop displaying alerts when the snapshot expires, too.
 useEffect(()=>{
  if(!report)return
  const expires=Math.min(Date.parse(report.expires_at),Date.parse(report.forecast_start+'T00:00:00-05:00'))
  const timer=window.setTimeout(()=>{onReport(null);setStatus('stale_report')},Math.max(0,expires-Date.now()))
  return ()=>window.clearTimeout(timer)
 },[report,onReport])
 const point=report?.points.find(p=>p.id===selected)
 const messages:Record<string,[string,string]>={
  not_prepared:['Aún no hay alertas preparadas para el piloto. No se puede evaluar el riesgo.','No alerts have been prepared for the pilot yet. Risk cannot be assessed.'],
  stale_report:['El informe venció. Las alertas volverán a estar disponibles cuando se actualicen los datos.','The report has expired. Alerts will become available when the inputs are updated.'],
  invalid_report:['No se pudo verificar el informe. No se muestran alertas con datos inválidos.','The report could not be verified. Alerts with invalid data are not displayed.'],
  error:['No pudimos consultar las alertas. Inténtalo de nuevo.','Could not retrieve alerts. Please try again.']
 }
 return <div className="terra-geo-reading terra-risks" aria-label={en?'Agricultural risk alerts':'Alertas de riesgo agrícola'}>
  <small>ECMWF / ERA5 · ~27 km · {en?'regional pilot':'piloto regional'}</small>
  <h3>{en?'Which areas need attention?':'¿Qué zonas requieren atención?'}</h3>
  <p>{en?'Nine model points around Cusco. These indicators help prioritize local checks; they are not official warnings or a continuous hazard map.':'Nueve puntos de modelo en torno a Cusco. Los indicadores ayudan a priorizar revisiones locales; no son avisos oficiales ni un mapa continuo de peligro.'}</p>
  {status==='loading'&&<p role="status">{en?'Checking dated inputs…':'Comprobando datos y vigencia…'}</p>}
  {messages[status]&&<p role="status" className="terra-risk-message">{messages[status][en?1:0]}</p>}
  <div className="terra-risk-actions"><button type="button" className="terra-geo-fetch" disabled={status==='loading'} onClick={()=>setRefresh(v=>v+1)}>{en?'Check again':'Volver a consultar'}</button>{catalog&&<button type="button" className="terra-risk-focus" onClick={()=>onFocus({bbox:catalog.bbox})}>{en?'View monitoring points':'Ver puntos del piloto'}</button>}</div>
  {report&&catalog&&<>
   <div className="terra-risk-period"><strong>{en?'Forecast':'Pronóstico'}: {dateLabel(report.forecast_start,en)}–{dateLabel(report.forecast_end,en)}</strong><span>{en?'Prepared':'Preparado'}: {timeLabel(report.issued_at,en)} · {en?'expires':'vence'}: {timeLabel(report.expires_at,en)} (Perú)</span><span>ERA5: {dateLabel(report.history_start,en)}–{dateLabel(report.history_end,en)} · {en?'7-day delay; reference':'7 días de retraso; referencia'} 1991–2020</span></div>
   <label className="terra-risk-filter">{en?'Risk on the map':'Riesgo en el mapa'}<select aria-label={en?'Risk on the map':'Riesgo en el mapa'} value={filter} onChange={e=>onFilter(e.target.value as RiskFilter)}><option value="all">{en?'All indicators · highest priority':'Todos · mayor prioridad'}</option>{catalog.hazards.map(h=><option key={h.id} value={h.id}>{en?h.name_en:h.name}</option>)}</select></label>
   <div className="terra-risk-legend" aria-label={en?'Alert legend':'Leyenda de alertas'}>{levels.map(l=><span key={l}><i style={{background:colors[l]}}/>{levelLabel(l,en)}</span>)}</div>
   <p className="terra-risk-caution">{en?'No indicator signal does not mean safe. Areas between points have not been classified.':'Sin señal del indicador no significa zona segura. Las áreas entre puntos no están clasificadas.'}</p>
   <div className="terra-risk-points" aria-label={en?'Monitoring points':'Puntos de monitoreo'}>{report.points.map(p=>{
    const level=riskLevel(p,filter)
    return <button type="button" key={p.id} aria-pressed={p.id===selected} onClick={()=>onSelect(p.id)} className={p.id===selected?'selected':''}><strong><i style={{background:colors[level]}}/>{p.id}</strong><small>{levelLabel(level,en)}</small></button>
   })}</div>
   {point&&<section className="terra-risk-detail" aria-label={en?'Selected monitoring point':'Punto de monitoreo seleccionado'}>
    <h4>{point.id} · {point.latitude.toFixed(2)}, {point.longitude.toFixed(2)}</h4>
    {point.missing_hazards>0&&<p>{en?'Some indicators cannot be assessed with the available data.':'Hay indicadores que no se pueden evaluar con los datos disponibles.'}</p>}
    {point.alerts.filter(a=>filter==='all'||a.id===filter).map(a=><article key={a.id} className={`terra-risk-card level-${a.level}`}>
     <div className="terra-risk-card-heading"><h4>{en?a.name_en:a.name}</h4><strong>{levelLabel(a.level,en)}</strong></div>
     <small>{a.id==='drought'?`${en?'Recent history':'Histórico reciente'}: ${dateLabel(report.history_start,en)}–${dateLabel(report.history_end,en)}`:a.id==='water_stress'?`${en?'Modeled soil water through':'Suelo modelado hasta'} ${dateLabel(report.history_end,en)} · ${en?'7-day forecast balance':'balance previsto de 7 días'}`:`${en?'Forecast':'Pronóstico'}: ${dateLabel(report.forecast_start,en)}–${dateLabel(report.forecast_end,en)}`}</small>
     {['high','monitor'].includes(a.level)?<p>{en?a.action_en:a.action}</p>:<p>{a.level==='insufficient_data'?(en?'Inputs are insufficient to assess this indicator.':'Faltan entradas suficientes para evaluar este indicador.'):(en?'The screening thresholds were not triggered in the available inputs. Continue local monitoring.':'Los umbrales no se activaron en las entradas disponibles. Mantén el seguimiento local.')}</p>}
     <dl>{a.metrics.map((m,i)=><div key={i}><dt>{en?m.label_en:m.label}{m.date?` · ${dateLabel(m.date,en)}`:''}</dt><dd>{m.value===null?'—':m.value.toLocaleString(en?'en-US':'es-PE',{maximumFractionDigits:m.unit==='m³/m³'?3:1})} {m.value===null?'':m.unit}</dd></div>)}</dl>
     <small>{en?'Input coverage':'Cobertura de entradas'}: {a.coverage.valid}/{a.coverage.expected}{a.coverage.baseline_years!==null?` · ${a.coverage.baseline_years}/30 ${en?'reference years':'años de referencia'}`:''}</small>
     <details><summary>{en?'Why this indicator?':'¿Cómo se calcula?'}</summary><p>{en?a.reason_en:a.reason}</p></details>
    </article>)}
   </section>}
  </>}
  {catalog&&<>
   <p className="terra-risk-official"><a href={catalog.official_warnings_url} target="_blank" rel="noreferrer">{en?'Consult official SENAMHI warnings':'Consultar avisos oficiales de SENAMHI'} ↗</a></p>
   <details className="terra-risk-method"><summary>{en?'Method and limits':'Método y límites'}</summary>
    <p>{en?'TERRA360 screening rules, without local calibration or a loss probability. A low 30-day rainfall percentile is a drought signal; it is not SPI. Temperature and rainfall thresholds are generic.':'Reglas de vigilancia TERRA360, sin calibración local ni probabilidad de pérdida. El percentil bajo de lluvia de 30 días es una señal de sequía; no es SPI. Los umbrales de temperatura y lluvia son generales.'}</p>
    <p>{en?'Soil water is modeled at 0–100 cm with a seven-day delay. ET₀−P describes atmospheric water demand, without crop coefficients or irrigation. Possible erosion uses forecast rain and the slope around a point; it does not calculate soil loss.':'El agua del suelo es modelada a 0–100 cm, con siete días de retraso. ET₀−P describe demanda climática de agua, sin coeficientes de cultivo ni riego. Posible erosión usa lluvia prevista y pendiente del entorno; no calcula pérdida de suelo.'}</p>
    <p>{en?'No planting prohibition, irrigation dose or safe area is inferred from these indicators.':'No se infiere una prohibición de siembra, dosis de riego ni zona segura a partir de estos indicadores.'}</p>
    <p>{catalog.sources.map((s,i)=><span key={s.id}>{i>0?' · ':''}<a href={s.url} target="_blank" rel="noreferrer">{s.name}</a></span>)}</p>
    {report&&<p>{report.attribution}</p>}
   </details>
  </>}
 </div>
}
