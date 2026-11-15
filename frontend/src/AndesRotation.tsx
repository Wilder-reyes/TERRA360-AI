/** CHAKRA Chalhuas: evidence-gated public preview. Stable Barranca stays accessible.
 * Farmer confirms all crops; no local AI has been trained in Junín.
 * All map polygons are either farmer-drawn or explicitly synthetic examples.
 */
import {createPortal} from 'react-dom'
import {useEffect,useMemo,useRef,useState} from 'react'
import {CircleMarker,MapContainer,Polygon,Polyline,TileLayer,WMSTileLayer,useMap,useMapEvents} from 'react-leaflet'
import {API,httpErrorMessage} from './network'
import CampaignVectorMap from './CampaignVectorMap'
import {campaignAreaSummary,proposedCrop} from './campaignPlan'
import {approximatePolygonHectares,validatePolygon,type GeoPoint} from './geometry'
import './andes-rotation.css'

type Point=GeoPoint
type Shape={type:'Polygon';coordinates:number[][][]}
type Lang='es'|'en'
type Scenario={id:string;title_es:string;title_en:string;schedule:{campaign:number;year:number;crop_id:CropId;name_es:string;family:string;dates_verified:boolean}[];
 indicators:{botanical_families:number;adjacent_family_repetitions:number;legume_campaigns:number;potato_return_interval_campaigns:number[]|null};flags_es:string[];flags_en:string[];limitations_es:string[];limitations_en:string[]}
type Decision={status:string;strategies:Scenario[];automatic_recommendation:null;model_status:string;water_note_es:string;comparison_summary_es:string;comparison_summary_en?:string;priority_evidence?:{soil:string;water:string;quantitative_water_savings_available:boolean};start_year:number;end_year:number;source_records:{title:string;url:string}[]}
type Parcel={id:string;polygon:Shape}
type Drawing='field'|'subplot'|null
type Layer='image'|'vegetation'|'rain'|'terrain'

import {LOC,CROPS,NAMES,study,inia,demoParcels,type CropId} from './andesProfile'
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
 const cropAt=(_index:number,parcel:Parcel):CropId|null=>scenario?proposedCrop(parcel.id,viewYear,scenario.schedule,overrides):null
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

