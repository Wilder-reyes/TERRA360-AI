import {useMemo,useState} from 'react'
import {API,httpErrorMessage,readableApiError} from './network'

type Lang='es'|'en'
type Budget={crop_id:string;yield_kg_ha:number;price_soles_kg:number;cost_soles_ha:number}
type Plan={id:string;plantings:{crop_id:string}[]}
type EconItem={strategy_id:string;status:string;margin_soles_ha_24months?:number;
 revenue_soles_ha_24months?:number;cost_soles_ha_24months?:number;missing_crop_ids?:string[]}
export type EconomicReport={status:string;strategies:EconItem[];source:string}
type Source={name:string;url:string}
type OfficialRecord={status:string;source?:Source;document_url?:string;records?:{date:string;value:number;unit:string;location:string}[];data_quality?:string}
type Context={
 ana_historical_context?:{status:string;statistics?:{river:string;average_flow_m3_s:number}[];
   reference_url?:string;document_date?:string;use_for_irrigation_allocation?:boolean};
 basin?:OfficialRecord;weather_alerts?:OfficialRecord;market_prices?:OfficialRecord
}
type Soil={status:string;alerts?:{crop_id:string;message_es:string}[];needs_review?:string[]}
type Props={lang:Lang;strategies:Plan[];names:Record<string,[string,string]>;context?:Context;
 soil?:Soil;irrigationKnown:boolean;onBudget:(report:EconomicReport|null)=>void;report:EconomicReport|null}

