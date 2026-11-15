import {useState} from 'react'
import {MapContainer,TileLayer,WMSTileLayer,Polygon} from 'react-leaflet'

type Scene={date:string;scene_id?:string;collection?:string;platform?:string;valid_pixels?:number;scene_cloud_percent?:number}
type Month={month:string;ndvi:number|null;best_scene?:Scene|null}
type PolygonShape={coordinates:number[][][]}
type Props={months:Month[];polygon:PolygonShape;lang:'es'|'en';sensor:string;monthsWithData:number;monthsTotal:number}

function sourceLink(scene:Scene):string|null{
 const collection=scene.collection, id=scene.scene_id
 if(!collection||!id||!/^[-a-zA-Z0-9_.]+$/.test(collection)||!/^[-a-zA-Z0-9_.]+$/.test(id))return null
 return 'https://planetarycomputer.microsoft.com/api/stac/v1/collections/'+encodeURIComponent(collection)+'/items/'+encodeURIComponent(id)
}
export default function SatelliteEvidence({months,polygon,lang,sensor,monthsWithData,monthsTotal}:Props){
 const samples=months.filter(x=>x.ndvi!=null&&x.best_scene?.date).slice(-5).reverse()
 const [choice,setChoice]=useState('')
 const [tileFailed,setTileFailed]=useState(false)
 const current=samples.find(m=>m.month===choice)||samples[0]
 const ring=polygon.coordinates?.[0]||[]
 const points=ring.slice(0,-1)
 const lat=points.reduce((s,p)=>s+p[1],0)/Math.max(1,points.length)
 const lon=points.reduce((s,p)=>s+p[0],0)/Math.max(1,points.length)
 if(!current?.best_scene)return <p>{lang==='es'?'No se recuperaron fechas de imágenes para este terreno.':'No imagery dates were recovered for this field.'}</p>
 const scene=current.best_scene
 const source=sourceLink(scene)
 const isEs=lang==='es'
 return <div className="b-satellite-gallery">
  <div className="b-satellite-gallery-head"><strong>{isEs?'Así se veía la zona desde el espacio':'This area seen from space'}</strong>
   <label>{isEs?'Fecha de la imagen':'Image date'}
    <select value={current.month} onChange={e=>{setChoice(e.target.value);setTileFailed(false)}}>{samples.map(s=><option key={s.month} value={s.month}>{s.best_scene?.date}</option>)}</select>
   </label>
  </div>
  <div className="b-satellite-image" role="img" aria-label={isEs?'Imagen regional de NASA y contorno de la chacra':'NASA regional satellite image with field outline'}>
   <MapContainer key={scene.date} center={[lat,lon]} zoom={12} scrollWheelZoom={false} zoomControl={false} className="b-satellite-photo">
    <TileLayer url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}" attribution="Esri, Maxar, Earthstar Geographics"/>
    <WMSTileLayer url="https://gibs.earthdata.nasa.gov/wms/epsg3857/best/wms.cgi"
     layers="MODIS_Terra_CorrectedReflectance_TrueColor" format="image/png" transparent={true}
     styles="" version="1.1.1" time={scene.date} opacity={1}
     attribution="NASA GIBS / MODIS Terra" eventHandlers={{tileerror:()=>setTileFailed(true)}}/>
    <Polygon positions={points.map(p=>[p[1],p[0]] as [number,number])} pathOptions={{color:'#f4c74f',weight:3,fillColor:'#f4c74f',fillOpacity:.06}}/>
   </MapContainer>
   {tileFailed&&<div className="b-satellite-image-notice">{isEs?'No se pudo cargar la vista regional NASA para esta fecha; el mapa de fondo sigue disponible.':'NASA regional image unavailable for this date; base imagery remains visible.'}</div>}
  </div>
  <div className="b-satellite-summary">
   <span><b>{isEs?'Lectura de vegetación del terreno':'Field vegetation reading'}</b> {current.ndvi?.toFixed(2)}</span>
   <span><b>{isEs?'Meses con información':'Months with readings'}</b> {monthsWithData}/{monthsTotal}</span>
  </div>
  <p className="b-satellite-honesty">
   {isEs?'La vista a color es de NASA MODIS (regional). La lectura del terreno se calculó con imágenes HLS de mayor detalle. Las fotos ayudan a ver cambios, pero no indican qué cultivo se sembró.':'Colour imagery is regional NASA MODIS. Field readings were calculated from higher-detail HLS imagery. Photos show changes, not crop identity.'}
  </p>
  <div className="b-satellite-links">
   {source&&<a href={source} target="_blank" rel="noreferrer">{isEs?'Consultar la imagen HLS utilizada':'Inspect the source HLS scene'}</a>}
   <a href={'https://worldview.earthdata.nasa.gov/?l=MODIS_Terra_CorrectedReflectance_TrueColor&t='+scene.date} target="_blank" rel="noreferrer">{isEs?'Abrir foto regional en NASA':'View regional image at NASA'}</a>
  </div>
  <details className="b-technical"><summary>{isEs?'Información de las imágenes':'Imagery details'}</summary>
   <p>{sensor} · {isEs?'Fecha':'Date'}: {scene.date} · {isEs?'Píxeles válidos':'Valid pixels'}: {scene.valid_pixels??'—'}</p>
   <p>{isEs?'El valor de vegetación proviene de píxeles despejados de la chacra; no de la foto regional.':'Vegetation values come from clear field pixels, not from the regional image.'}</p>
  </details>
 </div>
}
