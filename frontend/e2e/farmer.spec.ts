import {test,expect,type Page} from '@playwright/test'
const outline={type:'Polygon',coordinates:[[[-71.961,-13.321],[-71.960,-13.321],[-71.960,-13.322],[-71.961,-13.322],[-71.961,-13.321]]]}
test.beforeEach(async({page})=>{await page.addInitScript(()=>localStorage.setItem('biotex-bio-intro-v1','complete'))})
async function selectEvidence(page:Page){
 await page.goto('/')
 await expect(page.getByRole('button',{name:'Calcular NDVI del terreno'})).toHaveCount(0)
 await page.getByText('Importar contorno GeoJSON (opcional)',{exact:true}).click()
 await page.getByLabel('Contorno GeoJSON',{exact:true}).fill(JSON.stringify(outline))
 await page.getByRole('button',{name:'Usar contorno'}).click()
 await page.getByText('Datos ambientales y satélite (opcional)',{exact:true}).click()
}
test('historical URLs load the same single farmer application',async({page})=>{
 for(const url of ['/?vista=tecnica','/?vista=clima','/?vista=comparador-tecnico','/?pilot=chalhuas']){
  await page.goto(url)
  await expect(page.getByRole('heading',{name:/Conoce tu tierra/})).toBeVisible()
  await expect(page.locator('.b-progress button')).toHaveCount(4)
  await expect(page.locator('a[href*="vista="]')).toHaveCount(0)
 }
})
test('place search and crop reference lookup are inside the shared journey',async({page})=>{
 await page.route('https://nominatim.openstreetmap.org/**',r=>r.fulfill({contentType:'application/json',body:JSON.stringify([{display_name:'Calca, Cusco, Perú',lat:'-13.32',lon:'-71.96'}])}))
 await page.goto('/')
 await page.getByLabel('¿Dónde está tu chacra?').fill('Calca')
 await page.getByRole('button',{name:'Buscar lugar'}).click()
 await page.getByRole('button',{name:/Calca.*Cusco/}).click()
 await expect(page.getByText('Calca, Cusco, Perú',{exact:true})).toBeVisible()
 await page.getByRole('button',{name:'Usar parcela de Barranca',exact:true}).click()
 await page.getByRole('button',{name:'Continuar',exact:true}).click()
 await expect(page.getByRole('heading',{name:'¿Qué cultivos sembraste?'})).toBeVisible()
 await page.getByText('Referencias de cultivos (opcional)',{exact:true}).click()
 await expect(page.getByLabel('Buscar nombre de cultivo')).toBeVisible()
})
test('mobile viewport preserves map drawing and readable controls',async({page})=>{
 await page.setViewportSize({width:390,height:844});await page.goto('/')
 await expect(page.locator('.b-map')).toBeVisible()
 await page.getByRole('button',{name:'Marcar mi chacra'}).click()
 await expect(page.getByRole('button',{name:'Terminar terreno'})).toBeDisabled()
 await page.getByRole('button',{name:'Cancelar',exact:true}).click()
 expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(391)
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
 await selectEvidence(page)
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
 await selectEvidence(page)
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
 await selectEvidence(page)
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
 await selectEvidence(page)
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
 await selectEvidence(page)
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
 await selectEvidence(page)
 await page.getByRole('button',{name:'Consultar celda regional FAO'}).click()
 await expect(page.locator('.terra-gaez-raw-number')).toContainText('Código original de celda FAO: 8')
 await expect(page.locator('.terra-gaez-raw-number')).toContainText('no es un %')
 await expect(page.getByText(/No se genera ninguna recomendación de siembra/)).toBeVisible()
 await expect(page.getByRole('link',{name:/Licencia del conjunto CC BY 4.0/})).toBeVisible()
})

test('network failure in crop catalogue can retry without refresh',async({page})=>{
 let attempts=0
 await page.route('**/api/arie/crops?**',async r=>{attempts++;if(attempts===1){await r.abort('failed');return}await r.fulfill({contentType:'application/json',body:'{"items":[{"id":"maize","name":"Maíz","scientific_name":"Zea mays"}]}'})})
 await page.goto('/');await page.getByRole('button',{name:/Explorar parcela de Barranca/}).click();await page.getByRole('button',{name:'Continuar',exact:true}).click()
 await page.getByText('Referencias de cultivos (opcional)',{exact:true}).click();await page.getByLabel('Buscar nombre de cultivo').fill('maíz');await page.getByRole('button',{name:'Buscar en catálogo'}).click()
 await expect(page.getByText(/No se pudo conectar con CHAKRA/)).toBeVisible();await expect(page.getByText(/Failed to fetch/)).toHaveCount(0)
 await page.getByRole('button',{name:'Buscar en catálogo'}).click();await expect(page.getByRole('button',{name:'Maíz · Zea mays'})).toBeVisible();expect(attempts).toBe(2)
})
test('production API requests honor the configured backend origin',async({page})=>{
 let called='';await page.route('**/api/arie/crops?**',r=>{called=r.request().url();return r.fulfill({contentType:'application/json',body:'{"items":[]}'})})
 await page.goto('/');await page.getByRole('button',{name:/Explorar parcela de Barranca/}).click();await page.getByRole('button',{name:'Continuar',exact:true}).click();await page.getByText('Referencias de cultivos (opcional)',{exact:true}).click();await page.getByLabel('Buscar nombre de cultivo').fill('maíz');await page.getByRole('button',{name:'Buscar en catálogo'}).click()
 await expect.poll(()=>called).not.toBe('');expect(new URL(called).origin).toBe(process.env.E2E_API_ORIGIN||new URL(page.url()).origin)
})
test('crop photo preview stays local and never claims automatic AI identification',async({page})=>{
 const uploads:string[]=[];page.on('request',r=>{if(r.method()==='POST')uploads.push(r.url())})
 await page.goto('/');await page.getByRole('button',{name:/Explorar parcela de Barranca/}).click();await page.getByRole('button',{name:'Continuar',exact:true}).click();await page.getByText('Foto de referencia (solo en tu dispositivo)',{exact:true}).click()
 const picker=page.locator('#terra-photo-input');await expect(picker).toHaveAttribute('capture','environment');await expect(page.getByText(/identificación automática aún no está disponible/)).toBeVisible()
 await picker.setInputFiles({name:'hoja.png',mimeType:'image/png',buffer:Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jBuQAAAAASUVORK5CYII=','base64')})
 await expect(page.getByText('Foto lista')).toBeVisible();await expect(page.locator('.terra-camera-preview img')).toHaveAttribute('src',/^blob:/);expect(uploads).toEqual([])
 await page.getByRole('button',{name:'Quitar foto'}).click();await expect(page.locator('.terra-camera-preview img')).toHaveCount(0)
})
