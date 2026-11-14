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
