import {test,expect} from '@playwright/test'
import {selectStudyExample,registerAllCropZones,prepared,preparedZone} from './chakra-fixtures'

test('the popup follows actions, minimizes for map input and stays inside mobile viewports',async({page},testInfo)=>{
 await page.route('**/api/**',async route=>{
  if(route.request().url().includes('/spatial-plan')){
   const body=route.request().postDataJSON()
   await route.fulfill({json:{...prepared,planning_months:12,plan_start_month:'2026-11',zone_plans:body.zones.map((z:{id:string;crop_id:string;planted_month:string})=>({...preparedZone,zone_id:z.id,current_crop_id:z.crop_id,last_planting_month:z.planted_month}))}})
  }else await route.fulfill({json:route.request().url().includes('/compare')?{status:'available',strategies:[]}:{status:'ok'}})
 })
 await page.goto('/')
 await page.getByRole('button',{name:'Comenzar recorrido'}).click()
 const guide=page.getByRole('region',{name:'CHOKLITO, tu guía'})
 await expect(guide).toBeVisible()
 expect(await guide.evaluate(el=>getComputedStyle(el).position)).toBe('fixed')
 await expect(guide).toContainText('Paso 1')
 const map=page.locator('.b-map');await map.scrollIntoViewIfNeeded()
 const bounds=await map.boundingBox();if(!bounds)throw Error('No map')
 await page.mouse.click(bounds.x+bounds.width/2,bounds.y+bounds.height/2)
 await expect(guide).toHaveCount(0)
 await expect(page.getByRole('button',{name:'Abrir guía de CHOKLITO'})).toBeVisible()
 await page.getByRole('button',{name:'Abrir guía de CHOKLITO'}).click()
 await expect(guide).toBeVisible()
 await page.getByRole('button',{name:'Salir del tutorial'}).click()
 await page.getByRole('button',{name:'Cancelar',exact:true}).click()
 await page.getByRole('button',{name:'Inicio CHAKRA X'}).click()
 await selectStudyExample(page)
 await page.getByRole('button',{name:'Registrar cultivos por zona'}).click()
 await page.getByRole('button',{name:'Abrir guía de CHOKLITO'}).click()
 await expect(guide).toContainText('Paso 2')
 for(const width of [320,390,768,1280]){
  await page.setViewportSize({width,height:900})
  await expect(async()=>{const panel=await guide.boundingBox();expect(panel&&panel.x>=0&&panel.x+panel.width<=width+1&&panel.y>=0&&panel.y+panel.height<=900).toBeTruthy()}).toPass()
 }
 await page.setViewportSize({width:390,height:844})
 await page.screenshot({path:testInfo.outputPath('guided-popup-mobile.png')})
 for(let i=0;i<3;i++){
  await expect(guide).toBeVisible();await guide.getByRole('button',{name:/Entendido/}).click()
  await page.locator('.chakra-zone-choice').nth(i).click()
  await page.getByRole('group',{name:'Elige el cultivo'}).getByRole('button',{name:/Maíz amarillo duro/}).click()
  await expect(guide).toContainText('Marca dónde lo sembraste')
  await guide.getByRole('button',{name:/Entendido/}).click()
  await page.getByRole('button',{name:'Marcar en zona elegida'}).click()
 }
 await expect(guide).toContainText('¡Registraste tus cultivos!')
 await guide.getByRole('button',{name:/Entendido/}).click()
 await page.getByRole('button',{name:'Continuar a mi plan'}).click()
 await expect(guide).toContainText('Paso 3')
 await guide.getByRole('button',{name:/Entendido/}).click()
 await page.getByRole('button',{name:'Crear mi calendario'}).click()
 await expect(guide).toContainText('¡Tu plan está listo!')
})

