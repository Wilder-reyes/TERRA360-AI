import {cropVisual} from './chakraCropVisuals'

/** Shared botanical pictograms: bean varieties remain visually distinct. */
export default function CropGlyph({id,size=28}:{id?:string|null;size?:number}){
 const custom=['frijol_grano_seco','frijol_castilla','pallar'].includes(id||'')
 if(!custom)return <span className="crop-glyph" data-crop-glyph={id||'unknown'} aria-hidden="true" style={{fontSize:size,lineHeight:1}}>{cropVisual(id).icon}</span>
 return <svg className="crop-glyph" data-crop-glyph={id} width={size} height={size} viewBox="0 0 64 64" aria-hidden="true">
  {id==='frijol_grano_seco'?<><path d="M45 9C24-3 3 27 12 47c7 18 30 13 30-1 0-10-15-9-9-18 4-6 23-9 12-19Z" fill="#E7C04F" stroke="#785219" strokeWidth="3"/><path d="M27 29c-8 9-5 15 3 18" fill="none" stroke="#FFF2B3" strokeWidth="5" strokeLinecap="round"/></>:
   id==='frijol_castilla'?<><ellipse cx="31" cy="34" rx="23" ry="18" transform="rotate(-27 31 34)" fill="#F1E2B9" stroke="#8B7047" strokeWidth="3"/><ellipse cx="33" cy="32" rx="9" ry="8" transform="rotate(-27 33 32)" fill="#34241D"/><path d="m30 30 5 4" stroke="#E1BC8A" strokeWidth="3" strokeLinecap="round"/></>:
   <><path d="M10 22C22 4 52 6 56 26c7 27-36 39-46 17-3-7 4-10 0-21Z" fill="#DDE6AD" stroke="#5D7948" strokeWidth="3"/><path d="M26 23c-7 9-3 20 8 22" fill="none" stroke="#77945A" strokeWidth="4" strokeLinecap="round"/><path d="m30 26 7 12" stroke="#FCFFE3" strokeWidth="4" strokeLinecap="round"/></>}
 </svg>
}

export function ZoneMapLabel({zone,cropId,cropName,state}:{zone:string;cropId?:string|null;cropName:string;state?:string}){
 return <span className="chakra-map-badge"><CropGlyph id={cropId} size={27}/><span className="chakra-map-badge-copy"><strong>{zone}</strong><span className="chakra-map-badge-crop">{cropName}</span>{state&&<small className="chakra-map-badge-state">{state}</small>}</span></span>
}
