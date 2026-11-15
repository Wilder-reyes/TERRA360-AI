/** Print-safe vector sketch of the user-selected parcel, not imagery. */
import {CROPS,NAMES,type CropId} from './andesProfile'
import {printableGeometry,proposedCrop,type CampaignPolygon,type CampaignParcel,type CampaignCrop} from './campaignPlan'

type Props={field:CampaignPolygon;subplots:CampaignParcel[];yearIndex:number;year:number;
 schedule:CampaignCrop[];overrides:Record<string,CropId>;lang:'es'|'en'}
export default function CampaignVectorMap({field,subplots,yearIndex,year,schedule,overrides,lang}:Props){
 const geometry=printableGeometry(field,subplots)
 const es=lang==='es'
 const used=new Set(subplots.map(p=>proposedCrop(p.id,yearIndex,schedule,overrides)).filter(Boolean))
 return <figure className="c-print-map">
  <figcaption><strong>{es?'Campaña':'Campaign'} {year}</strong><small>{es?'Croquis geográfico aproximado · asignación propuesta':'Approximate geographic sketch · proposed allocation'}</small></figcaption>
  <svg viewBox="0 0 600 340" role="img" aria-label={es?'Contorno del terreno y subparcelas propuestas':'Field boundary and proposed subplots'}>
   <title>{es?'Distribución propuesta de cultivos':'Proposed crop layout'} · {year}</title>
   <rect width="600" height="340" fill="#F6F9F5"/>
   <polygon points={geometry.field} fill="#E4EFE4" stroke="#29543C" strokeWidth="4" strokeLinejoin="round"/>
   {subplots.map((p,i)=>{
    const crop=proposedCrop(p.id,yearIndex,schedule,overrides)
    return <polygon key={p.id} points={geometry.subplots[i]} fill={crop?NAMES[crop]?.color:'#BDCABE'}
      fillOpacity=".82" stroke="#24402F" strokeWidth="2.4" strokeLinejoin="round">
      <title>{p.id} · {crop?(es?NAMES[crop].es:NAMES[crop].en):(es?'Sin asignación':'Unassigned')}</title>
    </polygon>
   })}
   <text x="554" y="25" fontSize="18" fill="#24402F">N ↑</text>
  </svg>
  <div className="c-print-map-legend">
   {CROPS.filter(x=>used.has(x.id)).map(c=><span key={c.id}><i style={{background:c.color}}/>{es?c.es:c.en}</span>)}
  </div>
 </figure>
}
