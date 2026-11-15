// AI-assisted: farmer-first BIOTEX interface. Scientific calculations remain on the server.
import {useEffect,useMemo,useRef,useState,type ReactNode,type FormEvent} from 'react'
import {CircleMarker,MapContainer,Polygon,Polyline,TileLayer,WMSTileLayer,useMap,useMapEvents} from 'react-leaflet'
import {API,httpErrorMessage,readableApiError} from './network'
import {approximatePolygonHectares,validatePolygon} from './geometry'
import {TEAM_FIELDS,ZONES,type GeoPolygon} from './rotationZones'
import {addPlantingToRotation,removePlantingFromRotation} from './manualRotation'
import SatelliteEvidence from './SatelliteEvidence'
import FarmDecisionEvidence,{type EconomicReport} from './FarmDecisionEvidence'
import './biotex-farmer.css'

type Lang='es'|'en'
type Step=0|1|2|3
type Point={lat:number;lng:number}
type Planting={crop_id:string;start_index:number}
type Suggestion={crop_id:string;name_es:string}
type Campaign={start:string;end:string;candidates:Suggestion[]}
type History={sensor:string;period:{start:string;end:string};months_with_data:number;months_total:number;months:{month:string;ndvi:number|null;best_scene?:{date:string;scene_id?:string;collection?:string;platform?:string;valid_pixels?:number}|null}[];detection:{campaigns:Campaign[]}}
type OneCrop={crop_id:string;name_es:string;start_index:number;months:number;approximate:boolean}
type Strategy={
 id:string;key:string;title_es:string;title_en:string;origin:string;
 plantings:OneCrop[];timeline:{index:number;crop_id:string|null;water_mm:number;covered:boolean}[];
 indicators:{water_low_river_mm:number;bare_months:number;legume_plantings:number;approximate_crops:string[]};
 relative_to_current:{water_low_river_change_percent:number|null;water_total_change_percent:number|null;bare_months_change:number;legume_plantings_change:number}|null;
 sections:{why:{es:string[];en:string[]};benefits:{es:string[];en:string[]};gaps:{es:string[];en:string[]};risks:{es:string[];en:string[]};evidence:{es:string[];en:string[]}}
}
type FieldSoil={texture?:'arenosa'|'franca'|'arcillosa';ph?:number;salinity_ds_m?:number;organic_matter_percent?:number;drainage?:'bueno'|'regular'|'malo'}
type OfficialContext={
 ana_historical_context?:{status:string;reference_url?:string;statistics?:{river:string;average_flow_m3_s:number}[]};
 basin?:{status:string};weather_alerts?:{status:string};market_prices?:{status:string}
}
type SoilResult={status:string;alerts?:{crop_id:string;message_es:string}[];needs_review?:string[]}
type Result={status:string;strategies:Strategy[];official_evidence?:OfficialContext;soil_assessment?:SoilResult;recommended_strategy_id?:string|null;recommendation_confidence?:'limited'|'relative_evidence'|'insufficient';farm_inputs?:{soil?:FieldSoil;irrigation_allowance_m3_ha_season?:number;status:string};upper_basin_rain?:{status:string;last_season?:{season:string;percent_of_normal:number};note_es?:string;note_en?:string};
 recommendation_reason_es?:string;recommendation_reason_en?:string;
 climate?:{period:string;annual_et0_mm:number;cell_adjustment?:{reason_es:string;reason_en:string}|null};
 income_crop?:string;disclaimer_es?:string;disclaimer_en?:string;method?:Record<string,unknown>}

