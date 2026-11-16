// AI-assisted: farmer-first CHAKRA interface. Scientific calculations remain on the server.
import {lazy,Suspense,useEffect,useMemo,useRef,useState,type FormEvent} from 'react'
import {CircleMarker,MapContainer,Polygon,Polyline,Rectangle,TileLayer,Tooltip,WMSTileLayer,useMap,useMapEvents} from 'react-leaflet'
import {API,httpErrorMessage,readableApiError} from './network'
import {approximatePolygonHectares,validatePolygon,validateSubplotLayout} from './geometry'
import {TEAM_FIELDS,type GeoPolygon} from './rotationZones'
import {addPlantingToRotation,removePlantingFromRotation} from './manualRotation'
import {relativeMonthIndex,migrateSavedPlantings} from './rotationCalendar'
import SatelliteEvidence from './SatelliteEvidence'
import FarmDecisionEvidence,{type EconomicReport} from './FarmDecisionEvidence'
import FarmerAIEvidence,{type AIEvidence} from './FarmerAIEvidence'
import './biotex-farmer.css'
import BioTour from './BioTour'
import CropGlyph,{ZoneMapLabel} from './CropGlyph'
import {useFieldFrame} from './useFieldFrame'
import ChakraInfoPage from './ChakraInfoPage'
import {CropPhotoGuide} from './CropPhotoGuide'
import {parseGeoJSONPolygon} from './geometry'
import {imergApproxCell} from './imerg-grid'
import {GIBS_LAYERS,GIBS_WMS,gibsLegendUrl,isScienceLayer,type BaseOrScienceLayer} from './scientificLayers'
import {BARRANCA_FIELD,BARRANCA_HISTORY,isStudyParcel,vegetationBand} from './barrancaObservation'
import BarrancaLegend from './BarrancaLegend'
import './agricultural-dark.css'
import './chakra.css'
import './chakra-light.css'
import './chakra-ppt-flow.css'
import './chakra-farmer-v3.css'
import './chakra-responsive-audit.css'
import './onboarding-fixes.css'
import './zone-presentation.css'
import './report-layout.css'
import {cropVisual} from './chakraCropVisuals'
import {ChakraZoneHandles,suggestedZones} from './ChakraRectZones'
import ChakraIcon,{ChakraMark} from './ChakraIcon'
import ChakraLanding from './ChakraLanding'
import ChakraZonePlan,{ChakraZonePrint,type ChakraSpatialPlan} from './ChakraZonePlan'
import StrategyCompare,{type CompareStrategy,type MaizeShare} from './StrategyCompare'
import BARRANCA_EXAMPLE from './barrancaExampleResult.json'
const FieldEvidence=lazy(()=>import('./FieldEvidence'))
const CropReference=lazy(()=>import('./CropReference'))

