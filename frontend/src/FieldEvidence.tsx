/** Optional scientific tools within Mi terreno. Results never confirm crops. */
import {useEffect,useRef,useState} from 'react'
import {API,httpErrorMessage,readableApiError} from './network'
import {type ApiResult} from './domain'
import {qualityForDaily,summaryForDaily} from './scientificEvidence'
import type {GeoPolygon} from './rotationZones'
import {ParcelNDVI} from './ParcelNDVI'
import {GpmPolygon} from './GpmPolygon'
import {SmapRegional} from './SmapRegional'
import {GaezRaw} from './GaezRaw'
import './field-evidence.css'
import {SatelliteScenes} from './SatelliteScenes'

export default function FieldEvidence({polygon,lang,andes}:{polygon:GeoPolygon;lang:'es'|'en';andes:boolean}){
 const en=lang==='en'
 const vertices=polygon.coordinates[0].slice(0,-1).map(([lng,lat])=>({lat,lng}))
 const point={lat:vertices.reduce((s,p)=>s+p.lat,0)/vertices.length,lng:vertices.reduce((s,p)=>s+p.lng,0)/vertices.length}
 const epoch=useRef(0)
 useEffect(()=>()=>{epoch.current++},[])
 const [daily,setDaily]=useState<ApiResult|null>(null)
 const [context,setContext]=useState<Record<string,Record<string,unknown>>>({})
 const [busy,setBusy]=useState(false)
 const [error,setError]=useState('')
 const [year,setYear]=useState(new Date().getUTCFullYear()-1)
 const dailyQuality=daily?qualityForDaily(daily.records,daily.period.start,daily.period.end,daily.quality):null
 const climate=daily&&dailyQuality?summaryForDaily(daily.records,dailyQuality):null
 const value=(v:unknown,d=1)=>typeof v==='number'&&Number.isFinite(v)?v.toFixed(d):'—'
 async function query(){
  const token=++epoch.current
  setBusy(true);setError('');setDaily(null);setContext({})
  const params=`latitude=${point.lat}&longitude=${point.lng}`
  const urls=[['terrain',`/api/environment/terrain?${params}`],['power',`/api/rotation/climate?${params}`]]
  if(andes)urls.push(['era5',`/api/andes/era5-land?${params}&year=${year}`],['ecostress',`/api/andes/ecostress-scenes?${params}`])
  const entries=await Promise.allSettled(urls.map(async([key,url])=>{
   const r=await fetch(API+url);if(!r.ok)throw Error(await httpErrorMessage(r,en));return [key,await r.json()] as const
  }))
  const data:Record<string,Record<string,unknown>>={}
  entries.forEach(r=>{if(r.status==='fulfilled')data[r.value[0]]=r.value[1]})
  if(epoch.current!==token)return
  setContext(data)
  try{
   const r=await fetch(API+`/api/environment/nasa-power/daily?${params}&start=${year}-01-01&end=${year}-12-31`)
   if(!r.ok)throw Error(await httpErrorMessage(r,en))
   const d=await r.json() as ApiResult;if(!Array.isArray(d.records))throw Error('Invalid climate response')
   if(epoch.current!==token)return
   setDaily(d)
  }catch(e){if(epoch.current!==token)return;setError(readableApiError(e,en))}
  if(epoch.current!==token)return
  if(entries.some(r=>r.status==='rejected'))setError(en?'Some sources are unavailable. Missing values remain unknown.':'Alguna fuente no está disponible. Los valores faltantes siguen siendo desconocidos.')
  setBusy(false)
 }
 return <details className="b-technical b-field-evidence"><summary>{en?'Environmental data and satellite tools (optional)':'Datos ambientales y satélite (opcional)'}</summary>
  <p>{en?'Regional context and quality-controlled pixel tools. These values are not field instruments or crop identification.':'Contexto regional y herramientas con control de píxeles. Estos valores no son mediciones de campo ni identifican cultivos.'}</p>
  <label>{en?'Historical year':'Año histórico'} <select value={year} onChange={e=>{epoch.current++;setBusy(false);setError('');setYear(Number(e.target.value));setDaily(null);setContext({})}}>{[1,2,3,4,5].map(n=><option key={n} value={new Date().getUTCFullYear()-n}>{new Date().getUTCFullYear()-n}</option>)}</select></label>
  <button type="button" className="b-btn b-btn-light" disabled={busy} onClick={query}>{busy?(en?'Loading sources…':'Consultando fuentes…'):(en?'Check environmental context':'Consultar datos del terreno')}</button>
  {error&&<p role="alert">{error} <button type="button" onClick={query}>{en?'Retry':'Reintentar'}</button></p>}
  {(daily||Object.keys(context).length>0)&&<div className="b-observation-cards" aria-label={en?'Scientific environmental readings':'Lecturas ambientales científicas'}>
   <article className="b-observation-card"><span>{en?'Terrain elevation (regional)':'Elevación del entorno'}</span><strong>{context.terrain?`${value(context.terrain.elevation_m)} m`:'—'}</strong><small>SRTM · 90 m · {en?'Approximate, not surveyed':'Aproximación, no medición catastral'}</small><small>{en?'Approximate elevation':'Elevación aproximada'}: {context.terrain?`${value(context.terrain.elevation_m)} m`:'—'}</small><small>{en?'Neighbourhood gradient':'Gradiente del entorno'}: {context.terrain?`${value(context.terrain.approximate_gradient_degrees)}°`:'—'}</small><a href="https://www.opentopodata.org/datasets/srtm/" rel="noreferrer" target="_blank">{en?'Source: NASA/USGS SRTM':'Fuente: NASA/USGS SRTM'}</a></article>
   <article className="b-observation-card"><span>{en?'Reference evapotranspiration':'Evapotranspiración de referencia'}</span><strong>{context.power?`${value(context.power.annual_et0_mm)} mm/año`:'—'}</strong><small>NASA POWER / FAO-56 · {en?'Climatological estimate, not actual irrigation':'Estimación climatológica, no riego real'}</small><a href="https://power.larc.nasa.gov/" rel="noreferrer" target="_blank">NASA POWER</a></article>
   {andes&&<article className="b-observation-card"><span>{en?'Historical reanalysis rainfall':'Lluvia histórica en reanálisis'}</span><strong>{context.era5?.status==='available'?`${value(context.era5.rainfall_sum_mm)} mm`:'—'}</strong><small>ERA5-Land · {year} · {en?'Regional model grid, not a field gauge':'Celda regional, no pluviómetro local'}</small><small>{en?'Historical minimum air temperature':'Mínima histórica del aire'}: {context.era5?.status==='available'?`${value(context.era5.min_air_temperature_c)} °C`:'—'}</small><a href="https://open-meteo.com/en/docs/historical-weather-api" rel="noreferrer" target="_blank">ECMWF · ERA5-Land</a></article>}
  </div>}
  {andes&&<p>ECOSTRESS V003: {context.ecostress?.status==='metadata_only_quality_unverified'?(en?'Scene metadata found; temperature is not validated.':'Metadatos de escenas encontrados; la temperatura no está validada.'):(en?'No quality-verified thermal values available.':'Sin valores térmicos verificados disponibles.')}</p>}
  {daily&&dailyQuality&&climate&&<section aria-label={en?'Historical climate':'Clima histórico'}><h3>NASA POWER · {daily.period?.start} — {daily.period?.end}</h3>
   <div className="b-observation-cards">
    <article className="b-observation-card"><span>{en?'Rain in available records':'Lluvia en registros disponibles'}</span><strong>{value(climate.observedRainMm)} mm</strong><small>{climate.validRainDays} / {dailyQuality.expected_days} {en?'valid days':'días válidos'} · {climate.rainCoveragePercent}% {en?'coverage':'de cobertura'}</small><small>{climate.annualRainMm===null?(en?'Incomplete series: NOT an annual rainfall total':'Serie incompleta: NO es un total anual'):(en?'Complete date range':'Periodo completo')}</small></article>
    <article className="b-observation-card"><span>{en?'Mean air temperature':'Temperatura media del aire'}</span><strong>{value(climate.meanTemperatureC)} °C</strong><small>{climate.validTemperatureDays} / {dailyQuality.expected_days} {en?'valid days':'días válidos'} · {climate.temperatureCoveragePercent}% {en?'coverage':'de cobertura'}</small></article>
   </div>
   <p>{en?'Missing days are not filled with zero; incomplete periods are not annual totals. These are NASA POWER regional grid estimates, not weather-station readings on this plot.':'Los días faltantes no se rellenan con cero; los periodos incompletos no son totales anuales. Son estimaciones regionales NASA POWER, no lecturas de una estación en la parcela.'}</p>
  </section>}
  <details className="b-source-registry"><summary>{en?'Official sources and limitations':'Fuentes oficiales y limitaciones'}</summary>
   <p>{en?'These are reference services, not all live data integrations. Only verified responses above provide values.':'Estas son referencias oficiales, no todas son integraciones de datos en vivo. Solo las respuestas verificadas anteriores aportan valores.'}</p>
   <div><a href="https://power.larc.nasa.gov/" target="_blank" rel="noreferrer">NASA POWER</a><a href="https://gpm.nasa.gov/data/imerg" target="_blank" rel="noreferrer">NASA GPM IMERG</a><a href="https://nsidc.org/data/spl3smp_e/versions/6" target="_blank" rel="noreferrer">NASA SMAP</a><a href="https://www.opentopodata.org/datasets/srtm/" target="_blank" rel="noreferrer">SRTM</a><a href="https://open-meteo.com/en/docs/historical-weather-api" target="_blank" rel="noreferrer">ERA5-Land</a><a href="https://ecostress.jpl.nasa.gov/data" target="_blank" rel="noreferrer">ECOSTRESS</a></div>
   <div><a href="https://www.senamhi.gob.pe/servicios/?p=estaciones" target="_blank" rel="noreferrer">SENAMHI</a><a href="https://www.gob.pe/inia" target="_blank" rel="noreferrer">INIA</a><a href="https://www.ana.gob.pe/" target="_blank" rel="noreferrer">ANA</a><a href="https://siea.midagri.gob.pe/" target="_blank" rel="noreferrer">MIDAGRI</a><a href="https://www.fao.org/4/x0490e/x0490e00.htm" target="_blank" rel="noreferrer">FAO</a></div>
   <p className="b-source-warning">{en?'SENAMHI: official station catalogue only. No station observations have been downloaded, validated or used in calculations.':'SENAMHI: solo catálogo oficial de estaciones. No se han descargado ni validado observaciones de estaciones para estos cálculos.'}</p>
   <p>{en?'No local frost forecast, soil diagnosis, irrigation prescription or validated crop suitability.':'No determina pronósticos de heladas locales, diagnóstico de suelo, riego ni aptitud agrícola validada.'}</p>
  </details>
  <ParcelNDVI vertices={vertices} api={API} en={en}/>
  <GpmPolygon vertices={vertices} api={API} en={en}/>
  <SmapRegional vertices={vertices} api={API} en={en}/>
  <GaezRaw vertices={vertices} api={API} en={en}/>
  <SatelliteScenes point={point} language={lang} api={API}/>
 </details>
}
