import {test,expect} from '@playwright/test'

// Synthetic UI fixtures only. Production layers are independently pinned and
// tested against the FAO originals in tests/test_suitability.py.
const bbox=[-72.33333333333333,-13.75,-71.66666666666667,-13.083333333333329]
const crops=[{id:'maize',name:'Maíz (grano)',name_en:'Maize (grain)',available:true},
 {id:'potato',name:'Papa',name_en:'White potato',available:true},
 {id:'barley',name:'Cebada',name_en:'Barley',available:true},
 {id:'faba',name:'Haba · sin capa disponible',name_en:'Faba bean · layer unavailable',available:false}]
const management=[{id:'LRLM',name:'Secano · insumos bajos',name_en:'Rainfed · low inputs'},
 {id:'HRLM',name:'Secano · insumos altos',name_en:'Rainfed · high inputs'},
 {id:'LILM',name:'Riego · insumos bajos',name_en:'Irrigated · low inputs'},
 {id:'HILM',name:'Riego · insumos altos',name_en:'Irrigated · high inputs'}]
const source={name:'FAO/IIASA GAEZ v5',period:'2001–2020',catalog_url:'https://data.apps.fao.org/catalog/dataset/514c92d5-9e01-4c70-814a-80ea1ca9fe6a',license_url:'https://creativecommons.org/licenses/by/4.0/',license:'CC BY 4.0',attribution:'FAO and IIASA. Test fixture.'}
const catalog={source,pilot_bbox:bbox,coverage:{bbox:[-74,-15,-70,-11],name:'Cusco',name_en:'Cusco'},crops,management,
 factors:[{id:'temperature',name:'Temperatura',detail:'Clima histórico.'},{id:'precipitation',name:'Precipitaciones',detail:'Balance de agua.'},{id:'soil_water',name:'Agua en el suelo',detail:'Disponibilidad hídrica modelada. Sin medición actual de humedad.'},{id:'terrain',name:'Terreno',detail:'Pendiente.'},{id:'soil',name:'Propiedades del suelo',detail:'HWSD v2.'}]}
function mapFixture(input:any,onlyMissing=false){
 const groupNames=['suitable','moderate','low','no_data','water']
 const features=(onlyMissing?['no_data']:groupNames).map((group,i)=>({type:'Feature',id:`1239:${1294+i}`,
  properties:{row:1239,col:1294+i,class_code:onlyMissing?0:[1,4,8,0,9][i],class_label:['Muy alta','Media','No apta','Sin datos','Agua'][i],class_label_en:['Very high','Medium','Not suitable','No data','Water'][i],group},
  geometry:{type:'Polygon',coordinates:[[[-72.1666666667+i/12,-13.3333333333],[-72.0833333333+i/12,-13.3333333333],[-72.0833333333+i/12,-13.25],[-72.1666666667+i/12,-13.25],[-72.1666666667+i/12,-13.3333333333]]]}}))
 return {status:onlyMissing?'no_land_data':'available',map:{crop:crops.find(c=>c.id===input.crop_id),management:input.management,bbox:input.bbox,geojson:{type:'FeatureCollection',features},
  summary:{cells:Object.fromEntries(groupNames.map(g=>[g,onlyMissing?(g==='no_data'?1:0):1])),area_km2:Object.fromEntries(groupNames.map(g=>[g,onlyMissing?(g==='no_data'?80:0):80])),total_cells:features.length,land_data_coverage_percent:onlyMissing?0:60},source}}
}

test.beforeEach(async({page})=>{
 await page.route('**/api/arie/catalog',r=>r.fulfill({json:{crops:{},references:{}}}))
 await page.route('**/api/environment/nasa-power/daily**',r=>r.fulfill({json:{records:[],period:{start:'2026-11-01',end:'2026-11-14'}}}))
 await page.route('**/api/agro/suitability/catalog',r=>r.fulfill({json:catalog}))
})

async function openSuitability(page:any){
 await page.goto('/')
 await page.getByRole('button',{name:'Aptitud agrícola',exact:true}).click()
 await expect(page.getByLabel('Cultivo',{exact:true})).toBeVisible()
}

test('native overlay, legend, original cell classes and explicit management',async({page})=>{
 await page.route('**/api/agro/suitability/map',r=>{
  expect(r.request().postDataJSON()).toEqual({crop_id:'barley',management:'LRLM',bbox})
  return r.fulfill({json:mapFixture(r.request().postDataJSON())})
 })
 await openSuitability(page)
 await expect(page.getByRole('button',{name:'Mostrar aptitud',exact:true})).toBeDisabled()
 await page.getByLabel('Escenario de agua y manejo').selectOption('LRLM')
 await page.getByRole('button',{name:'Mostrar aptitud',exact:true}).click()
 await expect(page.locator('.terra-suitability-cell')).toHaveCount(5)
 await expect(page.getByRole('table')).toBeVisible()
 await expect(page.getByText('Cobertura de datos terrestres:',{exact:false})).toContainText('60%')
 await page.locator('.terra-suitability-cell').first().click({force:true})
 await expect(page.locator('.leaflet-popup')).toContainText('Clase FAO 1: Muy alta')
 await expect(page.locator('.terra-suitability-cell')).toHaveCount(5)
 await page.getByText('¿Qué condiciones considera?',{exact:true}).click()
 await expect(page.getByText('Disponibilidad hídrica modelada. Sin medición actual de humedad.',{exact:true})).toBeVisible()
 await page.getByText('Método y fuentes',{exact:true}).click()
 await expect(page.getByText(/El índice de aptitud no es una probabilidad/)).toBeVisible()
 await expect(page.locator('option[value="faba"]')).toHaveAttribute('disabled','')
})

