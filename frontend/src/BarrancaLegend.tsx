import {BARRANCA_HISTORY,vegetationBand} from './barrancaObservation'
export default function BarrancaLegend({month,onMonth,lang}:{month:string;onMonth:(v:string)=>void;lang:'es'|'en'}){
 const es=lang==='es',observation=BARRANCA_HISTORY.months.find(v=>v.month===month)
 const ndvi=observation?.ndvi??null,band=vegetationBand(ndvi)
 const scene=observation?.best_scene
 return <section className="b-hls-legend" aria-label={es?'Vegetación observada en Barranca':'Observed Barranca vegetation'}>
  <div className="b-hls-heading"><strong>{es?'Vegetación de la parcela':'Field vegetation'}</strong><span>NASA HLS · 30 m</span></div>
  <label>{es?'Mes observado':'Observed month'}<select value={month} onChange={e=>onMonth(e.target.value)}>{[...BARRANCA_HISTORY.months].reverse().map(m=><option key={m.month} value={m.month}>{m.month}{m.ndvi===null?(es?' · sin datos':' · no data'):''}</option>)}</select></label>
  <p className="b-hls-value"><span style={{background:band.color}} aria-hidden="true"/><strong>{es?band.es:band.en}</strong> · NDVI {ndvi===null?'—':ndvi.toFixed(2)}</p>
  <ul className="b-hls-scale">{[
   {v:0.1,range:'−1 a < 0,20',en:'−1 to < 0.20'},
   {v:0.3,range:'0,20 a < 0,40',en:'0.20 to < 0.40'},
   {v:0.6,range:'0,40 a 1',en:'0.40 to 1'},
   {v:null,range:'Sin lectura válida',en:'No valid reading'}
  ].map(row=>{const b=vegetationBand(row.v);return <li key={row.range}><i style={{background:b.color}} aria-hidden="true"/><span><b>{es?b.es:b.en}</b><small>{es?row.range:row.en}</small></span></li>})}</ul>
  <p>{es?'Más verde significa más vegetación observada, no necesariamente un cultivo más sano. Un valor bajo puede aparecer después de cosechar o preparar el terreno.':'Greener means more observed vegetation, not necessarily a healthier crop. Low values may follow harvest or field preparation.'}</p>
  <p>{es?'El color resume el terreno completo; no representa cada píxel ni identifica qué se sembró.':'The color summarizes the whole field; it does not represent individual pixels or identify crops.'}</p>
  <details><summary>{es?'Datos y fuentes de esta lectura':'Reading details and sources'}</summary>
   <p>{es?'Archivo histórico verificado, no medición en vivo. Se conserva el máximo mensual de la mediana de píxeles despejados por escena. Rangos orientativos de visualización, no umbrales agronómicos validados.':'Verified historical archive, not a live measurement. Each month retains the maximum of clear-pixel scene medians. Display ranges are not validated agronomic thresholds.'}</p>
   <p>{es?'Escena seleccionada':'Selected scene'}: {scene?.date??'—'} · {es?'Píxeles válidos':'Valid pixels'}: {scene?.valid_pixels??'—'}</p>
   <p>{scene?.scene_id??(es?'Mes sin observación válida; no se rellenan huecos.':'No valid observation; gaps are not filled.')}</p>
   <a href="https://hls.gsfc.nasa.gov/" target="_blank" rel="noreferrer">NASA HLS</a>
  </details>
 </section>
}
