import {test,expect} from '@playwright/test'
test.beforeEach(async({page})=>{await page.addInitScript(()=>localStorage.setItem('biotex-bio-intro-v1','complete'))})

test('regional NASA imagery keeps its provenance and native provider color scale',async({page})=>{
 await page.goto('/')
 await page.getByText('Más capas y herramientas').click()
 await page.getByRole('button',{name:'Vegetación regional'}).click()
 const panel=page.getByRole('region',{name:'Procedencia de la capa NASA'})
 await expect(panel).toContainText('Los colores de la leyenda')
 await panel.getByText('Detalles de esta capa NASA').click()
 await expect(panel).toContainText('MODIS Terra NDVI 8-Day')
 await expect(panel).toContainText('250 m')
 await expect(panel).toContainText('La fecha es una solicitud')
 await expect(panel.locator('.b-map-legend')).toHaveAttribute('open','')
 await expect(panel.locator('img[src*="GetLegendGraphic"]')).toHaveCount(1)
 await expect(panel.getByRole('link',{name:'Ver capa en NASA Worldview'})).toHaveAttribute('href',/MODIS_Terra_NDVI_8Day/)
 await page.getByRole('button',{name:'Lluvia NASA'}).click()
 await expect(panel).toContainText('GPM IMERG Precipitation Rate')
 await expect(panel).toContainText('10 km')
 await expect(panel).toContainText('esquemático')
})

test('SENAMHI and scientific directory links are accessible as optional context',async({page})=>{
 await page.goto('/')
 await page.getByText('Datos ambientales y satélite (opcional)',{exact:true}).click()
 await page.getByText('Fuentes oficiales y limitaciones',{exact:true}).click()
 await expect(page.getByRole('link',{name:'SENAMHI',exact:true})).toHaveAttribute('href',/senamhi.gob.pe/)
})
