import {useEffect, useRef, useState} from 'react'
import {format, type Position} from './domain'
import {httpErrorMessage, readableApiError} from './network'
import './rain-forecast.css'

type RainReport = {
 issued_at:string;target_month:string;location:{latitude:number;longitude:number};
 model:{id:string;revision:string;mode:string;fine_tuned:false};
 source:{name:string;first_month:string;last_month:string;complete_months:number};
 prediction:{p10_mm:number;median_mm:number;p90_mm:number};seasonal_reference_mm:number;
 evaluation:{status:string;lead_months:number;interval_calibrated:false;folds:{from_month:string;to_month:string;examples:number;mae_model_mm:number;mae_seasonal_mm:number;relative_improvement:number;empirical_p10_p90_coverage:number}[]};
 history:{month:string;total_mm:number}[];limitations:string[]
}
type RainExperiment = {
 history_months:number;training_months:number;trainable_parameters:number;total_parameters:number;
 published:false;eligible_for_publication:boolean;
 dates:{train_from:string;train_to:string;validation_from:string;validation_to:string;test_from:string;test_to:string};
 validation:{selected:'original'|'lora';original:{mae_mm:number};lora:{mae_mm:number}};
 candidates:{learning_rate:number;steps:number;validation_mae_mm:number}[];
 test_folds:{from_month:string;to_month:string;original:{mae_mm:number};lora:{mae_mm:number};seasonal_mae_mm:number}[]
}
type ForecastResult = {status:string;report:RainReport|null;experiment?:RainExperiment|null;message?:string;message_en?:string}
type Pilot = {name:string;location:{latitude:number;longitude:number};crops:{id:string;name:string}[]}

function monthName(value:string,en:boolean){
 return new Intl.DateTimeFormat(en?'en-US':'es-PE',{month:'long',year:'numeric',timeZone:'UTC'}).format(new Date(`${value}T00:00:00Z`))
}

