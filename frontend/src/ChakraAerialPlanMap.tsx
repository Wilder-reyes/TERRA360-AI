/** Full satellite/aerial context behind the real field outline and suggested crops.
 * The Barranca ML model stays limited to its research polygon; the imagery here
 * is cartographic, not a crop-classification output.
 */
import {useFieldFrame} from './useFieldFrame'
import {MapContainer,Polygon,TileLayer,Tooltip} from 'react-leaflet'
import type {GeoPolygon} from './rotationZones'
import type {ChakraParcel,ChakraSpatialPlan,ChakraZoneAdvice} from './ChakraZonePlan'
import {campaignAt,zoneLabel,displayMonth} from './ChakraRotationTimeline'
import {cropVisual} from './chakraCropVisuals'
const points=(p:GeoPolygon)=>p.coordinates[0].slice(0,-1).map(([lng,lat])=>[lat,lng] as [number,number])
function Frame({field}:{field:GeoPolygon}){
 useFieldFrame(points(field),0,0)
 return null
}
function cropFor(row:ChakraZoneAdvice|undefined,month:string|undefined,lang:'es'|'en'){
 if(!row)return {color:'#92a58c',label:lang==='es'?'Sin registro':'Not recorded',icon:'🌱'}
 const c=month?campaignAt(row,month):undefined
 if(c){const v=cropVisual(c.crop_id);return {color:v.color,label:lang==='es'?c.crop_es:c.crop_en,icon:v.icon}}
 const v=cropVisual(row.current_crop_id)
 return {color:v.color,label:(lang==='es'?'Antes: ':'Previously: ')+(lang==='es'?row.current_crop:row.current_crop_en||row.current_crop),icon:v.icon}
}
export default function ChakraAerialPlanMap({field,subplots,plan,month,lang}:{
 field:GeoPolygon;subplots:ChakraParcel[];plan:ChakraSpatialPlan;month?:string;lang:'es'|'en'
}){
 const es=lang==='es'
 const coordinates=points(field),centre={lat:coordinates.reduce((a,p)=>a+p[0],0)/coordinates.length,lng:coordinates.reduce((a,p)=>a+p[1],0)/coordinates.length}
 const remainder=plan.zone_plans.find(r=>r.zone_id==='rest')
 const rem=cropFor(remainder,month,lang)
 return <figure className="chakra-aerial-plan" aria-label={es?'Tu terreno en la fotografía aérea con cultivos por zonas':'Your field on the aerial imagery with crops by area'}>
  <div className="chakra-aerial-heading">
   <div><strong>{es?'Mi terreno desde arriba':'My field from above'}</strong>
    <p>{es?'La misma parcela, con colores para distinguir los cultivos de cada zona.':'The same field, color-coded by the crops in each area.'}</p></div>
   <span>{month?displayMonth(month,lang)+' '+month.slice(0,4):''}</span>
  </div>
  <div className="chakra-aerial-frame">
   <MapContainer zoomSnap={0.25} maxZoom={21} key={field.coordinates[0].map(p=>p.join(',')).join(';')} center={[centre.lat,centre.lng]} zoom={14} className="chakra-aerial-map" scrollWheelZoom={false}>
    <TileLayer maxNativeZoom={17} maxZoom={21} attribution="Imagery © Esri, Maxar, Earthstar Geographics" url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"/>
    <Frame field={field}/>
    <Polygon positions={coordinates} pathOptions={{color:'#D6F866',weight:5,fillColor:rem.color,fillOpacity:remainder?.2:0}}>
     {remainder&&subplots.length===0&&<Tooltip permanent direction="center" className="chakra-crop-map-label">{rem.icon} {rem.label}</Tooltip>}
    </Polygon>
    {subplots.map((zone,i)=>{
     const row=plan.zone_plans.find(r=>r.zone_id===zone.id),v=cropFor(row,month,lang)
     return <Polygon key={zone.id} positions={points(zone.polygon)} pathOptions={{color:'#fff',weight:3,fillColor:v.color,fillOpacity:.71}}>
      <Tooltip permanent direction="center" className="chakra-crop-map-label">{zoneLabel(zone.id,es,i)} · {v.icon} {v.label}</Tooltip>
     </Polygon>
    })}
   </MapContainer>
  </div>
  <figcaption>{es?'El contorno muestra el terreno que seleccionaste.':'The outline is the field you selected.'}</figcaption>
 </figure>
}