test('distinct bean pictograms, contained zone badges and populated November/December calendar',async({page},testInfo)=>{
 test.setTimeout(90000)
 await page.addInitScript(()=>localStorage.setItem('chakra-choklito-guided-v4','hide'))
 await page.route('**/api/**',async route=>{
  if(route.request().url().includes('/spatial-plan')){
   const payload=route.request().postDataJSON()
   const names:Record<string,string>={maiz_amarillo_duro:'Maíz amarillo duro',frijol_grano_seco:'Frijol canario',frijol_castilla:'Frijol castilla / caupí'}
   await route.fulfill({json:{status:'prepared',parcel_area_ha:2.25,planning_months:12,plan_start_month:'2026-11',plan_end_month:'2027-11',scope:'barranca_reference',climate_status:'reference_rules',ai_status:'agronomic_rule_engine',disclaimer_es:'Plan de referencia: confirma condiciones locales.',sources:['FAO-56'],zone_plans:payload.zones.map((z:{id:string;crop_id:string;planted_month:string})=>({zone_id:z.id,area_ha:.1,current_crop_id:z.crop_id,current_crop:names[z.crop_id],last_planting_month:'2026-11',suggested_crop_id:'frijol_castilla',suggested_crop:'Frijol castilla / caupí',sow_month:'2027-05',sow_label_es:'mayo de 2027',estimated_cycle_days:90,why_es:'Alternar familias.',how_es:['Revisar agua.','Confirmar suelo.'],reference_water_mm:null,sowing_window_scope:'lima_reference',source_tags:['FAO-56'],campaigns:[{crop_id:'frijol_castilla',crop_es:'Frijol castilla / caupí',crop_en:'Cowpea',sow_month:'2027-05',end_month:'2027-08',estimated_cycle_days:90,reference_water_mm:null,source:'agronomic_rule_with_regional_references'}]}))}})
  }else await route.fulfill({json:route.request().url().includes('/compare')?{status:'available',strategies:[]}:{status:'ok'}})
 })
 await page.goto('/')
 await selectStudyExample(page)
 await page.getByRole('button',{name:'Registrar cultivos por zona'}).click()
 const glyphs=[]
 for(const id of ['frijol_grano_seco','frijol_castilla','pallar']){
  const svg=page.locator('.chakra-crop-card [data-crop-glyph="'+id+'"]')
  await expect(svg).toBeVisible();glyphs.push(await svg.innerHTML())
 }
 expect(new Set(glyphs).size).toBe(3)
 for(const [i,name] of ['Maíz amarillo duro','Frijol canario','Frijol castilla'].entries()){
  await page.locator('.chakra-zone-choice').nth(i).click()
  await page.getByRole('group',{name:'Elige el cultivo'}).getByRole('button',{name:new RegExp(name)}).click()
  await page.getByRole('button',{name:'Marcar en zona elegida'}).click()
 }
 await registerAllCropZones(page)
 await page.getByRole('button',{name:'Continuar a mi plan'}).click()
 await page.getByRole('button',{name:'Crear mi calendario'}).click()
 await expect(page.locator('.chakra-map-zone-key li')).toHaveCount(3)
 for(const month of ['2026-11','2026-12']){
  const cells=page.locator('[data-month="'+month+'"]')
  await expect(cells).toHaveCount(3)
  for(const cell of await cells.all()){await expect(cell).toHaveAttribute('data-calendar-state','current');await expect(cell).toContainText('crecimiento estimado')}
 }
 await expect(page.locator('.chakra-quarter-heading [role=columnheader]')).toHaveCount(2)
 for(const width of [320,360,375,390,430,640,768,820,960,1024,1280]){
  await page.setViewportSize({width,height:900})
  expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(width+1)
  for(const badge of await page.locator('.chakra-aerial-map .leaflet-tooltip').all()){
   const box=await badge.boundingBox();expect(box?.width||0).toBeLessThanOrEqual(width<=700?89:181)
  }
 }
 await page.screenshot({path:testInfo.outputPath('zone-labels-desktop.png'),fullPage:true})
 await page.setViewportSize({width:390,height:844})
 await page.screenshot({path:testInfo.outputPath('zone-labels-mobile.png'),fullPage:true})
 await page.emulateMedia({media:'print'})
 await expect(page.locator('.chakra-print-year').first()).toContainText('Cultivo actual')
 await expect(page.locator('.chakra-print-month').first()).toContainText(/nov/i)
})

test('welcome traps keyboard focus and Escape dismisses popups without selecting land',async({page})=>{
 await page.goto('/')
 const start=page.getByRole('button',{name:'Comenzar recorrido'}),skip=page.getByRole('button',{name:'Explorar por mi cuenta'})
 await expect(start).toBeFocused();await page.keyboard.press('Shift+Tab');await expect(skip).toBeFocused()
 await page.keyboard.press('Escape');await expect(page.getByRole('dialog')).toHaveCount(0)
 await expect(page.getByRole('button',{name:'Registrar cultivos por zona'})).toBeDisabled()
 await page.getByRole('button',{name:'Abrir guía de CHOKLITO'}).click()
 await expect(page.getByRole('region',{name:'CHOKLITO, tu guía'})).toBeVisible()
 await page.keyboard.press('Escape');await expect(page.getByRole('region',{name:'CHOKLITO, tu guía'})).toHaveCount(0)
})
