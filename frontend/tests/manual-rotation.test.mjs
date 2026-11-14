import test from 'node:test'
import assert from 'node:assert/strict'
import {addPlantingToRotation,removePlantingFromRotation} from '../src/manualRotation.ts'

test('manually entered plantings are retained in chronological order without inventing crops',()=>{
 const first=addPlantingToRotation([],'maiz_amarillo_duro',7)
 assert.equal(first.status,'added')
 const next=addPlantingToRotation(first.current,'frijol_castilla',0)
 assert.deepEqual(next.current,[{crop_id:'frijol_castilla',start_index:0},{crop_id:'maiz_amarillo_duro',start_index:7}])
})
test('a month can have only one declared start',()=>{
 const baseline=[{crop_id:'maiz_amarillo_duro',start_index:0}]
 const result=addPlantingToRotation(baseline,'camote',0)
 assert.equal(result.status,'duplicate')
 assert.deepEqual(result.current,baseline)
})
test('invalid months and blank crop IDs are rejected',()=>{
 for(const [crop,month] of [['camote',-1],['camote',24],['camote',1.3],[' ',4]]){
  const r=addPlantingToRotation([],crop,month)
  assert.equal(r.status,'invalid')
  assert.deepEqual(r.current,[])
 }
})
test('manual history is capped at 10 starts per 24 months',()=>{
 const baseline=Array.from({length:10},(_,start_index)=>({crop_id:'camote',start_index}))
 assert.equal(addPlantingToRotation(baseline,'pallar',10).status,'limit')
 assert.equal(removePlantingFromRotation(baseline,3).length,9)
 assert.equal(addPlantingToRotation(removePlantingFromRotation(baseline,3),'pallar',10).status,'added')
})