const NAMES:Record<string,[string,string]>={
 maiz_amarillo_duro:['Maíz amarillo duro','Yellow maize'],maiz_chala:['Maíz chala','Forage maize'],
 camote:['Camote','Sweet potato'],papa:['Papa','Potato'],frijol_grano_seco:['Frijol canario','Canary bean'],
 frijol_castilla:['Frijol castilla','Cowpea'],vainita:['Vainita','Green bean'],pallar:['Pallar','Lima bean'],
 arveja_verde:['Arveja','Pea'],cebolla:['Cebolla','Onion'],zanahoria:['Zanahoria','Carrot'],
 brocoli_col:['Brócoli / col','Broccoli / cabbage'],alfalfa:['Alfalfa','Alfalfa']
}
const CROPS=Object.keys(NAMES)
const MONTHS_ES=['enero','febrero','marzo','abril','mayo','junio','julio','agosto','setiembre','octubre','noviembre','diciembre']
const MONTHS_EN=['January','February','March','April','May','June','July','August','September','October','November','December']
const LABELS={
 es:{
 steps:['Mi chacra','Mis cultivos','Mis prioridades','Mi plan'],
 title:'Cultiva mejor, cuidando tu agua y tu tierra.',
 subtitle:'Marca tu chacra, cuéntanos qué sembraste y descubre opciones para tus próximas campañas.',
 pilot:'',region:'Barranca · Pativilca y Supe',
 search:'¿Dónde está tu chacra?',searchHint:'Escribe el nombre de tu localidad o distrito',find:'Buscar lugar',
 waitSearch:'Buscando lugares…',notFound:'No encontramos ese lugar. Prueba con el distrito o provincia.',
 mapHint:'Acerca el mapa y marca las esquinas de tu chacra.',draw:'Marcar mi chacra',finish:'Terminar terreno',
 undo:'Deshacer esquina',cancel:'Cancelar',area:'Área aproximada',changeField:'Cambiar terreno',
 examples:'Conoce BIOTEX en Barranca',exampleNote:'Parcela seleccionada para mostrar cómo se analizan imágenes de satélite.',
 pick:'Usar este ejemplo',fieldReady:'Tu terreno está marcado',fieldMissing:'Primero marca un terreno en el mapa.',
 locationUnavailable:'No pudimos buscar lugares. Intenta de nuevo.',invalidArea:'Marca entre 0,1 y 500 hectáreas.',
 invalidShape:'Revisa las esquinas: el terreno no debe cruzarse ni repetirse.',
 next:'Continuar',back:'Volver',
 historyTitle:'¿Qué cultivos sembraste?',historyLead:'Añade los cultivos que recuerdes de las últimas dos campañas.',
 crop:'Cultivo',month:'¿En qué mes lo sembraste?',add:'Agregar cultivo',saved:'Cultivos registrados',
 remove:'Quitar',nothing:'Todavía no has agregado cultivos.',duplicate:'Ya registraste un cultivo en ese mes.',
 limit:'Puedes registrar hasta 10 siembras.',helpMe:'¿No recuerdas alguna siembra?',satellite:'Buscar pistas con imágenes del terreno',
 loading:'Estamos revisando imágenes de tu chacra. Puedes seguir anotando tus cultivos.',
 loadingHelp:'Las imágenes pueden ayudar, pero no siempre permiten saber qué sembraste.',
 historyFound:'Encontramos estas posibles temporadas de cultivo. Dinos qué sembraste:',
 possible:'¿Qué sembraste en',choose:'Elegir cultivo',none:'No recuerdo',record:'Guardar este cultivo',
 recorded:'Cultivo guardado',noSeasons:'No encontramos temporadas claras. Puedes registrar tus cultivos a mano.',
 satFail:'No pudimos consultar las imágenes ahora. Puedes continuar con tus cultivos.',
 satMore:'Ver detalles de las imágenes (opcional)',satMonth:'Meses observados',
 priorityTitle:'¿Qué quieres mejorar primero?',priorityLead:'Elige lo que más te importa para tu próxima siembra.',
 priorityWater:'Usar menos agua',prioritySoil:'Cuidar más la tierra',priorityBoth:'Cuidar agua y tierra',
 income:'¿Qué cultivo quieres seguir sembrando?',incomeAuto:'El cultivo que más siembro',
 scarcity:'¿Entre mayo y noviembre te suele faltar agua?',yes:'Sí',no:'No',unknown:'No estoy seguro',
 action:'Ver mi plan',working:'Estamos preparando tu plan para esta chacra…',
 planTitle:'Tu propuesta para sembrar',planLead:'Revisa el orden de los cultivos, las fechas y los cambios que podría tener tu chacra.',
 recommended:'Rotación para revisar',noRecommend:'Todavía no encontramos una rotación claramente mejor.',
 current:'Tu forma de sembrar',alternative:'Otra opción para revisar',other:'Ver otras opciones',keyWater:'Agua en meses secos',keySoil:'Meses sin cultivo',fewer:'menos',more:'más',
 waterTrade:'Agua que podrían necesitar los cultivos',coverage:'meses sin sembrar en el ciclo de 24 meses',
 where:'Chacra',when:'Fecha',areaPrint:'Área aproximada',planSchedule:'Orden propuesto de siembra',
 year1:'Primer año',year2:'Segundo año',noCrop:'Sin cultivo previsto',sowing:'Siembra',
 benefits:'Qué puede mejorar',risks:'Qué debes tener en cuenta',verify:'Por confirmar en tu chacra',
 compare:'Comparación de opciones',details:'Cómo hicimos el análisis',warning:'Antes de empezar, comprueba el agua disponible y las condiciones de tu suelo.',
 report:'Imprimir o guardar PDF',startOver:'Revisar mis respuestas',sources:'Fuentes y límites',
 evidence:'Datos usados',reportTech:'Datos técnicos y cálculos',printFooter:'BIOTEX · NSPACE BIOTEX · NASA Space Apps 2026',
 unsupported:'Aquí todavía no tenemos un calendario de cultivos local comprobado. Puedes marcar y revisar tu terreno, pero las recomendaciones de siembra están disponibles para la costa de Lima.',
 missingPlan:'Necesitamos al menos un cultivo registrado para preparar tu plan.',
 partial:'Con los datos actuales no fue posible encontrar todas las opciones. Solo mostramos las calculadas.',
 unavailable:'No se encontraron alternativas suficientemente claras. Revisa tus siembras o consulta con un técnico.'
 },
 en:{
 steps:['My field','My crops','My priorities','My plan'],
 title:'Better harvests, caring for soil and water.',subtitle:'Mark your field, tell us what you grew, and discover options for your next seasons.',
 pilot:'',region:'Barranca · Pativilca and Supe',
 search:'Where is your field?',searchHint:'Enter your town or district',find:'Find a place',
 waitSearch:'Searching for places…',notFound:'No places found. Try a district or province.',
 mapHint:'Zoom in and mark the corners of your field.',draw:'Mark my field',finish:'Finish field',
 undo:'Undo corner',cancel:'Cancel',area:'Approximate area',changeField:'Change field',
 examples:'Explore BIOTEX in Barranca',exampleNote:'Selected field showing how satellite imagery is analysed.',
 pick:'Use this example',fieldReady:'Your field is marked',fieldMissing:'First mark a field on the map.',
 locationUnavailable:'We could not search places. Please try again.',invalidArea:'Mark an area from 0.1 to 500 hectares.',
 invalidShape:'Check the corners: field edges cannot cross or repeat.',
 next:'Continue',back:'Back',
 historyTitle:'What have you planted?',historyLead:'Add any crops you remember from the last two seasons.',
 crop:'Crop',month:'Which month did you plant?',add:'Add crop',saved:'Crops recorded',
 remove:'Remove',nothing:'You have not added crops yet.',duplicate:'A crop is already recorded in that month.',
 limit:'You can record up to 10 plantings.',helpMe:'Not sure what you planted?',satellite:'Look for clues in field images',
 loading:'We are checking images of your field. You can keep adding crops.',
 loadingHelp:'Images may help, but they cannot always identify the crop.',
 historyFound:'These may be past growing seasons. Tell us what you planted:',
 possible:'What did you plant in',choose:'Choose a crop',none:'I do not remember',record:'Save this crop',
 recorded:'Crop saved',noSeasons:'No clear growing seasons found. You can add crops manually.',
 satFail:'We could not check satellite images. You can keep entering crops.',
 satMore:'Show image details (optional)',satMonth:'Months observed',
 priorityTitle:'What would you most like to improve?',priorityLead:'Choose what matters for your next planting.',
 priorityWater:'Use less water',prioritySoil:'Care for the soil',priorityBoth:'Care for water and soil',
 income:'Which crop do you need to keep growing?',incomeAuto:'My most frequent crop',
 scarcity:'Do you have less irrigation water from May to November?',yes:'Yes',no:'No',unknown:'Not sure',
 action:'Show my plan',working:'Preparing a plan for your field…',
 planTitle:'Your planting proposal',planLead:'Review crop order, dates and estimated changes for your field.',
 recommended:'A rotation to review',noRecommend:'No clearly better rotation has been found yet.',
 current:'Your current planting',alternative:'Another option to review',other:'See other options',keyWater:'Water in dry months',keySoil:'Months without crops',fewer:'less',more:'more',
 waterTrade:'Estimated crop water compared with your current planting',coverage:'out of 24 months without a crop',
 where:'Field',when:'Date',areaPrint:'Approximate area',planSchedule:'Suggested crop order',
 year1:'Year one',year2:'Year two',noCrop:'No crop planned',sowing:'Sown',
 benefits:'What could improve',risks:'What to consider',verify:'Check on your field',
 compare:'Comparison of options',details:'How this was calculated',warning:'Before planting, check available water and your soil conditions.',
 report:'Print or save PDF',startOver:'Review my answers',sources:'Sources and limitations',
 evidence:'Data used',reportTech:'Technical calculations',printFooter:'BIOTEX · NSPACE BIOTEX · NASA Space Apps 2026',
 unsupported:'We do not yet have a verified local crop calendar here. You can mark and review the field, but planting options are available for coastal Lima.',
 missingPlan:'Add at least one crop before preparing your plan.',
 partial:'Not all options could be calculated with these inputs. Only calculated options are shown.',
 unavailable:'No clear alternative was found. Review your planting history or talk to a technician.'
 }
} as const
function labelCrop(id:string,lang:Lang){return (NAMES[id]||[id,id])[lang==='es'?0:1]}
function mon(i:number,lang:Lang){const m=(7+i)%12;return (lang==='es'?MONTHS_ES:MONTHS_EN)[m]}
function monthYear(index:number,baseYear:number,lang:Lang){const d=new Date(Date.UTC(baseYear,7+index,1));return (lang==='es'?MONTHS_ES:MONTHS_EN)[d.getUTCMonth()]+' '+d.getUTCFullYear()}
function planMonth(index:number,lang:Lang,year?:number){if(year){const d=new Date(Date.UTC(year,7+index,1));return (lang==='es'?MONTHS_ES:MONTHS_EN)[d.getUTCMonth()]+' '+d.getUTCFullYear()}return mon(index,lang)+' · '+(lang==='es'?'año ':'year ')+(index<12?'1':'2')}
function ymNumber(s:string){return Number(s.slice(0,4))*12+Number(s.slice(5,7))-1}
function recentAugust(){const now=new Date();const year=now.getUTCFullYear(),m=now.getUTCMonth()+1;return (m>=8?year:year-1)-2}
function simpleDate(lang:Lang){return new Date().toLocaleDateString(lang==='es'?'es-PE':'en-US',{year:'numeric',month:'long',day:'numeric'})}
function fromGeo(p:GeoPolygon):Point[]{return p.coordinates[0].slice(0,-1).map(([lng,lat])=>({lat,lng}))}
function toGeo(p:Point[]):GeoPolygon{return{type:'Polygon',coordinates:[[...p.map(a=>[a.lng,a.lat]),[p[0].lng,p[0].lat]]]}}
function centroid(p:GeoPolygon):Point{const a=fromGeo(p);return{lat:a.reduce((x,v)=>x+v.lat,0)/a.length,lng:a.reduce((x,v)=>x+v.lng,0)/a.length}}
function coastalLima(p:Point){return p.lat>=-12.35&&p.lat<=-10.20&&p.lng>=-78.35&&p.lng<=-76.55}
function isBarranca(p:Point){return p.lat>=-10.95&&p.lat<=-10.40&&p.lng>=-78.07&&p.lng<=-77.35}

