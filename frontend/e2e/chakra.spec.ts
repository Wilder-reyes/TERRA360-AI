import {test,expect} from '@playwright/test'

test.beforeEach(async({page})=>{
 await page.addInitScript(()=>localStorage.setItem('chakra-bio-guided-v2','hide'))
})

const prepared={
 status:'prepared',parcel_area_ha:2.25,scope:'barranca_reference',
 climate_status:'nasa_power_reference',ai_status:'trained_hls_on_exact_study_parcel',
 disclaimer_es:'Plan de referencia: confirma el suelo y agua de riego.',sources:['NASA HLS','FAO-56'],
 zone_plans:[{
  zone_id:'rest',area_ha:2.25,current_crop_id:'camote',current_crop:'Camote',
  suggested_crop_id:'vainita',suggested_crop:'Vainita',sow_month:'2027-01',
  sow_label_es:'enero de 2027',estimated_cycle_days:90,
  why_es:'Se alternan familias de cultivo.',how_es:[
   'Revisa la disponibilidad de agua.',
   'Elige una variedad local adecuada.',
   'Prepara surcos y verifica la semilla.',
   'Ajusta riego y seguimiento por etapas.',
  ],reference_water_mm:245.5,sowing_window_scope:'lima_reference',
  source_tags:['FAO-56','DRA Lima / MIDAGRI']
 }]
}

test('CHAKRA shows the interactive map as the central step of a three-step journey',async({page})=>{
 await page.goto('/')
 await expect(page).toHaveTitle('CHAKRA | Tu tierra. Tu próxima siembra.')
 await expect(page.getByRole('heading',{name:/Conoce tu terreno/})).toBeVisible()
 await expect(page.locator('.b-progress button')).toHaveCount(3)
 await expect(page.locator('.b-map')).toBeVisible()
 await expect(page.getByRole('region',{name:'Vegetación observada en Barranca'})).toBeVisible()
 await expect(page.getByText('¿Qué muestra el satélite?')).toBeVisible()
 expect(await page.locator('body').innerText()).not.toMatch(/BIOTEX/)
})

test('crop cards and spatial plan produce a zone-specific printable map',async({page})=>{
 let submitted:Record<string,unknown>|null=null
 await page.route('**/api/rotation/spatial-plan',async route=>{
  submitted=route.request().postDataJSON()
  await route.fulfill({contentType:'application/json',body:JSON.stringify(prepared)})
 })
 await page.goto('/')
 await page.getByRole('button',{name:'Registrar cultivos por zona'}).click()
 await expect(page.getByRole('heading',{name:'¿Qué sembraste y en qué parte?'})).toBeVisible()
 await expect(page.locator('.chakra-crop-card')).toHaveCount(13)
 await page.getByRole('group',{name:'Elige el cultivo'}).getByRole('button',{name:/Camote/}).click()
 await page.getByRole('button',{name:'Guardar cultivo de esta zona'}).click()
 await expect(page.locator('.chakra-zone-choice')).toContainText(['Camote'])
 await page.getByRole('button',{name:'Continuar a mi plan'}).click()
 await expect(page.getByRole('heading',{name:/¿Para cuántos meses/})).toBeVisible()
 await page.getByRole('slider',{name:'Personaliza la duración'}).fill('18')
 await page.getByRole('button',{name:'Crear mi calendario'}).click()
 expect((submitted as Record<string,unknown>|null)?.planning_months).toBe(18)
 await expect(page.getByRole('heading',{name:/Tu próxima siembra, zona por zona/})).toBeVisible()
 await expect(page.getByText('Vainita',{exact:true}).first()).toBeVisible()
 await expect(page.getByText('enero de 2027',{exact:true})).toBeVisible()
 expect(submitted).toMatchObject({zones:[{id:'rest',crop_id:'camote'}]})
 await expect(page.getByRole('button',{name:'Imprimir mapa y plan PDF'})).toBeVisible()
 await page.emulateMedia({media:'print'})
 await expect(page.locator('.chakra-spatial-print')).toBeVisible()
 await expect(page.locator('.chakra-spatial-print svg')).toHaveCount(1)
 await expect(page.locator('.b-main')).toBeHidden()
})

test('any area can start delineation and the app retains large controls on phones',async({page})=>{
 for(const width of [375,768,1440]){
  await page.setViewportSize({width,height:900})
  await page.goto('/')
  await page.evaluate(()=>document.fonts.ready)
  expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(width+1)
  await expect(page.locator('.b-map')).toBeVisible()
 }
 await page.getByRole('button',{name:'Delimitar otro terreno'}).click()
 await expect(page.getByRole('button',{name:'Terminar terreno'})).toBeDisabled()
 await expect(page.getByRole('button',{name:'Cancelar',exact:true})).toBeVisible()
})
