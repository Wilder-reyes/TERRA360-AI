import {test,expect} from '@playwright/test'
import {prepared,preparedZone,savedField,testField,testSubplot} from './chakra-fixtures'

test.beforeEach(async({page})=>{await page.addInitScript(()=>localStorage.setItem('chakra-bio-guided-v2','hide'))})

test('map-first CHAKRA landing keeps the journey short and science optional',async({page})=>{
 await page.goto('/?research=1')
 await expect(page.getByRole('heading',{name:/Conoce tu terreno/})).toBeVisible()
 await expect(page.locator('.b-map')).toBeVisible()
 await expect(page.locator('.b-progress button')).toHaveCount(3)
 await expect(page.getByRole('button',{name:'Explorar parcela de Barranca'})).toBeVisible()
 await expect(page.getByRole('button',{name:'Delimitar otro terreno'})).toBeVisible()
 await expect(page.getByText('Cómo se obtuvo esta lectura')).toBeVisible()
 expect(await page.locator('body').innerText()).not.toContain('BIOTEX')
})

test('a location search can move from Barranca to any requested location',async({page})=>{
 await page.route('https://nominatim.openstreetmap.org/search**',route=>route.fulfill({
  contentType:'application/json',body:JSON.stringify([{display_name:'Huacho, Huaura, Lima, Perú',lat:'-11.107',lon:'-77.610'}])
 }))
 await page.goto('/?research=1')
 await page.getByRole('textbox',{name:'¿Dónde está tu chacra?'}).fill('Huacho')
 await page.getByRole('button',{name:'Buscar lugar'}).click()
 await page.getByRole('button',{name:/Huacho, Huaura, Lima, Perú/}).click()
 await expect(page.getByText('Huacho, Huaura, Lima, Perú',{exact:true})).toBeVisible()
 await expect(page.getByRole('button',{name:'Marcar mi chacra'})).toBeVisible()
})

test('any imported polygon can be assigned a crop without losing its geometry',async({page})=>{
 await page.goto('/?research=1')
 await page.getByText('Importar contorno GeoJSON (opcional)',{exact:true}).click()
 await page.getByLabel('Contorno GeoJSON',{exact:true}).fill(JSON.stringify({
  type:'Polygon',coordinates:[[[-71.995,-13.517],[-71.992,-13.517],[-71.992,-13.514],[-71.995,-13.514],[-71.995,-13.517]]]
 }))
 await page.getByRole('button',{name:'Usar contorno'}).click()
 await expect(page.locator('.b-field-ready')).toBeVisible()
 await page.getByRole('button',{name:'Registrar cultivos por zona'}).click()
 await expect(page.locator('.chakra-crop-card')).toHaveCount(13)
 await expect(page.locator('.chakra-zone-choice')).toHaveCount(1)
})

test('per-zone PDF includes map, acreage, crop, date and four preparation actions',async({page})=>{
 let payload:Record<string,any>|undefined
 await page.route('**/api/rotation/spatial-plan',async route=>{
  payload=route.request().postDataJSON()
  await route.fulfill({contentType:'application/json',body:JSON.stringify(prepared)})
 })
 await page.goto('/?research=1')
 await page.getByRole('button',{name:'Registrar cultivos por zona'}).click()
 await page.getByRole('group',{name:'Elige el cultivo'}).getByRole('button',{name:/Camote/}).click()
 await page.getByRole('button',{name:'Marcar en zona elegida'}).click()
 await page.getByRole('button',{name:'Continuar a mi plan'}).click()
 await page.getByRole('button',{name:'Crear mi calendario'}).click()
 await expect(page.getByText('enero de 2027',{exact:true})).toBeVisible()
 expect(payload?.zones).toEqual([expect.objectContaining({id:'rest',crop_id:'camote'})])
 await page.emulateMedia({media:'print'})
 const report=page.locator('.chakra-spatial-print')
 await expect(report).toBeVisible()
 await expect(report.locator('svg')).toHaveCount(1)
 await expect(report).toContainText('Mi plan de siembra')
 await expect(report).toContainText('Vainita')
 await expect(report).toContainText('Comprobar agua')
 await expect(report).toContainText('enero de 2027')
 expect((await page.pdf({format:'A4',printBackground:true})).byteLength).toBeGreaterThan(5000)
})

