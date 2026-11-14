import test from 'node:test'
import assert from 'node:assert/strict'
import {computeClimate, cleanNumeric, format} from '../src/domain.ts'

test('missing and nonfinite weather never become zero observations', () => {
  const result = computeClimate([{PRECTOTCORR:null,T2M:null,RH2M:null}, {PRECTOTCORR:NaN,T2M:Infinity,RH2M:NaN}])
  assert.equal(result.rainTotal,null)
  assert.equal(result.validRain,0)
  assert.equal(result.temperature,null)
  assert.equal(result.humidity,null)
})
test('zero rainfall remains a valid observation', () => {
  const result = computeClimate([{PRECTOTCORR:0,T2M:10,RH2M:50}, {PRECTOTCORR:2,T2M:14,RH2M:70}])
  assert.equal(result.rainTotal,2)
  assert.equal(result.validRain,2)
  assert.equal(result.temperature,12)
})
test('soil numeric inputs preserve unknown and reject out-of-range values', () => {
  assert.equal(cleanNumeric('',0,14),undefined)
  assert.equal(cleanNumeric('15',0,14),undefined)
  assert.equal(cleanNumeric('6.5',0,14),6.5)
  assert.equal(format(Infinity),'—')
})


test('cold and hot-day counts exclude missing observations', () => {
  const rows = [
    {PRECTOTCORR:0,T2M:12,T2M_MIN:-2,T2M_MAX:36,RH2M:50},
    {PRECTOTCORR:11,T2M:13,T2M_MIN:3,T2M_MAX:22,RH2M:60},
    {PRECTOTCORR:null,T2M:11,T2M_MIN:null,T2M_MAX:NaN,RH2M:null},
  ]
  const result = computeClimate(rows)
  assert.equal(result.frostDays, 1)
  assert.equal(result.hotDays, 1)
  assert.equal(result.heavyRainDays, 1)
  assert.equal(result.validMin, 2)
  assert.equal(result.validMax, 2)
  assert.equal(result.validRain, 2)
})

test('no valid min/max observations is not reported as zero cold/hot days', () => {
  const r = computeClimate([{PRECTOTCORR:0,T2M:14,T2M_MIN:null,T2M_MAX:null,RH2M:30}])
  assert.equal(r.frostDays, null)
  assert.equal(r.hotDays, null)
})

test('new sessions require an explicit location, and favicon is declared', async () => {
  const {readFile} = await import('node:fs/promises')
  const app = await readFile(new URL('../src/App.tsx',import.meta.url),'utf8')
  const html = await readFile(new URL('../index.html',import.meta.url),'utf8')
  assert.match(app,/useState<Position\|null>\(null\)/)
  assert.doesNotMatch(app,/Referencia: Calca, Cusco/)
  assert.match(app,/if\(!point\)\{setLoading\(false\)/)
  assert.match(html,/href="\/favicon\.svg"/)
})
