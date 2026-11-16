import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {calendarState,currentCampaign} from '../src/calendarState.ts'
const zone={current_crop_id:'maiz_amarillo_duro',current_crop:'Maíz amarillo duro',current_crop_en:'Yellow maize',last_planting_month:'2026-11',campaigns:[{crop_id:'frijol_castilla',crop_es:'Frijol castilla',crop_en:'Cowpea',sow_month:'2027-05',end_month:'2027-08'}]}
test('November and December show the declared current crop, including the new year',()=>{
 for(const month of ['2026-11','2026-12','2027-01']){
  const state=calendarState(zone,month)
  assert.equal(state.kind,'current');assert.equal(state.cropId,'maiz_amarillo_duro');assert.match(state.state,/estimado/)
 }
 assert.equal(currentCampaign(zone).end_month,'2027-04')
})
test('unconfirmed gaps and missing sowing dates never become fabricated campaigns or fallow',()=>{
 const gap=calendarState(zone,'2027-04')
 assert.equal(gap.kind,'unknown');assert.equal(gap.cropId,'');assert.match(gap.state,/no implica descanso/)
 assert.equal(calendarState({...zone,last_planting_month:undefined},'2026-11').kind,'unknown')
 assert.equal(calendarState(zone,'2026-10').kind,'unknown')
})
test('future campaigns retain their exact API months and explicit sowing/growth distinction',()=>{
 assert.equal(calendarState(zone,'2027-05').kind,'sowing')
 assert.equal(calendarState(zone,'2027-06').kind,'growth')
 assert.equal(calendarState(zone,'2027-08').kind,'unknown')
})
test('display cycle durations match the scientific catalog',()=>{
 const raw=JSON.parse(readFileSync(new URL('../../backend/app/data/rotation_crops.json',import.meta.url)))
 const crops=Array.isArray(raw.crops)?raw.crops:Object.values(raw.crops)
 const expected=Object.fromEntries(crops.map(c=>[c.id,c.cycle_days]))
 const actual=JSON.parse(readFileSync(new URL('../src/currentCropCycles.json',import.meta.url)))
 assert.deepEqual(actual,expected)
})
