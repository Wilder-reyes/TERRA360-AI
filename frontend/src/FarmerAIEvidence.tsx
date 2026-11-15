/** Explain a REAL trained HLS vegetation model without forcing farmers to read metrics. */
export type AIEvidence={
 status:string;used_for_decision?:boolean;influenced_recommendation?:boolean;
 model_id?:string;source_sensor?:string;
 observed_months?:number;missing_months?:number;
 source_period?:{start:string;end:string};
 holdout?:{brier_model:number;brier_train_prevalence_baseline:number;relative_brier_improvement:number;
  test_coefficients?:number[]};
 seasonal_bare_probability?:Record<string,number>;
 weighted_uncovered_exposure?:Record<string,number>;
 source_git_blob_sha?:string;
}
const MONTHS_ES=['ene','feb','mar','abr','may','jun','jul','ago','set','oct','nov','dic']
const MONTHS_EN=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
export default function FarmerAIEvidence({ai,lang}:{ai?:AIEvidence;lang:'es'|'en'}){
 if(!ai||ai.status!=='trained_and_verified'||!ai.seasonal_bare_probability)return null
 const es=lang==='es'
 const months=es?MONTHS_ES:MONTHS_EN
 const risks=Array.from({length:12},(_,i)=>({month:i+1,prob:ai.seasonal_bare_probability?.[String(i+1)]||0}))
 const top=risks.slice().sort((a,b)=>b.prob-a.prob).slice(0,3).sort((a,b)=>a.month-b.month)
 const tested=ai.holdout?.brier_model!=null&&ai.holdout.brier_train_prevalence_baseline!=null
 return <section className="b-ai-farmer" aria-label={es?'Análisis de inteligencia artificial del terreno':'Artificial intelligence field analysis'}>
  <div className="b-ai-farmer-heading">
   <span className="b-ai-mark" aria-hidden="true">✳</span>
   <div><h3>{es?'¿Qué aprendió BIOTEX de esta chacra?':'What did BIOTEX learn from this field?'}</h3>
    <p>{es?'Analizó imágenes NASA de años anteriores para detectar épocas con poca vegetación.':'It studied past NASA images to identify periods of low vegetation.'}</p>
   </div>
  </div>
  <p className="b-ai-farmer-finding">{es?'Meses que el modelo señala para observar de cerca: ':'Months the model flags for closer attention: '}
   <strong>{top.map(x=>months[x.month-1]).join(' · ')}</strong>.
  </p>
  <p className="b-ai-farmer-context">{es?'Esta información ayuda a comparar cuándo podrían quedar meses sin cultivo en cada propuesta. No indica qué especie había sembrada.':'This helps compare when each plan might leave the soil without a crop. It does not identify which species was planted.'}</p>
  <details className="b-ai-details">
   <summary>{es?'Ver cómo se entrenó la IA con NASA':'How was the NASA model trained?'}</summary>
   <div className="b-ai-details-content">
    <p>{es?'Datos reales de NASA HLS: ':'Real NASA HLS data: '}<strong>{ai.observed_months}</strong> {es?'meses con imágenes útiles':'months with usable images'}{ai.missing_months!=null?', '+ai.missing_months+' '+(es?'meses sin lectura':'months missing'):''}.
     {' '}{es?'Entrenamiento inicial: 33 observaciones; prueba posterior: 11.':'Initial training: 33 observations; later holdout: 11.'}</p>
    {tested&&<p>{es?'Error en la prueba de meses posteriores (Brier; menor es mejor):':'Later-month test error (Brier; lower is better):'}
     {' '}<strong>{ai.holdout!.brier_model.toFixed(3)}</strong> {es?'con IA, frente a':'AI vs'} <strong>{ai.holdout!.brier_train_prevalence_baseline.toFixed(3)}</strong> {es?'con una referencia sin aprendizaje estacional.':'with a non-seasonal baseline.'}</p>}
    <p>{es?'Probabilidad modelada de vegetación muy baja por mes (valor estimado, no una medición de rendimiento):':'Modelled probability of very low vegetation by month (not a harvest-yield measure):'}</p>
    <div className="b-ai-months" role="list">{risks.map(x=><div role="listitem" key={x.month} className="b-ai-month" aria-label={months[x.month-1]+' '+Math.round(x.prob*100)+'%'}>
     <span>{months[x.month-1]}</span><div className="b-ai-bar-track"><span className="b-ai-bar" style={{height:Math.max(3,Math.round(x.prob*100))+'%'}}/></div>
     <small>{Math.round(x.prob*100)}%</small>
    </div>)}</div>
    <p className="b-ai-method-note">{es?'Se entrenó una regresión logística con patrones estacionales y una tendencia temporal. Se excluyeron los meses sin observación. Solo es válida para el terreno del estudio y la señal histórica de vegetación; no predice la cosecha.':'A logistic model was trained on seasonality and time trend; cloudy months were excluded. It applies only to this study field and historical vegetation, not crop yield.'}</p>
    <a target="_blank" rel="noreferrer" href="https://github.com/Wilder-reyes/TERRA360-AI/blob/main/docs/BIOTEX_v026_IA_reproducible.md">{es?'Ver procedimiento reproducible':'View reproducible method'}</a>
   </div>
  </details>
 </section>
}
