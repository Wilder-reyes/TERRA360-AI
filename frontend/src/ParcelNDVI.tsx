/** Real ESA Sentinel-2 parcel NDVI, separate from NASA MODIS visual tiles. */
import {useEffect,useMemo,useRef,useState} from 'react'
import type {Position} from './domain'
import {readableApiError,httpErrorMessage} from './network'
import './parcel-ndvi.css'
import {SentinelSeries} from './SentinelSeries'

type Stats={mean:number;median:number;p10:number;p90:number;spatial_std:number;min:number;max:number}
type Metrics={
 status:'available'|'insufficient_clear_pixels'|'no_spatial_coverage';
 parcel_pixels:number;valid_pixels:number;valid_fraction_percent:number;
 scene_coverage_percent_approx:number;scl_classes_within_parcel:Record<string,number>;ndvi:Stats|null;
}
type ParcelResult={
 status:string;source:string;source_url:string;product:string;scene:{id:string;date:string;cloud_cover_percent_scene:number;processing_baseline:string;platform:string}|null;
 parcel_area_ha_approx:number;attempted_scenes:number;
 metrics:Metrics|null;uncertainty:string[];used_in_crop_decision:false;
}
function message(status:string,en:boolean){
 if(status==='no_matching_scenes')return en?'No scenes passed this limited catalog search. This does not prove there are no images.':'No se encontraron escenas dentro de los filtros. Esto no demuestra que no existan imágenes.'
 if(status==='processing_unavailable')return en?'The scene files could not be read. Try again later.':'No fue posible leer los archivos satelitales. Intenta nuevamente más tarde.'
 if(status==='no_spatial_coverage')return en?'The selected scene does not cover enough of the outlined plot.':'La escena seleccionada no cubre suficientemente el terreno.'
 if(status==='insufficient_clear_pixels')return en?'Too few reliable pixels: no NDVI average is reported.':'No hay suficientes píxeles confiables; no mostramos un promedio NDVI.'
 return en?'No reliable image result was available.':'No se obtuvo un resultado satelital confiable.'
}
export function ParcelNDVI({vertices,api,en}:{vertices:Position[]|null;api:string;en:boolean}){
 const [result,setResult]=useState<ParcelResult|null>(null)
 const [error,setError]=useState('')
 const [busy,setBusy]=useState(false)
 const request=useRef<AbortController|null>(null)
 const signature=useMemo(()=>JSON.stringify(vertices?.map(p=>[p.lng,p.lat])||null),[vertices])
 useEffect(()=>{request.current?.abort();setResult(null);setError('');setBusy(false);return()=>request.current?.abort()},[signature])
 async function calculate(){
  if(!vertices||vertices.length<3)return
  request.current?.abort()
  const ctrl=new AbortController();request.current=ctrl
  setBusy(true);setResult(null);setError('')
  const coords=vertices.map(p=>[p.lng,p.lat])
  try{
   const response=await fetch(`${api}/api/environment/sentinel-2/parcel-ndvi`,{
    method:'POST',headers:{'Content-Type':'application/json'},signal:ctrl.signal,
    body:JSON.stringify({polygon:{type:'Polygon',coordinates:[[...coords,coords[0]]]},days:120,cloud_limit:65})
   })
   if(!response.ok){
    if(response.status===422)throw Error(en?'Plot is outside the supported area (0.1–500 ha) or has invalid corners.':'El contorno no es válido o está fuera del área admitida (0,1–500 ha).')
    throw Error(await httpErrorMessage(response,en))
   }
   const data:ParcelResult=await response.json()
   if(!ctrl.signal.aborted)setResult(data)
  }catch(err){if(!ctrl.signal.aborted)setError(readableApiError(err,en))}
  finally{if(!ctrl.signal.aborted)setBusy(false)}
 }
 const metrics=result?.metrics
 const v=metrics?.ndvi
 return <div className="terra-geo-reading terra-ndvi-reading" aria-label={en?'Sentinel-2 analysis for outlined plot':'Análisis Sentinel-2 del terreno delimitado'}>
  <small>ESA/Copernicus · Sentinel-2 L2A · {en?'10 m bands / 20 m quality mask':'bandas 10 m / máscara de calidad 20 m'}</small>
  <h3>{en?'Vegetation index in your outlined area':'Índice de vegetación del área delimitada'}</h3>
  <p>{en?'This is a measured spectral index for a satellite scene. It does not diagnose crop health, crop suitability, irrigation or yield.':'Este es un índice espectral de una escena satelital. No diagnostica salud del cultivo, aptitud, riego ni rendimiento.'}</p>
  {!vertices||vertices.length<3?<p className="terra-ndvi-setup" role="status">{en?'Draw a rectangle or polygon on the map first, then run the analysis. A single location pin is not a field.':'Primero delimita un rectángulo o polígono en el mapa y luego consulta el índice. Un punto solo no representa una parcela.'}</p>:<>
   <button className="terra-geo-fetch" type="button" disabled={busy} onClick={()=>void calculate()}>{busy?(en?'Reading satellite pixels…':'Leyendo píxeles satelitales…'):(en?'Calculate parcel NDVI':'Calcular NDVI del terreno')}</button>
   <p className="fineprint">{en?'Only a small portion of each satellite image is read. Data access may be throttled.':'Se lee únicamente una pequeña parte de la imagen; el proveedor puede limitar las consultas.'}</p>
  </>}
  {error&&<p role="alert" className="terra-ndvi-error">{error}</p>}
  {result&&<div className="terra-ndvi-result" role="status">
   {result.scene&&<p><strong>{en?'Image date':'Fecha de imagen'}: {result.scene.date}</strong><span>{en?'Whole-scene cloud cover':'Nubosidad de toda la escena'}: {result.scene.cloud_cover_percent_scene.toFixed(1)}%</span></p>}
   {v?<><div className="terra-ndvi-number"><strong>{v.mean.toFixed(3)}</strong><span>{en?'Mean NDVI (unitless)':'NDVI promedio (sin unidades)'}</span></div>
    <div className="terra-ndvi-stats"><span>{en?'Median':'Mediana'}: <b>{v.median.toFixed(3)}</b></span><span>{en?'Spatial variation p10–p90':'Variación espacial p10–p90'}: <b>{v.p10.toFixed(3)} a {v.p90.toFixed(3)}</b></span></div>
   </>:<p className="terra-ndvi-no-result">{message(result.status,en)}</p>}
   {metrics&&<div className="terra-ndvi-stats"><span>{en?'Usable pixels':'Píxeles utilizables'}: <b>{metrics.valid_pixels}</b></span><span>{en?'Approximate usable coverage':'Cobertura utilizable aproximada'}: <b>{metrics.valid_fraction_percent.toFixed(1)}%</b></span><span>{en?'Scene coverage':'Cobertura aproximada de la escena'}: <b>{metrics.scene_coverage_percent_approx.toFixed(1)}%</b></span></div>}
   <p className="fineprint">{en?'Approximate outlined area':'Superficie aproximada'}: {result.parcel_area_ha_approx.toLocaleString(en?'en-US':'es-PE')} ha. {en?'SCL excludes clouds, shadows, snow, water and uncertain pixels.':'La máscara SCL excluye nubes, sombras, nieve, agua y píxeles dudosos.'}</p>
   <p className="fineprint">{en?'The range describes spatial variation, NOT a measurement accuracy or confidence interval. The boundary is not surveyed and local field validation is required.':'El rango describe variación espacial, NO precisión ni intervalo de confianza. El contorno no está levantado catastralmente; hace falta validación en campo.'}</p>
   <p className="fineprint">{en?'Source':'Fuente'}: <a href={result.source_url} target="_blank" rel="noreferrer">Sentinel-2 L2A · Microsoft Planetary Computer</a>. {en?'Not used to recommend crops.':'No se utiliza para recomendar cultivos.'}</p>
  </div>}
  <SentinelSeries vertices={vertices} api={api} en={en}/>
 </div>
}
