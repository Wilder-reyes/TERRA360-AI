import {test,expect} from '@playwright/test'
import history from '../src/data/barrancaHls.json'
test.beforeEach(async({page})=>{await page.addInitScript(()=>localStorage.setItem('biotex-bio-intro-v1','complete'))})

const message=(text:string)=>({es:[text],en:[text]})
const sections={
 why:message('Se compararon los cultivos registrados.'),
 evidence:message('NASA POWER y calendario agrícola de Lima.'),
 benefits:message('Menor demanda de agua en meses secos.'),
 gaps:message('No contamos con análisis de suelo de la chacra.'),
 risks:message('Consultar disponibilidad real de riego antes de decidir.')
}

const baseline={
 id:'S0',key:'current',title_es:'Siembra actual',title_en:'Current rotation',
 origin:'team_demo',plantings:[{crop_id:'maiz_amarillo_duro',name_es:'Maíz amarillo duro',start_index:0,months:5,approximate:true}],
 timeline:Array.from({length:24},(_,i)=>({index:i,crop_id:i<5?'maiz_amarillo_duro':null,water_mm:i<5?68:0,covered:i<5})),
 indicators:{water_low_river_mm:344,bare_months:19,legume_plantings:0,approximate_crops:[]},
 relative_to_current:null,sections
}
const alternative={
 ...baseline,id:'S1',key:'water',origin:'constrained_search',
 plantings:[{crop_id:'maiz_amarillo_duro',name_es:'Maíz amarillo duro',start_index:5,months:5,approximate:true}],
 timeline:Array.from({length:24},(_,i)=>({index:i,crop_id:i>=5&&i<10?'maiz_amarillo_duro':null,water_mm:i>=5&&i<10?9:0,covered:i>=5&&i<10})),
 indicators:{water_low_river_mm:46,bare_months:19,legume_plantings:0,approximate_crops:[]},
 relative_to_current:{water_low_river_change_percent:-87,water_total_change_percent:-80,bare_months_change:0,legume_plantings_change:0},
 sections
}
const comparison={
 status:'available',recommended_strategy_id:'S1',
 recommendation_reason_es:'Se estima menos demanda de agua en meses secos. El tiempo sin cultivo es similar. Son estimaciones, no una promesa de ahorro.',
 recommendation_reason_en:'Lower estimated crop-water demand in dry months; no change in bare-soil time.',
 strategies:[baseline,alternative],income_crop:'maiz_amarillo_duro'
}

test('Barranca-focused farmer landing starts in ordinary Spanish and moves through crops',async({page})=>{
 await page.goto('/')
 await expect(page.getByRole('heading',{name:'Tu parcela en el mapa. Tu próxima siembra, más clara.'})).toBeVisible()
 await expect(page.getByRole('button',{name:/Explorar parcela de Barranca/})).toBeVisible()
 await expect(page.getByText('Pegar o subir GeoJSON')).toHaveCount(0)
 await page.getByRole('button',{name:/Explorar parcela de Barranca/}).click()
 await expect(page.getByText('Tu terreno está marcado')).toBeVisible()
 await page.getByRole('button',{name:'Continuar'}).click()
 await expect(page.getByRole('heading',{name:'¿Qué cultivos sembraste?'})).toBeVisible()
 await expect(page.getByText('¿No recuerdas alguna siembra?')).toBeVisible()
 await expect(page.getByText(/Fotos del satélite desde 2021/)).toHaveCount(0)
})

test('Location search lets farmers jump to another town without coordinates or code',async({page})=>{
 await page.route('https://nominatim.openstreetmap.org/search**',route=>route.fulfill({
  status:200,contentType:'application/json',headers:{'Access-Control-Allow-Origin':'*'},body:JSON.stringify([
   {display_name:'Huacho, Huaura, Lima, Perú',lat:'-11.120',lon:'-77.604'}
  ])}))
 await page.goto('/')
 await page.getByRole('textbox',{name:'¿Dónde está tu chacra?'}).fill('Huacho')
 await page.getByRole('button',{name:'Buscar lugar'}).click()
 await page.getByRole('button',{name:/Huacho, Huaura, Lima, Perú/}).click()
 await expect(page.getByText('Huacho, Huaura, Lima, Perú')).toBeVisible()
 await expect(page.getByRole('button',{name:'Marcar mi chacra'})).toBeVisible()
})

