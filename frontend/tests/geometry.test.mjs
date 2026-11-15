import test from 'node:test'
import assert from 'node:assert/strict'
import {approximatePolygonHectares,validatePolygon} from '../src/geometry.ts'

test('small rectangular agricultural area is positive and approximate',()=>{
 const area=[{lat:-13.32,lng:-71.96},{lat:-13.32,lng:-71.959},
             {lat:-13.321,lng:-71.959},{lat:-13.321,lng:-71.96}]
 const hectares=approximatePolygonHectares(area)
 assert.ok(hectares>1&&hectares<2)
 assert.deepEqual(validatePolygon(area),{valid:true,reason:'ok'})
 assert.ok(Math.abs(hectares-approximatePolygonHectares([...area].reverse()))<.001)
})
test('crossing bow-tie boundary is rejected',()=>{
 const bow=[{lat:0,lng:0},{lat:1,lng:1},{lat:0,lng:1},{lat:1,lng:0}]
 assert.equal(validatePolygon(bow).reason,'self_intersection')
})
test('duplicates, missing vertices, invalid global wrapping are rejected',()=>{
 const a={lat:0,lng:0},b={lat:0,lng:.01},c={lat:.01,lng:.01}
 assert.equal(validatePolygon([a,b]).valid,false)
 assert.equal(validatePolygon([a,b,b,c]).reason,'duplicate_vertices')
 assert.equal(validatePolygon([{lat:91,lng:2},b,c]).reason,'coordinates')
 assert.equal(validatePolygon([a,{lat:0,lng:179},c]).reason,'area_too_large')
})
test('collinear vertices are invalid geometry',()=>{
 const line=[{lat:0,lng:0},{lat:.001,lng:.001},{lat:.002,lng:.002}]
 assert.equal(validatePolygon(line).valid,false)
})

import {validateSubplotLayout} from '../src/geometry.ts'
const rectangle=(s,w,n,e)=>[{lat:s,lng:w},{lat:s,lng:e},{lat:n,lng:e},{lat:n,lng:w}]
test('farmer-defined subplots are contained, unique and disjoint; adjacent edges are permitted',()=>{
 const field=rectangle(-12.049,-75.369,-12.045,-75.364)
 const a={id:'1',points:rectangle(-12.048,-75.368,-12.046,-75.366)}
 const b={id:'2',points:rectangle(-12.048,-75.366,-12.046,-75.365)}
 assert.equal(validateSubplotLayout(field,[a,b]).valid,true)
 assert.equal(validateSubplotLayout(field,[a,a]).reason,'duplicate_id')
 assert.equal(validateSubplotLayout(field,[a,{id:'2',points:rectangle(-12.047,-75.367,-12.0455,-75.3655)}]).reason,'overlap')
 assert.equal(validateSubplotLayout(field,[{id:'outer',points:rectangle(-12.050,-75.367,-12.046,-75.366)}]).reason,'outside_field')
})
