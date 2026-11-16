import {test,expect,type Page} from '@playwright/test'
import {readFileSync} from 'node:fs'
import {execFileSync} from 'node:child_process'
import {prepared,preparedZone,registerAllCropZones,selectStudyExample} from './chakra-fixtures'

async function result(page:Page){
 await page.addInitScript(()=>localStorage.setItem('chakra-choklito-guided-v4','hide'))
 await page.route('**/api/**',async route=>{
  if(route.request().url().includes('/spatial-plan')){
   const body=route.request().postDataJSON()
   await route.fulfill({json:{...prepared,planning_months:24,plan_start_month:'2026-11',plan_end_month:'2028-10',zone_plans:body.zones.map((z:{id:string;crop_id:string;planted_month:string})=>({...preparedZone,zone_id:z.id,current_crop_id:z.crop_id,last_planting_month:z.planted_month}))}})
  }else await route.fulfill({json:route.request().url().includes('/compare')?{status:'available',strategies:[]}:{status:'ok'}})
 })
 await page.goto('/');await selectStudyExample(page)
 await page.getByRole('button',{name:'Registrar cultivos por zona'}).click()
 await registerAllCropZones(page)
 await page.getByRole('button',{name:'Continuar a mi plan'}).click()
 await page.getByRole('button',{name:'Crear mi calendario'}).click()
 await expect(page.getByRole('button',{name:/Guardar como PDF/})).toBeEnabled()
}

test('mobile and desktop download a complete A4 PDF independent of viewport',async({page},testInfo)=>{
 test.setTimeout(60000)
 for(const width of [390,1440]){
  await page.setViewportSize({width,height:900})
  await result(page)
  const downloadPromise=page.waitForEvent('download')
  await page.getByRole('button',{name:/Guardar como PDF/}).click()
  const download=await downloadPromise
  expect(download.suggestedFilename()).toBe('CHAKRA-X-plan.pdf')
  const path=testInfo.outputPath(`results-${width}.pdf`);await download.saveAs(path)
  expect(readFileSync(path).subarray(0,5).toString()).toBe('%PDF-')
  // Poppler is optional locally; CI still verifies download and native payload.
  try{
   const info=execFileSync('pdfinfo',[path],{encoding:'utf8'})
   expect(info).toMatch(/Page size:\s+595\.28 x 841\.89 pts \(A4\)/)
   expect(execFileSync('pdffonts',[path],{encoding:'utf8'})).toMatch(/OpenSans\s+CID TrueType\s+Identity-H\s+yes/)
   const bounds=execFileSync('pdftotext',['-bbox',path,'-'],{encoding:'utf8'})
   for(const word of bounds.matchAll(/<word xMin="(-?[\d.]+)" yMin="(-?[\d.]+)" xMax="(-?[\d.]+)" yMax="(-?[\d.]+)"/g)){
    expect(Number(word[1])).toBeGreaterThanOrEqual(40);expect(Number(word[3])).toBeLessThanOrEqual(555)
    expect(Number(word[2])).toBeGreaterThanOrEqual(10);expect(Number(word[4])).toBeLessThanOrEqual(830)
   }
   const text=execFileSync('pdftotext',['-layout',path,'-'],{encoding:'utf8'})
   for(const value of ['CHAKRA X','Zona A','Zona B','Zona C','noviembre','diciembre','octubre','2028','FAO-56','Fuentes y limitaciones'])expect(text).toContain(value)
  }catch(error){if((error as NodeJS.ErrnoException).code!=='ENOENT')throw error}
  expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(width+1)
 }
})

test('WhatsApp sharing receives the generated PDF in the original user click without a file picker',async({page})=>{
 let choosers=0;page.on('filechooser',()=>choosers++)
 await page.addInitScript(()=>{
  Object.defineProperty(navigator,'canShare',{value:()=>true,configurable:true})
  Object.defineProperty(navigator,'share',{value:async(data:ShareData)=>{
   const file=data.files![0]
   ;(window as any).__share={name:file.name,type:file.type,size:file.size,active:navigator.userActivation.isActive,header:await file.slice(0,5).text()}
  },configurable:true})
 })
 await page.setViewportSize({width:390,height:844});await result(page)
 await page.getByRole('button',{name:/Compartir PDF por WhatsApp/}).click()
 await expect(page.getByRole('status')).toContainText('Confirma el envío en WhatsApp')
 const share=await page.evaluate(()=>(window as any).__share)
 expect(share).toMatchObject({name:'CHAKRA-X-plan.pdf',type:'application/pdf',active:true,header:'%PDF-'})
 expect(share.size).toBeGreaterThan(5000);expect(choosers).toBe(0)
})

test('unsupported file sharing downloads the existing PDF and opens actual results, never an upload dialog',async({page})=>{
 let choosers=0;page.on('filechooser',()=>choosers++)
 await page.addInitScript(()=>{
  Object.defineProperty(navigator,'canShare',{value:()=>false,configurable:true})
  window.open=(url)=>{(window as any).__whatsapp=String(url);return null}
 })
 await result(page)
 const downloaded=page.waitForEvent('download')
 await page.getByRole('button',{name:/Compartir PDF por WhatsApp/}).click()
 expect((await downloaded).suggestedFilename()).toBe('CHAKRA-X-plan.pdf')
 await expect(page.getByRole('status')).toContainText('PDF descargado')
 const link=await page.evaluate(()=>(window as any).__whatsapp)
 expect(new URL(link).hostname).toBe('wa.me')
 expect(new URL(link).searchParams.get('text')).toContain('Vainita')
 expect(new URL(link).searchParams.get('text')).toContain('enero de 2027')
 expect(choosers).toBe(0)
})

test('desktop page has side gutters and top breathing room without horizontal overflow',async({page})=>{
 await page.addInitScript(()=>localStorage.setItem('chakra-choklito-guided-v4','hide'))
 await page.goto('/')
 for(const width of [320,360,375,390,414,640,768,960,1280,1440,1920]){
  await page.setViewportSize({width,height:900})
  expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(width+1)
  if(width>=1280){
   const box=await page.locator('.b-main').evaluate(el=>{const r=el.getBoundingClientRect(),s=getComputedStyle(el);return {padding:parseFloat(s.paddingLeft),left:r.left,width:r.width}})
   expect(box.padding).toBeGreaterThanOrEqual(48);expect(box.left).toBeGreaterThanOrEqual(0);expect(box.width).toBeLessThanOrEqual(1480)
   expect(await page.locator('.b-header').evaluate(el=>parseFloat(getComputedStyle(el).paddingTop))).toBeGreaterThanOrEqual(22)
  }
 }
})
