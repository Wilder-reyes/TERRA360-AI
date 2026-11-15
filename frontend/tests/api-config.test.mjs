import test from 'node:test'
import assert from 'node:assert/strict'
import {apiOrigin} from '../src/apiConfig.ts'
import {parseGeoJSONPolygon} from '../src/geometry.ts'
import {isMantaro} from '../src/farmRegion.ts'
test('production honors a new backend origin and intentional fallbacks are explicit',()=>{
 assert.equal(apiOrigin('https://api.biotex.example/',false),'https://api.biotex.example')
 assert.equal(apiOrigin('http://localhost:8000',true),'http://localhost:8000')
 assert.equal(apiOrigin(undefined,true),'http://localhost:8000')
 assert.equal(apiOrigin('',false),'')
})
test('an API origin rejects credentials, paths, queries and insecure public transport',()=>{
 for(const url of ['https://user:password@api.example','https://api.example/api','https://api.example?token=x','https://api.example/#x','http://api.example','javascript:alert(1)'])assert.throws(()=>apiOrigin(url,false))
})
test('GeoJSON rejects ambiguous parcels, holes and malformed vertices instead of dropping them',()=>{
 const ring=[[-77,-11],[-76.999,-11],[-76.999,-11.001],[-77,-11.001],[-77,-11]]
 const shape={type:'Polygon',coordinates:[ring]}
 assert.deepEqual(parseGeoJSONPolygon(JSON.stringify(shape)),shape)
 assert.equal(parseGeoJSONPolygon(JSON.stringify({...shape,coordinates:[ring,ring]})),null)
 assert.equal(parseGeoJSONPolygon(JSON.stringify({...shape,coordinates:[[...ring,['bad',0]]]})),null)
 assert.equal(parseGeoJSONPolygon(JSON.stringify({type:'FeatureCollection',features:[{geometry:shape},{geometry:shape}]})),null)
})
test('Mantaro scope never includes Barranca',()=>{
 assert.equal(isMantaro({lat:-12.047,lng:-75.366}),true)
 assert.equal(isMantaro({lat:-10.70,lng:-77.73}),false)
 assert.equal(isMantaro({lat:0,lng:0}),false)
})
