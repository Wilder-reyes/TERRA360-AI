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
 await expect(page.locator('.terra-geo-layer-pills button').filter({hasText:/^Lluvia$/})).toBeVisible()
 await expect(page.locator('a[href$=".json"]')).toHaveCount(0)
 await expect(page.getByText(/^S[012]$/)).toHaveCount(0)
})

test('find a city, open crop search, and read plain-language evidence',async({page})=>{
 await page.goto('/')
 await page.getByLabel('Busca una localidad en el mapa').fill('Calca')
 await page.getByRole('button',{name:'Buscar',exact:true}).click()
 await page.getByRole('button',{name:/Calca.*Cusco.*Perú/}).click()
 await page.locator('.step-nav button').filter({hasText:'Mis cultivos'}).click()
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

test('Sentinel-2 parcel NDVI needs a drawn area and explains pixel quality',async({page})=>{
 await page.route('**/api/environment/sentinel-2/parcel-ndvi',async route=>{
  const payload=route.request().postDataJSON()
  expect(payload.polygon.type).toBe('Polygon')
  expect(payload.polygon.coordinates[0]).toHaveLength(5)
  await route.fulfill({contentType:'application/json',body:JSON.stringify({
   source:'ESA Sentinel-2 L2A via Microsoft Planetary Computer',
   source_url:'https://planetarycomputer.microsoft.com/api/stac/v1',
   product:'Sentinel-2 L2A BOA',
   status:'available',
   scene:{id:'scene-example',date:'2026-11-04',cloud_cover_percent_scene:30.52,
          processing_baseline:'05.13',platform:'Sentinel-2C'},
   parcel_area_ha_approx:1.25,
   attempted_scenes:1,
   metrics:{status:'available',parcel_pixels:596,valid_pixels:596,
            valid_fraction_percent:98.3,scene_coverage_percent_approx:98.3,
            scl_classes_within_parcel:{4:48,5:548},
            ndvi:{mean:.1776,median:.1277,p10:.0128,p90:.4404,spatial_std:.1658,min:-.1082,max:.7905}},
   uncertainty:[],
   used_in_crop_decision:false
  })})
 })
 await page.goto('/')
 await page.getByRole('button',{name:'NDVI Sentinel-2 de parcela'}).click()
 await expect(page.getByText(/Primero delimita un rectángulo o polígono/)).toBeVisible()
 await expect(page.getByRole('button',{name:'Calcular NDVI del terreno'})).toHaveCount(0)
 await page.getByLabel('Busca una localidad en el mapa').fill('Calca')
 await page.getByRole('button',{name:'Buscar',exact:true}).click()
 await page.getByRole('button',{name:/Calca.*Cusco.*Perú/}).click()
 for(let i=0;i<6;i++)await page.locator('.leaflet-control-zoom-in').click()
 const map=page.locator('.terra-geo-map')
 const rect=await map.boundingBox()
 expect(rect).not.toBeNull()
 await page.getByRole('button',{name:'Delimitar área aproximada'}).click()
 await map.click({position:{x:Math.round(rect!.width/2-45),y:Math.round(rect!.height/2-40)}})
 await map.click({position:{x:Math.round(rect!.width/2+45),y:Math.round(rect!.height/2+40)}})
 await expect(page.getByText(/Área dibujada:/)).toBeVisible()
 await page.getByRole('button',{name:'Calcular NDVI del terreno'}).click()
 await expect(page.getByText('NDVI promedio (sin unidades)')).toBeVisible()
 await expect(page.getByText('0.178')).toBeVisible()
 await expect(page.getByText(/Cobertura utilizable aproximada/)).toBeVisible()
 await expect(page.getByText(/NO precisión ni intervalo de confianza/)).toBeVisible()
 await expect(page.getByText(/No se utiliza para recomendar cultivos/)).toBeVisible()
})

test('multiple Sentinel-2 dates expose quality gaps without declaring crop trends',async({page})=>{
 await page.route('**/api/environment/sentinel-2/parcel-ndvi-series',async route=>{
  const payload=route.request().postDataJSON()
  expect(payload.polygon.type).toBe('Polygon')
  expect(payload.max_observations).toBe(4)
  expect(payload.days).toBe(180)
  await route.fulfill({contentType:'application/json',body:JSON.stringify({
   status:'available',source:'ESA/Copernicus Sentinel-2 L2A',
   source_url:'https://planetarycomputer.microsoft.com/api/stac/v1',
   period:{start:'2026-05-18',end:'2026-11-14'},
   attempted_scenes:3,valid_observation_count:2,parcel_area_ha_approx:1.2,
   can_infer_vegetation_trend:false,used_in_crop_decision:false,
   observations:[
    {date:'2026-09-01',scene_id:'a',satellite:'Sentinel-2C',scene_cloud_percent:22,
     processing_baseline:'05.13',status:'available',
     metrics:{valid_pixels:600,valid_fraction_percent:91.2,
              ndvi:{mean:.2071,median:.2,p10:.1,p90:.4}}},
    {date:'2026-10-01',scene_id:'b',satellite:'Sentinel-2C',scene_cloud_percent:54,
     processing_baseline:'05.13',status:'insufficient_clear_pixels',
     metrics:{valid_pixels:11,valid_fraction_percent:3.2,ndvi:null}},
    {date:'2026-11-04',scene_id:'c',satellite:'Sentinel-2C',scene_cloud_percent:30,
     processing_baseline:'05.13',status:'available',
     metrics:{valid_pixels:596,valid_fraction_percent:98.3,
              ndvi:{mean:.1776,median:.1277,p10:.0128,p90:.44}}}
   ],limitations:[]
  })})
 })
 await page.goto('/')
 await page.getByRole('button',{name:'NDVI Sentinel-2 de parcela'}).click()
 await expect(page.getByRole('button',{name:'Ver observaciones por fecha'})).toBeDisabled()
 await page.getByLabel('Busca una localidad en el mapa').fill('Calca')
 await page.getByRole('button',{name:'Buscar',exact:true}).click()
 await page.getByRole('button',{name:/Calca.*Cusco.*Perú/}).click()
 for(let i=0;i<6;i++)await page.locator('.leaflet-control-zoom-in').click()
 const map=page.locator('.terra-geo-map')
 const rect=await map.boundingBox()
 expect(rect).not.toBeNull()
 await page.getByRole('button',{name:'Delimitar área aproximada'}).click()
 await map.click({position:{x:Math.round(rect!.width/2-45),y:Math.round(rect!.height/2-40)}})
 await map.click({position:{x:Math.round(rect!.width/2+45),y:Math.round(rect!.height/2+40)}})
 await page.getByRole('button',{name:'Ver observaciones por fecha'}).click()
 await expect(page.getByText('Fechas utilizables:')).toBeVisible()
 await expect(page.getByRole('row',{name:/2026-10-01/})).toContainText('—')
 await expect(page.getByRole('row',{name:/2026-09-01/})).toContainText('0.207')
 await expect(page.getByRole('row',{name:/2026-11-04/})).toContainText('0.178')
 await expect(page.getByText(/NO demuestran una tendencia/)).toBeVisible()
 await expect(page.getByText(/No usado por ARIE/)).toBeVisible()
})

test('GPM polygon layer does not present invented rainfall when NASA file is absent',async({page})=>{
 await page.route('**/api/environment/gpm-imerg/polygon-daily',async route=>{
  const req=route.request().postDataJSON()
  expect(req.polygon.type).toBe('Polygon')
  expect(req.polygon.coordinates[0]).toHaveLength(5)
  expect(req.target_date).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  await route.fulfill({contentType:'application/json',body:JSON.stringify({
   status:'data_unavailable',source:'NASA GPM IMERG Late Daily V07',
   source_url:'https://disc.gsfc.nasa.gov/datasets/GPM_3IMERGDL_07/summary',
   unit:'mm/day',date:req.target_date,native_resolution:'0.1°',
   area_ha_approx:1.23,valid_area_percent_approx:0,grid_cell_count:0,
   precipitation_mm_day:null,cells:[],limitations:[],
   used_in_crop_decision:false,can_infer_field_rainfall:false
  })})
 })
 await page.goto('/')
 await page.getByRole('button',{name:'Lluvia GPM por área'}).click()
 await expect(page.getByRole('button',{name:'Consultar lluvia regional'})).toBeDisabled()
 await expect(page.getByText(/Primero dibuja un polígono o rectángulo/)).toBeVisible()
 await page.getByLabel('Busca una localidad en el mapa').fill('Calca')
 await page.getByRole('button',{name:'Buscar',exact:true}).click()
 await page.getByRole('button',{name:/Calca.*Cusco.*Perú/}).click()
 for(let i=0;i<6;i++)await page.locator('.leaflet-control-zoom-in').click()
 const map=page.locator('.terra-geo-map')
 const box=await map.boundingBox()
 expect(box).not.toBeNull()
 await page.getByRole('button',{name:'Delimitar área aproximada'}).click()
 await map.click({position:{x:Math.round(box!.width/2-45),y:Math.round(box!.height/2-40)}})
 await map.click({position:{x:Math.round(box!.width/2+45),y:Math.round(box!.height/2+40)}})
 await page.getByRole('button',{name:'Consultar lluvia regional'}).click()
 await expect(page.getByText(/No hay un archivo diario NASA autorizado/)).toBeVisible()
 await expect(page.getByText(/no se crean datos dentro de cada celda/i)).toBeVisible()
 await expect(page.getByText(/no se usan para elegir cultivos/i)).toBeVisible()
 await expect(page.getByText(/mm\/día/i)).toHaveCount(0)
})

test('GPM polygon shows coarse area overlap and quality when valid sample is returned',async({page})=>{
 await page.route('**/api/environment/gpm-imerg/polygon-daily',async route=>{
  await route.fulfill({contentType:'application/json',body:JSON.stringify({
   status:'available',date:'2026-11-08',
   source:'NASA GPM IMERG Late Daily V07',
   source_url:'https://disc.gsfc.nasa.gov/datasets/GPM_3IMERGDL_07/summary',
   unit:'mm/day',native_resolution:'0.1°',
   area_ha_approx:1.23,valid_area_percent_approx:100,
   grid_cell_count:1,valid_grid_cell_count:1,precipitation_mm_day:5.125,
   cells:[{center_latitude:-13.35,center_longitude:-71.95,
           overlap_area_percent_approx:100,precipitation_mm_day:5.125,valid:true}],
   limitations:[],used_in_crop_decision:false,can_infer_field_rainfall:false
  })})
 })
 await page.goto('/')
 await page.getByRole('button',{name:'Lluvia GPM por área'}).click()
 await page.getByLabel('Busca una localidad en el mapa').fill('Calca')
 await page.getByRole('button',{name:'Buscar',exact:true}).click()
 await page.getByRole('button',{name:/Calca.*Cusco.*Perú/}).click()
 for(let i=0;i<6;i++)await page.locator('.leaflet-control-zoom-in').click()
 const map=page.locator('.terra-geo-map')
 const box=await map.boundingBox()
 expect(box).not.toBeNull()
 await page.getByRole('button',{name:'Delimitar área aproximada'}).click()
 await map.click({position:{x:Math.round(box!.width/2-45),y:Math.round(box!.height/2-40)}})
 await map.click({position:{x:Math.round(box!.width/2+45),y:Math.round(box!.height/2+40)}})
 await page.getByRole('button',{name:'Consultar lluvia regional'}).click()
 await expect(page.getByText('5.13 mm/día').first()).toBeVisible()
 await expect(page.getByText(/Una sola celda de 0,1°/)).toBeVisible()
 await expect(page.getByText(/NO la resolución del satélite/)).toBeVisible()
})
