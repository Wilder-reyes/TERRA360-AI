import test from 'node:test'
import assert from 'node:assert/strict'
import {imergApproxCell} from '../src/imerg-grid.ts'

test('schematic IMERG geographic box is nominally 0.1°',()=>{
 const bounds=imergApproxCell(-13.32175,-71.95605)
 assert.equal(Math.round((bounds[1][0]-bounds[0][0])*10),1)
 assert.equal(Math.round((bounds[1][1]-bounds[0][1])*10),1)
 assert.ok(-13.32175>=bounds[0][0]&&-13.32175<=bounds[1][0])
 assert.ok(-71.95605>=bounds[0][1]&&-71.95605<=bounds[1][1])
})
test('invalid coordinates are rejected',()=>{
 for(const [lat,lon] of [[91,0],[0,190],[NaN,0]]) assert.throws(()=>imergApproxCell(lat,lon))
})
