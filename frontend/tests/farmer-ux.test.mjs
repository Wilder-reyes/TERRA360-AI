import test from 'node:test'

import assert from 'node:assert/strict'

import {readFileSync} from 'node:fs'



const app=readFileSync(new URL('../src/BiotexFarmerApp.tsx',import.meta.url),'utf8')

const css=readFileSync(new URL('../src/biotex-farmer.css',import.meta.url),'utf8')

const bootstrap=readFileSync(new URL('../src/main.tsx',import.meta.url),'utf8')



test('The single farmer view is BIOTEX with no historical route selection',()=>{

 assert.match(bootstrap,/<BiotexFarmerApp\/>/)

 assert.doesNotMatch(bootstrap,/URLSearchParams|ChalhuasPilotApp|\.\/FarmerApp'|RotationApp|AdvancedApp/)

 assert.match(app,/Mi terreno.*Mis cultivos.*Mis prioridades.*Mi plan agrícola/)

})

test('Farmer-facing workflow keeps optional geometry import and never auto-confirms crops',()=>{

 assert.match(app,/¿Dónde está tu chacra\?/)

 assert.match(app,/¿Qué cultivos sembraste\?/)

 assert.match(app,/¿Qué quieres mejorar primero\?/)

 assert.doesNotMatch(app,/Comparar 3 rotaciones/)

 assert.match(app,/Importar contorno GeoJSON \(opcional\)/)

 assert.match(app,/use_team_templates_as_fallback:false/)

})

test('Barranca is the only public study example',()=>{

 assert.match(app,/TEAM_FIELDS\.filter\(f=>f.zone==='barranca'\)/)

 assert.match(app,/nominatim\.openstreetmap\.org\/search/)

 assert.match(app,/validatePolygon\(points\)/)

})

test('The printable report is A4 with explicit tables, charts and page-break rules',()=>{

 assert.match(css,/@page\{size:A4 portrait;margin:18mm\}/)

 assert.match(css,/\.b-print-table/)

 assert.match(css,/break-inside:avoid/)

 assert.match(app,/b-print-chart/)

 assert.match(app,/b-print-bar-fill/)

})

test('The design system provides usable controls, focus and reduced-motion support',()=>{

 assert.match(css,/min-height:48px/)

 assert.match(css,/:focus-visible/)

 assert.match(css,/prefers-reduced-motion/)

})
