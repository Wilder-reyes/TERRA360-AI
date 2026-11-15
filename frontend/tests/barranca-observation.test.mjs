import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {vegetationBand} from '../src/vegetationIndex.ts'

test('published HLS archive is byte-identical to the reproducible model source',()=>{
 const local=readFileSync(new URL('../src/data/barrancaHls.json',import.meta.url))
 const original=readFileSync(new URL('../../backend/app/data/history_seed/3365819f83a772e737d341ec1058efac.json',import.meta.url))
 assert.deepEqual(local,original)
})
test('unknown and invalid NDVI cannot appear as vegetation; band boundaries agree',()=>{
 for(const v of [null,NaN,Infinity,-1.1,1.1])assert.equal(vegetationBand(v).en,'No data')
 assert.equal(vegetationBand(.19999).en,'Little vegetation')
 assert.equal(vegetationBand(.2).en,'Intermediate vegetation')
 assert.equal(vegetationBand(.4).en,'More vegetation')
})
