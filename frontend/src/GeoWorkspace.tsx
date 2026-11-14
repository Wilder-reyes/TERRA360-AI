import {useEffect, useMemo, useState} from 'react'
import {CircleMarker, MapContainer, Marker, Popup, Rectangle, TileLayer, useMap, useMapEvents} from 'react-leaflet'
import L from 'leaflet'
import type {ApiResult, Position, RecordRow} from './domain'
import './geo-workspace.css'

type Layer = 'rain' | 'temperature' | 'humidity' | 'scenes'
type Base = 'streets' | 'satellite'
type Scene = {date:string;cloud_cover_percent:number;satellite:string;scene_id:string}
type SceneResponse = {scenes:Scene[];status:string;source_url:string}
type Area = [Position,Position]

const markerIcon = L.divIcon({
  className:'terra-geo-pin',
  html:'<span aria-hidden="true">✳</span>',
  iconSize:[34,34],
  iconAnchor:[17,17]
})

function Recenter({point}:{point:Position|null}) {
  const map=useMap()
  useEffect(()=>{if(point)map.setView([point.lat,point.lng],Math.max(8,map.getZoom()))},[map,point?.lat,point?.lng])
  return null
}

function MapSelection({draw,corner,onPoint,onCorner}:{draw:boolean;corner:Position|null;onPoint:(p:Position)=>void;onCorner:(p:Position)=>void}) {
  useMapEvents({click(e){
    const p={lat:Number(e.latlng.lat.toFixed(6)),lng:Number(e.latlng.lng.toFixed(6))}
    if(draw){onCorner(p)}else{onPoint(p)}
  }})
  return null
}

function boundsForPoint(p:Position):[[number,number],[number,number]]{
  // NASA STAC search uses an approximately 2 km radius, NOT a property boundary.
  const lat=2/111.32
  const lon=2/(111.32*Math.max(.05,Math.abs(Math.cos(p.lat*Math.PI/180))))
  return [[Math.max(-90,p.lat-lat),Math.max(-180,p.lng-lon)],[Math.min(90,p.lat+lat),Math.min(180,p.lng+lon)]]
}

function boundsForArea(area:Area):[[number,number],[number,number]]{
  return [[Math.min(area[0].lat,area[1].lat),Math.min(area[0].lng,area[1].lng)],[Math.max(area[0].lat,area[1].lat),Math.max(area[0].lng,area[1].lng)]]
}

function interpret(row:RecordRow|null,layer:Layer,en:boolean):string{
  if(!row)return en?'Select a location and a date with observations.':'Elige un lugar y espera los datos regionales.'
  if(layer==='rain'){
    if(row.PRECTOTCORR===null)return en?'No rainfall reading for this date.':'No hay dato de lluvia para esta fecha.'
    return row.PRECTOTCORR===0?(en?'This regional observation shows no rainfall on this day.':'El dato regional no registra lluvia ese día.'):(en?'Regional rainfall was recorded on this day; this does not measure irrigation available on your farm.':'Se registró lluvia en la región ese día. No indica cuánta agua hay disponible en tu terreno.')
  }
  if(layer==='temperature'){
    return row.T2M===null?(en?'No temperature reading for this date.':'No hay dato de temperatura para esta fecha.'):(en?'This is regional air temperature, not a soil temperature or a frost forecast.':'Es temperatura regional del aire, no del suelo ni un pronóstico de heladas.')
  }
  if(layer==='humidity')return row.RH2M===null?(en?'No humidity reading for this date.':'No hay dato de humedad para esta fecha.'):(en?'Regional relative humidity is not soil moisture.':'La humedad del aire en la región no es la humedad del suelo.')
  return en?'Scene dates do not measure crop health.':'Las fechas de imágenes no miden la salud de los cultivos.'
}

