import {useEffect, useMemo, useState} from 'react'
import {CircleMarker, MapContainer, Marker, Popup, Polygon, Polyline, Rectangle, TileLayer, WMSTileLayer, useMap, useMapEvents} from 'react-leaflet'
import L from 'leaflet'
import {approximatePolygonHectares, validatePolygon} from './geometry'
import type {ApiResult, Position, RecordRow} from './domain'
import './geo-workspace.css'

type Layer = 'rain' | 'temperature' | 'humidity' | 'scenes' | 'gpm_map' | 'smap_map' | 'ndvi_map'
type Base = 'streets' | 'satellite'
type Scene = {date:string;cloud_cover_percent:number;satellite:string;scene_id:string}
type SceneResponse = {scenes:Scene[];status:string;source_url:string}
type Area = [Position,Position]
type Seasonality={source:string;period:{from:number;to:number};coverage_ok:boolean;months:{month:number;years_with_data:number;median_rain_mm:number|null}[]}
type History={source:string;period:{start_year:number;end_year:number};records:{year:number;status:'complete'|'partial'|'unavailable';precipitation_total_mm:number|null}[]}

const vertexIcon = L.divIcon({className:'terra-poly-vertex',html:'<span aria-hidden="true"></span>',iconSize:[17,17],iconAnchor:[8,8]})

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

function MapSelection({draw,polygonDrawing,onPoint,onCorner,onPolygonVertex}:{draw:boolean;polygonDrawing:boolean;onPoint:(p:Position)=>void;onCorner:(p:Position)=>void;onPolygonVertex:(p:Position)=>void}) {
  useMapEvents({click(e){
    const p={lat:Number(e.latlng.lat.toFixed(6)),lng:Number(e.latlng.lng.toFixed(6))}
    if(polygonDrawing){onPolygonVertex(p)}else if(draw){onCorner(p)}else{onPoint(p)}
  }})
  return null
}

function boundsForPoint(p:Position):[[number,number],[number,number]]{
  // NASA STAC search uses an approximately 2 km radius, NOT a property boundary.
  const lat=2/111.32
  const lon=2/(111.32*Math.max(.05,Math.abs(Math.cos(p.lat*Math.PI/180))))
  return [[Math.max(-90,p.lat-lat),Math.max(-180,p.lng-lon)],[Math.min(90,p.lat+lat),Math.min(180,p.lng+lon)]]
}

