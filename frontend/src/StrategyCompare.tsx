// AI-assisted: written with Claude Code (Anthropic) and reviewed by the CHAKRA X team.
/** Step 3 · challenge requirement: compare at least three rotation strategies,
 * including the current one, each with why / evidence / benefits / gaps / risks.
 * S0 current (farmer-declared) · S1 «Water» · S2 «Soil» come from POST /api/rotation/compare.
 * Values are relative estimates (FAO-56 Kc × NASA POWER ET0), never yields or verified savings.
 */
import {useState} from 'react'

type Lang='es'|'en'
type Bilingual={es:string[];en:string[]}
export type CompareStrategy={
 id:string;key?:string;title_es?:string;title_en?:string;
 plantings:{crop_id:string;start_index:number;months?:number}[];
 indicators:{water_low_river_mm:number;bare_months:number;legume_plantings:number};
 relative_to_current?:{water_low_river_change_percent:number|null;bare_months_change:number;legume_plantings_change:number;improves_low_river_water?:boolean}|null;
 sections:{why:Bilingual;evidence:Bilingual;benefits:Bilingual;gaps:Bilingual;risks:Bilingual}
}
const SECTIONS=['why','evidence','benefits','gaps','risks'] as const
type SectionKey=typeof SECTIONS[number]
const LABEL:Record<Lang,Record<SectionKey,string>>={
 es:{why:'Por qué',evidence:'Evidencia',benefits:'Beneficios',gaps:'Vacíos',risks:'Riesgos'},
 en:{why:'Why',evidence:'Evidence',benefits:'Benefits',gaps:'Gaps',risks:'Risks'},
}
export function strategyTitle(s:CompareStrategy,lang:Lang):string{
 if(s.id==='S0')return lang==='es'?'S0 · Rotación actual':'S0 · Current rotation'
 if(s.key==='water'||s.id==='S1')return lang==='es'?'S1 · Agua: menos riego cuando el río baja':'S1 · Water: less irrigation when the river is low'
 return lang==='es'?'S2 · Suelo: suelo cubierto y leguminosas':'S2 · Soil: covered soil and legumes'
}
function pct(v:number|null|undefined,lang:Lang){
 if(v==null)return lang==='es'?'sin dato':'no data'
 if(Math.round(v)===0)return lang==='es'?'igual que hoy':'same as today'
 return (v>0?'+':'')+Math.round(v)+'% '+(lang==='es'?'vs. hoy':'vs. today')
}

function StrategyCard({s,lang,crop}:{s:CompareStrategy;lang:Lang;crop:(id:string)=>string}){
 const [open,setOpen]=useState<SectionKey>('why')
 const r=s.relative_to_current
 const warn=s.id!=='S0'&&(s.key==='water'||s.id==='S1')&&r&&r.improves_low_river_water===false
 const order=[...s.plantings].sort((a,b)=>a.start_index-b.start_index).map(p=>crop(p.crop_id)).join(' → ')
 return <article className="chakra-advice-card chakra-strategy-card" aria-labelledby={'st-'+s.id}>
  <header><h3 id={'st-'+s.id}>{strategyTitle(s,lang)}</h3></header>
  <p className="chakra-strategy-order">{order||(lang==='es'?'Sin cultivos registrados':'No crops recorded')}</p>
  {warn&&<p className="chakra-strategy-warn" role="note">{lang==='es'?'Esta opción no reduce el agua de mayo a noviembre frente a hoy; no la presentamos como mejora de agua.':'This option does not lower May–Nov crop water versus today; it is not presented as a water improvement.'}</p>}
  <dl className="chakra-strategy-kpis">
   <div><dt>{lang==='es'?'Agua del cultivo, may–nov':'Crop water, May–Nov'}</dt><dd>{Math.round(s.indicators.water_low_river_mm)} mm{r&&<small>{pct(r.water_low_river_change_percent,lang)}</small>}</dd></div>
   <div><dt>{lang==='es'?'Meses sin cubierta':'Months without cover'}</dt><dd>{s.indicators.bare_months}/24</dd></div>
   <div><dt>{lang==='es'?'Siembras de leguminosa':'Legume plantings'}</dt><dd>{s.indicators.legume_plantings}</dd></div>
  </dl>
  <div className="chakra-strategy-tabs" role="tablist" aria-label={lang==='es'?'Explicación de la estrategia':'Strategy explanation'}>
   {SECTIONS.map(k=><button key={k} type="button" role="tab" id={`tab-${s.id}-${k}`} aria-selected={open===k} aria-controls={`panel-${s.id}`} className={open===k?'on':''} onClick={()=>setOpen(k)}>{LABEL[lang][k]}</button>)}
  </div>
  <div className="chakra-strategy-panel" role="tabpanel" id={`panel-${s.id}`} aria-labelledby={`tab-${s.id}-${open}`}>
   <ul>{(s.sections[open]?.[lang]||[]).map((line,i)=><li key={i}>{line}</li>)}</ul>
  </div>
 </article>
}

