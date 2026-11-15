/** Crop-history months are relative to August of the saved agricultural year. */
export type DatedPlanting={crop_id:string;start_index:number}
export function relativeMonthIndex(isoMonth:string,baseAugustYear:number):number {
 if(!/^\d{4}-(0[1-9]|1[0-2])$/.test(isoMonth))return -999
 const year=Number(isoMonth.slice(0,4)),month=Number(isoMonth.slice(5,7))
 return (year-baseAugustYear)*12+month-8
}
export function migrateSavedPlantings<T extends DatedPlanting>(
 items:T[],previousAugustYear:number|null,newAugustYear:number
):T[]{
 // Legacy saves never included the base year. Keep relative indices rather
 // than guessing; ask farmers to recheck dates after restoring the record.
 const shift=previousAugustYear===null?0:(previousAugustYear-newAugustYear)*12
 return items.filter(p=>Number.isInteger(p.start_index)).map(p=>({...p,start_index:p.start_index+shift}))
 .filter(p=>p.start_index>=0&&p.start_index<24)
 .sort((a,b)=>a.start_index-b.start_index)
}
