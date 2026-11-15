import {test,expect} from '@playwright/test'

const declared=['papa','arveja','papa','arveja']
const cropInfo={
 papa:['Papa','Solanaceae'],arveja:['Arveja','Fabaceae'],haba:['Haba','Fabaceae'],
 quinua:['Quinua','Amaranthaceae'],cebada:['Cebada','Poaceae'],avena:['Avena','Poaceae']
}
function scenario(id:string,crops:string[],baseYear=2027){
 const fam=crops.map(c=>cropInfo[c as keyof typeof cropInfo][1])
 return {
  id,title_es:id==='S0'?'Lo registrado por ti':'Rotación de referencia',
  title_en:id==='S0'?'Recorded':'Reference',
  schedule:crops.map((cid,i)=>({campaign:i+1,year:baseYear+i,crop_id:cid,
   name_es:cropInfo[cid as keyof typeof cropInfo][0],family:fam[i],dates_verified:false})),
  indicators:{botanical_families:new Set(fam).size,adjacent_family_repetitions:0,legume_campaigns:2,potato_return_interval_campaigns:id==='S0'?[2]:null},
  flags_es:[],limitations_es:['Sin fechas locales validadas']
 }
}
test.beforeEach(async({page})=>{
 await page.addInitScript(()=>localStorage.setItem('biotex-bio-intro-v1','complete'))
 await page.route('**/api/andes/catalog',route=>route.fulfill({status:200,contentType:'application/json',body:'{"status":"local_catalogue_for_study_not_farm_suitability"}'}))
})
test('Chalhuas is an explicitly exploratory pilot while Barranca stays independent',async({page})=>{
 await page.goto('/')
 await expect(page.getByRole('heading',{name:/Cultiva mejor/})).toBeVisible()
 await expect(page.getByText(/sin IA local entrenada/)).toBeVisible()
 await expect(page.locator('a[href*="pilot="]')).toHaveCount(0)
 await expect(page.getByRole('button',{name:'Explorar ejemplo de Chalhuas'})).toBeVisible()
 await page.getByRole('button',{name:'Explorar ejemplo de Chalhuas'}).click()
 await expect(page.getByText(/Chalhuas · Junín/).first()).toBeVisible()
 await page.getByRole('button',{name:'Continuar',exact:true}).click()
 await expect(page.getByRole('heading',{name:/Mis cultivos/})).toBeVisible()
})
test('four campaign comparison is explicit and maps colored illustrative subplots',async({page})=>{
 await page.route('**/api/andes/compare',route=>{
  const payload=route.request().postDataJSON()
  expect(payload.rotation).toEqual(declared)
  expect(payload.start_year).toBe(2027)
  return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({
   status:'illustrative_comparison',automatic_recommendation:null,
   comparison_summary_es:'Solo se comparan familias y campañas.',
   model_status:'not_trained_for_chalhuas',water_note_es:'No se calculó ahorro de agua.',
   start_year:2027,end_year:2030,
   source_records:[],
   strategies:[
    scenario('S0',declared),
    scenario('R1',['papa','quinua','cebada','haba']),
    scenario('R2',['papa','arveja','avena','quinua'])
   ]
  })})
 })
 await page.goto('/')
 await page.getByRole('button',{name:'Explorar ejemplo de Chalhuas'}).click()
 await page.getByRole('button',{name:'Continuar',exact:true}).click()
 await page.getByRole('button',{name:'Continuar',exact:false}).click()
 await expect(page.getByText('¿Qué deseas cuidar más?')).toBeVisible()
 await page.getByRole('button',{name:/Comparar rotaciones/}).click()
 await expect(page.getByRole('heading',{name:/Tres formas de organizar tus cultivos/})).toBeVisible()
 await expect(page.locator('main').getByText('No se calculó ahorro de agua.')).toBeVisible()
 await expect(page.locator('.c-sequence-card')).toHaveCount(4)
 await expect(page.locator('.c-map .leaflet-interactive')).not.toHaveCount(0)
 await page.getByRole('button',{name:'2029'}).click()
 await expect(page.getByRole('button',{name:'2029'})).toHaveAttribute('aria-pressed','true')
 await expect(page.getByText(/ASIGNACIONES PROPUESTAS/)).toBeVisible()
 await expect(page.getByRole('button',{name:'Imprimir / PDF'})).toBeVisible()
 await page.getByRole('button',{name:'Guardar en este dispositivo'}).click()
 await page.reload()
 await page.getByRole('button',{name:'Recuperar terreno de Chalhuas guardado'}).click()
 await page.getByRole('button',{name:'Continuar',exact:true}).click()
 await page.route('**/api/andes/validate-subplots',r=>r.fulfill({contentType:'application/json',body:'{"status":"geometry_validated_not_cadastral_or_agronomic"}'}))
 await page.getByRole('button',{name:'Recuperar datos de campañas'}).click()
 await expect(page.getByText('Campañas restauradas. Comprueba fechas y cultivos.')).toBeVisible()
})
test('BIO onboarding can be skipped and replayed without blocking the map',async({page})=>{
 await page.addInitScript(()=>localStorage.removeItem('biotex-bio-intro-v1'))
 await page.goto('/')
 await expect(page.getByRole('dialog',{name:'Tutorial de BIO'})).toBeVisible()
 await page.getByRole('button',{name:'Siguiente'}).click()
 await expect(page.getByRole('dialog').getByText('Ubica tu terreno')).toBeVisible()
 await page.getByRole('button',{name:'Atrás'}).click()
 await expect(page.getByText('¡Bienvenido a BIOTEX!')).toBeVisible()
 await page.getByRole('button',{name:'Omitir'}).click()
 await expect(page.getByRole('dialog',{name:'Tutorial de BIO'})).toBeHidden()
 await page.getByRole('button',{name:'Repetir tutorial de BIO'}).click()
 await expect(page.getByRole('dialog',{name:'Tutorial de BIO'})).toBeVisible()
})
test('mobile research pilot fits phone width and exposes scientific provenance',async({page})=>{
 await page.setViewportSize({width:375,height:812})
 await page.goto('/')
 await expect(page.getByRole('button',{name:'Lluvia NASA'})).toBeVisible()
 await expect(page.getByRole('button',{name:'Consultar datos del terreno'})).toHaveCount(0)
 const width=await page.evaluate(()=>document.documentElement.scrollWidth)
 expect(width).toBeLessThanOrEqual(377)
 await page.getByRole('button',{name:'Explorar ejemplo de Chalhuas'}).click()
 await page.getByText('Datos ambientales y satélite (opcional)',{exact:true}).click()
 await expect(page.getByText(/ECOSTRESS V003/)).toBeVisible()
})

