import {selectStudyExample} from './chakra-fixtures'
import {test,expect,type Page} from '@playwright/test'

test.setTimeout(90000)

const viewports=[320,360,375,390,430,640,768,820,960,1024,1280] as const
test.beforeEach(async({page})=>{
 await page.addInitScript(()=>{
  localStorage.setItem('chakra-choklito-guided-v4','hide')
 })
})

async function noHorizontalOverflow(page:Page,width:number,where:string){
 await page.evaluate(()=>document.fonts.ready)
 const data=await page.evaluate(()=>({
  scroll:document.documentElement.scrollWidth,
  body:document.body.scrollWidth,
  window:window.innerWidth
 }))
 expect(data.scroll,where+' document scroll').toBeLessThanOrEqual(width+1)
 expect(data.body,where+' body scroll').toBeLessThanOrEqual(width+1)
}
async function touchTargets(page:Page,selector:string,minHeight=44){
 const controls=page.locator(selector)
 const n=await controls.count()
 expect(n,selector+' exists').toBeGreaterThan(0)
 for(let i=0;i<n;i++){
  const element=controls.nth(i)
  if(!(await element.isVisible())||!(await element.isEnabled()))continue
  const box=await element.boundingBox()
  expect(box?.height||0,selector+' control '+i).toBeGreaterThanOrEqual(minHeight)
 }
}

test('mobile and tablet views never overflow horizontally on the start screen',async({page})=>{
 for(const width of viewports){
  await page.setViewportSize({width,height:900})
  await page.goto('/')
  await expect(page.getByRole('heading',{name:/Conoce tu terreno/})).toBeVisible()
  await noHorizontalOverflow(page,width,'home '+width)
  await expect(page.locator('.chakra-nav').getByRole('link',{name:'Cómo funciona'})).toBeVisible()
  await expect(page.locator('.chakra-nav').getByRole('link',{name:'Fuentes'})).toBeVisible()
  await touchTargets(page,'.chakra-nav a',44)
  await touchTargets(page,'.chakra-map-intro-actions button',48)
  await touchTargets(page,'.b-header-tools button',width<=1100?40:40)
 }
})

test('step two respects the viewport on phones/tablets with usable buttons and draggable zone grips',async({page})=>{
 for(const width of [320,360,390,430,640,768,820,960,1024,1280]){
  await page.setViewportSize({width,height:900})
  await page.goto('/')
  await selectStudyExample(page)
  await page.getByRole('button',{name:'Registrar cultivos por zona'}).click()
  await expect(page.locator('.chakra-crop-card')).toHaveCount(9)
  await expect(page.locator('.chakra-zone-choice')).toHaveCount(3)
  await noHorizontalOverflow(page,width,'crops '+width)
  await touchTargets(page,'.chakra-crop-card',60)
  await touchTargets(page,'.chakra-zone-choice',60)
  await touchTargets(page,'.chakra-zone-map-actions button',44)
  const map=page.locator('.chakra-zone-map')
  await expect(map).toBeVisible()
  if(width<=960){
   await page.getByRole('group',{name:'Elige el cultivo'}).getByRole('button',{name:/Camote/}).click()
   await expect(map).toBeInViewport({ratio:.25})
  }
  const resize=page.locator('.chakra-zone-resize-icon').first()
  await expect(resize).toBeVisible()
  const rect=await resize.boundingBox()
  expect(rect?.width||0).toBeGreaterThanOrEqual(35)
  await noHorizontalOverflow(page,width,'crops-interaction '+width)
 }
})

test('informational pages keep accessible links and columns on 320px phones through tablets',async({page})=>{
 for(const width of [320,360,390,640,768,820,1024]){
  await page.setViewportSize({width,height:850})
  await page.goto('/como-funciona')
  await expect(page.locator('.chakra-story-card')).toHaveCount(3)
  await touchTargets(page,'.chakra-info-nav nav :is(a,button)',44)
  await noHorizontalOverflow(page,width,'how '+width)
  await page.locator('.chakra-info-nav').getByRole('link',{name:'Fuentes'}).click()
  await expect(page.locator('.chakra-source-card')).toHaveCount(8)
  await touchTargets(page,'.chakra-source-card a',44)
  await noHorizontalOverflow(page,width,'sources '+width)
 }
})

test('BIO tutorial fits phone and never covers the fixed three-step navigation',async({page})=>{
 await page.addInitScript(()=>{
  localStorage.removeItem('chakra-choklito-guided-v4')
 })
 for(const width of [320,360,390,430]){
  await page.setViewportSize({width,height:750})
  await page.goto('/')
  await page.getByRole('button',{name:'Comenzar recorrido'}).click()
  const bio=page.getByRole('region',{name:'CHOKLITO, tu guía'})
  await expect(bio).toBeVisible()
  await expect(page.locator('.bio-shade')).toHaveCount(0)
  const panel=await bio.boundingBox(),rail=await page.locator('.b-progress-wrap').boundingBox()
  expect(panel).toBeTruthy();expect(rail).toBeTruthy()
  expect(panel!.x).toBeGreaterThanOrEqual(0)
  expect(panel!.x+panel!.width).toBeLessThanOrEqual(width+1)
  expect(panel!.y+panel!.height).toBeLessThanOrEqual(rail!.y+2)
  await bio.getByRole('button',{name:'Salir del tutorial'}).click()
  await expect(bio).toHaveCount(0)
 }
})
