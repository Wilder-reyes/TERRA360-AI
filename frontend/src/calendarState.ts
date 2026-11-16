import type {ChakraZoneAdvice} from './ChakraZonePlan'
import cycles from './currentCropCycles.json' with {type:'json'}

export function currentCampaign(zone:ChakraZoneAdvice){
 const start=zone.last_planting_month
 const days=(cycles as Record<string,number>)[zone.current_crop_id]
 if(!start||!/^\d{4}-(0[1-9]|1[0-2])$/.test(start)||!days)return null
 const end=new Date(Date.parse(start+'-01T00:00:00Z')+days*86400000)
 // Include a partly occupied final month; the UI explicitly labels this an estimate.
 if(end.getUTCDate()>1)end.setUTCMonth(end.getUTCMonth()+1,1)
 return {crop_id:zone.current_crop_id,crop_es:zone.current_crop,crop_en:zone.current_crop_en||zone.current_crop,sow_month:start,end_month:end.toISOString().slice(0,7),source:'farmer_declared_catalog_duration'}
}
export function calendarState(zone:ChakraZoneAdvice,month:string,es=true){
 const next=zone.campaigns?.find(c=>c.sow_month<=month&&month<c.end_month)
 if(next)return {cropId:next.crop_id,name:es?next.crop_es:next.crop_en,state:next.sow_month===month?(es?'Siembra orientativa':'Reference sowing'):(es?'En crecimiento estimado':'Estimated growth'),kind:next.sow_month===month?'sowing':'growth'}
 const current=currentCampaign(zone)
 if(current&&current.sow_month<=month&&month<current.end_month)return {cropId:current.crop_id,name:es?current.crop_es:current.crop_en,state:es?'Cultivo actual · crecimiento estimado':'Current crop · estimated growth',kind:'current'}
 return {cropId:'',name:es?'Sin programación confirmada':'No confirmed schedule',state:es?'Confirma cosecha y fecha de siembra; no implica descanso planificado.':'Check harvest and sowing dates; this does not imply planned fallow.',kind:'unknown'}
}
