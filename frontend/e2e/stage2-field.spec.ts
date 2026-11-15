import {test,expect} from '@playwright/test'

const chalhuasOutline={type:'Polygon',coordinates:[[[-75.367,-12.048],[-75.366,-12.048],[-75.366,-12.047],[-75.367,-12.047],[-75.367,-12.048]]]}

test.beforeEach(async({page})=>{
 await page.addInitScript(()=>localStorage.setItem('biotex-bio-intro-v1','complete'))
})

test('starts near Chalhuas without silently selecting a farm and accepts coordinates',async({page})=>{
 await page.goto('/')
 await expect(page.locator('.b-field-ready')).toHaveCount(0)
 await expect(page.getByRole('button',{name:'Marcar mi chacra'})).toBeVisible()
 await page.getByText('Buscar por coordenadas').click()
 await page.getByRole('spinbutton',{name:'Latitud',exact:true}).fill('-12.047')
 await page.getByRole('spinbutton',{name:'Longitud',exact:true}).fill('-75.366')
 await page.getByRole('button',{name:'Ir a coordenadas'}).click()
 await expect(page.locator('.b-map-label')).toContainText('-12.04700, -75.36600')
 await expect(page.locator('.b-field-ready')).toHaveCount(0)
})

test('farmer may import an outline, edit a vertex and restore the confirmed geometry locally',async({page})=>{
 await page.goto('/')
 await page.getByText('Importar contorno GeoJSON (opcional)').click()
 await page.locator('.b-technical textarea').fill(JSON.stringify(chalhuasOutline))
 await page.getByRole('button',{name:'Usar contorno'}).click()
 await expect(page.locator('.b-field-ready')).toBeVisible()
 await page.getByRole('button',{name:'Editar esquinas'}).click()
 await page.getByRole('button',{name:'Esquina 2'}).click()
 await page.getByRole('spinbutton',{name:'Longitud de la esquina'}).fill('-75.3658')
 await page.getByRole('button',{name:'Aplicar coordenadas'}).click()
 await page.getByRole('button',{name:'Guardar contorno'}).click()
 await page.getByRole('button',{name:'Guardar mi chacra'}).click()
 await expect(page.getByText('Tus datos se guardaron en este dispositivo.')).toBeVisible()
 await page.reload()
 await page.getByRole('button',{name:'Recuperar mi chacra guardada'}).click()
 await expect(page.locator('.b-field-ready')).toBeVisible()
 await expect(page.getByRole('button',{name:'Dibujar subparcela'})).toBeVisible()
})
