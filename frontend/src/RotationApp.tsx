// AI-assisted: written with Claude Code (Anthropic) and reviewed by the TERRA360 team.
/** «Compara 3 rotaciones» — Field Shift flow (ES/EN).
 * 1 Mi terreno → 2 Mi rotación actual (NDVI mensual HLS) → 3 ¿Qué te importa? → 4 Compara.
 * Honest by design: satellite history is an estimate the farmer confirms, all
 * indicators are relative to the current rotation, and the app abstains when
 * data is missing. Backend: /api/rotation/*.
 */
import {useEffect,useMemo,useRef,useState} from 'react'
import {CircleMarker,MapContainer,Polygon,Polyline,TileLayer,useMap,useMapEvents} from 'react-leaflet'
import {CartesianGrid,Line,LineChart,ReferenceArea,ReferenceLine,ResponsiveContainer,Tooltip,XAxis,YAxis} from 'recharts'
import {API,httpErrorMessage,readableApiError} from './network'
import {addPlantingToRotation,removePlantingFromRotation} from './manualRotation'
import {approximatePolygonHectares,validatePolygon} from './geometry'
import {PADRON_URL,TEAM_FIELDS,TEST_FIELDS,ZONES,parseGeoJSONPolygon,type ExampleField,type GeoPolygon,type ZoneId} from './rotationZones'
import './rotation.css'

type Lang='es'|'en'
type Step=1|2|3|4
type LatLng={lat:number;lng:number}
type HistoryMonth={month:string;ndvi:number|null;scenes_available:number;scenes_valid:number}
type Candidate={crop_id:string;name_es:string;fit_months:number;peak_sowing:boolean}
type Campaign={start:string;end:string;months:number;peak_month:string;peak_ndvi:number;start_index:number;end_index:number;unknown_months_inside:number;candidates:Candidate[]}
type History={status:string;label_es:string;label_en:string;sensor:string;sensor_id:string;period:{start:string;end:string};parcel_area_ha_approx:number;months_with_data:number;months_total:number;months:HistoryMonth[];detection:{campaigns:Campaign[];without_crop_months:string[];thresholds:{bare_below:number;active_above:number}};limitations:string[]}
type Section='why'|'evidence'|'benefits'|'gaps'|'risks'
type TimelineMonth={index:number;calendar_month:number;year:number;crop_id:string|null;stage:string|null;water_mm:number;covered:boolean;low_river:boolean;hot:boolean}
type PlantingOut={crop_id:string;name_es:string;family:string;legume:boolean;start_index:number;start_calendar_month:number;end_calendar_month:number;months:number;approximate:boolean;adjusted_to_observed_gap:boolean;sowing_month_in_catalog:boolean}
type Strategy={id:'S0'|'S1'|'S2';key:'current'|'water'|'soil';title_es:string;title_en:string;origin:string;plantings:PlantingOut[];timeline:TimelineMonth[];
 indicators:{water_total_mm:number;water_low_river_mm:number;bare_months:number;bare_months_low_river:number;legume_plantings:number;distinct_families:number;same_family_consecutive:number;heat_sensitive_hits:{crop_id:string;name_es:string;months:number[]}[];approximate_crops:string[]};
 relative_to_current:{water_low_river_change_percent:number|null;water_total_change_percent:number|null;bare_months_change:number;legume_plantings_change:number;improves_low_river_water?:boolean}|null;
 icons:{water:string;soil_cover:string;nitrogen:string;pests:string;heat:string};sections:Record<Section,{es:string[];en:string[]}>}
type Context={index:number;calendar_month:number;year:number;low_river:boolean;hot:boolean;et0_mm_month:number;tmax_c:number;basin_rain_mm?:number|null}
type BasinRain={status:string;message_es?:string;message_en?:string;source?:string;basin_es?:string;basin_en?:string;years?:string[];years_count?:number;last_season?:{season:string;rain_mm:number;percent_of_normal:number|null}|null;note_es?:string;note_en?:string}
type CompareResult={status:string;upper_basin_rain?:BasinRain;income_crop?:string;strategies:Strategy[];window?:{context:Context[]};climate?:{period:string;hot_months:number[];annual_et0_mm:number;limitations:string[];limitations_en?:string[];cell_adjustment:{reason_es:string;reason_en:string}|null};disclaimer_es?:string;disclaimer_en?:string;message_es?:string;message_en?:string}
type Planting={crop_id:string;start_index:number}

const CROPS:Record<string,{es:string;en:string;icon:string;color:string}>={
 maiz_amarillo_duro:{es:'Maíz amarillo duro',en:'Yellow hard maize',icon:'🌽',color:'#e0a526'},
 maiz_chala:{es:'Maíz chala',en:'Forage maize',icon:'🌾',color:'#c9b23a'},
 camote:{es:'Camote',en:'Sweet potato',icon:'🍠',color:'#b0577a'},
 papa:{es:'Papa',en:'Potato',icon:'🥔',color:'#9a7a4f'},
 frijol_grano_seco:{es:'Frijol canario',en:'Canary bean',icon:'🫘',color:'#3f8f5a'},
 frijol_castilla:{es:'Frijol castilla',en:'Cowpea',icon:'🫘',color:'#2f7d6b'},
 vainita:{es:'Vainita',en:'Green bean',icon:'🫛',color:'#58a44a'},
 pallar:{es:'Pallar',en:'Lima bean',icon:'🫘',color:'#6c9e3c'},
 arveja_verde:{es:'Arveja verde',en:'Green pea',icon:'🫛',color:'#7bb661'},
 cebolla:{es:'Cebolla roja',en:'Red onion',icon:'🧅',color:'#a2466b'},
 zanahoria:{es:'Zanahoria',en:'Carrot',icon:'🥕',color:'#e07a2f'},
 brocoli_col:{es:'Brócoli / col',en:'Broccoli / cabbage',icon:'🥦',color:'#3c7f3a'},
 alfalfa:{es:'Alfalfa',en:'Alfalfa',icon:'🍀',color:'#5d8f2e'},
}
const CROP_IDS=Object.keys(CROPS)
const MONTHS={es:['ene','feb','mar','abr','may','jun','jul','ago','set','oct','nov','dic'],en:['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']}

