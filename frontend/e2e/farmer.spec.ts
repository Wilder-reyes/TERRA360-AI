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
 await expect(page.locator('.terra-geo-mapbox')).toBeVisible()
 await expect(page.locator('[data-pilot-center]')).toHaveAttribute('data-pilot-center','-11.47918514,-77.18041962')
 await expect(page.getByText('Empezamos en Huando, Huaral')).toBeVisible()
 await expect(page.getByText('Más mapas y datos',{exact:true})).toBeVisible()
 await expect(page.getByRole('button',{name:'Mapa de relieve'})).toBeHidden()
 await page.getByText('Más mapas y datos',{exact:true}).click()
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
 await expect(page.getByRole('heading',{name:'Elige tu cultivo por su nombre'})).toBeVisible()
 await expect(page.getByRole('heading',{name:'¿Quieres reconocer tu cultivo con una foto?'})).toBeVisible()
 await expect(page.getByText(/no se envía ni se usa para entrenar inteligencia artificial/)).toBeVisible()
 await page.getByLabel('Escribe el nombre de tu cultivo').fill('maíz')
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
 await page.getByRole('button',{name:'Vegetación de mi terreno'}).click()
 await expect(page.getByText(/Primero delimita un rectángulo o polígono/)).toBeVisible()
 await expect(page.getByRole('button',{name:'Calcular NDVI del terreno'})).toHaveCount(0)
 await page.getByLabel('Busca una localidad en el mapa').fill('Calca')
 await page.getByRole('button',{name:'Buscar',exact:true}).click()
 await page.getByRole('button',{name:/Calca.*Cusco.*Perú/}).click()
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
 await page.getByRole('button',{name:'Vegetación de mi terreno'}).click()
 await expect(page.getByRole('button',{name:'Ver observaciones por fecha'})).toBeDisabled()
 await page.getByLabel('Busca una localidad en el mapa').fill('Calca')
 await page.getByRole('button',{name:'Buscar',exact:true}).click()
 await page.getByRole('button',{name:/Calca.*Cusco.*Perú/}).click()
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
 await page.getByText('Más mapas y datos',{exact:true}).click()
 await page.getByRole('button',{name:'Lluvia GPM por área'}).click()
 await expect(page.getByRole('button',{name:'Consultar lluvia regional'})).toBeDisabled()
 await expect(page.getByText(/Primero dibuja un polígono o rectángulo/)).toBeVisible()
 await page.getByLabel('Busca una localidad en el mapa').fill('Calca')
 await page.getByRole('button',{name:'Buscar',exact:true}).click()
 await page.getByRole('button',{name:/Calca.*Cusco.*Perú/}).click()
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
 await page.getByText('Más mapas y datos',{exact:true}).click()
 await page.getByRole('button',{name:'Lluvia GPM por área'}).click()
 await page.getByLabel('Busca una localidad en el mapa').fill('Calca')
 await page.getByRole('button',{name:'Buscar',exact:true}).click()
 await page.getByRole('button',{name:/Calca.*Cusco.*Perú/}).click()
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

test('SMAP native 9 km reading has explicit no-data and never acts as irrigation advice',async({page})=>{
 await page.route('**/api/environment/smap/regional-daily',async route=>{
  const input=route.request().postDataJSON()
  expect(input.polygon.type).toBe('Polygon')
  expect(input.polygon.coordinates[0]).toHaveLength(5)
  await route.fulfill({contentType:'application/json',body:JSON.stringify({
   status:'data_unavailable',source_url:'https://nsidc.org/data/spl3smp_e/versions/6',
   date:input.target_date,product:'SPL3SMP_E',version:'006',unit:'m3/m3',
   native_resolution_m:9000,soil_moisture_m3_m3:null,cell:null,
   used_in_crop_decision:false,can_infer_field_soil_moisture:false,limitations:[]
  })})
 })
 await page.goto('/')
 await page.getByText('Más mapas y datos',{exact:true}).click()
 await page.getByRole('button',{name:'Humedad regional SMAP'}).click()
 await expect(page.getByText(/Celda satelital original de 9 km/)).toBeVisible()
 await expect(page.getByRole('button',{name:'Consultar celda regional SMAP'})).toBeDisabled()
 await page.getByLabel('Busca una localidad en el mapa').fill('Calca')
 await page.getByRole('button',{name:'Buscar',exact:true}).click()
 await page.getByRole('button',{name:/Calca.*Cusco.*Perú/}).click()
 const map=page.locator('.terra-geo-map')
 const rect=await map.boundingBox();expect(rect).not.toBeNull()
 await page.getByRole('button',{name:'Delimitar área aproximada'}).click()
 await map.click({position:{x:Math.round(rect!.width/2-45),y:Math.round(rect!.height/2-40)}})
 await map.click({position:{x:Math.round(rect!.width/2+45),y:Math.round(rect!.height/2+40)}})
 await page.getByRole('button',{name:'Consultar celda regional SMAP'}).click()
 await expect(page.getByText(/No hay un archivo SMAP autorizado/)).toBeVisible()
 await expect(page.getByText(/No determina el riego/)).toBeVisible()
 await expect(page.getByText(/m³\/m³/)).toHaveCount(0)
})

