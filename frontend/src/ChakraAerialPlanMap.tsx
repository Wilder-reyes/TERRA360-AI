/** Cartographic context and declared zone geometry, not crop classification. */
import {useFieldFrame} from './useFieldFrame'
import {MapContainer,Polygon,TileLayer,Tooltip} from 'react-leaflet'
import type {GeoPolygon} from './rotationZones'
import type {ChakraParcel,ChakraSpatialPlan,ChakraZoneAdvice} from './ChakraZonePlan'
import {zoneLabel,displayMonth} from './ChakraRotationTimeline'
import {calendarState} from './calendarState'
import {cropVisual} from './chakraCropVisuals'
import CropGlyph,{ZoneMapLabel} from './CropGlyph'
const points=(p:GeoPolygon)=>p.coordinates[0].slice(0,-1).map(([lng,lat])=>[lat,lng] as [number,number])
function Frame({field}:{field:GeoPolygon}){useFieldFrame(points(field),0,0);return null}
function cropFor(row:ChakraZoneAdvice|undefined,month:string|undefined,es:boolean){
 if(!row)return {cropId:'',name:es?'Sin registro':'Not recorded',state:''}
 if(month)return calendarState(row,month,es)
 return {cropId:row.suggested_crop_id,name:es?row.suggested_crop:row.suggested_crop_en||row.suggested_crop,state:es?'Próxima siembra':'Next sowing'}
}
export default function ChakraAerialPlanMap({field,subplots,plan,month,lang}:{field:GeoPolygon;subplots:ChakraParcel[];plan:ChakraSpatialPlan;month?:string;lang:'es'|'en'}){
 const es=lang==='es',coordinates=points(field)
 const centre={lat:coordinates.reduce((a,p)=>a+p[0],0)/coordinates.length,lng:coordinates.reduce((a,p)=>a+p[1],0)/coordinates.length}
 const remainder=plan.zone_plans.find(r=>r.zone_id==='rest'),rem=cropFor(remainder,month,es)
 return <figure className="chakra-aerial-plan" aria-label={es?'Tu terreno en la fotografía aérea con cultivos por zonas':'Your field on the aerial imagery with crops by area'}>
  <div className="chakra-aerial-heading"><div><strong>{es?'Mi terreno desde arriba':'My field from above'}</strong><p>{es?'Cada zona conserva su contorno. Consulta su cultivo y estado en las tarjetas del mapa.':'Each area keeps its outline. Read its crop and status in the map cards.'}</p></div><span>{month?displayMonth(month,lang)+' '+month.slice(0,4):''}</span></div>
  <div className="chakra-aerial-frame"><MapContainer zoomSnap={0.25} maxZoom={21} key={JSON.stringify(field)} center={[centre.lat,centre.lng]} zoom={14} className="chakra-aerial-map" scrollWheelZoom={false}>
   <TileLayer maxNativeZoom={17} maxZoom={21} attribution="Imagery © Esri, Maxar, Earthstar Geographics" url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"/>
   <Frame field={field}/>
   <Polygon positions={coordinates} pathOptions={{color:'#D6F866',weight:5,fillColor:cropVisual(rem.cropId).color,fillOpacity:remainder?.3:0}}>
    {remainder&&!subplots.length&&<Tooltip permanent direction="center" className="chakra-crop-map-label"><ZoneMapLabel zone={zoneLabel('rest',es,0)} cropId={rem.cropId} cropName={rem.name} state={rem.state}/></Tooltip>}
   </Polygon>
   {subplots.map((zone,i)=>{const v=cropFor(plan.zone_plans.find(r=>r.zone_id===zone.id),month,es);return <Polygon key={zone.id} positions={points(zone.polygon)} pathOptions={{color:'#fff',weight:3,fillColor:v.cropId?cropVisual(v.cropId).color:'#77847a',fillOpacity:.7}}><Tooltip permanent direction="center" className="chakra-crop-map-label"><ZoneMapLabel zone={zoneLabel(zone.id,es,i)} cropId={v.cropId} cropName={v.name} state={v.state}/></Tooltip></Polygon>})}
  </MapContainer></div>
  <figcaption><p>{es?'El contorno muestra el terreno que seleccionaste. Los estados de crecimiento son estimaciones.':'The outline is your selected field. Growth stages are estimates.'}</p><ul className="chakra-map-zone-key">{plan.zone_plans.map((row,i)=>{const v=cropFor(row,month,es);return <li key={row.zone_id}><CropGlyph id={v.cropId} size={34}/><div><strong>{zoneLabel(row.zone_id,es,i)}</strong><span>{v.name}</span><small>{v.state}</small></div></li>})}</ul></figcaption>
 </figure>
}