function approxHectares(area:Area):number{
  const rad=Math.PI/180
  const a=area[0].lat*rad,b=area[1].lat*rad
  const lon=Math.abs(area[0].lng-area[1].lng)*rad
  return 6371.0088**2*Math.abs(Math.sin(b)-Math.sin(a))*lon*100
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

export function GeoWorkspace({point,onPick,data,loading,language,api,compact=false,seasonal,seasonalLoading=false,seasonalError='',onSeasonality,history,historyLoading=false,historyError='',onHistory}:{point:Position|null;onPick:(p:Position)=>void;data:ApiResult|null;loading:boolean;language:string;api:string;compact?:boolean;seasonal:Seasonality|null;seasonalLoading:boolean;seasonalError:string;onSeasonality:()=>void;history:History|null;historyLoading:boolean;historyError:string;onHistory:()=>void}){
  const en=language==='en'
  const [layer,setLayer]=useState<Layer>('rain')
  const [base,setBase]=useState<Base>('streets')
  const [area,setArea]=useState<Area|null>(null)
  const [polygon,setPolygon]=useState<Position[]|null>(null)
  const [polygonDrawing,setPolygonDrawing]=useState(false)
  const [draftVertices,setDraftVertices]=useState<Position[]>([])
  const [polygonError,setPolygonError]=useState('')
  const [corner,setCorner]=useState<Position|null>(null)
  const [draw,setDraw]=useState(false)
  const [date,setDate]=useState('')
  const [scenes,setScenes]=useState<SceneResponse|null>(null)
  const [loadingScenes,setLoadingScenes]=useState(false)
  const [sceneError,setSceneError]=useState('')
  useEffect(()=>{setScenes(null);setSceneError('')},[point?.lat,point?.lng])
  const records=data?.records||[]
  const last=records.length?records[records.length-1].date:''
  const maxMonthlyRain=Math.max(0,...(seasonal?.months.map(m=>m.median_rain_mm||0)||[]))
  const fullHistory=history?.records.filter(y=>y.status==='complete'&&y.precipitation_total_mm!==null)||[]
  const maxAnnualRain=Math.max(0,...fullHistory.map(y=>y.precipitation_total_mm||0))
  const current=useMemo(()=>records.find(r=>r.date===date)||records[records.length-1]||null,[records,date])
  const unit=layer==='rain'?'mm':layer==='temperature'?'°C':layer==='humidity'?'%':''
  const nasaLayer=layer==='gpm_map'?'IMERG_Precipitation_Rate':layer==='smap_map'?'SMAP_L4_Analyzed_Surface_Soil_Moisture':layer==='ndvi_map'?'MODIS_Terra_NDVI_8Day':null
  const rasterDate=current?.date||last
  const value=layer==='rain'?current?.PRECTOTCORR:layer==='temperature'?current?.T2M:layer==='humidity'?current?.RH2M:null
  const shownValue=value===null||value===undefined||!Number.isFinite(value)?'—':Number(value).toFixed(1)
  const title=layer==='rain'?(en?'Rain on this date':'Lluvia de ese día'):layer==='temperature'?(en?'Air temperature':'Temperatura del aire'):layer==='humidity'?(en?'Air humidity':'Humedad del aire'):layer==='gpm_map'?(en?'Satellite rainfall map':'Mapa de lluvia satelital'):layer==='smap_map'?(en?'Regional soil moisture':'Humedad regional del suelo'):layer==='ndvi_map'?(en?'Vegetation index image':'Índice de vegetación'):(en?'Satellite scenes':'Imágenes disponibles')
  function choosePoint(p:Position){setArea(null);setPolygon(null);setPolygonDrawing(false);setDraftVertices([]);setDraw(false);setCorner(null);onPick(p)}
  function chooseCorner(p:Position){
    if(!corner){setCorner(p);return}
    if(Math.abs(corner.lat-p.lat)<.00001||Math.abs(corner.lng-p.lng)<.00001||Math.abs(corner.lng-p.lng)>180){return}
    const a:Area=[corner,p]
    setArea(a);setPolygon(null);setCorner(null);setDraw(false)
    onPick({lat:Number(((corner.lat+p.lat)/2).toFixed(6)),lng:Number(((corner.lng+p.lng)/2).toFixed(6))})
  }
  function finishPolygon(){
    const check=validatePolygon(draftVertices)
    if(!check.valid){setPolygonError(en?'The outline crosses itself, is too large or needs more corners.':'El contorno se cruza, es muy grande o necesita más esquinas.');return}
    setPolygon(draftVertices);setDraftVertices([]);setPolygonDrawing(false);setPolygonError('');setArea(null)
    const center={lat:Number((draftVertices.reduce((v,p)=>v+p.lat,0)/draftVertices.length).toFixed(6)),lng:Number((draftVertices.reduce((v,p)=>v+p.lng,0)/draftVertices.length).toFixed(6))}
    onPick(center)
  }
  function moveVertex(index:number,p:Position){
    if(!polygon)return false
    const candidate=polygon.map((v,i)=>i===index?p:v)
    if(!validatePolygon(candidate).valid){setPolygonError(en?'This corner would make the outline invalid.':'Esa esquina haría que el contorno no sea válido.');return false}
    setPolygon(candidate);setPolygonError('');return true
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
          {nasaLayer&&rasterDate&&point&&<WMSTileLayer key={`${nasaLayer}-${rasterDate}`} url="https://gibs.earthdata.nasa.gov/wms/epsg3857/best/wms.cgi" layers={nasaLayer} styles="" format="image/png" transparent={true} version="1.1.1" time={rasterDate} opacity={0.76} attribution='NASA GIBS / ESDIS'/>}
          <Recenter point={point}/>
          <MapSelection draw={draw} polygonDrawing={polygonDrawing} onPoint={choosePoint} onCorner={chooseCorner} onPolygonVertex={p=>{setDraftVertices(v=>v.length>=100?v:[...v,p]);setPolygonError('')}}/>
          {point&&<Marker position={[point.lat,point.lng]} icon={markerIcon}><Popup>{en?'Your selected reference point':'Punto de referencia elegido'}<br/>{point.lat.toFixed(5)}, {point.lng.toFixed(5)}</Popup></Marker>}

          {point&&layer==='scenes'&&<Rectangle bounds={boundsForPoint(point)} pathOptions={{color:'#a45d2b',weight:2,dashArray:'7 5',fillOpacity:.07}}><Popup>{en?'Approximate scene search area, not a field boundary':'Área aproximada de búsqueda de imágenes, no límites de tu terreno'}</Popup></Rectangle>}
          {polygon&&<Polygon positions={polygon.map(p=>[p.lat,p.lng])} pathOptions={{color:'#147449',weight:3,fillColor:'#4bc28b',fillOpacity:.13}}><Popup>{en?'Approximate polygon, not surveyed':'Polígono aproximado, no medición catastral'}</Popup></Polygon>}
          {polygon&&polygon.map((v,i)=><Marker key={`vertex-${i}`} position={[v.lat,v.lng]} draggable={true} icon={vertexIcon} eventHandlers={{dragend:(e:any)=>{const q=e.target.getLatLng();if(!moveVertex(i,{lat:q.lat,lng:q.lng}))e.target.setLatLng([v.lat,v.lng])}}}><Popup>{en?'Drag to adjust corner':'Arrastra para ajustar la esquina'} {i+1}</Popup></Marker>)}
          {draftVertices.length>=2&&<Polyline positions={draftVertices.map(v=>[v.lat,v.lng])} pathOptions={{color:'#147449',weight:2,dashArray:'5 7'}}/>}
          {area&&<Rectangle bounds={boundsForArea(area)} pathOptions={{color:'#0d694a',weight:3,fillColor:'#42bd91',fillOpacity:.12}}><Popup>{en?'Approximate area drawn by the user; not surveyed':'Área aproximada dibujada, no delimitación catastral'}</Popup></Rectangle>}
          {point&&current&&layer!=='scenes'&&value!==null&&value!==undefined&&<CircleMarker center={[point.lat,point.lng]} radius={24} pathOptions={{color:layer==='rain'?'#287bb5':layer==='temperature'?'#c26d24':'#6b5ca9',weight:3,fillOpacity:.28}}><Popup>{title}: {shownValue} {unit}<br/>{current.date}<br/>{en?'Regional observation only':'Dato regional, no medición del terreno'}</Popup></CircleMarker>}

        </MapContainer>
        <div className="terra-geo-draw-actions">
          <button type="button" aria-pressed={draw} onClick={()=>{setDraw(v=>!v);setPolygonDrawing(false);setDraftVertices([]);setCorner(null)}}>{draw?(corner?(en?'Pick opposite corner':'Marca la esquina opuesta'):(en?'Pick first corner':'Marca la primera esquina')):(en?'Draw approximate area':'Delimitar área aproximada')}</button>
          <button type="button" aria-pressed={polygonDrawing} onClick={()=>{setPolygonDrawing(v=>!v);setDraw(false);setCorner(null);setDraftVertices([]);setPolygonError('')}}>{polygonDrawing?(en?'Stop adding corners':'Dejar de marcar esquinas'):(en?'Draw polygon':'Dibujar polígono')}</button>
          {polygonDrawing&&<button type="button" onClick={finishPolygon} disabled={draftVertices.length<3}>{en?'Finish outline':'Terminar contorno'} ({draftVertices.length})</button>}
          {polygonDrawing&&draftVertices.length>0&&<button type="button" onClick={()=>setDraftVertices(v=>v.slice(0,-1))}>{en?'Undo corner':'Deshacer esquina'}</button>}
          {polygon&&<button type="button" onClick={()=>{setPolygon(null);setPolygonDrawing(false)}}>{en?'Clear polygon':'Borrar polígono'}</button>}
          {area&&<button type="button" onClick={()=>{setArea(null);setCorner(null);setDraw(false)}}>{en?'Clear area':'Borrar área'}</button>}
        </div>
        {polygonError&&<p role="alert" className="terra-geo-poly-error">{polygonError}</p>}
        <div className="terra-geo-map-caption">{polygon?(en?`Drawn polygon: about ${approximatePolygonHectares(polygon).toLocaleString('en-US',{maximumFractionDigits:2})} hectares; not surveyed.`:`Polígono dibujado: aproximadamente ${approximatePolygonHectares(polygon).toLocaleString('es-PE',{maximumFractionDigits:2})} hectáreas; no catastral.`):area?(en?`Drawn area: approximately ${approxHectares(area).toLocaleString('en-US',{maximumFractionDigits:1})} hectares; not surveyed.`:`Área dibujada: aproximadamente ${approxHectares(area).toLocaleString('es-PE',{maximumFractionDigits:1})} hectáreas; sin medición catastral.`):(en?'Click the map to choose a point.':'Haz clic para elegir un punto.')}</div>
      </div>
      <aside className="terra-geo-inspector">
        <div className="terra-geo-layer-title"><strong>{en?'What do you want to explore?':'¿Qué quieres explorar?'}</strong><small>{en?'Select one view':'Elige una vista'}</small></div>
        <div className="terra-geo-layer-pills">
          {([['rain',en?'Rain':'Lluvia'],['temperature',en?'Temperature':'Temperatura'],['humidity',en?'Air humidity':'Humedad'],['scenes',en?'Satellite dates':'Imágenes'],['gpm_map',en?'Satellite rain map':'Mapa lluvia NASA'],['smap_map',en?'Soil moisture map':'Mapa humedad suelo'],['ndvi_map',en?'Vegetation index':'Vegetación MODIS']] as [Layer,string][]).map(([id,label])=><button key={id} type="button" aria-pressed={layer===id} className={layer===id?'active':''} onClick={()=>setLayer(id)}>{label}</button>)}
        </div>
        {nasaLayer?<div className="terra-geo-reading terra-geo-raster-reading">
          <small>NASA GIBS · {layer==='gpm_map'?'GPM IMERG':layer==='smap_map'?'SMAP L4':'MODIS NDVI (8 días)'}</small>
          <h3>{title}</h3>
          <label className="terra-geo-date">{en?'Observation date':'Fecha de observación'}<select value={current?.date||last} onChange={e=>setDate(e.target.value)} disabled={!records.length}>{records.slice().reverse().map(r=><option key={r.date} value={r.date}>{r.date}</option>)}</select></label>
          <p>{layer==='gpm_map'?(en?'Daily visualisation of satellite-based precipitation rate. The colours do not measure rain accumulated on your specific field.':'Visualización diaria de la intensidad de lluvia estimada por satélite. Los colores no miden la lluvia acumulada en tu parcela.'):layer==='smap_map'?(en?'SMAP model-based surface soil moisture, with approximately 9 km cells. Not a soil sensor reading at your field.':'Humedad superficial estimada por el modelo SMAP, aproximadamente a 9 km de resolución. No es la lectura de un sensor de tu terreno.'):(en?'A NASA MODIS 8-day vegetation index image (roughly 250 m); not a Sentinel-2 field-health diagnosis. The selected day may have no image.':'Imagen de índice de vegetación MODIS de NASA, compuesta en 8 días (aprox. 250 m). No es un diagnóstico de salud de tus cultivos ni un análisis Sentinel-2. Puede no haber imagen para esa fecha.')}</p>
          <p>{en?'This is a NASA-provided colour map; the image may have gaps, cloud-related limitations or missing dates. It is not a measurement from the selected rectangle.':'Es un mapa de colores proporcionado por NASA. Puede tener zonas sin datos o fechas no disponibles. No es una medición del rectángulo seleccionado.'}</p>
          <a href={`https://worldview.earthdata.nasa.gov/?l=${nasaLayer}&t=${rasterDate}`} target="_blank" rel="noreferrer">{en?'See the original NASA colour legend':'Ver la leyenda de colores original en NASA'}</a>
          <p className="terra-geo-raster-source">{en?'Source: NASA GIBS/Worldview · Date: ':'Fuente: NASA GIBS/Worldview · Fecha: '}{rasterDate||'—'}</p>
          {!point&&<p>{en?'Choose a point first.':'Primero elige una ubicación.'}</p>}
        </div>:layer==='scenes'?<div className="terra-geo-reading">
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
          {layer==='rain'&&point&&<details className="terra-geo-history">
            <summary>{en?'How does rainfall change during the year?':'¿En qué meses suele llover más?'}</summary>
            <p>{en?'A regional historic overview, not a forecast or a farm measurement.':'Resumen histórico regional, no pronóstico ni medición en tu terreno.'}</p>
            {!seasonal&&<button type="button" disabled={seasonalLoading} onClick={onSeasonality}>{seasonalLoading?(en?'Consulting NASA…':'Consultando NASA…'):(en?'Show rainfall by month':'Ver la lluvia por meses')}</button>}
            {seasonalError&&<p role="alert">{seasonalError}</p>}
            {seasonal&&<><p className="terra-geo-subtitle">NASA POWER · {seasonal.period.from}–{seasonal.period.to}</p>
              <div className="terra-geo-bars" role="img" aria-label={en?'Regional monthly rainfall from NASA POWER':'Lluvia mensual regional según NASA POWER'}>
                {seasonal.months.map(m=><div key={m.month} className="terra-geo-bar-cell" title={m.median_rain_mm===null?'Sin datos':`${m.median_rain_mm.toFixed(1)} mm · ${m.years_with_data} años`}>
                  <span>{m.median_rain_mm===null?'—':Math.round(m.median_rain_mm)}</span>
                  <i style={{height:`${m.median_rain_mm===null?0:Math.max(2,(m.median_rain_mm/Math.max(1,maxMonthlyRain))*100)}%`}}/>
                  <small>{new Date(2026,m.month-1,1).toLocaleDateString(en?'en-US':'es-PE',{month:'short'})}</small>
                </div>)}
              </div>
              <p>{seasonal.coverage_ok?(en?'Higher bars indicate months with more historical rain in this regional dataset. They do not tell you when to sow.':'Las barras más altas indican los meses históricamente más lluviosos de esta región. No indican cuándo debes sembrar.'):(en?'Some months do not have enough complete data for reliable comparison.':'Algunos meses no tienen suficientes años completos para compararlos.')}</p>
            </>}
            <details className="terra-geo-year-history"><summary>{en?'Compare five complete years':'Comparar cinco años completos'}</summary>
              {!history&&<button type="button" disabled={historyLoading} onClick={onHistory}>{historyLoading?(en?'Consulting NASA…':'Consultando NASA…'):(en?'Show year comparison':'Ver comparación por años')}</button>}
              {historyError&&<p role="alert">{historyError}</p>}
              {history&&<><div className="terra-geo-year-bars">{fullHistory.map(y=><div key={y.year} className="terra-geo-year-row"><span>{y.year}</span><i><b style={{width:`${Math.max(1,((y.precipitation_total_mm||0)/Math.max(1,maxAnnualRain))*100)}%`}}/></i><strong>{Math.round(y.precipitation_total_mm||0)} mm</strong></div>)}</div>
                <p>{en?'Only complete years are shown. Year-to-year differences are not forecasts or verified trends.':'Solo se muestran años completos. Las diferencias entre años no son pronósticos ni tendencias climáticas verificadas.'}</p></>}
            </details>
          </details>}

          {!point&&<p>{en?'Choose a point on the map first.':'Primero elige un punto en el mapa.'}</p>}
          {data&&<small>{data.period.start} — {data.period.end}</small>}
        </div>}
        <div className="terra-geo-key"><strong>{en?'How to read this map':'Cómo interpretar el mapa'}</strong><p><span className="terra-geo-legend-dot"/> {en?'Colored circle: regional value for one NASA POWER query point. It is not a gridded field map.':'Círculo de color: valor regional para un punto de consulta NASA POWER. No es un mapa de cada parcela.'}</p><p><span className="terra-geo-legend-line"/> {en?'Green outline: the approximate area you drew.':'Contorno verde: área aproximada que dibujaste.'}</p><p>{en?'Base map: OSM streets or Esri aerial imagery. The aerial photo is NOT a computed Sentinel-2 or NASA vegetation layer.':'Fondo: calles de OSM o foto aérea de Esri. La fotografía NO es un análisis de vegetación NASA ni de Sentinel-2.'}</p><p>{en?'NASA GIBS satellite maps are visual layers. The numeric point readings come from NASA POWER, a different product. Sentinel-2 vegetation indices and slope rasters are not computed here; MODIS NDVI is an existing NASA visualization.':'Los mapas satelitales NASA GIBS son capas visuales. Los valores numéricos del punto provienen de NASA POWER, que es otro producto. Aún no calculamos índices de vegetación Sentinel-2 ni mapas de pendiente; el NDVI MODIS es una visualización existente de NASA.'}</p></div>
      </aside>
    </div>
  </section>
}
