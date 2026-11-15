/** Explain a REAL trained HLS vegetation model without forcing farmers to read metrics. */
export type AIEvidence={
 status:string;used_for_decision?:boolean;influenced_recommendation?:boolean;
 model_id?:string;source_sensor?:string;
 observed_months?:number;missing_months?:number;
 source_period?:{start:string;end:string};
 holdout_classification?:{test_observations:number;accuracy_percent:number|null;
  precision_percent:number|null;recall_percent:number|null;f1_percent:number|null;
  decision_threshold:number;confusion_matrix:{tp:number;tn:number;fp:number;fn:number}};
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
    <p>{es?'Revisamos la vegetación de esta parcela en imágenes anteriores de NASA para encontrar temporadas que conviene vigilar.':'We reviewed NASA imagery of this field to find seasons worth watching closely.'}</p>
   </div>
  </div>
  <p className="b-ai-farmer-finding">{es?'Temporadas para prestar atención a la cobertura: ':'Seasons to watch for low vegetation: '}
   <strong>{top.map(x=>months[x.month-1]).join(' · ')}</strong>.
  </p>
  <p className="b-ai-farmer-context">{es?'Es una señal histórica de vegetación baja desde el espacio; no confirma suelo desnudo, cultivos específicos ni rendimientos.':'This is a historical low-vegetation signal from space; it does not confirm bare soil, specific crops or yields.'}</p>
  <details className="b-ai-details">
   <summary>{es?'Ver cómo se entrenó la IA con NASA':'How was the NASA model trained?'}</summary>
   <div className="b-ai-details-content">
    <p>{es?'Datos reales de NASA HLS: ':'Real NASA HLS data: '}<strong>{ai.observed_months}</strong> {es?'meses con imágenes útiles':'months with usable images'}{ai.missing_months!=null?', '+ai.missing_months+' '+(es?'meses sin lectura':'months missing'):''}.
     {' '}{es?'Entrenamiento inicial: 33 observaciones; prueba posterior: 11.':'Initial training: 33 observations; later holdout: 11.'}</p>
    {tested&&<p>{es?'Error en la prueba de meses posteriores (Brier; menor es mejor):':'Later-month test error (Brier; lower is better):'}
     {' '}<strong>{ai.holdout!.brier_model.toFixed(3)}</strong> {es?'con IA, frente a':'AI vs'} <strong>{ai.holdout!.brier_train_prevalence_baseline.toFixed(3)}</strong> {es?'con una referencia sin aprendizaje estacional.':'with a non-seasonal baseline.'}</p>}
    {ai.holdout_classification&&<section className="b-ai-scoped-metrics" aria-label={es?'Métricas de prueba independientes':'Independent holdout metrics'}>
     <h4>{es?'Evaluación de clasificación de vegetación baja':'Low-vegetation classification evaluation'}</h4>
     <p>{es?'Prueba cronológica posterior, no entrenamiento: ':'Later chronological holdout, not training: '}
      <strong>{ai.holdout_classification.test_observations}</strong> {es?'meses. Umbral de decisión fijado: ':'months. Fixed decision threshold: '}
      {ai.holdout_classification.decision_threshold.toFixed(2)}.</p>
     <div className="b-ai-metrics-grid">{([
      ['Accuracy',ai.holdout_classification.accuracy_percent],
      ['Precision',ai.holdout_classification.precision_percent],
      ['Recall',ai.holdout_classification.recall_percent],
      ['F1',ai.holdout_classification.f1_percent]
     ] as const).map(([name,value])=><div key={name}><span>{name}</span><strong>{value==null?'—':value.toFixed(1)+' %'}</strong></div>)}</div>
     <p>{es?'Son solo 11 observaciones de una parcela de Barranca. Una precisión alta con esta muestra no prueba desempeño en otros terrenos.':'Only 11 observations from one Barranca field. High precision on this sample does not demonstrate performance elsewhere.'}</p>
    </section>}
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
