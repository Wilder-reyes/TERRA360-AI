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
 await page.goto('/?pilot=chalhuas')
 await expect(page.getByRole('heading',{name:/Conoce tu terreno/})).toBeVisible()
 await expect(page.getByText(/No hay una IA entrenada localmente/)).toBeVisible()
 await expect(page.getByRole('link',{name:/Piloto anterior/})).toHaveAttribute('href','/?pilot=barranca')
 await expect(page.getByRole('button',{name:'Explorar parcela de práctica'})).toBeVisible()
 await page.getByRole('button',{name:'Explorar parcela de práctica'}).click()
 await expect(page.getByText(/Contorno inventado para tutorial/)).toBeVisible()
 await page.getByRole('button',{name:/Continuar con mis cultivos/}).click()
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
 await page.goto('/?pilot=chalhuas')
 await page.getByRole('button',{name:'Explorar parcela de práctica'}).click()
 await page.getByRole('button',{name:/Continuar con mis cultivos/}).click()
 await page.getByRole('button',{name:'Continuar',exact:false}).click()
 await expect(page.getByText('¿Qué deseas cuidar más?')).toBeVisible()
 await page.getByRole('button',{name:/Comparar rotaciones/}).click()
 await expect(page.getByRole('heading',{name:/Tres formas de organizar tus cultivos/})).toBeVisible()
 await expect(page.getByText('No se calculó ahorro de agua.')).toBeVisible()
 await expect(page.locator('.c-sequence-card')).toHaveCount(4)
 await expect(page.locator('.c-map .leaflet-interactive')).not.toHaveCount(0)
 await page.getByRole('button',{name:'2029'}).click()
 await expect(page.getByRole('button',{name:'2029'})).toHaveAttribute('aria-pressed','true')
 await expect(page.getByText(/ASIGNACIÓN PROPUESTA/)).toBeVisible()
 await expect(page.getByRole('button',{name:'Imprimir / PDF'})).toBeVisible()
})
test('BIO onboarding can be skipped and replayed without blocking the map',async({page})=>{
 await page.addInitScript(()=>localStorage.removeItem('biotex-bio-intro-v1'))
 await page.goto('/?pilot=chalhuas')
 await expect(page.getByRole('dialog',{name:'Tutorial de BIO'})).toBeVisible()
 await page.getByRole('button',{name:'Siguiente'}).click()
 await expect(page.getByText('Ubica tu terreno')).toBeVisible()
 await page.getByRole('button',{name:'Atrás'}).click()
 await expect(page.getByText('¡Bienvenido a BIOTEX!')).toBeVisible()
 await page.getByRole('button',{name:'Omitir'}).click()
 await expect(page.getByRole('dialog',{name:'Tutorial de BIO'})).toBeHidden()
 await page.getByRole('button',{name:'Repetir tutorial de BIO'}).click()
 await expect(page.getByRole('dialog',{name:'Tutorial de BIO'})).toBeVisible()
})
test('mobile research pilot fits phone width and exposes scientific provenance',async({page})=>{
 await page.setViewportSize({width:375,height:812})
 await page.goto('/?pilot=chalhuas')
 await expect(page.getByRole('button',{name:'Lluvia NASA'})).toBeVisible()
 await expect(page.getByRole('button',{name:'Consultar datos del terreno'})).toBeDisabled()
 const width=await page.evaluate(()=>document.documentElement.scrollWidth)
 expect(width).toBeLessThanOrEqual(377)
 await page.getByText('Fuentes y otras capas').click()
 await expect(page.getByText(/ECOSTRESS V003/)).toBeVisible()
})