test('Recommendation is presented as a clear plan and A4 print report, not S1/S2 jargon',async({page})=>{
 await page.route('**/api/rotation/compare',async route=>{
  const request=route.request().postDataJSON()
  expect(request.zone).toBe('barranca')
  expect(request.use_team_templates_as_fallback).toBe(false)
  expect(request.current).toHaveLength(1)
  await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(comparison)})
 })
 await page.goto('/')
 await page.getByRole('button',{name:/Explorar parcela de Barranca/}).click()
 await page.getByRole('button',{name:'Continuar'}).click()
 await page.getByRole('button',{name:'Agregar cultivo'}).click()
 await page.getByRole('button',{name:'Continuar'}).click()
 await expect(page.getByRole('heading',{name:'¿Qué quieres mejorar primero?'})).toBeVisible()
 await page.getByRole('button',{name:/Usar menos agua/}).click()
 await page.getByRole('button',{name:'Ver mi plan'}).click()
 await expect(page.getByRole('heading',{name:'Tu propuesta para sembrar'})).toBeVisible()
 await expect(page.getByText('Rotación para revisar',{exact:true})).toBeVisible()
 await expect(page.getByText(/Se estima menos demanda de agua/).first()).toBeVisible()
 await expect(page.getByRole('button',{name:'Imprimir o guardar PDF'})).toBeVisible()
 await page.emulateMedia({media:'print'})
 await expect(page.locator('.b-print-report')).toBeVisible()
 await expect(page.locator('.b-main')).toBeHidden()
 const pdf=await page.pdf({format:'A4',printBackground:true})
 expect(pdf.byteLength).toBeGreaterThan(4500)
})

test('Mobile farmer flow keeps controls and map inside the viewport',async({page})=>{
 await page.setViewportSize({width:390,height:844})
 await page.goto('/')
 await expect(page.getByRole('heading',{name:'Tu parcela en el mapa. Tu próxima siembra, más clara.'})).toBeVisible()
 await expect(page.locator('.b-map')).toBeVisible()
 await expect(page.getByRole('button',{name:'Buscar lugar'})).toBeVisible()
 const width=await page.evaluate(()=>document.documentElement.scrollWidth)
 expect(width).toBeLessThanOrEqual(392)
})

test('Only one Barranca sample is visible and satellite imagery is accessible',async({page})=>{
 await page.goto('/')
 await expect(page.getByRole('button',{name:/Explorar parcela de Barranca/})).toHaveCount(1)
 await expect(page.getByText('Estos terrenos son ejemplos para probar BIOTEX.')).toHaveCount(0)
 await expect(page.getByText('Ejemplo disponible: Barranca')).toHaveCount(0)
 await expect(page.getByRole('button',{name:'Vegetación NASA'})).toBeVisible()
 await page.getByRole('button',{name:'Vegetación NASA'}).click()
 await expect(page.getByText(/Vegetación regional NASA MODIS/)).toBeVisible()
 await page.getByRole('button',{name:'Lluvia NASA'}).click()
 await expect(page.getByText(/Lluvia regional NASA GPM/)).toBeVisible()
})

test('Satellite clues display acquisition dates, mapped NASA imagery and original HLS scene link',async({page})=>{
 await page.goto('/')
 await page.getByRole('button',{name:/Explorar parcela de Barranca/}).click()
 await page.getByRole('button',{name:'Continuar'}).click()
 await page.getByText('¿No recuerdas alguna siembra?').click()
 await page.getByRole('button',{name:'Buscar pistas con imágenes del terreno'}).click()
 await expect(page.getByText('Así se veía la zona desde el espacio')).toBeVisible()
 const latest=[...history.months].reverse().find(m=>m.ndvi!==null)!
 await expect(page.locator('.b-satellite-gallery select')).toHaveValue(latest.month)
 await expect(page.getByRole('link',{name:'Consultar la imagen HLS utilizada'})).toHaveAttribute('href',/planetarycomputer\.microsoft\.com/)
 await expect(page.locator('.b-satellite-gallery')).toContainText(latest.ndvi!.toFixed(2))
})

