/** BIOTEX Chalhuas: evidence-gated public preview. Stable Barranca stays accessible.
 * Farmer confirms all crops; no local AI has been trained in Junín.
 * All map polygons are either farmer-drawn or explicitly synthetic examples.
 */
import {useEffect,useMemo,useState} from 'react'
import {CircleMarker,MapContainer,Polygon,Polyline,TileLayer,WMSTileLayer,useMap,useMapEvents} from 'react-leaflet'
import {API,httpErrorMessage} from './network'
import {approximatePolygonHectares,validatePolygon,type GeoPoint} from './geometry'
import BioTour from './BioTour'
import './chalhuas-pilot.css'

type Point=GeoPoint
type Shape={type:'Polygon';coordinates:number[][][]}
type Lang='es'|'en'
type CropId='papa'|'arveja'|'haba'|'quinua'|'cebada'|'avena'
type Climate={status:string;year:number;min_air_temperature_c?:number;rainfall_sum_mm?:number;days_at_or_below_zero_c?:number;valid_days?:number;months?:{month:number;min_air_temperature_c:number|null;rainfall_sum_mm:number|null;valid_days:number}[];source_url?:string}
type Terrain={elevation_m:number;approximate_gradient_degrees:number;resolution_m_approx:number;source_url:string;not_field_measurement?:boolean}
type Power={source:string;period:string;annual_et0_mm:number;source_url?:string}
type Scenario={id:string;title_es:string;title_en:string;schedule:{campaign:number;year:number;crop_id:CropId;name_es:string;family:string;dates_verified:boolean}[];
 indicators:{botanical_families:number;adjacent_family_repetitions:number;legume_campaigns:number;potato_return_interval_campaigns:number[]|null};flags_es:string[];limitations_es:string[]}
type Decision={status:string;strategies:Scenario[];automatic_recommendation:null;model_status:string;water_note_es:string;comparison_summary_es:string;start_year:number;end_year:number;source_records:{title:string;url:string}[]}
type HLSHistory={sensor:string;months_with_data:number;months_total:number;months:{month:string;ndvi:number|null}[]}
type EcoScenes={status:string;scenes?:{granule_name:string;acquisition_time:string;temperature_c:null;quality_verified:false}[];temperature_values_available:false;note_es:string}
type Parcel={id:string;polygon:Shape}
type Drawing='field'|'subplot'|null
type Layer='image'|'vegetation'|'rain'|'terrain'

const LOC={lat:-12.04700155,lng:-75.36633862}
const CROPS:{id:CropId;es:string;en:string;family:string;color:string}[]=[
 {id:'papa',es:'Papa',en:'Potato',family:'Solanaceae',color:'#c9895c'},
 {id:'arveja',es:'Arveja',en:'Pea',family:'Fabaceae',color:'#57976d'},
 {id:'haba',es:'Haba',en:'Fava bean',family:'Fabaceae',color:'#367c5a'},
 {id:'quinua',es:'Quinua',en:'Quinoa',family:'Amaranthaceae',color:'#aa8b60'},
 {id:'cebada',es:'Cebada',en:'Barley',family:'Poaceae',color:'#d2b36b'},
 {id:'avena',es:'Avena',en:'Oats',family:'Poaceae',color:'#699ab1'}
]
const NAMES=Object.fromEntries(CROPS.map(x=>[x.id,x]))
const study='https://cdn.www.gob.pe/uploads/document/file/5501553/4903730-estudio-agrologico.pdf?v=1701297728'
const inia='https://repositorio.inia.gob.pe/bitstream/20.500.12955/1146/1/MANUAL%20T%C3%89CNICO%20-%20MANEJO%20INTEGRADO%20DEL%20CULTIVO%20DE%20PAPA.pdf'
const halfLat=.00058,halfLng=.00078
// Fictional rectangular sketch around the statistical-sector reference point.
// NEVER state this is a real field or known farmer's property.
const demoShape=rectangle(LOC.lat-halfLat,LOC.lng-halfLng,LOC.lat+halfLat,LOC.lng+halfLng)
const demoParcels=[
 {id:'A',polygon:rectangle(LOC.lat-halfLat,LOC.lng-halfLng,LOC.lat+halfLat,LOC.lng)},
 {id:'B',polygon:rectangle(LOC.lat-halfLat,LOC.lng,LOC.lat+halfLat,LOC.lng+halfLng)}
]
function rectangle(south:number,west:number,north:number,east:number):Shape{
 return {type:'Polygon',coordinates:[[[west,south],[east,south],[east,north],[west,north],[west,south]]]}
}
function points(shape:Shape):Point[]{return shape.coordinates[0].slice(0,-1).map(([lng,lat])=>({lat,lng}))}
function shapeFrom(points:Point[]):Shape{return {type:'Polygon',coordinates:[[...points.map(p=>[p.lng,p.lat]),[points[0].lng,points[0].lat]]]}}
function centre(shape:Shape):Point{const p=points(shape);return{lat:p.reduce((s,x)=>s+x.lat,0)/p.length,lng:p.reduce((s,x)=>s+x.lng,0)/p.length}}
function hectares(shape:Shape){return approximatePolygonHectares(points(shape))}
const cropName=(id:CropId,lang:Lang)=>NAMES[id]?.[lang]??id

