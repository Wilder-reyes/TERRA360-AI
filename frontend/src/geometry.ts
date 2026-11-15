/** Approximate WGS84 spherical area and topology checks for user-drawn geometry.
 * Geometry is illustrative, never a cadastral survey. Prevent crossings and
 * very large/wrapped shapes. It is not a geodesic boundary survey or legal area.
 */
export type GeoPoint={lat:number;lng:number}
const RAD=Math.PI/180
const EARTH_RADIUS_M=6371008.8

function pointOK(p:GeoPoint):boolean {
  return Number.isFinite(p.lat)&&Number.isFinite(p.lng)&&Math.abs(p.lat)<=90&&Math.abs(p.lng)<=180
}

export function approximatePolygonHectares(points:GeoPoint[]):number {
  if(points.length<3||!points.every(pointOK))return 0
  let sum=0
  for(let i=0;i<points.length;i++){
    const a=points[i],b=points[(i+1)%points.length]
    sum+=(b.lng-a.lng)*RAD*(2+Math.sin(a.lat*RAD)+Math.sin(b.lat*RAD))
  }
  return Math.abs(sum)*EARTH_RADIUS_M**2/2/10000
}

function orient(a:GeoPoint,b:GeoPoint,c:GeoPoint):number {
  return (b.lng-a.lng)*(c.lat-a.lat)-(b.lat-a.lat)*(c.lng-a.lng)
}
function onSeg(a:GeoPoint,b:GeoPoint,c:GeoPoint):boolean {
  return c.lng>=Math.min(a.lng,b.lng)&&c.lng<=Math.max(a.lng,b.lng)&&
         c.lat>=Math.min(a.lat,b.lat)&&c.lat<=Math.max(a.lat,b.lat)
}
function intersects(a:GeoPoint,b:GeoPoint,c:GeoPoint,d:GeoPoint):boolean {
  const o1=orient(a,b,c),o2=orient(a,b,d),o3=orient(c,d,a),o4=orient(c,d,b)
  if((o1>0)!==(o2>0)&&(o3>0)!==(o4>0))return true
  return (o1===0&&onSeg(a,b,c))||(o2===0&&onSeg(a,b,d))||
         (o3===0&&onSeg(c,d,a))||(o4===0&&onSeg(c,d,b))
}
export function validatePolygon(points:GeoPoint[]):{valid:boolean;reason:string} {
  if(points.length<3||points.length>100)return {valid:false,reason:'vertex_count'}
  if(!points.every(pointOK))return {valid:false,reason:'coordinates'}
  const longitudeSpan=Math.max(...points.map(p=>p.lng))-Math.min(...points.map(p=>p.lng))
  const latitudeSpan=Math.max(...points.map(p=>p.lat))-Math.min(...points.map(p=>p.lat))
  // Avoid ambiguous antimeridian crossings and globe-spanning shapes.
  if(longitudeSpan>5||latitudeSpan>5)return {valid:false,reason:'area_too_large'}
  for(let i=0;i<points.length;i++){
    const a=points[i],b=points[(i+1)%points.length]
    if(a.lat===b.lat&&a.lng===b.lng)return {valid:false,reason:'duplicate_vertices'}
  }
  for(let i=0;i<points.length;i++){
    const a=points[i],b=points[(i+1)%points.length]
    for(let j=i+1;j<points.length;j++){
      if(j===i+1||(i===0&&j===points.length-1))continue
      if(intersects(a,b,points[j],points[(j+1)%points.length]))
        return {valid:false,reason:'self_intersection'}
    }
  }
  const area=approximatePolygonHectares(points)
  if(!Number.isFinite(area)||area<0.000001)return {valid:false,reason:'too_small'}
  return {valid:true,reason:'ok'}
}

