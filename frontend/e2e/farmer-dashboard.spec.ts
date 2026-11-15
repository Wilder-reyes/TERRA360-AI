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
 await page.addInitScript(()=>localStorage.setItem('biotex-bio-intro-v1','complete'))
 await page.route('**/api/environment/nasa-power/daily**',r=>r.fulfill({contentType:'application/json',body:JSON.stringify(daily)}))
 await page.route('**/api/environment/terrain?**',r=>r.fulfill({contentType:'application/json',body:'{"elevation_m":120,"approximate_gradient_degrees":1.2}'}))
 await page.route('**/api/rotation/climate?**',r=>r.fulfill({contentType:'application/json',body:'{"annual_et0_mm":900}'}))
 await page.route('**/api/arie/crop-guidance**',r=>r.fulfill({contentType:'application/json',body:JSON.stringify(guidance)}))
 await page.route('**/api/arie/crops?**',r=>r.fulfill({contentType:'application/json',body:JSON.stringify({items:[{id:'sweet_potato',name:'Camote',scientific_name:'Ipomoea batatas'}]})}))
})
async function selectedField(page:import('@playwright/test').Page){await page.goto('/');await page.getByRole('button',{name:/Explorar parcela de Barranca/}).click()}
async function context(page:import('@playwright/test').Page){await selectedField(page);await page.getByText('Datos ambientales y satélite (opcional)',{exact:true}).click();await page.getByRole('button',{name:'Consultar datos del terreno'}).click()}
async function cropReference(page:import('@playwright/test').Page){
 await selectedField(page);await page.getByRole('button',{name:'Continuar',exact:true}).click();await page.getByText('Referencias de cultivos (opcional)',{exact:true}).click();await page.getByLabel('Buscar nombre de cultivo').fill('camote');await page.getByRole('button',{name:'Buscar en catálogo'}).click();await page.getByRole('button',{name:'Camote · Ipomoea batatas'}).click();await page.getByRole('button',{name:'Revisar referencia regional'}).click()
}
test('regional climate is available inside Mi terreno with incomplete-period disclosure',async({page})=>{
 await context(page)
 await expect(page.getByRole('region',{name:'Clima histórico'})).toContainText('3.7 mm')
 await expect(page.getByRole('region',{name:'Clima histórico'})).toContainText('21.1 °C')
 await expect(page.getByText(/los periodos incompletos no son totales anuales/)).toBeVisible()
 await expect(page.locator('.b-progress button')).toHaveCount(4)
 await expect(page.getByText(/Elevación aproximada: 120.0 m/)).toBeVisible()
})
test('searched crop reference does not become declared crop history or suitability ranking',async({page})=>{
 await cropReference(page)
 await expect(page.getByText(/La temperatura regional coincide/)).toBeVisible()
 await expect(page.getByText(/NO recomendaciones de siembra/)).toBeVisible()
 await expect(page.getByText('Todavía no has agregado cultivos.')).toBeVisible()
 await expect(page.getByRole('button',{name:'Continuar',exact:true})).toBeDisabled()
})
test('farm plan retains a native print entry point and A4 report',async({page})=>{
 await page.addInitScript(()=>{(window as any).__printed=0;window.print=()=>{(window as any).__printed++}})
 await page.route('**/api/rotation/compare',r=>r.fulfill({contentType:'application/json',body:JSON.stringify({status:'partial',strategies:[],recommended_strategy_id:null})}))
 await selectedField(page);await page.getByRole('button',{name:'Continuar',exact:true}).click();await page.getByRole('button',{name:'Agregar cultivo',exact:true}).click();await page.getByRole('button',{name:'Continuar',exact:true}).click();await page.getByRole('button',{name:'Ver mi plan',exact:true}).click()
 await page.getByRole('button',{name:'Imprimir o guardar PDF'}).click();await expect.poll(()=>page.evaluate(()=>(window as any).__printed)).toBe(1)
 await page.emulateMedia({media:'print'});await expect(page.locator('.b-print-report')).toBeVisible()
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
 await page.goto('/');await expect(page).toHaveTitle('BIOTEX | Tu chacra y tu plan de siembra')
 const r=await page.request.get('/release.json');expect(r.ok()).toBeTruthy();const d=await r.json();expect(d.release).toBe('v0.26-hls-trained-ai-barranca');expect(d.computer_vision_enabled).toBe(false);expect(d.primary_url).toBeUndefined();expect(d.ui_release).toBe('stage-1-unified-workflow')
})
test('NASA GIBS layers and POWER figures keep distinct regional provenance',async({page})=>{
 await context(page);await page.getByRole('button',{name:'Lluvia NASA',exact:true}).click()
 await expect(page.locator('img[src*="gibs.earthdata.nasa.gov"][src*="IMERG_Precipitation_Rate"]').first()).toBeAttached()
 await expect(page.getByText(/No es una medida exacta de tu chacra/)).toBeVisible()
 await page.getByRole('button',{name:'Vegetación NASA',exact:true}).click();await expect(page.locator('img[src*="gibs.earthdata.nasa.gov"][src*="MODIS_Terra_NDVI_8Day"]').first()).toBeAttached()
 await expect(page.getByRole('region',{name:'Clima histórico'})).toContainText('NASA POWER')
})
test('mobile map controls stay usable without a separate dashboard page',async({page})=>{
 await page.setViewportSize({width:375,height:812});await page.goto('/');await expect(page.locator('.b-map')).toBeVisible();await page.getByRole('button',{name:'Marcar mi chacra'}).click();await expect(page.getByRole('button',{name:'Terminar terreno'})).toBeDisabled();await page.getByRole('button',{name:'Cancelar',exact:true}).click()
 expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(376)
 await expect(page.locator('a[href*="vista="]')).toHaveCount(0)
})