export default function AndesRotation({field,lang,step,onStep,isDemo,goal,setGoal,lowData,initialSubplots=[]}:{field:Shape;lang:Lang;step:0|1|2|3;onStep:(s:0|1|2|3)=>void;isDemo:boolean;lowData:boolean;initialSubplots?:Parcel[];goal:'water'|'soil'|'both';setGoal:(v:'water'|'soil'|'both')=>void}){
 const es=lang==='es'
 const epoch=useRef(0)
 useEffect(()=>()=>{epoch.current++},[])
 const [subplots,setSubplots]=useState<Parcel[]>(()=>initialSubplots.length?initialSubplots:(isDemo?demoParcels:[{id:'Lote único',polygon:field}]))
 const [selectedParcel,setSelectedParcel]=useState(initialSubplots.length?initialSubplots[0].id:(isDemo?'A':'Lote único'))
 useEffect(()=>{if(initialSubplots.length){setSubplots(initialSubplots);setSelectedParcel(initialSubplots[0].id)}else if(!isDemo){setSubplots([{id:'Lote único',polygon:field}]);setSelectedParcel('Lote único')}},[initialSubplots,field,isDemo])
 const [drawing,setDrawing]=useState<Drawing>(null)
 const [vertices,setVertices]=useState<Point[]>([])
 const [geometryStatus,setGeometryStatus]=useState('')
 const layer:Layer='image', layerDate='2025-11-01', opacity=.7
 const [sequence,setSequence]=useState<CropId[]>(['papa','arveja','papa','arveja'])
 const [historySource,setHistorySource]=useState<'example'|'farmer_declared'>('example')
 const [startYear,setStartYear]=useState(new Date().getUTCFullYear()+1)
 const [soilKnown,setSoilKnown]=useState(false)
 const [waterKnown,setWaterKnown]=useState(false)
 const [plan,setPlan]=useState<Decision|null>(null)
 const [selectedPlan,setSelectedPlan]=useState('R1')
 const [viewYear,setViewYear]=useState(0)
 const [overrides,setOverrides]=useState<Record<string,CropId>>({})
 const [status,setStatus]=useState('')
 const [busy,setBusy]=useState(false)
 const selected=plan?.strategies.find(s=>s.id===selectedPlan)||null
 function changeStep(s:0|1|2|3){onStep(s);setStatus('')}
 function startDraw(mode:Drawing){
  setDrawing(mode);setVertices([]);setGeometryStatus('')
 }
 async function finishDraw(){
  const token=++epoch.current
  const ok=validatePolygon(vertices)
  const area=approximatePolygonHectares(vertices)
  if(!ok.valid||area<(drawing==='field'?.1:.01)||area>500){
   setGeometryStatus(es?'El contorno es inválido o su superficie está fuera del intervalo permitido.':'Invalid outline or area outside supported limits.');return
  }
  const polygon=shapeFrom(vertices)
  if(!field)return
  const existing=subplots.length===1&&subplots[0].id==='Lote único'?[]:subplots
  const id=String.fromCharCode(65+existing.length)
  try{
   const candidate=[...existing,{id,polygon}]
   const response=await fetch(API+'/api/andes/validate-subplots',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({field,subplots:candidate})})
   if(epoch.current!==token)return
   if(!response.ok)throw new Error(await httpErrorMessage(response,!es))
   setSubplots(candidate);setSelectedParcel(id);setDrawing(null);setVertices([]);setOverrides({})
   setGeometryStatus(es?'Subparcela registrada: dentro del contorno y sin solapamientos. Geometría aproximada.':'Plot stored inside the field without overlaps. Geometry is approximate.')
  }catch(error){if(epoch.current!==token)return;setGeometryStatus(error instanceof Error?error.message:(es?'No se pudo validar la subparcela.':'Could not validate subplot.'))}
 }
 function saveProject(){
  try{localStorage.setItem('biotex-chalhuas-v1',JSON.stringify({version:1,field,isDemo,subplots,sequence,historySource,goal,startYear,overrides}));setStatus(es?'Datos guardados en este dispositivo.':'Saved on this device.')}
  catch{setStatus(es?'No se pudo guardar.':'Could not save.')}
 }
 async function restoreProject(){
  const token=++epoch.current
  try{
   const d=JSON.parse(localStorage.getItem('biotex-chalhuas-v1')||'null')
   if(!d||d.version!==1||JSON.stringify(d.field)!==JSON.stringify(field)||!Array.isArray(d.sequence)||d.sequence.length!==4||!d.sequence.every((id:string)=>CROPS.some(c=>c.id===id)))throw Error('invalid saved campaign')
   const response=await fetch(API+'/api/andes/validate-subplots',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({field,subplots:d.subplots})})
   if(epoch.current!==token)return
   if(!response.ok)throw Error('invalid saved geometry')
   setSequence(d.sequence);setSubplots(d.subplots);setSelectedParcel(d.subplots[0]?.id||'A');setHistorySource(d.historySource==='farmer_declared'?'farmer_declared':'example')
   if(['water','soil','both'].includes(d.goal))setGoal(d.goal)
   if(Number.isInteger(d.startYear)&&d.startYear>=2020&&d.startYear<=2035)setStartYear(d.startYear)
   const safe:Record<string,CropId>={}
   for(const [key,value] of Object.entries(d.overrides||{})){if(typeof value==='string'&&CROPS.some(c=>c.id===value)&&d.subplots.some((p:Parcel)=>[0,1,2,3].some(y=>key===p.id+':'+y)))safe[key]=value as CropId}
   setOverrides(safe);setPlan(null);setStatus(es?'Campañas restauradas. Comprueba fechas y cultivos.':'Campaigns restored. Check dates and crops.')
  }catch{if(epoch.current!==token)return;setStatus(es?'No hay datos válidos para este terreno o no pudimos validar los contornos.':'No valid records for this field, or geometry validation failed.')}
 }
 async function compare(){
  if(!field){setStatus(es?'Primero selecciona o dibuja un terreno.':'Select or draw a field first.');return}
  const token=++epoch.current
  setBusy(true);setStatus('')
  try{
   const response=await fetch(API+'/api/andes/compare',{method:'POST',headers:{'Content-Type':'application/json'},
     body:JSON.stringify({rotation:sequence,start_year:startYear,priority:goal,history_source:historySource})})
   if(epoch.current!==token)return
   if(!response.ok)throw Error(await httpErrorMessage(response,!es))
   const data=await response.json() as Decision
   if(epoch.current!==token)return
   if(data.status!=='illustrative_comparison'||data.automatic_recommendation!==null)throw Error('Respuesta incompatible con el piloto')
   setPlan(data);setSelectedPlan('R1');setViewYear(0);changeStep(3)
  }catch(error){if(epoch.current!==token)return;setStatus(error instanceof Error?error.message:'No se pudo completar la comparación.')}
  finally{if(epoch.current===token)setBusy(false)}
 }
 const currentCropFor=(parcel:Parcel,i:number):CropId|null=>{
  if(!selected)return null
  return proposedCrop(parcel.id,viewYear,selected.schedule,overrides)
 }
 const share=()=>{if(!plan||!selected)return''
  const crops=selected.schedule.map(x=>x.name_es).join(' → ')
  return 'https://wa.me/?text='+encodeURIComponent('CHAKRA · Chalhuas (plan ilustrativo, no prescripción): '+crops+'. Falta verificar suelo, agua, fechas y aptitud en campo.')}
 return <><div className="c-app c-regional-flow">
   {step===1&&<section className="c-form-step"><h1>{es?'Mis cultivos':'My crops'}</h1>
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
      <button type="button" className="c-action secondary" onClick={restoreProject}>{es?'Recuperar datos de campañas':'Restore campaign records'}</button><div className="c-row-actions"><button className="c-action secondary" onClick={()=>changeStep(0)}>{es?'Volver':'Back'}</button><button className="c-action primary" onClick={()=>changeStep(2)}>{es?'Continuar':'Continue'} →</button></div>
    </section>}

   {step===2&&<section className="c-form-step"><h1>{es?'Mis prioridades':'My priorities'}</h1>
      <div className="c-card"><span className="c-small">{es?'TU DECISIÓN':'YOUR DECISION'}</span><h2>{es?'¿Qué deseas cuidar más?':'What matters most?'}</h2>
       <div className="c-goals" role="group" aria-label={es?'Prioridades':'Priorities'}>
       {(['water','soil','both'] as const).map(id=><button key={id} type="button" aria-pressed={goal===id} className={goal===id?'chosen':''} onClick={()=>{setGoal(id);setPlan(null)}}>
        <strong>{id==='water'?(es?'El agua':'Water'):id==='soil'?(es?'La tierra':'Soil'):(es?'Ambas':'Both')}</strong>
        <span>{id==='water'?(es?'Examinar demanda y disponibilidad de riego':'Review water demand and irrigation'):id==='soil'?(es?'Diversidad y riesgos de familias botánicas':'Diversity and crop-family risks'):(es?'Buscar un equilibrio entre factores':'Balance multiple constraints')}</span></button>)}</div>
       <label className="c-year-start">{es?'¿En qué año comienza la primera campaña?':'First campaign year'}
        <select value={startYear} onChange={e=>{setStartYear(Number(e.target.value));setPlan(null)}}>{[0,1,2,3].map(offset=>new Date().getUTCFullYear()+offset).map(y=><option key={y} value={y}>{y}–{y+3}</option>)}</select></label>
       <div className="c-confirm"><label><input type="checkbox" checked={waterKnown} onChange={e=>setWaterKnown(e.target.checked)}/>{es?'Tengo información del turno de riego para comprobar':'I have irrigation turn information for review'}</label>
        <label><input type="checkbox" checked={soilKnown} onChange={e=>setSoilKnown(e.target.checked)}/>{es?'Tengo análisis de suelo para revisar':'I have a soil test for review'}</label></div>
       <p className="c-inline-note">{es?'Estas casillas registran qué información podrás verificar, pero no modifican la puntuación ni habilitan afirmaciones de aptitud.':'These checkboxes describe evidence available for future review, but do not change the ranking or prove crop suitability.'}</p>
      </div>
      {status&&<p role="alert" className="c-error">{status}</p>}
      <div className="c-row-actions"><button className="c-action secondary" onClick={()=>changeStep(1)}>{es?'Volver':'Back'}</button><button className="c-action primary" disabled={busy} onClick={compare}>{busy?(es?'Comparando…':'Comparing…'):(es?'Comparar rotaciones':'Compare rotations')} →</button></div>
    </section>}

   {step===3&&plan&&<section className="c-plan-layout">
     <div className="c-card c-main-plan"><h1>{es?'Mi plan agrícola':'My farm plan'}</h1>
       <span className="c-small">{es?'CUATRO CAMPAÑAS · COMPARACIÓN, NO PRESCRIPCIÓN':'FOUR CAMPAIGNS · COMPARISON, NOT PRESCRIPTION'}</span>
       <h2>{es?'Tres formas de organizar tus cultivos':'Three ways to organize crops'}</h2>
       <p>{es?plan.comparison_summary_es:plan.comparison_summary_en||'Compare botanical diversity and crop-family sequences. Local agronomic verification is still required.'}</p>
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
       {(es?selected.flags_es:selected.flags_en).map((flag,i)=><p key={i} className="c-flag">⚠ {flag}</p>)}
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
       <section className="c-area-summary" aria-label={es?'Superficie asignada por cultivo':'Proposed area per crop'}>
        <h4>{es?'Superficie propuesta para esta campaña':'Proposed area for this campaign'}</h4>
        <ul>{campaignAreaSummary(subplots,viewYear,selected.schedule,overrides).map(item=><li key={item.crop_id}><span>{cropName(item.crop_id,lang)}</span><strong>{item.area_ha.toFixed(2)} ha</strong></li>)}</ul>
        <p>{es?'Áreas aproximadas de las subparcelas elegidas; no son mediciones catastrales ni detecciones satelitales. Sin subdivisiones confirmadas, la propuesta se aplica al terreno completo.':'Approximate areas of selected subplots, not cadastral measurements or satellite crop detections. Without confirmed subplots the proposal covers the full field.'}</p>
       </section>
       <p className="c-inline-note">{es?'Los colores representan ASIGNACIONES PROPUESTAS, no cultivos detectados por satélite. Las subparcelas de demostración, si se eligen, son sintéticas.':'Colors represent PROPOSED allocations, not crops identified from imagery. Demonstration subplots, if selected, are synthetic.'}</p>
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
        {(es?selected?.limitations_es:selected?.limitations_en)?.map(x=><p key={x}>{x}</p>)}
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
{step===1&&status&&<p role="status">{status}</p>}</div>
 {plan&&selected&&createPortal(<article className="c-print-report" lang={lang}>
  <header className="c-print-header"><strong>CHAKRA</strong><span>CHAKRA · {new Date().toLocaleDateString(es?'es-PE':'en-US')}</span></header>
  <h1>{es?'Informe de rotación agrícola':'Agricultural rotation report'}</h1>
  <p className="c-print-lead">{es?'Comparación exploratoria · Chalhuas, Huáchac, Chupaca, Junín':'Exploratory comparison · Chalhuas, Junín, Peru'}</p>
  <section className="c-print-facts">
   <p><b>{es?'Superficie aproximada':'Approximate area'}:</b> {hectares(field).toFixed(2)} ha</p>
   <p><b>{es?'Origen del historial':'History source'}:</b> {historySource==='farmer_declared'?(es?'Declarado por el agricultor':'Farmer-declared'):(es?'Ejemplo de estudio':'Study example')}</p>
   <p><b>{es?'Contorno':'Boundary'}:</b> {isDemo?(es?'Sintético para demostración':'Synthetic demonstration'):(es?'Seleccionado por el usuario':'User-selected')}</p>
   <p><b>{es?'Prioridad':'Priority'}:</b> {goal==='water'?(es?'Agua':'Water'):goal==='soil'?(es?'Suelo':'Soil'):(es?'Ambas':'Both')}</p>
  </section>
  <p>{es?plan.comparison_summary_es:plan.comparison_summary_en}</p>
  <h2>{es?'Rotaciones comparadas':'Compared rotations'}</h2>
  <table><thead><tr><th>{es?'Opción':'Option'}</th>{selected.schedule.map((r)=><th key={r.campaign}>{r.year}</th>)}</tr></thead>
  <tbody>{plan.strategies.map(st=><tr key={st.id}><th>{es?st.title_es:st.title_en}</th>{st.schedule.map(c=><td key={c.campaign}>{cropName(c.crop_id,lang)}</td>)}</tr>)}</tbody></table>
  <p>{es?'Las fechas exactas de siembra y cosecha no han sido verificadas; cada columna es una campaña, no un año completo de cultivo.':'Exact sowing and harvest dates are unverified; each column is a campaign, not a full year under cultivation.'}</p>
  <h2>{es?'Alternativa visualizada y subparcelas':'Displayed alternative and subplots'}</h2>
  <table><thead><tr><th>{es?'Subparcela':'Subplot'}</th><th>{es?'Superficie aprox.':'Approximate area'}</th>{selected.schedule.map(c=><th key={c.campaign}>{c.year}</th>)}</tr></thead>
  <tbody>{subplots.map(p=><tr key={p.id}><th>{p.id}</th><td>{hectares(p.polygon).toFixed(2)} ha</td>{selected.schedule.map((c,y)=><td key={c.campaign}>{cropName(proposedCrop(p.id,y,selected.schedule,overrides)!,lang)}</td>)}</tr>)}</tbody></table>
  <section className="c-print-map-sections" aria-label={es?'Croquis por campaña':'Campaign sketches'}>
   {[0,2].map(start=><div className="c-print-map-row" key={start}>
    {selected.schedule.slice(start,start+2).map((c,index)=><CampaignVectorMap key={c.campaign} field={field} subplots={subplots} yearIndex={start+index} year={c.year} schedule={selected.schedule} overrides={overrides} lang={lang}/>)}
   </div>)}
  </section>
  <p className="c-print-disclaimer">{es?'Los croquis son vectores esquemáticos derivados de la geometría seleccionada; no contienen imágenes NASA ni certifican superficies o especies. Todos los colores son asignaciones propuestas.':'These vector sketches are based on the selected geometry. They are not NASA imagery and do not certify areas or crops. All colors are proposed assignments.'}</p>
  <h2>{es?'Evidencia y limitaciones':'Evidence and limitations'}</h2>
  <p>{es?plan.water_note_es:'No irrigation water savings were calculated: local calendars, varieties and actual allocations remain unknown.'}</p>
  <ul>{(es?selected.flags_es:selected.flags_en).map(x=><li key={x}>{x}</li>)}{(es?selected.limitations_es:selected.limitations_en).map(x=><li key={x}>{x}</li>)}</ul>
  <p><b>IA:</b> {es?'No hay modelo entrenado y validado para esta parcela de Chalhuas. Las métricas de Barranca no se transfieren.':'No trained, validated model for this Chalhuas field. Barranca evaluation metrics do not transfer.'}</p>
  <h2>{es?'Fuentes científicas':'Scientific references'}</h2>
  {plan.source_records.map(x=><p className="c-print-source" key={x.url}>{x.title}: {x.url}</p>)}
  <footer className="c-print-final">CHAKRA · {es?'Apoyo a decisiones, no prescripción de siembra':'Decision support, not a planting prescription'}</footer>
 </article>,document.body)}
 </>
}
