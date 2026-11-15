import history from './data/barrancaHls.json'
import {TEAM_FIELDS,type GeoPolygon} from './rotationZones'
export const BARRANCA_FIELD=TEAM_FIELDS.find(f=>f.id==='barranca-1')!
export const BARRANCA_HISTORY=history
export function isStudyParcel(polygon:GeoPolygon|null):boolean{
 return polygon!==null&&JSON.stringify(polygon.coordinates)===JSON.stringify(BARRANCA_FIELD.polygon.coordinates)
}
export {vegetationBand} from './vegetationIndex'
