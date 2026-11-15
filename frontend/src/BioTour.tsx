import {useEffect,useMemo,useState} from 'react'
import './bio-tour.css'

type Lang='es'|'en'
type Step=0|1|2
type Rect={top:number;left:number;right:number;bottom:number}
const KEY='chakra-bio-guided-v3'
const OLD_KEY='chakra-bio-guided-v2'
function safeHidden(){try{return localStorage.getItem(KEY)==='hide'||localStorage.getItem(OLD_KEY)==='hide'}catch{return false}}
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
export default function BioTour({lang='es',step=0,assigned=0,zoneCount=1,landing=false,fieldReady=true,cropPending=false,planReady=false,error=''}:{
 lang?:Lang;step?:Step;assigned?:number;zoneCount?:number;landing?:boolean;fieldReady?:boolean;cropPending?:boolean;planReady?:boolean;error?:string
}){
 const [hidden,setHidden]=useState(safeHidden)
 const [open,setOpen]=useState(!safeHidden())
 const [bounds,setBounds]=useState<Rect|null>(null)
 const phase=step===0?(landing?'start':fieldReady?'next':'map'):step===1?(assigned>=zoneCount?'next':cropPending?'zone':'crops'):(planReady?'result':'plan')
 const target=phase==='start'?'bio-start':phase==='next'?'bio-next':phase==='map'?'bio-map':phase==='zone'?'bio-zone-map':phase==='crops'?'bio-crops':phase==='result'?'bio-result':'bio-plan'
 const guide=useMemo(()=>{
  const es=lang==='es'
  const messages:Record<string,[string,string]>={
   start:es?['¡Hola! Soy BIO','Yo te acompañaré en tres pasos. Si ya tienes tu terreno, pulsa «Dibujar mi terreno». Si quieres practicar, selecciona «Ver un ejemplo».']:['Hi! I’m BIO','I will guide you through three steps. Choose “Outline my land”, or “Try an example” to practice.'],
   map:es?['Paso 1: tu terreno','Busca el lugar de tu chacra, toca cada esquina en el mapa y cierra el contorno. Si te equivocas, puedes corregirlo.']:['Outline your land','Tap the field corners on the map and confirm the outline.'],
   next:step===0?(es?['¡Ya tenemos tu terreno!','Comprueba el borde verde y pulsa «Registrar cultivos por zona» para comenzar.']:['Your field is ready!','Tap “Record crops” and show what you planted.']):(es?['¡Registraste tus cultivos!','Ahora pulsa «Continuar a mi plan». Con el historial de cada zona prepararemos tus próximas siembras.']:['Well done!','Your areas are recorded. Tap “Continue to my plan”.']),
   crops:es?['Paso 2: tus cultivos','Aquí tienes '+zoneCount+' zonas. Elige qué cultivo sembraste y cuándo. Después toca su zona en el mapa. Puedes mover los rectángulos desde el centro o sus esquinas.']:['Step 2: your crops','There are '+zoneCount+' areas. Choose what and when you planted, then tap the corresponding area on the map. Move rectangles using their centre or corners.'],
   zone:es?['Marca dónde lo sembraste','¡Perfecto! Ahora toca el rectángulo correspondiente en el mapa. Su color cambiará. Llevar la tarjeta al mapa también funciona en computadora.']:['Now the map!','Tap the area where you planted that crop. Its color will change when saved.'],
   plan:es?['Paso 3: las próximas siembras','Elige entre 3 y 60 meses, según lo que necesites organizar. Pulsa «Crear mi calendario» para ver qué puedes sembrar en cada zona y en qué mes.']:['Plan your next plantings','Choose how many months ahead to plan and tap “Create my calendar”.'],
   result:es?['¡Tu plan está listo!','Este es el mapa aéreo de tu terreno. Selecciona un año y un mes; verás cómo cambian las propuestas de cultivo y cuándo podrías sembrarlas.']:['Here is your plan!','Explore the years to see what you could plant in each area. Check dates before deciding.']
  }
  return messages[phase]
 },[phase,step,lang])
 useEffect(()=>{if(!hidden)setOpen(true)},[phase,hidden])
 useEffect(()=>{
  if(!open)return
  let raf=0
  let obs:ResizeObserver|null=null
  const element=document.querySelector('[data-bio-target="'+target+'"]')
  if(!element){setBounds(null);return}
  const update=()=>{
   const r=element.getBoundingClientRect(),pad=7
   setBounds({top:Math.max(0,r.top-pad),left:Math.max(0,r.left-pad),right:Math.min(window.innerWidth,r.right+pad),bottom:Math.min(window.innerHeight,r.bottom+pad)})
  }
  const r=element.getBoundingClientRect()
  if(r.bottom>window.innerHeight-120||r.top<90){element.scrollIntoView({behavior:'smooth',block:'center'})}
  raf=window.requestAnimationFrame(update)
  obs=new ResizeObserver(update);obs.observe(element)
  window.addEventListener('scroll',update,{passive:true});window.addEventListener('resize',update)
  return()=>{cancelAnimationFrame(raf);obs?.disconnect();window.removeEventListener('scroll',update);window.removeEventListener('resize',update)}
 },[open,target])
 useEffect(()=>{if(!open||!error)return;setBounds(null)},[error,open])
 const close=(remember:boolean)=>{
  setOpen(false);setBounds(null)
  if(remember){setHidden(true);try{localStorage.setItem(KEY,'hide')}catch{/* private browsing */}}
 }
 const highlight=bounds&&bounds.bottom>bounds.top&&bounds.right>bounds.left
 const overlays=highlight?[
  {top:0,left:0,width:'100vw',height:bounds.top},
  {top:bounds.top,left:0,width:bounds.left,height:bounds.bottom-bounds.top},
  {top:bounds.top,left:bounds.right,width:Math.max(0,window.innerWidth-bounds.right),height:bounds.bottom-bounds.top},
  {top:bounds.bottom,left:0,width:'100vw',height:Math.max(0,window.innerHeight-bounds.bottom)}
 ]:[]
 return <div className="bio-guide-root">
  {!open?<button type="button" className="bio-repeat" onClick={()=>{setOpen(true);setHidden(false)}} aria-label={lang==='es'?'Abrir guía de BIO':'Open BIO guide'}><BioMascot/><span>{lang==='es'?'Ayuda de BIO':'BIO guide'}</span></button>:
  <>
   {highlight&&<div className="bio-shades" aria-hidden="true">{overlays.map((piece,i)=><div key={i} className="bio-shade" style={piece}/>)}</div>}
   <section className={'bio-tour bio-guided-card'+(bounds&&bounds.top>window.innerHeight*.57?' bio-guided-top':'')} role="region" aria-live="polite" aria-label={lang==='es'?'BIO, tu guía':'BIO, your guide'}>
    <div className="bio-tour-top"><BioMascot/><div><span className="bio-kicker">{lang==='es'?'BIO TE ACOMPAÑA':'BIO GUIDES YOU'} · {step+1}/3</span>
     <strong>{guide[0]}</strong><p>{error?(lang==='es'?'Revisa esto: ':'Please check: ')+error:guide[1]}</p></div></div>
    <div className="bio-actions"><button type="button" className="bio-skip" onClick={()=>close(true)}>{lang==='es'?'Salir del tutorial':'Exit tutorial'}</button>
     <button type="button" className="bio-forward" onClick={()=>close(false)}>{lang==='es'?'Entendido':'Got it'}</button></div>
   </section>
  </>}
 </div>
}