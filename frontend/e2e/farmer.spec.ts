import {test,expect} from '@playwright/test'

const crops=Object.fromEntries([
 ['maize','Maíz Blanco Gigante del Cusco','Zea mays','Poaceae'],
 ['tarwi','Tarwi','Lupinus mutabilis','Fabaceae'],
 ['faba','Haba','Vicia faba','Fabaceae'],
 ['potato','Papa','Solanum tuberosum','Solanaceae'],
 ['barley','Cebada','Hordeum vulgare','Poaceae']
].map(([id,name,scientific_name,family])=>[id,{name,scientific_name,family,role:'Cultivo',kc:null,kc_note:'Sin validación local',cycle_days:null,references:[]}]))

test.beforeEach(async({page})=>{
 await page.route('**/api/arie/catalog',route=>route.fulfill({contentType:'application/json',body:JSON.stringify({crops,references:{},scenarios:[]})}))
 await page.route('**/api/environment/nasa-power/daily**',route=>route.fulfill({contentType:'application/json',body:JSON.stringify({
  source:'NASA POWER',data_status:'available',records:[{date:'2026-11-10',PRECTOTCORR:2.1,T2M:13,T2M_MIN:8,T2M_MAX:19,RH2M:68}],
  location:{name:'Punto elegido',latitude:-13.32,longitude:-71.96},
  period:{start:'2026-11-10',end:'2026-11-10'},spatial_representation:'regional grid'
 })}))
 await page.route('https://geocoding-api.open-meteo.com/**',route=>route.fulfill({contentType:'application/json',body:JSON.stringify({results:[{id:123,name:'Calca',admin1:'Cusco',country:'Perú',latitude:-13.32,longitude:-71.96}]})}))
})

test('farmer-first map works without exposing API codes or downloads',async({page})=>{
 await page.goto('/')
 await expect(page.getByRole('heading',{name:'Explora tu terreno y su entorno'})).toBeVisible()
 await expect(page.getByRole('region',{name:'Mapa agrícola interactivo'})).toBeVisible()
 await expect(page.getByRole('button',{name:'Dibujar polígono'})).toBeVisible()
 await expect(page.getByRole('button',{name:'Mapa de relieve'})).toBeVisible()
 await expect(page.getByRole('button',{name:'Lluvia'})).toBeVisible()
 await expect(page.locator('a[href$=".json"]')).toHaveCount(0)
 await expect(page.getByText(/^S[012]$/)).toHaveCount(0)
})

test('find a city, open crop search, and read plain-language evidence',async({page})=>{
 await page.goto('/')
 await page.getByLabel('Busca una localidad en el mapa').fill('Calca')
 await page.getByRole('button',{name:'Buscar',exact:true}).click()
 await page.getByRole('button',{name:/Calca.*Cusco.*Perú/}).click()
 await page.getByRole('button',{name:'Mis cultivos'}).click()
 await expect(page.getByRole('heading',{name:'¿Qué te gustaría sembrar?'})).toBeVisible()
 await page.getByLabel('Busca un cultivo por nombre o especie').fill('maíz')
 await expect(page.getByRole('heading',{name:/Maíz Blanco Gigante/})).toBeVisible()
 await expect(page.locator('.crop-choice')).toHaveCount(1)
})

test('mobile viewport preserves geospatial workspace and readable controls',async({page})=>{
 await page.setViewportSize({width:390,height:844})
 await page.goto('/')
 await expect(page.getByRole('region',{name:'Mapa agrícola interactivo'})).toBeVisible()
 await expect(page.getByLabel('Busca una localidad en el mapa')).toBeVisible()
 await expect(page.getByRole('button',{name:'Dibujar polígono'})).toBeVisible()
 await expect(page.locator('a[href$=".json"]')).toHaveCount(0)
})
