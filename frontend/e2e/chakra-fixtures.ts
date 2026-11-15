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