export default function StrategyCompare({strategies,lang,crop,busy,error,outOfScope,onRetry}:{
 strategies:CompareStrategy[]|null;lang:Lang;crop:(id:string)=>string;busy:boolean;error:string;outOfScope:boolean;onRetry:()=>void
}){
 const es=lang==='es'
 return <section className="chakra-strategy-compare" aria-labelledby="chakra-compare-title">
  <div className="chakra-result-heading"><span className="b-eyebrow">{es?'COMPARA 3 ESTRATEGIAS':'COMPARE 3 STRATEGIES'}</span>
   <h2 id="chakra-compare-title">{es?'Tu rotación actual frente a dos alternativas':'Your current rotation versus two alternatives'}</h2>
   <p>{es?'Cálculo relativo con NASA POWER (ET0) y coeficientes FAO-56 sobre los cultivos que registraste. No es un rendimiento ni un ahorro comprobado.':'Relative estimate from NASA POWER (ET0) and FAO-56 crop coefficients applied to the crops you recorded. Not a yield or a verified saving.'}</p></div>
  {outOfScope&&<p className="chakra-strategy-scope" role="note">{es?'Este terreno está fuera de Barranca: CHAKRA solo da una orientación por reglas generales, no una recomendación validada localmente.':'This field is outside Barranca: CHAKRA only gives guidance from general rules, not a locally validated recommendation.'}</p>}
  {busy&&<p role="status" className="chakra-strategy-status">{es?'Comparando estrategias… si el servidor estaba dormido puede tardar ~30 s.':'Comparing strategies… waking up the server, ~30 s.'}</p>}
  {error&&<p role="alert" className="b-error">{error} <button type="button" className="b-btn b-btn-light" onClick={onRetry}>{es?'Reintentar':'Retry'}</button></p>}
  {strategies&&strategies.length>0&&<div className="chakra-strategy-grid">{strategies.map(s=><StrategyCard key={s.id} s={s} lang={lang} crop={crop}/>)}</div>}
 </section>
}

/** A4 print: short table that travels with the zone sketch. */
export function StrategyComparePrint({strategies,lang}:{strategies:CompareStrategy[];lang:Lang}){
 const es=lang==='es'
 return <section className="chakra-print-compare">
  <h2>{es?'Comparación de 3 estrategias de rotación':'Comparison of 3 rotation strategies'}</h2>
  <table><thead><tr><th>{es?'Estrategia':'Strategy'}</th><th>{es?'Agua del cultivo may–nov (río bajo)':'Crop water May–Nov (low river)'}</th><th>{es?'Meses sin cubierta (de 24)':'Months without cover (of 24)'}</th><th>{es?'Leguminosas':'Legumes'}</th></tr></thead>
   <tbody>{strategies.map(s=><tr key={s.id}><td>{strategyTitle(s,lang)}</td><td>{Math.round(s.indicators.water_low_river_mm)} mm{s.relative_to_current?` (${pct(s.relative_to_current.water_low_river_change_percent,lang)})`:''}</td><td>{s.indicators.bare_months}</td><td>{s.indicators.legume_plantings}</td></tr>)}</tbody></table>
  {strategies.map(s=><p key={s.id}><strong>{strategyTitle(s,lang)}:</strong> {(s.sections.why[lang]||[])[0]||''}</p>)}
  <p>{es?'Estimaciones relativas (NASA POWER + FAO-56). Revísalas con un técnico antes de decidir.':'Relative estimates (NASA POWER + FAO-56). Review them with a technician before deciding.'}</p>
 </section>
}
