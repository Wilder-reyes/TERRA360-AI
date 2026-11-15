import {test,expect} from '@playwright/test'

const daily={
 source:'NASA POWER',data_status:'available',records:[
  {date:'2026-11-09',PRECTOTCORR:1.2,T2M:20.1,T2M_MIN:15,T2M_MAX:25,RH2M:70},
  {date:'2026-11-10',PRECTOTCORR:2.5,T2M:22.0,T2M_MIN:16,T2M_MAX:27,RH2M:67},
 ],
 location:{name:'Punto de consulta',latitude:-11.479185,longitude:-77.18042},
 period:{start:'2026-11-09',end:'2026-11-10'},spatial_representation:'regional NASA POWER grid'
}
const candidates=[
 {id:'sweet_potato',name:'Camote',scientific_name:'Ipomoea batatas',status:'climate_reference_to_review',
  reason:'La temperatura regional coincide con un rango general publicado para esta especie. Falta comprobar suelo y agua.',
  temperature_review:'within_expert_reference',rain_review:'below_expert_reference',
  temperature_reference_c:[15,29],rain_reference_mm_year:[500,1200],can_recommend_sowing:false,local_suitability_confirmed:false},
 {id:'tomato',name:'Tomate',scientific_name:'Solanum lycopersicum',status:'insufficient_evidence',
  reason:'Aún faltan datos climáticos completos o una referencia FAO comprobable.',
  temperature_review:'unknown',rain_review:'unknown',temperature_reference_c:null,rain_reference_mm_year:null,
  can_recommend_sowing:false,local_suitability_confirmed:false}
]
const guidance={
 status:'available',source:'NASA POWER',period:{start_year:2021,end_year:2025},
 climate:{status:'available',complete_years:5,temperature_mean_c:21.1,annual_rain_mm:28.3,years:[2021,2022,2023,2024,2025]},
 history:[2021,2022,2023,2024,2025].map(year=>({year,status:'complete',precipitation_total_mm:25+year%3,temperature_mean_c:20})),
 candidates,selected_crop:candidates[0],can_recommend_sowing:false,
 needs_local_review:['Riego','Suelo','Variedad'],limitation:'Son opciones para conversar con un técnico, NO recomendaciones de siembra.',
 source_urls:['https://power.larc.nasa.gov/','https://cgiar-climate-data-hub.github.io/catalog/ecocrop/']
}
test.beforeEach(async({page})=>{
 await page.addInitScript(()=>localStorage.setItem('chakra-bio-guided-v2','hide'))
 await page.route('**/api/environment/nasa-power/daily**',r=>r.fulfill({contentType:'application/json',body:JSON.stringify(daily)}))
 await page.route('**/api/environment/terrain?**',r=>r.fulfill({contentType:'application/json',body:'{"elevation_m":120,"approximate_gradient_degrees":1.2}'}))
 await page.route('**/api/rotation/climate?**',r=>r.fulfill({contentType:'application/json',body:'{"annual_et0_mm":900}'}))
 await page.route('**/api/arie/crop-guidance**',r=>r.fulfill({contentType:'application/json',body:JSON.stringify(guidance)}))
 await page.route('**/api/arie/crops?**',r=>r.fulfill({contentType:'application/json',body:JSON.stringify({items:[{id:'sweet_potato',name:'Camote',scientific_name:'Ipomoea batatas'}]})}))
})
async function selectedField(page:import('@playwright/test').Page){await page.goto('/?research=1');await page.getByRole('button',{name:/Explorar parcela de Barranca/}).click()}
async function context(page:import('@playwright/test').Page){await selectedField(page);await page.getByText('Datos ambientales y satélite (opcional)',{exact:true}).click();await page.getByRole('button',{name:'Consultar datos del terreno'}).click()}
async function cropReference(page:import('@playwright/test').Page){
 await selectedField(page);await page.getByRole('button',{name:'Registrar cultivos por zona',exact:true}).click();await page.getByText('Ayuda para reconocer cultivos (opcional)',{exact:true}).click();await page.getByText('Referencias de cultivos (opcional)',{exact:true}).click();await page.getByLabel('Buscar nombre de cultivo').fill('camote');await page.getByRole('button',{name:'Buscar en catálogo'}).click();await page.getByRole('button',{name:'Camote · Ipomoea batatas'}).click();await page.getByRole('button',{name:'Revisar referencia regional'}).click()
}
test('regional climate is available inside Mi terreno with incomplete-period disclosure',async({page})=>{
 await context(page)
 await expect(page.getByRole('region',{name:'Clima histórico'})).toContainText('3.7 mm')
 await expect(page.getByRole('region',{name:'Clima histórico'})).toContainText('21.1 °C')
 await expect(page.getByText(/los periodos incompletos no son totales anuales/)).toBeVisible()
 await expect(page.locator('.b-progress button')).toHaveCount(3)
 await expect(page.getByText(/Elevación aproximada: 120.0 m/)).toBeVisible()
})
test('searched crop reference does not become declared crop history or suitability ranking',async({page})=>{
 await cropReference(page)
 await expect(page.getByText(/La temperatura regional coincide/)).toBeVisible()
 await expect(page.getByText(/NO recomendaciones de siembra/)).toBeVisible()
 await expect(page.locator('.chakra-zone-choice')).toContainText(['Por registrar'])
 await expect(page.locator('.chakra-crop-card')).toHaveCount(13)
})
test('zone-by-zone PDF uses the native print entry point and a geometric map',async({page})=>{
 await page.addInitScript(()=>{(window as any).__printed=0;window.print=()=>{(window as any).__printed++}})
 await page.route('**/api/rotation/spatial-plan',r=>r.fulfill({contentType:'application/json',body:JSON.stringify({
  status:'prepared',parcel_area_ha:2.25,scope:'barranca_reference',ai_status:'agronomic_rule_engine',
  climate_status:'reference_rules',disclaimer_es:'Revisar con asesor local.',sources:['FAO-56'],
  zone_plans:[{zone_id:'rest',area_ha:2.25,current_crop:'Camote',current_crop_id:'camote',
   suggested_crop:'Vainita',suggested_crop_id:'vainita',sow_month:'2027-01',sow_label_es:'enero de 2027',
   estimated_cycle_days:100,why_es:'Rotación familiar.',how_es:['Revisar agua','Preparar suelo','Sembrar','Seguir etapas'],
   reference_water_mm:null,sowing_window_scope:'lima_reference',source_tags:['FAO-56']}]
 })}))
 await selectedField(page)
 await page.getByRole('button',{name:'Registrar cultivos por zona'}).click()
 await page.getByRole('button',{name:'Marcar en zona elegida'}).click()
 await page.getByRole('button',{name:'Continuar a mi plan'}).click()
 await page.getByRole('button',{name:'Crear mi calendario'}).click()
 await page.getByRole('button',{name:'Imprimir mapa y plan PDF'}).click()
 await expect.poll(()=>page.evaluate(()=>(window as any).__printed)).toBe(1)
 await page.emulateMedia({media:'print'})
 await expect(page.locator('.chakra-spatial-print')).toBeVisible()
 await expect(page.locator('.chakra-spatial-print svg')).toHaveCount(1)
})
test('mobile crop reference works without requiring a photo or artificial vision',async({page})=>{
 await page.setViewportSize({width:390,height:844});await cropReference(page)
 await expect(page.getByText('Cultivo de referencia: Camote')).toBeVisible()
 await expect(page.locator('.terra-camera-preview img')).toHaveCount(0)
 expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(391)
})
test('missing NASA data remains unknown and catalogue review never invents planting advice',async({page})=>{
 await page.route('**/api/environment/nasa-power/daily**',r=>r.fulfill({status:502,contentType:'application/json',body:'{}'}))
 await context(page);await expect(page.getByText(/no está disponible temporalmente/)).toBeVisible();await expect(page.getByRole('region',{name:'Clima histórico'})).toHaveCount(0)
 await page.route('**/api/arie/crop-guidance**',r=>r.fulfill({contentType:'application/json',body:JSON.stringify({...guidance,status:'insufficient_data',climate:{complete_years:0,annual_rain_mm:null},selected_crop:{name:'Camote',reason:'Aún faltan datos climáticos completos.'}})}))
 await cropReference(page);await expect(page.getByText(/Años completos: 0/)).toBeVisible();await expect(page.getByText(/Lluvia anual media: —/)).toBeVisible()
})
test('release describes the unified application with no published-site dependency',async({page})=>{
 await page.goto('/?research=1');await expect(page).toHaveTitle('CHAKRA | Tu tierra. Mi plan de cultivos.')
 const r=await page.request.get('/release.json');expect(r.ok()).toBeTruthy();const d=await r.json();expect(d.release).toBe('chakra-1.0.0-nasa-space-apps-2026');expect(d.environment).toBe('production');expect(d.team).toBe('CHAKRA X');expect(d.computer_vision_enabled).toBe(false);expect(d.primary_url).toBeUndefined();expect(d.ui_release).toBe('chakra-glass-lime')
})
test('NASA GIBS layers and POWER figures keep distinct regional provenance',async({page})=>{
 await context(page);await page.getByRole('button',{name:'Lluvia NASA',exact:true}).click()
 const sources=page.getByRole('region',{name:'Procedencia de la capa NASA'})
 await sources.getByText('Detalles de esta capa NASA').click()
 await expect(sources).toContainText('GPM IMERG')
 await expect(sources.locator('img[src*="gibs.earthdata.nasa.gov"]')).toBeAttached()
 await page.getByText('Más capas y herramientas').click()
 await page.getByRole('button',{name:'Vegetación regional'}).click()
 await expect(sources).toContainText('MODIS Terra NDVI 8-Day')
 await expect(page.getByRole('region',{name:'Clima histórico'})).toContainText('NASA POWER')
})
test('mobile map controls stay usable without a separate dashboard page',async({page})=>{
 await page.setViewportSize({width:375,height:812});await page.goto('/?research=1');await expect(page.locator('.b-map')).toBeVisible();await page.getByRole('button',{name:'Delimitar otro terreno'}).click();await expect(page.getByRole('button',{name:'Terminar terreno'})).toBeDisabled();await page.getByRole('button',{name:'Cancelar',exact:true}).click()
 expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(376)
 await expect(page.locator('a[href*="vista="]')).toHaveCount(0)
})
