/** Optional satellite scene catalog. This is NOT a vegetation/NDVI analysis. */
import {useEffect, useRef, useState} from 'react'
import {Icon} from './icons'
import type {Position} from './domain'

type Scene={date:string;cloud_cover_percent:number;satellite:string;scene_id:string}
type ScenesResult={source:string;source_url:string;status:string;scenes:Scene[];period:{start:string;end:string};used_in_crop_decision:boolean;limitations:string[]}
export function SatelliteScenes({point,language,api}:{point:Position|null;language:string;api:string}){
 const [result,setResult]=useState<ScenesResult|null>(null)
 const [error,setError]=useState('')
 const [loading,setLoading]=useState(false)
 const controller=useRef<AbortController|null>(null)
 const isEn=language==='en'
 useEffect(()=>{controller.current?.abort();setResult(null);setError('');setLoading(false);return()=>controller.current?.abort()},[point?.lat,point?.lng])
 async function load(){if(!point)return;controller.current?.abort();const ctrl=new AbortController();controller.current=ctrl;setLoading(true);setResult(null);setError('');try{
  const url=`${api}/api/environment/planetary-computer/scenes?latitude=${point.lat}&longitude=${point.lng}&days=120&cloud_limit=35&count=5`
  const response=await fetch(url,{signal:ctrl.signal})
  if(!response.ok)throw Error(isEn?'Satellite catalog unavailable. Try again later.':'No se pudo consultar el catálogo de imágenes. Inténtalo luego.')
  const json:ScenesResult=await response.json()
  if(!ctrl.signal.aborted)setResult(json)
 }catch(e){if(!ctrl.signal.aborted)setError(e instanceof Error?e.message:String(e))}finally{if(!ctrl.signal.aborted)setLoading(false)}}
 return <section className="satellite-panel" aria-label={isEn?'Satellite scenes':'Imágenes satelitales'}>
  <div className="satellite-panel-heading"><div><h3><Icon name="layers" size={18}/> {isEn?'Are there satellite images of my area?':'¿Hay imágenes satelitales de mi zona?'}</h3><p>{isEn?'Find recent Sentinel-2 observations. We do not diagnose crops from these dates alone.':'Consulta fechas de imágenes Sentinel-2 disponibles. Las fechas por sí solas no indican cómo están tus cultivos.'}</p></div><button type="button" className="satellite-load" disabled={!point||loading} onClick={load}>{loading?(isEn?'Checking…':'Buscando…'):(isEn?'Find images':'Buscar imágenes')}</button></div>
  {!point&&<p className="fineprint">{isEn?'Select a point on the map first.':'Primero elige un punto en el mapa.'}</p>}
  {error&&<p role="alert" className="satellite-error">{error}</p>}
  {result&&<div role="status" className="satellite-scenes">
   {result.scenes.length===0?<p>{isEn?'No low-cloud scenes appeared in this limited search. Try another period later.':'No aparecieron imágenes con poca nubosidad en esta búsqueda limitada. Puedes probar más adelante.'}</p>:<>
    <p>{isEn?'Recent satellite images with limited cloud cover:':'Imágenes recientes con nubosidad limitada:'}</p>
    <ul>{result.scenes.map(s=><li key={s.scene_id}><strong>{s.date}</strong><span>{s.satellite} · {isEn?'Cloud cover':'Nubes en imagen'}: {s.cloud_cover_percent}%</span></li>)}</ul>
   </>}
   <p className="fineprint">{isEn?'Source: ESA Sentinel-2, through Microsoft Planetary Computer. Cloud coverage is for the full scene, not just your field. No vegetation index was calculated and these images do not influence the crop recommendation.':'Fuente: ESA Sentinel-2 mediante Microsoft Planetary Computer. Las nubes corresponden a la imagen completa, no solo a tu terreno. No se calculó el estado de la vegetación ni se utilizaron estas imágenes para recomendar cultivos.'} <a target="_blank" rel="noreferrer" href={result.source_url}>{isEn?'Data source':'Ver fuente'}</a></p>
  </div>}
 </section>
}