type Lang='es'|'en'
type Step=0|1|2|3
type Point={lat:number;lng:number}
type Planting={crop_id:string;start_index:number}
type Subplot={id:string;polygon:GeoPolygon}
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
type Result={status:string;strategies:Strategy[];ai_analysis?:AIEvidence;ai_weighted?:boolean;official_evidence?:OfficialContext;soil_assessment?:SoilResult;recommended_strategy_id?:string|null;recommendation_confidence?:'limited'|'relative_evidence'|'insufficient';farm_inputs?:{soil?:FieldSoil;irrigation_allowance_m3_ha_season?:number;status:string};upper_basin_rain?:{status:string;last_season?:{season:string;percent_of_normal:number};note_es?:string;note_en?:string};
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
const CROPS=['maiz_amarillo_duro','camote','papa','frijol_grano_seco','frijol_castilla','vainita','pallar','cebolla','zanahoria']
const MONTHS_ES=['enero','febrero','marzo','abril','mayo','junio','julio','agosto','setiembre','octubre','noviembre','diciembre']
const MONTHS_EN=['January','February','March','April','May','June','July','August','September','October','November','December']
const LABELS={
 es:{
 steps:['Delimitar','Cultivos y zonas','Mi plan'],
 title:'Delimita tu terreno',
 subtitle:'Selecciona la tierra que trabajas y prepara tus próximas siembras.',
 pilot:'',region:'Barranca · Pativilca y Supe',
 search:'¿Dónde está tu chacra?',searchHint:'Escribe el nombre de tu localidad o distrito',find:'Buscar lugar',
 waitSearch:'Buscando lugares…',notFound:'No encontramos ese lugar. Prueba con el distrito o provincia.',
 mapHint:'Acerca el mapa y marca las esquinas de tu chacra.',draw:'Marcar mi chacra',finish:'Terminar terreno',
 undo:'Deshacer esquina',cancel:'Cancelar',area:'Área aproximada',changeField:'Cambiar terreno',
 examples:'Conoce CHAKRA en Barranca',exampleNote:'Parcela seleccionada para mostrar cómo se analizan imágenes de satélite.',
 pick:'Usar este ejemplo',fieldReady:'Tu terreno está marcado',fieldMissing:'Primero marca un terreno en el mapa.',
 locationUnavailable:'No pudimos buscar lugares. Intenta de nuevo.',invalidArea:'Marca un terreno de entre 0,1 y 10 000 hectáreas.',
 invalidShape:'Revisa las esquinas: el terreno no debe cruzarse ni repetirse.',
 next:'Continuar',back:'Volver',
 historyTitle:'¿Qué cultivos sembraste?',historyLead:'Elige un cultivo y el mes en que lo sembraste. Si no recuerdas todo, empieza con uno.',
 crop:'Cultivo',month:'¿Cuándo lo sembraste por última vez?',add:'Agregar cultivo',saved:'Cultivos registrados',
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
 evidence:'Datos usados',reportTech:'Datos técnicos y cálculos',printFooter:'CHAKRA · NASA Space Apps 2026',
 unsupported:'Esta versión trabaja solo con Barranca. Puedes explorar el mapa; selecciona una parcela de Barranca para comparar cultivos.',
 missingPlan:'Necesitamos al menos un cultivo registrado para preparar tu plan.',
 partial:'Con los datos actuales no fue posible encontrar todas las opciones. Solo mostramos las calculadas.',
 unavailable:'No se encontraron alternativas suficientemente claras. Revisa tus siembras o consulta con un técnico.'
 },
 en:{
 steps:['Outline','Crops and zones','My plan'],
 title:'Outline your field',subtitle:'Barranca is the example. You can outline a field anywhere on the map.',
 pilot:'',region:'Barranca · Pativilca and Supe',
 search:'Where is your field?',searchHint:'Enter your town or district',find:'Find a place',
 waitSearch:'Searching for places…',notFound:'No places found. Try a district or province.',
 mapHint:'Zoom in and mark the corners of your field.',draw:'Mark my field',finish:'Finish field',
 undo:'Undo corner',cancel:'Cancel',area:'Approximate area',changeField:'Change field',
 examples:'Explore CHAKRA in Barranca',exampleNote:'Selected field showing how satellite imagery is analysed.',
 pick:'Use this example',fieldReady:'Your field is marked',fieldMissing:'First mark a field on the map.',
 locationUnavailable:'We could not search places. Please try again.',invalidArea:'Mark a field between 0.1 and 10,000 hectares.',
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
 evidence:'Data used',reportTech:'Technical calculations',printFooter:'CHAKRA · NASA Space Apps 2026',
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
function recentAugust(){const now=new Date();const year=now.getUTCFullYear(),m=now.getUTCMonth()+1;return (m>=8?year:year-1)-2}
function simpleDate(lang:Lang){return new Date().toLocaleDateString(lang==='es'?'es-PE':'en-US',{year:'numeric',month:'long',day:'numeric'})}
function fromGeo(p:GeoPolygon):Point[]{return p.coordinates[0].slice(0,-1).map(([lng,lat])=>({lat,lng}))}
function toGeo(p:Point[]):GeoPolygon{return{type:'Polygon',coordinates:[[...p.map(a=>[a.lng,a.lat]),[p[0].lng,p[0].lat]]]}}
function centroid(p:GeoPolygon):Point{const a=fromGeo(p);return{lat:a.reduce((x,v)=>x+v.lat,0)/a.length,lng:a.reduce((x,v)=>x+v.lng,0)/a.length}}
function isBarranca(p:Point){return p.lat>=-10.95&&p.lat<=-10.40&&p.lng>=-78.07&&p.lng<=-77.35}

function Icon({name,size=20}:{name:'search'|'pin'|'check'|'left'|'right'|'undo'|'leaf'|'water'|'print'|'alert'|'info',size?:number}){
 const names={search:'search',pin:'map-pin',check:'check',left:'chevron-left',right:'arrow-right',undo:'undo-2',leaf:'sprout',water:'droplets',print:'printer',alert:'info',info:'info'} as const
 return <ChakraIcon name={names[name]} size={size}/>
}
function FlyTo({point,polygon}:{point:Point;polygon:Point[]|null}){
 useFieldFrame(polygon?.map(p=>[p.lat,p.lng] as [number,number])||null,point.lat,point.lng)
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
function EditableCorners({points,selected,onPick,onMove}:{points:Point[]|null;selected:number;onPick:(index:number)=>void;onMove:(point:Point)=>void}){
 useMapEvents({click(e){if(points)onMove({lat:e.latlng.lat,lng:e.latlng.lng})}})
 if(!points)return null
 return <>{points.length>=3&&<Polygon positions={points.map(v=>[v.lat,v.lng] as [number,number])} pathOptions={{color:'#F59E0B',weight:3,dashArray:'8 5',fillColor:'#4CD964',fillOpacity:.12}}/>}
  {points.map((v,i)=><CircleMarker key={i} center={[v.lat,v.lng]} radius={selected===i?10:7} pathOptions={{color:'#0B0E0C',weight:2,fillColor:selected===i?'#F59E0B':'#4CD964',fillOpacity:1}} eventHandlers={{click:(event:{originalEvent:MouseEvent})=>{event.originalEvent.stopPropagation();onPick(i)}}}/>)}
 </>
}
function insideCropArea(lng:number,lat:number,poly:GeoPolygon):boolean{
 const points=poly.coordinates[0]
 let inside=false
 for(let i=0,j=points.length-1;i<points.length;j=i++){
  const a=points[i],b=points[j]
  if(((a[1]>lat)!==(b[1]>lat))&&(lng<(b[0]-a[0])*(lat-a[1])/(b[1]-a[1])+a[0]))inside=!inside
 }
 return inside
}
function ZoneDropBridge({field,subplots,onAssign}:{field:GeoPolygon;subplots:Subplot[];onAssign:(zoneId:string,cropId:string)=>void}){
 const map=useMap()
 useEffect(()=>{
  const element=map.getContainer()
  const over=(event:DragEvent)=>{if(event.dataTransfer?.types.includes('application/x-chakra-crop'))event.preventDefault()}
  const drop=(event:DragEvent)=>{
   const id=event.dataTransfer?.getData('application/x-chakra-crop')
   if(!id||!CROPS.includes(id))return
   event.preventDefault()
   const box=element.getBoundingClientRect()
   const point=map.containerPointToLatLng([event.clientX-box.left,event.clientY-box.top])
   if(!insideCropArea(point.lng,point.lat,field))return
   const zone=subplots.slice().reverse().find(z=>insideCropArea(point.lng,point.lat,z.polygon))
   if(!zone&&subplots.length)return // Only explicitly drawn cultivation polygons are assignable.
   onAssign(zone?.id||'rest',id)
  }
  element.addEventListener('dragover',over)
  element.addEventListener('drop',drop)
  return()=>{element.removeEventListener('dragover',over);element.removeEventListener('drop',drop)}
 },[map,field,subplots,onAssign])
 return null
}
const DEMOS=TEAM_FIELDS.filter(f=>f.zone==='barranca').slice(0,1)
const SAVED_FARM_KEY='biotex-farm-v1'
export default function BiotexFarmerApp(){
 const [lang,setLang]=useState<Lang>(()=>new URLSearchParams(window.location.search).get('lang')==='en'?'en':'es')
 const t=LABELS[lang]
 const [step,setStep]=useState<Step>(0)
 const [landing,setLanding]=useState(true)
 const [infoPage,setInfoPage]=useState<'how'|'sources'|null>(()=>{
  const p=window.location.pathname;return p==='/como-funciona'?'how':p==='/fuentes'?'sources':null
 })
 useEffect(()=>{
  const onPop=()=>{const p=window.location.pathname;setInfoPage(p==='/como-funciona'?'how':p==='/fuentes'?'sources':null)}
  window.addEventListener('popstate',onPop);return()=>window.removeEventListener('popstate',onPop)
 },[])
 function showPage(page:'how'|'sources'|null){
  const path=page==='how'?'/como-funciona':page==='sources'?'/fuentes':'/'
  if(window.location.pathname!==path)window.history.pushState({},'',path+window.location.search)
  setInfoPage(page);window.scrollTo({top:0,behavior:'auto'})
 }
 const [place,setPlace]=useState('')
 const [centre,setCentre]=useState<Point>(centroid(BARRANCA_FIELD.polygon))
 const [query,setQuery]=useState('')
 const [coordinateLat,setCoordinateLat]=useState('')
 const [coordinateLng,setCoordinateLng]=useState('')
 const [places,setPlaces]=useState<{name:string;lat:number;lng:number}[]>([])
 const [searching,setSearching]=useState(false)
 const [searchError,setSearchError]=useState('')
 const [field,setField]=useState<GeoPolygon|null>(null)
 const [fieldLabel,setFieldLabel]=useState('')
 const [isDemoField,setIsDemoField]=useState(false)
 const [drawing,setDrawing]=useState(false)
 const [drawingSubplot,setDrawingSubplot]=useState(false)
 const [subplots,setSubplots]=useState<Subplot[]>([])
 const [zoneCrops,setZoneCrops]=useState<Record<string,{crop_id:string;planted_month:string}>>({})
 const [pendingCrop,setPendingCrop]=useState<string|null>(null)
 const [planningMonths,setPlanningMonths]=useState(12)
 const [activeZone,setActiveZone]=useState('rest')
 const [spatialPlan,setSpatialPlan]=useState<ChakraSpatialPlan|null>(null)
 const [spatialBusy,setSpatialBusy]=useState(false)
 const [spatialError,setSpatialError]=useState('')
 const [editVertices,setEditVertices]=useState<Point[]|null>(null)
 const [selectedCorner,setSelectedCorner]=useState(0)
 const [cornerLat,setCornerLat]=useState('')
 const [cornerLng,setCornerLng]=useState('')
 const [points,setPoints]=useState<Point[]>([])
 const [fieldError,setFieldError]=useState('')
 const [plantings,setPlantings]=useState<Planting[]>([])
 const [crop,setCrop]=useState('maiz_amarillo_duro')
 const [cropMonth,setCropMonth]=useState(()=>{const d=new Date();return Math.max(0,Math.min(35,(d.getUTCFullYear()-recentAugust())*12+d.getUTCMonth()-7))})
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
 const [mapLayer,setMapLayer]=useState<BaseOrScienceLayer>(()=>new URLSearchParams(window.location.search).get('research')==='1'?'hls':'photo')
 const [mapDate,setMapDate]=useState(()=>new Date(Date.now()-7*86400000).toISOString().slice(0,10))
 const [mapOpacity,setMapOpacity]=useState(.72)
 const [mapLayerFailed,setMapLayerFailed]=useState(false)
 const [saveMobileData,setSaveMobileData]=useState(false)
 const [planStartYear,setPlanStartYear]=useState(()=>{const d=new Date();return d.getUTCFullYear()+(d.getUTCMonth()>=7?1:0)})
 const [savedAvailable,setSavedAvailable]=useState(()=>{try{return Boolean(localStorage.getItem(SAVED_FARM_KEY))}catch{return false}})
 const [savedNotice,setSavedNotice]=useState('')
 const [geoInput,setGeoInput]=useState('')
 const request=useRef(0)
 const baseYear=recentAugust()
 const point=field?centroid(field):centre
 const area=field?approximatePolygonHectares(fromGeo(field)):0
 const subArea=subplots.reduce((total,z)=>total+approximatePolygonHectares(fromGeo(z.polygon)),0)
 const remArea=Math.max(0,area-subArea)
 const availableZones=subplots.length?subplots.map(z=>({id:z.id,polygon:z.polygon as GeoPolygon|null,ha:approximatePolygonHectares(fromGeo(z.polygon))})):[...(remArea>=.005?[{id:'rest',polygon:null as GeoPolygon|null,ha:remArea}]:[])]
 const selectedZone=availableZones.some(z=>z.id===activeZone)?activeZone:(availableZones[0]?.id||'rest')
 const assignedCount=availableZones.filter(z=>Boolean(zoneCrops[z.id])).length
 const monthChoices=Array.from({length:36},(_,i)=>i).filter(i=>new Date(Date.UTC(recentAugust(),7+i,1)).getTime()<=Date.now())
  const confirmedOptions=[...new Set(plantings.map(p=>p.crop_id))]
 const supported=isBarranca(point)
 const studyParcel=isStudyParcel(field)
 const [hlsMonth,setHlsMonth]=useState(()=>[...BARRANCA_HISTORY.months].reverse().find(m=>m.ndvi!==null)!.month)
 const hlsValue=BARRANCA_HISTORY.months.find(m=>m.month===hlsMonth)?.ndvi??null
 useEffect(()=>{if(mapLayer==='hls'&&!studyParcel)setMapLayer('photo')},[studyParcel,mapLayer])
 const province=isBarranca(point)
 const sampleNote=isDemoField
 const source=history&&satelliteAccepted&&!manualEntered?'satellite_confirmed':'farmer_declared'
 const current=useMemo(()=>plantings.slice().sort((a,b)=>a.start_index-b.start_index),[plantings])
 const mapPolygon=useMemo(()=>field?fromGeo(field):null,[field])

 useEffect(()=>{document.documentElement.lang=lang},[lang])
 // Light theme for projectors: ?theme=light|dark wins, else the saved choice, else dark (default).
 const [theme,setTheme]=useState<'dark'|'light'>(()=>{
  const q=new URLSearchParams(window.location.search).get('theme')
  if(q==='light'||q==='dark')return q
  try{const v=localStorage.getItem('chakra-theme');if(v==='light'||v==='dark')return v}catch{/* storage unavailable */}
  return 'dark'
 })
 useEffect(()=>{document.documentElement.dataset.theme=theme;try{localStorage.setItem('chakra-theme',theme)}catch{/* storage unavailable */}},[theme])
 // Cold start: wake the Render API as soon as the app opens (free tier sleeps).
 useEffect(()=>{fetch(API+'/api/health').catch(()=>{})},[])
 const [slowServer,setSlowServer]=useState(false)
 const [precomputedAt,setPrecomputedAt]=useState('')
 /** Exact Barranca example input that has a precomputed result (scripts/precompute_barranca_example.py). */
 function isPrecomputedExample(){
  const demo=BARRANCA_EXAMPLE.input.zones[0]
  return studyParcel&&!subplots.length&&zoneCrops.rest?.crop_id===demo.crop_id&&zoneCrops.rest?.planted_month===demo.planted_month
 }
 function navigate(s:Step){
  if(s===1&&field&&subplots.length===0&&Object.keys(zoneCrops).length===0){
   const initial=suggestedZones(field,[],3)
   if(initial.length){setSubplots(initial);setActiveZone(initial[0].id)}
  }
  setStep(s);window.scrollTo({top:0,behavior:'smooth'})
 }
 function zoneTitle(id:string){
  if(id==='rest')return subplots.length?(lang==='es'?'Zona A · parte restante':'Area A · remaining land'):(lang==='es'?'Zona A · todo el terreno':'Area A · whole field')
  const index=subplots.findIndex(z=>z.id===id)
  return (lang==='es'?'Zona ':'Area ')+String.fromCharCode(65+Math.min(25,Math.max(0,index)))
 }
 function updateZonePolygon(id:string,polygon:GeoPolygon){
  if(!field)return
  const updated=subplots.map(zone=>zone.id===id?{...zone,polygon}:zone)
  const check=validateSubplotLayout(fromGeo(field),updated.map(z=>({id:z.id,points:fromGeo(z.polygon)})))
  if(!check.valid){setFieldError(lang==='es'?'Mueve los vértices del polígono dentro del terreno, sin cruzar otras zonas.':'Move or resize the rectangle inside the field, without overlapping areas.');return}
  setSubplots(updated);setFieldError('');setSpatialError('');setSpatialPlan(null)
 }
 function addEditableZone(){
  if(!field||subplots.length>=20)return
  const next=suggestedZones(field,subplots,1)
  if(!next.length){setFieldError(lang==='es'?'No hay espacio para otro polígono. Ajusta los que ya tienes.':'No space for a new rectangle. Adjust existing areas.');return}
  setSubplots(current=>[...current,...next]);setActiveZone(next[0].id);setPendingCrop(null);setFieldError('');setSpatialPlan(null)
 }
 function saveFarm(){
  if(!field)return
  try{
   localStorage.setItem(SAVED_FARM_KEY,JSON.stringify({version:1,field,place,fieldLabel,isDemoField,
    plantings,baseYear,goal,incomeCrop,scarcity,soil,waterAllowance,planStartYear,planningMonths,subplots,zoneCrops}))
   setSavedAvailable(true);setSavedNotice(lang==='es'?'Tus datos se guardaron en este dispositivo.':'Your details are saved on this device.')
  }catch{setSavedNotice(lang==='es'?'El navegador no permitió guardar los datos.':'Your browser could not save these details.')}
 }
 function restoreFarm(){setLanding(false);
  try{
   const data=JSON.parse(localStorage.getItem(SAVED_FARM_KEY)||'null')
   if(!data||data.version!==1||!data.field||!Array.isArray(data.plantings))throw new Error('bad saved farm')
   // A saved polygon can be restored anywhere; the trained NASA model still remains geographically scoped.
   const vertices=fromGeo(data.field)
   if(!validatePolygon(vertices).valid||approximatePolygonHectares(vertices)<0.1||approximatePolygonHectares(vertices)>10000)throw new Error('bad polygon')
   const safe=migrateSavedPlantings(((data.plantings||[]) as Planting[]).filter(v=>CROPS.includes(v.crop_id)),Number.isInteger(data.baseYear)?data.baseYear:null,baseYear).slice(0,10)
   const restoredRaw:Array<Subplot>=Array.isArray(data.subplots)?data.subplots:[]
   const seenZones=new Set<string>()
   const restoredSubplots:Array<Subplot>=restoredRaw.filter(z=>{
    if(!z||typeof z.id!=='string'||seenZones.has(z.id))return false
    seenZones.add(z.id);return true
   })
   if(restoredSubplots.length){
    const outcome=validateSubplotLayout(vertices,restoredSubplots.map((v:Subplot)=>({id:v.id,points:fromGeo(v.polygon)})))
    if(!outcome.valid)throw new Error('invalid saved subplots')
   }
   resetAfterField();setSubplots(restoredSubplots);setEditVertices(null);setDrawingSubplot(false)
   setField(data.field);setCentre(centroid(data.field));setFieldLabel(String(data.fieldLabel||''));setPlace(String(data.place||'Barranca · terreno guardado'))
   setIsDemoField(Boolean(data.isDemoField));setPlantings(safe)
   const zoneEntries=Object.entries(data.zoneCrops||{}).filter(([key,value])=>(key==='rest'||restoredSubplots.some(z=>z.id===key))&&value&&typeof value==='object'&&CROPS.includes((value as {crop_id:string}).crop_id)&&/^\d{4}-(0[1-9]|1[0-2])$/.test((value as {planted_month:string}).planted_month))
   setZoneCrops(zoneEntries.length?Object.fromEntries(zoneEntries) as Record<string,{crop_id:string;planted_month:string}>:safe.length?{rest:{crop_id:safe[0].crop_id,planted_month:new Date(Date.UTC(baseYear,7+safe[0].start_index,1)).toISOString().slice(0,7)}}:{})
   setSpatialPlan(null);setActiveZone('rest')
   if(['water','soil','both'].includes(data.goal))setGoal(data.goal)
   setIncomeCrop(String(data.incomeCrop||''));setScarcity(['escaso','normal','no_se'].includes(data.scarcity)?data.scarcity:'no_se')
   setSoil(data.soil&&typeof data.soil==='object'?data.soil:{})
   setWaterAllowance(String(data.waterAllowance||''))
   if(Number.isInteger(data.planStartYear))setPlanStartYear(data.planStartYear)
   setPlanningMonths(Number.isInteger(data.planningMonths)&&data.planningMonths>=3&&data.planningMonths<=60?data.planningMonths:12)
   setSavedNotice(lang==='es'?'Recuperamos tu chacra. Verifica las fechas; campañas fuera de la ventana actual no se importan.':'Your field is restored. Check dates; campaigns outside the current window were not imported.')
  }catch{setSavedNotice(lang==='es'?'No pudimos recuperar el terreno guardado.':'Unable to restore saved field.')}
 }
 function resetAfterField(){request.current++;setPlantings([]);setHistory(null);setHistoryBusy(false);setHintChoices({});setSatelliteAccepted(false);setManualEntered(false);setResult(null);setPlanBusy(false);setPlanError('');setZoneCrops({});setActiveZone('rest');setSpatialPlan(null);setSpatialError('')}
 function importField(){
  try{
   const polygon=parseGeoJSONPolygon(geoInput);if(!polygon)throw Error('invalid field');const vertices=fromGeo(polygon);const area=approximatePolygonHectares(vertices)
   if(!validatePolygon(vertices).valid||area<.1||area>10000)throw Error('invalid field')
   resetAfterField();setSubplots([]);setEditVertices(null);setDrawingSubplot(false);setField(polygon);setCentre(centroid(polygon));setFieldLabel(lang==='es'?'Contorno importado por ti':'Outline imported by you');setPlace(lang==='es'?'Terreno importado':'Imported field');setIsDemoField(false);setDrawing(false);setPoints([]);setFieldError('')
  }catch{setFieldError(t.invalidShape)}
 }
 function changeArea(){setLanding(false);setSubplots([]);setEditVertices(null);setDrawingSubplot(false);setField(null);setFieldLabel('');setIsDemoField(false);setDrawing(false);setPoints([]);setFieldError('');resetAfterField()}
 function setExample(f:typeof DEMOS[number]){setLanding(false);const p=f.polygon;setSubplots([]);setEditVertices(null);setDrawingSubplot(false);setField(p);setCentre(centroid(p));setPlace('Barranca · Pativilca / Supe');setFieldLabel(lang==='es'?'Terreno de ejemplo en Barranca':'Example field in Barranca');setIsDemoField(true);setDrawing(false);setPoints([]);setFieldError('');resetAfterField();setMapLayer('photo')}
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
 function goToCoordinates(e:FormEvent){
  e.preventDefault()
  const lat=Number(coordinateLat.trim()),lng=Number(coordinateLng.trim())
  if(!coordinateLat.trim()||!coordinateLng.trim()||!Number.isFinite(lat)||!Number.isFinite(lng)||Math.abs(lat)>90||Math.abs(lng)>180){
   setSearchError(lang==='es'?'Introduce latitud y longitud válidas.':'Enter valid latitude and longitude.');return
  }
  changeArea();setCentre({lat,lng});setPlace(`${lat.toFixed(5)}, ${lng.toFixed(5)}`);setPlaces([]);setSearchError('')
 }
 function beginCornerEdit(){
  if(!field)return
  const vertices=fromGeo(field);setEditVertices(vertices);selectCorner(0,vertices);setDrawing(false);setDrawingSubplot(false);setPoints([]);setFieldError('')
 }
 function selectCorner(index:number,vertices=editVertices){
  if(!vertices?.[index])return
  setSelectedCorner(index);setCornerLat(String(vertices[index].lat));setCornerLng(String(vertices[index].lng))
 }
 function moveSelectedCorner(p:Point){
  setEditVertices(vertices=>vertices?.map((v,i)=>i===selectedCorner?p:v)||null)
  setCornerLat(String(p.lat));setCornerLng(String(p.lng));setFieldError('')
 }
 function applyCornerCoordinates(){
  const lat=Number(cornerLat.trim()),lng=Number(cornerLng.trim())
  if(!cornerLat.trim()||!cornerLng.trim()||!Number.isFinite(lat)||!Number.isFinite(lng)||Math.abs(lat)>90||Math.abs(lng)>180){
   setFieldError(lang==='es'?'Introduce coordenadas válidas para la esquina.':'Enter valid corner coordinates.');return
  }
  moveSelectedCorner({lat,lng})
 }
 function saveCornerEdit(){
  if(!field||!editVertices)return
  const validation=validatePolygon(editVertices),ha=approximatePolygonHectares(editVertices)
  if(!validation.valid||ha<.1||ha>10000){setFieldError(t.invalidShape+' '+t.invalidArea);return}
  const layout=validateSubplotLayout(editVertices,subplots.map(v=>({id:v.id,points:fromGeo(v.polygon)})))
  if(!layout.valid){setFieldError(lang==='es'?'Una subparcela quedaría fuera del terreno. Ajusta las esquinas o elimina esa subparcela.':'A subplot would fall outside the field. Adjust corners or remove the subplot.');return}
  const previous=JSON.stringify(field),updated=toGeo(editVertices)
  if(JSON.stringify(updated)!==previous){setField(updated);setCentre(centroid(updated));setIsDemoField(false);setFieldLabel(lang==='es'?'Terreno editado por ti':'Field edited by you');resetAfterField()}
  setEditVertices(null);setFieldError('')
 }
 function deleteSubplot(id:string){setSubplots(current=>current.filter(v=>v.id!==id));setZoneCrops(v=>{const next={...v};delete next[id];return next});setSpatialPlan(null);setFieldError('')}
 function finish(){const check=validatePolygon(points);const ha=approximatePolygonHectares(points)
  if(!check.valid){setFieldError(t.invalidShape);return}
  if(ha<(drawingSubplot?.01:.1)||ha>10000){setFieldError(t.invalidArea);return}
  if(drawingSubplot&&field){
   const next={id:'Subparcela '+(1+Math.max(0,...subplots.map(v=>Number(v.id.match(/(\d+)$/)?.[1])||0))),polygon:toGeo(points)}
   const result=validateSubplotLayout(fromGeo(field),[...subplots,next].map(v=>({id:v.id,points:fromGeo(v.polygon)})))
   if(!result.valid){setFieldError(lang==='es'?'La subparcela debe quedar dentro del terreno, sin solaparse con otras.':'The subplot must remain inside the field without overlapping others.');return}
   setSubplots(v=>[...v,next]);setActiveZone(next.id);setSpatialPlan(null);setDrawingSubplot(false);setPoints([]);setFieldError('');return
  }
  setSubplots([]);setField(toGeo(points));setFieldLabel(lang==='es'?'Chacra marcada por ti':'Field marked by you');setIsDemoField(false);setDrawing(false);setPoints([]);setFieldError('');resetAfterField()}
 function addCrop(){const x=addPlantingToRotation(plantings,crop,cropMonth)
  if(x.status!=='added'){setEntryError(x.status==='duplicate'?t.duplicate:t.limit);return}
  setPlantings(x.current);setManualEntered(true);setEntryError('');setResult(null)}
 function recordSeason(c:Campaign){
  const id=hintChoices[c.start];if(!id)return
  const idx=relativeMonthIndex(c.start,baseYear)
  if(idx<0||idx>=24){setEntryError(lang==='es'?'Temporada fuera de la ventana del historial.':'Season outside the history window.');return}
  const r=addPlantingToRotation(plantings,id,idx)
  if(r.status==='added'){setPlantings(r.current);setSatelliteAccepted(true);setEntryError('');setResult(null)}
  else setEntryError(r.status==='duplicate'?t.duplicate:t.limit)
 }
 async function loadImages(){
  if(!field)return;
  if(isStudyParcel(field)){request.current++;setHistory(BARRANCA_HISTORY as History);setHistoryBusy(false);setHistoryError('');return}
  const token=++request.current;setHistoryBusy(true);setHistoryError('')
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
 const seasons=(history?.detection.campaigns||[]).filter(c=>{const n=relativeMonthIndex(c.start,baseYear);return n>=0&&n<=23}).slice(0,8)

 function assignZoneCrop(zoneId:string,cropId:string){
  if(!availableZones.some(z=>z.id===zoneId)||!CROPS.includes(cropId))return
  const month=new Date(Date.UTC(baseYear,7+cropMonth,1)).toISOString().slice(0,7)
  setZoneCrops(entries=>({...entries,[zoneId]:{crop_id:cropId,planted_month:month}}))
  setActiveZone(zoneId);setCrop(cropId);setPendingCrop(null)
  setSpatialPlan(null);setSpatialError('')
 }
 function applyZoneCrop(){assignZoneCrop(selectedZone,crop)}
 async function buildSpatialPlan(){
  if(!field)return
  if(!availableZones.length||availableZones.some(z=>!zoneCrops[z.id])){
   setSpatialError(lang==='es'?'Registra un cultivo en cada zona para preparar tu plan.':'Record a crop for every area to prepare your plan.');return
  }
  setSpatialBusy(true);setSpatialError('');setPrecomputedAt('');setSlowServer(false)
  const slowTimer=window.setTimeout(()=>setSlowServer(true),4000)
  try{
   const payload={polygon:field,planning_months:planningMonths,zones:availableZones.map(zone=>({
    id:zone.id,crop_id:zoneCrops[zone.id].crop_id,planted_month:zoneCrops[zone.id].planted_month,
    ...(zone.polygon?{polygon:zone.polygon}:{})
   }))}
   const response=await fetch(API+'/api/rotation/spatial-plan',{
    method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload),signal:AbortSignal.timeout(60000)
   })
   if(!response.ok)throw new Error(await httpErrorMessage(response,lang==='en'))
   const data=await response.json() as ChakraSpatialPlan
   if(data.status!=='prepared'||!Array.isArray(data.zone_plans))throw new Error('Plan response needs review')
   setSpatialPlan({...data,zone_plans:data.zone_plans.map(row=>({...row,last_planting_month:row.last_planting_month||zoneCrops[row.zone_id]?.planted_month}))});navigate(2)
   if(province)void compareZones()
  }catch(e){
   if(planningMonths===12&&isPrecomputedExample()){
    setSpatialPlan(BARRANCA_EXAMPLE.spatial_plan as ChakraSpatialPlan);setResult(BARRANCA_EXAMPLE.compare as unknown as Result)
    setPrecomputedAt(BARRANCA_EXAMPLE.computed_at);navigate(2)
   }else setSpatialError(readableApiError(e,lang==='en'))
  }
  finally{window.clearTimeout(slowTimer);setSlowServer(false);setSpatialBusy(false)}
 }

 /** Challenge requirement (step 3): S0 current vs S1 Water vs S2 Soil, inline with the zone plan.
  * Current rotation = farmer-declared history if present, otherwise the crop and sowing month
  * recorded for each zone (farmer-declared, never inferred from NDVI). */
 const zoneRotation=useMemo<Planting[]>(()=>{
  if(current.length)return current
  const seen=new Set<number>(),out:Planting[]=[]
  for(const z of availableZones){
   const zc=zoneCrops[z.id];if(!zc)continue
   const idx=relativeMonthIndex(zc.planted_month,baseYear);if(idx<-24)continue
   const start=((idx%24)+24)%24
   if(seen.has(start))continue
   seen.add(start);out.push({crop_id:zc.crop_id,start_index:start})
  }
  return out.sort((a,b)=>a.start_index-b.start_index)
 },[current,availableZones,zoneCrops,baseYear])
 const [compareBusy,setCompareBusy]=useState(false)
 const [compareError,setCompareError]=useState('')
 async function compareZones(){
  if(!field||!zoneRotation.length)return
  const token=++request.current;setCompareBusy(true);setCompareError('');setResult(null)
  const priorities=goal==='water'?{water:2,soil:0,income:1,pests:1}:goal==='soil'?{water:0,soil:2,income:1,pests:1}:{water:2,soil:2,income:1,pests:1}
  const payload={zone:'barranca',latitude:point.lat,longitude:point.lng,polygon:field,current:zoneRotation,priorities,
   water_turn:scarcity,current_source:'farmer_declared',use_team_templates_as_fallback:false,
   income_crop_id:confirmedOptions.includes(incomeCrop)?incomeCrop:null}
  try{
   const r=await fetch(API+'/api/rotation/compare',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)})
   if(!r.ok)throw new Error(await httpErrorMessage(r,lang==='en'))
   const v=await r.json() as Result
   if(token===request.current)setResult(v)
  }catch(e){if(token===request.current){
   if(planningMonths===12&&isPrecomputedExample()){setResult(BARRANCA_EXAMPLE.compare as unknown as Result);setPrecomputedAt(BARRANCA_EXAMPLE.computed_at)}
   else setCompareError(readableApiError(e,lang==='en'))}}
  finally{if(token===request.current)setCompareBusy(false)}
 }

 async function showPlan(){
  if(!current.length){setPlanError(t.missingPlan);return}
  if(!supported){setPlanError(t.unsupported);return}
  if(!field){setPlanError(t.fieldMissing);return}
  const token=++request.current;setPlanBusy(true);setPlanError('');setResult(null)
  const priorities=goal==='water'?{water:2,soil:0,income:1,pests:1}:goal==='soil'?{water:0,soil:2,income:1,pests:1}:{water:2,soil:2,income:1,pests:1}
  const payload={
   zone:province?'barranca':null,latitude:point.lat,longitude:point.lng,polygon:field,
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
 function showPct(v:number|null|undefined){if(v==null)return lang==='es'?'Sin datos':'No data';if(Math.round(v)===0)return lang==='es'?'Sin cambio':'No change';return Math.abs(Math.round(v))+'% '+(v<0?(lang==='es'?'menos':'less'):(lang==='es'?'más':'more'))}
 function consequences(s:Strategy){const r=s.relative_to_current;return r?[
  {title:t.keyWater,value:showPct(r.water_low_river_change_percent),bad:(r.water_low_river_change_percent??0)>0,good:(r.water_low_river_change_percent??0)<0},
  {title:t.keySoil,value:r.bare_months_change===0?(lang==='es'?'Sin cambio':'No change'):Math.abs(r.bare_months_change)+' '+(r.bare_months_change>0?t.more:t.fewer),bad:r.bare_months_change>0,good:r.bare_months_change<0},
  {title:lang==='es'?'Cambios en siembras de legumbres':'Change in legume plantings',value:(r.legume_plantings_change>0?'+':'')+String(r.legume_plantings_change),bad:r.legume_plantings_change<0,good:r.legume_plantings_change>0}
 ]:[]}
 function cropsLine(s:Strategy){return schedule(s).map(p=>labelCrop(p.crop_id,lang)).join(' · ')}
 function technical(s:Strategy){return <details className="b-technical"><summary>{t.details}</summary>
  <div className="b-technical-inner"><h4>{t.evidence}</h4><ul>{s.sections.evidence[lang].map((a,i)=><li key={i}>{a}</li>)}</ul>
   <h4>{t.verify}</h4><ul>{s.sections.gaps[lang].map((a,i)=><li key={i}>{a}</li>)}</ul>
   {result?.farm_inputs?.soil&&<p>{lang==='es'?'Datos del suelo anotados por ti (todavía no utilizados para descartar cultivos):':'Your recorded soil data (not yet used to exclude crops):'} {Object.entries(result.farm_inputs.soil).filter(([k])=>k!=='source').map(([k,v])=>k+' '+v).join(' · ')}</p>}
   {result?.farm_inputs?.irrigation_allowance_m3_ha_season!=null&&<p>{lang==='es'?'Agua anotada por ti (sin comprobar contra necesidades reales de riego):':'Water volume you entered (not yet compared with actual irrigation needs):'} {result.farm_inputs.irrigation_allowance_m3_ha_season} m³/ha</p>}
   {result?.ai_analysis?.status==='trained_and_verified'&&<p>{lang==='es'?'Modelo estacional pequeño y reproducible (prueba de concepto) con observaciones NASA HLS de esta parcela de estudio: ':'Small reproducible seasonal model (proof of concept) using NASA HLS observations of this study field: '}{result.ai_analysis.observed_months} {lang==='es'?'meses. Los patrones estacionales contribuyen a la comparación de cobertura, no a predecir la cosecha.':'months. Seasonal patterns help compare crop coverage, not predict harvest.'}</p>}
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
   <div className="b-recommend-top"><div className="b-recommend-topline"><span className="b-eyebrow">{t.recommended}</span><span className="b-decision-label">{lang==='es'?'Estimación para revisar':'Estimate to review'}</span></div><h2>{strategyName(s)}</h2>
    <p>{result?.[lang==='es'?'recommendation_reason_es':'recommendation_reason_en']||t.planLead}</p>
    {negligible&&<p className="b-small-change">{lang==='es'?'La diferencia de agua es pequeña: no la tomes como un ahorro comprobado.':'Water difference is small and should not be considered verified savings.'}</p>}
   </div>
   <div className="b-keyfigures">{consequences(s).map((k,i)=><div key={i} className={'b-kpi '+(k.bad?'risk':k.good?'positive':'neutral')}><span>{k.title}</span><strong>{k.value}</strong></div>)}</div>
   <div className="b-plan-heading"><span className="b-section-kicker">{lang==='es'?'PASO A PASO':'STEP BY STEP'}</span><h3>{t.planSchedule}</h3><p>{lang==='es'?'Fechas aproximadas para organizar tus próximas campañas.':'Approximate dates to organize your next growing seasons.'}</p></div>{strip(s)}
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
  <div className="b-print-header"><div><strong className="b-print-logo">CHAKRA</strong><p>{t.printFooter}</p></div><div className="b-print-date">{simpleDate(lang)}</div></div>
  <h1>{t.planTitle}</h1>
  {sketch&&<figure className="b-print-sketch"><svg viewBox="0 0 120 100" role="img" aria-label={lang==='es'?'Croquis del terreno marcado':'Outline of marked field'}><rect x="1" y="1" width="118" height="98" rx="5" fill="#f4f7f4" stroke="#d5e3d8"/><polygon points={sketch} fill="#dbeee1" stroke="#236147" strokeWidth="2.3"/><text x="102" y="13" fill="#42654e" fontSize="9">N ↑</text></svg><figcaption>{lang==='es'?'Contorno aproximado de la chacra':'Approximate field outline'}</figcaption></figure>}
  <div className="b-print-meta"><span><b>{t.where}:</b> {place}</span><span><b>{t.areaPrint}:</b> {area.toFixed(2)} {lang==='es'?'hectáreas':'hectares'}</span>
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
  {result.ai_analysis?.status==='trained_and_verified'&&<div className="b-print-ai"><h3>{lang==='es'?'Modelo estacional pequeño y reproducible (44 observaciones NASA HLS, una parcela de estudio) — prueba de concepto':'Small reproducible seasonal model (44 NASA HLS observations, one study field) — proof of concept'}</h3>
   <p>{lang==='es'?'Regresión logística entrenada con ':'Logistic regression trained with '}{result.ai_analysis.observed_months} {lang==='es'?'observaciones mensuales reales de NASA HLS de esta parcela. La señal aprendida pondera épocas de suelo descubierto; no identifica cultivos ni garantiza rendimientos.':'real NASA HLS monthly observations of this field. Learned patterns weight bare-surface seasons; they do not identify crops or guarantee yields.'}</p>
   <p>{lang==='es'?'Evaluación cronológica: 33 observaciones de entrenamiento y 11 posteriores de prueba.':'Chronological evaluation: 33 training observations and 11 later holdout observations.'}</p>
   {result.ai_analysis.holdout_classification&&<p>{lang==='es'?'Clasificación de vegetación baja, solo Barranca':'Low-vegetation classification, Barranca only'}:
    {' '}Accuracy {result.ai_analysis.holdout_classification.accuracy_percent?.toFixed(1)??'—'}%,
    {' '}Precision {result.ai_analysis.holdout_classification.precision_percent?.toFixed(1)??'—'}%,
    {' '}Recall {result.ai_analysis.holdout_classification.recall_percent?.toFixed(1)??'—'}%,
    {' '}F1 {result.ai_analysis.holdout_classification.f1_percent?.toFixed(1)??'—'}%
    {' '}({result.ai_analysis.holdout_classification.test_observations} {lang==='es'?'observaciones de prueba':'holdout observations'}).
    {' '}{lang==='es'?'No extrapolar a otra parcela.':'Not transferable to another field.'}</p>}
  </div>}
  {economicReport&&<div className="b-print-economics"><h3>{lang==='es'?'Cuenta económica basada en los datos del agricultor':'Farmer-input economic estimate'}</h3>
   <p>{lang==='es'?'Estimación por hectárea para un ciclo de 24 meses, no ganancia garantizada.':'Estimate per hectare for a 24-month cycle, not guaranteed profit.'}</p>
   {economicReport.strategies.map(x=><p key={x.strategy_id}><strong>{x.strategy_id==='S0'?t.current:x.strategy_id}:</strong> {x.margin_soles_ha_24months==null?(lang==='es'?'Datos incompletos':'Incomplete inputs'):'S/ '+x.margin_soles_ha_24months.toLocaleString(lang==='es'?'es-PE':'en-US')}</p>)}
  </div>}
  <p>{sampleNote?(lang==='es'?'Terreno mostrado para demostración; los cultivos registrados fueron proporcionados durante esta sesión.':'Field used for demonstration; crop inputs were supplied during this session.'):''}</p></div></div>}
 if(infoPage)return <ChakraInfoPage page={infoPage} lang={lang} onBack={()=>showPage(null)} onNavigate={showPage}/>
 return <div className={'b-app chakra-farmer-clean '+(new URLSearchParams(window.location.search).get('research')==='1'?'chakra-research ':'')+(spatialPlan?'chakra-has-zone-print':'')}>
  <a className="b-skip" href="#main">Ir al contenido / Skip to content</a>
  <header className="b-header"><div className="b-header-inner">
 <button type="button" className="b-brand" aria-label={lang==='es'?'Inicio CHAKRA X':'CHAKRA X home'} onClick={()=>{showPage(null);navigate(0);setLanding(true)}}><span className="b-brand-mark"><ChakraMark/></span><div><b>CHAKRA X</b><small>{lang==='es'?'Tu tierra. Tu decisión.':'Your land. Your decision.'}</small></div></button>
 <nav className="chakra-nav" aria-label={lang==='es'?'Navegación principal':'Main navigation'}>
 <a href="/como-funciona" onClick={e=>{e.preventDefault();showPage('how')}}>{lang==='es'?'Cómo funciona':'How it works'}</a>
 <a href="/fuentes" onClick={e=>{e.preventDefault();showPage('sources')}}>{lang==='es'?'Fuentes':'Sources'}</a>
 </nav>
 <div className="b-header-tools"><button className="chakra-nav-cta" aria-label={lang==='es'?'Ir al mapa':'Go to the map'} onClick={()=>{setLanding(false);navigate(0);setTimeout(()=>document.getElementById('chakra-field')?.scrollIntoView({behavior:'smooth'}),0)}}><span className="chakra-nav-long">{lang==='es'?'Ir al mapa':'Go to the map'}</span><span className="chakra-nav-short" aria-hidden="true">{lang==='es'?'Mapa':'Map'}</span><Icon name="right" size={16}/></button>
 <button type="button" className="chakra-theme-toggle" aria-pressed={theme==='light'} aria-label={theme==='light'?(lang==='es'?'Cambiar a modo oscuro':'Switch to dark mode'):(lang==='es'?'Cambiar a modo claro':'Switch to light mode')} title={theme==='light'?'Dark':'Light'} onClick={()=>setTheme(v=>v==='light'?'dark':'light')}>{theme==='light'?'☾':'☀'}</button>
 <div className="b-language" role="group" aria-label="Idioma / Language"><button type="button" aria-pressed={lang==='es'} className={lang==='es'?'on':''} onClick={()=>setLang('es')}>ES</button><button type="button" aria-pressed={lang==='en'} className={lang==='en'?'on':''} onClick={()=>setLang('en')}>EN</button></div></div></div></header>
  <div className="chakra-background" aria-hidden="true"><img src="/chakra-fields.webp" alt=""/><div/></div>
  <BioTour onStart={()=>{if(!field){changeArea();setDrawing(true)}window.scrollTo({top:0,behavior:'smooth'})}} lang={lang} step={step===3?2:step} assigned={assignedCount} zoneCount={availableZones.length||1} landing={landing} fieldReady={Boolean(field)} cropPending={Boolean(pendingCrop)} planReady={Boolean(spatialPlan)} error={step===0?fieldError:spatialError||fieldError}/>
  <main id="main" className={'b-main '+(landing&&step===0?'chakra-home':'chakra-workspace')}>
   {landing&&step===0&&<ChakraLanding lang={lang} onStart={()=>{setLanding(false);setExample(BARRANCA_FIELD);setTimeout(()=>document.getElementById('chakra-field')?.scrollIntoView({behavior:'smooth'}),0)}} onMap={()=>{setLanding(false);changeArea();setDrawing(true);setTimeout(()=>document.getElementById('chakra-field')?.scrollIntoView({behavior:'smooth'}),0)}}/>}
  <div className="b-progress-wrap"><div className="b-progress-shell"><div className="b-progress-label"><span>{lang==='es'?'Tu recorrido':'Your journey'}</span><strong>{lang==='es'?'Paso '+(Math.min(step,2)+1)+' de 3':'Step '+(Math.min(step,2)+1)+' of 3'}</strong></div>
<nav className="b-progress" data-bio-target="bio-steps" aria-label={lang==='es'?'Progreso del plan':'Plan progress'}>{t.steps.map((name,i)=><button key={i} type="button" disabled={i>step} aria-current={step===i?'step':undefined} className={step===i?'active':i<step?'done':''} onClick={()=>navigate(i as Step)}><span className="b-step-number">{i<step?<Icon name="check" size={17}/>:i+1}</span><span>{name}</span></button>)}</nav></div></div>

   {step===0&&<section id="chakra-field" className="b-layout">
    <div className="b-intro b-hero-intro" data-bio-target={landing?undefined:"bio-hero"}><div className="b-hero-copy">
<span className="b-eyebrow"><span className="b-hero-spark" aria-hidden="true"/>{lang==='es'?'PASO 1 · MI TERRENO':'STEP 1 · MY FIELD'}</span>
<h1>{t.title}</h1><p>{t.subtitle}</p>
<div className="b-hero-promise"><span><Icon name="check" size={16}/>{lang==='es'?'Sin conocimientos técnicos':'No technical skills needed'}</span><span><Icon name="check" size={16}/>{lang==='es'?'Sin crear una cuenta':'No account required'}</span></div>
</div></div>
    <div className="b-farm-grid">
     <div className="chakra-study-strip">{!landing&&!studyParcel&&<button type="button" className="chakra-return-study" onClick={()=>setExample(BARRANCA_FIELD)}>{lang==='es'?'Usar parcela de Barranca':'Use Barranca study field'}<Icon name="right" size={16}/></button>}<Icon name="pin" size={19}/><span>{lang==='es'?'Barranca · Pativilca / Supe':'Barranca · Pativilca / Supe'}</span><small>{lang==='es'?'Modelo estacional pequeño y reproducible (44 observaciones NASA HLS, una parcela de estudio) — prueba de concepto; se aplica solo a esta parcela. Los cultivos reales no están confirmados.':'Small reproducible seasonal model (44 NASA HLS observations, one study field) — proof of concept; it applies only to this field. Actual crops are unconfirmed.'}</small></div>
     <div className="b-card b-search-card"><div className="b-card-heading"><span className="b-section-kicker">{lang==='es'?'PRIMERO · UBICA TU PARCELA':'FIRST · FIND YOUR FIELD'}</span><h2><Icon name="pin"/>{t.search}</h2><p>{lang==='es'?'Busca tu localidad o marca las esquinas directamente en el mapa.':'Search for your town or mark the corners directly on the map.'}</p></div>
      <form className="b-search" onSubmit={searchPlace}><label htmlFor="b-search" className="sr-only">{t.search}</label>
       <input id="b-search" value={query} onChange={e=>setQuery(e.target.value)} placeholder={t.searchHint} autoComplete="off"/>
       <button type="submit" className="b-btn b-btn-solid" disabled={searching}><Icon name="search" size={19}/>{searching?t.waitSearch:t.find}</button>
      </form>
      <details className="b-coordinate-search"><summary>{lang==='es'?'Buscar por coordenadas':'Find by coordinates'}</summary>
       <form onSubmit={goToCoordinates} className="b-coordinate-fields"><label>{lang==='es'?'Latitud':'Latitude'}<input aria-label={lang==='es'?'Latitud':'Latitude'} type="number" step="any" min="-90" max="90" placeholder="-12.047" value={coordinateLat} onChange={e=>setCoordinateLat(e.target.value)}/></label>
        <label>{lang==='es'?'Longitud':'Longitude'}<input aria-label={lang==='es'?'Longitud':'Longitude'} type="number" step="any" min="-180" max="180" placeholder="-75.366" value={coordinateLng} onChange={e=>setCoordinateLng(e.target.value)}/></label>
        <button type="submit" className="b-btn b-btn-light">{lang==='es'?'Ir a coordenadas':'Go to coordinates'}</button></form>
      </details>
      {searchError&&<p className="b-error" role="alert">{searchError}</p>}
      {places.length>0&&<div className="b-place-results">{places.map((p,i)=><button key={i} type="button" onClick={()=>pickPlace(p)}><Icon name="pin" size={18}/><span>{p.name}</span></button>)}</div>}
      <p className="b-map-label"><Icon name="pin" size={16}/>{place}</p>
      <p className="b-muted">{studyParcel?(lang==='es'?'Parcela de estudio · cultivos reales no confirmados':'Study field · actual crops unconfirmed'):t.mapHint}</p>
      <div data-bio-target="bio-layers" className="b-map-view" role="group" aria-label={lang==='es'?'Capas de observación':'Observation layers'}>
       {(studyParcel?(['photo','hls','rain'] as const):(['photo','vegetation','rain'] as const)).map(id=><button key={id} type="button" disabled={(saveMobileData&&id!=='photo')||(id==='hls'&&!studyParcel)} aria-pressed={mapLayer===id} onClick={()=>{setMapLayer(id);setMapLayerFailed(false)}}>{id==='photo'?(lang==='es'?'Foto aérea':'Aerial photo'):id==='hls'?(lang==='es'?'Vegetación de Barranca':'Barranca vegetation'):id==='vegetation'?(lang==='es'?'Vegetación NASA':'NASA vegetation'):(lang==='es'?'Lluvia NASA':'NASA rain')}</button>)}
      </div>
       <details className="b-map-more"><summary>{lang==='es'?'Más capas y herramientas':'More layers and tools'}</summary>
        <button type="button" aria-pressed={mapLayer==='terrain'} onClick={()=>setMapLayer('terrain')}>{lang==='es'?'Relieve':'Terrain'}</button>
        <button type="button" aria-pressed={mapLayer==='vegetation'} onClick={()=>setMapLayer('vegetation')}>{lang==='es'?'Vegetación regional':'Regional vegetation'}</button>
       </details>
      <label className="b-low-bandwidth"><input type="checkbox" checked={saveMobileData} onChange={e=>{setSaveMobileData(e.target.checked);if(e.target.checked)setMapLayer('photo')}}/> {lang==='es'?'Ahorrar datos móviles (mapa sencillo)':'Save mobile data (simple map)'}</label>
      {(drawing||drawingSubplot)&&<div className="b-map-guide"><strong>{drawingSubplot?(lang==='es'?'Dibuja una zona dentro de tu terreno':'Draw an area inside your field'):(lang==='es'?'Marca tu chacra en 3 pasos':'Mark your field in 3 steps')}</strong><ol><li>{lang==='es'?'Acerca el mapa.':'Zoom in.'}</li><li>{lang==='es'?'Toca cada esquina del terreno.':'Tap each field corner.'}</li><li>{drawingSubplot?(lang==='es'?'Pulsa «Guardar subparcela».':'Tap Save subplot.'):(lang==='es'?'Pulsa «Terminar terreno».':'Tap Finish field.')}</li></ol></div>}
      <div className="b-map-frame" data-bio-target="bio-map"><MapContainer zoomSnap={0.25} maxZoom={21} className="b-map" center={[centre.lat,centre.lng]} zoom={13} scrollWheelZoom={false}>
       <TileLayer maxNativeZoom={17} maxZoom={21} key={saveMobileData?'streets':mapLayer==='terrain'?'terrain':'satellite'} attribution={saveMobileData?'© OpenStreetMap contributors':'Imagery © Esri, Maxar, Earthstar Geographics | Geocoding © OpenStreetMap contributors'}
        url={saveMobileData?'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png':mapLayer==='terrain'?'https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}':'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'}/>
       {!saveMobileData&&isScienceLayer(mapLayer)&&<WMSTileLayer key={mapLayer+mapDate} url={GIBS_WMS}
        layers={GIBS_LAYERS[mapLayer].wmsLayer}
        styles="" format="image/png" transparent={true} version="1.1.1" opacity={mapOpacity} {...{time:mapDate}}
        attribution="NASA GIBS / ESDIS" eventHandlers={{tileerror:()=>setMapLayerFailed(true)}}/>}
       {mapLayer==='rain'&&field&&<Rectangle bounds={imergApproxCell(point.lat,point.lng)} pathOptions={{color:'#2688bb',fillOpacity:0,dashArray:'5 5'}}/>}
       <FlyTo point={centre} polygon={mapPolygon}/>
       <DrawLayer enabled={drawing||drawingSubplot} points={points} onPoint={p=>{setPoints(x=>[...x,p]);setFieldError('')}} onFinish={finish}/>
       <EditableCorners points={editVertices} selected={selectedCorner} onPick={i=>selectCorner(i)} onMove={moveSelectedCorner}/>
       {field&&!editVertices&&<Polygon positions={(mapPolygon||[]).map(p=>[p.lat,p.lng] as [number,number])} pathOptions={{color:'#F4C252',weight:4,fillColor:mapLayer==='hls'&&studyParcel?vegetationBand(hlsValue).color:'#2EAE84',fillOpacity:mapLayer==='hls'?.65:.24}}/>}
       {subplots.map(v=><Polygon key={v.id} positions={fromGeo(v.polygon).map(p=>[p.lat,p.lng] as [number,number])} pathOptions={{color:'#F59E0B',weight:2,dashArray:'6 4',fillColor:'#4CD964',fillOpacity:.14}}/>)}
      </MapContainer>
      <div className="b-map-actions">{(drawing||drawingSubplot)?<><button type="button" onClick={()=>setPoints(v=>v.slice(0,-1))} disabled={!points.length} className="b-btn b-btn-light"><Icon name="undo" size={16}/>{t.undo}</button>
       <button type="button" className="b-btn b-btn-solid" onClick={finish} disabled={points.length<3}>{drawingSubplot?(lang==='es'?'Guardar subparcela':'Save subplot'):t.finish}</button>
       <button type="button" className="b-btn b-btn-light" onClick={()=>{setDrawing(false);setDrawingSubplot(false);setPoints([]);setFieldError('')}}>{t.cancel}</button></>:
       <button type="button" className="b-btn b-btn-solid" onClick={()=>{changeArea();setDrawing(true)}}>{field?t.changeField:t.draw}</button>}</div></div>
      {mapLayer==='hls'&&studyParcel&&<BarrancaLegend month={hlsMonth} onMonth={setHlsMonth} lang={lang}/>}
      {isScienceLayer(mapLayer)&&<section className="b-map-evidence" aria-label={lang==='es'?'Procedencia de la capa NASA':'NASA layer provenance'}>
       <div className="b-map-evidence-controls"><label>{lang==='es'?'Fecha solicitada (UTC)':'Requested date (UTC)'}<input type="date" value={mapDate} max={new Date().toISOString().slice(0,10)} onChange={e=>{setMapDate(e.target.value);setMapLayerFailed(false)}}/></label>
        <label>{lang==='es'?'Opacidad de la capa':'Layer opacity'}<input type="range" min="0" max="1" step=".05" value={mapOpacity} onChange={e=>setMapOpacity(Number(e.target.value))}/></label></div>
       <p className="b-layer-reading">{mapLayer==='vegetation'?(lang==='es'?'Los colores de la leyenda muestran menor o mayor vegetación en el entorno. No indican por sí solos buena o mala salud del cultivo.':'Legend colors show less or more vegetation nearby, not crop health.'):(lang==='es'?'La leyenda muestra intensidad de lluvia regional. Más lluvia no siempre es mejor: depende del cultivo, el suelo y el momento.':'The legend shows regional rain intensity. More rain is not always better: crop, soil and timing matter.')}</p>
       <details className="chakra-map-technical"><summary>{lang==='es'?'Detalles de esta capa NASA':'NASA layer details'}</summary><div className="b-map-provenance">
        <strong>{GIBS_LAYERS[mapLayer].product}</strong>
        <span>{mapLayer==='vegetation'?(lang==='es'?'Vegetación regional NASA MODIS · 250 m':'Regional NASA MODIS vegetation · 250 m'):(lang==='es'?'Lluvia regional NASA GPM · aprox. 10 km':'Regional NASA GPM rainfall · approx. 10 km')}</span>
        <span>{lang==='es'?GIBS_LAYERS[mapLayer].resolutionEs:GIBS_LAYERS[mapLayer].resolutionEn}</span>
        <span>{lang==='es'?GIBS_LAYERS[mapLayer].unitEs:GIBS_LAYERS[mapLayer].unitEn}</span>
        <span>{lang==='es'?GIBS_LAYERS[mapLayer].temporalEs:GIBS_LAYERS[mapLayer].temporalEn}</span>
        <p>{lang==='es'?GIBS_LAYERS[mapLayer].limitationsEs:GIBS_LAYERS[mapLayer].limitationsEn}</p>
        <p>{lang==='es'?'La fecha es una solicitud al servicio de imágenes, no una observación confirmada en este terreno. La carga de teselas tampoco valida píxeles.':'The date is an image-service request, not a confirmed observation on this field. Tile loading does not validate pixels.'}</p>
        {mapLayer==='rain'&&<p>{lang==='es'?'El recuadro azul punteado es esquemático, no una celda IMERG geocodificada.':'The dotted blue rectangle is schematic, not a geocoded IMERG cell.'}</p>}
        <details open className="b-map-legend"><summary>{lang==='es'?'Leyenda NASA original':'Original NASA legend'}</summary><img src={gibsLegendUrl(mapLayer)} alt={lang==='es'?'Leyenda de colores publicada por NASA GIBS':'Official NASA GIBS color legend'} loading="lazy"/><p><a target="_blank" rel="noreferrer" href={gibsLegendUrl(mapLayer)}>{lang==='es'?'Abrir leyenda oficial':'Open official legend'}</a></p></details>
        <a href={GIBS_LAYERS[mapLayer].worldviewUrl} target="_blank" rel="noreferrer">{lang==='es'?'Ver capa en NASA Worldview':'Open in NASA Worldview'}</a>
        <a href={GIBS_LAYERS[mapLayer].sourceUrl} target="_blank" rel="noreferrer">{lang==='es'?'Metadatos del proveedor':'Provider metadata'}</a>
        {mapLayerFailed&&<span role="status">{lang==='es'?'La capa NASA no cargó para esta vista. No se muestra ninguna estimación.':'NASA layer unavailable for this view. No estimate is shown.'}</span>}
       </div></details>
      </section>}
      {fieldError&&<p role="alert" className="b-error">{fieldError}</p>}
      {field&&<div className="b-field-ready" role="status"><Icon name="check"/><div><strong>{t.fieldReady}</strong><span>{t.area}: {area.toLocaleString(lang==='es'?'es-PE':'en-US',{maximumFractionDigits:2})} {lang==='es'?'hectáreas':'hectares'}</span></div></div>}
      {field&&!drawing&&!drawingSubplot&&<details className="b-parcel-tools" aria-label={lang==='es'?'Herramientas de mi terreno':'My field tools'}><summary>{lang==='es'?'Ajustar límites o subparcelas (opcional)':'Adjust boundary or subplots (optional)'}</summary>
        <div className="b-parcel-tools-head"><strong>{lang==='es'?'Límites y subparcelas':'Boundaries and subplots'}</strong><span>{lang==='es'?'Área estimada, no catastral':'Estimated area, not cadastral'}</span></div>
        {!editVertices?<div className="b-parcel-actions"><button type="button" className="b-btn b-btn-light" onClick={beginCornerEdit}>{lang==='es'?'Editar esquinas':'Edit corners'}</button>
          <button type="button" className="b-btn b-btn-light" onClick={()=>{setDrawingSubplot(true);setPoints([]);setFieldError('')}}>{lang==='es'?'Dibujar subparcela':'Draw subplot'}</button></div>:
         <div className="b-vertex-editor"><p>{lang==='es'?'Selecciona una esquina, toca su nueva posición en el mapa o escribe sus coordenadas.':'Choose a corner, tap its new location on the map or enter coordinates.'}</p>
          <div className="b-vertex-choices" role="group" aria-label={lang==='es'?'Esquina a editar':'Corner to edit'}>{editVertices.map((_,i)=><button key={i} type="button" aria-pressed={selectedCorner===i} onClick={()=>selectCorner(i)}>{lang==='es'?'Esquina':'Corner'} {i+1}</button>)}</div>
          <div className="b-coordinate-fields"><label>{lang==='es'?'Latitud de la esquina':'Corner latitude'}<input type="number" step="any" min="-90" max="90" value={cornerLat} onChange={e=>setCornerLat(e.target.value)}/></label>
            <label>{lang==='es'?'Longitud de la esquina':'Corner longitude'}<input type="number" step="any" min="-180" max="180" value={cornerLng} onChange={e=>setCornerLng(e.target.value)}/></label>
            <button type="button" className="b-btn b-btn-light" onClick={applyCornerCoordinates}>{lang==='es'?'Aplicar coordenadas':'Apply coordinates'}</button></div>
          <div className="b-parcel-actions"><button type="button" className="b-btn b-btn-primary" onClick={saveCornerEdit}>{lang==='es'?'Guardar contorno':'Save outline'}</button>
            <button type="button" className="b-btn b-btn-light" onClick={()=>{setEditVertices(null);setFieldError('')}}>{t.cancel}</button></div>
         </div>}
        {subplots.length>0&&<ul className="b-subplot-list">{subplots.map(v=><li key={v.id}><span><strong>{v.id}</strong><small>{approximatePolygonHectares(fromGeo(v.polygon)).toFixed(2)} {lang==='es'?'hectáreas':'hectares'}</small></span><button type="button" onClick={()=>deleteSubplot(v.id)} aria-label={(lang==='es'?'Eliminar ':'Remove ')+v.id}>{lang==='es'?'Eliminar':'Remove'}</button></li>)}</ul>}
        {!subplots.length&&<p className="b-muted">{lang==='es'?'No hay subparcelas todavía. Puedes dibujarlas si quieres asignar cultivos por zonas.':'No subplots yet. Draw them only if you want to assign crops by area.'}</p>}
       </details>}
      {!supported&&<p className="b-note"><Icon name="info" size={18}/>{lang==='es'?'Puedes planificar por zonas aquí. Verifica con un técnico local el calendario y el agua antes de sembrar.':'Plan your zones here. Verify local seasons and water before planting.'}</p>}
      {savedNotice&&<p className="b-note" role="status">{savedNotice}</p>}
      {savedAvailable&&<div className="b-farm-recovery"><button type="button" onClick={()=>restoreFarm()}>{lang==='es'?'Recuperar mi chacra guardada':'Restore saved field'}</button></div>}
     <details className="b-technical"><summary>{lang==='es'?'Importar contorno GeoJSON (opcional)':'Import GeoJSON outline (optional)'}</summary><label>{lang==='es'?'Contorno GeoJSON':'GeoJSON outline'}<textarea value={geoInput} onChange={e=>setGeoInput(e.target.value)}/></label><button type="button" className="b-btn b-btn-light" onClick={importField}>{lang==='es'?'Usar contorno':'Use outline'}</button></details>
     {field&&new URLSearchParams(window.location.search).get('research')==='1'&&<Suspense fallback={<p role="status">{lang==='es'?'Cargando herramientas…':'Loading tools…'}</p>}><FieldEvidence key={JSON.stringify(field)} polygon={field} lang={lang} andes={false}/></Suspense>}
     </div>

    </div>
    <div className="b-next b-next-emphasized" data-bio-target="bio-next"><p className="b-next-context">{field?(lang==='es'?'Terreno seleccionado. Sigue para registrar tus cultivos.':'Field selected. Continue to record your crops.'):(lang==='es'?'Elige el ejemplo o marca un terreno para continuar.':'Choose the example or mark a field to continue.')}</p><button type="button" className="b-btn b-btn-light" disabled={!field} onClick={saveFarm}>{lang==='es'?'Guardar mi chacra':'Save my field'}</button><button type="button" className="b-btn b-btn-primary" disabled={!field} onClick={()=>{setLanding(false);navigate(1)}}>{lang==='es'?'Registrar cultivos por zona':'Record crops by zone'}<Icon name="right"/></button></div>
   </section>}
   {step===1&&field&&<section className="b-form-page chakra-zone-page">
    <div className="b-intro"><span className="b-eyebrow">{lang==='es'?'PASO 2 DE 3':'STEP 2 OF 3'}</span>
     <h1>{lang==='es'?'Muéstranos qué sembraste':'Show what you planted'}</h1>
     <p>{lang==='es'?'Marca únicamente las zonas que tienen cultivos actualmente. Ajusta sus vértices para que sigan el contorno real de cada área sembrada.':'Only mark areas currently planted. Adjust polygon vertices to match each cultivated area.'}</p></div>
    <div className="chakra-zone-map-wrap" data-bio-target="bio-zone-map">
     <div className="chakra-zone-map-frame" id="chakra-zone-map"><MapContainer zoomSnap={0.25} maxZoom={21} center={[point.lat,point.lng]} zoom={15} scrollWheelZoom={false} className="chakra-zone-map">
      <ZoneDropBridge field={field} subplots={subplots} onAssign={assignZoneCrop}/>
      <ChakraZoneHandles field={field} zones={subplots} selected={selectedZone} onMove={updateZonePolygon} onInvalid={message=>setFieldError(message)}/>
      <TileLayer maxNativeZoom={17} maxZoom={21} attribution="Imagery © Esri, Maxar, Earthstar Geographics" url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"/>
      <FlyTo point={point} polygon={mapPolygon}/>
      <DrawLayer enabled={drawingSubplot} points={points} onPoint={p=>{setPoints(q=>[...q,p]);setFieldError('')}} onFinish={finish}/>
      <Polygon positions={(mapPolygon||[]).map(v=>[v.lat,v.lng] as [number,number])} interactive={!drawingSubplot}
       eventHandlers={{click:()=>{if(!subplots.length){if(pendingCrop)assignZoneCrop('rest',pendingCrop);else setActiveZone('rest')}}}}
       pathOptions={{color:'#D6F866',weight:5,fillColor:cropVisual(zoneCrops.rest?.crop_id).color,fillOpacity:subplots.length?0:zoneCrops.rest?.crop_id?0.45:0.15}}>
       {zoneCrops.rest&&subplots.length===0&&<Tooltip permanent direction="center" className="chakra-crop-map-label"><ZoneMapLabel zone={zoneTitle('rest').split(' · ')[0]} cropId={zoneCrops.rest.crop_id} cropName={labelCrop(zoneCrops.rest.crop_id,lang)}/></Tooltip>}
      </Polygon>
      {subplots.map(z=><Polygon key={z.id} positions={fromGeo(z.polygon).map(v=>[v.lat,v.lng] as [number,number])}
       pathOptions={{color:selectedZone===z.id?'#D6F866':'#F1F8EB',weight:selectedZone===z.id?5:3,fillColor:cropVisual(zoneCrops[z.id]?.crop_id).color,fillOpacity:.8}}
       interactive={!drawingSubplot} eventHandlers={{click:()=>{if(pendingCrop)assignZoneCrop(z.id,pendingCrop);else setActiveZone(z.id)}}}>
       {zoneCrops[z.id]&&<Tooltip permanent direction="center" className="chakra-crop-map-label"><ZoneMapLabel zone={zoneTitle(z.id)} cropId={zoneCrops[z.id].crop_id} cropName={labelCrop(zoneCrops[z.id].crop_id,lang)}/></Tooltip>}
      </Polygon>)}
     </MapContainer></div>
     <div className="chakra-zone-map-actions" data-bio-target="bio-zone-edit">
      {drawingSubplot?<><span>{lang==='es'?'Toca las esquinas de la zona.':'Tap area corners.'}</span>
       <button className="b-btn b-btn-light" type="button" disabled={!points.length} onClick={()=>setPoints(v=>v.slice(0,-1))}>{t.undo}</button>
       <button className="b-btn b-btn-primary" type="button" disabled={points.length<3} onClick={finish}>{lang==='es'?'Guardar zona':'Save zone'}</button>
       <button className="b-btn b-btn-light" type="button" onClick={()=>{setDrawingSubplot(false);setPoints([])}}>{t.cancel}</button></>:<>
       {selectedZone!=='rest'&&<button className="b-btn b-btn-light" type="button" onClick={()=>deleteSubplot(selectedZone)}>{lang==='es'?'Quitar zona elegida':'Remove selected area'}</button>}
       <button className="b-btn b-btn-light" type="button" disabled={subplots.length>=20} onClick={addEditableZone}>{lang==='es'?'+ Añadir polígono':'+ Add polygon'}</button></>}
     </div>
     <p className="chakra-zone-map-note">{lang==='es'?'Toca una zona para registrar su cultivo. Para ajustarla, arrastra el centro o cualquiera de sus vértices para cambiar su forma.':'Tap an area to record its crop. Drag its center or any vertex to reshape the polygon.'}</p>
    </div>
    {fieldError&&<p className="b-error" role="alert">{fieldError}</p>}
    <div className="chakra-zones-heading"><h2>{lang==='es'?'Mis zonas':'My areas'}</h2><span>{assignedCount}/{availableZones.length} {lang==='es'?'zonas registradas':'areas recorded'}</span></div>
    <div className="chakra-zone-choices">{availableZones.map(z=><button className={'chakra-zone-choice '+(selectedZone===z.id?'chosen':'')} type="button" key={z.id} aria-pressed={selectedZone===z.id}
     onClick={()=>{setActiveZone(z.id);const previous=zoneCrops[z.id];if(previous){setCrop(previous.crop_id);const idx=relativeMonthIndex(previous.planted_month,baseYear);if(idx>=0&&idx<36)setCropMonth(idx)}}}>
     <span>{zoneTitle(z.id)}</span><small>{z.ha.toLocaleString(lang==='es'?'es-PE':'en-US',{maximumFractionDigits:2})} {lang==='es'?'hectáreas':'hectares'}</small>
     <strong>{zoneCrops[z.id]?labelCrop(zoneCrops[z.id].crop_id,lang):(lang==='es'?'Por registrar':'To register')}</strong></button>)}</div>
    <section className="chakra-crop-section" data-bio-target="bio-crops"><h2>{lang==='es'?'Elige tus cultivos':'Choose your crops'}</h2>
     <p className="chakra-zone-drag-hint">{lang==='es'?'Indica qué está sembrado ahora, cuándo lo sembraste y en qué polígono crece. Puedes tocar o arrastrar la tarjeta.':'Select the current crop and its planting date, then tap or drag it onto its polygon.'}</p>
     <div className="chakra-crop-planting-month" data-bio-target="bio-plant-month"><label>{lang==='es'?'¿Cuándo sembraste lo que está creciendo ahora en esta zona?':'When did you plant the crop currently growing in this area?'}
      <select value={cropMonth} onChange={e=>setCropMonth(Number(e.target.value))}>{monthChoices.map(i=><option key={i} value={i}>{monthYear(i,baseYear,lang)}</option>)}</select></label>
      <p className="chakra-month-why">{lang==='es'?'Indica la fecha de siembra actual de esta zona; no necesitas registrar campañas antiguas. La usamos para estimar cuándo termina el ciclo.':'Enter when the current crop was planted, not historical campaigns. It helps us estimate when its cycle ends.'}</p>
     </div>
     <div className="chakra-crop-grid" role="group" aria-label={lang==='es'?'Elige el cultivo':'Choose crop'}>{CROPS.map(id=><button type="button" draggable onDragStart={event=>{event.dataTransfer.setData('application/x-chakra-crop',id);event.dataTransfer.effectAllowed='copy';setPendingCrop(id);setCrop(id)}} key={id} className={'chakra-crop-card '+(crop===id?'chosen':'')} aria-pressed={crop===id} onClick={()=>{setCrop(id);setPendingCrop(id);if(window.innerWidth<=960)document.getElementById('chakra-zone-map')?.scrollIntoView({behavior:'smooth',block:'center'})}}>
      <span className="chakra-crop-art"><CropGlyph id={id} size={54}/></span>
      <span>{labelCrop(id,lang)}</span><span className="chakra-crop-tick">{crop===id?'✓':''}</span></button>)}</div>
     <div className="chakra-crop-when">
      <button className="b-btn b-btn-primary" type="button" onClick={applyZoneCrop}>{lang==='es'?'Marcar en zona elegida':'Assign to selected area'}</button></div>
    </section>
    <details className="chakra-zone-help chakra-farmer-extra"><summary>{lang==='es'?'Ayuda para reconocer cultivos (opcional)':'Help identifying crops (optional)'}</summary>
     <p>{lang==='es'?'Tus respuestas sobre lo que sembraste son la referencia principal. Puedes consultar catálogos e imágenes como pistas.':'Your crop records are the primary reference. Use catalogues and satellite imagery as supporting clues.'}</p>
     <Suspense fallback={null}><CropReference point={point} en={lang==='en'}/></Suspense>
     <details className="b-technical"><summary>{lang==='es'?'Foto de referencia en tu dispositivo':'Reference photo on your device'}</summary><CropPhotoGuide en={lang==='en'}/></details>
     <button type="button" className="b-btn b-btn-light" disabled={historyBusy} onClick={loadImages}>{historyBusy?(lang==='es'?'Revisando imágenes…':'Reviewing imagery…'):(lang==='es'?'Consultar imágenes NASA HLS':'Check NASA HLS history')}</button>
     {historyError&&<p role="status">{historyError}</p>}
     {history&&<SatelliteEvidence months={history.months} polygon={field} lang={lang} sensor={history.sensor} monthsWithData={history.months_with_data} monthsTotal={history.months_total}/>}
    </details>
    <details className="chakra-zone-help chakra-farmer-extra"><summary>{lang==='es'?'Administrar zonas':'Manage areas'}</summary>
     <p>{lang==='es'?'Delimita únicamente las áreas sembradas con polígonos. El terreno exterior a esas áreas no cuenta como zona de cultivo.':'Outline planted areas as polygons. Land outside these polygons is not counted as a crop zone.'}</p>
     {subplots.map(z=><button type="button" className="b-btn b-btn-light" key={z.id} onClick={()=>deleteSubplot(z.id)}>{lang==='es'?'Quitar ':'Remove '}{z.id}</button>)}</details>
    <div className="b-next between" data-bio-target="bio-next">
     <button type="button" className="b-btn b-btn-light" onClick={()=>navigate(0)}>{t.back}</button>
     <button type="button" className="b-btn b-btn-light" onClick={saveFarm}>{lang==='es'?'Guardar avance':'Save progress'}</button>
     <button type="button" className="b-btn b-btn-primary" disabled={!availableZones.length} onClick={()=>{if(availableZones.some(z=>!zoneCrops[z.id])){setSpatialError(lang==='es'?'Registra un cultivo en cada zona antes de continuar.':'Record a crop for every area before continuing.');return}setSpatialError('');navigate(2)}}>{lang==='es'?'Continuar a mi plan':'Continue to my plan'}<Icon name="right"/></button></div>
    {spatialBusy&&slowServer&&<p role="status" className="chakra-strategy-status">{lang==='es'?'Despertando el servidor, ~30 s…':'Waking up the server, ~30 s…'}</p>}
    {spatialError&&<p className="b-error" role="alert">{spatialError}</p>}
    {savedNotice&&<p role="status">{savedNotice}</p>}
   </section>}
   {step===2&&!spatialPlan&&<section className="chakra-horizon" data-bio-target="bio-plan">
    <span className="b-eyebrow">{lang==='es'?'PASO 3 DE 3 · MI PLAN':'STEP 3 OF 3 · MY PLAN'}</span>
    <h1>{lang==='es'?'¿Para cuántos meses quieres preparar tu tierra?':'How many months ahead do you want to plan?'}</h1>
    <p>{lang==='es'?'Elige el tiempo para organizar las próximas siembras. Puedes cambiarlo sin volver a registrar tu terreno.':'Choose how long to organize your next plantings. You can change it without entering your field again.'}</p>
    <div className="chakra-horizon-buttons" role="group" aria-label={lang==='es'?'Duración del plan':'Planning period'}>
     {[6,12,24,36].map(value=><button type="button" key={value} aria-pressed={planningMonths===value} onClick={()=>setPlanningMonths(value)}>{value} {lang==='es'?'meses':'months'}</button>)}
    </div>
    <div className="chakra-horizon-range"><label htmlFor="chakra-months">{lang==='es'?'Personaliza la duración':'Customize the duration'}</label><strong>{planningMonths} {lang==='es'?'meses':'months'}</strong>
     <input id="chakra-months" type="range" min="3" max="60" step="1" value={planningMonths} onChange={e=>setPlanningMonths(Number(e.target.value))}/>
    </div>
    {spatialError&&<p role="alert" className="b-error">{spatialError}</p>}
    {spatialBusy&&<p role="status">{lang==='es'?'Preparando el plan con los datos disponibles…':'Preparing your plan using the available data…'}</p>}
    <div className="chakra-horizon-actions"><button type="button" className="b-btn b-btn-light" onClick={()=>navigate(1)}>{lang==='es'?'Volver a mis cultivos':'Back to my crops'}</button>
     <button type="button" className="b-btn b-btn-primary" disabled={spatialBusy} onClick={()=>void buildSpatialPlan()}>{lang==='es'?'Crear mi calendario':'Create my calendar'}<Icon name="right"/></button></div>
   </section>}
   {step===2&&spatialPlan&&field&&<ChakraZonePlan plan={spatialPlan} field={field} subplots={subplots}
    lang={lang} place={place} comparisons={result?.strategies as CompareStrategy[]|undefined} onPrint={()=>window.print()} onEdit={()=>navigate(1)}/>}
   {step===2&&spatialPlan&&<div className="chakra-horizon-actions"><button type="button" className="b-btn b-btn-light" onClick={()=>{setSpatialPlan(null);setResult(null)}}>{lang==='es'?'Cambiar los meses de mi plan':'Change my planning months'}</button></div>}
   {step===2&&precomputedAt&&<p role="note" className="chakra-strategy-scope">{lang==='es'?'Resultado precalculado del ejemplo de Barranca ('+precomputedAt.slice(0,10)+'): el servidor no respondió a tiempo. Son los mismos cálculos del motor CHAKRA.':'Precomputed result for the Barranca example ('+precomputedAt.slice(0,10)+'): the server did not answer in time. Same CHAKRA engine calculations.'}</p>}
   {step===2&&spatialPlan&&field&&<details className="chakra-more-science"><summary>{lang==='es'?'Compara otras maneras de cuidar el agua y la tierra':'Compare alternatives for water and soil'}</summary>{planningMonths!==24&&<p className="chakra-calendar-note">{lang==='es'?'Las tres estrategias de comparación siguen usando una ventana de referencia de 24 meses; tu calendario por zonas sí usa la duración que elegiste.':'The three comparison strategies retain their 24-month reference period; your zone calendar uses your chosen duration.'}</p>}<StrategyCompare strategies={(result?.strategies as CompareStrategy[]|undefined)||null} lang={lang}
    crop={id=>labelCrop(id,lang)} busy={compareBusy} error={compareError} outOfScope={!province} onRetry={()=>void compareZones()}
    maize={(result as unknown as {maize_low_river_share?:MaizeShare}|null)?.maize_low_river_share||null} upperBasin={result?.upper_basin_rain||null}/></details>}
   {step===2&&spatialPlan&&result?.ai_analysis&&<details className="chakra-more-science"><summary>{lang==='es'?'¿Qué observó la NASA en la parcela de estudio?':'What did NASA observe in our study field?'}</summary><FarmerAIEvidence ai={result.ai_analysis} lang={lang}/></details>}
   {step===3&&result&&<section className="b-result-page"><div className="b-intro b-result-intro"><span className="b-eyebrow">{lang==='es'?'TU RESULTADO · 04 / 04':'YOUR RESULT · 04 / 04'}</span><h1>{t.planTitle}</h1><p>{lang==='es'?'Aquí tienes un orden posible de cultivos y las razones para revisarlo. No es una indicación definitiva para sembrar.':'Here is a possible crop order and why it is worth reviewing. It is not a definitive planting instruction.'}</p></div>
    <div className="b-location-summary"><Icon name="pin"/><strong>{place}</strong><span>{t.area}: {area.toFixed(2)} {lang==='es'?'hectáreas':'hectares'}</span></div>
    {sampleNote&&<p className="b-demo-status">{lang==='es'?'Vista de demostración · Barranca':'Demonstration view · Barranca'}</p>}
    {result.status==='partial'&&<p className="b-note"><Icon name="info" size={18}/>{t.partial}</p>}
    <div className="b-result-reading-order" aria-label={lang==='es'?'Cómo leer tu propuesta':'How to read your plan'}><span><b>1</b>{lang==='es'?'Qué sembrar y cuándo':'What and when to plant'}</span><span><b>2</b>{lang==='es'?'Qué debes comprobar':'What to check'}</span><span><b>3</b>{lang==='es'?'Evidencia y otras opciones':'Evidence and alternatives'}</span></div>
{preferred?mainCard(preferred):<div className="b-card b-no-recommend"><Icon name="info"/><h2>{t.noRecommend}</h2><p>{t.unavailable}</p></div>}
    <FarmDecisionEvidence lang={lang} strategies={result.strategies} names={NAMES}
      context={result.official_evidence} soil={result.soil_assessment}
      irrigationKnown={waterAllowance.trim().length>0}
      report={economicReport} onBudget={setEconomicReport}/>
<FarmerAIEvidence ai={result.ai_analysis} lang={lang}/>
<div className="b-caution"><Icon name="alert" size={21}/><p>{t.warning}</p></div>
    {other.some(x=>(x.relative_to_current?.water_low_river_change_percent??0)>25)&&<p className="b-water-caution">{lang==='es'?'Hay otra opción que necesita bastante más agua en meses secos. Revisa esta diferencia antes de considerarla.':'Another option needs considerably more crop water in dry months. Review this difference before considering it.'}</p>}
    {other.length>0||original?<section className="b-compare-wrap"><button type="button" className="b-compare-trigger" aria-expanded={otherOpen} onClick={()=>setOtherOpen(v=>!v)}><span>{t.other}</span><span>{otherOpen?'−':'+'}</span></button>
      {otherOpen&&<div className="b-other-cards">{[...other,...(original?[original]:[])].map(s=><article className="b-card b-other" key={s.id}>
       <h3>{strategyName(s)}</h3><p>{cropsLine(s)}</p><div className="b-mini-kpis"><span className={(s.relative_to_current?.water_low_river_change_percent??0)>25?'b-water-high':''}>{t.keyWater}: {s.relative_to_current?showPct(s.relative_to_current.water_low_river_change_percent):(lang==='es'?'Actual':'Current')}</span><span>{t.keySoil}: {s.indicators.bare_months}/24</span></div>
       {s.plantings.length>0&&<details><summary>{t.planSchedule}</summary>{strip(s)}</details>}{technical(s)}
      </article>)}</div>}</section>:null}
    <div className="b-save-actions"><button type="button" className="b-btn b-btn-light" onClick={saveFarm}>{lang==='es'?'Guardar datos en mi celular':'Save on this device'}</button>
     <a className="b-btn b-btn-light" href={'https://wa.me/?text='+encodeURIComponent((lang==='es'?'Mi propuesta CHAKRA para ':'My CHAKRA plan for ')+place+': '+(preferred?cropsLine(preferred):'')+' · '+(result[lang==='es'?'recommendation_reason_es':'recommendation_reason_en']||'')+' · '+window.location.origin)} target="_blank" rel="noreferrer">{lang==='es'?'Compartir por WhatsApp':'Share on WhatsApp'}</a>
     {savedNotice&&<p role="status">{savedNotice}</p>}</div>
    <div className="b-report-actions"><button type="button" onClick={goPrint} className="b-btn b-btn-primary"><Icon name="print"/>{t.report}</button>
     <button type="button" onClick={()=>navigate(2)} className="b-btn b-btn-light"><Icon name="left"/>{t.startOver}</button></div>
   </section>}
  </main>
  <footer className="b-footer"><div><strong>CHAKRA X</strong></div><div className="b-footer-links"><a href="https://github.com/Wilder-reyes/TERRA360-AI/blob/main/docs/CHAKRA_NASA.md" target="_blank" rel="noreferrer">{lang==='es'?'Cómo usamos NASA':'How we use NASA'}</a><a href="/como-funciona" onClick={e=>{e.preventDefault();showPage('how')}}>{lang==='es'?'Cómo funciona':'How it works'}</a><a href="/fuentes" onClick={e=>{e.preventDefault();showPage('sources')}}>{lang==='es'?'Fuentes':'Sources'}</a><span>NASA Space Apps Challenge 2026 · Field Shift</span></div></footer>
  {printable()}
  {spatialPlan&&field&&<ChakraZonePrint plan={spatialPlan} field={field} subplots={subplots} lang={lang} place={place}/>}
 </div>
}
