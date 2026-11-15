import test from 'node:test'
import assert from 'node:assert/strict'
import {proposedCrop,campaignAreaSummary,printableGeometry,approximateHectares} from '../src/campaignPlan.ts'

const rectangle=(west,south,east,north)=>({type:'Polygon',coordinates:[[[west,south],[east,south],[east,north],[west,north],[west,south]]]})
const field=rectangle(-75.38,-12.05,-75.378,-12.048)
const west=rectangle(-75.38,-12.05,-75.379,-12.048)
const east=rectangle(-75.379,-12.05,-75.378,-12.048)
const parcels=[{id:'A',polygon:west},{id:'B',polygon:east}]
const schedule=[{crop_id:'papa'},{crop_id:'quinua'},{crop_id:'haba'},{crop_id:'cebada'}]

test('proposals use the selected campaign for EVERY subplot; no synthetic stagger',()=>{
 assert.equal(proposedCrop('A',0,schedule,{}),'papa')
 assert.equal(proposedCrop('B',0,schedule,{}),'papa')
 assert.equal(proposedCrop('B',1,schedule,{}),'quinua')
 assert.equal(proposedCrop('B',1,schedule,{'B:1':'avena'}),'avena')
 assert.equal(proposedCrop('B',5,schedule,{}),null)
})

test('crop surface is derived from user-owned geometry, not arbitrary split percentages',()=>{
 const hectares=approximateHectares(field)
 assert.ok(hectares>4 && hectares<6)
 const summary=campaignAreaSummary(parcels,0,schedule,{})
 assert.equal(summary.length,1)
 assert.equal(summary[0].crop_id,'papa')
 assert.ok(Math.abs(summary[0].area_ha-hectares)<.1)
 const altered=campaignAreaSummary(parcels,0,schedule,{'B:0':'quinua'})
 assert.equal(altered.length,2)
 assert.ok(Math.abs(altered.reduce((sum,x)=>sum+x.area_ha,0)-hectares)<.1)
})

test('vector report plots only supplied boundaries and preserves aspect',()=>{
 const plot=printableGeometry(field,parcels)
 assert.equal(plot.subplots.length,2)
 assert.equal(plot.field.trim().split(/\s+/).length,5)
 for(const ring of [plot.field,...plot.subplots]){
  const nums=ring.split(/[\s,]+/).map(Number)
  assert.ok(nums.every(Number.isFinite))
  assert.ok(nums.every((v,i)=>i%2===0? v>=0&&v<=600:v>=0&&v<=340))
 }
 const noSubplots=printableGeometry(field,[])
 assert.deepEqual(noSubplots.subplots,[])
})
