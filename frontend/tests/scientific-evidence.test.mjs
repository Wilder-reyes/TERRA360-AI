import test from 'node:test'
import assert from 'node:assert/strict'
import {qualityForDaily,summaryForDaily} from '../src/scientificEvidence.ts'
import {GIBS_LAYERS,gibsLegendUrl,isScienceLayer} from '../src/scientificLayers.ts'

test('NASA GIBS layers preserve the real identifiers and native scale labels',()=>{
 assert.equal(GIBS_LAYERS.vegetation.wmsLayer,'MODIS_Terra_NDVI_8Day')
 assert.equal(GIBS_LAYERS.rain.wmsLayer,'IMERG_Precipitation_Rate')
 assert.match(GIBS_LAYERS.rain.resolutionEs,/10 km/)
 assert.match(gibsLegendUrl('vegetation'),/GetLegendGraphic/)
 assert.ok(isScienceLayer('vegetation'))
 assert.ok(!isScienceLayer('terrain'))
 for(const entry of Object.values(GIBS_LAYERS)){
  assert.ok(entry.sourceUrl.startsWith('https://'))
  assert.ok(entry.limitationsEs.length>20)
 }
})
test('missing daily data stays missing, never a full annual rainfall total',()=>{
 const rows=[{date:'2024-01-01',PRECTOTCORR:2.5,T2M:12,RH2M:null,T2M_MIN:4,T2M_MAX:20},
  {date:'2024-01-02',PRECTOTCORR:null,T2M:null,RH2M:null,T2M_MIN:null,T2M_MAX:null}]
 const q=qualityForDaily(rows,'2024-01-01','2024-12-31')
 assert.equal(q.expected_days,366)
 assert.equal(q.valid_days_by_variable.PRECTOTCORR,1)
 assert.equal(q.completeness,'partial')
 const summary=summaryForDaily(rows,q)
 assert.equal(summary.observedRainMm,2.5)
 assert.equal(summary.annualRainMm,null)
 assert.equal(summary.validRainDays,1)
 assert.equal(summary.meanTemperatureC,12)
})
test('only complete date ranges permit labeling precipitation as a period total',()=>{
 const rows=[{date:'2026-11-01',PRECTOTCORR:1,T2M:10,T2M_MIN:5,T2M_MAX:20,RH2M:70},
  {date:'2026-11-02',PRECTOTCORR:3,T2M:12,T2M_MIN:6,T2M_MAX:21,RH2M:70}]
 const q=qualityForDaily(rows,'2026-11-01','2026-11-02')
 assert.equal(q.completeness,'complete')
 assert.equal(summaryForDaily(rows,q).annualRainMm,4)
})
test('duplicate and out-of-period observations never inflate period completeness',()=>{
 const rows=[{date:'2024-01-01',PRECTOTCORR:5,T2M:11},{date:'2024-01-01',PRECTOTCORR:5,T2M:11},{date:'2023-12-31',PRECTOTCORR:999,T2M:99}]
 const q=qualityForDaily(rows,'2024-01-01','2024-01-02')
 assert.equal(q.valid_days_by_variable.PRECTOTCORR,1)
 assert.equal(q.calendar_days_represented,1)
 assert.equal(q.completeness,'partial')
})

test('a perfectly valid period ignores rainfall rows outside that period',()=>{
 const rows=[
  {date:'2026-11-01',PRECTOTCORR:1,T2M:20,T2M_MIN:9,T2M_MAX:23,RH2M:70},
  {date:'2026-11-02',PRECTOTCORR:3,T2M:21,T2M_MIN:9,T2M_MAX:23,RH2M:70},
  {date:'2026-10-31',PRECTOTCORR:999,T2M:22,T2M_MIN:9,T2M_MAX:23,RH2M:70}
 ]
 const q=qualityForDaily(rows,'2026-11-01','2026-11-02')
 assert.equal(summaryForDaily(rows,q).annualRainMm,4)
})