test('crop, water scenario and analysis area clear the previous map',async({page})=>{
 await page.route('**/api/agro/suitability/map',r=>r.fulfill({json:mapFixture(r.request().postDataJSON())}))
 await openSuitability(page)
 await page.getByLabel('Escenario de agua y manejo').selectOption('LRLM')
 await page.getByRole('button',{name:'Mostrar aptitud',exact:true}).click()
 await expect(page.locator('.terra-suitability-cell')).toHaveCount(5)
 await page.getByLabel('Cultivo',{exact:true}).selectOption('potato')
 await expect(page.locator('.terra-suitability-cell')).toHaveCount(0)
 await page.getByRole('button',{name:'Mostrar aptitud',exact:true}).click()
 await expect(page.locator('.terra-suitability-map-label')).toContainText('Papa')
 await page.getByLabel('Escenario de agua y manejo').selectOption('HILM')
 await expect(page.locator('.terra-suitability-cell')).toHaveCount(0)
 await expect(page.getByText(/Este escenario supone riego/)).toBeVisible()
 await page.getByRole('button',{name:'Mostrar aptitud',exact:true}).click()
 await expect(page.locator('.terra-suitability-cell')).toHaveCount(5)
 await page.getByLabel('Área de análisis',{exact:true}).selectOption('viewport')
 await expect(page.locator('.terra-suitability-cell')).toHaveCount(0)
})

test('missing data remains gray and the mobile layout does not overflow',async({page})=>{
 await page.setViewportSize({width:390,height:844})
 await page.route('**/api/agro/suitability/map',r=>r.fulfill({json:mapFixture(r.request().postDataJSON(),true)}))
 await openSuitability(page)
 await page.getByLabel('Escenario de agua y manejo').selectOption('LRLM')
 await page.getByRole('button',{name:'Mostrar aptitud',exact:true}).click()
 await expect(page.getByText(/No hay celdas terrestres clasificadas/)).toBeVisible()
 await expect(page.locator('.terra-suitability-cell')).toHaveCount(1)
 await expect(page.locator('.terra-suitability-cell')).toHaveAttribute('fill','#89939c')
 await expect(page.getByRole('row',{name:'Aptas 0 0',exact:true})).toBeVisible()
 expect(await page.evaluate(()=>document.documentElement.scrollWidth>window.innerWidth)).toBe(false)
})

test('outside coverage and oversized requests show an explanation with no colored result',async({page})=>{
 await page.route('**/api/agro/suitability/map',r=>r.fulfill({json:{status:'outside_coverage',map:null}}))
 await openSuitability(page)
 await page.getByLabel('Escenario de agua y manejo').selectOption('LRLM')
 await page.getByLabel('Área de análisis',{exact:true}).selectOption('viewport')
 await page.getByRole('button',{name:'Mostrar aptitud',exact:true}).click()
 await expect(page.getByText(/La vista está fuera de la ventana preparada/)).toBeVisible()
 await expect(page.locator('.terra-suitability-cell')).toHaveCount(0)
 await page.route('**/api/agro/suitability/map',r=>r.fulfill({status:422,json:{detail:'too many cells'}}))
 await page.getByRole('button',{name:'Mostrar aptitud',exact:true}).click()
 await expect(page.getByText(/Acércate en el mapa/)).toBeVisible()
 await expect(page.locator('.terra-suitability-cell')).toHaveCount(0)
})

test('a late response cannot restore a map for a previously selected crop',async({page})=>{
 let release:()=>void=()=>{}
 let finished:()=>void=()=>{}
 const gate=new Promise<void>(resolve=>{release=resolve})
 const done=new Promise<void>(resolve=>{finished=resolve})
 await page.route('**/api/agro/suitability/map',async r=>{
  const value=mapFixture(r.request().postDataJSON())
  await gate
  try{await r.fulfill({json:value})}finally{finished()}
 })
 await openSuitability(page)
 await page.getByLabel('Escenario de agua y manejo').selectOption('LRLM')
 const started=page.waitForRequest('**/api/agro/suitability/map')
 await page.getByRole('button',{name:'Mostrar aptitud',exact:true}).click()
 await started
 await page.getByLabel('Cultivo',{exact:true}).selectOption('potato')
 release()
 await done
 await expect(page.locator('.terra-suitability-cell')).toHaveCount(0)
 await expect(page.locator('.terra-suitability-map-label')).toHaveCount(0)
 await expect(page.getByRole('button',{name:'Mostrar aptitud',exact:true})).toBeEnabled()
})
