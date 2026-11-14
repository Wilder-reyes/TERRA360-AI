/** Sparse ESA Sentinel-2 observations; NOT a growth trend or agronomic diagnosis. */
import {useEffect,useMemo,useRef,useState} from 'react'
import type {Position} from './domain'
import {readableApiError,httpErrorMessage} from './network'
import './sentinel-series.css'

type Metrics={valid_pixels:number;valid_fraction_percent:number;
 ndvi:{mean:number;median:number;p10:number;p90:number}|null}
type Observation={
 date:string;scene_id:string;satellite:string;scene_cloud_percent:number;
 processing_baseline:string|null;status:string;metrics:Metrics|null
}
type Response={
 status:string;period:{start:string;end:string};observations:Observation[];
 valid_observation_count:number;attempted_scenes:number;parcel_area_ha_approx:number;
 source_url:string;can_infer_vegetation_trend:false;used_in_crop_decision:false;
 limitations:string[]
}

function statusText(state:string,en:boolean){
 if(state==='available')return en?'Valid reading':'Lectura válida'
 if(state==='insufficient_clear_pixels')return en?'Not enough clear pixels':'Faltan píxeles claros'
 if(state==='no_spatial_coverage')return en?'Outside raster coverage':'Fuera de cobertura'
 return en?'Image unavailable':'Imagen no disponible'
}

export function SentinelSeries({vertices,api,en}:{vertices:Position[]|null;api:string;en:boolean}){
 const [data,setData]=useState<Response|null>(null)
 const [error,setError]=useState('')
 const [busy,setBusy]=useState(false)
 const pending=useRef<AbortController|null>(null)
 const key=useMemo(()=>JSON.stringify(vertices?.map(p=>[p.lng,p.lat])||null),[vertices])
 useEffect(()=>{pending.current?.abort();setData(null);setError('');setBusy(false);return()=>pending.current?.abort()},[key])
 async function load(){
  if(!vertices||vertices.length<3)return
  pending.current?.abort()
  const control=new AbortController();pending.current=control
  setBusy(true);setData(null);setError('')
  const ring=vertices.map(p=>[p.lng,p.lat])
  try{
   const response=await fetch(`${api}/api/environment/sentinel-2/parcel-ndvi-series`,{
    method:'POST',headers:{'Content-Type':'application/json'},signal:control.signal,
    body:JSON.stringify({polygon:{type:'Polygon',coordinates:[[...ring,ring[0]]]},
                         days:180,cloud_limit:60,max_observations:4})
   })
   if(!response.ok){
    if(response.status===422)throw new Error(en?'The outlined plot is outside supported area limits.':'El terreno delimitado supera los límites del análisis.')
    throw Error(await httpErrorMessage(response,en))
   }
   const result=await response.json() as Response
   if(!control.signal.aborted)setData(result)
  }catch(e){if(!control.signal.aborted)setError(readableApiError(e,en))}
  finally{if(!control.signal.aborted)setBusy(false)}
 }
 return <section className="terra-ndvi-series" aria-label={en?'Satellite observations on separate dates':'Observaciones satelitales de distintas fechas'}>
  <h4>{en?'Compare observations from different dates':'Comparar observaciones de distintas fechas'}</h4>
  <p>{en?'We check up to four usable scenes over 180 days. Every date has its own cloud mask, real pixel count and data coverage.':'Revisamos hasta cuatro escenas utilizables de 180 días. Cada fecha tiene su propia máscara de nubes, cantidad de píxeles y cobertura de datos.'}</p>
  <button type="button" className="terra-geo-fetch" disabled={!vertices||vertices.length<3||busy} onClick={()=>void load()}>
   {busy?(en?'Checking multiple scenes…':'Procesando varias imágenes…'):(en?'View observations by date':'Ver observaciones por fecha')}
  </button>
  {error&&<p role="alert" className="terra-ndvi-error">{error}</p>}
  {data&&<div className="terra-ndvi-series-result" role="status">
   <p className="terra-ndvi-series-summary">{en?'Usable dates':'Fechas utilizables'}: <strong>{data.valid_observation_count}</strong> / {data.attempted_scenes} {en?'scenes examined':'escenas examinadas'}. {data.period.start} — {data.period.end}.</p>
   {data.valid_observation_count<2&&<p className="terra-ndvi-series-warning">{en?'There are not enough usable dates for a meaningful comparison.':'No hay suficientes fechas utilizables para una comparación significativa.'}</p>}
   {data.observations.length?(
    <div className="terra-ndvi-table-scroll">
     <table className="terra-ndvi-series-table">
      <caption>{en?'NDVI for individual, quality-filtered scenes':'NDVI por escena individual filtrada por calidad'}</caption>
      <thead><tr><th scope="col">{en?'Date':'Fecha'}</th><th scope="col">NDVI</th><th scope="col">{en?'Usable coverage':'Cobertura válida'}</th><th scope="col">{en?'Quality':'Calidad'}</th></tr></thead>
      <tbody>{data.observations.map(item=>{
       const ndvi=item.status==='available'?item.metrics?.ndvi:null
       return <tr key={item.scene_id}>
        <th scope="row">{item.date}</th>
        <td className="terra-ndvi-table-number">{ndvi?ndvi.mean.toFixed(3):'—'}</td>
        <td>{item.metrics?`${item.metrics.valid_fraction_percent.toFixed(1)}%`:'—'}</td>
        <td><span className={ndvi?'terra-ndvi-quality-pass':'terra-ndvi-quality-missing'}>{statusText(item.status,en)}</span></td>
       </tr>
      } )}</tbody>
     </table>
    </div>):<p>{en?'No matching scenes appeared in this limited satellite search.':'No se encontraron escenas en esta búsqueda limitada.'}</p>}
   <p className="fineprint">{en?'A date with “—” has NO publishable NDVI; it is not zero. Only center-pixel approximate coverage is reported.':'Una fecha con «—» NO tiene NDVI publicable; no equivale a cero. La cobertura se aproxima mediante centros de píxeles.'}</p>
   <p className="fineprint">{en?'Different dates may contain different clear pixels, crop stages, harvest events and atmospheric conditions. These numbers do NOT establish a trend, yield, stress or crop health.':'Las fechas pueden incluir distintos píxeles despejados, etapas del cultivo, cosechas y condiciones atmosféricas. Estos valores NO demuestran una tendencia, rendimiento, estrés ni salud del cultivo.'}</p>
   <p className="fineprint"><a href={data.source_url} target="_blank" rel="noreferrer">{en?'ESA/Copernicus source and catalog':'Fuente y catálogo ESA/Copernicus'}</a> · {en?'Not used by ARIE':'No usado por ARIE'}</p>
  </div>}
 </section>
}
