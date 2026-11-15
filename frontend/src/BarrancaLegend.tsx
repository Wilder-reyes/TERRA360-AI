import {BARRANCA_HISTORY,vegetationBand} from './barrancaObservation'
export default function BarrancaLegend({month,onMonth,lang}:{month:string;onMonth:(v:string)=>void;lang:'es'|'en'}){
 const es=lang==='es',observation=BARRANCA_HISTORY.months.find(v=>v.month===month)
 const ndvi=observation?.ndvi??null,band=vegetationBand(ndvi),scene=observation?.best_scene
 const short=(iso:string)=>{const [y,m]=iso.split('-');return new Date(Date.UTC(Number(y),Number(m)-1,1)).toLocaleDateString(es?'es-PE':'en-US',{month:'long',year:'numeric',timeZone:'UTC'})}
 return <section className="b-hls-legend chakra-simple-legend" aria-label={es?'Vegetación observada en Barranca':'Observed Barranca vegetation'}>
  <div className="b-hls-heading"><strong>{es?'¿Qué muestra el satélite?':'What does the satellite show?'}</strong><small>NASA HLS · {es?'Parcela de estudio':'Study field'}</small></div>
  <div className="chakra-legend-focus">
   <span className="chakra-legend-current" style={{background:band.color}} aria-hidden="true"/>
   <div><strong>{ndvi===null?(es?'Lectura pendiente':'Reading unavailable'):(es?band.es:band.en)}</strong>
    <p>{ndvi===null?(es?'Este mes necesita una observación válida para interpretarlo.':'A valid observation is needed for this month.'):(es?'Así se observó la cobertura vegetal del terreno en este periodo.':'This is the observed vegetation coverage of the field for this period.')}</p></div>
   <label>{es?'Mes':'Month'}<select aria-label={es?'Elegir mes de observación':'Choose observation month'} value={month} onChange={e=>onMonth(e.target.value)}>
    {[...BARRANCA_HISTORY.months].reverse().map(m=><option key={m.month} value={m.month}>{short(m.month)}{m.ndvi===null?(es?' · por revisar':' · unavailable'):''}</option>)}
   </select></label>
  </div>
  <div className="chakra-legend-scale" aria-label={es?'Escala de cobertura vegetal':'Vegetation coverage scale'}>
   {[{v:.1,title:es?'Baja':'Low'},{v:.3,title:es?'Intermedia':'Medium'},{v:.6,title:es?'Alta':'High'}].map(row=><span key={row.v}><i style={{background:vegetationBand(row.v).color}}/>{row.title}</span>)}
  </div>
  <p className="chakra-legend-meaning">{es?'Más verde indica más vegetación observada. Una zona con poca vegetación podría estar recién cosechada o preparada para sembrar.':'Greener means more observed vegetation. A low-vegetation field may have been harvested or prepared for planting.'}</p>
  <details className="chakra-legend-method"><summary>{es?'Cómo se obtuvo esta lectura':'How this observation was derived'}</summary>
   <p>{es?'Índice NDVI de la parcela':'Field NDVI index'}: <strong>{ndvi===null?'—':ndvi.toFixed(3)}</strong> · NASA HLS v2.0 · 30 m</p>
   <p>{es?'Escena seleccionada':'Selected scene'}: {scene?.date??'—'} · {es?'Píxeles válidos':'Valid pixels'}: {scene?.valid_pixels??'—'}</p>
   <p>{es?'Este color resume toda la parcela, no identifica qué se sembró ni confirma el estado de salud del cultivo. Las categorías son orientativas.':'The color summarizes the full field; it does not identify crops or confirm crop health. Categories are illustrative.'}</p>
   <a href="https://hls.gsfc.nasa.gov/" target="_blank" rel="noreferrer">NASA HLS</a>
  </details>
 </section>
}
