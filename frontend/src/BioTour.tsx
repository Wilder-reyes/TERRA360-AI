import {useEffect,useState} from 'react'
import './bio-tour.css'

type Lang='es'|'en'
type Step=0|1|2
const KEY='chakra-bio-guided-v2'
const GUIDANCE=[
 {title:{es:'¡Hola! Soy BIO',en:'Hi! I’m BIO'},body:{es:'Vamos a comenzar con tu tierra. Marca sus esquinas en el mapa y confirma la parcela.',en:'Let’s start with your land. Mark the corners on the map and confirm your field.'},target:'bio-map'},
 {title:{es:'Recordemos lo que sembraste',en:'Let’s record your crops'},body:{es:'Elige un cultivo y toca la zona donde lo sembraste. En computadora también puedes llevar su tarjeta al mapa.',en:'Choose a crop and tap the area where it grew. On desktop, you can also drag its card onto the map.'},target:'bio-crops'},
 {title:{es:'Prepararemos tu plan',en:'Let’s prepare your plan'},body:{es:'Elige cuántos meses quieres organizar. Después verás un mapa que cambia con el tiempo y un calendario para cada zona.',en:'Choose how many months to plan. You’ll then see a changing field map and a calendar for every area.'},target:'bio-plan'}
] as const
function BioMascot(){return <svg className="bio-mascot" viewBox="0 0 112 154" aria-hidden="true" xmlns="http://www.w3.org/2000/svg">
 <g className="bio-body"><path d="M39 116Q12 116 6 82Q24 91 40 93Z" fill="#2b8555"/><path d="M74 115Q101 109 108 80Q88 92 74 94Z" fill="#57ac70"/>
 <path d="M51 124Q49 143 38 145" fill="none" stroke="#236447" strokeWidth="5" strokeLinecap="round"/><path d="M64 124Q66 142 77 145" fill="none" stroke="#236447" strokeWidth="5" strokeLinecap="round"/>
 <rect x="27" y="21" width="59" height="109" rx="29" fill="#f4e2a6" stroke="#b98f40" strokeWidth="2.5"/>
 <path d="M47 18Q53 3 57 7Q63 2 70 19" fill="none" stroke="#408a52" strokeWidth="7" strokeLinecap="round"/>
 {Array.from({length:6},(_,i)=><path key={i} d={'M34 '+(37+i*13)+' Q56 '+(31+i*13)+' 79 '+(37+i*13)} stroke="#e5c879" strokeWidth="2.5" fill="none"/>)}
 <circle cx="45" cy="66" r="4.8" fill="#263a33"/><circle cx="69" cy="66" r="4.8" fill="#263a33"/>
 <path d="M49 83Q57 91 65 83" stroke="#263a33" strokeWidth="3" strokeLinecap="round" fill="none"/>
 <text x="56" y="111" textAnchor="middle" fill="#386f48" fontWeight="900" fontFamily="system-ui" fontSize="15">BIO</text></g>
 <path className="bio-arm bio-arm-left" d="M32 97Q13 89 10 72" stroke="#327955" strokeWidth="5" strokeLinecap="round" fill="none"/>
 <path className="bio-arm bio-arm-right" d="M81 96Q98 88 101 71" stroke="#327955" strokeWidth="5" strokeLinecap="round" fill="none"/>
 </svg>}
export default function BioTour({lang='es',step=0,assigned=0}:{lang?:Lang;step?:Step;assigned?:number}){
 const [dismissed,setDismissed]=useState(()=>{try{return localStorage.getItem(KEY)==='hide'}catch{return false}})
 const [open,setOpen]=useState(!dismissed)
 useEffect(()=>{if(!dismissed)setOpen(true)},[step,dismissed])
 const item=GUIDANCE[step]
 useEffect(()=>{
  if(!open)return
  const target=document.querySelector('[data-bio-target="'+item.target+'"]')
  if(target){target.classList.add('bio-spotlight')}
  return()=>{target?.classList.remove('bio-spotlight')}
 },[open,item.target])
 useEffect(()=>{
  if(!open)return
  const onKey=(event:KeyboardEvent)=>{if(event.key==='Escape')setOpen(false)}
  document.addEventListener('keydown',onKey)
  return()=>document.removeEventListener('keydown',onKey)
 },[open])
 const description=step===1&&assigned>0?(lang==='es'?'¡Muy bien! Ya registraste '+assigned+' zona(s).':'Great! You have recorded '+assigned+' area(s).'):item.body[lang]
 const hide=()=>{setOpen(false);setDismissed(true);try{localStorage.setItem(KEY,'hide')}catch{/* privacy mode */}}
 return <div className="bio-guide-root">
  {!open?<button type="button" className="bio-repeat" onClick={()=>setOpen(true)} aria-label={lang==='es'?'Abrir guía de BIO':'Open BIO guide'}><BioMascot/><span>{lang==='es'?'Ayuda de BIO':'BIO guide'}</span></button>:
  <section className="bio-tour" role="region" aria-live="polite" aria-label={lang==='es'?'BIO, tu guía':'BIO, your guide'}>
   <div className="bio-tour-top"><BioMascot/><div><span className="bio-kicker">{lang==='es'?'BIO TE ACOMPAÑA':'BIO GUIDES YOU'} · {step+1}/3</span>
    <strong>{item.title[lang]}</strong><p>{description}</p></div></div>
   <div className="bio-dots">{GUIDANCE.map((_,i)=><span key={i} className={i<=step?'active':''}/>)}</div>
   <div className="bio-actions"><button type="button" className="bio-skip" onClick={hide}>{lang==='es'?'No mostrar más':'Don’t show again'}</button>
    <button type="button" className="bio-forward" onClick={()=>setOpen(false)}>{lang==='es'?'¡Entendido!':'Got it!'}</button></div>
  </section>}
 </div>
}