test('Farmers can save and restore their marked field without an account',async({page})=>{
 await page.goto('/')
 await page.getByRole('button',{name:/Explorar parcela de Barranca/}).click()
 await expect(page.getByText('Tu terreno está marcado')).toBeVisible()
 await page.getByRole('button',{name:'Guardar mi chacra'}).click()
 await expect(page.getByText('Tus datos se guardaron en este dispositivo.')).toBeVisible()
 await page.reload()
 await page.getByRole('button',{name:'Recuperar mi chacra guardada'}).click()
 await expect(page.getByText('Tu terreno está marcado')).toBeVisible()
 await expect(page.getByText(/Recuperamos tu chacra\. Verifica las fechas/)).toBeVisible()
})

test('Farmer reads a short decision checklist, optional economics are hidden until requested',async({page})=>{
 await page.route('**/api/rotation/compare',route=>route.fulfill({
  status:200,contentType:'application/json',body:JSON.stringify(comparison)
 }))
 await page.route('**/api/rotation/economics',async route=>{
  const inputs=route.request().postDataJSON()
  expect(inputs.crop_budgets).toHaveLength(1)
  expect(inputs.crop_budgets[0]).toMatchObject({
   crop_id:'maiz_amarillo_duro',yield_kg_ha:10000,price_soles_kg:1.5,cost_soles_ha:9000
  })
  await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({
   status:'estimated_from_farmer_inputs',source:'farmer_estimate',
   strategies:[{strategy_id:'S0',status:'estimated_from_farmer_inputs',margin_soles_ha_24months:6000},
               {strategy_id:'S1',status:'estimated_from_farmer_inputs',margin_soles_ha_24months:6000}]
  })})
 })
 await page.goto('/')
 await page.getByRole('button',{name:/Explorar parcela de Barranca/}).click()
 await page.getByRole('button',{name:'Continuar'}).click()
 await page.getByRole('button',{name:'Agregar cultivo'}).click()
 await page.getByRole('button',{name:'Continuar'}).click()
 await page.getByRole('button',{name:'Ver mi plan'}).click()
 await expect(page.getByRole('heading',{name:'Antes de la próxima siembra'})).toBeVisible()
 await expect(page.getByRole('link',{name:'Consultar avisos del tiempo en SENAMHI'})).toBeVisible()
 await expect(page.locator('.b-econ-fields input').first()).toBeHidden()
 await page.locator('.b-farm-econ summary').click()
 const inputs=page.locator('.b-econ-fields input')
 await inputs.nth(0).fill('10000')
 await inputs.nth(1).fill('1.5')
 await inputs.nth(2).fill('9000')
 await page.getByRole('button',{name:'Calcular con mis datos'}).click()
 await expect(page.getByText('Cuenta aproximada de dos años, por hectárea')).toBeVisible()
 await expect(page.locator('.b-econ-result').first()).toContainText('6,000')
 await expect(page.getByText('Fuentes oficiales y datos técnicos')).toBeVisible()
})


