/** Raw 5-arcminute FAO GAEZ v5 cell code: NOT a crop suitability % or advice. */
import {useEffect,useMemo,useRef,useState} from 'react'
import type {Position} from './domain'
import {readableApiError,httpErrorMessage} from './network'
import './gaez-raw.css'

type RawCell={
 status:string;variable_code:string;crop:string;period:string;management:string;
 inspected_sha256:string;source_raster_url:string;source_dataset_license_url:string;
 original_cell_class_code:number|null;
 cell_center_lon_lat:[number,number]|null;
 native_grid_resolution_degrees:number;
 suitability_index:null;used_in_crop_decision:false;
 interpretation_status:string;
 limitations:string[]
}

export function GaezRaw({vertices,api,en}:{vertices:Position[]|null;api:string;en:boolean}){
 const [result,setResult]=useState<RawCell|null>(null)
 const [error,setError]=useState('')
 const [busy,setBusy]=useState(false)
 const controller=useRef<AbortController|null>(null)
 const key=useMemo(()=>JSON.stringify(vertices?.map(p=>[p.lng,p.lat])||null),[vertices])
 useEffect(()=>{controller.current?.abort();setResult(null);setError('');setBusy(false);return()=>controller.current?.abort()},[key])
 async function load(){
  if(!vertices||vertices.length<3)return
  controller.current?.abort()
  const abort=new AbortController();controller.current=abort
  setBusy(true);setResult(null);setError('')
  try{
   const positions=vertices.map(v=>[v.lng,v.lat])
   const response=await fetch(`${api}/api/environment/gaez-v5/selected-layer/raw-cell`,{
    method:'POST',signal:abort.signal,headers:{'Content-Type':'application/json'},
    body:JSON.stringify({polygon:{type:'Polygon',coordinates:[[...positions,positions[0]]]}})
   })
   if(!response.ok)throw Error(await httpErrorMessage(response,en))
   const data=await response.json() as RawCell
   if(!abort.signal.aborted)setResult(data)
  }catch(err){if(!abort.signal.aborted)setError(readableApiError(err,en))}
  finally{if(!abort.signal.aborted)setBusy(false)}
 }
 return <section className="terra-geo-reading terra-gaez-raw" aria-label={en?'Original FAO GAEZ v5 cell code':'Código de celda original FAO GAEZ v5'}>
  <small>FAO / IIASA · GAEZ v5 · RES05-SIX · 2001–2020 · 5′ (~9 km)</small>
  <h3>{en?'Historical cassava suitability dataset':'Conjunto de datos histórico de aptitud de yuca'}</h3>
  <p>{en?'Original FAO index-class raster, historical rainfed low-input scenario. The numerical class encoding has not been scientifically decoded for planting decisions.':'Raster original FAO del índice de clases, periodo histórico y secano con bajos insumos. La codificación numérica aún no está interpretada científicamente para decisiones de siembra.'}</p>
  <button type="button" className="terra-geo-fetch" disabled={!vertices||vertices.length<3||busy} onClick={()=>void load()}>
   {busy?(en?'Reading original FAO raster…':'Leyendo raster original FAO…'):(en?'Inspect regional FAO cell':'Consultar celda regional FAO')}
  </button>
  {!vertices||vertices.length<3?<p role="status">{en?'Draw a polygon or rectangle first.':'Primero delimita un rectángulo o polígono en el mapa.'}</p>:null}
  {error&&<p role="alert" className="terra-ndvi-error">{error}</p>}
  {result&&<div role="status" className="terra-gaez-raw-result">
   {result.status==='raw_code_available'&&result.original_cell_class_code!==null?
    <p className="terra-gaez-raw-number">{en?'Original FAO cell code':'Código original de celda FAO'}: <strong>{result.original_cell_class_code}</strong> <small>{en?'(not a %)':'(no es un %)'}</small></p>:
    <p className="terra-gaez-raw-warning">{en?'No valid index-class code in this grid cell.':'No existe un código de clase válido en esta celda.'}</p>}
   <p className="fineprint">{en?'Each grid cell covers a broad region. No parcel-specific planting recommendation, yield estimate or crop-health claim is made.':'Cada celda representa una región extensa. No se genera ninguna recomendación de siembra, estimación de rendimiento ni diagnóstico para la parcela.'}</p>
   <p className="fineprint">{en?'Source':'Fuente'}: <a href={result.source_raster_url} target="_blank" rel="noreferrer">FAO/IIASA GAEZ v5</a> · <a href={result.source_dataset_license_url} target="_blank" rel="noreferrer">{en?'Dataset license':'Licencia del conjunto'} CC BY 4.0</a></p>
  </div>}
 </section>
}
