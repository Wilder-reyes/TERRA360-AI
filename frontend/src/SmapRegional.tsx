/** NASA NSIDC native 9-km DCA soil moisture: never field-scale. */
import {useEffect,useMemo,useRef,useState} from 'react'
import type {Position} from './domain'
import {readableApiError,httpErrorMessage} from './network'
import './smap-regional.css'

type Result={
 status:string;date:string;source_url:string;unit:string;native_resolution_m:number;
 soil_moisture_m3_m3:number|null;
 cell:{distance_from_requested_center_km:number;retrieval_quality_flag_dca:number}|null;
 used_in_crop_decision:false;can_infer_field_soil_moisture:false
}
const sixDaysAgo=()=>{
 const d=new Date();d.setUTCDate(d.getUTCDate()-6);return d.toISOString().slice(0,10)
}
export function SmapRegional({vertices,api,en}:{vertices:Position[]|null;api:string;en:boolean}){
 const [day,setDay]=useState(sixDaysAgo)
 const [result,setResult]=useState<Result|null>(null)
 const [error,setError]=useState('')
 const [loading,setLoading]=useState(false)
 const request=useRef<AbortController|null>(null)
 const key=useMemo(()=>JSON.stringify(vertices?.map(p=>[p.lng,p.lat])||null),[vertices])
 useEffect(()=>{request.current?.abort();setResult(null);setError('');setLoading(false);return()=>request.current?.abort()},[key,day])
 async function query(){
  if(!vertices||vertices.length<3)return
  request.current?.abort()
  const ctrl=new AbortController();request.current=ctrl
  const coords=vertices.map(p=>[p.lng,p.lat])
  setLoading(true);setResult(null);setError('')
  try{
   const res=await fetch(`${api}/api/environment/smap/regional-daily`,{
    method:'POST',headers:{'Content-Type':'application/json'},signal:ctrl.signal,
    body:JSON.stringify({polygon:{type:'Polygon',coordinates:[[...coords,coords[0]]]},target_date:day})
   })
   if(!res.ok)throw Error(await httpErrorMessage(res,en))
   const data:Result=await res.json()
   if(!ctrl.signal.aborted)setResult(data)
  }catch(err){if(!ctrl.signal.aborted)setError(readableApiError(err,en))}
  finally{if(!ctrl.signal.aborted)setLoading(false)}
 }
 return <section className="terra-geo-reading terra-smap-regional" aria-label={en?'Regional SMAP 9 km soil moisture':'Humedad regional SMAP de 9 km'}>
  <small>NASA / NSIDC · SPL3SMP_E V006 · 9 km · AM / DCA</small>
  <h3>{en?'Regional surface soil moisture':'Humedad superficial regional del suelo'}</h3>
  <p>{en?'An original satellite 9 km grid cell, NOT a sensor inside the outlined field.':'Celda satelital original de 9 km, NO un sensor dentro de la parcela.'}</p>
  <label className="terra-smap-date">{en?'Date (UTC)':'Fecha (UTC)'}<input type="date" value={day} onChange={e=>setDay(e.target.value)} max={sixDaysAgo()}/></label>
  <button type="button" className="terra-geo-fetch" disabled={!vertices||vertices.length<3||loading||!day} onClick={()=>void query()}>
   {loading?(en?'Checking authorized SMAP…':'Consultando SMAP autorizado…'):(en?'Read regional SMAP cell':'Consultar celda regional SMAP')}
  </button>
  {!vertices||vertices.length<3?<p role="status">{en?'Draw an area on the map first.':'Primero delimita un área en el mapa.'}</p>:null}
  {error&&<p role="alert" className="terra-ndvi-error">{error}</p>}
  {result&&<div role="status" className="terra-smap-result">
   {result.soil_moisture_m3_m3===null?
    <p className="terra-smap-warning">{result.status==='data_unavailable'?
     (en?'No authorized SMAP file is available on the server for this date.':'No hay un archivo SMAP autorizado en el servidor para esta fecha.'):
     (en?'The native cell failed quality checks or is out of coverage.':'La celda no pasó los controles de calidad o está fuera de cobertura.')}</p>:
    <><p><strong>{result.soil_moisture_m3_m3.toFixed(3)} m³/m³</strong> · {en?'9 km cell':'celda de 9 km'}</p>
      <p>{en?'Quality flag':'Bandera de calidad'}: <b>{result.cell?.retrieval_quality_flag_dca}</b> · {en?'Distance':'Distancia'}: <b>{result.cell?.distance_from_requested_center_km} km</b></p>
    </>}
   <p className="fineprint">{en?'SMAP estimates soil moisture over the top 5 cm of a region. It cannot prescribe field irrigation or crop suitability.':'SMAP estima humedad superficial regional (aprox. 5 cm). No determina el riego ni la aptitud del cultivo en tu terreno.'}</p>
   <p className="fineprint"><a href={result.source_url} target="_blank" rel="noreferrer">NASA NSIDC · DOI 10.5067/M20OXIZHY3RJ</a></p>
  </div>}
 </section>
}
