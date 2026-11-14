import {useEffect, useState} from 'react'
import {CircleMarker, MapContainer, Marker, Polygon, TileLayer, WMSTileLayer, useMap, useMapEvents} from 'react-leaflet'
import L from 'leaflet'
import {HUANDO_PILOT} from './pilot'
import {approximatePolygonHectares, validatePolygon} from './geometry'
import type {Position} from './domain'

type MapMode='place'|'drawing'
type Overlay='base'|'rain'|'vegetation'
type Place={id:number;name:string;admin1?:string;country?:string;latitude:number;longitude:number}
const pin = L.divIcon({className:'farmer-map-pin',html:'<span aria-hidden="true">●</span>',iconSize:[28,28],iconAnchor:[14,14]})
const rainLayer='IMERG_Precipitation_Rate'
const vegetationLayer='MODIS_Terra_NDVI_8Day'

function MoveMap({target}:{target:Position|null}) {
 const map=useMap()
 useEffect(()=>{if(target)map.setView([target.lat,target.lng],Math.max(map.getZoom(),12),{animate:false})},[map,target?.lat,target?.lng])
 return null
}
function MapClick({mode,onPlace,onVertex}:{mode:MapMode;onPlace:(p:Position)=>void;onVertex:(p:Position)=>void}) {
 useMapEvents({click(event){
   const p={lat:Number(event.latlng.lat.toFixed(6)),lng:Number(event.latlng.lng.toFixed(6))}
   if(mode==='drawing')onVertex(p)
   else onPlace(p)
 }})
 return null
}
export function FarmerMap({point,polygon,onPick,onPolygon,lastDate}:{point:Position|null;polygon:Position[]|null;onPick:(p:Position,referenceOnly:boolean)=>void;onPolygon:(points:Position[]|null)=>void;lastDate:string}) {
 const [base,setBase]=useState<'streets'|'satellite'>('satellite')
 const [overlay,setOverlay]=useState<Overlay>('base')
 const [mode,setMode]=useState<MapMode>('place')
 const [vertices,setVertices]=useState<Position[]>([])
 const [drawError,setDrawError]=useState('')
 const [query,setQuery]=useState('')
 const [matches,setMatches]=useState<Place[]>([])
 const [searching,setSearching]=useState(false)
 const [searchError,setSearchError]=useState('')
 const [tileError,setTileError]=useState(false)
 const [target,setTarget]=useState<Position|null>(null)
 const selectedLayer=overlay==='rain'?rainLayer:overlay==='vegetation'?vegetationLayer:null
 function choose(p:Position,referenceOnly=false){
   setMode('place');setVertices([]);setDrawError('');setTarget(p)
   onPick(p,referenceOnly)
 }
 function finish(){
   const check=validatePolygon(vertices)
   if(!check.valid){setDrawError('No pudimos cerrar tu terreno. Marca al menos tres esquinas sin cruzar las líneas.');return}
   const center={lat:vertices.reduce((v,p)=>v+p.lat,0)/vertices.length,lng:vertices.reduce((v,p)=>v+p.lng,0)/vertices.length}
   onPolygon(vertices)
   choose(center)
 }
 async function search(){
   if(query.trim().length<3)return
   setSearchError('');setSearching(true);setMatches([])
   try{
     const r=await fetch('https://geocoding-api.open-meteo.com/v1/search?name='+encodeURIComponent(query.trim())+'&count=5&language=es&format=json')
     if(!r.ok)throw new Error()
     const result=await r.json() as {results?:Place[]}
     setMatches((result.results||[]).filter(p=>Number.isFinite(p.latitude)&&Number.isFinite(p.longitude)))
     if(!result.results?.length)setSearchError('No encontramos ese lugar. Prueba con otro nombre.')
   }catch{setSearchError('No pudimos buscar el lugar. Revisa tu conexión.')}
   finally{setSearching(false)}
 }
 return <section className="farmer-map-card" aria-labelledby="farmer-map-title">
  <div className="farmer-map-head">
   <div><span className="f-eyebrow">1 · MI CHACRA</span><h2 id="farmer-map-title">¿Dónde está tu terreno?</h2><p>Empezamos en Huando, Huaral. Toca el mapa donde está tu chacra.</p></div>
   <button type="button" className="f-btn f-btn-soft" onClick={()=>choose({lat:HUANDO_PILOT.lat,lng:HUANDO_PILOT.lng},true)}>Consultar la zona de Huando</button>
  </div>
  <form className="farmer-place-search" onSubmit={e=>{e.preventDefault();void search()}}>
   <label htmlFor="farmer-place">También puedes buscar tu localidad</label>
   <div><input id="farmer-place" value={query} placeholder="Ej. Huando, Huaral" onChange={e=>setQuery(e.target.value)} maxLength={80}/><button type="submit" disabled={query.trim().length<3||searching}>{searching?'Buscando…':'Buscar'}</button></div>
   {searchError&&<p role="alert" className="f-error">{searchError}</p>}
   {matches.length>0&&<ul className="farmer-search-results">{matches.map(p=><li key={p.id}><button type="button" onClick={()=>{choose({lat:p.latitude,lng:p.longitude});setMatches([])}}>{[p.name,p.admin1,p.country].filter(Boolean).join(' · ')}</button></li>)}</ul>}
  </form>
  <div className="farmer-map-modes" role="group" aria-label="Qué quieres ver en el mapa">
   {([['base','Foto del terreno'],['rain','Lluvia en el mapa'],['vegetation','Vegetación en el mapa']] as [Overlay,string][]).map(([id,name])=><button type="button" key={id} aria-pressed={overlay===id} onClick={()=>{setOverlay(id);setTileError(false)}} className={overlay===id?'active':''}>{name}</button>)}
  </div>
  <div className="farmer-map-area">
   <MapContainer className="farmer-map" center={[HUANDO_PILOT.lat,HUANDO_PILOT.lng]} zoom={HUANDO_PILOT.initialZoom} scrollWheelZoom={false}>
    {base==='streets'?<TileLayer attribution="&copy; OpenStreetMap contributors" url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"/>:<TileLayer attribution="Tiles &copy; Esri, Maxar, Earthstar Geographics" url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"/>}
    {selectedLayer&&point&&lastDate&&<WMSTileLayer key={selectedLayer+lastDate} url="https://gibs.earthdata.nasa.gov/wms/epsg3857/best/wms.cgi" layers={selectedLayer} styles="" format="image/png" transparent={true} version="1.1.1" time={lastDate} opacity={0.72} attribution="NASA GIBS / ESDIS" eventHandlers={{tileerror:()=>setTileError(true)}}/>}
    <MoveMap target={target}/>
    <MapClick mode={mode} onPlace={p=>choose(p)} onVertex={p=>setVertices(old=>old.length<30?[...old,p]:old)}/>
    {point&&<Marker position={[point.lat,point.lng]} icon={pin}/>}
    {polygon&&<Polygon positions={polygon.map(p=>[p.lat,p.lng])} pathOptions={{color:'#087d5b',fillColor:'#6bc8a1',fillOpacity:0.14,weight:3}}/>}
    {vertices.length>=2&&<Polygon positions={vertices.map(p=>[p.lat,p.lng])} pathOptions={{color:'#145c49',weight:2,dashArray:'6 6',fillOpacity:.08}}/>}
    {point&&overlay==='base'&&<CircleMarker center={[point.lat,point.lng]} radius={12} pathOptions={{color:'#0d6b59',fillOpacity:.12,weight:2}}/>}
   </MapContainer>
   <div className="farmer-map-toolbar">
    <button type="button" onClick={()=>setBase(x=>x==='streets'?'satellite':'streets')}>{base==='streets'?'Ver foto aérea':'Ver calles'}</button>
    <button type="button" aria-pressed={mode==='drawing'} onClick={()=>{setMode('drawing');setVertices([]);setDrawError('')}}>{mode==='drawing'?'Marca las esquinas':'Dibujar mi chacra'}</button>
    {mode==='drawing'&&<button type="button" onClick={finish} disabled={vertices.length<3}>Terminar dibujo ({vertices.length})</button>}
    {mode==='drawing'&&<button type="button" onClick={()=>{setMode('place');setVertices([])}}>Cancelar</button>}
    {polygon&&<button type="button" onClick={()=>onPolygon(null)}>Borrar contorno</button>}
   </div>
  </div>
  <div className="farmer-map-caption" role="status">
   {drawError&&<p className="f-error">{drawError}</p>}
   {polygon?<p>Contorno aproximado: <strong>{approximatePolygonHectares(polygon).toLocaleString('es-PE',{maximumFractionDigits:2})} hectáreas</strong>. No es una medición legal.</p>:point?<p>Referencia elegida. Los datos del satélite representan una zona más grande que tu chacra.</p>:<p>Primero toca el mapa o usa el botón «Consultar la zona de Huando».</p>}
   <div className="farmer-map-legend">
    {overlay==='base'?<><span className="f-legend-line"/> Borde verde: chacra dibujada. <span className="f-legend-dot"/> Punto consultado.</>:
      <><strong>{overlay==='rain'?'Lluvia (NASA IMERG)':'Vegetación (NASA MODIS)'}</strong>
      {selectedLayer&&point&&lastDate?<img alt="Leyenda de colores original publicada por NASA" src={'https://gibs.earthdata.nasa.gov/wms/epsg3857/best/wms.cgi?service=WMS&version=1.1.1&request=GetLegendGraphic&format=image/png&layer='+selectedLayer+'&style=default'}/>:<span>Elige un punto para consultar el mapa.</span>}
      {tileError&&<span role="alert">No se pudo cargar esta imagen satelital para la fecha elegida.</span>}</>}
   </div>
   <small>Foto aérea: Esri. Mapas de colores: NASA GIBS. Una imagen no demuestra la salud del cultivo ni mide tu terreno.</small>
  </div>
 </section>
}