const T={
 es:{
  brand:'Comparador de rotaciones',pilot:'Huaral y Barranca · Lima, Perú',steps:['Mi terreno','Mi rotación','¿Qué te importa?','Compara'],
  s1Title:'Elige tu zona y tu terreno',s1Lead:'Toca un terreno de ejemplo, dibuja el tuyo en el mapa o pega su GeoJSON.',zone:'Zona',
  examples:'Terrenos de ejemplo',teamFields:'Terrenos del equipo',testFields:'Terrenos de prueba técnica',draw:'Dibujar mi terreno',finish:'Terminar',cancel:'Cancelar',
  corners:(n:number)=>n<3?`Toca las esquinas de tu terreno, una tras otra, siguiendo el borde (${n} de al menos 3)`:`${n} esquinas. Para cerrar, toca la esquina amarilla, haz doble clic o pulsa «Terminar».`,undo:'Deshacer',drawError:'No se pudo cerrar el terreno.',drawReasons:{vertex_count:'Marca al menos 3 esquinas.',self_intersection:'Las líneas se cruzan. Pulsa «Deshacer» y marca las esquinas en orden, siguiendo el borde.',duplicate_vertices:'Hay dos esquinas en el mismo punto. Pulsa «Deshacer».',too_small:'El terreno es demasiado pequeño. Acerca el mapa y marca las esquinas más separadas.',area_too_large:'El terreno es demasiado grande. Dibuja solo tu chacra.',coordinates:'Hay una esquina fuera del mapa.'} as Record<string,string>,parcelSize:'El satélite necesita un terreno de 0,1 a 500 ha.',
  geojson:'Pegar o subir GeoJSON',geojsonHint:'Polygon, Feature o FeatureCollection en coordenadas WGS84.',useGeojson:'Usar este GeoJSON',geojsonError:'No reconocimos un polígono válido en ese GeoJSON.',
  area:(ha:string)=>`Área aproximada: ${ha} ha`,noField:'Aún no elegiste un terreno.',seeHistory:'Ver cómo ha estado mi terreno →',
  sectorNote:(s:string,c:string)=>`El mapa inicia en el sector estadístico ${s} (código ${c}, MIDAGRI 2024). Es una referencia, no una chacra.`,
  s2Title:'Así ha estado tu terreno en los últimos años',loadingHistory:'Buscando fotos del satélite desde 2021… puede tardar hasta 1 minuto la primera vez.',
  legendCrop:'Con cultivo',legendBare:'Terreno sin cultivo',legendCloud:'Sin foto del satélite (nubes)',
  foot:'Lo vemos desde el satélite. Puede equivocarse: dinos qué sembraste en cada campaña.',
  sensor:(s:string,a:number,b:number)=>`Fuente: ${s}. Meses con foto: ${a} de ${b}. Los meses sin foto no se rellenan.`,
  ask:(a:string,b:string)=>`Entre ${a} y ${b} hubo un cultivo. ¿Qué sembraste?`,suggested:'Sugerido por el satélite y el calendario',dontRemember:'No me acuerdo',
  windowNote:(a:string,b:string)=>`Para comparar usamos tus últimos 24 meses completos: ${a} a ${b}.`,noCampaigns:'No vimos campañas claras en esos 24 meses.',
  useTemplate:'Probar rotación ficticia de demostración',historyError:'No pudimos leer el historial satelital.',retry:'Reintentar',
  manualLead:'Añade los cultivos y meses en que realmente sembraste. No se identifican automáticamente desde el satélite.',manualCrop:'Cultivo',manualMonth:'Mes de siembra',manualAdd:'Añadir siembra',manualRemove:'Quitar',manualLimit:'Máximo 10 siembras en 24 meses.',manualDuplicate:'Ya hay una siembra en ese mes. Elige otro mes.',backToHistory:'Volver al historial satelital',partial:'No fue posible calcular ambas alternativas con estas restricciones; no usamos plantillas ficticias como resultados.',demoOnly:'Solo demostración: estos cultivos son una muestra ficticia, no datos de tu parcela.',manualTitle:'Tu rotación actual',confirmed:(n:number)=>`${n} campaña(s) confirmada(s).`,next:'Siguiente →',back:'← Volver',
  s3Title:'¿Qué te importa más?',s3Lead:'Mueve cada barra. Esto cambia cómo buscamos las dos ideas.',
  prio:{water:'Ahorrar agua',soil:'Mejorar el suelo',income:'Mantener mi cultivo de ingreso',pests:'Menos plagas'},levels:['Poco','Normal','Mucho'],
  turnQ:'¿Cómo suele estar tu turno de agua entre mayo y noviembre?',turn:{normal:'Normal',escaso:'Escaso',no_se:'No sé'},compare:'Comparar 3 rotaciones →',comparing:'Calculando con NASA POWER y el catálogo de cultivos…',
  s4Title:'Tu forma de sembrar y dos ideas para cuidar tu suelo y tu agua',
  disclaimer:'Son ideas para conversar, no órdenes. Revísalas con un técnico de la Agencia Agraria o de tu Junta de Usuarios antes de decidir.',
  ctxLow:'Río bajo (estiaje)',ctxBasin:'Agua que viene: lluvia en la sierra (GPM IMERG)',basinSeason:(s:string,p:number)=>`Temporada ${s}: ${p} % de lo normal en la cabecera de cuenca.`,ctxHot:'Meses de más calor',ctxEt0:'Demanda de agua del aire (ET0)',
  why:'¿Por qué?',hide:'Ocultar',noImprove:'Esta idea NO gasta menos agua entre mayo y noviembre que lo que haces hoy. No es una mejora de agua para tu terreno.',sections:{why:'¿Por qué te lo sugerimos?',evidence:'¿En qué nos basamos?',benefits:'¿Qué podrías ganar?',gaps:'¿Qué no sabemos?',risks:'¿Qué debes revisar con un técnico?'} as Record<Section,string>,
  waterLow:'Agua en estiaje',bare:'Meses sin cubierta',legumes:'Leguminosas',families:'Familias',vsToday:'vs. hoy',of24:'de 24',
  icon:{water:'💧 Agua en estiaje',soil:'🌱 Suelo cubierto',n:'🫘 Aporta nitrógeno',pests:'🐛 Corta plagas',market:'💰 Cultivo de ingreso',heat:'🔥 Calor en etapa sensible'},
  better:'mejor',worse:'peor',same:'igual',reference:'referencia',yes:'sí',no:'no',ok:'sí',repeat:'repite familia',alert:'revisar',
  print:'Imprimir o guardar PDF',technician:'Llévalo a tu técnico',techHelp:'En la ventana de impresión elige «Guardar como PDF» y compártelo con tu técnico.',
  approx:'dato aproximado',adjusted:'ajustado a lo visto por satélite',origin:{constrained_search:'Calculada con restricciones',team_template:'Plantilla de demostración',declared_or_detected:'Confirmada por agricultor',farmer_declared:'Declarada por agricultor',satellite_confirmed:'Sugerida por satélite y confirmada por agricultor',team_demo:'Plantilla ficticia de demostración'} as Record<string,string>,
  abstain:'No podemos comparar todavía.',climate:'Clima',footer:'BIOTEX · NSPACE BIOTEX · NASA Space Apps 2026',otherViews:'Otras vistas:',weatherView:'Clima de mi zona',techView:'Herramientas técnicas',
  year:'Año',sowIn:'siembra',months:'meses',
 },
 en:{
  brand:'Rotation comparator',pilot:'Huaral and Barranca · Lima, Peru',steps:['My field','My rotation','What matters?','Compare'],
  s1Title:'Choose your zone and your field',s1Lead:'Tap an example field, draw yours on the map or paste its GeoJSON.',zone:'Zone',
  examples:'Example fields',teamFields:'Team fields',testFields:'Technical test fields',draw:'Draw my field',finish:'Finish',cancel:'Cancel',
  corners:(n:number)=>n<3?`Tap your field's corners one after another along the edge (${n} of at least 3)`:`${n} corners. To close, tap the yellow corner, double-click or press «Finish».`,undo:'Undo',drawError:'Could not close the field.',drawReasons:{vertex_count:'Mark at least 3 corners.',self_intersection:'The lines cross. Press «Undo» and mark the corners in order along the edge.',duplicate_vertices:'Two corners are on the same spot. Press «Undo».',too_small:'The field is too small. Zoom in and mark corners further apart.',area_too_large:'The field is too large. Draw only your farm.',coordinates:'A corner is outside the map.'} as Record<string,string>,parcelSize:'The satellite needs a field of 0.1 to 500 ha.',
  geojson:'Paste or upload GeoJSON',geojsonHint:'Polygon, Feature or FeatureCollection in WGS84 coordinates.',useGeojson:'Use this GeoJSON',geojsonError:'We did not find a valid polygon in that GeoJSON.',
  area:(ha:string)=>`Approximate area: ${ha} ha`,noField:'You have not chosen a field yet.',seeHistory:'See how my field has been →',
  sectorNote:(s:string,c:string)=>`The map starts at statistical sector ${s} (code ${c}, MIDAGRI 2024). It is a reference, not a farm.`,
  s2Title:'This is how your field has been in recent years',loadingHistory:'Searching satellite images since 2021… the first time can take up to 1 minute.',
  legendCrop:'With crop',legendBare:'No crop',legendCloud:'No satellite image (clouds)',
  foot:'We see it from space. It can be wrong: tell us what you planted in each season.',
  sensor:(s:string,a:number,b:number)=>`Source: ${s}. Months with an image: ${a} of ${b}. Months without an image are not filled in.`,
  ask:(a:string,b:string)=>`Between ${a} and ${b} there was a crop. What did you plant?`,suggested:'Suggested by the satellite and the calendar',dontRemember:"I don't remember",
  windowNote:(a:string,b:string)=>`To compare we use your last 24 complete months: ${a} to ${b}.`,noCampaigns:'We did not see clear seasons in those 24 months.',
  useTemplate:'Try a sample rotation (demo only)',historyError:'We could not read the satellite history.',retry:'Retry',
  manualLead:'Add the crops and months you actually planted. Crops are not automatically identified from space.',manualCrop:'Crop',manualMonth:'Sowing month',manualAdd:'Add planting',manualRemove:'Remove',manualLimit:'Maximum 10 plantings over 24 months.',manualDuplicate:'There is already a planting in that month. Choose another.',backToHistory:'Return to satellite history',partial:'Both alternatives could not be calculated under these constraints; sample templates were not substituted as results.',demoOnly:'Demo only: this is a fictitious sample rotation, not real field data.',manualTitle:'Your current rotation',confirmed:(n:number)=>`${n} season(s) confirmed.`,next:'Next →',back:'← Back',
  s3Title:'What matters most to you?',s3Lead:'Move each bar. This changes how we search for the two ideas.',
  prio:{water:'Save water',soil:'Improve the soil',income:'Keep my income crop',pests:'Fewer pests'},levels:['Low','Normal','High'],
  turnQ:'How is your irrigation turn usually between May and November?',turn:{normal:'Normal',escaso:'Scarce',no_se:"I don't know"},compare:'Compare 3 rotations →',comparing:'Computing with NASA POWER and the crop catalogue…',
  s4Title:'Your way of planting and two ideas to care for your soil and water',
  disclaimer:'These are ideas to discuss, not instructions. Review them with a technician from the Agrarian Agency or your Water Users\' Board before deciding.',
  ctxLow:'Low river (dry season)',ctxBasin:'Water to come: rain in the Andes (GPM IMERG)',basinSeason:(s:string,p:number)=>`Season ${s}: ${p}% of normal in the headwaters.`,ctxHot:'Warmest months',ctxEt0:'Air water demand (ET0)',
  why:'Why?',hide:'Hide',noImprove:'This idea does NOT use less water from May to November than today. It is not a water improvement for your field.',sections:{why:'Why do we suggest it?',evidence:'What is it based on?',benefits:'What could you gain?',gaps:'What do we not know?',risks:'What to check with a technician?'} as Record<Section,string>,
  waterLow:'Dry-season water',bare:'Bare months',legumes:'Legumes',families:'Families',vsToday:'vs. today',of24:'of 24',
  icon:{water:'💧 Dry-season water',soil:'🌱 Covered soil',n:'🫘 Adds nitrogen',pests:'🐛 Breaks pests',market:'💰 Income crop',heat:'🔥 Heat in sensitive stage'},
  better:'better',worse:'worse',same:'same',reference:'reference',yes:'yes',no:'no',ok:'yes',repeat:'repeats family',alert:'check',
  print:'Print or save PDF',technician:'Take it to your technician',techHelp:'In the print window choose «Save as PDF» and share it with your technician.',
  approx:'approximate data',adjusted:'adjusted to what the satellite saw',origin:{constrained_search:'Generated by constrained search',team_template:'Demo template',declared_or_detected:'Confirmed by farmer',farmer_declared:'Declared by farmer',satellite_confirmed:'Satellite-suggested and farmer-confirmed',team_demo:'Fictitious demo template'} as Record<string,string>,
  abstain:'We cannot compare yet.',climate:'Climate',footer:'BIOTEX · NSPACE BIOTEX · NASA Space Apps 2026',otherViews:'Other views:',weatherView:'My zone weather',techView:'Technical tools',
  year:'Year',sowIn:'sown',months:'months',
 },
}