const fmt=(n:number,lang:Lang)=>new Intl.NumberFormat(lang==='es'?'es-PE':'en-US',{maximumFractionDigits:0}).format(n)
const ROOT_SOURCES={
 ana:'https://www.gob.pe/86460-acceder-al-sistema-nacional-de-informacion-de-recursos-hidricos',
 senamhi:'https://www.senamhi.gob.pe/?p=aviso-meteorologico',
 market:'https://www.gob.pe/institucion/midagri/colecciones/94874-reporte-de-ingreso-y-precios-en-el-gran-mercado-mayorista-de-lima-2026'
}
export default function FarmDecisionEvidence({lang,strategies,names,context,soil,irrigationKnown,onBudget,report}:Props){
 const es=lang==='es'
 const ids=useMemo(()=>Array.from(new Set(strategies.flatMap(s=>s.plantings.map(p=>p.crop_id)))),[strategies])
 const [values,setValues]=useState<Record<string,{yield:string;price:string;cost:string}>>({})
 const [busy,setBusy]=useState(false)
 const [error,setError]=useState('')
 const name=(id:string)=>names[id]?.[es?0:1]||id
 function update(id:string,key:'yield'|'price'|'cost',value:string){
  setValues(old=>({...old,[id]:{...(old[id]??{yield:'',price:'',cost:''}),[key]:value}}))
  onBudget(null);setError('')
 }
 async function calculate(){
  const budgets:Budget[]=[]
  for(const id of ids){
   const x=values[id]
   if(!x||!x.yield.trim()||!x.price.trim()||!x.cost.trim()){
    setError(es?'Completa los tres datos de cada cultivo para comparar todos los planes.':'Enter all three values per crop to compare all plans.')
    return
   }
   const nums=[Number(x.yield),Number(x.price),Number(x.cost)]
   if(nums.some(v=>!Number.isFinite(v)||v<0)||nums[0]>300000||nums[1]>10000||nums[2]>1000000){
    setError(es?'Revisa los números de cada cultivo.':'Check crop values.');return
   }
   budgets.push({crop_id:id,yield_kg_ha:nums[0],price_soles_kg:nums[1],cost_soles_ha:nums[2]})
  }
  setBusy(true);setError('')
  try{
   const res=await fetch(API+'/api/rotation/economics',{
    method:'POST',headers:{'Content-Type':'application/json'},
    body:JSON.stringify({strategies:strategies.map(s=>({id:s.id,plantings:s.plantings.map(p=>({crop_id:p.crop_id}))})),crop_budgets:budgets})
   })
   if(!res.ok)throw new Error(await httpErrorMessage(res,!es))
   onBudget(await res.json() as EconomicReport)
  }catch(e){setError(readableApiError(e,!es))}
  finally{setBusy(false)}
 }
 const review=soil?.alerts||[]
 return <div className="b-decision-support">
  <section className="b-decision-check">
   <div className="b-decision-check-heading"><span aria-hidden="true">✓</span><h2>{es?'Antes de la próxima siembra':'Before your next planting'}</h2></div>
   <p>{irrigationKnown?(es?'Confirma con tu comisión de usuarios la cantidad y fecha de agua anotadas.':'Confirm the recorded water allocation and dates with your water users board.'):
     (es?'Confirma con tu comisión de usuarios cuándo te toca el agua.':'Check your irrigation turn with the local water users board.')}</p>
   {review.length>0?<p className="b-decision-soil-risk">{es?'El resultado de suelo requiere revisión para: ':'The soil results need review for: '}{review.map(x=>name(x.crop_id)).join(', ')}.</p>:
    <p>{es?'Antes de sembrar, comprueba las condiciones de tu suelo para los nuevos cultivos.':'Check soil conditions for the new crops before planting.'}</p>}
   <a href={ROOT_SOURCES.senamhi} target="_blank" rel="noreferrer">{es?'Consultar avisos del tiempo en SENAMHI':'Check SENAMHI weather advisories'}</a>
  </section>
  <details className="b-farm-econ">
   <summary>{es?'¿Cuánto podría costar la siembra? (opcional)':'What could planting cost? (optional)'}</summary>
   <div className="b-farm-econ-inner">
    <p>{es?'Usa tus propios números por hectárea. El resultado es solo una cuenta de ingresos menos gastos para dos años, no una predicción de ganancias.':'Use your own values per hectare. This is a two-year revenue-minus-cost calculation, not a profit forecast.'}</p>
    <div className="b-econ-crops">{ids.map(id=><fieldset key={id}><legend>{name(id)}</legend>
      <div className="b-econ-fields">
       <label>{es?'¿Cuántos kilos cosecharías en una hectárea?':'Expected kilograms per hectare'}
        <input type="number" min="0" max="300000" step="1" inputMode="numeric" value={values[id]?.yield||''} onChange={e=>update(id,'yield',e.target.value)} placeholder={es?'Ej. 10000':'e.g. 10000'}/></label>
       <label>{es?'¿A cuánto venderías cada kilo? (S/)':'Farmgate price (S/ per kg)'}
        <input type="number" min="0" max="10000" step=".01" inputMode="decimal" value={values[id]?.price||''} onChange={e=>update(id,'price',e.target.value)} placeholder={es?'Ej. 1.50':'e.g. 1.50'}/></label>
       <label>{es?'¿Cuánto gastarías por hectárea? (S/)':'Costs per hectare (S/)'}
        <input type="number" min="0" max="1000000" step=".01" inputMode="decimal" value={values[id]?.cost||''} onChange={e=>update(id,'cost',e.target.value)} placeholder={es?'Ej. 9000':'e.g. 9000'}/></label>
      </div>
    </fieldset>)}</div>
    {error&&<p className="b-error" role="alert">{error}</p>}
    <button type="button" className="b-btn b-btn-solid" disabled={busy} onClick={()=>void calculate()}>{busy?(es?'Calculando…':'Calculating…'):(es?'Calcular con mis datos':'Calculate with my values')}</button>
    {report&&<div className="b-econ-outcomes" aria-live="polite"><h3>{es?'Cuenta aproximada de dos años, por hectárea':'Approximate two-year margin, per hectare'}</h3>
      {report.strategies.map((row,index)=><div key={row.strategy_id} className="b-econ-result"><span>{row.strategy_id==='S0'?(es?'Lo que haces hoy':'Your current planting'):(es?'Opción '+index:'Option '+index)}</span>
       <strong>{row.status==='estimated_from_farmer_inputs'&&row.margin_soles_ha_24months!=null?'S/ '+fmt(row.margin_soles_ha_24months,lang):(es?'Faltan datos':'Missing data')}</strong>
      </div>)}
      <p>{es?'No considera riesgos de mercado, pérdida de cosecha, préstamos ni cambios de precio.':'Does not cover market risk, crop failure, loans or price changes.'}</p>
     </div>}
    <a href={ROOT_SOURCES.market} target="_blank" rel="noreferrer">{es?'Consultar precios mayoristas de MIDAGRI':'Check MIDAGRI wholesale prices'}</a>
    <p className="b-decision-footnote">{es?'El precio mayorista no es necesariamente el precio que recibirás en tu chacra.':'Wholesale prices are not necessarily farmgate prices.'}</p>
   </div>
  </details>
  <details className="b-evidence-sources">
    <summary>{es?'Fuentes oficiales y datos técnicos':'Official sources and technical data'}</summary>
    <div className="b-evidence-body">
     {context?.ana_historical_context?.status==='published_historical_reference'&&<p>{es?'ANA publicó estos promedios históricos de los ríos: ':'ANA published these historical average river flows: '}
       {context.ana_historical_context.statistics?.map(x=>x.river+' '+x.average_flow_m3_s+' m³/s').join(' · ')}.
       {es?' No son el caudal de hoy ni tu agua de riego.':'These are not current river levels or your irrigation allocation.'}
       {' '}<a href={context.ana_historical_context.reference_url} target="_blank" rel="noreferrer">{es?'Ver documento ANA':'ANA source'}</a>
      </p>}
     <p>{es?'Lecturas ANA por estación: ':'ANA station readings: '}{context?.basin?.status==='curated_record'?
      (es?'registro revisado; consulta fecha y estación en la fuente.':'reviewed dated record; check the original source.'):
      (es?'sin registro actual confirmado para esta chacra.':'no confirmed current record for this field.')}
      {' '}<a href={ROOT_SOURCES.ana} target="_blank" rel="noreferrer">ANA</a></p>
     <p>{es?'Avisos SENAMHI: ':'SENAMHI alerts: '}{context?.weather_alerts?.status==='curated_record'?
      (es?'hay un aviso vigente registrado; consulta su alcance.':'a current notice is recorded; check its area.'):
      (es?'consulta los avisos oficiales. No interpretamos la falta de datos como ausencia de peligro.':'check official alerts. Lack of data is not proof of no danger.')}
      {' '}<a href={ROOT_SOURCES.senamhi} target="_blank" rel="noreferrer">SENAMHI</a></p>
     <p>{es?'Los precios deben corresponder a la venta del agricultor.':'Farmgate prices must reflect the farmer’s actual sales.'}
      {' '}<a href={ROOT_SOURCES.market} target="_blank" rel="noreferrer">MIDAGRI</a></p>
     <p>{soil?.status==='screened_with_expert_reviewed_reference'?
      (es?'El análisis de suelo se revisó con rangos agronómicos documentados; verifica la variedad.':'Soil results were screened with sourced crop ranges; check the variety.'):
      (es?'El suelo todavía no puede confirmar si un cultivo es adecuado.':'Soil evidence cannot yet confirm crop suitability.')}</p>
    </div>
  </details>
 </div>
}