export function GeoWorkspace({point,onPick,data,loading,language,api,compact=false}:{point:Position|null;onPick:(p:Position)=>void;data:ApiResult|null;loading:boolean;language:string;api:string;compact?:boolean}){
  const en=language==='en'
  const [layer,setLayer]=useState<Layer>('rain')
  const [base,setBase]=useState<Base>('streets')
  const [area,setArea]=useState<Area|null>(null)
  const [corner,setCorner]=useState<Position|null>(null)
  const [draw,setDraw]=useState(false)
  const [date,setDate]=useState('')
  const [scenes,setScenes]=useState<SceneResponse|null>(null)
  const [loadingScenes,setLoadingScenes]=useState(false)
  const [sceneError,setSceneError]=useState('')
  useEffect(()=>{setScenes(null);setSceneError('')},[point?.lat,point?.lng])
  const records=data?.records||[]
  const last=records.length?records[records.length-1].date:''
  const current=useMemo(()=>records.find(r=>r.date===date)||records[records.length-1]||null,[records,date])
  const unit=layer==='rain'?'mm':layer==='temperature'?'°C':layer==='humidity'?'%':''
  const value=layer==='rain'?current?.PRECTOTCORR:layer==='temperature'?current?.T2M:layer==='humidity'?current?.RH2M:null
  const shownValue=value===null||value===undefined||!Number.isFinite(value)?'—':Number(value).toFixed(1)
  const title=layer==='rain'?(en?'Rain on this date':'Lluvia de ese día'):layer==='temperature'?(en?'Air temperature':'Temperatura del aire'):layer==='humidity'?(en?'Air humidity':'Humedad del aire'):(en?'Satellite scenes':'Imágenes disponibles')
  function chooseCorner(p:Position){
    if(!corner){setCorner(p);return}
    if(Math.abs(corner.lat-p.lat)<.00001||Math.abs(corner.lng-p.lng)<.00001){return}
    const a:Area=[corner,p]
    setArea(a);setCorner(null);setDraw(false)
    onPick({lat:Number(((corner.lat+p.lat)/2).toFixed(6)),lng:Number(((corner.lng+p.lng)/2).toFixed(6))})
  }
  async function findScenes(){
    if(!point||loadingScenes)return
    setLoadingScenes(true);setSceneError('');setScenes(null)
    try{
      const params=new URLSearchParams({latitude:String(point.lat),longitude:String(point.lng),days:'120',cloud_limit:'35',count:'5'})
      const resp=await fetch(`${api}/api/environment/planetary-computer/scenes?${params}`)
      if(!resp.ok)throw Error('unavailable')
      const json=await resp.json() as SceneResponse
      setScenes(json)
    }catch{
      setSceneError(en?'We could not retrieve images for this place. Try again.':'No pudimos consultar las imágenes de esta zona. Inténtalo otra vez.')
    }finally{setLoadingScenes(false)}
  }
  return <section className={`terra-geoworkspace ${compact?'terra-geo-compact':''}`} aria-label={en?'Interactive agricultural map':'Mapa agrícola interactivo'}>
    <div className="terra-geo-heading">
      <div><p className="mini-label">{en?'YOUR LAND, ON THE MAP':'TU TERRENO EN EL MAPA'}</p>
        <h2>{en?'Explore your land and its surroundings':'Explora tu terreno y su entorno'}</h2>
        <p>{en?'Choose a location or mark an approximate rectangle. View real regional observations, not field measurements.':'Selecciona una ubicación o marca un rectángulo aproximado. Consulta datos regionales reales, no mediciones de tu parcela.'}</p>
      </div>
      <div className="terra-geo-base"><button type="button" aria-pressed={base==='streets'} className={base==='streets'?'active':''} onClick={()=>setBase('streets')}>{en?'Map':'Mapa'}</button><button type="button" aria-pressed={base==='satellite'} className={base==='satellite'?'active':''} onClick={()=>setBase('satellite')}>{en?'Aerial photo':'Foto aérea'}</button></div>
    </div>
    <div className="terra-geo-shell">
      <div className="terra-geo-mapbox">
        <MapContainer center={[12,0]} zoom={2} scrollWheelZoom={false} className="terra-geo-map">
          {base==='streets'?<TileLayer attribution='&copy; OpenStreetMap contributors' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"/>:<TileLayer attribution='Tiles &copy; Esri, Maxar, Earthstar Geographics' url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"/>}
          <Recenter point={point}/>
          <MapSelection draw={draw} corner={corner} onPoint={onPick} onCorner={chooseCorner}/>
          {point&&<Marker position={[point.lat,point.lng]} icon={markerIcon}><Popup>{en?'Your selected reference point':'Punto de referencia elegido'}<br/>{point.lat.toFixed(5)}, {point.lng.toFixed(5)}</Popup></Marker>}
          {point&&layer==='scenes'&&<Rectangle bounds={boundsForPoint(point)} pathOptions={{color:'#a45d2b',weight:2,dashArray:'7 5',fillOpacity:.07}}><Popup>{en?'Approximate Sentinel-2 scene search area, not a field boundary':'Área aproximada de búsqueda de imágenes, no límites de tu terreno'}</Popup></Rectangle>}
          {area&&<Rectangle bounds={boundsForArea(area)} pathOptions={{color:'#0d694a',weight:3,fillColor:'#42bd91',fillOpacity:.12}}><Popup>{en?'Approximate area drawn by the user; not surveyed':'Área aproximada dibujada, no delimitación catastral'}</Popup></Rectangle>}
          {point&&current&&layer!=='scenes'&&value!==null&&value!==undefined&&<CircleMarker center={[point.lat,point.lng]} radius={24} pathOptions={{color:layer==='rain'?'#287bb5':layer==='temperature'?'#c26d24':'#6b5ca9',weight:3,fillOpacity:.28}}><Popup>{title}: {shownValue} {unit}<br/>{current.date}<br/>{en?'Regional observation only':'Dato regional, no medición del terreno'}</Popup></CircleMarker>}
        </MapContainer>
        <div className="terra-geo-draw-actions">
          <button type="button" aria-pressed={draw} onClick={()=>{setDraw(v=>!v);setCorner(null)}}>{draw?(corner?(en?'Pick opposite corner':'Marca la esquina opuesta'):(en?'Pick first corner':'Marca la primera esquina')):(en?'Draw approximate area':'Delimitar área aproximada')}</button>
          {area&&<button type="button" onClick={()=>{setArea(null);setCorner(null);setDraw(false)}}>{en?'Clear area':'Borrar área'}</button>}
        </div>
        <div className="terra-geo-map-caption">{area?(en?'Green outline: area you drew; not surveyed.':'Contorno verde: área dibujada, no verificada.'):(en?'Click the map to choose a point.':'Haz clic para elegir un punto.')}</div>
      </div>
      <aside className="terra-geo-inspector">
        <div className="terra-geo-layer-title"><strong>{en?'What do you want to explore?':'¿Qué quieres explorar?'}</strong><small>{en?'Select one view':'Elige una vista'}</small></div>
        <div className="terra-geo-layer-pills">
          {([['rain',en?'Rain':'Lluvia'],['temperature',en?'Temperature':'Temperatura'],['humidity',en?'Air humidity':'Humedad'],['scenes',en?'Satellite dates':'Imágenes']] as [Layer,string][]).map(([id,label])=><button key={id} type="button" aria-pressed={layer===id} className={layer===id?'active':''} onClick={()=>setLayer(id)}>{label}</button>)}
        </div>
        {layer==='scenes'?<div className="terra-geo-reading">
          <small>{en?'Sentinel-2 · ESA/Copernicus':'Sentinel-2 · ESA/Copernicus'}</small>
          <h3>{title}</h3>
          <p>{en?'Searches for scene dates with limited cloud cover in an approximate 2 km radius, not vegetation measurements.':'Busca fechas de imágenes con poca nubosidad alrededor de unos 2 km; todavía no calcula la salud de los cultivos.'}</p>
          <button className="terra-geo-fetch" type="button" onClick={()=>void findScenes()} disabled={!point||loadingScenes}>{loadingScenes?(en?'Searching…':'Consultando…'):(en?'Find images':'Buscar imágenes')}</button>
          {sceneError&&<p role="alert">{sceneError}</p>}
          {scenes&&<div className="terra-geo-scenes">{scenes.scenes.length?scenes.scenes.map(s=><div key={s.scene_id}><strong>{s.date}</strong><small>{s.cloud_cover_percent.toFixed(1)}% {en?'cloud cover of whole image':'de nubes en la imagen completa'}</small></div>):<p>{en?'No matching scenes in this limited search.':'No hay imágenes coincidentes en esta búsqueda limitada.'}</p>}</div>}
        </div>:<div className="terra-geo-reading">
          <small>NASA POWER · {en?'regional observation':'dato regional'}</small>
          <h3>{title}</h3>
          <strong className="terra-geo-value">{loading?'…':shownValue} <span>{shownValue==='—'?'':unit}</span></strong>
          <label className="terra-geo-date">{en?'Date of observation':'Fecha del dato'}<select value={current?.date||last} onChange={e=>setDate(e.target.value)} disabled={!records.length}>{records.slice().reverse().map(r=><option key={r.date} value={r.date}>{r.date}</option>)}</select></label>
          <p>{interpret(current,layer,en)}</p>
          {!point&&<p>{en?'Choose a point on the map first.':'Primero elige un punto en el mapa.'}</p>}
          {data&&<small>{data.period.start} — {data.period.end}</small>}
        </div>}
        <div className="terra-geo-key"><strong>{en?'How to read this map':'Cómo interpretar el mapa'}</strong><p><span className="terra-geo-legend-dot"/> {en?'Colored circle: regional value for one NASA POWER query point. It is not a gridded field map.':'Círculo de color: valor regional para un punto de consulta NASA POWER. No es un mapa de cada parcela.'}</p><p><span className="terra-geo-legend-line"/> {en?'Green rectangle: approximate area you drew.':'Rectángulo verde: área aproximada que dibujaste.'}</p><p>{en?'Base map: OSM streets or Esri aerial imagery. The aerial photo is NOT a computed Sentinel-2 or NASA vegetation layer.':'Fondo: calles de OSM o foto aérea de Esri. La fotografía NO es un análisis de vegetación NASA ni de Sentinel-2.'}</p><p>{en?'Real rainfall, soil moisture, and vegetation raster overlays require additional validated processing.':'Las capas raster de lluvia, humedad de suelo y vegetación necesitan procesamiento adicional verificado.'}</p></div>
      </aside>
    </div>
  </section>
}