function initialLang():Lang{
 const q=new URLSearchParams(window.location.search).get('lang')
 if(q==='en'||q==='es')return q
 try{const v=localStorage.getItem('terra360-lang');if(v==='es'||v==='en')return v}catch{/* storage unavailable */}
 return navigator.language?.toLowerCase().startsWith('es')?'es':'en'
}
const cropName=(id:string,lang:Lang)=>CROPS[id]?.[lang]||id
const monthLabel=(ym:string,lang:Lang)=>`${MONTHS[lang][Number(ym.slice(5,7))-1]} ${ym.slice(0,4)}`
const ymIndex=(ym:string)=>Number(ym.slice(0,4))*12+Number(ym.slice(5,7))-1
const ymFromIndex=(i:number)=>`${Math.floor(i/12)}-${String(i%12+1).padStart(2,'0')}`
const toLatLngs=(p:GeoPolygon):LatLng[]=>p.coordinates[0].slice(0,-1).map(([lng,lat])=>({lat,lng}))
const fromLatLngs=(v:LatLng[]):GeoPolygon=>({type:'Polygon',coordinates:[[...v.map(p=>[p.lng,p.lat]),[v[0].lng,v[0].lat]]]})

function FitView({zone,polygon}:{zone:ZoneId;polygon:LatLng[]|null}){
 const map=useMap()
 useEffect(()=>{
  if(polygon&&polygon.length>=3){map.fitBounds(polygon.map(p=>[p.lat,p.lng]) as [number,number][],{maxZoom:17,padding:[40,40]})}
  else map.setView([ZONES[zone].lat,ZONES[zone].lng],13)
 },[map,zone,polygon])
 return null
}
/** Drawing layer: visible corners, closed preview, close by tapping the first
 * corner or double-clicking, repeated taps on the same spot ignored, and no
 * double-click zoom while drawing (it used to add a duplicate corner). */
