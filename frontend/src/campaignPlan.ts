/** One source of truth for spatial campaign allocations in screen and print.
 * Proposals are farmer editable; NOTHING here identifies crops from imagery.
 */
import type {CropId} from './andesProfile'
export type CampaignPolygon={type:'Polygon';coordinates:number[][][]}
export type CampaignParcel={id:string;polygon:CampaignPolygon}
export type CampaignCrop={crop_id:CropId}

export function proposedCrop(parcelId:string,yearIndex:number,schedule:readonly CampaignCrop[],
                             overrides:Record<string,CropId>):CropId|null {
 if(!Number.isInteger(yearIndex)||yearIndex<0||yearIndex>=schedule.length)return null
 return overrides[parcelId+':'+yearIndex] ?? schedule[yearIndex]?.crop_id ?? null
}

export function approximateHectares(shape:CampaignPolygon):number {
 const ring=shape.coordinates[0]||[]
 if(ring.length<4)return 0
 const avgLat=ring.reduce((sum,p)=>sum+p[1],0)/ring.length
 const metersLon=111320*Math.cos(avgLat*Math.PI/180)
 const metersLat=111132
 let twice=0
 for(let i=0;i<ring.length-1;i++)twice+=(ring[i][0]*metersLon)*(ring[i+1][1]*metersLat)-(ring[i+1][0]*metersLon)*(ring[i][1]*metersLat)
 return Math.abs(twice)/2/10000
}

export function campaignAreaSummary(parcels:readonly CampaignParcel[],yearIndex:number,
                                    schedule:readonly CampaignCrop[],overrides:Record<string,CropId>) {
 const grouped:Record<string,number>={}
 for(const parcel of parcels){
  const crop=proposedCrop(parcel.id,yearIndex,schedule,overrides)
  if(crop)grouped[crop]=(grouped[crop]||0)+approximateHectares(parcel.polygon)
 }
 return Object.entries(grouped).map(([crop_id,area_ha])=>({crop_id:crop_id as CropId,area_ha}))
}

/** Aspect-preserving projection for an SVG SCHEMATIC, not a satellite image. */
export function printableGeometry(field:CampaignPolygon,subplots:readonly CampaignParcel[],width=600,height=340){
 const rings=[field,...subplots.map(s=>s.polygon)].map(shape=>shape.coordinates[0]||[])
 const first=rings[0]
 if(first.length<4)return {field:'',subplots:[] as string[]}
 const lat=first.reduce((s,p)=>s+p[1],0)/first.length
 const cos=Math.max(.01,Math.cos(lat*Math.PI/180))
 const xs=first.map(p=>p[0]*cos),ys=first.map(p=>p[1])
 const minX=Math.min(...xs),maxX=Math.max(...xs),minY=Math.min(...ys),maxY=Math.max(...ys)
 const scale=Math.min((width-40)/Math.max(1e-10,maxX-minX),(height-40)/Math.max(1e-10,maxY-minY))
 const xPad=(width-(maxX-minX)*scale)/2,yPad=(height-(maxY-minY)*scale)/2
 const plot=(ring:number[][])=>ring.map(([lon,latitude])=>[
   xPad+(lon*cos-minX)*scale, height-(yPad+(latitude-minY)*scale)
 ].map(v=>v.toFixed(2)).join(',')).join(' ')
 return {field:plot(first),subplots:rings.slice(1).map(plot)}
}
