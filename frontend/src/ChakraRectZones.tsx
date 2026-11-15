/** Editable field zones: editable polygons with movable centre and draggable vertices.
 * These are farmer-drawn geometry, not cadastral surveys. Reject invalid
 * shapes rather than silently changing or cropping their boundaries.
 */
import L from 'leaflet'
import {Marker} from 'react-leaflet'
import type {GeoPolygon} from './rotationZones'
import {validateSubplotLayout} from './geometry'

type Point={lat:number;lng:number}
export type EditableZone={id:string;polygon:GeoPolygon}
const pts=(p:GeoPolygon):Point[]=>p.coordinates[0].slice(0,-1).map(([lng,lat])=>({lat,lng}))
const poly=(p:Point[]):GeoPolygon=>({type:'Polygon',coordinates:[[...p.map(v=>[v.lng,v.lat]),[p[0].lng,p[0].lat]]]})
const rect=(left:number,bottom:number,right:number,top:number):GeoPolygon=>
 poly([{lng:left,lat:bottom},{lng:right,lat:bottom},{lng:right,lat:top},{lng:left,lat:top}])
export function zoneCenter(z:GeoPolygon):Point{
 const ps=pts(z);return {lat:ps.reduce((s,p)=>s+p.lat,0)/ps.length,lng:ps.reduce((s,p)=>s+p.lng,0)/ps.length}
}
function bounds(points:Point[]){return {
 minLat:Math.min(...points.map(p=>p.lat)),maxLat:Math.max(...points.map(p=>p.lat)),
 minLng:Math.min(...points.map(p=>p.lng)),maxLng:Math.max(...points.map(p=>p.lng))
}}
export function safeRectangleMove(field:GeoPolygon,others:EditableZone[],id:string,candidate:GeoPolygon):boolean{
 return validateSubplotLayout(pts(field),[...others.filter(z=>z.id!==id),{id,polygon:candidate}].map(z=>({id:z.id,points:pts(z.polygon)}))).valid
}
export function moveZone(field:GeoPolygon,all:EditableZone[],id:string,to:Point):GeoPolygon|null{
 const old=all.find(z=>z.id===id);if(!old)return null
 const before=zoneCenter(old.polygon),dx=to.lng-before.lng,dy=to.lat-before.lat
 const candidate=poly(pts(old.polygon).map(v=>({lng:v.lng+dx,lat:v.lat+dy})))
 return safeRectangleMove(field,all,id,candidate)?candidate:null
}
export function resizeZone(field:GeoPolygon,all:EditableZone[],id:string,corner:number,to:Point):GeoPolygon|null{
 const old=all.find(z=>z.id===id);if(!old)return null
 const ps=pts(old.polygon)
 if(ps.length<3||corner<0||corner>=ps.length)return null
 const edited=ps.map((p,i)=>i===corner?to:p)
 const candidate=poly(edited)
 return safeRectangleMove(field,all,id,candidate)?candidate:null
}
/** Find two non-overlapping editable rectangles inside a selected polygon.
 * For very thin/concave fields, gracefully return fewer zones, not invalid data.
 */
export function suggestedZones(field:GeoPolygon,existing:EditableZone[],count=3):EditableZone[]{
 const area=bounds(pts(field)),w=area.maxLng-area.minLng,h=area.maxLat-area.minLat
 if(w<=0||h<=0)return []
 const result=[...existing],added:EditableZone[]=[]
 const centers:[[number,number],...Array<[number,number]>]=[[.32,.38],[.67,.62],[.32,.67],[.67,.32],[.5,.5],[.20,.5],[.80,.5],[.5,.2],[.5,.8]]
 let suffix=1+Math.max(0,...existing.map(z=>Number(z.id.match(/(\d+)$/)?.[1])||0))
 for(const [fx,fy] of centers){
  if(added.length>=count)break
  for(const size of [.22,.16,.11,.07,.04,.025]){
   const x=area.minLng+w*fx,y=area.minLat+h*fy,halfW=w*size/2,halfH=h*size/2
   const z:EditableZone={id:'Subparcela '+suffix,polygon:rect(x-halfW,y-halfH,x+halfW,y+halfH)}
   if(safeRectangleMove(field,result,z.id,z.polygon)){
    added.push(z);result.push(z);suffix++;break
   }
  }
 }
 return added
}
export function polygonCorners(z:GeoPolygon):Point[]{return pts(z)}
const handleIcon=(main:boolean)=>L.divIcon({className:main?'chakra-zone-move-icon':'chakra-zone-resize-icon',
 html:main?'<span aria-hidden="true">✥</span>':'<span aria-hidden="true"></span>',
 iconSize:main?[44,44]:[36,36],iconAnchor:main?[22,22]:[18,18]})
export function ChakraZoneHandles({field,zones,selected,onMove,onInvalid}:{
 field:GeoPolygon;zones:EditableZone[];selected:string;
 onMove:(id:string,polygon:GeoPolygon)=>void;onInvalid:(message:string)=>void
}){
 // Keep the first editable rectangle visible even while the remaining area is selected.
 const current=zones.find(z=>z.id===selected)||zones[0]
 if(!current)return null
 const center=zoneCenter(current.polygon),corners=rectangleCorners(current.polygon)
 const end=(kind:'move'|'resize',index:number)=>(event:{target:{getLatLng:()=>Point}})=>{
  const to=event.target.getLatLng()
  const candidate=kind==='move'?moveZone(field,zones,current.id,to):resizeZone(field,zones,current.id,index,to)
  if(candidate)onMove(current.id,candidate)
  else onInvalid('Esa zona debe permanecer dentro de tu terreno y sin cruzarse con otra.')
 }
 return <>
  <Marker key={selected+'-move-'+JSON.stringify(center)} position={[center.lat,center.lng]} draggable icon={handleIcon(true)}
   eventHandlers={{dragend:end('move',0)}} title="Mover zona"/>
  {corners.length>=3&&corners.map((p,i)=><Marker key={selected+'-corner-'+i+'-'+p.lat+'-'+p.lng}
   position={[p.lat,p.lng]} draggable icon={handleIcon(false)} eventHandlers={{dragend:end('resize',i)}}
   title={'Ajustar esquina '+(i+1)}/>)}
 </>
}