function MoveMap({centre:target,field}:{centre:Point;field:Shape|null}){
 const map=useMap()
 useEffect(()=>{
  if(field){const ps=points(field);map.fitBounds(ps.map(p=>[p.lat,p.lng] as [number,number]),{padding:[36,36],maxZoom:17})}
  else map.setView([target.lat,target.lng],14)
 },[map,target.lat,target.lng,field])
 return null
}
function DrawClicks({mode,onPoint}:{mode:Drawing;onPoint:(point:Point)=>void}){
 useMapEvents({click:(event)=>{if(mode)onPoint({lat:event.latlng.lat,lng:event.latlng.lng})}})
 return null
}
function FieldMap({field,subplots,drawing,vertices,onPoint,layer,lowData,layerDate,opacity,viewYear,scenario,overrides,isDemo,onSelectParcel}:{
 field:Shape|null;subplots:Parcel[];drawing:Drawing;vertices:Point[];onPoint:(p:Point)=>void;layer:Layer;lowData:boolean;
 layerDate:string;opacity:number;viewYear:number;scenario:Scenario|null;
 overrides:Record<string,CropId>;isDemo:boolean;onSelectParcel:(id:string)=>void
}){
 const p=useMemo(()=>field?centre(field):LOC,[field])
 const [tileError,setTileError]=useState(false)
 useEffect(()=>setTileError(false),[layer,layerDate])
 const cropAt=(index:number,parcel:Parcel):CropId|null=>{
  if(!scenario)return null
  const key=parcel.id+':'+viewYear
  return overrides[key]||scenario.schedule[(viewYear+(isDemo?index:0))%4]?.crop_id||null
 }
 return <div className="c-map-box" data-bio-target="bio-map">
  <MapContainer center={[p.lat,p.lng]} zoom={14} className="c-map" scrollWheelZoom={false}>
   <TileLayer key={lowData?'streets':layer==='terrain'?'terrain':'imagery'} url={lowData?'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png':layer==='terrain'?'https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}':'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'}
    attribution={lowData?'© OpenStreetMap contributors':'Imagery © Esri, Maxar, Earthstar Geographics'}/>
   {!lowData&&(layer==='vegetation'||layer==='rain')&&<WMSTileLayer key={layer+layerDate} url="https://gibs.earthdata.nasa.gov/wms/epsg3857/best/wms.cgi"
    layers={layer==='vegetation'?'MODIS_Terra_NDVI_8Day':'IMERG_Precipitation_Rate'}
    version="1.1.1" styles="" transparent={true} format="image/png" opacity={opacity}
    {...{time:layerDate}} attribution="NASA GIBS / ESDIS" eventHandlers={{tileerror:()=>setTileError(true)}} />}
   <MoveMap centre={p} field={field}/>
   <DrawClicks mode={drawing} onPoint={onPoint}/>
   {!field&&<CircleMarker center={[LOC.lat,LOC.lng]} radius={8} pathOptions={{color:'#fff8db',fillColor:'#215c40',fillOpacity:1,weight:3}}/>}
   {field&&<Polygon positions={points(field).map(p=>[p.lat,p.lng] as [number,number])}
    pathOptions={{color:'#f7d06b',weight:4,fillOpacity:.045}}/>}
   {subplots.map((parcel,i)=>{
    const cid=cropAt(i,parcel)
    return <Polygon key={parcel.id} positions={points(parcel.polygon).map(p=>[p.lat,p.lng] as [number,number])}
      pathOptions={{color:cid?'#fff2d5':'#ecf3e0',weight:3,fillColor:cid?NAMES[cid].color:'#7cba9a',fillOpacity:cid?0.52:0.22}}
      eventHandlers={{click:()=>onSelectParcel(parcel.id)}}>
    </Polygon>
   })}
   {vertices.length>=2&&<Polyline positions={vertices.map(p=>[p.lat,p.lng] as [number,number])} pathOptions={{color:'#ffcd54',weight:4,dashArray:'6 6'}}/>}
  </MapContainer>
  {drawing&&<p className="c-map-draw-message" role="status">{drawing==='field'?'Marca al menos 3 esquinas y pulsa «Guardar contorno».':'Marca los límites de la subparcela dentro del terreno principal.'}</p>}
  {tileError&&<p className="c-tile-error" role="status">La capa NASA no tiene una imagen disponible para la fecha seleccionada. El mapa base sigue funcionando.</p>}
 </div>
}

