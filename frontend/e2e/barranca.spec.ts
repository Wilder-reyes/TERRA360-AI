import {test,expect} from '@playwright/test'
import history from '../src/data/barrancaHls.json' with {type:'json'}

test.beforeEach(async({page})=>{await page.addInitScript(()=>localStorage.setItem('biotex-bio-intro-v1','complete'))})

test('only Barranca is offered even through historic Chalhuas URLs',async({page})=>{
 for(const url of ['/','/?pilot=chalhuas','/?vista=tecnica']){
  await page.goto(url)
  await expect(page.getByRole('button',{name:/Explorar parcela de Barranca/})).toHaveCount(1)
  await expect(page.getByRole('button',{name:/Chalhuas/})).toHaveCount(0)
  await expect(page.locator('.b-map-label')).toContainText('Barranca')
 }
})

test('NASA HLS colors use actual archive values and null months stay unknown',async({page})=>{
 await page.goto('/')
 await expect(page.getByRole('button',{name:'Mi parcela · NASA HLS',exact:true})).toBeDisabled()
 await page.getByRole('button',{name:/Explorar parcela de Barranca/}).click()
 const legend=page.getByRole('region',{name:'Vegetación observada en Barranca'})
 await expect(legend).toBeVisible()
 for(const observation of [history.months.find(m=>m.ndvi!==null&&m.ndvi<.2)!,history.months.find(m=>m.ndvi===null)!]){
  await legend.getByLabel('Mes observado').selectOption(observation.month)
  await expect(legend.locator('.b-hls-value')).toContainText(observation.ndvi===null?'Sin datos':observation.ndvi.toFixed(2))
 }
 await expect(legend).toContainText('no necesariamente un cultivo más sano')
 await expect(legend).toContainText('no representa cada píxel')
})

test('editing the study outline removes the exact-parcel HLS color layer',async({page})=>{
 await page.goto('/');await page.getByRole('button',{name:/Explorar parcela de Barranca/}).click()
 await page.getByText('Ajustar límites o subparcelas (opcional)',{exact:true}).click()
 await page.getByRole('button',{name:'Editar esquinas'}).click()
 await page.getByRole('button',{name:'Esquina 2',exact:true}).click()
 const lng=page.getByRole('spinbutton',{name:'Longitud de la esquina'})
 await lng.fill(String(Number(await lng.inputValue())+.00001))
 await page.getByRole('button',{name:'Aplicar coordenadas'}).click()
 await page.getByRole('button',{name:'Guardar contorno'}).click()
 await expect(page.getByRole('region',{name:'Vegetación observada en Barranca'})).toHaveCount(0)
 await expect(page.getByRole('button',{name:'Mi parcela · NASA HLS',exact:true})).toBeDisabled()
})

test('old out-of-area saves are preserved without entering the Barranca model',async({page})=>{
 await page.addInitScript(()=>localStorage.setItem('biotex-farm-v1',JSON.stringify({version:1,plantings:[],field:{type:'Polygon',coordinates:[[[-75.367,-12.048],[-75.366,-12.048],[-75.366,-12.047],[-75.367,-12.047],[-75.367,-12.048]]]}})))
 await page.goto('/');await page.getByRole('button',{name:'Recuperar mi chacra guardada'}).click()
 await expect(page.getByText(/El terreno guardado está fuera de Barranca/)).toBeVisible()
 await expect(page.locator('.b-field-ready')).toHaveCount(0)
 expect(await page.evaluate(()=>Boolean(localStorage.getItem('biotex-farm-v1')))).toBe(true)
})

test('BIO onboarding remains skippable and replayable',async({page})=>{
 await page.addInitScript(()=>localStorage.removeItem('biotex-bio-intro-v1'))
 await page.goto('/');await expect(page.getByRole('dialog',{name:'Tutorial de BIO'})).toBeVisible()
 await page.getByRole('button',{name:'Omitir'}).click()
 await expect(page.getByRole('dialog',{name:'Tutorial de BIO'})).toBeHidden()
 await page.getByRole('button',{name:'Repetir tutorial de BIO'}).click()
 await expect(page.getByRole('dialog',{name:'Tutorial de BIO'})).toBeVisible()
})

test('map and observed legend fit mobile and desktop screens',async({page})=>{
 await page.goto('/');await page.getByRole('button',{name:/Explorar parcela de Barranca/}).click()
 for(const width of [375,768,1024,1440]){
  await page.setViewportSize({width,height:900})
  await expect(page.locator('.b-progress button')).toHaveCount(4)
  expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(width+1)
  if(width===375||width===1440)await page.screenshot({path:`test-results/barranca-${width}.png`,fullPage:true})
 }
})

test('English retains the four-step Barranca journey',async({page})=>{
 await page.goto('/?lang=en');await expect(page.getByRole('heading',{name:'Your field on the map. A clearer planting plan.'})).toBeVisible()
 await page.getByRole('button',{name:'Explore a Barranca field'}).click()
 await expect(page.getByRole('region',{name:'Observed Barranca vegetation'})).toBeVisible()
 await page.getByRole('button',{name:'Continue',exact:true}).click()
 await expect(page.getByRole('heading',{name:'What have you planted?'})).toBeVisible()
 await expect(page.getByRole('button',{name:'Continue',exact:true})).toBeDisabled()
})
