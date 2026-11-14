/** Farmer-declared crop rotation helpers.
 * No satellite candidate is ever accepted without an explicit farmer action.
 * Each planting is identified by its start month within a 24-month window.
 */
export type ManualPlanting={crop_id:string;start_index:number}
export type AddStatus='added'|'duplicate'|'limit'|'invalid'
export function addPlantingToRotation(current:ManualPlanting[],crop_id:string,start_index:number):{status:AddStatus;current:ManualPlanting[]}{
 if(!crop_id.trim()||!Number.isInteger(start_index)||start_index<0||start_index>23)return{status:'invalid',current}
 if(current.some(p=>p.start_index===start_index))return{status:'duplicate',current}
 if(current.length>=10)return{status:'limit',current}
 return{status:'added',current:[...current,{crop_id,start_index}].sort((a,b)=>a.start_index-b.start_index)}
}
export function removePlantingFromRotation(current:ManualPlanting[],at:number):ManualPlanting[]{
 return current.filter((_,index)=>index!==at)
}