test('subdivided fields preserve individual zones and crops',async({page})=>{
 const fixture=savedField({
  subplots:[{id:'Zona 1',polygon:testSubplot}],
  zoneCrops:{
   'Zona 1':{crop_id:'camote',planted_month:'2026-03'},
   rest:{crop_id:'maiz_amarillo_duro',planted_month:'2026-05'}
  }
 })
 await page.addInitScript(state=>localStorage.setItem('biotex-farm-v1',JSON.stringify(state)),fixture)
 let payload:Record<string,any>|undefined
 const zone2={...preparedZone,zone_id:'Zona 1',area_ha:.97,current_crop:'Camote'}
 await page.route('**/api/rotation/spatial-plan',route=>{
  payload=route.request().postDataJSON()
  return route.fulfill({contentType:'application/json',body:JSON.stringify({...prepared,zone_plans:[preparedZone,zone2]})})
 })
 await page.goto('/?research=1')
 await page.getByRole('button',{name:'Recuperar mi chacra guardada'}).click()
 await page.getByRole('button',{name:'Registrar cultivos por zona'}).click()
 await expect(page.locator('.chakra-zone-choice')).toHaveCount(2)
 await page.getByRole('button',{name:'Continuar a mi plan'}).click()
 await page.getByRole('button',{name:'Crear mi calendario'}).click()
 await expect(page.getByRole('heading',{name:/Mi plan de cultivos/})).toBeVisible()
 expect(payload?.zones).toHaveLength(2)
 expect(payload?.zones).toEqual(expect.arrayContaining([
  expect.objectContaining({id:'rest',crop_id:'maiz_amarillo_duro'}),
  expect.objectContaining({id:'Zona 1',crop_id:'camote',polygon:testSubplot})
 ]))
 await expect(page.locator('.chakra-advice-card')).toHaveCount(2)
})

test('saved zone decisions can be recovered after a reload',async({page})=>{
 await page.goto('/?research=1')
 await page.getByRole('button',{name:'Registrar cultivos por zona'}).click()
 await page.getByRole('group',{name:'Elige el cultivo'}).getByRole('button',{name:/Camote/}).click()
 await page.getByRole('button',{name:'Marcar en zona elegida'}).click()
 await page.getByRole('button',{name:'Guardar avance'}).click()
 expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('biotex-farm-v1')||'{}').zoneCrops.rest.crop_id)).toBe('camote')
 await page.reload()
 await page.getByRole('button',{name:'Recuperar mi chacra guardada'}).click()
 await page.getByRole('button',{name:'Registrar cultivos por zona'}).click()
 await expect(page.locator('.chakra-zone-choice')).toContainText(['Camote'])
})

test('regional GIBS rain keeps its real source and an optional provider legend',async({page})=>{
 await page.goto('/?research=1')
 await page.getByRole('button',{name:'Lluvia NASA',exact:true}).click()
 const panel=page.getByRole('region',{name:'Procedencia de la capa NASA'})
 await expect(panel).toContainText('La leyenda muestra intensidad de lluvia regional')
 await panel.getByText('Detalles de esta capa NASA').click()
 await expect(panel).toContainText('GPM IMERG')
 await expect(panel.getByRole('link',{name:'Ver capa en NASA Worldview'})).toBeVisible()
 await expect(panel.locator('.b-map-legend')).toHaveAttribute('open','')
})

test('main actions and map remain usable on narrow mobile screens',async({page})=>{
 await page.setViewportSize({width:375,height:812});await page.goto('/?research=1')
 await expect(page.locator('.b-map')).toBeVisible()
 await expect(page.getByRole('button',{name:'Registrar cultivos por zona'})).toBeVisible()
 expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(376)
 await page.getByRole('button',{name:'Registrar cultivos por zona'}).click()
 await expect(page.locator('.chakra-crop-card')).toHaveCount(13)
 expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(376)
})

test('the published release retains the local CHAKRA brand and scientific provenance',async({page})=>{
 await page.goto('/?research=1')
 await expect(page).toHaveTitle('CHAKRA | Tu tierra. Tu próxima siembra.')
 await expect(page.locator('.b-brand b')).toHaveText('chakra')
 const response=await page.request.get('/release.json')
 expect(response.ok()).toBe(true)
 const manifest=await response.json()
 expect(manifest.computer_vision_enabled).toBe(false)
 expect(manifest.primary_url).toBeUndefined()
})
