import {useEffect,useState} from 'react'
import './bio-tour.css'

type Lang='es'|'en'
const STEPS=[
 {target:'bio-hero',title:{es:'¡Bienvenido a BIOTEX!',en:'Welcome to BIOTEX!'},
  body:{es:'¡Holis! Soy BIO. Te enseñaré a explorar un terreno y preparar opciones de rotación de cultivos.',en:"Hello! I'm BIO. I will guide you through exploring a field and planning possible crop rotations."}},
 {target:'bio-map',title:{es:'Ubica tu terreno',en:'Find your field'},
  body:{es:'Puedes dibujar los límites en el mapa o probar nuestro terreno sintético de ejemplo. El punto del sector no representa una parcela real.',en:'Draw your field on the map or try a synthetic example. The sector marker is not a verified field.'}},
 {target:'bio-layers',title:{es:'Explora las capas NASA',en:'Explore NASA layers'},
  body:{es:'Elige vegetación o lluvia y consulta su leyenda. Los datos regionales no son mediciones exactas de una chacra.',en:'Choose vegetation or rain and read the legend. Regional data are not exact farm measurements.'}},
 {target:'bio-next',title:{es:'Conoce tu plan',en:'Discover your plan'},
  body:{es:'Después registrarás tus cultivos, elegirás prioridades y compararás cuatro campañas. Al final verás dónde podría ir cada cultivo.',en:'Next, record crops, choose priorities and compare four campaigns. You will see proposed crop placement on the map.'}}
] as const
const KEY='biotex-bio-intro-v1'

function BioMascot(){return <svg className="bio-mascot" viewBox="0 0 112 154" aria-hidden="true" xmlns="http://www.w3.org/2000/svg">
 <path d="M39 116Q12 116 6 82Q24 91 40 93Z" fill="#2b8555"/>
 <path d="M74 115Q101 109 108 80Q88 92 74 94Z" fill="#57ac70"/>
 <path d="M51 124Q49 143 38 145" fill="none" stroke="#236447" strokeWidth="5" strokeLinecap="round"/>
 <path d="M64 124Q66 142 77 145" fill="none" stroke="#236447" strokeWidth="5" strokeLinecap="round"/>
 <rect x="27" y="21" width="59" height="109" rx="29" fill="#f4e2a6" stroke="#b98f40" strokeWidth="2.5"/>
 <path d="M47 18Q53 3 57 7Q63 2 70 19" fill="none" stroke="#408a52" strokeWidth="7" strokeLinecap="round"/>
 {Array.from({length:6},(_,i)=><path key={i} d={'M34 '+(37+i*13)+' Q56 '+(31+i*13)+' 79 '+(37+i*13)} stroke="#e5c879" strokeWidth="2.5" fill="none"/>)}
 <circle cx="45" cy="66" r="4.8" fill="#263a33"/><circle cx="69" cy="66" r="4.8" fill="#263a33"/>
 <path d="M49 83Q57 91 65 83" stroke="#263a33" strokeWidth="3" strokeLinecap="round" fill="none"/>
 <path d="M32 97Q13 89 10 72" stroke="#327955" strokeWidth="5" strokeLinecap="round" fill="none"/>
 <path d="M81 96Q98 88 101 71" stroke="#327955" strokeWidth="5" strokeLinecap="round" fill="none"/>
 <text x="56" y="111" textAnchor="middle" fill="#386f48" fontWeight="900" fontFamily="system-ui" fontSize="15">BIO</text>
 </svg>}
export default function BioTour({lang='es'}:{lang?:Lang}){
 const [open,setOpen]=useState(()=>{try{return window.localStorage.getItem(KEY)!=='complete'}catch{return true}})
 const [index,setIndex]=useState(0)
 const [target,setTarget]=useState<string|null>(null)
 useEffect(()=>{
  if(!open){setTarget(null);return}
  const t=STEPS[index].target
  setTarget(t)
  const el=document.querySelector('[data-bio-target="'+t+'"]')
  el?.scrollIntoView({behavior:'auto',block:'nearest'})
  return()=>setTarget(null)
 },[open,index])
 useEffect(()=>{
  if(!open)return
  const onKey=(e:KeyboardEvent)=>{if(e.key==='Escape')close()}
  document.addEventListener('keydown',onKey)
  return()=>document.removeEventListener('keydown',onKey)
 },[open])
 useEffect(()=>{
  document.querySelectorAll('[data-bio-target]').forEach(el=>el.classList.toggle('bio-spotlight',open&&el.getAttribute('data-bio-target')===target))
  return()=>document.querySelectorAll('[data-bio-target]').forEach(el=>el.classList.remove('bio-spotlight'))
 },[open,target])
 function close(){setOpen(false);try{window.localStorage.setItem(KEY,'complete')}catch{/* privacy mode */}}
 return <>{!open?<button type="button" className="bio-repeat" onClick={()=>{setIndex(0);setOpen(true)}} aria-label={lang==='es'?'Repetir tutorial de BIO':'Replay BIO tutorial'}><BioMascot/><span>{lang==='es'?'Ayuda de BIO':'BIO help'}</span></button>:
 <section className="bio-tour" role="dialog" aria-label={lang==='es'?'Tutorial de BIO':'BIO onboarding'} aria-modal="false">
  <div className="bio-tour-top"><BioMascot/><div><span className="bio-kicker">{lang==='es'?'BIO TE ACOMPAÑA':'BIO GUIDES YOU'}</span>
   <strong>{STEPS[index].title[lang]}</strong><p>{STEPS[index].body[lang]}</p></div></div>
  <div className="bio-dots" aria-label={(index+1)+' / '+STEPS.length}>{STEPS.map((_,i)=><span key={i} className={i<=index?'active':''}/>)}</div>
  <div className="bio-actions">
   <button type="button" className="bio-skip" onClick={close}>{lang==='es'?'Omitir':'Skip'}</button>
   <div>{index>0&&<button type="button" className="bio-back" onClick={()=>setIndex(i=>i-1)}>{lang==='es'?'Atrás':'Back'}</button>}
   <button type="button" className="bio-forward" onClick={()=>index===STEPS.length-1?close():setIndex(i=>i+1)}>{index===STEPS.length-1?(lang==='es'?'¡Empezar!':'Start'):(lang==='es'?'Siguiente':'Next')}</button></div>
  </div>
 </section>}</>
}
