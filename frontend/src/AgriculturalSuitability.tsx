import {useEffect, useRef, useState} from 'react'
import {GeoJSON, Rectangle, useMap, useMapEvents} from 'react-leaflet'
import './agricultural-suitability.css'

export type GeoBox = [number, number, number, number]
type Group = 'suitable' | 'moderate' | 'low' | 'no_data' | 'water'
type Crop = {id:string;name:string;name_en:string;available:boolean;scientific_name:string}
type Management = {id:string;name:string;name_en:string}
type Source = {name:string;period:string;catalog_url:string;license_url:string;license:string;attribution:string;raster_url?:string;raster_sha256?:string}
type Catalog = {source:Source;pilot_bbox:GeoBox;coverage:{bbox:GeoBox;name:string;name_en:string};crops:Crop[];management:Management[];factors:{id:string;name:string;name_en:string;detail:string;detail_en:string}[]}
type Cell = {type:'Feature';id:string;properties:{row:number;col:number;class_code:number;class_label:string;class_label_en:string;group:Group};geometry:{type:'Polygon';coordinates:number[][][]}}
export type SuitabilityMap = {crop:Crop;management:string;bbox:GeoBox;geojson:{type:'FeatureCollection';features:Cell[]};summary:{cells:Record<Group,number>;area_km2:Record<Group,number>;total_cells:number;land_data_coverage_percent:number};source:Source}

const groups:Group[] = ['suitable','moderate','low','no_data','water']
const colors:Record<Group,string> = {suitable:'#23844c',moderate:'#d5a137',low:'#ba5149',no_data:'#89939c',water:'#448db8'}
const labels:Record<Group,[string,string]> = {suitable:['Aptas','Suitable'],moderate:['Moderadas','Moderate'],low:['Poco aptas','Low suitability'],no_data:['Sin datos','No data'],water:['Agua','Water']}
const number = (value:number,en:boolean,digits=0) => value.toLocaleString(en?'en-US':'es-PE',{maximumFractionDigits:digits})

export function SuitabilityViewport({onChange,layout}:{onChange:(bbox:GeoBox)=>void;layout:string}){
  const map=useMap()
  function update(){
    const bounds=map.getBounds()
    onChange([bounds.getWest(),bounds.getSouth(),bounds.getEast(),bounds.getNorth()].map(v=>Number(v.toFixed(6))) as GeoBox)
  }
  useMapEvents({moveend:update})
  useEffect(()=>{map.invalidateSize({pan:false});update()},[map,onChange,layout])
  return null
}

export function SuitabilityFocus({target}:{target:{bbox:GeoBox}|null}){
  const map=useMap()
  useEffect(()=>{if(target){const [w,s,e,n]=target.bbox;map.invalidateSize({pan:false});map.fitBounds([[s,w],[n,e]],{padding:[28,60],animate:false})}},[map,target])
  return null
}

export function SuitabilityCells({result,en}:{result:SuitabilityMap;en:boolean}){
  const [w,s,e,n]=result.bbox
  return <>
    <GeoJSON key={`${result.crop.id}-${result.management}-${result.bbox.join(',')}-${en}`} data={result.geojson}
      attribution='FAO / IIASA GAEZ v5 · CC BY 4.0'
      style={(feature:any)=>({color:'#ffffff',weight:1,fillColor:colors[feature.properties.group as Group],fillOpacity:.55,className:'terra-suitability-cell',bubblingMouseEvents:false})}
      onEachFeature={(feature:any,layer:any)=>{
        const p=feature.properties as Cell['properties']
        const popup=document.createElement('div')
        // Text nodes: source labels are never interpolated into Leaflet HTML.
        const title=document.createElement('strong')
        title.textContent=`${en?result.crop.name_en:result.crop.name} · ${labels[p.group][en?1:0]}`
        const text=document.createElement('p')
        text.textContent=en?`FAO class ${p.class_code}: ${p.class_label_en}. Cell ${p.row}:${p.col}. Historical model, 2001–2020; ~9 km. Management: ${result.management}.`:`Clase FAO ${p.class_code}: ${p.class_label}. Celda ${p.row}:${p.col}. Modelo histórico, 2001–2020; ~9 km. Manejo: ${result.management}.`
        popup.append(title,text)
        layer.bindPopup(popup,{autoPan:false})
      }}/>
    <Rectangle bounds={[[s,w],[n,e]]} interactive={false} pathOptions={{color:'#273f44',weight:2,dashArray:'6 5',fill:false}}/>
  </>
}

