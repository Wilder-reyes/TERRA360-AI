import {test,expect} from '@playwright/test'
import {prepared,preparedZone} from './chakra-fixtures'

test('CHOKLITO starts with no selected land and lets the farmer draw and frame it',async({page},testInfo)=>{
 await page.goto('/')
 await expect(page.getByRole('dialog')).toBeVisible()
 await expect(page.locator('.bio-mascot text')).toHaveCount(0)
 await expect(page.locator('.b-field-ready')).toHaveCount(0)
 await expect(page.getByRole('button',{name:'Registrar cultivos por zona'})).toBeDisabled()
 await page.getByRole('button',{name:'Comenzar recorrido'}).click()
 await expect(page.getByRole('region',{name:'CHOKLITO, tu guía'})).toBeVisible()
 await expect(page.getByRole('button',{name:'Terminar terreno'})).toBeDisabled()
 const map=page.locator('.b-map')
 await map.scrollIntoViewIfNeeded()
 const box=await map.boundingBox();if(!box)throw Error('Missing map')
 const x=box.x+box.width/2,y=box.y+box.height/2
 for(const [dx,dy] of [[-50,-40],[50,-40],[50,40],[-50,40]])await page.mouse.click(x+dx,y+dy)
 await page.getByRole('button',{name:'Terminar terreno'}).click()
 await expect(page.locator('.b-field-ready')).toBeVisible()
 await expect(page.getByRole('button',{name:'Registrar cultivos por zona'})).toBeEnabled()
 await expect(async()=>{
  const path=await map.locator('.leaflet-overlay-pane path').first().boundingBox(),frame=await map.boundingBox()
  expect(path&&frame&&Math.max(path.width/frame.width,path.height/frame.height)>.65).toBeTruthy()
 }).toPass()
 await page.setViewportSize({width:390,height:844})
 await expect(async()=>{
  const path=await map.locator('.leaflet-overlay-pane path').first().boundingBox(),frame=await map.boundingBox()
  expect(path&&frame&&path.width<=frame.width-15&&path.height<=frame.height-15).toBeTruthy()
 }).toPass()
 await page.screenshot({path:testInfo.outputPath('mobile-drawn-field.png'),fullPage:true})
})

test('explicitly choosing the example creates a real plan without assigning unplanted land',async({page})=>{
 test.setTimeout(90000)
 await page.addInitScript(()=>localStorage.setItem('chakra-choklito-guided-v4','hide'))
 let responseStatus=0
 await page.route('**/api/**',async route=>{
  if(process.env.E2E_SCIENTIFIC_API){
   const response=await route.fetch({url:route.request().url().replace('http://127.0.0.1:4173',process.env.E2E_SCIENTIFIC_API),timeout:60000})
   if(route.request().url().includes('/spatial-plan'))responseStatus=response.status()
   await route.fulfill({response});return
  }
  // Deterministic CI transport fixture, never used by the production app.
  // Set E2E_SCIENTIFIC_API to verify against the running scientific backend.
  if(route.request().url().includes('/spatial-plan')){
   const body=route.request().postDataJSON();responseStatus=200
   await route.fulfill({json:{...prepared,zone_plans:body.zones.map((z:{id:string;crop_id:string})=>({...preparedZone,zone_id:z.id,current_crop_id:z.crop_id}))}})
  }else await route.fulfill({json:{status:'ok'}})
 })
 await page.goto('/')
 await expect(page.locator('.b-field-ready')).toHaveCount(0)
 await page.getByRole('button',{name:'Ver un ejemplo'}).click()
 await page.getByRole('button',{name:'Registrar cultivos por zona'}).click()
 const count=await page.locator('.chakra-zone-choice').count();expect(count).toBe(3)
 for(let i=0;i<count;i++){await page.locator('.chakra-zone-choice').nth(i).click();await page.getByRole('button',{name:'Marcar en zona elegida'}).click()}
 await page.getByRole('button',{name:'Continuar a mi plan'}).click()
 await page.getByRole('button',{name:'Crear mi calendario'}).click()
 await expect(page.locator('.chakra-advice-card')).toHaveCount(3,{timeout:60000})
 expect(responseStatus).toBe(200)
 await expect(page.getByText('No pudimos obtener los datos en este momento. Inténtalo nuevamente.')).toHaveCount(0)
 await page.unrouteAll({behavior:'wait'})
})