export default function ChalhuasPilotApp(){
 const [lang,setLang]=useState<Lang>('es')
 const es=lang==='es'
 const [step,setStep]=useState<0|1|2|3>(0)
 const [field,setField]=useState<Shape|null>(null)
 const [isDemo,setIsDemo]=useState(false)
 const [subplots,setSubplots]=useState<Parcel[]>([])
 const [selectedParcel,setSelectedParcel]=useState('A')
 const [drawing,setDrawing]=useState<Drawing>(null)
 const [vertices,setVertices]=useState<Point[]>([])
 const [geometryStatus,setGeometryStatus]=useState('')
 const [layer,setLayer]=useState<Layer>('image')
 const [lowData,setLowData]=useState(false)
 const [layerDate,setLayerDate]=useState('2025-11-01')
 const [opacity,setOpacity]=useState(.7)
 const [sequence,setSequence]=useState<CropId[]>(['papa','arveja','papa','arveja'])
 const [historySource,setHistorySource]=useState<'example'|'farmer_declared'>('example')
 const [goal,setGoal]=useState<'water'|'soil'|'both'>('both')
 const [startYear,setStartYear]=useState(2027)
 const [soilKnown,setSoilKnown]=useState(false)
 const [waterKnown,setWaterKnown]=useState(false)
 const [plan,setPlan]=useState<Decision|null>(null)
 const [selectedPlan,setSelectedPlan]=useState('R1')
 const [viewYear,setViewYear]=useState(0)
 const [overrides,setOverrides]=useState<Record<string,CropId>>({})
 const [status,setStatus]=useState('')
 const [busy,setBusy]=useState(false)
 const [terrain,setTerrain]=useState<Terrain|null>(null)
 const [power,setPower]=useState<Power|null>(null)
 const [climate,setClimate]=useState<Climate|null>(null)
 const [evidenceBusy,setEvidenceBusy]=useState(false)
 const [evidenceError,setEvidenceError]=useState('')
 const [hls,setHls]=useState<HLSHistory|null>(null)
 const [hlsBusy,setHlsBusy]=useState(false)
 const [hlsError,setHlsError]=useState('')
 const [eco,setEco]=useState<EcoScenes|null>(null)
 const [ecoBusy,setEcoBusy]=useState(false)
 const [ecoError,setEcoError]=useState('')
 const [catalogueOk,setCatalogueOk]=useState<boolean|null>(null)

 useEffect(()=>{document.documentElement.lang=lang},[lang])
 useEffect(()=>{
  let cancelled=false
  fetch(API+'/api/andes/catalog').then(r=>{if(!cancelled)setCatalogueOk(r.ok)}).catch(()=>{if(!cancelled)setCatalogueOk(false)})
  return()=>{cancelled=true}
 },[])
 const selected=plan?.strategies.find(s=>s.id===selectedPlan)||null
 const fieldArea=field?hectares(field):0
 const pageTitle=es?['Mi terreno','Mis cultivos','Mis prioridades','Mi plan agrícola'][step]:['My field','My crops','My priorities','My farm plan'][step]
 const labels=es?['Mi terreno','Mis cultivos','Mis prioridades','Mi plan']:['My field','My crops','My priorities','My plan']
 const sourceStatus=catalogueOk===false?(es?'La API del nuevo piloto no responde. Puedes explorar el mapa, pero todavía no comparar rotaciones.':'Pilot API unavailable; map remains usable but rotations cannot be compared.'):''

 function changeStep(value:0|1|2|3){
  setStep(value);setStatus('')
  window.scrollTo({top:0,behavior:'auto'})
 }
 function selectDemo(){
  setHls(null);setEco(null);setTerrain(null);setClimate(null);setPower(null)
  setField(demoShape);setSubplots(demoParcels);setIsDemo(true);setDrawing(null);setVertices([])
  setPlan(null);setOverrides({});setGeometryStatus(es?'Ejemplo sintético: sus límites no corresponden a un predio comprobado.':'Synthetic sketch: boundaries do not describe a verified property.')
  setSelectedParcel('A')
 }
 function startDraw(mode:Drawing){
  if(mode==='field'){setField(null);setSubplots([]);setIsDemo(false);setPlan(null);setOverrides({});setHls(null);setEco(null);setTerrain(null);setClimate(null);setPower(null)}
  setDrawing(mode);setVertices([]);setGeometryStatus('')
 }
 async function finishDraw(){
  const ok=validatePolygon(vertices)
  const area=approximatePolygonHectares(vertices)
  if(!ok.valid||area<(drawing==='field'?.1:.01)||area>500){
   setGeometryStatus(es?'El contorno es inválido o su superficie está fuera del intervalo permitido.':'Invalid outline or area outside supported limits.');return
  }
  const polygon=shapeFrom(vertices)
  if(drawing==='field'){
   setField(polygon);setSubplots([{id:'Lote único',polygon}]);setSelectedParcel('Lote único');setIsDemo(false);setPlan(null)
   setGeometryStatus(es?'Contorno registrado por ti. La superficie es aproximada, no catastral.':'Your outline is saved. Area is approximate, not cadastral.')
   setDrawing(null);setVertices([]);return
  }
  if(!field)return
  const existing=subplots.length===1&&subplots[0].id==='Lote único'?[]:subplots
  const id=String.fromCharCode(65+existing.length)
  try{
   const candidate=[...existing,{id,polygon}]
   const response=await fetch(API+'/api/andes/validate-subplots',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({field,subplots:candidate})})
   if(!response.ok)throw new Error(await httpErrorMessage(response,!es))
   setSubplots(candidate);setSelectedParcel(id);setDrawing(null);setVertices([]);setOverrides({})
   setGeometryStatus(es?'Subparcela registrada: dentro del contorno y sin solapamientos. Geometría aproximada.':'Plot stored inside the field without overlaps. Geometry is approximate.')
  }catch(error){setGeometryStatus(error instanceof Error?error.message:(es?'No se pudo validar la subparcela.':'Could not validate subplot.'))}
 }
 function saveProject(){
  try{
   const payload={version:1,field,isDemo,subplots,sequence,historySource,goal,startYear,overrides}
   localStorage.setItem('biotex-chalhuas-v1',JSON.stringify(payload))
   setStatus(es?'Datos guardados en este navegador. No son un registro catastral.':'Saved in this browser. Not a cadastral record.')
  }catch{setStatus(es?'Tu navegador no permitió guardar estos datos.':'Browser storage unavailable.')}
 }
 function restoreProject(){
  try{
   const data=JSON.parse(localStorage.getItem('biotex-chalhuas-v1')||'null')
   if(!data||data.version!==1)throw Error('bad')
   if(data.field){const p=points(data.field);if(!validatePolygon(p).valid||hectares(data.field)<.1||hectares(data.field)>500)throw Error('invalid polygon')}
   setField(data.field||null);setIsDemo(Boolean(data.isDemo));setSubplots(Array.isArray(data.subplots)?data.subplots:[])
   setSequence(Array.isArray(data.sequence)&&data.sequence.length===4&&data.sequence.every((x:CropId)=>NAMES[x])?data.sequence:['papa','arveja','papa','arveja'])
   setHistorySource(data.historySource==='farmer_declared'?'farmer_declared':'example')
   if(['water','soil','both'].includes(data.goal))setGoal(data.goal)
   if(Number.isInteger(data.startYear)&&data.startYear>=2020&&data.startYear<=2035)setStartYear(data.startYear)
   setOverrides(data.overrides&&typeof data.overrides==='object'?data.overrides:{})
   setPlan(null);setStatus(es?'Proyecto restaurado. Comprueba los contornos y los cultivos.':'Project restored. Check plot boundaries and crops.')
  }catch{setStatus(es?'No hay un proyecto válido para recuperar.':'No valid project saved.')}
 }
 async function evidence(){
  if(!field)return
  setEvidenceBusy(true);setEvidenceError('')
  const at=centre(field)
  const jobs=await Promise.allSettled([
   fetch(API+'/api/environment/terrain?latitude='+at.lat+'&longitude='+at.lng).then(async r=>{if(!r.ok)throw Error('SRTM');return await r.json() as Terrain}),
   fetch(API+'/api/andes/era5-land?latitude='+at.lat+'&longitude='+at.lng+'&year=2025').then(async r=>{if(!r.ok)throw Error('ERA5');return await r.json() as Climate}),
   fetch(API+'/api/rotation/climate?latitude='+at.lat+'&longitude='+at.lng).then(async r=>{if(!r.ok)throw Error('POWER');return await r.json() as Power})
  ])
  if(jobs[0].status==='fulfilled')setTerrain(jobs[0].value)
  else setTerrain(null)
  if(jobs[1].status==='fulfilled'&&jobs[1].value.status==='available')setClimate(jobs[1].value)
  else setClimate(null)
  if(jobs[2].status==='fulfilled'&&Number.isFinite(jobs[2].value.annual_et0_mm))setPower(jobs[2].value)
  else setPower(null)
  if(jobs.some(x=>x.status==='rejected')||(jobs[1].status==='fulfilled'&&jobs[1].value.status!=='available'))
   setEvidenceError(es?'Alguna fuente no respondió o no dispone de lecturas válidas. No asignamos valores inexistentes.':'Some sources unavailable or insufficient; no values inferred.')
  setEvidenceBusy(false)
 }

 async function loadHls(){
  if(!field)return
  setHlsBusy(true);setHlsError('');setHls(null)
  try{
   for(let attempt=0;attempt<18;attempt++){
    const response=await fetch(API+'/api/rotation/history',{method:'POST',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify({polygon:field,start_year:2021})})
    if(response.status===202){await new Promise(resolve=>setTimeout(resolve,5000));continue}
    if(!response.ok)throw new Error(await httpErrorMessage(response,!es))
    const data=await response.json() as HLSHistory
    if(!Array.isArray(data.months))throw new Error('Invalid satellite response')
    setHls(data);return
   }
   throw new Error(es?'La consulta de imágenes excedió el tiempo disponible. Intenta otra fecha.':'Satellite query timed out; retry later.')
  }catch(e){setHlsError(e instanceof Error?e.message:'No hubo resultados HLS')}
  finally{setHlsBusy(false)}
 }
 async function loadEco(){
  if(!field)return
  setEcoBusy(true);setEcoError('');setEco(null)
  try{
   const p=centre(field)
   const response=await fetch(API+'/api/andes/ecostress-scenes?latitude='+p.lat+'&longitude='+p.lng)
   if(!response.ok)throw new Error(await httpErrorMessage(response,!es))
   setEco(await response.json() as EcoScenes)
  }catch(e){setEcoError(e instanceof Error?e.message:'NASA CMR no disponible')}
  finally{setEcoBusy(false)}
 }
 async function compare(){
  if(!field){setStatus(es?'Primero selecciona o dibuja un terreno.':'Select or draw a field first.');return}
  setBusy(true);setStatus('')
  try{
   const response=await fetch(API+'/api/andes/compare',{method:'POST',headers:{'Content-Type':'application/json'},
     body:JSON.stringify({rotation:sequence,start_year:startYear,priority:goal,history_source:historySource})})
   if(!response.ok)throw Error(await httpErrorMessage(response,!es))
   const data=await response.json() as Decision
   if(data.status!=='illustrative_comparison'||data.automatic_recommendation!==null)throw Error('Respuesta incompatible con el piloto')
   setPlan(data);setSelectedPlan('R1');setViewYear(0);changeStep(3)
  }catch(error){setStatus(error instanceof Error?error.message:'No se pudo completar la comparación.')}
  finally{setBusy(false)}
 }
 const currentCropFor=(parcel:Parcel,i:number):CropId|null=>{
  if(!selected)return null
  return overrides[parcel.id+':'+viewYear]||selected.schedule[(viewYear+(isDemo?i:0))%4]?.crop_id||null
 }
 const share=()=>{if(!plan||!selected)return''
  const crops=selected.schedule.map(x=>x.name_es).join(' → ')
  return 'https://wa.me/?text='+encodeURIComponent('BIOTEX · Chalhuas (plan ilustrativo, no prescripción): '+crops+'. Falta verificar suelo, agua, fechas y aptitud en campo.')}
 return <div className="c-app">
  <a className="c-skip" href="#chalhuas-main">{es?'Ir al contenido':'Skip to content'}</a>
  <header className="c-top"><div className="c-top-inner"><div className="c-logo"><span>✦</span><div><b>BIOTEX</b><small>{es?'Tu tierra, tu decisión.':'Your land, your decision.'}</small></div></div>
   <div className="c-context">{es?'Chalhuas · Valle del Mantaro, Junín':'Chalhuas · Mantaro Valley, Peru'}</div>
   <div className="c-toolbar"><button type="button" className={lang==='es'?'c-lang active':'c-lang'} onClick={()=>setLang('es')}>ES</button>
   <button type="button" className={lang==='en'?'c-lang active':'c-lang'} onClick={()=>setLang('en')}>EN</button>
   <a href="/?pilot=barranca">{es?'Piloto anterior':'Previous pilot'}</a></div></div></header>
  <nav className="c-progress" aria-label={es?'Etapas de BIOTEX':'BIOTEX steps'}>
   {labels.map((label,i)=><button type="button" key={label} aria-current={step===i?'step':undefined} className={step===i?'active':''}
    disabled={i>step||i===3&&!plan} onClick={()=>changeStep(i as 0|1|2|3)}><span>{i+1}</span>{label}</button>)}
  </nav>
  <main id="chalhuas-main" className="c-main">
   <section className="c-intro" data-bio-target="bio-hero">
    <span className="c-kicker">{es?'PILOTO AGRÍCOLA EXPLORATORIO · JUNÍN':'EXPLORATORY AGRICULTURAL PILOT · JUNÍN'}</span>
    <h1>{step===0?(es?'Conoce tu terreno. Explora tus próximas siembras.':'Explore your land. Plan future crops.'):pageTitle}</h1>
    <p>{step===0?(es?'Compara rotaciones agrícolas de referencia con tus propias campañas y visualízalas en el mapa, con evidencia y límites claros.':'Compare reference crop rotations with your own campaigns and visualize them on the map, with clear evidence and limitations.'):
     step===1?(es?'Anota qué cultivaste. Los satélites no identifican las especies por sí solos.':'Record what you planted. Satellites do not identify crop species by themselves.'):
     step===2?(es?'Elige tu prioridad. No afirmaremos ahorro de agua ni aptitud sin mediciones locales.':'Choose your priority. No water savings or crop suitability claims without local measurements.'):
     (es?'Compara opciones y revisa dónde podría sembrarse cada cultivo.':'Compare scenarios and explore where each crop could be planted.')}
    </p>
   </section>
   <div className="c-warning" role="note"><strong>{es?'Importante: demostración en investigación':'Research demonstration'}</strong><span>
    {es?'La referencia cartográfica de Chalhuas no es una parcela verificada. Los límites de ejemplo son sintéticos. No hay una IA entrenada localmente ni una recomendación de siembra validada.':
     'Chalhuas map location is not a verified farm. Example plots are synthetic. No locally trained AI or validated planting prescription is available.'}</span></div>
   {sourceStatus&&<p role="status" className="c-error">{sourceStatus}</p>}

   {step===0&&<section className="c-map-layout">
     <div className="c-card c-map-card">
      <div className="c-card-head"><div><span className="c-small">{es?'ELIGE UNA PARCELA':'CHOOSE A FIELD'}</span><h2>{es?'¿Dónde quieres estudiar la rotación?':'Where would you study rotations?'}</h2></div><span className="c-coordinate">−12.0470, −75.3663</span></div>
      <div className="c-layer-controls" data-bio-target="bio-layers"><div className="c-layer-buttons" role="group" aria-label={es?'Capas del mapa':'Map layers'}>
       {(['image','vegetation','rain','terrain'] as const).map(id=><button key={id} type="button" disabled={lowData&&id!=='image'} aria-pressed={layer===id} className={layer===id?'on':''} onClick={()=>setLayer(id)}>
        {id==='image'?(es?'Foto aérea':'Aerial'):id==='vegetation'?(es?'Vegetación NASA':'NASA vegetation'):id==='rain'?(es?'Lluvia NASA':'NASA rain'):(es?'Relieve':'Terrain')}</button>)}</div>
       <label className="c-low"><input type="checkbox" checked={lowData} onChange={e=>{setLowData(e.target.checked);if(e.target.checked)setLayer('image')}}/>{es?'Ahorrar datos':'Low data'}</label>
       {(layer==='vegetation'||layer==='rain')&&!lowData&&<div className="c-layer-extra"><label>{es?'Fecha de la capa':'Layer date'} <input type="date" value={layerDate} min="2020-01-01" max="2026-11-14" onChange={e=>setLayerDate(e.target.value)}/></label>
        <label>{es?'Transparencia':'Opacity'} <input type="range" min=".2" max="1" step=".1" value={opacity} onChange={e=>setOpacity(Number(e.target.value))}/></label></div>}
       {(layer==='vegetation'||layer==='rain')&&!lowData&&<div className="c-legend"><strong>{layer==='vegetation'?'NASA MODIS NDVI · 250 m':'NASA GPM IMERG · ~10 km'}</strong>
        <div className={layer==='vegetation'?'c-ramp green':'c-ramp blue'}/><div className="c-legend-labels"><span>{layer==='vegetation'?'Menor verdor':'Menor precipitación'}</span><span>{layer==='vegetation'?'Mayor verdor':'Mayor precipitación'}</span></div>
        <small>{es?'Colores orientativos de la variable regional. Consulta la escala oficial en NASA Worldview y verifica si existen teselas para la fecha. No mide una parcela individual.':'Regional thematic guide only. Check the official NASA Worldview scale and tile availability; not field-level data.'}</small>
       </div>}
       {layer==='terrain'&&!lowData&&<div className="c-legend"><strong>{es?'Base topográfica Esri':'Esri topographic base map'}</strong><p className="c-terrain-note">{es?'Los relieves y curvas son cartografía de referencia. Para obtener un valor altitudinal aproximado del entorno, utiliza la consulta SRTM. No es una capa NASADEM ni una medición del predio.':'The contours and relief are reference cartography. Query SRTM separately for approximate regional elevation; this is not NASADEM raster or a field measurement.'}</p></div>}
      </div>
      <FieldMap field={field} subplots={[]} drawing={drawing} vertices={vertices} onPoint={p=>setVertices(x=>[...x,p])}
       layer={layer} lowData={lowData} layerDate={layerDate} opacity={opacity} viewYear={0} scenario={null} overrides={{}} isDemo={false} onSelectParcel={()=>{}}/>
      <div className="c-map-actions" data-bio-target="bio-next">
       {!drawing?<><button className="c-action primary" type="button" onClick={()=>startDraw('field')}>{es?'Dibujar mi terreno':'Draw my field'}</button>
        <button className="c-action secondary" type="button" onClick={selectDemo}>{es?'Probar ejemplo sintético':'Use synthetic example'}</button></>:
        <><button className="c-action primary" type="button" disabled={vertices.length<3} onClick={finishDraw}>{es?'Guardar contorno':'Save outline'}</button>
         <button className="c-action secondary" type="button" disabled={!vertices.length} onClick={()=>setVertices(x=>x.slice(0,-1))}>{es?'Deshacer punto':'Undo point'}</button>
         <button className="c-action secondary" type="button" onClick={()=>{setDrawing(null);setVertices([])}}>{es?'Cancelar':'Cancel'}</button></>}
      </div>
      {geometryStatus&&<p role="status" className="c-inline-note">{geometryStatus}</p>}
      {field&&<div className="c-field-info"><strong>{es?'Terreno seleccionado':'Selected field'}</strong><span>{fieldArea.toFixed(2)} ha · {isDemo?(es?'Contorno inventado para tutorial':'Fictional tutorial shape'):(es?'Contorno dibujado por el usuario':'User-drawn outline')}</span></div>}
     </div>
     <aside className="c-right-col">
      <div className="c-card c-info-card" data-bio-target="bio-demo">
       <span className="c-small">{es?'INICIO RÁPIDO':'QUICK START'}</span>
       <h2>{es?'Conoce el Valle del Mantaro':'Explore Mantaro Valley'}</h2>
       <p>{es?'El estudio de Chalhuas documenta una práctica histórica de alternancia entre papa y arveja. El ejemplo sirve para aprender el proceso; no representa un agricultor identificado.':'A Chalhuas study describes historical potato/pea alternation. The example is for learning only and does not represent a known farmer.'}</p>
       <button type="button" className="c-action warm" onClick={selectDemo}>{es?'Explorar parcela de práctica':'Explore practice field'}</button>
       <a href={study} target="_blank" rel="noreferrer">{es?'Ver estudio agrológico oficial':'Read official agricultural study'}</a>
      </div>
      <div className="c-card c-science-card">
       <h3>{es?'Relieve y clima histórico':'Terrain and historical climate'}</h3>
       <p>{es?'Consulta estimaciones para el punto central del terreno. La altitud SRTM y el clima ERA5-Land son referencias espaciales, no mediciones en la chacra.':'Query estimates at the centre of the field. SRTM elevation and ERA5-Land climate are not measurements on the plot.'}</p>
       <button type="button" className="c-action secondary" onClick={evidence} disabled={!field||evidenceBusy}>{evidenceBusy?(es?'Consultando fuentes…':'Loading…'):(es?'Consultar datos del terreno':'Check environmental context')}</button>
       {terrain&&<div className="c-science-value"><b>{terrain.elevation_m.toFixed(0)} m</b><span>{es?'Elevación aproximada SRTM (90 m)':'Approx. SRTM elevation (90 m)'}</span></div>}
       {terrain&&<div className="c-science-value"><b>{terrain.approximate_gradient_degrees.toFixed(1)}°</b><span>{es?'Gradiente del entorno a 180 m, no pendiente del lote':'Neighbourhood gradient, not field slope'}</span></div>}
       {power&&<div className="c-science-value"><b>{power.annual_et0_mm.toFixed(0)} mm/año</b><span>{es?'ET₀ anual NASA POWER / FAO-56: estimación climática regional, NO riego medido':'Annual NASA POWER / FAO-56 reference ET₀: regional estimate, NOT measured irrigation'}</span></div>}
       {climate&&<><div className="c-science-value"><b>{climate.min_air_temperature_c?.toFixed(1)} °C</b><span>{es?'Mínima regional estimada de 2025':'2025 modelled regional minimum'}</span></div>
        <div className="c-science-value"><b>{climate.rainfall_sum_mm?.toFixed(0)} mm</b><span>{es?'Lluvia regional estimada de 2025':'2025 modelled regional precipitation'}</span></div>
        <details className="c-annual-details"><summary>{es?'Ver los 12 meses de 2025':'View 12 months of 2025'}</summary>
         <p>{es?'Lluvia y mínima del aire por mes (reanálisis regional, no estación del terreno).':'Monthly rain and minimum air temperature (regional reanalysis, not a farm station).'}</p>
         <div className="c-monthly-grid">{climate.months?.map(m=><div key={m.month} className="c-monthly-row">
          <span>{['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Set','Oct','Nov','Dic'][m.month-1]}</span>
          <div className="c-monthly-track"><div style={{width:Math.min(100,Math.max(0,(m.rainfall_sum_mm??0)/(Math.max(1,...(climate.months?.map(x=>x.rainfall_sum_mm||0)||[])))*100))+'%'}}/></div>
          <strong>{m.rainfall_sum_mm?.toFixed(0)??'—'} mm</strong>
          <small>{m.min_air_temperature_c?.toFixed(1)??'—'} °C</small>
         </div>)}</div>
         <a href={climate.source_url} target="_blank" rel="noreferrer">{es?'Ver fuente ERA5-Land':'View ERA5-Land source'}</a>
        </details>
       </>}
       <section className="c-hls-evidence"><h4>{es?'Historia de vegetación HLS (parcela marcada)':'HLS vegetation history (marked area)'}</h4>
        <button type="button" className="c-action secondary" disabled={!field||hlsBusy} onClick={loadHls}>{hlsBusy?(es?'Buscando imágenes NASA HLS…':'Loading NASA HLS scenes…'):(es?'Consultar NDVI histórico':'Check historical NDVI')}</button>
        {hls&&<div className="c-hls-reading"><strong>{hls.months_with_data}/{hls.months_total}</strong><span>{es?'Meses con lecturas válidas':'Months with valid readings'}</span>
         {hls.months.filter(m=>m.ndvi!==null).slice(-1).map(x=><p key={x.month}>{x.month} · NDVI {x.ndvi?.toFixed(2)}. {es?'Solo verdor observado, no especie ni rendimiento.':'Vegetation signal only, not species or yield.'}</p>)}</div>}
        {hlsError&&<p className="c-inline-note" role="status">{hlsError}</p>}
       </section>
       {evidenceError&&<p role="status" className="c-inline-note">{evidenceError}</p>}
       {!(terrain||climate||power)&&!evidenceError&&<p className="c-muted">{es?'Sin consulta realizada: no se muestran cifras.':'No query made: no figures shown.'}</p>}
       <details><summary>{es?'Fuentes y otras capas':'Sources and other layers'}</summary>
        <p><a href="https://power.larc.nasa.gov/" target="_blank" rel="noreferrer">NASA POWER · FAO-56</a></p>
         <p><a href="https://www.opentopodata.org/datasets/srtm/" target="_blank" rel="noreferrer">NASA/USGS SRTM 90 m</a> · <a href="https://open-meteo.com/en/docs/historical-weather-api" target="_blank" rel="noreferrer">ECMWF ERA5-Land</a></p>
        <p>{es?'ECOSTRESS V003: requiere imágenes y máscaras válidas para este lugar; todavía no habilitada. GLDAS: contexto regional en investigación.':'ECOSTRESS V003 needs valid local images and QA; not enabled. GLDAS is research-only regional context.'}</p>
        <button type="button" className="c-action secondary" disabled={!field||ecoBusy} onClick={loadEco}>{ecoBusy?(es?'Buscando escenas NASA…':'Searching NASA scenes…'):(es?'Buscar escenas ECOSTRESS':'Search ECOSTRESS scenes')}</button>
        {eco&&<p className="c-inline-note" role="status">{eco.status==='metadata_only_quality_unverified'?(es?'Se encontraron '+(eco.scenes?.length||0)+' escenas en el catálogo. Ninguna tiene temperatura validada todavía.':'Scene metadata found; none has validated temperature.'):
          (es?'Sin escenas catalogadas en el periodo consultado.':'No catalogued scenes found for the requested period.')}</p>}
        {eco?.scenes?.map(scene=><p className="c-eco-scene" key={scene.granule_name}>{scene.acquisition_time.slice(0,10)} · {scene.granule_name}</p>)}
        {ecoError&&<p role="status" className="c-inline-note">{ecoError}</p>}
       </details>
      </div>
     </aside>
     <div className="c-footer-actions"><button className="c-action secondary" onClick={restoreProject}>{es?'Recuperar proyecto':'Restore project'}</button>
      <button className="c-action primary" disabled={!field} onClick={()=>changeStep(1)}>{es?'Continuar con mis cultivos':'Continue to my crops'} →</button></div>
    </section>}

   {step===1&&<section className="c-form-step">
      <div className="c-card"><span className="c-small">{es?'HISTORIAL DECLARADO':'FARMER HISTORY'}</span><h2>{es?'¿Qué cultivos sueles alternar?':'Which crops do you usually rotate?'}</h2>
       <p>{es?'Indica una secuencia habitual o utiliza la referencia histórica de papa y arveja del estudio de Chalhuas. Después compararemos cuatro campañas futuras; no asumimos que los cultivos permanecen todo el año sobre el terreno.':'Enter your usual crop sequence or use the historical potato-and-pea example from the Chalhuas study. We will compare four future campaigns, not assume year-round crop cover.'}</p>
       <fieldset className="c-history-origin"><legend>{es?'Origen de esta secuencia':'Where this sequence comes from'}</legend>
        <label><input type="radio" name="history-source" checked={historySource==='example'} onChange={()=>{setHistorySource('example');setPlan(null)}}/>{es?'Ejemplo histórico del estudio de Chalhuas':'Historical study example'}</label>
        <label><input type="radio" name="history-source" checked={historySource==='farmer_declared'} onChange={()=>{setHistorySource('farmer_declared');setPlan(null)}}/>{es?'Cultivos de mis campañas, confirmados por mí':'My campaigns, confirmed by me'}</label>
       </fieldset>
       <div className="c-year-grid">{sequence.map((crop,i)=><label key={i} className="c-crop-select"><span>{es?'Campaña':'Campaign'} {i+1}</span>
        <select value={crop} onChange={e=>{setSequence(v=>v.map((x,j)=>i===j?e.target.value as CropId:x));setPlan(null)}}>{CROPS.map(c=><option key={c.id} value={c.id}>{cropName(c.id,lang)} · {c.family}</option>)}</select></label>)}</div>
       <p className="c-inline-note">{es?'Los satélites observan vegetación, no certifican la especie sembrada. Confirma personalmente los cultivos.':'Satellites observe vegetation, not the crop species. Confirm your own records.'}</p>
      </div>
      <div className="c-row-actions"><button className="c-action secondary" onClick={()=>changeStep(0)}>{es?'Volver':'Back'}</button><button className="c-action primary" onClick={()=>changeStep(2)}>{es?'Continuar':'Continue'} →</button></div>
    </section>}

   {step===2&&<section className="c-form-step">
      <div className="c-card"><span className="c-small">{es?'TU DECISIÓN':'YOUR DECISION'}</span><h2>{es?'¿Qué deseas cuidar más?':'What matters most?'}</h2>
       <div className="c-goals" role="group" aria-label={es?'Prioridades':'Priorities'}>
       {(['water','soil','both'] as const).map(id=><button key={id} type="button" aria-pressed={goal===id} className={goal===id?'chosen':''} onClick={()=>{setGoal(id);setPlan(null)}}>
        <strong>{id==='water'?(es?'El agua':'Water'):id==='soil'?(es?'La tierra':'Soil'):(es?'Ambas':'Both')}</strong>
        <span>{id==='water'?(es?'Examinar demanda y disponibilidad de riego':'Review water demand and irrigation'):id==='soil'?(es?'Diversidad y riesgos de familias botánicas':'Diversity and crop-family risks'):(es?'Buscar un equilibrio entre factores':'Balance multiple constraints')}</span></button>)}</div>
       <label className="c-year-start">{es?'¿En qué año comienza la primera campaña?':'First campaign year'}
        <select value={startYear} onChange={e=>{setStartYear(Number(e.target.value));setPlan(null)}}>{[2026,2027,2028,2029,2030].map(y=><option key={y} value={y}>{y}–{y+3}</option>)}</select></label>
       <div className="c-confirm"><label><input type="checkbox" checked={waterKnown} onChange={e=>setWaterKnown(e.target.checked)}/>{es?'Tengo información del turno de riego para comprobar':'I have irrigation turn information for review'}</label>
        <label><input type="checkbox" checked={soilKnown} onChange={e=>setSoilKnown(e.target.checked)}/>{es?'Tengo análisis de suelo para revisar':'I have a soil test for review'}</label></div>
       <p className="c-inline-note">{es?'Estas casillas registran qué información podrás verificar, pero no modifican la puntuación ni habilitan afirmaciones de aptitud.':'These checkboxes describe evidence available for future review, but do not change the ranking or prove crop suitability.'}</p>
      </div>
      {status&&<p role="alert" className="c-error">{status}</p>}
      <div className="c-row-actions"><button className="c-action secondary" onClick={()=>changeStep(1)}>{es?'Volver':'Back'}</button><button className="c-action primary" disabled={busy} onClick={compare}>{busy?(es?'Comparando…':'Comparing…'):(es?'Comparar rotaciones':'Compare rotations')} →</button></div>
    </section>}

   {step===3&&plan&&<section className="c-plan-layout">
     <div className="c-card c-main-plan">
       <span className="c-small">{es?'CUATRO CAMPAÑAS · COMPARACIÓN, NO PRESCRIPCIÓN':'FOUR CAMPAIGNS · COMPARISON, NOT PRESCRIPTION'}</span>
       <h2>{es?'Tres formas de organizar tus cultivos':'Three ways to organize crops'}</h2>
       <p>{es?plan.comparison_summary_es:'Compare botanical diversity and crop-family sequences. Local agronomic verification is still required.'}</p>
       <div className="c-tabs" role="group" aria-label={es?'Rotación a visualizar':'Choose rotation'}>
        {plan.strategies.map(s=><button type="button" key={s.id} aria-pressed={selectedPlan===s.id} onClick={()=>{setSelectedPlan(s.id);setOverrides({})}}>
         {s.id==='S0'?(historySource==='example'?(es?'Ejemplo histórico':'Historical example'):(es?'Lo que registraste':'Recorded')):s.id==='R1'?(es?'Referencia INIA':'INIA reference'):(es?'Otra opción':'Another option')}</button>)}
       </div>
       {selected&&<><div className="c-plan-sequence">
        {selected.schedule.map(c=><div key={c.campaign} className="c-sequence-card">
         <span>{es?'Campaña':'Campaign'} {c.campaign} · {c.year}</span><strong>{cropName(c.crop_id,lang)}</strong><small>{c.family}</small>
        </div>)}
       </div>
       <div className="c-stats"><div><span>{es?'Familias distintas':'Distinct families'}</span><b>{selected.indicators.botanical_families}</b></div>
        <div><span>{es?'Leguminosas':'Legume campaigns'}</span><b>{selected.indicators.legume_campaigns}</b></div>
        <div><span>{es?'Familias consecutivas repetidas':'Adjacent repeats'}</span><b>{selected.indicators.adjacent_family_repetitions}</b></div></div>
       {selected.flags_es.map((flag,i)=><p key={i} className="c-flag">⚠ {flag}</p>)}
       <h3>{es?'Distribución espacial por campaña':'Spatial plan by campaign'}</h3>
       <div className="c-year-buttons" role="group" aria-label={es?'Campaña visible':'Visible campaign'}>
        {selected.schedule.map((x,i)=><button key={i} type="button" className={viewYear===i?'on':''} aria-pressed={viewYear===i} onClick={()=>setViewYear(i)}>{x.year}</button>)}</div>
       <FieldMap field={field} subplots={subplots} drawing={drawing} vertices={vertices} onPoint={p=>setVertices(v=>[...v,p])}
        layer={layer} lowData={lowData} layerDate={layerDate} opacity={opacity} viewYear={viewYear} scenario={selected} overrides={overrides} isDemo={isDemo} onSelectParcel={setSelectedParcel}/>
       <div className="c-map-actions">{!drawing?<button type="button" className="c-action secondary" onClick={()=>startDraw('subplot')}>{es?'Dibujar subparcela':'Draw a subplot'}</button>:
        <><button className="c-action primary" type="button" disabled={vertices.length<3} onClick={finishDraw}>{es?'Guardar subparcela':'Save subplot'}</button>
         <button className="c-action secondary" type="button" onClick={()=>{setDrawing(null);setVertices([])}}>{es?'Cancelar':'Cancel'}</button></>}</div>
       {geometryStatus&&<p role="status" className="c-inline-note">{geometryStatus}</p>}
       <div className="c-crop-legend">{CROPS.map(c=><span key={c.id}><i style={{background:c.color}}/>{cropName(c.id,lang)}</span>)}</div>
       {subplots.length>0&&<div className="c-plot-editor"><label>{es?'Subparcela':'Subplot'}<select value={subplots.some(x=>x.id===selectedParcel)?selectedParcel:subplots[0].id}
         onChange={e=>setSelectedParcel(e.target.value)}>{subplots.map(p=><option key={p.id} value={p.id}>{p.id} · {hectares(p.polygon).toFixed(2)} ha</option>)}</select></label>
         <label>{es?'Cultivo propuesto en la campaña seleccionada':'Proposed crop for the selected campaign'}<select value={currentCropFor(subplots.find(x=>x.id===selectedParcel) || subplots[0],subplots.findIndex(x=>x.id===selectedParcel)>=0?subplots.findIndex(x=>x.id===selectedParcel):0)||'papa'}
           onChange={e=>setOverrides(v=>({...v,[(subplots.find(x=>x.id===selectedParcel)||subplots[0]).id+':'+viewYear]:e.target.value as CropId}))}>{CROPS.map(c=><option key={c.id} value={c.id}>{cropName(c.id,lang)}</option>)}</select></label></div>}
       <p className="c-inline-note">{es?'Los colores representan una ASIGNACIÓN PROPUESTA. En el ejemplo sintético, A y B tienen fases escalonadas para ilustrar varios cultivos simultáneos. No representan cultivos detectados por satélite.':'Colors represent a PROPOSED allocation. In the synthetic example A and B are staggered to illustrate simultaneous crops, not satellite crop identification.'}</p>
       </>}
     </div>
     <aside className="c-right-col">
      <div className="c-card"><h3>{es?'Antes de decidir':'Before you act'}</h3>
       <div className="c-checks"><label><input type="checkbox" checked={soilKnown} onChange={e=>setSoilKnown(e.target.checked)}/>{es?'Comprobar suelo y enfermedades':'Verify soil and diseases'}</label>
        <label><input type="checkbox" checked={waterKnown} onChange={e=>setWaterKnown(e.target.checked)}/>{es?'Confirmar disponibilidad de agua':'Confirm irrigation availability'}</label></div>
       <p>{es?plan.water_note_es:'No local irrigation savings were calculated.'}</p>
       <p>{es?'El calendario de siembra y cosecha está pendiente de verificación por cultivo, variedad y campaña.':'Sowing and harvesting windows still require local validation.'}</p>
      </div>
      <div className="c-card"><h3>{es?'¿Se entrenó la IA aquí?':'Is local AI trained?'}</h3>
       <p>{es?'Todavía no. El modelo de Barranca NO se aplica a Chalhuas. Se necesitan lecturas HLS, evaluación fuera de muestra y revisión agronómica.':'Not yet. The Barranca model is NOT used for Chalhuas. Real HLS series, holdout evaluation and agronomic review are required.'}</p>
       <details><summary>{es?'Fuentes y límites completos':'All sources and limits'}</summary>
        {plan.source_records.map(x=><p key={x.url}><a href={x.url} target="_blank" rel="noreferrer">{x.title}</a></p>)}
        {selected?.limitations_es.map(x=><p key={x}>{x}</p>)}
       </details>
      </div>
      <div className="c-card"><h3>{es?'Guardar y compartir':'Save and share'}</h3>
       <button className="c-action primary" type="button" onClick={saveProject}>{es?'Guardar en este dispositivo':'Save on this device'}</button>
       <button className="c-action secondary" type="button" onClick={()=>window.print()}>{es?'Imprimir / PDF':'Print / PDF'}</button>
       <a className="c-action secondary c-as-link" href={share()} target="_blank" rel="noreferrer">{es?'Compartir por WhatsApp':'Share on WhatsApp'}</a>
       {status&&<p role="status" className="c-inline-note">{status}</p>}
      </div>
     </aside>
     <div className="c-footer-actions"><button className="c-action secondary" onClick={()=>changeStep(2)}>{es?'Revisar mis prioridades':'Review priorities'}</button></div>
    </section>}
  </main>
  <footer className="c-footer"><div><strong>BIOTEX</strong><p>{es?'Inteligencia agrícola responsable · Chalhuas en estudio':'Responsible agricultural intelligence · Chalhuas research pilot'}</p></div>
   <div><a href={inia} target="_blank" rel="noreferrer">INIA</a><a href={study} target="_blank" rel="noreferrer">{es?'Estudio Chalhuas':'Chalhuas study'}</a><a href="/?pilot=barranca">{es?'Versión científica Barranca':'Barranca scientific release'}</a></div></footer>
  <BioTour lang={lang}/>
 </div>
}