function verifiedResult(value:any,crop:string,management:string,bbox:GeoBox):value is SuitabilityMap{
  return value?.crop?.id===crop && value.management===management && JSON.stringify(value.bbox)===JSON.stringify(bbox)
    && value.geojson?.type==='FeatureCollection' && Array.isArray(value.geojson.features) && value.geojson.features.length<=1024
    && value.geojson.features.every((f:any)=>groups.includes(f?.properties?.group) && Number.isInteger(f.properties.class_code)
      && f.geometry?.type==='Polygon' && Array.isArray(f.geometry.coordinates?.[0])
      && f.geometry.coordinates[0].every((p:any)=>Array.isArray(p)&&p.length===2&&p.every(Number.isFinite)))
    && groups.every(g=>Number.isFinite(value.summary?.cells?.[g])&&Number.isFinite(value.summary?.area_km2?.[g]))
    && Number.isFinite(value.summary.land_data_coverage_percent) && typeof value.source?.catalog_url==='string'
}

export function AgriculturalSuitability({api,en,viewport,onResult,onFocus}:{api:string;en:boolean;viewport:GeoBox|null;onResult:(map:SuitabilityMap|null)=>void;onFocus:(target:{bbox:GeoBox})=>void}){
  const [catalog,setCatalog]=useState<Catalog|null>(null)
  const [catalogError,setCatalogError]=useState(false)
  const [reload,setReload]=useState(0)
  const [crop,setCrop]=useState('barley')
  const [management,setManagement]=useState('')
  const [area,setArea]=useState('pilot')
  const [result,setResult]=useState<SuitabilityMap|null>(null)
  const [busy,setBusy]=useState(false)
  const [message,setMessage]=useState('')
  const request=useRef<AbortController|null>(null)
  const bbox=area==='pilot'?catalog?.pilot_bbox:viewport
  const bboxKey=bbox?.join(',')||''

  useEffect(()=>{
    const controller=new AbortController()
    setCatalog(null)
    setCatalogError(false)
    void fetch(api+'/api/agro/suitability/catalog',{signal:controller.signal}).then(async r=>{
      if(!r.ok)throw Error('catalog unavailable')
      const value=await r.json() as Catalog
      if(!Array.isArray(value.crops)||!Array.isArray(value.management)||!Array.isArray(value.pilot_bbox)||!Array.isArray(value.factors))throw Error('invalid catalog')
      if(!controller.signal.aborted){setCatalog(value);onFocus({bbox:value.pilot_bbox})}
    }).catch(()=>{if(!controller.signal.aborted)setCatalogError(true)})
    return ()=>controller.abort()
  },[api,reload,onFocus])

  useEffect(()=>{
    request.current?.abort();setBusy(false);setResult(null);setMessage('');onResult(null)
    return ()=>{request.current?.abort();onResult(null)}
  },[crop,management,bboxKey,api,onResult])

  async function analyze(){
    if(!bbox||!management||busy)return
    const controller=new AbortController()
    request.current?.abort();request.current=controller
    setBusy(true);setMessage('');setResult(null);onResult(null)
    try{
      const response=await fetch(api+'/api/agro/suitability/map',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({crop_id:crop,management,bbox}),signal:controller.signal})
      if(response.status===422)throw Error('extent')
      if(!response.ok)throw Error('unavailable')
      const value=await response.json()
      if(controller.signal.aborted)return
      if(value.status==='outside_coverage'){setMessage(en?'This view is outside the prepared study window around Cusco. Return to the Calca pilot.':'La vista está fuera de la ventana preparada en torno a Cusco. Vuelve al piloto de Calca.');return}
      if(value.status==='unsupported_crop'){setMessage(en?'There is no verified layer for this crop.':'No hay una capa verificada para este cultivo.');return}
      if(!['available','no_land_data'].includes(value.status)||!verifiedResult(value.map,crop,management,bbox))throw Error('unavailable')
      setResult(value.map);onResult(value.map)
      if(value.status==='no_land_data')setMessage(en?'There are no classified land cells in this area. Water and missing data do not count as suitable land.':'No hay celdas terrestres clasificadas en esta área. El agua y los datos faltantes no cuentan como zonas aptas.')
    }catch(error){
      if(!controller.signal.aborted)setMessage(error instanceof Error&&error.message==='extent'?(en?'Zoom in: each analysis supports up to 1,024 native cells.':'Acércate en el mapa: cada análisis admite hasta 1.024 celdas originales.'):(en?'The suitability data could not be verified. Try again.':'No pudimos verificar los datos de aptitud. Inténtalo de nuevo.'))
    }finally{if(!controller.signal.aborted)setBusy(false)}
  }

  return <div className="terra-geo-reading terra-suitability" aria-label={en?'Agricultural suitability':'Aptitud agrícola'}>
    <small>FAO / IIASA GAEZ v5 · 2001–2020 · ~9 km</small>
    <h3>{en?'Where could this crop grow?':'¿Dónde podría desarrollarse este cultivo?'}</h3>
    <p>{en?'Explore historical regional suitability. Select the crop and the assumed water and input conditions.':'Explora la aptitud regional histórica. Elige el cultivo y las condiciones de agua e insumos que deseas comparar.'}</p>
    {catalogError&&<><p role="alert">{en?'The layer catalog could not be loaded.':'No se pudo cargar el catálogo de capas.'}</p><button type="button" onClick={()=>setReload(v=>v+1)}>{en?'Retry':'Reintentar'}</button></>}
    {!catalog&&!catalogError&&<p role="status">{en?'Loading layers…':'Cargando capas…'}</p>}
    {catalog&&<>
      <div className="terra-suitability-controls">
        <label>{en?'Crop':'Cultivo'}<select aria-label={en?'Crop':'Cultivo'} value={crop} onChange={e=>setCrop(e.target.value)}>{catalog.crops.map(c=><option key={c.id} value={c.id} disabled={!c.available}>{en?c.name_en:c.name}</option>)}</select></label>
        <label>{en?'Water and management scenario':'Escenario de agua y manejo'}<select aria-label={en?'Water and management scenario':'Escenario de agua y manejo'} value={management} onChange={e=>setManagement(e.target.value)}><option value="" disabled>{en?'Choose a scenario…':'Elige un escenario…'}</option>{catalog.management.map(m=><option key={m.id} value={m.id}>{en?m.name_en:m.name}</option>)}</select></label>
        <label>{en?'Analysis area':'Área de análisis'}<select aria-label={en?'Analysis area':'Área de análisis'} value={area} onChange={e=>setArea(e.target.value)}><option value="pilot">{en?'Calca pilot · 64 cells':'Piloto de Calca · 64 celdas'}</option><option value="viewport">{en?'Current map view':'Vista actual del mapa'}</option></select></label>
      </div>
      <div className="terra-suitability-actions"><button className="terra-geo-fetch" type="button" disabled={!management||!bbox||busy} onClick={()=>void analyze()}>{busy?(en?'Preparing map…':'Preparando mapa…'):(en?'Map suitability':'Mostrar aptitud')}</button><button className="terra-suitability-focus" type="button" onClick={()=>{setArea('pilot');onFocus({bbox:catalog.pilot_bbox})}}>{en?'View Calca pilot':'Ver piloto de Calca'}</button></div>
      {management.endsWith('ILM')&&<p className="terra-suitability-note">{en?'This scenario assumes irrigation. Confirm actual water access and infrastructure before comparing it with rainfed conditions.':'Este escenario supone riego. Confirma el acceso real al agua y la infraestructura para compararlo con secano.'}</p>}
      {message&&<p role="status" className="terra-suitability-note">{message}</p>}
      <div className="terra-suitability-legend" aria-label={en?'Suitability legend':'Leyenda de aptitud'}>
        <strong>{en?'Map legend':'Leyenda del mapa'}</strong>
        <table><caption>{result?(en?`${result.crop.name_en} · ${catalog.management.find(m=>m.id===result.management)?.name_en}`:`${result.crop.name} · ${catalog.management.find(m=>m.id===result.management)?.name}`):(en?'Colors appear after an analysis':'Los colores aparecen al consultar')}</caption>
          <thead><tr><th scope="col">{en?'Class':'Clase'}</th><th scope="col">{en?'Cells':'Celdas'}</th><th scope="col">km² ≈</th></tr></thead>
          <tbody>{groups.map(g=><tr key={g}><th scope="row"><i style={{background:colors[g]}}/>{labels[g][en?1:0]}</th><td>{result?number(result.summary.cells[g],en):'—'}</td><td>{result?number(result.summary.area_km2[g],en,1):'—'}</td></tr>)}</tbody>
        </table>
      </div>
      {result&&<div className="terra-suitability-result" aria-live="polite"><p><strong>{en?'Land data coverage':'Cobertura de datos terrestres'}: {number(result.summary.land_data_coverage_percent,en,1)}%</strong> · {number(result.summary.total_cells,en)} {en?'cells':'celdas'}</p>
        {result.summary.cells.suitable===0&&<p>{en?'No cells reach the suitable group in this area and scenario.':'Ninguna celda alcanza el grupo «Aptas» en esta área y escenario.'}</p>}
        <p>{en?'Click a colored cell to inspect its original FAO class. The dashed outline marks the analysis rectangle; whole native cells are shown. Areas are approximate intersections with that rectangle, not cultivable hectares.':'Haz clic en una celda de color para consultar su clase FAO original. El contorno discontinuo marca el rectángulo analizado; se muestran celdas originales completas. Las superficies son intersecciones aproximadas con ese rectángulo, no hectáreas cultivables.'}</p>
      </div>}
      <p className="terra-suitability-note">{en?'Historical model at regional scale, without field validation in Cusco. Narrow valleys and local crop varieties need a field assessment. It does not measure current soil moisture or predict harvest success.':'Modelo histórico a escala regional, sin validación de campo en Cusco. Los valles estrechos y las variedades locales requieren evaluación en terreno. No mide la humedad actual del suelo ni predice el éxito de una cosecha.'}</p>
      <details><summary>{en?'Which conditions does it consider?':'¿Qué condiciones considera?'}</summary><dl className="terra-suitability-factors">{catalog.factors.map(f=><div key={f.id}><dt>{en?f.name_en:f.name}</dt><dd>{en?f.detail_en:f.detail}</dd></div>)}</dl><p>{en?'These factors are integrated into the GAEZ model. This layer does not expose a separate value or explanation for each factor in each cell.':'Estos factores están integrados en el modelo GAEZ. Esta capa no ofrece un valor ni una explicación por factor para cada celda.'}</p></details>
      <details><summary>{en?'Method and sources':'Método y fuentes'}</summary>
        <p>{en?'TERRA360 groups FAO classes 1–3 as suitable, 4–5 as moderate and 6–8 as low suitability. Class 0 is missing data and 9 is water. The suitability index is not a probability.':'TERRA360 agrupa las clases FAO 1–3 como aptas, 4–5 como moderadas y 6–8 como poco aptas. La clase 0 es sin datos y la 9 es agua. El índice de aptitud no es una probabilidad.'}</p>
        <p>{en?'Study window around Cusco (74°W–70°W; 15°S–11°S), not an administrative boundary. Faba bean has no verified layer; the maize layer represents grain maize, without validating Blanco Gigante.':'Ventana de estudio en torno a Cusco (74°O–70°O; 15°S–11°S), no límite administrativo. El haba no tiene una capa verificada; la capa de maíz representa maíz para grano, sin validar Blanco Gigante.'}</p>
        <p><a href={catalog.source.catalog_url} target="_blank" rel="noreferrer">{en?'Official FAO catalog and class legend':'Catálogo FAO y leyenda original'}</a> · <a href={catalog.source.license_url} target="_blank" rel="noreferrer">CC BY 4.0</a></p>
        <p>{catalog.source.attribution}</p>
        {result?.source.raster_sha256&&<p className="terra-suitability-digest">SHA-256: {result.source.raster_sha256}</p>}
      </details>
    </>}
  </div>
}
