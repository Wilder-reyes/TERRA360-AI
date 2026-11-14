/** Farmer-first NASA map. Real GIBS raster and observed NASA POWER values stay
 * distinct: the GIBS image is NOT a POWER measurement of a parcel.
 */
import {useEffect,useMemo,useState} from 'react'
import {MapContainer,Marker,Polygon,Polyline,TileLayer,WMSTileLayer,useMap,useMapEvents} from 'react-leaflet'
import L from 'leaflet'
import {HUANDO_PILOT} from './pilot'
import {approximatePolygonHectares,validatePolygon} from './geometry'
import {safeDateUTC,type Position,type RecordRow} from './domain'

type MapMode='point'|'drawing'
type Overlay='rain'|'vegetation'
type Place={id:number;name:string;admin1?:string;country?:string;latitude:number;longitude:number}
const NASA_WMS='https://gibs.earthdata.nasa.gov/wms/epsg3857/best/wms.cgi'
const LAYERS:Record<Overlay,string>={
 rain:'IMERG_Precipitation_Rate',
 vegetation:'MODIS_Terra_NDVI_8Day',
}
const pin=L.divIcon({className:'farmer-map-pin',html:'<span aria-hidden="true">●</span>',iconSize:[28,28],iconAnchor:[14,14]})
const num=(value:number|null|undefined,decimal=1)=>value==null||!Number.isFinite(value)?'—':value.toLocaleString('es-PE',{maximumFractionDigits:decimal,minimumFractionDigits:decimal})

/** MODIS 8-day composites have a time step, not one image for every day. */
export function vegetationReferenceDate(today=new Date()):string {
 const d=new Date(Date.UTC(today.getUTCFullYear(),today.getUTCMonth(),today.getUTCDate()))
 d.setUTCDate(d.getUTCDate()-24)
 const start=new Date(Date.UTC(d.getUTCFullYear(),0,1))
 const day=Math.floor((d.getTime()-start.getTime())/86400000)
 start.setUTCDate(start.getUTCDate()+Math.floor(day/8)*8)
 return start.toISOString().slice(0,10)
}
export function selectRecentObservation(records:RecordRow[]) {
 return [...records].reverse().find(r=>
  [r.PRECTOTCORR,r.T2M,r.RH2M].some(v=>v!==null&&Number.isFinite(v)))||null
}