function Icon({name,size=20}:{name:'search'|'pin'|'check'|'left'|'right'|'undo'|'leaf'|'water'|'print'|'alert'|'info',size?:number}){
 const shapes:Record<string,ReactNode>={
  search:<><circle cx="11" cy="11" r="7"/><path d="m16.5 16.5 4.5 4.5"/></>,
  pin:<><path d="M20 10c0 5-8 12-8 12S4 15 4 10a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="2.5"/></>,
  check:<path d="m4 12 5 5L20 6"/>,
  left:<path d="m14 5-7 7 7 7"/>,right:<path d="m10 5 7 7-7 7"/>,
  undo:<><path d="M9 14 4 9l5-5"/><path d="M4 9h9a6 6 0 0 1 0 12h-2"/></>,
  leaf:<><path d="M21 3c-9 0-17 4-17 13a5 5 0 0 0 5 5C18 21 22 13 21 3Z"/><path d="M4 21c3-7 7-9 13-12"/></>,
  water:<path d="M12 2C9 7 5 11 5 15a7 7 0 0 0 14 0c0-4-4-8-7-13Z"/>,
  print:<><rect x="6" y="14" width="12" height="8"/><path d="M6 8V2h12v6M6 17H3v-8h18v8h-3"/></>,
  alert:<><path d="m12 3 10 18H2L12 3Z"/><path d="M12 9v5m0 3v.5"/></>,
  info:<><circle cx="12" cy="12" r="10"/><path d="M12 11v6m0-10v1"/></>
 }
 return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{shapes[name]}</svg>
}
function FlyTo({point,polygon}:{point:Point;polygon:Point[]|null}){
 const map=useMap()
 useEffect(()=>{if(polygon&&polygon.length>2){map.fitBounds(polygon.map(p=>[p.lat,p.lng] as [number,number]),{padding:[40,40],maxZoom:17})}else{map.setView([point.lat,point.lng],13)}},[map,point.lat,point.lng,polygon])
 return null
}
function DrawLayer({enabled,points,onPoint,onFinish}:{enabled:boolean;points:Point[];onPoint:(p:Point)=>void;onFinish:()=>void}){
 const map=useMap()
 useEffect(()=>{if(enabled)map.doubleClickZoom.disable();else map.doubleClickZoom.enable();return()=>map.doubleClickZoom.enable()},[map,enabled])
 useMapEvents({
  click(e){if(!enabled)return
   const clicked={lat:e.latlng.lat,lng:e.latlng.lng}
   const pixelGap=(p:Point)=>{const a=map.latLngToContainerPoint([p.lat,p.lng]);const b=map.latLngToContainerPoint([clicked.lat,clicked.lng]);return Math.hypot(a.x-b.x,a.y-b.y)}
   const first=points[0]
   if(first&&points.length>=3&&pixelGap(first)<24){onFinish();return}
   if(points.length&&pixelGap(points[points.length-1])<10)return
   if(points.length<100)onPoint(clicked)},
  dblclick(){if(enabled&&points.length>=3)onFinish()}
 })
 if(!enabled)return null
 return <>{points.length>1&&<Polyline positions={points.map(p=>[p.lat,p.lng] as [number,number])} pathOptions={{color:'#F7C85C',weight:4}}/>}
 {points.map((p,i)=><CircleMarker key={i} center={[p.lat,p.lng]} radius={i===0?9:6} pathOptions={{color:'#134638',weight:2,fillColor:i===0?'#F7C85C':'#fff',fillOpacity:1}} eventHandlers={i===0?{click:()=>{if(points.length>=3)onFinish()}}:undefined}/>)}</>
}
const DEMOS=TEAM_FIELDS.filter(f=>f.zone==='barranca').slice(0,1)
const SAVED_FARM_KEY='biotex-farm-v1'
export default function BiotexFarmerApp(){
 const [lang,setLang]=useState<Lang>(()=>new URLSearchParams(window.location.search).get('lang')==='en'?'en':'es')
 const t=LABELS[lang]
 const [step,setStep]=useState<Step>(0)
 const [place,setPlace]=useState('Barranca, Pativilca / Supe')
 const [centre,setCentre]=useState<Point>({lat:ZONES.barranca.lat,lng:ZONES.barranca.lng})
 const [query,setQuery]=useState('')
 const [places,setPlaces]=useState<{name:string;lat:number;lng:number}[]>([])
 const [searching,setSearching]=useState(false)
 const [searchError,setSearchError]=useState('')
 const [field,setField]=useState<GeoPolygon|null>(null)
 const [fieldLabel,setFieldLabel]=useState('')
 const [isDemoField,setIsDemoField]=useState(false)
 const [drawing,setDrawing]=useState(false)
 const [points,setPoints]=useState<Point[]>([])
 const [fieldError,setFieldError]=useState('')
 const [plantings,setPlantings]=useState<Planting[]>([])
 const [crop,setCrop]=useState('maiz_amarillo_duro')
 const [cropMonth,setCropMonth]=useState(0)
 const [entryError,setEntryError]=useState('')
 const [history,setHistory]=useState<History|null>(null)
 const [historyBusy,setHistoryBusy]=useState(false)
 const [historyError,setHistoryError]=useState('')
 const [hintChoices,setHintChoices]=useState<Record<string,string>>({})
 const [satelliteAccepted,setSatelliteAccepted]=useState(false)
 const [manualEntered,setManualEntered]=useState(false)
 const [goal,setGoal]=useState<'water'|'soil'|'both'>('both')
 const [incomeCrop,setIncomeCrop]=useState('')
 const [soil,setSoil]=useState<FieldSoil>({})
 const [waterAllowance,setWaterAllowance]=useState('')
 const [scarcity,setScarcity]=useState<'normal'|'escaso'|'no_se'>('no_se')
 const [result,setResult]=useState<Result|null>(null)
 const [planBusy,setPlanBusy]=useState(false)
 const [planError,setPlanError]=useState('')
 const [economicReport,setEconomicReport]=useState<EconomicReport|null>(null)
 const [otherOpen,setOtherOpen]=useState(false)
 const [mapLayer,setMapLayer]=useState<'photo'|'vegetation'|'rain'>('photo')
 const [mapLayerFailed,setMapLayerFailed]=useState(false)
 const [saveMobileData,setSaveMobileData]=useState(false)
 const [planStartYear,setPlanStartYear]=useState(()=>{const d=new Date();return d.getUTCFullYear()+(d.getUTCMonth()>=7?1:0)})
 const [savedAvailable,setSavedAvailable]=useState(()=>{try{return Boolean(localStorage.getItem(SAVED_FARM_KEY))}catch{return false}})
 const [savedNotice,setSavedNotice]=useState('')
 const request=useRef(0)
 const baseYear=recentAugust()
 const point=field?centroid(field):centre
 const area=field?approximatePolygonHectares(fromGeo(field)):0
 const firstAugust=baseYear*12+7
 const confirmedOptions=[...new Set(plantings.map(p=>p.crop_id))]
 const supported=coastalLima(point)
 const province=isBarranca(point)
 const sampleNote=isDemoField
 const source=history&&satelliteAccepted&&!manualEntered?'satellite_confirmed':'farmer_declared'
 const current=useMemo(()=>plantings.slice().sort((a,b)=>a.start_index-b.start_index),[plantings])
 const mapPolygon=useMemo(()=>field?fromGeo(field):null,[field])

 useEffect(()=>{document.documentElement.lang=lang},[lang])
 function navigate(s:Step){setStep(s);window.scrollTo({top:0,behavior:'smooth'})}
 function saveFarm(){
  if(!field)return
  try{
   localStorage.setItem(SAVED_FARM_KEY,JSON.stringify({version:1,field,place,fieldLabel,isDemoField,
    plantings,goal,incomeCrop,scarcity,soil,waterAllowance,planStartYear}))
   setSavedAvailable(true);setSavedNotice(lang==='es'?'Tus datos se guardaron en este dispositivo.':'Your details are saved on this device.')
  }catch{setSavedNotice(lang==='es'?'El navegador no permitió guardar los datos.':'Your browser could not save these details.')}
 }
 function restoreFarm(){
  try{
   const data=JSON.parse(localStorage.getItem(SAVED_FARM_KEY)||'null')
   if(!data||data.version!==1||!data.field||!Array.isArray(data.plantings))throw new Error('bad saved farm')
   const vertices=fromGeo(data.field)
   if(!validatePolygon(vertices).valid||approximatePolygonHectares(vertices)<0.1||approximatePolygonHectares(vertices)>500)throw new Error('bad polygon')
   const safe= (data.plantings as Planting[]).filter(v=>CROPS.includes(v.crop_id)&&Number.isInteger(v.start_index)&&v.start_index>=0&&v.start_index<24).slice(0,10)
   resetAfterField()
   setField(data.field);setCentre(centroid(data.field));setFieldLabel(String(data.fieldLabel||''));setPlace(String(data.place||'Barranca'))
   setIsDemoField(Boolean(data.isDemoField));setPlantings(safe)
   if(['water','soil','both'].includes(data.goal))setGoal(data.goal)
   setIncomeCrop(String(data.incomeCrop||''));setScarcity(['escaso','normal','no_se'].includes(data.scarcity)?data.scarcity:'no_se')
   setSoil(data.soil&&typeof data.soil==='object'?data.soil:{})
   setWaterAllowance(String(data.waterAllowance||''))
   if(Number.isInteger(data.planStartYear))setPlanStartYear(data.planStartYear)
   setSavedNotice(lang==='es'?'Recuperamos tu chacra. Revisa los cultivos antes de continuar.':'Your field is restored. Please review the crops before continuing.')
  }catch{setSavedNotice(lang==='es'?'No pudimos recuperar el terreno guardado.':'Unable to restore saved field.')}
 }
 function resetAfterField(){request.current++;setPlantings([]);setHistory(null);setHistoryBusy(false);setHintChoices({});setSatelliteAccepted(false);setManualEntered(false);setResult(null);setPlanBusy(false);setPlanError('');setHistoryError('')}
 function changeArea(){setField(null);setFieldLabel('');setIsDemoField(false);setDrawing(false);setPoints([]);setFieldError('');resetAfterField()}
 function setExample(f:typeof DEMOS[number]){const p=f.polygon;setField(p);setCentre(centroid(p));setPlace('Barranca · Pativilca / Supe');setFieldLabel(lang==='es'?'Terreno de ejemplo en Barranca':'Example field in Barranca');setIsDemoField(true);setDrawing(false);setPoints([]);setFieldError('');resetAfterField()}
 async function searchPlace(e:FormEvent){
  e.preventDefault();const q=query.trim();if(q.length<3){setSearchError(t.notFound);return}
  setSearching(true);setSearchError('');setPlaces([])
  try{
   // OpenStreetMap Nominatim: explicit user-triggered searches only, never autocomplete.
   const url='https://nominatim.openstreetmap.org/search?format=json&limit=5&addressdetails=1&q='+encodeURIComponent(q)
   const r=await fetch(url,{headers:{'Accept-Language':lang==='es'?'es':'en'}})
   if(!r.ok)throw new Error('Search unavailable')
   const data=(await r.json()) as {display_name:string;lat:string;lon:string}[]
   const found=data.map(x=>({name:x.display_name,lat:Number(x.lat),lng:Number(x.lon)})).filter(x=>Number.isFinite(x.lat)&&Number.isFinite(x.lng))
   setPlaces(found);if(!found.length)setSearchError(t.notFound)
  }catch{setSearchError(t.locationUnavailable)}finally{setSearching(false)}
 }
 function pickPlace(p:{name:string;lat:number;lng:number}){setCentre({lat:p.lat,lng:p.lng});setPlace(p.name);setQuery('');setPlaces([]);changeArea()}
 function finish(){const check=validatePolygon(points);const ha=approximatePolygonHectares(points)
  if(!check.valid){setFieldError(t.invalidShape);return}
  if(ha<0.1||ha>500){setFieldError(t.invalidArea);return}
  setField(toGeo(points));setFieldLabel(lang==='es'?'Chacra marcada por ti':'Field marked by you');setIsDemoField(false);setDrawing(false);setPoints([]);setFieldError('');resetAfterField()}
 function addCrop(){const x=addPlantingToRotation(plantings,crop,cropMonth)
  if(x.status!=='added'){setEntryError(x.status==='duplicate'?t.duplicate:t.limit);return}
  setPlantings(x.current);setManualEntered(true);setEntryError('');setResult(null)}
 function recordSeason(c:Campaign){
  const id=hintChoices[c.start];if(!id)return
  const start=ymNumber(c.start)-1-firstAugust
  const idx=Math.max(0,Math.min(23,start))
  const r=addPlantingToRotation(plantings,id,idx)
  if(r.status==='added'){setPlantings(r.current);setSatelliteAccepted(true);setEntryError('');setResult(null)}
  else setEntryError(r.status==='duplicate'?t.duplicate:t.limit)
 }
 async function loadImages(){
  if(!field)return;const token=++request.current;setHistoryBusy(true);setHistoryError('')
  try{
   for(let attempt=0;attempt<24;attempt++){
    const r=await fetch(API+'/api/rotation/history',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({polygon:field,start_year:2021})})
    if(request.current!==token)return
    if(r.status===202){await new Promise(resolve=>setTimeout(resolve,5000));continue}
    if(!r.ok)throw new Error(await httpErrorMessage(r,lang==='en'))
    setHistory(await r.json() as History);return
   }
   setHistoryError(t.satFail)
  }catch(e){if(request.current===token)setHistoryError(readableApiError(e,lang==='en'))}
  finally{if(request.current===token)setHistoryBusy(false)}
 }
 const seasons=(history?.detection.campaigns||[]).filter(c=>{const n=ymNumber(c.start)-1-firstAugust;return n>=0&&n<=23}).slice(0,8)
 async function showPlan(){
  if(!current.length){setPlanError(t.missingPlan);return}
  if(!supported){setPlanError(t.unsupported);return}
  if(!field){setPlanError(t.fieldMissing);return}
  const token=++request.current;setPlanBusy(true);setPlanError('');setResult(null)
  const priorities=goal==='water'?{water:2,soil:0,income:1,pests:1}:goal==='soil'?{water:0,soil:2,income:1,pests:1}:{water:2,soil:2,income:1,pests:1}
  const payload={
   zone:province?'barranca':null,latitude:point.lat,longitude:point.lng,
   current,priorities,water_turn:scarcity,current_source:source,
   income_crop_id:confirmedOptions.includes(incomeCrop)?incomeCrop:null,
   use_team_templates_as_fallback:false,
   soil:Object.keys(soil).length?{...soil,source:'farmer_reported'}:null,
   irrigation_allowance_m3_ha_season:waterAllowance.trim()?Number(waterAllowance):null,
   irrigation_source:waterAllowance.trim()?'farmer_reported':null,
   history:source==='satellite_confirmed'&&history?{sensor:history.sensor,start:history.period.start,end:history.period.end,months_with_data:history.months_with_data}:null
  }
  try{const r=await fetch(API+'/api/rotation/compare',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)})
   if(!r.ok)throw new Error(await httpErrorMessage(r,lang==='en'))
   const v=await r.json() as Result
   if(token!==request.current)return
   setResult(v);setEconomicReport(null);setOtherOpen(false);navigate(3)
  }catch(e){if(token===request.current)setPlanError(readableApiError(e,lang==='en'))}
  finally{if(token===request.current)setPlanBusy(false)}
 }
 const preferred=result?.strategies.find(s=>s.id===result.recommended_strategy_id)||null
 const original=result?.strategies.find(s=>s.id==='S0')||null
 const other=result?.strategies.filter(s=>s.id!=='S0'&&s.id!==preferred?.id)||[]
 function goPrint(){window.print()}
 function strategyName(s:Strategy){
  if(s.id==='S0')return t.current
  if(s.key==='water'){
   const change=s.relative_to_current?.water_low_river_change_percent
   if(change==null||change>=0)return lang==='es'?'Cambiar las fechas de siembra':'Change sowing dates'
   if(change>-5)return lang==='es'?'Otra forma de sembrar':'Another planting sequence'
   return lang==='es'?'Opción para usar menos agua':'Option to use less water'
  }
  return lang==='es'?'Opción para cuidar la tierra':'Option to care for soil'
 }
 function schedule(s:Strategy){return [...s.plantings].sort((a,b)=>a.start_index-b.start_index)}
 function showPct(v:number|null|undefined){if(v==null)return '—';return (v>0?'+':'')+Math.round(v)+'%'}
 function consequences(s:Strategy){const r=s.relative_to_current;return r?[
  {title:t.keyWater,value:showPct(r.water_low_river_change_percent),bad:(r.water_low_river_change_percent??0)>0,good:(r.water_low_river_change_percent??0)<0},
  {title:t.keySoil,value:Math.abs(r.bare_months_change)+' '+(r.bare_months_change>0?t.more:r.bare_months_change<0?t.fewer:'='),bad:r.bare_months_change>0,good:r.bare_months_change<0},
  {title:lang==='es'?'Cambios en siembras de legumbres':'Change in legume plantings',value:(r.legume_plantings_change>0?'+':'')+String(r.legume_plantings_change),bad:r.legume_plantings_change<0,good:r.legume_plantings_change>0}
 ]:[]}
 function cropsLine(s:Strategy){return schedule(s).map(p=>labelCrop(p.crop_id,lang)).join(' · ')}
 function technical(s:Strategy){return <details className="b-technical"><summary>{t.details}</summary>
  <div className="b-technical-inner"><h4>{t.evidence}</h4><ul>{s.sections.evidence[lang].map((a,i)=><li key={i}>{a}</li>)}</ul>
   <h4>{t.verify}</h4><ul>{s.sections.gaps[lang].map((a,i)=><li key={i}>{a}</li>)}</ul>
   {result?.farm_inputs?.soil&&<p>{lang==='es'?'Datos del suelo anotados por ti (todavía no utilizados para descartar cultivos):':'Your recorded soil data (not yet used to exclude crops):'} {Object.entries(result.farm_inputs.soil).filter(([k])=>k!=='source').map(([k,v])=>k+' '+v).join(' · ')}</p>}
   {result?.farm_inputs?.irrigation_allowance_m3_ha_season!=null&&<p>{lang==='es'?'Agua anotada por ti (sin comprobar contra necesidades reales de riego):':'Water volume you entered (not yet compared with actual irrigation needs):'} {result.farm_inputs.irrigation_allowance_m3_ha_season} m³/ha</p>}
   {result?.upper_basin_rain?.status==='available'&&<p>NASA GPM IMERG: {result.upper_basin_rain.last_season?.season} · {result.upper_basin_rain.last_season?.percent_of_normal}% {lang==='es'?'de la lluvia habitual en cabecera de cuenca; no equivale al caudal del canal.':'of normal rainfall in the upper basin; not canal flow.'}</p>}
   </div>
 </details>}
 function strip(s:Strategy){const crops=schedule(s)
  return <div className="b-sequence" aria-label={t.planSchedule}>{crops.length?crops.map((p,i)=><div className="b-sequence-step" key={p.start_index+'-'+p.crop_id}>
   <span className="b-sequence-num">{i+1}</span>
   <div><strong>{labelCrop(p.crop_id,lang)}</strong><span>{lang==='es'?'Sembrar desde':'Sow from'} {planMonth(p.start_index,lang,planStartYear)} · {p.months} {lang==='es'?'meses aprox.':'months approx.'}</span></div>
  </div>):<p>{t.noCrop}</p>}
   <p className="b-sequence-foot">{lang==='es'?'El orden se basa en un ciclo de dos años que empieza en agosto. Los meses sin cultivo no son instrucciones de dejar el terreno abandonado.':'Order follows a two-year cycle starting in August. Gaps are not instructions to neglect the field.'}</p>
  </div>
 }
 function mainCard(s:Strategy){
  const relative=s.relative_to_current
  const negligible=relative?.water_low_river_change_percent!=null&&Math.abs(relative.water_low_river_change_percent)<5
  return <article className="b-recommend">
   <div className="b-recommend-top"><span className="b-eyebrow">{t.recommended}</span><h2>{strategyName(s)}</h2>
    <p>{result?.[lang==='es'?'recommendation_reason_es':'recommendation_reason_en']||t.planLead}</p>
    {negligible&&<p className="b-small-change">{lang==='es'?'La diferencia de agua es pequeña: no la tomes como un ahorro comprobado.':'Water difference is small and should not be considered verified savings.'}</p>}
   </div>
   <div className="b-keyfigures">{consequences(s).map((k,i)=><div key={i} className={'b-kpi '+(k.bad?'risk':k.good?'positive':'neutral')}><span>{k.title}</span><strong>{k.value}</strong></div>)}</div>
   <h3>{t.planSchedule}</h3>{strip(s)}
   <div className="b-benefits-grid"><section><h3>{t.benefits}</h3><ul>{s.sections.benefits[lang].slice(0,4).map((x,i)=><li key={i}>{x}</li>)}</ul></section>
    <section><h3>{t.risks}</h3><ul>{s.sections.risks[lang].slice(0,4).map((x,i)=><li key={i}>{x}</li>)}</ul></section></div>
   {technical(s)}
  </article>
 }
 function printable(){if(!result)return null;
  const maxWater=Math.max(1,...result.strategies.map(x=>x.indicators.water_low_river_mm));
  const corners=field?fromGeo(field):[]
  const xs=corners.map(p=>p.lng),ys=corners.map(p=>p.lat)
  const minX=Math.min(...xs),maxX=Math.max(...xs),minY=Math.min(...ys),maxY=Math.max(...ys)
  const sketch=corners.length>=3?corners.map(p=>{
   const x=10+100*(p.lng-minX)/Math.max(1e-7,maxX-minX)
   const y=80-60*(p.lat-minY)/Math.max(1e-7,maxY-minY)
   return x.toFixed(1)+','+y.toFixed(1)
  }).join(' '):'';
  return <div className="b-print-report" aria-hidden={step!==3}>
  <div className="b-print-header"><div><strong className="b-print-logo">BIOTEX</strong><p>{t.printFooter}</p></div><div className="b-print-date">{simpleDate(lang)}</div></div>
  <h1>{t.planTitle}</h1>
  {sketch&&<figure className="b-print-sketch"><svg viewBox="0 0 120 100" role="img" aria-label={lang==='es'?'Croquis del terreno marcado':'Outline of marked field'}><rect x="1" y="1" width="118" height="98" rx="5" fill="#f4f7f4" stroke="#d5e3d8"/><polygon points={sketch} fill="#dbeee1" stroke="#236147" strokeWidth="2.3"/><text x="102" y="13" fill="#42654e" fontSize="9">N ↑</text></svg><figcaption>{lang==='es'?'Contorno aproximado de la chacra':'Approximate field outline'}</figcaption></figure>}
  <div className="b-print-meta"><span><b>{t.where}:</b> {place}</span><span><b>{t.areaPrint}:</b> {area.toFixed(2)} ha</span>
  <span><b>{t.when}:</b> {simpleDate(lang)}</span></div>
  <p className="b-print-intro">{t.warning} {sampleNote?t.exampleNote:''}</p>
  {preferred?<><h2>{t.recommended}: {strategyName(preferred)}</h2><p>{result[lang==='es'?'recommendation_reason_es':'recommendation_reason_en']}</p>
   <div className="b-print-kpis">{consequences(preferred).map((x,i)=><div key={i}><span>{x.title}</span><b>{x.value}</b></div>)}</div>
   <h3>{t.planSchedule} · {lang==='es'?'inicio: agosto':'start: August'} {planStartYear}</h3><table className="b-print-table"><thead><tr><th>{lang==='es'?'Año':'Year'}</th><th>{t.sowing}</th><th>{t.crop}</th><th>{lang==='es'?'Duración':'Duration'}</th></tr></thead>
    <tbody>{schedule(preferred).map((p,i)=><tr key={i}><td>{p.start_index<12?'1':'2'}</td><td>{planMonth(p.start_index,lang,planStartYear)}</td><td>{labelCrop(p.crop_id,lang)}</td><td>{p.months} {lang==='es'?'meses':'months'}</td></tr>)}</tbody></table>
   <div className="b-print-grid"><section><h3>{t.benefits}</h3><ul>{preferred.sections.benefits[lang].slice(0,4).map((x,i)=><li key={i}>{x}</li>)}</ul></section><section><h3>{t.risks}</h3><ul>{preferred.sections.risks[lang].slice(0,4).map((x,i)=><li key={i}>{x}</li>)}</ul></section></div>
  </>:<h2>{t.noRecommend}</h2>}
  <h3>{t.compare}</h3><table className="b-print-table"><thead><tr><th>{lang==='es'?'Opción':'Option'}</th><th>{t.keyWater}</th><th>{t.keySoil}</th></tr></thead>
  <tbody>{result.strategies.map(s=><tr key={s.id}><td>{strategyName(s)}</td><td>{s.relative_to_current?showPct(s.relative_to_current.water_low_river_change_percent):(lang==='es'?'Actual':'Current')}</td><td>{s.indicators.bare_months} / 24</td></tr>)}</tbody></table>
  <section className="b-print-chart"><h3>{lang==='es'?'Agua que podrían necesitar los cultivos en meses secos (estimación)':'Estimated crop-water demand in dry months'}</h3>
  {result.strategies.map(s=><div key={s.id} className="b-print-bar-row"><span>{strategyName(s)}</span><div className="b-print-bar-track"><div className="b-print-bar-fill" style={{width:(100*s.indicators.water_low_river_mm/maxWater).toFixed(1)+'%'}}/></div><strong>{Math.round(s.indicators.water_low_river_mm)} mm</strong></div>)}
  <h3>{lang==='es'?'Tiempo sin cultivo durante 24 meses':'Months without crop during 24 months'}</h3>
  {result.strategies.map(s=><div key={s.id} className="b-print-bar-row"><span>{strategyName(s)}</span><div className="b-print-bar-track"><div className="b-print-bar-fill" style={{width:(100*s.indicators.bare_months/24).toFixed(1)+'%'}}/></div><strong>{s.indicators.bare_months}/24</strong></div>)}
  </section>
  <div className="b-print-small"><h3>{t.sources}</h3>
  <p>NASA POWER (2001–2025); {history?(lang==='es'?'NASA HLS v2.0 (imágenes consultadas; cultivos confirmados por una persona)':'NASA HLS v2.0 (images consulted; crops confirmed by a person)'):(lang==='es'?'historial de cultivos declarado por la persona (sin análisis HLS)':'farmer-declared crop history (no HLS analysis)')}; FAO-56; DRA Lima/MIDAGRI 2024–2025.</p>
  <p>{lang==='es'?'Solo se utiliza un calendario agrícola aproximado de Lima; no se conoce el análisis de suelo, turno real de riego o precio futuro. Los cálculos son comparaciones relativas, no recomendaciones garantizadas.':'Uses an approximate Lima sowing calendar. Soil test, actual irrigation allocation and future prices are not known. Results are relative comparisons, not guarantees.'}</p>
  {result.farm_inputs?.soil&&<p>{lang==='es'?'Suelo declarado (sin validación de laboratorio):':'Reported soil (without laboratory verification):'} {Object.entries(result.farm_inputs.soil).filter(([k])=>k!=='source').map(([k,v])=>k+': '+v).join(' · ')}</p>}
  {result.farm_inputs?.irrigation_allowance_m3_ha_season!=null&&<p>{lang==='es'?'Agua anotada por el usuario, todavía no usada como restricción:':'Reported irrigation water, not yet a hard constraint:'} {result.farm_inputs.irrigation_allowance_m3_ha_season} m³/ha.</p>}
  {result.upper_basin_rain?.status==='available'&&<p>NASA GPM IMERG: {result.upper_basin_rain.last_season?.season}, {result.upper_basin_rain.last_season?.percent_of_normal}% {lang==='es'?'de precipitación habitual en la cabecera; no es caudal del río.':'of usual upper-basin precipitation; not river discharge.'}</p>}
  {economicReport&&<div className="b-print-economics"><h3>{lang==='es'?'Cuenta económica basada en los datos del agricultor':'Farmer-input economic estimate'}</h3>
   <p>{lang==='es'?'Estimación por hectárea para un ciclo de 24 meses, no ganancia garantizada.':'Estimate per hectare for a 24-month cycle, not guaranteed profit.'}</p>
   {economicReport.strategies.map(x=><p key={x.strategy_id}><strong>{x.strategy_id==='S0'?t.current:x.strategy_id}:</strong> {x.margin_soles_ha_24months==null?(lang==='es'?'Datos incompletos':'Incomplete inputs'):'S/ '+x.margin_soles_ha_24months.toLocaleString(lang==='es'?'es-PE':'en-US')}</p>)}
  </div>}
  <p>{sampleNote?(lang==='es'?'Terreno mostrado para demostración; los cultivos registrados fueron proporcionados durante esta sesión.':'Field used for demonstration; crop inputs were supplied during this session.'):''}</p></div></div>}
 return <div className="b-app">
  <a className="b-skip" href="#main">Ir al contenido / Skip to content</a>
  <header className="b-header"><div className="b-header-inner"><div className="b-brand"><span className="b-brand-mark"><Icon name="leaf" size={25}/></span><div><b>BIOTEX</b><small>NSPACE BIOTEX</small></div></div>

  <div className="b-language" role="group" aria-label="Idioma / Language"><button type="button" aria-pressed={lang==='es'} className={lang==='es'?'on':''} onClick={()=>setLang('es')}>ES</button><button type="button" aria-pressed={lang==='en'} className={lang==='en'?'on':''} onClick={()=>setLang('en')}>EN</button></div></div></header>
  <div className="b-progress-wrap"><nav className="b-progress" aria-label="Progreso">{t.steps.map((name,i)=><button key={i} type="button" disabled={i>step||i===3&&!result} aria-current={step===i?'step':undefined} className={step===i?'active':i<step?'done':''} onClick={()=>navigate(i as Step)}><span className="b-step-number">{i<step?<Icon name="check" size={17}/>:i+1}</span><span>{name}</span></button>)}</nav></div>
  <main id="main" className="b-main">
   {step===0&&<section className="b-layout">
    <div className="b-intro"><span className="b-eyebrow">{t.region}</span><h1>{t.title}</h1><p>{t.subtitle}</p></div>
    <div className="b-farm-grid">
     <div className="b-card b-search-card"><h2><Icon name="pin"/>{t.search}</h2>
      <form className="b-search" onSubmit={searchPlace}><label htmlFor="b-search" className="sr-only">{t.search}</label>
       <input id="b-search" value={query} onChange={e=>setQuery(e.target.value)} placeholder={t.searchHint} autoComplete="off"/>
       <button type="submit" className="b-btn b-btn-solid" disabled={searching}><Icon name="search" size={19}/>{searching?t.waitSearch:t.find}</button>
      </form>
      {searchError&&<p className="b-error" role="alert">{searchError}</p>}
      {places.length>0&&<div className="b-place-results">{places.map((p,i)=><button key={i} type="button" onClick={()=>pickPlace(p)}><Icon name="pin" size={18}/><span>{p.name}</span></button>)}</div>}
      <p className="b-map-label"><Icon name="pin" size={16}/>{place}</p>
      <p className="b-muted">{t.mapHint}</p>
      <div className="b-map-view" role="group" aria-label={lang==='es'?'Capas de observación':'Observation layers'}>
       {(['photo','vegetation','rain'] as const).map(id=><button key={id} type="button" disabled={saveMobileData&&id!=='photo'} aria-pressed={mapLayer===id} onClick={()=>{setMapLayer(id);setMapLayerFailed(false)}}>{id==='photo'?(lang==='es'?'Foto aérea':'Aerial photo'):id==='vegetation'?(lang==='es'?'Vegetación NASA':'NASA vegetation'):(lang==='es'?'Lluvia NASA':'NASA rain')}</button>)}
      </div>
      <label className="b-low-bandwidth"><input type="checkbox" checked={saveMobileData} onChange={e=>{setSaveMobileData(e.target.checked);if(e.target.checked)setMapLayer('photo')}}/> {lang==='es'?'Ahorrar datos móviles (mapa sencillo)':'Save mobile data (simple map)'}</label>
      {drawing&&<div className="b-map-guide"><strong>{lang==='es'?'Marca tu chacra en 3 pasos':'Mark your field in 3 steps'}</strong><ol><li>{lang==='es'?'Acerca el mapa.':'Zoom in.'}</li><li>{lang==='es'?'Toca cada esquina del terreno.':'Tap each field corner.'}</li><li>{lang==='es'?'Pulsa «Terminar terreno».':'Tap Finish field.'}</li></ol></div>}
      <div className="b-map-frame"><MapContainer className="b-map" center={[centre.lat,centre.lng]} zoom={13} scrollWheelZoom={false}>
       <TileLayer key={saveMobileData?'streets':'satellite'} attribution={saveMobileData?'© OpenStreetMap contributors':'Imagery © Esri, Maxar, Earthstar Geographics | Geocoding © OpenStreetMap contributors'}
        url={saveMobileData?'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png':'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'}/>
       {!saveMobileData&&mapLayer!=='photo'&&<WMSTileLayer key={mapLayer} url="https://gibs.earthdata.nasa.gov/wms/epsg3857/best/wms.cgi"
        layers={mapLayer==='vegetation'?'MODIS_Terra_NDVI_8Day':'IMERG_Precipitation_Rate'}
        styles="" format="image/png" transparent={true} version="1.1.1" opacity={0.72}
        attribution="NASA GIBS / ESDIS" eventHandlers={{tileerror:()=>setMapLayerFailed(true)}}/>}
       <FlyTo point={centre} polygon={mapPolygon}/>
       <DrawLayer enabled={drawing} points={points} onPoint={p=>{setPoints(x=>[...x,p]);setFieldError('')}} onFinish={finish}/>
       {field&&<Polygon positions={(mapPolygon||[]).map(p=>[p.lat,p.lng] as [number,number])} pathOptions={{color:'#F4C252',weight:4,fillColor:'#2EAE84',fillOpacity:0.24}}/>}
      </MapContainer>
      <div className="b-map-actions">{drawing?<><button type="button" onClick={()=>setPoints(v=>v.slice(0,-1))} disabled={!points.length} className="b-btn b-btn-light"><Icon name="undo" size={16}/>{t.undo}</button>
       <button type="button" className="b-btn b-btn-solid" onClick={finish} disabled={points.length<3}>{t.finish}</button>
       <button type="button" className="b-btn b-btn-light" onClick={()=>{setDrawing(false);setPoints([]);setFieldError('')}}>{t.cancel}</button></>:
       <button type="button" className="b-btn b-btn-solid" onClick={()=>{changeArea();setDrawing(true)}}>{field?t.changeField:t.draw}</button>}</div></div>
      {mapLayer!=='photo'&&<div className="b-map-evidence"><span>{mapLayer==='vegetation'?(lang==='es'?'Vegetación regional NASA MODIS · 250 m':'Regional NASA MODIS vegetation · 250 m'):(lang==='es'?'Lluvia regional NASA GPM · aprox. 10 km':'Regional NASA GPM rainfall · approx. 10 km')}. {lang==='es'?'No es una medida exacta de tu chacra.':'Not an exact field measurement.'}</span>
       <a href={'https://worldview.earthdata.nasa.gov/?l='+(mapLayer==='vegetation'?'MODIS_Terra_NDVI_8Day':'IMERG_Precipitation_Rate')} target="_blank" rel="noreferrer">{lang==='es'?'Ver fuente NASA':'NASA source'}</a>
       {mapLayerFailed&&<span role="status">{lang==='es'?'La capa NASA no cargó para esta vista.':'NASA layer unavailable for this view.'}</span>}</div>}
      {fieldError&&<p role="alert" className="b-error">{fieldError}</p>}
      {field&&<div className="b-field-ready" role="status"><Icon name="check"/><div><strong>{t.fieldReady}</strong><span>{t.area}: {area.toLocaleString(lang==='es'?'es-PE':'en-US',{maximumFractionDigits:2})} ha</span></div></div>}
      {!supported&&<p className="b-note"><Icon name="info" size={18}/>{t.unsupported}</p>}
      {savedNotice&&<p className="b-note" role="status">{savedNotice}</p>}
      {savedAvailable&&<div className="b-farm-recovery"><button type="button" onClick={restoreFarm}>{lang==='es'?'Recuperar mi chacra guardada':'Restore saved field'}</button></div>}
     </div>
     <aside className="b-card b-examples"><h2>{t.examples}</h2>
      {DEMOS.map((f,i)=><button key={f.id} type="button" className="b-example-choice" onClick={()=>setExample(f)}><span className="b-example-index">{String(i+1).padStart(2,'0')}</span>
        <span><strong>{lang==='es'?'Explorar parcela de Barranca':'Explore a Barranca field'}</strong><small>{lang==='es'?'Vista desde el satélite':'Satellite view'}</small></span><Icon name="right" size={19}/></button>)}
      <p className="b-muted">{lang==='es'?'También puedes buscar tu propio distrito y marcar tu terreno.':'You can also search your district and mark your own field.'}</p>
     </aside>
    </div>
    <div className="b-next"><button type="button" className="b-btn b-btn-light" disabled={!field} onClick={saveFarm}>{lang==='es'?'Guardar mi chacra':'Save my field'}</button><button type="button" className="b-btn b-btn-primary" disabled={!field} onClick={()=>navigate(1)}>{t.next}<Icon name="right"/></button></div>
   </section>}
   {step===1&&<section className="b-form-page"><div className="b-intro"><span className="b-eyebrow">02 / 04</span><h1>{t.historyTitle}</h1><p>{t.historyLead}</p></div>
    <div className="b-entry-grid"><section className="b-card"><h2>{t.add}</h2>
     <div className="b-input-row"><label>{t.crop}<select value={crop} onChange={e=>setCrop(e.target.value)}>{CROPS.map(id=><option key={id} value={id}>{labelCrop(id,lang)}</option>)}</select></label>
     <label>{t.month}<select value={cropMonth} onChange={e=>setCropMonth(Number(e.target.value))}>{Array.from({length:24},(_,i)=><option key={i} value={i}>{monthYear(i,baseYear,lang)}</option>)}</select></label></div>
     <button type="button" className="b-btn b-btn-solid b-add" onClick={addCrop}>{t.add}</button>
     {entryError&&<p className="b-error" role="alert">{entryError}</p>}
    </section><section className="b-card"><h2>{t.saved} <span className="b-count">{plantings.length}</span></h2>
      {plantings.length===0?<p className="b-empty">{t.nothing}</p>:<ul className="b-planting-list">{current.map((p,i)=><li key={p.start_index}><span><strong>{labelCrop(p.crop_id,lang)}</strong><small>{monthYear(p.start_index,baseYear,lang)}</small></span><button type="button" aria-label={t.remove+' '+labelCrop(p.crop_id,lang)} onClick={()=>{setPlantings(removePlantingFromRotation(current,i));setResult(null)}}>{t.remove}</button></li>)}</ul>}
    </section></div>
    <details className="b-satellite"><summary><Icon name="info" size={20}/><span>{t.helpMe}</span><strong>{t.satellite}</strong></summary>
      <div className="b-satellite-content"><p>{t.loadingHelp}</p>
       {!history&&!historyBusy&&<button type="button" className="b-btn b-btn-light" onClick={loadImages}>{t.satellite}</button>}
       {historyBusy&&<p className="b-loading" role="status"><span className="b-spinner"/>{t.loading}</p>}
       {historyError&&<p className="b-error" role="alert">{t.satFail} <button type="button" onClick={loadImages}>{lang==='es'?'Reintentar':'Retry'}</button></p>}
       {history&&<><SatelliteEvidence months={history.months} polygon={field!} lang={lang} sensor={history.sensor} monthsWithData={history.months_with_data} monthsTotal={history.months_total}/>
       <p>{t.historyFound}</p>
       {seasons.length===0&&<p className="b-note">{t.noSeasons}</p>}
       <div className="b-season-grid">{seasons.map(c=><div className="b-season" key={c.start}>
        <label>{t.possible} {monthYear(Math.max(0,ymNumber(c.start)-1-firstAugust),baseYear,lang)}?</label>
        <div className="b-season-row"><select value={hintChoices[c.start]||''} onChange={e=>setHintChoices(v=>({...v,[c.start]:e.target.value}))}>
         <option value="">{t.choose}</option>{CROPS.map(id=><option key={id} value={id}>{labelCrop(id,lang)}</option>)}</select>
        <button type="button" className="b-btn b-btn-light" disabled={!hintChoices[c.start]} onClick={()=>recordSeason(c)}>{t.record}</button></div>
        {c.candidates[0]&&<small>{lang==='es'?'Una posibilidad según la imagen: ':'Possible crop from the image: '}{labelCrop(c.candidates[0].crop_id,lang)}. {lang==='es'?'Confirma tú.':'You decide.'}</small>}
       </div>)}</div>
       <details className="b-technical"><summary>{t.satMore}</summary><p>{history.sensor}. {t.satMonth}: {history.months_with_data}/{history.months_total}.</p></details>
       </>}</div>
    </details>
    <div className="b-next between"><button type="button" className="b-btn b-btn-light" onClick={()=>navigate(0)}><Icon name="left"/>{t.back}</button>
     <button type="button" className="b-btn b-btn-primary" disabled={!current.length} onClick={()=>navigate(2)}>{t.next}<Icon name="right"/></button></div>
   </section>}
   {step===2&&<section className="b-form-page b-goal-page"><div className="b-intro"><span className="b-eyebrow">03 / 04</span><h1>{t.priorityTitle}</h1><p>{t.priorityLead}</p></div>
    <section className="b-card"><div className="b-goal-options" role="group" aria-label={t.priorityTitle}>{(['water','soil','both'] as const).map(id=><button type="button" key={id} aria-pressed={goal===id} className={'b-goal '+(goal===id?'chosen':'')} onClick={()=>{setGoal(id);setResult(null)}}>
     <span className="b-goal-icon"><Icon name={id==='soil'?'leaf':id==='water'?'water':'check'} size={28}/></span>
     <strong>{id==='water'?t.priorityWater:id==='soil'?t.prioritySoil:t.priorityBoth}</strong>
     <span className="b-radio" aria-hidden="true"/></button>)}</div>
     <div className="b-input-row b-input-soft"><label>{t.income}<select value={confirmedOptions.includes(incomeCrop)?incomeCrop:''} onChange={e=>{setIncomeCrop(e.target.value);setResult(null)}}><option value="">{t.incomeAuto}</option>{confirmedOptions.map(id=><option key={id} value={id}>{labelCrop(id,lang)}</option>)}</select></label>
      <fieldset><legend>{t.scarcity}</legend><div className="b-choice-row">{(['escaso','normal','no_se'] as const).map(id=><button key={id} type="button" aria-pressed={scarcity===id} className={scarcity===id?'chosen':''} onClick={()=>{setScarcity(id);setResult(null)}}>{id==='escaso'?t.yes:id==='normal'?t.no:t.unknown}</button>)}</div></fieldset></div>
     <div className="b-year-control"><label>{lang==='es'?'¿En qué año empezarías el plan?':'Which year would you begin?'}
      <select value={planStartYear} onChange={e=>setPlanStartYear(Number(e.target.value))}>{[0,1,2].map(offset=><option key={offset} value={new Date().getUTCFullYear()+(new Date().getUTCMonth()>=7?1:0)+offset}>{lang==='es'?'Agosto':'August'} {new Date().getUTCFullYear()+(new Date().getUTCMonth()>=7?1:0)+offset}</option>)}</select>
      </label><small>{lang==='es'?'El modelo empieza su ciclo en agosto; las fechas son aproximadas.':'The model cycle starts in August; dates are approximate.'}</small></div>
     <details className="b-farm-evidence"><summary>{lang==='es'?'¿Tienes datos de tu suelo o del agua de riego? (opcional)':'Do you have soil or irrigation records? (optional)'}</summary>
      <p>{lang==='es'?'Anota aquí solo los datos que conoces. Aparecerán en tu informe.':'Enter only values you know. They will appear in your report.'}</p>
      <div className="b-farm-fields">
       <label>{lang==='es'?'Tipo de suelo':'Soil texture'}
        <select value={soil.texture||''} onChange={e=>setSoil(x=>({...x,texture:(e.target.value||undefined) as FieldSoil['texture']}))}>
         <option value="">{lang==='es'?'No tengo el dato':'Unknown'}</option><option value="arenosa">{lang==='es'?'Arenoso':'Sandy'}</option><option value="franca">{lang==='es'?'Franco':'Loam'}</option><option value="arcillosa">{lang==='es'?'Arcilloso':'Clay'}</option>
        </select>
       </label>
       <label>{lang==='es'?'Acidez del suelo (pH, si tienes análisis)':'Soil pH (if tested)'}
        <input type="number" inputMode="decimal" min="0" max="14" step="0.1" value={soil.ph??''} onChange={e=>setSoil(x=>({...x,ph:e.target.value===''?undefined:Number(e.target.value)}))}/>
       </label>
       <label>{lang==='es'?'Salinidad (dS/m, si tienes análisis)':'Salinity (dS/m, if tested)'}
        <input type="number" inputMode="decimal" min="0" max="100" step="0.1" value={soil.salinity_ds_m??''} onChange={e=>setSoil(x=>({...x,salinity_ds_m:e.target.value===''?undefined:Number(e.target.value)}))}/>
       </label>
       <label>{lang==='es'?'Materia orgánica (%)':'Organic matter (%)'}
        <input type="number" inputMode="decimal" min="0" max="100" step="0.1" value={soil.organic_matter_percent??''} onChange={e=>setSoil(x=>({...x,organic_matter_percent:e.target.value===''?undefined:Number(e.target.value)}))}/>
       </label>
       <label>{lang==='es'?'¿Cómo drena el agua?':'How well does water drain?'}
        <select value={soil.drainage||''} onChange={e=>setSoil(x=>({...x,drainage:(e.target.value||undefined) as FieldSoil['drainage']}))}>
         <option value="">{lang==='es'?'No sé':'Unknown'}</option><option value="bueno">{lang==='es'?'Bien':'Well'}</option><option value="regular">{lang==='es'?'Regular':'Moderately'}</option><option value="malo">{lang==='es'?'Se empoza':'Poorly'}</option>
        </select>
       </label>
       <label>{lang==='es'?'Agua asignada en m³/ha por campaña (si tienes el dato)':'Allocated water m³/ha per season (if known)'}
        <input type="number" inputMode="numeric" min="0" max="1000000" step="1" value={waterAllowance} onChange={e=>setWaterAllowance(e.target.value)}/>
       </label>
      </div>
     </details>
    </section>
    {planError&&<p className="b-error" role="alert">{planError}</p>}
    {!supported&&<p className="b-note"><Icon name="info" size={18}/>{t.unsupported}</p>}
    <div className="b-next between"><button type="button" className="b-btn b-btn-light" onClick={()=>navigate(1)}><Icon name="left"/>{t.back}</button>
     <button type="button" className="b-btn b-btn-primary" disabled={!current.length||!supported||planBusy} onClick={showPlan}>{planBusy?<><span className="b-spinner"/>{t.working}</>:<>{t.action}<Icon name="right"/></>}</button></div>
   </section>}
   {step===3&&result&&<section className="b-result-page"><div className="b-intro"><span className="b-eyebrow">04 / 04</span><h1>{t.planTitle}</h1><p>{t.planLead}</p></div>
    <div className="b-location-summary"><Icon name="pin"/><strong>{place}</strong><span>{t.area}: {area.toFixed(2)} ha</span></div>
    {sampleNote&&<p className="b-demo-status">{lang==='es'?'Vista de demostración · Barranca':'Demonstration view · Barranca'}</p>}
    {result.status==='partial'&&<p className="b-note"><Icon name="info" size={18}/>{t.partial}</p>}
    {preferred?mainCard(preferred):<div className="b-card b-no-recommend"><Icon name="info"/><h2>{t.noRecommend}</h2><p>{t.unavailable}</p></div>}
    <FarmDecisionEvidence lang={lang} strategies={result.strategies} names={NAMES}
      context={result.official_evidence} soil={result.soil_assessment}
      irrigationKnown={waterAllowance.trim().length>0}
      report={economicReport} onBudget={setEconomicReport}/>
    <div className="b-caution"><Icon name="alert" size={21}/><p>{t.warning}</p></div>
    {other.some(x=>(x.relative_to_current?.water_low_river_change_percent??0)>25)&&<p className="b-water-caution">{lang==='es'?'Hay otra opción que necesita bastante más agua en meses secos. Revisa esta diferencia antes de considerarla.':'Another option needs considerably more crop water in dry months. Review this difference before considering it.'}</p>}
    {other.length>0||original?<section className="b-compare-wrap"><button type="button" className="b-compare-trigger" aria-expanded={otherOpen} onClick={()=>setOtherOpen(v=>!v)}><span>{t.other}</span><span>{otherOpen?'−':'+'}</span></button>
      {otherOpen&&<div className="b-other-cards">{[...other,...(original?[original]:[])].map(s=><article className="b-card b-other" key={s.id}>
       <h3>{strategyName(s)}</h3><p>{cropsLine(s)}</p><div className="b-mini-kpis"><span className={(s.relative_to_current?.water_low_river_change_percent??0)>25?'b-water-high':''}>{t.keyWater}: {s.relative_to_current?showPct(s.relative_to_current.water_low_river_change_percent):(lang==='es'?'Actual':'Current')}</span><span>{t.keySoil}: {s.indicators.bare_months}/24</span></div>
       {s.plantings.length>0&&<details><summary>{t.planSchedule}</summary>{strip(s)}</details>}{technical(s)}
      </article>)}</div>}</section>:null}
    <div className="b-save-actions"><button type="button" className="b-btn b-btn-light" onClick={saveFarm}>{lang==='es'?'Guardar datos en mi celular':'Save on this device'}</button>
     <a className="b-btn b-btn-light" href={'https://wa.me/?text='+encodeURIComponent((lang==='es'?'Mi propuesta BIOTEX para ':'My BIOTEX plan for ')+place+': '+(preferred?cropsLine(preferred):'')+' · '+(result[lang==='es'?'recommendation_reason_es':'recommendation_reason_en']||'')+' · '+window.location.origin)} target="_blank" rel="noreferrer">{lang==='es'?'Compartir por WhatsApp':'Share on WhatsApp'}</a>
     {savedNotice&&<p role="status">{savedNotice}</p>}</div>
    <div className="b-report-actions"><button type="button" onClick={goPrint} className="b-btn b-btn-primary"><Icon name="print"/>{t.report}</button>
     <button type="button" onClick={()=>navigate(2)} className="b-btn b-btn-light"><Icon name="left"/>{t.startOver}</button></div>
   </section>}
  </main>
  <footer className="b-footer"><span>BIOTEX · NSPACE BIOTEX</span><span>NASA Space Apps Challenge 2026 · Field Shift</span></footer>
  {printable()}
 </div>
}
