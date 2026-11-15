import type {GeoPolygon} from './rotationZones'
type Shape=GeoPolygon
export type CropId='papa'|'arveja'|'haba'|'quinua'|'cebada'|'avena'
export const LOC={lat:-12.04700155,lng:-75.36633862}
export const CROPS:{id:CropId;es:string;en:string;family:string;color:string}[]=[
 {id:'papa',es:'Papa',en:'Potato',family:'Solanaceae',color:'#c9895c'},
 {id:'arveja',es:'Arveja',en:'Pea',family:'Fabaceae',color:'#57976d'},
 {id:'haba',es:'Haba',en:'Fava bean',family:'Fabaceae',color:'#367c5a'},
 {id:'quinua',es:'Quinua',en:'Quinoa',family:'Amaranthaceae',color:'#aa8b60'},
 {id:'cebada',es:'Cebada',en:'Barley',family:'Poaceae',color:'#d2b36b'},
 {id:'avena',es:'Avena',en:'Oats',family:'Poaceae',color:'#699ab1'}
]
export const NAMES=Object.fromEntries(CROPS.map(x=>[x.id,x]))
export const study='https://cdn.www.gob.pe/uploads/document/file/5501553/4903730-estudio-agrologico.pdf?v=1701297728'
export const inia='https://repositorio.inia.gob.pe/bitstream/20.500.12955/1146/1/MANUAL%20T%C3%89CNICO%20-%20MANEJO%20INTEGRADO%20DEL%20CULTIVO%20DE%20PAPA.pdf'
const halfLat=.00058,halfLng=.00078
// Fictional rectangular sketch around the statistical-sector reference point.
// NEVER state this is a real field or known farmer's property.
export const MANTARO_DEMO=rectangle(LOC.lat-halfLat,LOC.lng-halfLng,LOC.lat+halfLat,LOC.lng+halfLng)
export const demoParcels=[
 {id:'A',polygon:rectangle(LOC.lat-halfLat,LOC.lng-halfLng,LOC.lat+halfLat,LOC.lng)},
 {id:'B',polygon:rectangle(LOC.lat-halfLat,LOC.lng,LOC.lat+halfLat,LOC.lng+halfLng)}
]
function rectangle(south:number,west:number,north:number,east:number):Shape{
 return {type:'Polygon',coordinates:[[[west,south],[east,south],[east,north],[west,north],[west,south]]]}
}
