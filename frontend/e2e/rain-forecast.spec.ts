import {test,expect} from '@playwright/test'

// Synthetic browser fixture: never included as application forecast data.
const report={
 issued_at:'2026-11-14T17:00:00Z',target_month:'2026-12-01',location:{latitude:-13.32175,longitude:-71.95605},
 model:{id:'amazon/chronos-2',revision:'test-fixture',mode:'pretrained_zero_shot',fine_tuned:false},
 source:{name:'NASA POWER',first_month:'2011-11-01',last_month:'2026-10-01',complete_months:180},
 prediction:{p10_mm:40,median_mm:100,p90_mm:180},seasonal_reference_mm:90,
 evaluation:{status:'did_not_beat_seasonal_reference',lead_months:2,interval_calibrated:false,folds:[
  {from_month:'2022-11-01',to_month:'2024-10-01',examples:24,mae_model_mm:20,mae_seasonal_mm:19,relative_improvement:-.05,empirical_p10_p90_coverage:.75},
  {from_month:'2024-11-01',to_month:'2026-10-01',examples:24,mae_model_mm:23,mae_seasonal_mm:20,relative_improvement:-.15,empirical_p10_p90_coverage:.75}
 ]},history:[],limitations:[]
}

test.beforeEach(async({page})=>{
 await page.route('**/api/arie/catalog',route=>route.fulfill({json:{crops:{},references:{}}}))
 await page.route('**/api/environment/nasa-power/daily**',route=>route.fulfill({json:{source:'NASA POWER',records:[],period:{start:'2026-11-01',end:'2026-11-14'}}}))
 await page.route('**/api/agro/pilot',route=>route.fulfill({json:{name:'Calca · Valle Sagrado',location:report.location,crops:[]}}))
})

test('pilot forecast shows uncertainty and a model that did not beat the baseline',async({page})=>{
 await page.route('**/api/agro/rain-forecast',async route=>{
  expect(route.request().postDataJSON()).toEqual(report.location)
  await route.fulfill({json:{status:'available',report}})
 })
 await page.goto('/')
 await page.getByRole('button',{name:'Predicción de lluvia',exact:true}).click()
 await expect(page.getByRole('button',{name:'Consultar estimación de lluvia'})).toBeDisabled()
 await page.getByRole('button',{name:'Ir al piloto de Calca'}).click()
 await page.getByRole('button',{name:'Consultar estimación de lluvia'}).click()
 await expect(page.getByText('diciembre de 2026',{exact:true})).toBeVisible()
 await expect(page.getByText('100.0',{exact:false}).first()).toBeVisible()
 await expect(page.getByText(/No mejoró lo suficiente frente a la referencia estacional/)).toBeVisible()
 await expect(page.getByText(/Su cobertura aún no está calibrada localmente/)).toBeVisible()
 await page.getByText('¿Cómo se comprobó?',{exact:true}).click()
 await expect(page.getByText(/sin fine-tuning/)).toBeVisible()
 await expect(page.getByText(/No determina aptitud de cultivos/)).toBeVisible()
})

test('unprepared location has a clear state and no fabricated values',async({page})=>{
 await page.setViewportSize({width:390,height:844})
 await page.route('**/api/agro/rain-forecast',route=>route.fulfill({json:{status:'not_prepared',report:null,message:'Todavía no hay una estimación preparada para esta ubicación.'}}))
 await page.goto('/')
 await page.getByRole('button',{name:'Predicción de lluvia',exact:true}).click()
 await page.getByRole('button',{name:'Ir al piloto de Calca'}).click()
 await page.getByRole('button',{name:'Consultar estimación de lluvia'}).click()
 await expect(page.getByText('Todavía no hay una estimación preparada para esta ubicación.',{exact:true})).toBeVisible()
 await expect(page.locator('.terra-forecast-estimate')).toHaveCount(0)
 const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>window.innerWidth)
 expect(overflow).toBe(false)
})

test('changing the location clears the previous result',async({page})=>{
 await page.route('**/api/agro/rain-forecast',route=>route.fulfill({json:{status:'available',report}}))
 await page.goto('/')
 await page.getByRole('button',{name:'Predicción de lluvia',exact:true}).click()
 await page.getByRole('button',{name:'Ir al piloto de Calca'}).click()
 await page.getByRole('button',{name:'Consultar estimación de lluvia'}).click()
 await expect(page.locator('.terra-forecast-estimate')).toBeVisible()
 await page.locator('.terra-geo-map').click({position:{x:160,y:160}})
 await expect(page.locator('.terra-forecast-estimate')).toHaveCount(0)
})

test('adaptation comparison explains why the original remains active on mobile',async({page})=>{
 const experiment={history_months:360,training_months:286,trainable_parameters:1206912,total_parameters:120000000,
  published:false,eligible_for_publication:false,
  dates:{train_from:'1996-11-01',train_to:'2020-08-01',validation_from:'2020-10-01',validation_to:'2022-09-01',test_from:'2022-11-01',test_to:'2026-10-01'},
  validation:{selected:'original',original:{mae_mm:50.02},lora:{mae_mm:50.01}},
  candidates:[{learning_rate:1e-5,steps:60,validation_mae_mm:50.01},{learning_rate:1e-4,steps:120,validation_mae_mm:50.06},{learning_rate:1e-3,steps:120,validation_mae_mm:51.13}],
  test_folds:[{from_month:'2022-11-01',to_month:'2024-10-01',original:{mae_mm:20.1},lora:{mae_mm:20.2},seasonal_mae_mm:21},
   {from_month:'2024-11-01',to_month:'2026-10-01',original:{mae_mm:38.1},lora:{mae_mm:38.2},seasonal_mae_mm:37.9}]}
 await page.setViewportSize({width:390,height:844})
 await page.route('**/api/agro/rain-forecast',route=>route.fulfill({json:{status:'available',report,experiment}}))
 await page.goto('/')
 await page.getByRole('button',{name:'Predicción de lluvia',exact:true}).click()
 await page.getByRole('button',{name:'Ir al piloto de Calca'}).click()
 await page.getByRole('button',{name:'Consultar estimación de lluvia'}).click()
 await page.getByText('¿Mejoró al adaptar el modelo?',{exact:true}).click()
 await expect(page.getByText(/Se compararon 3 ajustes del modelo con 360 meses/)).toBeVisible()
 await expect(page.getByText(/Se conserva el modelo original/)).toBeVisible()
 await expect(page.getByRole('table')).toBeVisible()
 await expect(page.locator('.terra-forecast-comparison tbody tr').first().locator('td')).toHaveText(['20.1','20.2','21.0'])
 await expect(page.getByText(/periodos retrospectivos ya examinados/)).toBeVisible()
 expect(await page.evaluate(()=>document.documentElement.scrollWidth>window.innerWidth)).toBe(false)
})
