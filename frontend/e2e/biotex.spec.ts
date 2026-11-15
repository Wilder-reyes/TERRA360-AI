import {test,expect} from '@playwright/test'

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
 await expect(page.getByRole('heading',{name:'Cultiva mejor, cuidando tu agua y tu tierra.'})).toBeVisible()
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
 await expect(page.getByRole('heading',{name:'Cultiva mejor, cuidando tu agua y tu tierra.'})).toBeVisible()
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
 await page.route('**/api/rotation/history',route=>route.fulfill({
  status:200,contentType:'application/json',body:JSON.stringify({
   status:'available',sensor:'NASA HLS v2.0 (30 m)',period:{start:'2021-01-01',end:'2026-11-14'},
   months_with_data:48,months_total:70,detection:{campaigns:[]},
   months:[{month:'2026-08',ndvi:0.62,best_scene:{date:'2026-08-16',collection:'hls2-l30',scene_id:'HLS.L30.T18LYL.2026228T153532.v2.0',valid_pixels:35}}]
  })
 }))
 await page.goto('/')
 await page.getByRole('button',{name:/Explorar parcela de Barranca/}).click()
 await page.getByRole('button',{name:'Continuar'}).click()
 await page.getByText('¿No recuerdas alguna siembra?').click()
 await page.getByRole('button',{name:'Buscar pistas con imágenes del terreno'}).click()
 await expect(page.getByText('Así se veía la zona desde el espacio')).toBeVisible()
 await expect(page.getByText('2026-08-16')).toBeVisible()
 await expect(page.getByRole('link',{name:'Consultar la imagen HLS utilizada'})).toHaveAttribute('href',/planetarycomputer\.microsoft\.com/)
 await expect(page.getByText('0.62')).toBeVisible()
})