function FollowPoint({target}:{target:Position|null}) {
 const map=useMap()
 useEffect(()=>{if(target)map.setView([target.lat,target.lng],Math.max(map.getZoom(),11))},[map,target?.lat,target?.lng])
 useEffect(()=>{const handler=()=>map.invalidateSize({pan:false});handler();return()=>{map.off('resize',handler)}},[map])
 return null
}
function MapInteractions({mode,onPlace,onVertex}:{mode:MapMode;onPlace:(p:Position)=>void;onVertex:(p:Position)=>void}) {
 useMapEvents({click(event){
  const location={lat:Number(event.latlng.lat.toFixed(6)),lng:Number(event.latlng.lng.toFixed(6))}
  if(mode==='drawing')onVertex(location)
  else onPlace(location)
 }})
 return null
}
export function FarmerMap({point,polygon,onPick,onPolygon,lastDate,records=[],loading=false,error=''}:{
 point:Position|null;polygon:Position[]|null;
 onPick:(point:Position,referenceOnly:boolean)=>void;
 onPolygon:(polygon:Position[]|null)=>void;
 lastDate:string;records?:RecordRow[];loading?:boolean;error?:string;
}) {
 const [overlay,setOverlay]=useState<Overlay>('rain')
 const [mode,setMode]=useState<MapMode>('point')
 const [vertices,setVertices]=useState<Position[]>([])
 const [drawError,setDrawError]=useState('')
 const [query,setQuery]=useState('')
 const [matches,setMatches]=useState<Place[]>([])
 const [searching,setSearching]=useState(false)
 const [searchError,setSearchError]=useState('')
 const [tileError,setTileError]=useState(false)
 const [tileLoaded,setTileLoaded]=useState(false)
 const [legendError,setLegendError]=useState(false)
 const [target,setTarget]=useState<Position|null>(null)
 const observation=useMemo(()=>selectRecentObservation(records),[records])
 const layer=LAYERS[overlay]
 const visibleDate=overlay==='rain'?(lastDate||safeDateUTC(7)):vegetationReferenceDate()
 const legendUrl=NASA_WMS+'?service=WMS&version=1.1.1&request=GetLegendGraphic&format=image/png&layer='+layer+'&style=default'
 useEffect(()=>{setTileError(false);setTileLoaded(false);setLegendError(false)},[layer,visibleDate])
 function choose(p:Position,referenceOnly=false,keepPolygon=false){
  setMode('point');setVertices([]);setDrawError('');setTarget(p)
  if(!keepPolygon)onPolygon(null)
  onPick(p,referenceOnly)
 }
 function finish(){
  const result=validatePolygon(vertices)
  if(!result.valid){setDrawError('No se pudo cerrar el terreno. Marca al menos tres esquinas sin cruzar las líneas.');return}
  const center={lat:vertices.reduce((n,p)=>n+p.lat,0)/vertices.length,lng:vertices.reduce((n,p)=>n+p.lng,0)/vertices.length}
  onPolygon(vertices)
  choose(center,false,true)
 }
 async function search(){
  if(query.trim().length<3)return
  setSearchError('');setSearching(true);setMatches([])
  try{
   const response=await fetch('https://geocoding-api.open-meteo.com/v1/search?name='+encodeURIComponent(query.trim())+'&count=5&language=es&format=json')
   if(!response.ok)throw new Error()
   const payload=await response.json() as {results?:Place[]}
   const places=(payload.results||[]).filter(p=>Number.isFinite(p.latitude)&&Number.isFinite(p.longitude))
   setMatches(places)
   if(!places.length)setSearchError('No encontramos esa localidad. Prueba con un nombre cercano.')
  }catch{setSearchError('No pudimos buscar esa localidad. Revisa tu conexión.')}
  finally{setSearching(false)}
 }
 function startDrawing(){setMode('drawing');setVertices([]);setDrawError('')}
 const lastRain=observation?.PRECTOTCORR
 const lastTemperature=observation?.T2M
 const lastHumidity=observation?.RH2M
 return <section className="farmer-map-card farmer-map-simple" aria-labelledby="farmer-map-title">
  <div className="farmer-map-head">
   <div><span className="f-eyebrow">1 · MI CHACRA</span><h2 id="farmer-map-title">Ubica tu terreno en el mapa</h2><p>Empieza en Huando, Huaral. Toca el mapa donde está tu chacra o consulta la zona.</p></div>
   <button type="button" className="f-btn f-btn-soft" onClick={()=>choose({lat:HUANDO_PILOT.lat,lng:HUANDO_PILOT.lng},true)}>Consultar Huando</button>
  </div>
  <div className="farmer-map-simple-controls">
   <div className="farmer-map-toggle" role="group" aria-label="Qué muestra el satélite">
    <button type="button" className={overlay==='rain'?'active':''} aria-pressed={overlay==='rain'} onClick={()=>setOverlay('rain')}>Lluvia</button>
    <button type="button" className={overlay==='vegetation'?'active':''} aria-pressed={overlay==='vegetation'} onClick={()=>setOverlay('vegetation')}>Vegetación</button>
   </div>
   {mode==='drawing'?<div className="farmer-map-drawing-actions">
    <span role="status">Marca las esquinas ({vertices.length})</span>
    <button type="button" className="f-btn f-btn-primary" onClick={finish} disabled={vertices.length<3}>Terminar</button>
    <button type="button" className="f-btn f-btn-outline" onClick={()=>{setMode('point');setVertices([]);setDrawError('')}}>Cancelar</button>
   </div>:<button type="button" className="f-btn f-btn-outline farmer-draw-button" onClick={startDrawing}>Dibujar mi chacra</button>}
  </div>
  <div className="farmer-map-area farmer-map-data-area">
   <MapContainer className="farmer-map" center={[HUANDO_PILOT.lat,HUANDO_PILOT.lng]} zoom={11} scrollWheelZoom={false} zoomControl={false}>
    <TileLayer attribution="Imágenes &copy; Esri, Maxar, Earthstar Geographics" url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"/>
    <WMSTileLayer
      key={layer+'-'+visibleDate}
      url={NASA_WMS}
      layers={layer}
      styles=""
      format="image/png"
      transparent={true}
      version="1.1.1"
      time={visibleDate}
      opacity={0.78}
      attribution="NASA GIBS / ESDIS"
      eventHandlers={{tileerror:()=>setTileError(true),tileload:()=>setTileLoaded(true)}}
    />
    <FollowPoint target={target}/>
    <MapInteractions mode={mode} onPlace={p=>choose(p)} onVertex={p=>setVertices(old=>old.length<30?[...old,p]:old)}/>
    {point&&<Marker icon={pin} position={[point.lat,point.lng]}/>}
    {polygon&&<Polygon positions={polygon.map(p=>[p.lat,p.lng])} pathOptions={{color:'#1eda8f',weight:3,fillColor:'#1eda8f',fillOpacity:.13}}/>}
    {vertices.length>=2&&<Polyline positions={vertices.map(p=>[p.lat,p.lng])} pathOptions={{color:'#e8f9cb',weight:3,dashArray:'7 7'}}/>}
   </MapContainer>
   <div className="farmer-map-readout" aria-live="polite" aria-label="Datos de NASA en el mapa">
    <strong>Datos de NASA para esta zona</strong>
    {!point?<p>Toca un punto del mapa para ver la lluvia y la temperatura reales disponibles.</p>:
     loading?<p>Consultando registros de NASA POWER…</p>:
     error?<p>No se pudo consultar NASA POWER. Revisa tu conexión y vuelve a intentar.</p>:
     observation?<><div className="farmer-map-numbers">
      <div><span>Lluvia del día</span><b>{num(lastRain)} <small>{lastRain==null?'':'mm'}</small></b></div>
      <div><span>Temperatura</span><b>{num(lastTemperature)} <small>{lastTemperature==null?'':'°C'}</small></b></div>
      <div><span>Humedad del aire</span><b>{num(lastHumidity)} <small>{lastHumidity==null?'':'%'}</small></b></div>
     </div><small>Fecha NASA POWER: {observation.date} · valores regionales</small></>:
     <p>NASA no devolvió observaciones suficientes para el lugar seleccionado.</p>}
   </div>
  </div>
  <div className="farmer-map-simple-footer">
   <div className="farmer-map-source-legend">
    <div className="farmer-map-legend-heading"><strong>{overlay==='rain'?'Lluvia observada desde el satélite':'Actividad de la vegetación desde el satélite'}</strong><span>Imagen solicitada: {visibleDate}</span></div>
    <p>{overlay==='rain'?'Colores: estimación visual de precipitación GPM IMERG.':'Colores: índice visual de vegetación MODIS (cada 8 días). No identifica qué cultivo está sano.'}</p>
    {!legendError&&<img src={legendUrl} alt={overlay==='rain'?'Escala de colores publicada por NASA para lluvia':'Escala de colores publicada por NASA para vegetación'} onError={()=>setLegendError(true)}/>}
    {legendError&&<span className="f-small">NASA no proporcionó la leyenda para esta capa.</span>}
    {tileError&&<p role="alert" className="f-error">NASA no pudo cargar la imagen de esta fecha. No interpretes la zona como ausencia de lluvia o vegetación.</p>}
    {!tileLoaded&&!tileError&&<span className="f-small">Imagen satelital sujeta a disponibilidad para esa fecha.</span>}
   </div>
   <div className="farmer-map-place-note">
    <span className="f-legend-line"/> <span>Verde: terreno que dibujaste.</span>
    {polygon&&<span>Área aproximada: {approximatePolygonHectares(polygon).toLocaleString('es-PE',{maximumFractionDigits:2})} ha.</span>}
    <p>La imagen satelital muestra una zona amplia. Los números de NASA POWER son otra fuente y no miden tu chacra.</p>
   </div>
   {drawError&&<p className="f-error" role="alert">{drawError}</p>}
   <details className="farmer-map-extra"><summary>Buscar otro lugar en el mapa</summary>
    <form className="farmer-place-search" onSubmit={e=>{e.preventDefault();void search()}}>
     <label htmlFor="farmer-place">Nombre de la localidad</label>
     <div><input id="farmer-place" value={query} placeholder="Ej. Huando, Huaral" onChange={e=>setQuery(e.target.value)} maxLength={80}/><button type="submit" disabled={query.trim().length<3||searching}>{searching?'Buscando…':'Buscar'}</button></div>
     {searchError&&<p role="alert" className="f-error">{searchError}</p>}
     {matches.length>0&&<ul className="farmer-search-results">{matches.map(p=><li key={p.id}><button type="button" onClick={()=>{choose({lat:p.latitude,lng:p.longitude});setMatches([])}}>{[p.name,p.admin1,p.country].filter(Boolean).join(' · ')}</button></li>)}</ul>}
    </form>
   </details>
   <p className="f-small farmer-map-source-footnote">Mapa visual: <a href="https://gibs.earthdata.nasa.gov/" target="_blank" rel="noreferrer">NASA GIBS</a> · Valores climáticos: <a href="https://power.larc.nasa.gov/" target="_blank" rel="noreferrer">NASA POWER</a>. Fechas y productos pueden ser distintos.</p>
  </div>
 </section>
}