const SAME_SPOT_PX=10
const CLOSE_PX=22
function DrawingLayer({active,vertices,onVertex,onClose}:{active:boolean;vertices:LatLng[];onVertex:(p:LatLng)=>void;onClose:()=>void}){
 const map=useMap()
 useEffect(()=>{if(active)map.doubleClickZoom.disable();else map.doubleClickZoom.enable();return()=>map.doubleClickZoom.enable()},[map,active])
 const px=(p:LatLng)=>map.latLngToContainerPoint([p.lat,p.lng])
 const near=(a:LatLng,b:LatLng,limit:number)=>{const pa=px(a),pb=px(b);return Math.hypot(pa.x-pb.x,pa.y-pb.y)<limit}
 useMapEvents({
  click(e){
   if(!active)return
   const p={lat:Number(e.latlng.lat.toFixed(6)),lng:Number(e.latlng.lng.toFixed(6))}
   if(vertices.length>=3&&near(p,vertices[0],CLOSE_PX)){onClose();return}
   if(vertices.length&&near(p,vertices[vertices.length-1],SAME_SPOT_PX))return
   onVertex(p)
  },
  dblclick(){if(active&&vertices.length>=3)onClose()},
 })
 if(!active)return null
 return <>
  {vertices.length>=3&&<Polygon positions={vertices.map(p=>[p.lat,p.lng])} pathOptions={{color:'#ffd34d',weight:2,dashArray:'6 6',fillColor:'#ffd34d',fillOpacity:.18}}/>}
  {vertices.length===2&&<Polyline positions={vertices.map(p=>[p.lat,p.lng])} pathOptions={{color:'#ffd34d',weight:3,dashArray:'6 6'}}/>}
  {vertices.map((p,i)=><CircleMarker key={i+':'+p.lat+':'+p.lng} center={[p.lat,p.lng]} radius={i===0?(vertices.length>=3?11:8):6}
   pathOptions={{color:'#173a2e',weight:2,fillColor:i===0?'#ffd34d':'#ffffff',fillOpacity:1}}/>)}
 </>
}

function NdviChart({history,lang,windowStart}:{history:History;lang:Lang;windowStart:number}){
 const rows=history.months.map(m=>({m:m.month,label:monthLabel(m.month,lang),ndvi:m.ndvi,cloud:m.ndvi===null?0.05:null}))
 const t=T[lang]
 return <div className="r-chart" role="img" aria-label={t.s2Title}>
  <ResponsiveContainer width="100%" height="100%">
   <LineChart data={rows} margin={{top:10,right:8,bottom:4,left:-22}}>
    <CartesianGrid vertical={false} stroke="#e3e9e2" strokeDasharray="3 4"/>
    {history.detection.campaigns.map(c=><ReferenceArea key={c.start} x1={c.start} x2={c.end} fill="#2f8f52" fillOpacity={0.16} ifOverflow="hidden"/>)}
    <ReferenceArea x1={ymFromIndex(windowStart)} x2={ymFromIndex(windowStart+23)} stroke="#145442" strokeDasharray="4 3" fill="none" ifOverflow="hidden"/>
    <ReferenceLine y={history.detection.thresholds.active_above} stroke="#2f8f52" strokeDasharray="5 4"/>
    <ReferenceLine y={history.detection.thresholds.bare_below} stroke="#9a6b3c" strokeDasharray="5 4"/>
    <XAxis dataKey="m" tick={{fontSize:10}} tickFormatter={v=>String(v).endsWith('-01')?String(v).slice(0,4):''} interval={0} tickLine={false}/>
    <YAxis domain={[0,1]} tick={{fontSize:10}} ticks={[0,0.2,0.4,0.6,0.8,1]}/>
    <Tooltip labelFormatter={v=>monthLabel(String(v),lang)} formatter={(v,name)=>name==='cloud'?[t.legendCloud,'']:[Number(v).toFixed(2),'NDVI']}/>
    <Line dataKey="ndvi" stroke="#145442" strokeWidth={2.4} dot={{r:2.5}} connectNulls={false} isAnimationActive={false}/>
    <Line dataKey="cloud" stroke="none" dot={{r:3,fill:'#c9d1cc'}} isAnimationActive={false} legendType="none"/>
   </LineChart>
  </ResponsiveContainer>
 </div>
}

function Timeline({s,ctx,lang,maxWater}:{s:Strategy;ctx:Context[];lang:Lang;maxWater:number}){
 return <div className="r-timeline" aria-label={(lang==='es'?s.title_es:s.title_en)}>
  <div className="r-grid">
   {s.timeline.map(m=>{
    const c=m.crop_id?CROPS[m.crop_id]:null
    const first=m.crop_id&&(m.index===0||s.timeline[m.index-1].crop_id!==m.crop_id)
    return <div key={m.index} className={'r-cell'+(m.covered?'':' bare')+(ctx[m.index]?.low_river?' low':'')}
     style={c?{background:c.color}:undefined} title={`${MONTHS[lang][m.calendar_month-1]} · ${c?cropName(m.crop_id!,lang):T[lang].legendBare} · ${m.water_mm.toFixed(0)} mm`}>
     {first&&<span aria-hidden="true">{c?.icon}</span>}
    </div>})}
  </div>
  <div className="r-grid r-water">{s.timeline.map(m=><div key={m.index} className="r-bar-wrap"><div className="r-bar" style={{height:`${Math.max(2,100*m.water_mm/maxWater)}%`}}/></div>)}</div>
 </div>
}

