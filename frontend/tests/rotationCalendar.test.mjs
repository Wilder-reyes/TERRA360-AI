import test from 'node:test'
import assert from 'node:assert/strict'
import {relativeMonthIndex,migrateSavedPlantings} from '../src/rotationCalendar.ts'
test('satellite hint to year/month index is not off by one',()=>{
 assert.equal(relativeMonthIndex('2025-08',2025),0)
 assert.equal(relativeMonthIndex('2025-12',2025),4)
 assert.equal(relativeMonthIndex('2026-07',2025),11)
 assert.equal(relativeMonthIndex('2027-07',2025),23)
 assert.equal(relativeMonthIndex('2027-08',2025),24)
 assert.equal(relativeMonthIndex('2025-13',2025),-999)
})
test('crop record preserves calendar month when the base year advances',()=>{
 const p=[{crop_id:'papa',start_index:12},{crop_id:'haba',start_index:18}]
 assert.deepEqual(migrateSavedPlantings(p,2025,2026),[{crop_id:'papa',start_index:0},{crop_id:'haba',start_index:6}])
 assert.deepEqual(migrateSavedPlantings([{crop_id:'papa',start_index:0}],2025,2026),[])
 assert.deepEqual(migrateSavedPlantings(p,null,2026),p)
})
