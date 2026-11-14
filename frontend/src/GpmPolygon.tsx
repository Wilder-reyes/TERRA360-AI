/** NASA IMERG 0.1° cell-overlap context, NEVER exact rain falling on a plot. */
import {useEffect,useMemo,useRef,useState} from 'react'
import type {Position} from './domain'
import {readableApiError,httpErrorMessage} from './network'
import './gpm-polygon.css'

type Cell={
 center_latitude:number;center_longitude:number;overlap_area_percent_approx:number;
 precipitation_mm_day:number|null;valid:boolean
}
type Result={
 status:string;date:string;source:string;source_url:string;unit:string;
 native_resolution:string;area_ha_approx:number;valid_area_percent_approx:number;
 grid_cell_count:number;valid_grid_cell_count?:number;precipitation_mm_day:number|null;
 cells:Cell[];quality_count_variable_used?:boolean;limitations:string[];
 used_in_crop_decision:false;can_infer_field_rainfall:false
}
const defaultDate=()=>{
 const d=new Date()
 d.setUTCDate(d.getUTCDate()-6)
 return d.toISOString().slice(0,10)
}
const maxDate=()=>{
 const d=new Date()
 d.setUTCDate(d.getUTCDate()-2)
 return d.toISOString().slice(0,10)
}

export function GpmPolygon({vertices,api,en}:{vertices:Position[]|null;api:string;en:boolean}){
 const [selectedDate,setSelectedDate]=useState(defaultDate)
 const [result,setResult]=useState<Result|null>(null)
 const [error,setError]=useState('')
 const [loading,setLoading]=useState(false)
 const pending=useRef<AbortController|null>(null)
 const key=useMemo(()=>JSON.stringify(vertices?.map(v=>[v.lng,v.lat])||null),[vertices])
 useEffect(()=>{pending.current?.abort();setResult(null);setError('');setLoading(false);return()=>pending.current?.abort()},[key,selectedDate])
 async function query(){
  if(!vertices||vertices.length<3)return
  pending.current?.abort()
  const abort=new AbortController()
  pending.current=abort
  setLoading(true);setResult(null);setError('')
  const positions=vertices.map(v=>[v.lng,v.lat])
  try{
   const response=await fetch(`${api}/api/environment/gpm-imerg/polygon-daily`,{
    method:'POST',headers:{'Content-Type':'application/json'},signal:abort.signal,
    body:JSON.stringify({polygon:{type:'Polygon',coordinates:[[...positions,positions[0]]]},
                         target_date:selectedDate}),
   })
   if(!response.ok){
    if(response.status===422)throw Error(en?'Area/date outside supported bounds.':'La fecha o el contorno están fuera de los límites permitidos.')
    throw Error(await httpErrorMessage(response,en))
   }
   const data=await response.json() as Result
   if(!abort.signal.aborted)setResult(data)
  }catch(e){if(!abort.signal.aborted)setError(readableApiError(e,en))}
  finally{if(!abort.signal.aborted)setLoading(false)}
 }
 return <section className="terra-geo-reading terra-gpm-polygon" aria-label={en?'GPM daily rainfall grid around outlined area':'Cuadrícula de lluvia GPM sobre el área delimitada'}>
  <small>NASA · GPM IMERG Late V07 · 0,1° (~10 km) · {en?'daily':'diario'}</small>
  <h3>{en?'Regional satellite rainfall around your outline':'Lluvia satelital regional sobre el contorno'}</h3>
  <p>{en?'This overlays your drawing with original coarse NASA grid cells. It cannot measure rainfall inside your actual field.':'Superpone el contorno con celdas originales y extensas de NASA. No mide la lluvia exacta dentro de tu terreno.'}</p>
  <label className="terra-gpm-date">
   {en?'Observation date (UTC)':'Fecha de observación (UTC)'}
   <input type="date" value={selectedDate} onChange={e=>setSelectedDate(e.target.value)} max={maxDate()}/>
  </label>
  <button type="button" className="terra-geo-fetch" disabled={!vertices||vertices.length<3||loading||!selectedDate} onClick={()=>void query()}>
   {loading?(en?'Checking NASA grid…':'Consultando cuadrícula NASA…'):(en?'Check regional rainfall':'Consultar lluvia regional')}
  </button>
  {!vertices||vertices.length<3?<p className="terra-gpm-warning" role="status">{en?'Draw a polygon or rectangle on the map first.':'Primero dibuja un polígono o rectángulo en el mapa.'}</p>:null}
  {error&&<p role="alert" className="terra-ndvi-error">{error}</p>}
  {result&&<div className="terra-gpm-result" role="status">
   {result.status==='data_unavailable'?<p className="terra-gpm-warning">{en?'No authorized NASA granule is staged on this server for the selected date. No rainfall value is available.':'No hay un archivo diario NASA autorizado y preparado en el servidor para la fecha elegida. No existe un valor de lluvia disponible.'}</p>:
    <><p><strong>{result.precipitation_mm_day!==null?`${result.precipitation_mm_day.toFixed(2)} mm/día`:(en?'No publishable rainfall estimate':'Sin estimación de lluvia publicable')}</strong></p>
      <p>{en?'Valid overlap area':'Superficie superpuesta válida'}: <b>{result.valid_area_percent_approx.toFixed(1)}%</b> · {en?'Grid cells':'Celdas'}: <b>{result.grid_cell_count}</b></p>
      {result.grid_cell_count===1&&<p className="terra-gpm-warning">{en?'One 0.1° cell: this is a single regional estimate for a much larger area.':'Una sola celda de 0,1°: se trata de una estimación regional sobre un territorio mucho más grande.'}</p>}
      {result.grid_cell_count>0&&<div className="terra-gpm-table-wrap"><table className="terra-gpm-table"><caption>{en?'Original overlapping grid cells':'Celdas originales superpuestas'}</caption><thead><tr><th scope="col">{en?'Grid center':'Centro de celda'}</th><th scope="col">{en?'Area overlap':'Superposición'}</th><th scope="col">{en?'Estimate':'Estimación'}</th></tr></thead><tbody>{result.cells.map(c=><tr key={`${c.center_latitude}:${c.center_longitude}`}><th scope="row">{c.center_latitude.toFixed(2)}, {c.center_longitude.toFixed(2)}</th><td>{c.overlap_area_percent_approx.toFixed(1)}%</td><td>{c.precipitation_mm_day===null?'—':`${c.precipitation_mm_day.toFixed(2)} mm/día`}</td></tr>)}</tbody></table></div>}
    </>}
   <p className="fineprint">{en?'The polygon overlap changes the weights, NOT the native satellite resolution. No sub-cell data are created. No estimate is invented when the archive is inaccessible.':'La superposición modifica los pesos, NO la resolución del satélite. No se crean datos dentro de cada celda ni estimaciones cuando no hay archivos disponibles.'}</p>
   <p className="fineprint">{en?'Values are not used to choose crops or prescribe irrigation.':'Estos valores no se usan para elegir cultivos ni indicar riego.'}</p>
   <p className="fineprint">{en?'Source':'Fuente'}: <a href={result.source_url} target="_blank" rel="noreferrer">NASA GPM IMERG Late V07</a></p>
  </div>}
 </section>
}
