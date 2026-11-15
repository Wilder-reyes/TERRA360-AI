// AI-assisted: written with Claude Code (Anthropic) and reviewed by the TERRA360 team.
/** Demo zones and example fields for the rotation comparator.
 *
 * Zone centroids: MIDAGRI Padrón Nacional de Sectores Estadísticos 2024 (same
 * source for both). They are navigation references, NOT parcels.
 *
 * Example fields: the TEAM will replace/add the 4 hand-drawn fields
 * (huaral-1, huaral-2, barranca-1, barranca-2) in TEAM_FIELDS. Until then the
 * "technical test" fields below were found automatically as ~2 ha blocks whose
 * HLS NDVI alternates between green and bare (short-cycle crops). They do not
 * belong to an identified farmer.
 */
export type ZoneId='huaral'|'barranca'
export type GeoPolygon={type:'Polygon';coordinates:number[][][]}
export type ExampleField={id:string;zone:ZoneId;label_es:string;label_en:string;note_es:string;note_en:string;polygon:GeoPolygon}

export const ZONES:Record<ZoneId,{name:string;valley:string;sector:string;code:string;lat:number;lng:number;agriHa:number}>={
 huaral:{name:'Huaral',valley:'Chancay-Huaral',sector:'Huando',code:'15060105',lat:-11.47918514,lng:-77.18041962,agriHa:1434.31},
 barranca:{name:'Barranca',valley:'Pativilca / Supe',sector:'Chacarita',code:'15020105',lat:-10.73888977,lng:-77.72982679,agriHa:1533.61},
}
export const PADRON_URL='https://siea.midagri.gob.pe/portal/media/attachments/publicaciones/superficie/sectores/2024/Padron_Nacional_SE_2024_0403.pdf'

import fields from './exampleFields.json'

const TEST_NOTE_ES='Terreno de prueba técnica: bloque de ~2 ha encontrado automáticamente porque su verdor (HLS) cambia entre fechas. No corresponde a un agricultor identificado.'
const TEST_NOTE_EN='Technical test field: ~2 ha block found automatically because its greenness (HLS) changes between dates. It does not belong to an identified farmer.'
const TEAM_NOTE_ES='Terreno representativo identificado en imagen; no corresponde a un agricultor identificado.'
const TEAM_NOTE_EN='Representative field identified on imagery; it does not belong to an identified farmer.'
type RawField={id:string;zone:string;label_es:string;label_en:string;polygon:{type:string;coordinates:number[][][]}}
const load=(list:RawField[],es:string,en:string):ExampleField[]=>list.filter(f=>f.zone==='huaral'||f.zone==='barranca').map(f=>({id:f.id,zone:f.zone as ZoneId,label_es:f.label_es,label_en:f.label_en,note_es:es,note_en:en,polygon:{type:'Polygon',coordinates:f.polygon.coordinates}}))

/** Team-drawn fields (edit exampleFields.json). */
export const TEAM_FIELDS:ExampleField[]=load(fields.team_fields as RawField[],TEAM_NOTE_ES,TEAM_NOTE_EN)
export const TEST_FIELDS:ExampleField[]=load(fields.test_fields as RawField[],TEST_NOTE_ES,TEST_NOTE_EN)
export {parseGeoJSONPolygon} from './geometry'
