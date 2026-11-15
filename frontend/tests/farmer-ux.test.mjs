import test from 'node:test'

import assert from 'node:assert/strict'

import {readFileSync} from 'node:fs'



const app=readFileSync(new URL('../src/BiotexFarmerApp.tsx',import.meta.url),'utf8')

const css=readFileSync(new URL('../src/biotex-farmer.css',import.meta.url),'utf8')

const bootstrap=readFileSync(new URL('../src/main.tsx',import.meta.url),'utf8')



test('The single farmer view is CHAKRA with no historical route selection',()=>{

 assert.match(bootstrap,/<BiotexFarmerApp\/>/)

 assert.doesNotMatch(bootstrap,/URLSearchParams|ChalhuasPilotApp|\.\/FarmerApp'|RotationApp|AdvancedApp/)

 assert.match(app,/steps:\['Delimitar','Cultivos y zonas','Mi plan'\]/)
 assert.match(app,/chakra-crop-grid/)
 assert.match(app,/spatial-plan/)

})

test('Farmer-facing workflow keeps optional geometry import and never auto-confirms crops',()=>{

 assert.match(app,/¿Dónde está tu chacra\?/)

 assert.match(app,/Muéstranos qué sembraste/)

 assert.match(app,/Elige tus cultivos/)

 assert.doesNotMatch(app,/Comparar 3 rotaciones/)

 assert.match(app,/Importar contorno GeoJSON \(opcional\)/)
 assert.match(app,/chakra-farmer-clean/)
 assert.match(app,/ChakraInfoPage/)

 assert.match(app,/buildSpatialPlan\(\)/)

})

test('Barranca is the only public study example',()=>{

 assert.match(app,/TEAM_FIELDS\.filter\(f=>f.zone==='barranca'\)/)

 assert.match(app,/nominatim\.openstreetmap\.org\/search/)

 assert.match(app,/validatePolygon\(points\)/)

})

test('The zone plan renders a geographic printable A4 report and uses readable controls',()=>{

 const chakraCss=readFileSync(new URL('../src/chakra.css',import.meta.url),'utf8')
 const zonePlan=readFileSync(new URL('../src/ChakraZonePlan.tsx',import.meta.url),'utf8')
 assert.match(chakraCss,/@page\{size:A4;margin:18mm\}/)

 assert.match(zonePlan,/ChakraZonePrint/)

 assert.match(css,/break-inside:avoid/)

 assert.match(zonePlan,/ChakraZoneSketch/)

 assert.match(zonePlan,/sow_label_es/)

})

test('The design system provides usable controls, focus and reduced-motion support',()=>{

 assert.match(css,/min-height:48px/)

 assert.match(css,/:focus-visible/)

 assert.match(css,/prefers-reduced-motion/)

})
