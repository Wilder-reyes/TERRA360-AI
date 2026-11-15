import {test,expect} from '@playwright/test'

const barrancaOutline={type:'Polygon',coordinates:[[[-77.730,-10.739],[-77.729,-10.739],[-77.729,-10.738],[-77.730,-10.738],[-77.730,-10.739]]]}

test.beforeEach(async({page})=>{
 await page.addInitScript(()=>localStorage.setItem('biotex-bio-intro-v1','complete'))
})

test('starts with a clearly labeled Barranca study example and accepts other coordinates',async({page})=>{
 await page.goto('/')
 await expect(page.locator('.b-field-ready')).toHaveCount(1)
 await expect(page.getByRole('button',{name:'Delimitar otro terreno'})).toBeVisible()
 await page.getByText('Buscar por coordenadas').click()
 await page.getByRole('spinbutton',{name:'Latitud',exact:true}).fill('-10.738')
 await page.getByRole('spinbutton',{name:'Longitud',exact:true}).fill('-77.729')
 await page.getByRole('button',{name:'Ir a coordenadas'}).click()
 await expect(page.locator('.b-map-label')).toContainText('-10.73800, -77.72900')
 await expect(page.locator('.b-field-ready')).toHaveCount(0)
})

test('farmer may import an outline, edit a vertex and restore the confirmed geometry locally',async({page})=>{
 await page.goto('/')
 await page.getByText('Importar contorno GeoJSON (opcional)').click()
 await page.locator('.b-technical textarea').fill(JSON.stringify(barrancaOutline))
 await page.getByRole('button',{name:'Usar contorno'}).click()
 await expect(page.locator('.b-field-ready')).toBeVisible()
 await page.getByText('Ajustar límites o subparcelas (opcional)',{exact:true}).click()
 await page.getByRole('button',{name:'Editar esquinas'}).click()
 await page.getByRole('button',{name:'Esquina 2'}).click()
 await page.getByRole('spinbutton',{name:'Longitud de la esquina'}).fill('-77.7288')
 await page.getByRole('button',{name:'Aplicar coordenadas'}).click()
 await page.getByRole('button',{name:'Guardar contorno'}).click()
 await page.getByRole('button',{name:'Guardar mi chacra'}).click()
 await expect(page.getByText('Tus datos se guardaron en este dispositivo.')).toBeVisible()
 await page.reload()
 await page.getByRole('button',{name:'Recuperar mi chacra guardada'}).click()
 await expect(page.locator('.b-field-ready')).toBeVisible()
 await page.getByText('Ajustar límites o subparcelas (opcional)',{exact:true}).click()
 await expect(page.getByRole('button',{name:'Dibujar subparcela'})).toBeVisible()
})
