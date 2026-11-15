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
 await page.route('**/api/environment/nasa-power/daily**',route=>route.fulfill({contentType:'application/json',body:JSON.stringify(daily)}))
 await page.route('**/api/arie/crop-guidance**',route=>route.fulfill({contentType:'application/json',body:JSON.stringify(guidance)}))
 await page.route('**/api/arie/crops?**',route=>route.fulfill({contentType:'application/json',body:JSON.stringify({items:[
  {id:'sweet_potato',name:'Camote',scientific_name:'Ipomoea batatas',category:'Tubérculos',description:'Sin aptitud local confirmada'},
  {id:'tomato',name:'Tomate',scientific_name:'Solanum lycopersicum',category:'Hortalizas',description:'Sin aptitud local confirmada'},
 ]})}))
})

test('farmer sees a simple Huando map, picks a location and gets a NASA-based dashboard',async({page})=>{
 await page.goto('/?vista=clima')
 await expect(page.getByRole('heading',{name:'Tu terreno, más claro'})).toBeVisible()
 await expect(page.getByText('Piloto · Huando, Huaral, Perú')).toBeVisible()
 await expect(page.getByRole('heading',{name:'Ubica tu terreno en el mapa'})).toBeVisible()
 await expect(page.getByRole('button',{name:'Consultar Huando'})).toBeVisible()
 await expect(page.locator('a[href$=".json"]')).toHaveCount(0)
 await page.getByRole('button',{name:'Consultar Huando'}).click()
 await expect(page.getByText('Un vistazo al clima')).toBeVisible()
 await page.getByRole('button',{name:'Ver tablero completo'}).click()
 await expect(page.getByRole('heading',{name:'Mi tablero e informe'})).toBeVisible()
 await expect(page.locator('.f-metric-blue strong')).toContainText(/3[.,]7/)
 await expect(page.getByText('Temperatura media').first()).toBeVisible()
 await expect(page.getByRole('button',{name:'90 días'})).toBeVisible()
 await page.getByRole('button',{name:'90 días'}).click()
 await expect(page.getByRole('button',{name:'90 días'})).toHaveAttribute('aria-pressed','true')
 await page.getByRole('button',{name:'Temperatura',exact:true}).click()
 await expect(page.getByRole('button',{name:'Temperatura',exact:true})).toHaveAttribute('aria-pressed','true')
 await expect(page.getByText(/no mediciones de tu terreno/).first()).toBeVisible()
})

test('one searched crop is enough, no fake suitability ranking or opaque scenarios',async({page})=>{
 await page.goto('/?vista=clima')
 await page.getByRole('button',{name:'Consultar Huando'}).click()
 await page.getByRole('button',{name:'Cultivos para mi zona'}).click()
 await expect(page.getByRole('heading',{name:'Cultivos para mi zona'})).toBeVisible()
 await expect(page.getByText('¿Qué cultivo tienes o quieres sembrar?')).toBeVisible()
 await page.getByLabel('¿Qué cultivo tienes o quieres sembrar?').fill('camote')
 await page.getByRole('button',{name:/Camote.*Seleccionar/}).click()
 await expect(page.getByText('Cultivo elegido:')).toBeVisible()
 await page.getByRole('button',{name:'Revisar este cultivo y otras opciones'}).click()
 await expect(page.getByText('Datos regionales de 2021 a 2025')).toBeVisible()
 await expect(page.getByText(/La temperatura regional coincide/).first()).toBeVisible()
 await expect(page.getByText(/NO recomendaciones de siembra/)).toBeVisible()
 await page.getByRole('button',{name:'Ver mi tablero e informe →'}).click()
 await expect(page.getByText('Mi cultivo')).toBeVisible()
 await expect(page.getByText('Camote').first()).toBeVisible()
 await expect(page.getByText('Lluvia anual media:')).toBeVisible()
 await expect(page.getByText(/Antes de sembrar, ¿qué falta comprobar/)).toBeVisible()
 await expect(page.getByText(/^S0$|^S1$|^S2$/)).toHaveCount(0)
})

test('report invokes native print dialog, from which PDF can be saved',async({page})=>{
 await page.addInitScript(()=>{(window as Window & {__printed?:number}).__printed=0;window.print=()=>{(window as Window & {__printed?:number}).__printed!++}})
 await page.goto('/?vista=clima')
 await page.getByRole('button',{name:'Consultar Huando'}).click()
 await page.getByRole('button',{name:'Mi tablero',exact:true}).click()
 await page.getByRole('button',{name:'Imprimir o guardar en PDF'}).click()
 await expect.poll(()=>page.evaluate(()=>(window as Window & {__printed?:number}).__printed)).toBe(1)
 await expect(page.getByText(/Guardar como PDF/)).toBeVisible()
})

test('mobile crop search works without photo or unvalidated artificial vision',async({page})=>{
 await page.setViewportSize({width:390,height:844})
 await page.goto('/?vista=clima')
 await page.getByRole('button',{name:'Consultar Huando'}).click()
 await page.getByRole('button',{name:'Cultivos para mi zona'}).click()
 await expect(page.locator('#terra-photo-input')).toHaveCount(0)
 await expect(page.getByRole('heading',{name:'Encuentra tu cultivo por su nombre'})).toBeVisible()
 await expect(page.getByLabel('¿Qué cultivo tienes o quieres sembrar?')).toBeVisible()
 await page.getByRole('button',{name:'Tomate',exact:true}).click()
 await expect(page.getByText('Cultivo elegido:')).toBeVisible()
 await page.getByRole('button',{name:'Mi tablero',exact:true}).click()
 await expect(page.getByRole('button',{name:'Guardar este informe en PDF'})).toBeVisible()
})