export function RainForecast({point,onPick,api,en}:{point:Position|null;onPick:(p:Position)=>void;api:string;en:boolean}){
 const [pilot,setPilot]=useState<Pilot|null>(null)
 const [result,setResult]=useState<{key:string;data:ForecastResult}|null>(null)
 const [busy,setBusy]=useState(false)
 const [error,setError]=useState('')
 const controller=useRef<AbortController|null>(null)
 const key=point?`${point.lat.toFixed(6)},${point.lng.toFixed(6)}`:''
 useEffect(()=>{
  const abort=new AbortController()
  void fetch(`${api}/api/agro/pilot`,{signal:abort.signal}).then(async response=>{
   if(response.ok){const data=await response.json() as Pilot;if(!abort.signal.aborted)setPilot(data)}
  }).catch(()=>{})
  return()=>abort.abort()
 },[api])
 useEffect(()=>{
  controller.current?.abort();setResult(null);setBusy(false);setError('')
  return()=>controller.current?.abort()
 },[key,api])
 async function load(){
  if(!point)return
  controller.current?.abort()
  const abort=new AbortController();controller.current=abort
  const timeout=setTimeout(()=>abort.abort(new DOMException('Request timed out','TimeoutError')),120000)
  setBusy(true);setError('');setResult(null)
  try{
   const response=await fetch(`${api}/api/agro/rain-forecast`,{method:'POST',signal:abort.signal,
    headers:{'Content-Type':'application/json'},body:JSON.stringify({latitude:point.lat,longitude:point.lng})})
   if(!response.ok)throw Error(await httpErrorMessage(response,en))
   const data=await response.json() as ForecastResult
   if(!abort.signal.aborted)setResult({key,data})
  }catch(err){if(!abort.signal.aborted)setError(readableApiError(err,en));else if(abort.signal.reason?.name==='TimeoutError')setError(readableApiError(abort.signal.reason,en))}
  finally{clearTimeout(timeout);if(controller.current===abort)setBusy(false)}
 }
 const shown=result?.key===key?result.data:null
 const report=shown?.status==='available'?shown.report:null
 const experiment=report?shown?.experiment:null
 const maximum=report?Math.max(1,report.prediction.p90_mm,report.seasonal_reference_mm)*1.15:1
 const percent=(value:number)=>`${Math.max(0,Math.min(100,value/maximum*100))}%`
 return <section className="terra-geo-reading terra-rain-forecast" aria-label={en?'Experimental regional rainfall forecast':'Predicción experimental de lluvia regional'}>
  <small>{en?'PRETRAINED MODEL · REGIONAL ESTIMATE':'MODELO PREENTRENADO · ESTIMACIÓN REGIONAL'}</small>
  <h3>{en?'How much might it rain next month?':'¿Cuánto podría llover el próximo mes?'}</h3>
  <p>{en?'Explore a monthly estimate based on NASA rainfall history. Compare it with the usual rainfall for that month.':'Explora una estimación mensual basada en el histórico de lluvia de NASA. Compárala con lo habitual para ese mes.'}</p>
  {pilot&&<div className="terra-forecast-pilot"><span>{en?'Pilot':'Piloto'} · {pilot.name}</span>
   <button type="button" onClick={()=>onPick({lat:pilot.location.latitude,lng:pilot.location.longitude})}>{en?'Go to Calca pilot':'Ir al piloto de Calca'}</button>
  </div>}
  <button type="button" className="terra-geo-fetch" disabled={!point||busy} onClick={()=>void load()}>{busy?(en?'Preparing estimate…':'Preparando estimación…'):(en?'View rainfall estimate':'Consultar estimación de lluvia')}</button>
  {!point&&<p role="status">{en?'Choose a location or go to the Calca pilot first.':'Primero elige una ubicación o ve al piloto de Calca.'}</p>}
  {busy&&<p role="status">{en?'The first calculation may take a few moments.':'El primer cálculo puede tardar unos momentos.'}</p>}
  {error&&<p role="alert" className="terra-forecast-warning">{error}</p>}
  {shown&&!report&&<p role="status" className="terra-forecast-warning">{en?shown.message_en:shown.message}</p>}
  {report&&<div className="terra-forecast-result" aria-live="polite">
   <p className="terra-forecast-month">{monthName(report.target_month,en)}</p>
   <strong className="terra-forecast-estimate">{format(report.prediction.median_mm)} <span>mm</span></strong>
   <p>{en?'Central estimate of monthly regional rainfall':'Estimación central de lluvia mensual regional'}</p>
   <div className="terra-forecast-range" role="img" aria-label={en?`Model range ${format(report.prediction.p10_mm)} to ${format(report.prediction.p90_mm)} millimeters; seasonal reference ${format(report.seasonal_reference_mm)} millimeters`:`Rango del modelo de ${format(report.prediction.p10_mm)} a ${format(report.prediction.p90_mm)} milímetros; referencia estacional de ${format(report.seasonal_reference_mm)} milímetros`}>
    <span className="terra-forecast-interval" style={{left:percent(report.prediction.p10_mm),width:percent(report.prediction.p90_mm-report.prediction.p10_mm)}}/>
    <span className="terra-forecast-median" style={{left:percent(report.prediction.median_mm)}}/>
    <span className="terra-forecast-reference" style={{left:percent(report.seasonal_reference_mm)}}/>
   </div>
   <dl className="terra-forecast-values">
    <div><dt>{en?'Model range':'Rango del modelo'}</dt><dd>{format(report.prediction.p10_mm)}–{format(report.prediction.p90_mm)} mm</dd></div>
    <div><dt>{en?'Historical seasonal median':'Mediana histórica estacional'}</dt><dd>{format(report.seasonal_reference_mm)} mm</dd></div>
   </dl>
   <p className="fineprint">{en?'The model range uses its 10th and 90th quantiles. Its coverage has not been calibrated locally.':'El rango usa los cuantiles 10 y 90 del modelo. Su cobertura aún no está calibrada localmente.'}</p>
   <p className={`terra-forecast-evaluation ${report.evaluation.status==='beat_seasonal_reference'?'improved':''}`}>
    {report.evaluation.status==='beat_seasonal_reference'?(en?'Improved on the seasonal reference in both retrospective periods.':'Mejoró la referencia estacional en ambos periodos retrospectivos.'):(en?'Did not improve enough on the seasonal reference. Keep this estimate experimental.':'No mejoró lo suficiente frente a la referencia estacional. Mantén esta estimación como experimental.')}
   </p>
   <details><summary>{en?'How was it checked?':'¿Cómo se comprobó?'}</summary>
    <p>{en?'Two consecutive 24-month periods, predicting each target from earlier observations only. Comparison uses final NASA data, not archived historical releases. Pretraining overlap cannot be ruled out.':'Dos periodos consecutivos de 24 meses, estimando cada mes con observaciones anteriores. La comparación usa datos finales de NASA; no reconstruye sus publicaciones históricas. No se puede descartar solapamiento con el preentrenamiento.'}</p>
    {report.evaluation.folds.map(fold=><div className="terra-forecast-fold" key={fold.from_month}>
     <strong>{fold.from_month.slice(0,7)} — {fold.to_month.slice(0,7)}</strong>
     <span>{en?'Mean absolute error':'Error absoluto medio'}: {format(fold.mae_model_mm)} mm · {en?'seasonal reference':'referencia estacional'}: {format(fold.mae_seasonal_mm)} mm</span>
    </div>)}
    <p>{report.model.id} · {en?'original pretrained weights':'pesos originales preentrenados'} · {en?'no fine-tuning':'sin fine-tuning'}.</p>
    <p>NASA POWER · {report.source.first_month.slice(0,7)} — {report.source.last_month.slice(0,7)} · {report.source.complete_months} {en?'complete months':'meses completos'}.</p>
    <p>{en?'Prepared':'Preparado'}: {report.issued_at.slice(0,10)} (UTC).</p>
    <p className="fineprint">{en?'No independent field validation. This does not determine crop suitability, harvests or irrigation needs.':'Sin validación independiente de campo. No determina aptitud de cultivos, cosechas ni necesidades de riego.'}</p>
   </details>
   {experiment&&<details className="terra-forecast-adaptation"><summary>{en?'Did adapting the model improve it?':'¿Mejoró al adaptar el modelo?'}</summary>
    <p>{en?`Compared ${experiment.candidates.length} model adaptations using ${experiment.history_months} months of NASA history. The original forecast remains active.`:`Se compararon ${experiment.candidates.length} ajustes del modelo con ${experiment.history_months} meses de históricos NASA. El pronóstico original sigue activo.`}</p>
    <p className="fineprint">{en?'This study uses an extended history. Its comparison is separate from the estimate shown above. A 5% validation-error reduction was required to select an adaptation.':'Este estudio usa un histórico ampliado. Su comparación es distinta de la estimación mostrada arriba. Se exigía reducir al menos un 5 % el error de validación para elegir un ajuste.'}</p>
    <p className="terra-forecast-evaluation">{experiment.eligible_for_publication
     ?(en?'The candidate met the retrospective comparison gates and remains a research result pending independent validation.':'La candidata cumplió los criterios retrospectivos y permanece como resultado de investigación, pendiente de validación independiente.')
     :experiment.validation.selected==='original'
      ?(en?'The adjustment did not improve validation enough. The original model is retained.':'El ajuste no mejoró lo suficiente la validación. Se conserva el modelo original.')
      :(en?'The adjustment improved validation but did not meet all final comparison criteria. The original model is retained.':'El ajuste mejoró la validación, pero no cumplió todos los criterios de comparación final. Se conserva el modelo original.')}</p>
    <p>{en?'Mean absolute error in millimeters. Lower is better.':'Error absoluto medio en milímetros. Un valor menor es mejor.'}</p>
    <table className="terra-forecast-comparison">
     <caption>{en?'Same dates and inputs for both models':'Mismas fechas y entradas para ambos modelos'}</caption>
     <thead><tr><th scope="col">{en?'Period':'Periodo'}</th><th scope="col">Original</th><th scope="col">{en?'Adapted':'Adaptado'}</th><th scope="col">{en?'Seasonal':'Habitual'}</th></tr></thead>
     <tbody>{experiment.test_folds.map(fold=><tr key={fold.from_month}>
      <th scope="row">{fold.from_month.slice(0,7)}<br/>{fold.to_month.slice(0,7)}</th>
      <td>{format(fold.original.mae_mm)}</td><td>{format(fold.lora.mae_mm)}</td><td>{format(fold.seasonal_mae_mm)}</td>
     </tr>)}</tbody>
    </table>
    <p>{en?'Validation error':'Error de validación'}: {en?'original':'original'} {format(experiment.validation.original.mae_mm,2)} mm · {en?'best adaptation':'mejor adaptación'} {format(experiment.validation.lora.mae_mm,2)} mm.</p>
    <p className="fineprint">{en?`Weights were adjusted through ${experiment.dates.train_to.slice(0,7)}. Candidate selection used validation through ${experiment.dates.validation_to.slice(0,7)}, before the comparison origins.`:`Los pesos se ajustaron hasta ${experiment.dates.train_to.slice(0,7)}. La selección usó validación hasta ${experiment.dates.validation_to.slice(0,7)}, anterior a los orígenes de comparación.`}</p>
    <p className="fineprint">{en?'These are retrospective periods previously examined with the original model. This is not a new prospective test or evidence of crop suitability.':'Son periodos retrospectivos ya examinados con el modelo original. No es una prueba prospectiva nueva ni evidencia de aptitud agrícola.'}</p>
   </details>}
  </div>}
 </section>
}
