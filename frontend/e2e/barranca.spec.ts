import {test,expect} from '@playwright/test'
import {BARRANCA_HISTORY} from '../src/barrancaObservation'

test.beforeEach(async({page})=>{await page.addInitScript(()=>localStorage.setItem('biotex-bio-intro-v1','complete'))})

test('Barranca is the only public study example and users may outline another place',async({page})=>{
 await page.goto('/?vista=chalhuas')
 await expect(page.getByRole('button',{name:/Explorar parcela de Barranca/})).toBeVisible()
 await expect(page.getByText(/Chalhuas/)).toHaveCount(0)
 await expect(page.locator('.b-map')).toBeVisible()
 await expect(page.getByRole('button',{name:'Delimitar otro terreno'})).toBeVisible()
})

test('NASA HLS uses the archived observations and explains low vegetation in plain language',async({page})=>{
 await page.goto('/')
 const legend=page.getByRole('region',{name:'Vegetación observada en Barranca'})
 await expect(legend).toBeVisible()
 await expect(legend).toContainText('¿Qué muestra el satélite?')
 await expect(legend).toContainText('Más verde indica más vegetación observada')
 const latest=[...BARRANCA_HISTORY.months].reverse().find(row=>row.ndvi!==null)!
 const selected=legend.getByRole('combobox',{name:'Elegir mes de observación'})
 await selected.selectOption(latest.month)
 await legend.getByText('Cómo se obtuvo esta lectura').click()
 await expect(legend).toContainText(latest.ndvi!.toFixed(3))
 await expect(legend).toContainText('NASA HLS')
})

test('moving the study parcel boundary disables the specific trained HLS layer',async({page})=>{
 await page.goto('/')
 await page.getByText('Ajustar límites o subparcelas (opcional)',{exact:true}).click()
 await page.getByRole('button',{name:'Editar esquinas'}).click()
 await page.getByRole('button',{name:'Esquina 2',exact:true}).click()
 const lng=page.getByRole('spinbutton',{name:'Longitud de la esquina'})
 await lng.fill(String(Number(await lng.inputValue())+.00001))
 await page.getByRole('button',{name:'Aplicar coordenadas'}).click()
 await page.getByRole('button',{name:'Guardar contorno'}).click()
 await expect(page.getByRole('region',{name:'Vegetación observada en Barranca'})).toHaveCount(0)
 await expect(page.getByRole('button',{name:'Vegetación de Barranca'})).toHaveCount(0)
})

test('previously saved polygons outside Barranca restore and remain editable',async({page})=>{
 const external={type:'Polygon',coordinates:[[[-71.995,-13.517],[-71.992,-13.517],[-71.992,-13.514],[-71.995,-13.514],[-71.995,-13.517]]]}
 await page.addInitScript(field=>localStorage.setItem('biotex-farm-v1',JSON.stringify({
  version:1,field,place:'Cusco · terreno propio',plantings:[],
  baseYear:2024,isDemoField:false,subplots:[]
 })),external)
 await page.goto('/')
 await page.getByRole('button',{name:'Recuperar mi chacra guardada'}).click()
 await expect(page.locator('.b-field-ready')).toBeVisible()
 await expect(page.getByText(/Recuperamos tu chacra/)).toBeVisible()
 await page.getByRole('button',{name:'Registrar cultivos por zona'}).click()
 await expect(page.locator('.chakra-zone-map')).toBeVisible()
})

test('the optional BIO tutorial is skippable and manually replayable',async({page})=>{
 await page.goto('/')
 await expect(page.getByRole('dialog',{name:'Tutorial de BIO'})).toHaveCount(0)
 await page.getByRole('button',{name:'Repetir tutorial de BIO'}).click()
 await expect(page.getByRole('dialog',{name:'Tutorial de BIO'})).toBeVisible()
 await page.getByRole('button',{name:'Omitir'}).click()
 await expect(page.getByRole('dialog',{name:'Tutorial de BIO'})).toHaveCount(0)
})

test('desktop and mobile show three accessible steps without horizontal overflow',async({page})=>{
 for(const width of [375,768,1440]){
  await page.setViewportSize({width,height:850});await page.goto('/')
  await expect(page.locator('.b-progress button')).toHaveCount(3)
  await expect(page.locator('.b-map')).toBeVisible()
  expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(width+1)
 }
})

test('English retains the same three-step process and map',async({page})=>{
 await page.goto('/?lang=en')
 await expect(page.getByRole('button',{name:/Explore the Barranca example/})).toBeVisible()
 await expect(page.locator('.b-progress button')).toHaveCount(3)
 await page.getByRole('button',{name:'Record crops by zone'}).click()
 await expect(page.getByRole('heading',{name:'What did you plant and where?'})).toBeVisible()
 await expect(page.locator('.chakra-crop-card')).toHaveCount(13)
})
