/** Pure, conservative display helpers for gridded historical climate observations. */
import type {RecordRow} from './domain'
export type DailyQuality = {
 period_start:string;period_end:string;expected_days:number;calendar_days_represented:number
 valid_days_by_variable:Record<string,number>
 coverage_percent_by_variable:Record<string,number>
 completeness:'complete'|'partial';missing_days_are_zero:false
}
export function calendarDayCount(start:string,end:string):number{
 const s=Date.parse(`${start}T00:00:00Z`),e=Date.parse(`${end}T00:00:00Z`)
 return Number.isFinite(s)&&Number.isFinite(e)&&e>=s?Math.round((e-s)/86400000)+1:0
}
export function qualityForDaily(rows:RecordRow[],start:string,end:string,server?:DailyQuality):DailyQuality{
 const expected_days=calendarDayCount(start,end)
 const variables=['PRECTOTCORR','T2M','T2M_MAX','T2M_MIN','RH2M'] as const
 const valid_days_by_variable:Record<string,number>={}
 const coverage_percent_by_variable:Record<string,number>={}
 const filtered = new Map<string,RecordRow>()
 for(const row of rows)if(row.date>=start&&row.date<=end)filtered.set(row.date,row)
 for(const key of variables){
  const count=[...filtered.values()].filter(r=>typeof r[key]==='number'&&Number.isFinite(r[key])).length
  valid_days_by_variable[key]=Math.min(count,expected_days)
  coverage_percent_by_variable[key]=expected_days?Math.round(1000*Math.min(count,expected_days)/expected_days)/10:0
 }
 const calculated:DailyQuality={period_start:start,period_end:end,expected_days,calendar_days_represented:filtered.size,valid_days_by_variable,
  coverage_percent_by_variable,completeness:expected_days>0&&variables.every(v=>valid_days_by_variable[v]===expected_days)?'complete':'partial',missing_days_are_zero:false}
 // Never trust a server-provided quality assertion that could be more optimistic than the actual rows.
 if(!server||server.expected_days!==expected_days)return calculated
 return calculated
}
export function summaryForDaily(rows:RecordRow[],quality:DailyQuality){
 const uniqueRows=[...new Map(rows.filter(r=>r.date>=quality.period_start&&r.date<=quality.period_end).map(r=>[r.date,r])).values()]
 const rain=uniqueRows.map(r=>r.PRECTOTCORR).filter((n):n is number=>typeof n==='number'&&Number.isFinite(n))
 const temps=uniqueRows.map(r=>r.T2M).filter((n):n is number=>typeof n==='number'&&Number.isFinite(n))
 const rainSum=rain.length?rain.reduce((a,b)=>a+b,0):null
 const meanT=temps.length?temps.reduce((a,b)=>a+b,0)/temps.length:null
 return {
  observedRainMm:rainSum,
  annualRainMm:quality.expected_days>0&&quality.valid_days_by_variable.PRECTOTCORR===quality.expected_days?rainSum:null,
  validRainDays:quality.valid_days_by_variable.PRECTOTCORR,
  rainCoveragePercent:quality.coverage_percent_by_variable.PRECTOTCORR,
  meanTemperatureC:meanT,
  validTemperatureDays:quality.valid_days_by_variable.T2M,
  temperatureCoveragePercent:quality.coverage_percent_by_variable.T2M,
 }
}