test('FAO GAEZ real-source tab labels raw regional code without claiming crop suitability',async({page})=>{
 await page.route('**/api/environment/gaez-v5/selected-layer/raw-cell',async route=>{
  const input=route.request().postDataJSON()
  expect(input.polygon.type).toBe('Polygon')
  expect(input.polygon.coordinates[0]).toHaveLength(5)
  await route.fulfill({contentType:'application/json',body:JSON.stringify({
   status:'raw_code_available',variable_code:'RES05-SIX',
   crop:'Cassava / Manihot esculenta',period:'2001–2020 historical',
   management:'Rainfed, low inputs',
   inspected_sha256:'196c8d806e2fa2e6da4bc09fe30de2c6e40607ba2436d5b484d5957bb7c25156',
   source_raster_url:'https://storage.googleapis.com/fao-gismgr-gaez-v5-data/DATA/GAEZ-V5/MAPSET/RES05-SIX/GAEZ-V5.RES05-SIX.HP0120.AGERA5.HIST.CSV.LRLM.tif',
   source_dataset_license_url:'https://creativecommons.org/licenses/by/4.0/',
   original_cell_class_code:8,
   cell_center_lon_lat:[-71.9583,-13.2917],
   native_grid_resolution_degrees:1/12,
   suitability_index:null,used_in_crop_decision:false,
   interpretation_status:'uninterpreted_original_class_code',
   limitations:[]
  })})
 })
 await page.goto('/')
 await page.getByText('Más mapas y datos',{exact:true}).click()
 await page.getByRole('button',{name:'Código FAO GAEZ v5'}).click()
 await expect(page.getByRole('button',{name:'Consultar celda regional FAO'})).toBeDisabled()
 await expect(page.getByText(/La codificación numérica aún no está interpretada científicamente/)).toBeVisible()
 await page.getByLabel('Busca una localidad en el mapa').fill('Calca')
 await page.getByRole('button',{name:'Buscar',exact:true}).click()
 await page.getByRole('button',{name:/Calca.*Cusco.*Perú/}).click()
 const map=page.locator('.terra-geo-map')
 const rect=await map.boundingBox();expect(rect).not.toBeNull()
 await page.getByRole('button',{name:'Delimitar área aproximada'}).click()
 await map.click({position:{x:Math.round(rect!.width/2-45),y:Math.round(rect!.height/2-40)}})
 await map.click({position:{x:Math.round(rect!.width/2+45),y:Math.round(rect!.height/2+40)}})
 await page.getByRole('button',{name:'Consultar celda regional FAO'}).click()
 await expect(page.locator('.terra-gaez-raw-number')).toContainText('Código original de celda FAO: 8')
 await expect(page.locator('.terra-gaez-raw-number')).toContainText('no es un %')
 await expect(page.getByText(/No se genera ninguna recomendación de siembra/)).toBeVisible()
 await expect(page.getByRole('link',{name:/Licencia del conjunto CC BY 4.0/})).toBeVisible()
})

test('network failure shows a friendly message and catalog can retry without refresh',async({page})=>{
 let attempts=0
 await page.route('**/api/arie/catalog',async route=>{
  attempts+=1
  if(attempts===1){await route.abort('failed');return}
  await route.fulfill({contentType:'application/json',body:JSON.stringify({crops,references:{},scenarios:[]})})
 })
 await page.goto('/')
 await expect(page.getByText(/No se pudo conectar con TERRA360/)).toBeVisible()
 await expect(page.getByText(/Failed to fetch/)).toHaveCount(0)
 await page.getByRole('button',{name:'Volver a intentar'}).click()
 await expect(page.getByText(/No se pudo conectar con TERRA360/)).toHaveCount(0)
 await page.getByLabel('Busca una localidad en el mapa').fill('Calca')
 await page.getByRole('button',{name:'Buscar',exact:true}).click()
 await page.getByRole('button',{name:/Calca.*Cusco.*Perú/}).click()
 await page.locator('.step-nav button').filter({hasText:'Mis cultivos'}).click()
 await expect(page.getByRole('heading',{name:/Maíz Blanco Gigante/})).toBeVisible()
 expect(attempts).toBeGreaterThanOrEqual(2)
})

test('browser production must not depend on VITE_API_URL cross-origin override',async({page})=>{
 const requests:string[]=[]
 page.on('request',req=>{if(req.url().includes('/api/arie/catalog'))requests.push(req.url())})
 await page.goto('/')
 await expect(page.getByRole('heading',{name:'Explora tu terreno y su entorno'})).toBeVisible()
 await expect.poll(()=>requests.length).toBeGreaterThan(0)
 expect(new URL(requests[0]).origin).toBe(new URL(page.url()).origin)
})

test('Huando farmer onboarding keeps photos local and no invented crop AI',async({page})=>{
 await page.setViewportSize({width:390,height:844})
 await page.goto('/')
 await expect(page.getByText('Huando, Huaral · vista inicial')).toBeVisible()
 await expect(page.getByText('¿Qué significan los colores?')).toBeVisible()
 await expect(page.getByRole('button',{name:'Vegetación de mi terreno'})).toBeVisible()
 await expect(page.getByText('No se identifica ningún cultivo automáticamente')).toHaveCount(0)
 await page.getByLabel('Busca una localidad en el mapa').fill('Calca')
 await page.getByRole('button',{name:'Buscar',exact:true}).click()
 await page.getByRole('button',{name:/Calca.*Cusco.*Perú/}).click()
 await page.locator('.step-nav button').filter({hasText:'Mis cultivos'}).click()
 const picker=page.locator('#terra-photo-input')
 await expect(picker).toHaveAttribute('capture','environment')
 await expect(page.getByText(/identificación automática aún no está disponible/)).toBeVisible()
 await picker.setInputFiles({name:'hoja.png',mimeType:'image/png',buffer:Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jBuQAAAAASUVORK5CYII=','base64')})
 await expect(page.getByText('Foto lista')).toBeVisible()
 await expect(page.locator('.terra-camera-preview img')).toHaveAttribute('src',/^blob:/)
 await page.getByRole('button',{name:'Quitar foto'}).click()
 await expect(page.locator('.terra-camera-preview img')).toHaveCount(0)
})