test('NASA trained AI influences the farmer workflow and evidence stays optional',async({page})=>{
 const probabilities=Object.fromEntries(Array.from({length:12},(_,i)=>[String(i+1),i>=8&&i<=10?.85:.22]))
 await page.route('**/api/rotation/compare',async route=>{
  const payload=route.request().postDataJSON()
  expect(payload.polygon.type).toBe('Polygon')
  expect(payload.polygon.coordinates[0]).toHaveLength(5)
  expect(payload.zone).toBe('barranca')
  await route.fulfill({status:200,contentType:'application/json',
   body:JSON.stringify({...comparison,
     ai_weighted:true,
     ai_analysis:{
       status:'trained_and_verified',used_for_decision:true,
       model_id:'biotex-barranca-hls-bare-v1',
       source_sensor:'NASA HLS v2.0 (Landsat 8/9 + Sentinel-2, 30 m)',
       observed_months:44,missing_months:27,
       seasonal_bare_probability:probabilities,
       holdout:{brier_model:.23408067,brier_train_prevalence_baseline:.48025712},
       influenced_recommendation:true
     }})})
 })
 await page.goto('/')
 await page.getByRole('button',{name:/Explorar parcela de Barranca/}).click()
 await page.getByRole('button',{name:'Continuar'}).click()
 await page.getByRole('button',{name:'Agregar cultivo'}).click()
 await page.getByRole('button',{name:'Continuar'}).click()
 await page.getByRole('button',{name:'Ver mi plan'}).click()
 await expect(page.getByRole('heading',{name:'¿Qué aprendió BIOTEX de esta chacra?'})).toBeVisible()
 await expect(page.getByText('44 meses con imágenes útiles')).toBeHidden()
 await page.locator('.b-ai-details summary').click()
 await expect(page.getByText('44 meses con imágenes útiles')).toBeVisible()
 await expect(page.locator('.b-ai-month')).toHaveCount(12)
 await expect(page.getByRole('link',{name:'Ver procedimiento reproducible'})).toHaveAttribute('href',/BIOTEX_v026_IA_reproducible/)
})


test('UX Pro Max journey keeps the farmer and clear next action first',async({page})=>{
 await page.goto('/')
 await expect(page.getByText('AGRICULTURA CON EVIDENCIA NASA')).toBeVisible()
 await expect(page.getByText('Paso 1 de 4')).toBeVisible()
 await expect(page.getByRole('link',{name:/Vista para especialistas/})).toHaveCount(0)
 await expect(page.getByText('INICIO RÁPIDO')).toBeVisible()
 await expect(page.getByText('La IA entrenada solo se aplica a esta parcela;')).toBeVisible()
 await page.getByRole('button',{name:/Explorar parcela de Barranca/}).click()
 await expect(page.getByText('Terreno seleccionado. Sigue para registrar tus cultivos.')).toBeVisible()
 await page.getByRole('button',{name:'Continuar'}).click()
 await expect(page.getByText('Paso 2 de 4')).toBeVisible()
 await expect(page.getByText('No hace falta recordar todo.')).toBeVisible()
 await page.getByRole('button',{name:'Agregar cultivo'}).click()
 await page.getByRole('button',{name:'Continuar'}).click()
 await expect(page.getByText('ELIGE LO QUE MÁS TE IMPORTA',{exact:true})).toBeVisible()
 await expect(page.getByText('Equilibrar las dos necesidades en la comparación.')).toBeVisible()
})

test('mobile redesign offers sample before map and never overflows',async({page})=>{
 await page.setViewportSize({width:375,height:812})
 await page.goto('/')
 await expect(page.getByRole('button',{name:/Explorar parcela de Barranca/})).toBeVisible()
 const positions=await page.evaluate(()=>{
  const example=document.querySelector('.b-examples')!.getBoundingClientRect()
  const search=document.querySelector('.b-search-card')!.getBoundingClientRect()
  return {exampleTop:example.top,searchTop:search.top,width:document.documentElement.scrollWidth}
 })
 expect(positions.exampleTop).toBeLessThan(positions.searchTop)
 expect(positions.width).toBeLessThanOrEqual(377)
 await page.getByRole('button',{name:/Explorar parcela de Barranca/}).click()
 await page.getByRole('button',{name:'Continuar'}).click()
 await expect(page.getByRole('heading',{name:'¿Qué cultivos sembraste?'})).toBeVisible()
})

test('release keeps science v0.26 and makes visual redesign identifiable',async({page})=>{
 await page.goto('/')
 await expect(page.locator('meta[name="biotex-ui-release"]')).toHaveAttribute('content','barranca-map-first')
 const res=await page.request.get('/release.json')
 const data=await res.json()
 expect(data.release).toBe('barranca-only-connected-api')
 expect(data.ui_release).toBe('barranca-map-first')
 expect(data.primary_url).toBeUndefined()
 expect(data.regional_profiles.barranca).toBe('single_public_pilot_exact_parcel_hls_ai');expect(data.regional_profiles.mantaro).toBeUndefined()
})
