import {test,expect} from '@playwright/test'
import {readFileSync} from 'node:fs'

const catalog=JSON.parse(readFileSync(new URL('../../backend/app/data/risk_rules.json',import.meta.url),'utf8'))
// Synthetic browser data only; no forecast or field evidence is fabricated in the app.
function fixture(){
 const points=[-13.25,-13.5,-13.75].flatMap((latitude,row)=>[-72.25,-72,-71.75].map((longitude,col)=>{
  const index=row*3+col
  const alerts=catalog.hazards.map((h:any,i:number)=>({...h,level:index===0?['high','no_signal','monitor','monitor','insufficient_data'][i]:'no_signal',
   reason:'Umbral de prueba; no representa datos meteorológicos reales.',reason_en:'Test threshold; not real weather data.',
   coverage:{valid:i===4?0:7,expected:7,baseline_years:i===0?30:null},
   metrics:[{label:i===4?'Agua del suelo':'Indicador de prueba',label_en:'Test metric',value:i===4?null:10,unit:'mm',date:null}]}))
  return {id:`P0${index+1}`,latitude,longitude,overall:index===0?'high':'no_signal',missing_hazards:index===0?1:0,alerts}
 }))
 const summary=Object.fromEntries(catalog.hazards.map((h:any)=>[h.id,Object.fromEntries(['high','monitor','no_signal','insufficient_data'].map(l=>[l,points.filter(p=>p.alerts.find((a:any)=>a.id===h.id).level===l).length]))]))
 return {issued_at:'2026-11-14T18:00:00Z',expires_at:'2026-11-14T19:00:00Z',forecast_start:'2026-11-15',forecast_end:'2026-11-21',history_start:'2026-10-09',history_end:'2026-11-07',method_version:catalog.version,points,summary,sources:catalog.sources,attribution:catalog.attribution}
}

test.beforeEach(async({page})=>{
 await page.clock.install({time:new Date('2026-11-14T18:00:00Z')})
 await page.route('**/api/arie/catalog',r=>r.fulfill({json:{crops:{},references:{}}}))
 await page.route('**/api/environment/nasa-power/daily**',r=>r.fulfill({json:{records:[],period:{start:'2026-11-01',end:'2026-11-14'}}}))
 await page.route('**/api/agro/risks/catalog',r=>r.fulfill({json:catalog}))
})

async function open(page:any){
 await page.goto('/')
 await page.getByRole('button',{name:'Alertas agrícolas',exact:true}).click()
}

test('nine regional points show all five signals, evidence and official warnings',async({page})=>{
 await page.route('**/api/agro/risks/report',r=>r.fulfill({json:{status:'available',report:fixture()}}))
 await open(page)
 await expect(page.locator('.terra-risk-points button')).toHaveCount(9)
 await expect(page.locator('.terra-risk-card')).toHaveCount(5)
 await expect(page.locator('.terra-risk-card.level-high')).toHaveCount(1)
 await expect(page.getByRole('heading',{name:'Riesgo de sequía',exact:true})).toBeVisible()
 await expect(page.getByRole('link',{name:/Consultar avisos oficiales de SENAMHI/})).toHaveAttribute('href',catalog.official_warnings_url)
 await expect(page.getByText(/Sin señal del indicador no significa zona segura/)).toBeVisible()
 await expect(page.locator('.terra-risk-card.level-insufficient_data dd')).toHaveText('—')
})

test('hazard filter and selected point update map and details',async({page})=>{
 await page.route('**/api/agro/risks/report',r=>r.fulfill({json:{status:'available',report:fixture()}}))
 await open(page)
 await page.getByLabel('Riesgo en el mapa',{exact:true}).selectOption('erosion')
 await expect(page.locator('.terra-risk-card')).toHaveCount(1)
 await expect(page.getByRole('heading',{name:'Posible erosión',exact:true})).toBeVisible()
 await expect(page.locator('.terra-risk-points button').first()).toContainText('Monitorear')
 await page.getByRole('button',{name:/^P02 /}).click()
 await expect(page.locator('.terra-risk-detail>h4')).toContainText('P02')
 await expect(page.locator('.terra-risk-card')).toHaveClass(/level-no_signal/)
 await expect(page.locator('.terra-geo-map .leaflet-tooltip').filter({hasText:'P01'})).toBeVisible()
})

test('expired reports have no markers or old risk cards',async({page})=>{
 await page.route('**/api/agro/risks/report',r=>r.fulfill({json:{status:'stale_report',report:null}}))
 await open(page)
 await expect(page.getByText(/El informe venció/)).toBeVisible()
 await expect(page.locator('.terra-risk-points button')).toHaveCount(0)
 await expect(page.locator('.terra-risk-card')).toHaveCount(0)
 await expect(page.locator('.terra-risk-map-label')).toHaveCount(0)
})

test('an open tab clears alerts exactly when the inputs expire',async({page})=>{
 await page.route('**/api/agro/risks/report',r=>r.fulfill({json:{status:'available',report:fixture()}}))
 await open(page)
 await expect(page.locator('.terra-risk-points button')).toHaveCount(9)
 await page.clock.fastForward(60*60*1000+1000)
 await expect(page.getByText(/El informe venció/)).toBeVisible()
 await expect(page.locator('.terra-risk-card')).toHaveCount(0)
 await expect(page.locator('.terra-geo-map .leaflet-tooltip')).toHaveCount(0)
})

test('missing and invalid reports explain the state and can be retried',async({page})=>{
 await page.route('**/api/agro/risks/report',r=>r.fulfill({json:{status:'invalid_report',report:null}}))
 await open(page)
 await expect(page.getByText(/No se pudo verificar el informe/)).toBeVisible()
 await page.route('**/api/agro/risks/report',r=>r.fulfill({json:{status:'not_prepared',report:null}}))
 await page.getByRole('button',{name:'Volver a consultar',exact:true}).click()
 await expect(page.getByText(/Aún no hay alertas preparadas/)).toBeVisible()
 await expect(page.locator('.terra-risk-card')).toHaveCount(0)
})

test('mobile alerts remain readable with no horizontal overflow',async({page})=>{
 await page.setViewportSize({width:390,height:844})
 await page.route('**/api/agro/risks/report',r=>r.fulfill({json:{status:'available',report:fixture()}}))
 await open(page)
 await expect(page.locator('.terra-risk-points button')).toHaveCount(9)
 await page.getByLabel('Riesgo en el mapa',{exact:true}).selectOption('water_stress')
 await expect(page.locator('.terra-risk-card.level-insufficient_data')).toBeVisible()
 await page.getByText('Método y límites',{exact:true}).click()
 await expect(page.getByText(/no calcula pérdida de suelo/)).toBeVisible()
 expect(await page.evaluate(()=>document.documentElement.scrollWidth>window.innerWidth)).toBe(false)
})