/** Import a single unambiguous outer ring; never discard malformed vertices or holes. */
export function parseGeoJSONPolygon(text:string):{type:'Polygon';coordinates:number[][][]}|null{
 try{
  let value=JSON.parse(text)
  if(value?.type==='FeatureCollection'){
   if(!Array.isArray(value.features)||value.features.length!==1)return null
   value=value.features[0]
  }
  if(value?.type==='Feature')value=value.geometry
  if(value?.type==='MultiPolygon'){
   if(!Array.isArray(value.coordinates)||value.coordinates.length!==1)return null
   value={type:'Polygon',coordinates:value.coordinates[0]}
  }
  if(value?.type!=='Polygon'||!Array.isArray(value.coordinates)||value.coordinates.length!==1)return null
  const ring=value.coordinates[0]
  if(!Array.isArray(ring)||ring.length<3||ring.some((p:unknown)=>!Array.isArray(p)||p.length<2||!p.every(n=>typeof n==='number'&&Number.isFinite(n))))return null
  const clean:number[][]=ring.map((p:number[])=>[p[0],p[1]])
  if(clean[0][0]!==clean[clean.length-1][0]||clean[0][1]!==clean[clean.length-1][1])clean.push([...clean[0]])
  const points=clean.slice(0,-1).map(([lng,lat])=>({lat,lng}))
  if(!validatePolygon(points).valid)return null
  return {type:'Polygon',coordinates:[clean]}
 }catch{return null}
}

/** Validation of user-defined subplots using local planar topology for small parcels.
 * Shared edges are allowed. Strict interior overlap and crossings are rejected.
 * This is a geometry check, never a cadastral or agronomic validation.
 */
function strictlyCross(a:GeoPoint,b:GeoPoint,c:GeoPoint,d:GeoPoint):boolean{
 const o1=orient(a,b,c),o2=orient(a,b,d),o3=orient(c,d,a),o4=orient(c,d,b)
 return ((o1>0&&o2<0)||(o1<0&&o2>0))&&((o3>0&&o4<0)||(o3<0&&o4>0))
}
function pointOnBoundary(p:GeoPoint,ring:GeoPoint[]):boolean{
 const eps=1e-11
 return ring.some((a,i)=>{
  const b=ring[(i+1)%ring.length]
  return Math.abs(orient(a,b,p))<eps&&onSeg(a,b,p)
 })
}
function pointInside(p:GeoPoint,ring:GeoPoint[],includeBoundary=true):boolean{
 if(pointOnBoundary(p,ring))return includeBoundary
 let inside=false
 for(let i=0,j=ring.length-1;i<ring.length;j=i++){
  const a=ring[i],b=ring[j]
  if(((a.lat>p.lat)!==(b.lat>p.lat))&&p.lng<(b.lng-a.lng)*(p.lat-a.lat)/(b.lat-a.lat)+a.lng)inside=!inside
 }
 return inside
}
function crossings(a:GeoPoint[],b:GeoPoint[]):boolean{
 return a.some((p,i)=>b.some((q,j)=>strictlyCross(p,a[(i+1)%a.length],q,b[(j+1)%b.length])))
}
function polygonContained(inner:GeoPoint[],outer:GeoPoint[]):boolean{
 return inner.every(p=>pointInside(p,outer))&&!crossings(inner,outer)&&
  inner.every((p,i)=>pointInside({lat:(p.lat+inner[(i+1)%inner.length].lat)/2,
   lng:(p.lng+inner[(i+1)%inner.length].lng)/2},outer))
}
function polygonsOverlap(a:GeoPoint[],b:GeoPoint[]):boolean{
 const average=(ring:GeoPoint[])=>({lat:ring.reduce((t,p)=>t+p.lat,0)/ring.length,lng:ring.reduce((t,p)=>t+p.lng,0)/ring.length})
 return crossings(a,b)||a.some(p=>pointInside(p,b,false))||b.some(p=>pointInside(p,a,false))||
  (pointInside(average(a),a,false)&&pointInside(average(a),b,false))||
  (pointInside(average(b),b,false)&&pointInside(average(b),a,false))
}
export function validateSubplotLayout(field:GeoPoint[],subplots:{id:string;points:GeoPoint[]}[]):{valid:boolean;reason:string}{
 if(!validatePolygon(field).valid)return {valid:false,reason:'invalid_field'}
 if(subplots.length>32)return {valid:false,reason:'too_many_subplots'}
 const ids=new Set<string>()
 for(let i=0;i<subplots.length;i++){
  const s=subplots[i]
  if(typeof s.id!=='string'||!s.id.trim()||ids.has(s.id))return {valid:false,reason:'duplicate_id'}
  ids.add(s.id)
  if(!validatePolygon(s.points).valid||approximatePolygonHectares(s.points)<.01)return {valid:false,reason:'invalid_subplot'}
  if(!polygonContained(s.points,field))return {valid:false,reason:'outside_field'}
  for(let j=0;j<i;j++)if(polygonsOverlap(s.points,subplots[j].points))return {valid:false,reason:'overlap'}
 }
 return {valid:true,reason:'ok'}
}
