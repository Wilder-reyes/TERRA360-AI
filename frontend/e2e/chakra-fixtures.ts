import type {Page} from '@playwright/test'
/** Deterministic NASA-agnostic fixture: only test scaffolding, never production evidence. */
export const testField={type:'Polygon' as const,coordinates:[[
 [-77.7395,-10.702],[-77.7375,-10.702],[-77.7375,-10.700],
 [-77.7395,-10.700],[-77.7395,-10.702]
]]}
export const testSubplot={type:'Polygon' as const,coordinates:[[
 [-77.7395,-10.702],[-77.73865,-10.702],[-77.73865,-10.700],
 [-77.7395,-10.700],[-77.7395,-10.702]
]]}
export const preparedZone={
 zone_id:'rest',area_ha:1.28,current_crop_id:'camote',current_crop:'Camote',
 suggested_crop_id:'vainita',suggested_crop:'Vainita',sow_month:'2027-01',
 sow_label_es:'enero de 2027',estimated_cycle_days:90,why_es:'Alternar familias de cultivos.',
 how_es:['Comprobar agua antes de sembrar.','Seleccionar una variedad local.',
 'Preparar terreno y surcos adecuados.','Revisar riego y plagas.'],reference_water_mm:245,
 sowing_window_scope:'lima_reference',source_tags:['FAO-56']
}
export const prepared={
 status:'prepared',parcel_area_ha:2.25,scope:'barranca_reference',
 climate_status:'nasa_power_reference',ai_status:'agronomic_rule_engine',
 disclaimer_es:'Plan orientativo; verifica agua, clima y suelo.',sources:['FAO-56','NASA POWER'],
 zone_plans:[preparedZone]
}
export const savedField=(opts?:{zoneCrops?:Record<string,{crop_id:string;planted_month:string}>;subplots?:{id:string;polygon:typeof testSubplot}[]})=>({
 version:1,field:testField,place:'Terreno delimitado de prueba',
 fieldLabel:'Terreno delimitado',isDemoField:false,baseYear:2024,
 plantings:[],subplots:opts?.subplots||[],zoneCrops:opts?.zoneCrops||{}
})

/** Fill only unrecorded crop zones. The three farmer areas are deliberately
 * distinct, so old one-zone tests must register each before proceeding. */
export async function registerAllCropZones(page:Page){
 const zones=page.locator('.chakra-zone-choice')
 const count=await zones.count()
 for(let i=0;i<count;i++){
  const zone=zones.nth(i)
  if((await zone.innerText()).includes('Por registrar')||(await zone.innerText()).includes('To register')){
   await zone.click()
   await page.getByRole('button',{name:'Marcar en zona elegida'}).click()
  }
 }
}

/** A study field is always chosen explicitly in tests. */
export async function selectStudyExample(page:Page){
 const next=page.getByRole('button',{name:/^(Registrar cultivos por zona|Record crops by zone)$/})
 if(await next.count()&&await next.isDisabled())await page.getByRole('button',{name:/^(Ver un ejemplo|Try an example)$/}).click()
}