test('unified shell remains usable across mobile and desktop widths',async({page})=>{
 await page.goto('/')
 for(const width of [375,768,1024,1440]){
  await page.setViewportSize({width,height:900})
  await expect(page.locator('.b-progress button')).toHaveCount(4)
  await expect(page.getByRole('button',{name:'Marcar mi chacra'})).toBeVisible()
  expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(width+1)
  if(width===375||width===1440)await page.screenshot({path:'../../work/stage1-shell-'+width+'.png',fullPage:true})
 }
})

test('a late regional response cannot move a newly selected field to results',async({page})=>{
 let release=()=>{};let started=false
 await page.route('**/api/andes/compare',async route=>{
  started=true;await new Promise<void>(resolve=>{release=resolve})
  await route.fulfill({contentType:'application/json',body:JSON.stringify({status:'illustrative_comparison',automatic_recommendation:null,strategies:[],source_records:[],water_note_es:'Sin datos'})})
 })
 await page.goto('/');await page.getByRole('button',{name:'Explorar ejemplo de Chalhuas'}).click();await page.getByRole('button',{name:'Continuar',exact:true}).click();await page.getByRole('button',{name:/^Continuar/}).click();await page.getByRole('button',{name:/Comparar rotaciones/}).click()
 await expect.poll(()=>started).toBe(true)
 await page.getByRole('navigation').getByRole('button',{name:/Mi terreno/}).click()
 await page.getByRole('button',{name:/Explorar parcela de Barranca/}).click()
 const response=page.waitForResponse('**/api/andes/compare');release();await response
 await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>resolve(null)))))
 await expect(page.getByRole('heading',{name:/Cultiva mejor/})).toBeVisible()
 await expect(page.getByText('Paso 1 de 4')).toBeVisible()
})
test('English uses the same single journey and explicit crop entry',async({page})=>{
 await page.goto('/?lang=en');await expect(page.getByRole('heading',{name:/Better harvests/})).toBeVisible()
 await expect(page.getByRole('navigation').getByRole('button',{name:/My farm plan/})).toBeDisabled()
 await page.getByRole('button',{name:'Explore a Barranca field'}).click();await page.getByRole('button',{name:'Continue',exact:true}).click();await expect(page.getByRole('heading',{name:'What have you planted?'})).toBeVisible()
 await expect(page.getByRole('button',{name:'Continue',exact:true})).toBeDisabled()
})
