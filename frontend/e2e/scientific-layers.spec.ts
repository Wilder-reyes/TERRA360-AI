import {test,expect} from '@playwright/test'

test.beforeEach(async ({page})=>{
 await page.addInitScript(()=>localStorage.setItem('biotex-bio-intro-v1','complete'))
})

test('science overlays expose NASA provenance and actual provider legend rather than invented values',async({page})=>{
 await page.goto('/')
 await page.getByRole('button',{name:'Vegetación NASA',exact:true}).click()
 const panel=page.getByRole('region',{name:'Procedencia de la capa NASA'})
 await expect(panel).toContainText('MODIS Terra NDVI 8-Day')
 await expect(panel).toContainText('250 m')
 await expect(panel).toContainText('La fecha es una solicitud')
 await expect(panel).toContainText('NDVI')
 await panel.getByText('Leyenda NASA original',{exact:true}).click()
 await expect(panel.locator('img[src*="GetLegendGraphic"]')).toHaveCount(1)
 await expect(panel.getByRole('link',{name:'Ver capa en NASA Worldview'})).toHaveAttribute('href',/MODIS_Terra_NDVI_8Day/)
 await page.getByRole('button',{name:'Lluvia NASA',exact:true}).click()
 await expect(panel).toContainText('GPM IMERG Precipitation Rate')
 await expect(panel).toContainText('10 km')
 await expect(panel).toContainText('esquemático')
})

test('external station directory is explicitly not claimed as live data',async({page})=>{
 await page.goto('/')
 await page.getByRole('button',{name:/Explorar parcela de Barranca/}).click()
 await page.getByText('Datos ambientales y satélite (opcional)',{exact:true}).click()
 await page.getByText('Fuentes oficiales y limitaciones',{exact:true}).click()
 await expect(page.getByText(/SENAMHI: solo catálogo oficial/)).toBeVisible()
 await expect(page.getByRole('link',{name:'SENAMHI'})).toHaveAttribute('href',/senamhi.gob.pe/)
})
