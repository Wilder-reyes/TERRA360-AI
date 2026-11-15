import {test,expect} from '@playwright/test'
import {registerAllCropZones} from './chakra-fixtures'

const plan={
 status:'prepared',parcel_area_ha:2.25,scope:'barranca_reference',
 climate_status:'nasa_power_reference',ai_status:'agronomic_rule_engine',
 planning_months:18,plan_start_month:'2026-11',plan_end_month:'2028-05',
 disclaimer_es:'Comprueba las fechas y la disponibilidad real de agua antes de sembrar.',
 sources:['NASA POWER','FAO-56'],
 zone_plans:[{
  zone_id:'rest',area_ha:2.25,current_crop_id:'camote',current_crop:'Camote',
  suggested_crop_id:'vainita',suggested_crop:'Vainita',sow_month:'2027-01',sow_label_es:'enero de 2027',
  estimated_cycle_days:90,why_es:'Alternar familias de cultivos.',
  how_es:['Verifica el agua.','Elige una variedad local.','Prepara surcos.','Vigila el cultivo.'],
  reference_water_mm:220,sowing_window_scope:'lima_reference',source_tags:['FAO-56'],
  campaigns:[
   {crop_id:'vainita',crop_es:'Vainita',crop_en:'Green bean',sow_month:'2027-01',end_month:'2027-04',estimated_cycle_days:90,reference_water_mm:220,source:'agronomic_rule_with_regional_references'},
   {crop_id:'maiz_chala',crop_es:'Maíz chala',crop_en:'Forage maize',sow_month:'2027-05',end_month:'2027-09',estimated_cycle_days:100,reference_water_mm:350,source:'agronomic_rule_with_regional_references'},
  ]
 }]
}

test('first-visit BIO guide focuses on an actual next action and follows the step',async({page})=>{
 await page.addInitScript(()=>{
  localStorage.removeItem('chakra-bio-guided-v3')
  localStorage.removeItem('chakra-bio-guided-v2')
 })
 await page.goto('/')
 await expect(page.getByRole('region',{name:'BIO, tu guía'})).toBeVisible()
 await expect(page.getByText('¡Hola! Soy BIO')).toBeVisible()
 await expect(page.locator('.bio-shade')).toHaveCount(4)
 await page.getByRole('button',{name:'Salir del tutorial'}).click()
 await expect(page.getByRole('region',{name:'BIO, tu guía'})).toHaveCount(0)
 await expect(page.getByRole('button',{name:'Abrir guía de BIO'})).toBeVisible()
})

test('how and sources are independent public pages with real provider links',async({page})=>{
 await page.addInitScript(()=>localStorage.setItem('chakra-bio-guided-v3','hide'))
 await page.goto('/como-funciona')
 await expect(page.getByRole('heading',{name:'Tu próxima siembra empieza en tu mapa.'})).toBeVisible()
 await expect(page.locator('.chakra-story-card')).toHaveCount(3)
 await page.getByRole('link',{name:'Fuentes'}).click()
 await expect(page).toHaveURL(/\/fuentes/)
 await expect(page.locator('.chakra-source-card')).toHaveCount(8)
 await expect(page.getByRole('link',{name:/Consultar fuente oficial/})).toHaveCount(8)
 await page.getByRole('button',{name:'Ir a mi terreno'}).first().click()
 await expect(page.locator('.b-map')).toBeVisible()
})

test('the farmer has a readable quarter calendar and last crop when no campaign is scheduled',async({page})=>{
 await page.addInitScript(()=>localStorage.setItem('chakra-bio-guided-v3','hide'))
 let submitted:Record<string,unknown>|undefined
 await page.route('**/api/rotation/spatial-plan',route=>{
  submitted=route.request().postDataJSON()
  return route.fulfill({contentType:'application/json',body:JSON.stringify(plan)})
 })
 await page.goto('/')
 await page.getByRole('button',{name:'Registrar cultivos por zona'}).click()
 await expect(page.locator('.chakra-crop-card')).toHaveCount(13)
 await page.getByRole('group',{name:'Elige el cultivo'}).getByRole('button',{name:/Camote/}).click()
 await page.getByRole('button',{name:'Marcar en zona elegida'}).click()
 await registerAllCropZones(page)
 await page.getByRole('button',{name:'Continuar a mi plan'}).click()
 await expect(page.getByRole('heading',{name:/¿Para cuántos meses/})).toBeVisible()
 await page.getByRole('slider',{name:'Personaliza la duración'}).fill('18')
 await page.getByRole('button',{name:'Crear mi calendario'}).click()
 await expect(page.getByRole('heading',{name:'Mi plan de cultivos'})).toBeVisible()
 await expect(page.locator('.chakra-aerial-map')).toBeVisible()
 await expect(page.locator('.chakra-plan-highlight')).toContainText('hectáreas')
 await expect(page.locator('.chakra-quarter-row')).toHaveCount(1)
 await expect(page.getByText('Vainita').first()).toBeVisible()
 await expect(page.locator('.chakra-quarter-zone')).toContainText('Camote')
 await page.getByRole('button',{name:'2026',exact:true}).click()
 await page.getByRole('button',{name:/nov/i}).first().click()
 await expect(page.getByText('Último cultivo: Camote').first()).toBeVisible()
 expect(submitted?.planning_months).toBe(18)
 await page.emulateMedia({media:'print'})
 await expect(page.locator('.chakra-print-year')).toHaveCount(3)
})

test('mobile keeps crop cards compact and map in the same step without horizontal overflow',async({page})=>{
 await page.addInitScript(()=>localStorage.setItem('chakra-bio-guided-v3','hide'))
 await page.setViewportSize({width:390,height:844})
 await page.goto('/')
 await page.getByRole('button',{name:'Registrar cultivos por zona'}).click()
 await expect(page.locator('.chakra-zone-map')).toBeVisible()
 await expect(page.locator('.chakra-zone-choice')).toHaveCount(3)
 await expect(page.locator('.chakra-zone-move-icon')).toHaveCount(1)
 await expect(page.locator('.chakra-zone-resize-icon')).toHaveCount(4)
 await expect(page.locator('.chakra-crop-card')).toHaveCount(13)
 expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(391)
 await page.getByRole('group',{name:'Elige el cultivo'}).getByRole('button',{name:/Camote/}).click()
 await expect(page.locator('.chakra-zone-map')).toBeInViewport()
})