function ContextStrips({ctx,lang}:{ctx:Context[];lang:Lang}){
 const t=T[lang];const maxEt0=Math.max(...ctx.map(c=>c.et0_mm_month))
 return <div className="r-context">
  <div className="r-grid r-months">{ctx.map(c=><div key={c.index} className={c.calendar_month===1?'yr':''}>{MONTHS[lang][c.calendar_month-1].slice(0,1).toUpperCase()}</div>)}</div>
  <div className="r-strip-label">{t.ctxLow}</div>
  <div className="r-grid">{ctx.map(c=><div key={c.index} className={'r-strip'+(c.low_river?' on-low':'')}/>)}</div>
  <div className="r-strip-label">{t.ctxHot}</div>
  <div className="r-grid">{ctx.map(c=><div key={c.index} className={'r-strip'+(c.hot?' on-hot':'')} title={`Tmax ${c.tmax_c.toFixed(1)} °C`}/>)}</div>
  {ctx.some(c=>c.basin_rain_mm!=null)&&(()=>{const maxR=Math.max(1,...ctx.map(c=>c.basin_rain_mm||0));return <>
   <div className="r-strip-label">{t.ctxBasin}</div>
   <div className="r-grid r-water">{ctx.map(c=><div key={c.index} className="r-bar-wrap"><div className="r-bar basin" style={{height:`${Math.max(2,100*(c.basin_rain_mm||0)/maxR)}%`}} title={`${(c.basin_rain_mm||0).toFixed(0)} mm`}/></div>)}</div></>})()}
  <div className="r-strip-label">{t.ctxEt0}</div>
  <div className="r-grid r-water">{ctx.map(c=><div key={c.index} className="r-bar-wrap"><div className="r-bar et0" style={{height:`${100*c.et0_mm_month/maxEt0}%`}} title={`${c.et0_mm_month.toFixed(0)} mm`}/></div>)}</div>
 </div>
}

function StrategyCard({s,ctx,lang,maxWater,incomeCrop,open,onToggle}:{s:Strategy;ctx:Context[];lang:Lang;maxWater:number;incomeCrop?:string;open:boolean;onToggle:()=>void}){
 const t=T[lang];const r=s.relative_to_current;const ind=s.indicators
 const word=(v:string)=>(t as unknown as Record<string,string>)[v]||v
 const keepsIncome=!!incomeCrop&&s.plantings.some(p=>p.crop_id===incomeCrop)
 return <article className={'r-strategy r-'+s.key}>
  <header><span className="r-tag">{s.id}</span><h3>{lang==='es'?s.title_es:s.title_en}</h3><small>{t.origin[s.origin]||s.origin}</small></header>
  {s.key==='water'&&r?.improves_low_river_water===false&&<p className="r-warn" role="note">⚠️ {t.noImprove}</p>}
  <Timeline s={s} ctx={ctx} lang={lang} maxWater={maxWater}/>
  <ul className="r-plantings">{s.plantings.map((p,k)=><li key={k}><span className="r-dot" style={{background:CROPS[p.crop_id]?.color}}/>{CROPS[p.crop_id]?.icon} {cropName(p.crop_id,lang)} · {t.sowIn} {MONTHS[lang][p.start_calendar_month-1]} ({t.year} {1+Math.floor(p.start_index/12)}), {p.months} {t.months}{p.approximate&&<em> · {t.approx}</em>}{p.adjusted_to_observed_gap&&<em> · {t.adjusted}</em>}</li>)}</ul>
  <div className="r-numbers">
   <div><span>{t.waterLow}</span><b>{ind.water_low_river_mm.toFixed(0)} mm</b>{r&&r.water_low_river_change_percent!==null&&<small className={r.water_low_river_change_percent<0?'good':r.water_low_river_change_percent>0?'bad':''}>{r.water_low_river_change_percent>0?'+':''}{r.water_low_river_change_percent}% {t.vsToday}</small>}</div>
   <div><span>{t.bare}</span><b>{ind.bare_months} {t.of24}</b>{r&&<small className={r.bare_months_change<0?'good':r.bare_months_change>0?'bad':''}>{r.bare_months_change>0?'+':''}{r.bare_months_change} {t.vsToday}</small>}</div>
   <div><span>{t.legumes}</span><b>{ind.legume_plantings}</b></div>
   <div><span>{t.families}</span><b>{ind.distinct_families}</b></div>
  </div>
  <ul className="r-icons">
   <li className={s.icons.water}>{t.icon.water}: <b>{word(s.icons.water)}</b></li>
   <li className={s.icons.soil_cover}>{t.icon.soil}: <b>{word(s.icons.soil_cover)}</b></li>
   <li className={s.icons.nitrogen==='yes'?'better':'worse'}>{t.icon.n}: <b>{word(s.icons.nitrogen)}</b></li>
   <li className={s.icons.pests==='ok'?'better':'worse'}>{t.icon.pests}: <b>{word(s.icons.pests)}</b></li>
   <li className={keepsIncome?'better':'worse'}>{t.icon.market}: <b>{keepsIncome?t.yes:t.no}</b></li>
   <li className={s.icons.heat==='ok'?'better':'worse'}>{t.icon.heat}: <b>{s.icons.heat==='ok'?t.no:t.alert}</b></li>
  </ul>
  <button type="button" className="r-btn r-btn-outline r-why" aria-expanded={open} onClick={onToggle}>{open?t.hide:t.why}</button>
  <div className={'r-sections'+(open?' open':'')}>
   {(['why','evidence','benefits','gaps','risks'] as Section[]).map((k,i)=><section key={k}><h4>{i+1}. {t.sections[k]}</h4><ul>{s.sections[k][lang].map((x,j)=><li key={j}>{x}</li>)}</ul></section>)}
  </div>
 </article>
}