test('missing NASA data never turns unknown rainfall into zero or invented planting advice',async({page})=>{
 await page.route('**/api/environment/nasa-power/daily**',route=>route.fulfill({status:502,contentType:'application/json',body:'{}'}))
 await page.route('**/api/arie/crop-guidance**',route=>route.fulfill({contentType:'application/json',body:JSON.stringify({
  ...guidance,status:'insufficient_data',climate:{status:'insufficient_data',complete_years:0,temperature_mean_c:null,annual_rain_mm:null,years:[]},
  candidates:candidates.map(item=>({...item,status:'insufficient_evidence',reason:'Aún faltan datos climáticos completos.'}))
 })}))
 await page.goto('/?vista=clima')
 await page.getByRole('button',{name:'Consultar Huando'}).click()
 await page.getByRole('button',{name:'Mi tablero',exact:true}).click()
 await expect(page.getByText('—').first()).toBeVisible()
 await expect(page.getByText(/no está disponible temporalmente/)).toBeVisible()
 await page.getByRole('button',{name:'Cultivos para mi zona'}).click()
 await page.getByRole('button',{name:'Ver cultivos para investigar'}).click()
 await expect(page.getByText(/No encontramos suficientes años completos/)).toBeVisible()
})

test('BIOTEX release manifest identifies the updated farmer application',async({page})=>{
 await page.goto('/?vista=clima')
 await expect(page).toHaveTitle('BIOTEX | Tu chacra y tu plan de siembra')
 await expect(page.locator('meta[name="biotex-release"]')).toHaveAttribute('content','v0.26-trained-hls-ai')
 const release=await page.request.get('/release.json')
 expect(release.ok()).toBeTruthy()
 const payload=await release.json()
 expect(payload.release).toBe('v0.26-nasa-ai-reproducible')
 expect(payload.computer_vision_enabled).toBe(false)
 await page.getByRole('button',{name:'Cultivos para mi zona'}).click()
 await expect(page.locator('#terra-photo-input')).toHaveCount(0)
})

test('NASA GIBS spatial layer and real NASA POWER readings are visible directly on the map',async({page})=>{
 await page.goto('/?vista=clima')
 await expect(page.locator('.farmer-map .leaflet-pane').first()).toHaveCSS('position','absolute')
 await expect(page.getByRole('button',{name:'Lluvia',exact:true})).toHaveAttribute('aria-pressed','true')
 await expect(page.getByRole('button',{name:'Vegetación',exact:true})).toHaveCount(1)
 await expect(page.locator('.farmer-map-readout')).toContainText('Toca un punto')
 await expect(page.locator('img[src*="gibs.earthdata.nasa.gov"][src*="IMERG_Precipitation_Rate"]').first()).toBeAttached()
 await page.getByRole('button',{name:'Consultar Huando'}).click()
 await expect(page.locator('.farmer-map-readout')).toContainText('Datos de NASA para esta zona')
 await expect(page.locator('.farmer-map-readout')).toContainText(/2[.,]5/)
 await expect(page.locator('.farmer-map-readout')).toContainText(/22[.,]0/)
 await expect(page.locator('.farmer-map-readout')).toContainText('NASA POWER: 2026-11-10')
 await expect(page.getByText(/La imagen satelital muestra una zona amplia/)).toBeVisible()
 await page.getByRole('button',{name:'Vegetación',exact:true}).click()
 await expect(page.getByRole('button',{name:'Vegetación',exact:true})).toHaveAttribute('aria-pressed','true')
 await expect(page.locator('img[src*="gibs.earthdata.nasa.gov"][src*="MODIS_Terra_NDVI_8Day"]').first()).toBeAttached()
 await expect(page.getByText('Actividad de la vegetación desde el satélite')).toBeVisible()
})
test('mobile map does not crowd the satellite view with confusing floating controls',async({page})=>{
 await page.setViewportSize({width:375,height:812})
 await page.goto('/?vista=clima')
 await expect(page.locator('.farmer-map')).toBeVisible()
 await expect(page.locator('.leaflet-control-zoom')).toHaveCount(0)
 await expect(page.locator('.farmer-map-toolbar')).toHaveCount(0)
 await expect(page.getByRole('button',{name:'Lluvia',exact:true})).toBeVisible()
 await expect(page.getByRole('button',{name:'Vegetación',exact:true})).toBeVisible()
 await expect(page.getByRole('button',{name:'Dibujar mi chacra'})).toBeVisible()
 const scrollWidth=await page.evaluate(()=>document.documentElement.scrollWidth)
 const viewportWidth=await page.evaluate(()=>window.innerWidth)
 expect(scrollWidth).toBeLessThanOrEqual(viewportWidth+1)
 await page.getByRole('button',{name:'Dibujar mi chacra'}).click()
 await expect(page.getByRole('button',{name:'Terminar'})).toBeDisabled()
 await page.getByRole('button',{name:'Cancelar'}).click()
 await expect(page.getByText('Buscar otro lugar en el mapa')).toBeVisible()
})