export default function RotationApp(){
 const [lang,setLang]=useState<Lang>(initialLang)
 const t=T[lang]
 const [step,setStep]=useState<Step>(1)
 const [zone,setZone]=useState<ZoneId>('huaral')
 const [field,setField]=useState<{polygon:GeoPolygon;label:string;note?:string}|null>(null)
 const [drawing,setDrawing]=useState(false)
 const [vertices,setVertices]=useState<LatLng[]>([])
 const [drawError,setDrawError]=useState('')
 const [geoText,setGeoText]=useState('')
 const [history,setHistory]=useState<History|null>(null)
 const [historyLoading,setHistoryLoading]=useState(false)
 const [historyError,setHistoryError]=useState('')
 const [answers,setAnswers]=useState<Record<string,string>>({})
 const [templateCurrent,setTemplateCurrent]=useState<Planting[]|null>(null)
 const [manualCurrent,setManualCurrent]=useState<Planting[]|null>(null)
 const [manualCrop,setManualCrop]=useState('maiz_amarillo_duro')
 const [manualMonth,setManualMonth]=useState(0)
 const [manualError,setManualError]=useState('')
 const [priorities,setPriorities]=useState({water:1,soil:1,income:1,pests:1})
 const [turn,setTurn]=useState<'normal'|'escaso'|'no_se'>('normal')
 const [result,setResult]=useState<CompareResult|null>(null)
 const [comparing,setComparing]=useState(false)
 const [compareError,setCompareError]=useState('')
 const [open,setOpen]=useState<Record<string,boolean>>({})
 const [printHelp,setPrintHelp]=useState(false)
 const epoch=useRef(0)

 useEffect(()=>{document.documentElement.lang=lang;try{localStorage.setItem('terra360-lang',lang)}catch{/* ignore */}},[lang])
 function go(s:Step){setStep(s);window.scrollTo({top:0,behavior:'smooth'})}
 const polygonLL=useMemo(()=>field?toLatLngs(field.polygon):null,[field])
 const area=polygonLL?approximatePolygonHectares(polygonLL):0
 const examples=[...TEAM_FIELDS,...TEST_FIELDS].filter(f=>f.zone===zone)

 function chooseExample(f:ExampleField){setDrawing(false);setVertices([]);setField({polygon:f.polygon,label:lang==='es'?f.label_es:f.label_en,note:lang==='es'?f.note_es:f.note_en});resetDownstream()}
 function resetDownstream(){epoch.current++;setHistory(null);setHistoryError('');setAnswers({});setTemplateCurrent(null);setManualCurrent(null);setManualError('');setResult(null)}
 function finishDrawing(){
  const v=validatePolygon(vertices)
  if(!v.valid){setDrawError(t.drawError+' '+(t.drawReasons[v.reason]||''));return}
  const ha=approximatePolygonHectares(vertices)
  if(ha<0.1||ha>500){setDrawError(t.drawError+' '+t.parcelSize);return}
  setField({polygon:fromLatLngs(vertices),label:lang==='es'?'Terreno dibujado':'Drawn field'});setDrawing(false);setVertices([]);setDrawError('');resetDownstream()
 }
 function useGeo(text:string){
  const p=parseGeoJSONPolygon(text)
  if(!p||!validatePolygon(toLatLngs(p)).valid){setDrawError(t.geojsonError);return}
  const ha=approximatePolygonHectares(toLatLngs(p))
  if(ha<0.1||ha>500||!Number.isFinite(ha)){setDrawError(t.parcelSize);return}
  setField({polygon:p,label:'GeoJSON'});setDrawError('');resetDownstream()
 }

 async function loadHistory(){
  if(!field)return
  const my=++epoch.current
  setHistoryLoading(true);setHistoryError('');setHistory(null);setAnswers({})
  try{
   // The server answers 202 while the first history of a new field is computed.
   let r:Response|null=null
   for(let attempt=0;attempt<60;attempt++){
    r=await fetch(API+'/api/rotation/history',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({polygon:field.polygon,start_year:2021})})
    if(my!==epoch.current)return
    if(r.status!==202)break
    await new Promise(res=>setTimeout(res,5000))
   }
   if(!r||!r.ok||r.status===202){let d='';try{d=(await r!.json()).detail}catch{/* */};throw Error(typeof d==='string'&&d?d:r?await httpErrorMessage(r,lang==='en'):'')}
   const h=await r.json() as History
   if(my!==epoch.current)return
   setHistory(h)
   // Candidate crops are suggestions, not farmer confirmations.
   setAnswers({})
  }catch(e){if(my===epoch.current)setHistoryError(readableApiError(e,lang==='en'))}
  finally{if(my===epoch.current)setHistoryLoading(false)}
 }

 // Last 24 complete months, starting in August (agricultural campaign).
 const windowStart=useMemo(()=>{
  const end=history?.period.end||new Date().toISOString().slice(0,10)
  const y=Number(end.slice(0,4)),m=Number(end.slice(5,7))
  const lastJulyYear=m>=8?y:y-1
  return (lastJulyYear-2)*12+7
 },[history])
 const windowCampaigns=useMemo(()=>(history?.detection.campaigns||[]).filter(c=>{const s=ymIndex(c.start)-1;return s>=windowStart&&s<=windowStart+23}),[history,windowStart])
 const currentFromHistory=useMemo<Planting[]>(()=>{
  const seen=new Set<number>();const out:Planting[]=[]
  for(const c of windowCampaigns){
   const crop=answers[c.start];if(!crop||crop==='unknown')continue
   const idx=Math.max(0,ymIndex(c.start)-1-windowStart)
   if(seen.has(idx))continue;seen.add(idx);out.push({crop_id:crop,start_index:idx})
  }
  return out
 },[windowCampaigns,answers,windowStart])
 const current=manualCurrent??templateCurrent??currentFromHistory
 function addManualPlanting(){
  const baseline=manualCurrent??(templateCurrent?[]:currentFromHistory)
  const next=addPlantingToRotation(baseline,manualCrop,manualMonth)
  if(next.status!=='added'){
   setManualError(next.status==='duplicate'?t.manualDuplicate:t.manualLimit);return
  }
  setManualCurrent(next.current)
  setTemplateCurrent(null);setResult(null);setManualError('')
 }

 async function runCompare(){
  const my=++epoch.current
  setComparing(true);setCompareError('');setResult(null)
  try{
   const summary=history&&!manualCurrent&&!templateCurrent?{sensor:history.sensor,start:history.period.start,end:history.period.end,months_with_data:history.months_with_data}:null
   const current_source=templateCurrent?'team_demo':manualCurrent?'farmer_declared':'satellite_confirmed'
   const r=await fetch(API+'/api/rotation/compare',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({zone,current,priorities,water_turn:turn,history:summary,current_source,use_team_templates_as_fallback:false})})
   if(!r.ok){let d='';try{d=(await r.json()).detail}catch{/* */};throw Error(typeof d==='string'&&d?d:await httpErrorMessage(r,lang==='en'))}
   const v=await r.json() as CompareResult
   if(my!==epoch.current)return
   setResult(v);go(4)
  }catch(e){if(my===epoch.current)setCompareError(readableApiError(e,lang==='en'))}
  finally{if(my===epoch.current)setComparing(false)}
 }

 const ctx=result?.window?.context||[]
 const maxWater=Math.max(1,...(result?.strategies||[]).flatMap(s=>s.timeline.map(m=>m.water_mm)))
 const fmtWin=(i:number)=>monthLabel(ymFromIndex(i),lang)

 return <div className="rotation-app">
  <header className="r-header"><div className="r-header-in">
   <div className="r-brand"><span className="r-logo" aria-hidden="true">✳</span><span>BIOTEX<small>{t.brand}</small></span></div>
   <span className="r-pilot">{t.pilot}</span>
   <div className="r-lang" role="group" aria-label="Language / Idioma">
    <button type="button" aria-pressed={lang==='es'} className={lang==='es'?'on':''} onClick={()=>setLang('es')}>ES</button>
    <button type="button" aria-pressed={lang==='en'} className={lang==='en'?'on':''} onClick={()=>setLang('en')}>EN</button>
   </div>
  </div>
  <nav className="r-steps" aria-label="Steps">{t.steps.map((label,i)=>{const s=(i+1) as Step;const enabled=s===1||(s===2&&!!field)||(s===3&&current.length>0)||(s===4&&!!result)
   return <button key={label} type="button" disabled={!enabled} aria-current={step===s?'step':undefined} className={step===s?'on':''} onClick={()=>go(s)}><b>{s}</b>{label}</button>})}</nav>
  </header>
  <main className="r-main">
   {step===1&&<section className="r-panel">
    <h1>{t.s1Title}</h1><p>{t.s1Lead}</p>
    <div className="r-zone" role="group" aria-label={t.zone}>{(Object.keys(ZONES) as ZoneId[]).map(z=><button key={z} type="button" aria-pressed={zone===z} className={zone===z?'on':''} onClick={()=>{setZone(z);setField(null);setDrawing(false);setVertices([]);resetDownstream()}}>{ZONES[z].name}<small>{ZONES[z].valley}</small></button>)}</div>
    <div className="r-map-wrap">
     <MapContainer className="r-map" center={[ZONES[zone].lat,ZONES[zone].lng]} zoom={13} scrollWheelZoom={false}>
      <TileLayer attribution="Imagery &copy; Esri, Maxar, Earthstar Geographics" url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"/>
      <FitView zone={zone} polygon={polygonLL}/>
      <DrawingLayer active={drawing} vertices={vertices} onVertex={p=>{setDrawError('');setVertices(v=>v.length<40?[...v,p]:v)}} onClose={finishDrawing}/>
      {polygonLL&&<Polygon positions={polygonLL.map(p=>[p.lat,p.lng])} pathOptions={{color:'#ffd34d',weight:3,fillOpacity:.15}}/>}
     </MapContainer>
     <div className="r-map-tools">
      {drawing?<><span role="status" className="r-map-status">{t.corners(vertices.length)}</span>{drawError&&<span role="alert" className="r-map-error">{drawError}</span>}<button type="button" className="r-btn r-btn-outline" disabled={vertices.length===0} onClick={()=>{setDrawError('');setVertices(v=>v.slice(0,-1))}}>↶ {t.undo}</button><button type="button" className="r-btn" disabled={vertices.length<3} onClick={finishDrawing}>✓ {t.finish}</button><button type="button" className="r-btn r-btn-outline" onClick={()=>{setDrawing(false);setVertices([])}}>{t.cancel}</button></>
       :<button type="button" className="r-btn r-btn-outline" onClick={()=>{setDrawing(true);setVertices([]);setDrawError('')}}>✏️ {t.draw}</button>}
     </div>
    </div>
    <p className="r-small">{t.sectorNote(ZONES[zone].sector,ZONES[zone].code)} <a href={PADRON_URL} target="_blank" rel="noreferrer">MIDAGRI</a></p>
    {examples.length>0&&<div className="r-examples"><h2>{t.examples}</h2>
     {(['team','test'] as const).map(kind=>{const list=examples.filter(f=>kind==='team'?TEAM_FIELDS.includes(f):TEST_FIELDS.includes(f));if(!list.length)return null
      return <div key={kind}><h3>{kind==='team'?t.teamFields:t.testFields}</h3><div className="r-chips">{list.map(f=><button key={f.id} type="button" className={'r-chip'+(field?.polygon===f.polygon?' on':'')} onClick={()=>chooseExample(f)}>{lang==='es'?f.label_es:f.label_en}</button>)}</div></div>})}
    </div>}
    <details className="r-geojson"><summary>{t.geojson}</summary><p className="r-small">{t.geojsonHint}</p>
     <textarea rows={4} value={geoText} onChange={e=>setGeoText(e.target.value)} placeholder='{"type":"Polygon","coordinates":[[[-77.17,-11.55],...]]}'/>
     <div className="r-row"><input type="file" accept=".geojson,.json,application/geo+json,application/json" onChange={async e=>{const f=e.target.files?.[0];if(f){const txt=await f.text();setGeoText(txt);useGeo(txt)}}}/><button type="button" className="r-btn r-btn-outline" disabled={!geoText.trim()} onClick={()=>useGeo(geoText)}>{t.useGeojson}</button></div>
    </details>
    {drawError&&!drawing&&<p className="r-error" role="alert">{drawError}</p>}
    <div className="r-field-status">{field?<><b>{field.label}</b> · {t.area(area.toLocaleString(lang==='es'?'es-PE':'en-US',{maximumFractionDigits:2}))}{field.note&&<p className="r-small">{field.note}</p>}</>:<span>{t.noField}</span>}</div>
    <button type="button" className="r-btn r-btn-wide" disabled={!field} onClick={()=>{go(2);if(!history)void loadHistory()}}>{t.seeHistory}</button>
   </section>}

   {step===2&&<section className="r-panel">
    <h1>{t.s2Title}</h1>
    {historyLoading&&<p className="r-loading" role="status"><span className="r-spinner" aria-hidden="true"/>{t.loadingHistory}</p>}
    {historyError&&<div className="r-error" role="alert">{t.historyError} {historyError} <button type="button" className="r-btn r-btn-outline" onClick={()=>void loadHistory()}>{t.retry}</button></div>}
    {history&&<>
     <ul className="r-legend"><li><i className="lg-crop"/>{t.legendCrop}</li><li><i className="lg-bare"/>{t.legendBare}</li><li><i className="lg-cloud"/>{t.legendCloud}</li></ul>
     <NdviChart history={history} lang={lang} windowStart={windowStart}/>
     <p className="r-foot">{t.foot}</p>
     <p className="r-small">{lang==='es'?history.label_es:history.label_en} {t.sensor(history.sensor,history.months_with_data,history.months_total)}</p>
     <p className="r-small">{t.windowNote(fmtWin(windowStart),fmtWin(windowStart+23))}</p>
     {windowCampaigns.length===0&&<p className="r-note">{t.noCampaigns}</p>}
     <div className="r-campaigns">{windowCampaigns.map(c=><div key={c.start} className="r-campaign">
      <p><b>{t.ask(monthLabel(c.start,lang),monthLabel(c.end,lang))}</b></p>
      {c.candidates[0]&&<p className="r-small">{t.suggested}: {cropName(c.candidates[0].crop_id,lang)}</p>}
      <div className="r-chips">{CROP_IDS.map(id=><button key={id} type="button" className={'r-chip'+(answers[c.start]===id?' on':'')} aria-pressed={answers[c.start]===id} onClick={()=>{setTemplateCurrent(null);setManualCurrent(null);setResult(null);setAnswers(a=>({...a,[c.start]:id}))}}>{CROPS[id].icon} {cropName(id,lang)}</button>)}
       <button type="button" className={'r-chip muted'+(answers[c.start]==='unknown'?' on':'')} onClick={()=>{setTemplateCurrent(null);setManualCurrent(null);setResult(null);setAnswers(a=>({...a,[c.start]:'unknown'}))}}>{t.dontRemember}</button></div>
     </div>)}</div>
    </>}
    {(history||historyError)&&<button type="button" className="r-btn r-btn-outline" onClick={async()=>{try{const r=await fetch(API+'/api/rotation/templates');const v=await r.json();setTemplateCurrent(v.templates.current);setManualCurrent(null);setResult(null)}catch(e){setHistoryError(readableApiError(e,lang==='en'))}}}>{t.useTemplate}</button>}
    <div className="r-manual">
     <h3>{t.manualTitle}</h3><p className="r-small">{t.manualLead}</p>
     <div className="r-manual-controls">
      <label>{t.manualCrop}<select value={manualCrop} onChange={e=>setManualCrop(e.target.value)}>{CROP_IDS.map(id=><option key={id} value={id}>{cropName(id,lang)}</option>)}</select></label>
      <label>{t.manualMonth}<select value={manualMonth} onChange={e=>setManualMonth(Number(e.target.value))}>{Array.from({length:24},(_,i)=><option key={i} value={i}>{fmtWin(windowStart+i)}</option>)}</select></label>
      <button type="button" className="r-btn" disabled={current.length>=10} onClick={addManualPlanting}>{t.manualAdd}</button>
     </div>
     {manualError&&<p className="r-error" role="alert">{manualError}</p>}
     {manualCurrent&&<button type="button" className="r-btn r-btn-outline" onClick={()=>{setManualCurrent(null);setResult(null);setManualError('')}}>{t.backToHistory}</button>}
    </div>
    {templateCurrent&&<p className="r-note" role="status">{t.demoOnly}</p>}
    {current.length>0&&<div className="r-current"><h3>{t.manualTitle}</h3><p className="r-small">{templateCurrent?t.demoOnly:t.confirmed(current.length)}</p>
     <ul className="r-plantings">{current.map((p,k)=><li key={k}><span className="r-dot" style={{background:CROPS[p.crop_id]?.color}}/>{CROPS[p.crop_id]?.icon} {cropName(p.crop_id,lang)} · {t.sowIn} {fmtWin(windowStart+p.start_index)}{manualCurrent&&<button type="button" className="r-manual-remove" onClick={()=>{setManualCurrent(a=>removePlantingFromRotation(a||[],k));setResult(null)}}>{t.manualRemove}</button>}</li>)}</ul></div>}
    <div className="r-nav"><button type="button" className="r-btn r-btn-outline" onClick={()=>go(1)}>{t.back}</button><button type="button" className="r-btn" disabled={current.length===0} onClick={()=>go(3)}>{t.next}</button></div>
   </section>}

   {step===3&&<section className="r-panel">
    <h1>{t.s3Title}</h1><p>{t.s3Lead}</p>
    <div className="r-sliders">{(Object.keys(priorities) as (keyof typeof priorities)[]).map(k=><label key={k} className="r-slider"><span>{t.prio[k]}</span>
     <input type="range" min={0} max={2} step={1} value={priorities[k]} onChange={e=>{setPriorities(p=>({...p,[k]:Number(e.target.value)}));setResult(null)}} aria-valuetext={t.levels[priorities[k]]}/><b>{t.levels[priorities[k]]}</b></label>)}</div>
    <fieldset className="r-turn"><legend>{t.turnQ}</legend>{(['normal','escaso','no_se'] as const).map(v=><button key={v} type="button" aria-pressed={turn===v} className={'r-chip'+(turn===v?' on':'')} onClick={()=>{setTurn(v);setResult(null)}}>{t.turn[v]}</button>)}</fieldset>
    {compareError&&<p className="r-error" role="alert">{compareError}</p>}
    <div className="r-nav"><button type="button" className="r-btn r-btn-outline" onClick={()=>go(2)}>{t.back}</button><button type="button" className="r-btn" disabled={comparing||current.length===0} onClick={()=>void runCompare()}>{comparing?t.comparing:t.compare}</button></div>
   </section>}

   {step===4&&result&&<section className="r-panel r-compare" id="rotation-report">
    <h1>{t.s4Title}</h1>
    <p className="r-disclaimer">{lang==='es'?(result.disclaimer_es||t.disclaimer):(result.disclaimer_en||t.disclaimer)}</p>
    {result.strategies.length===0?<p className="r-note">{t.abstain} {lang==='es'?result.message_es:result.message_en}</p>:<>
     <div className="r-print-meta">{field?.label} · {ZONES[zone].name} · {new Date().toLocaleDateString(lang==='es'?'es-PE':'en-US')}</div>
     {result.status==='partial'&&<p className="r-note" role="status">{t.partial}</p>}
     <ContextStrips ctx={ctx} lang={lang}/>
     <div className="r-strategies">{result.strategies.map(s=><StrategyCard key={s.id} s={s} ctx={ctx} lang={lang} maxWater={maxWater} incomeCrop={result.income_crop} open={!!open[s.id]} onToggle={()=>setOpen(o=>({...o,[s.id]:!o[s.id]}))}/>)}</div>
     {result.climate&&<div className="r-climate"><h3>{t.climate}</h3><ul>
      <li>NASA POWER · {result.climate.period} · ET0 {result.climate.annual_et0_mm.toFixed(0)} mm/{lang==='es'?'año':'yr'}</li>
      {result.upper_basin_rain&&(result.upper_basin_rain.status==='available'?<>
       <li>{result.upper_basin_rain.source} · {lang==='es'?result.upper_basin_rain.basin_es:result.upper_basin_rain.basin_en} · {result.upper_basin_rain.years?.join('–')}</li>
       {result.upper_basin_rain.last_season?.percent_of_normal!=null&&<li><b>{t.basinSeason(result.upper_basin_rain.last_season.season,result.upper_basin_rain.last_season.percent_of_normal)}</b></li>}
       <li>{lang==='es'?result.upper_basin_rain.note_es:result.upper_basin_rain.note_en}</li></>
       :<li>{lang==='es'?result.upper_basin_rain.message_es:result.upper_basin_rain.message_en}</li>)}      {result.climate.cell_adjustment&&<li>{lang==='es'?result.climate.cell_adjustment.reason_es:result.climate.cell_adjustment.reason_en}</li>}
      {(lang==='es'?result.climate.limitations:(result.climate.limitations_en||[])).map((l,i)=><li key={i}>{l}</li>)}
     </ul></div>}
    </>}
    <div className="r-nav r-noprint"><button type="button" className="r-btn r-btn-outline" onClick={()=>go(3)}>{t.back}</button>
     <button type="button" className="r-btn" onClick={()=>{setOpen({S0:true,S1:true,S2:true});setPrintHelp(true);setTimeout(()=>window.print(),150)}}>{t.print}</button>
     <button type="button" className="r-btn r-btn-outline" onClick={()=>{setOpen({S0:true,S1:true,S2:true});setPrintHelp(true);setTimeout(()=>window.print(),150)}}>{t.technician}</button></div>
    {printHelp&&<p className="r-small r-noprint" role="status">{t.techHelp}</p>}
   </section>}
  </main>
  <footer className="r-footer"><span>{t.footer}</span><span>{t.otherViews} <a href="?vista=clima">{t.weatherView}</a> · <a href="?vista=tecnica">{t.techView}</a></span></footer>
 </div>
}
