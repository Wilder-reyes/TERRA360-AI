import {useEffect,useMemo,useState} from 'react'
import './bio-tour.css'

type Lang='es'|'en'
type Step=0|1|2
type Rect={top:number;left:number;right:number;bottom:number}
const KEY='chakra-choklito-guided-v4'
function safeHidden(){try{return localStorage.getItem(KEY)==='hide'}catch{return false}}
function ChoklitoMascot(){return <svg className="bio-mascot" viewBox="0 0 112 154" aria-hidden="true" xmlns="http://www.w3.org/2000/svg">
 <g className="bio-body"><path d="M39 116Q12 116 6 82Q24 91 40 93Z" fill="#2b8555"/><path d="M74 115Q101 109 108 80Q88 92 74 94Z" fill="#57ac70"/>
 <path d="M51 124Q49 143 38 145" fill="none" stroke="#236447" strokeWidth="5" strokeLinecap="round"/><path d="M64 124Q66 142 77 145" fill="none" stroke="#236447" strokeWidth="5" strokeLinecap="round"/>
 <rect x="27" y="21" width="59" height="109" rx="29" fill="#f4e2a6" stroke="#b98f40" strokeWidth="2.5"/>
 <path d="M47 18Q53 3 57 7Q63 2 70 19" fill="none" stroke="#408a52" strokeWidth="7" strokeLinecap="round"/>
 {Array.from({length:6},(_,i)=><path key={i} d={'M34 '+(37+i*13)+' Q56 '+(31+i*13)+' 79 '+(37+i*13)} stroke="#e5c879" strokeWidth="2.5" fill="none"/>)}
 <circle cx="45" cy="66" r="4.8" fill="#263a33"/><circle cx="69" cy="66" r="4.8" fill="#263a33"/>
 <path d="M49 83Q57 91 65 83" stroke="#263a33" strokeWidth="3" strokeLinecap="round" fill="none"/>
 <text x="56" y="111" textAnchor="middle" fill="#386f48" fontWeight="900" fontFamily="system-ui" fontSize="15">CHOKLITO</text></g>
 <path className="bio-arm bio-arm-left" d="M32 97Q13 89 10 72" stroke="#327955" strokeWidth="5" strokeLinecap="round" fill="none"/>
 <path className="bio-arm bio-arm-right" d="M81 96Q98 88 101 71" stroke="#327955" strokeWidth="5" strokeLinecap="round" fill="none"/>
 </svg>}
export default function BioTour({lang='es',step=0,assigned=0,zoneCount=1,landing=false,fieldReady=true,cropPending=false,planReady=false,error=''}:{
 lang?:Lang;step?:Step;assigned?:number;zoneCount?:number;landing?:boolean;fieldReady?:boolean;cropPending?:boolean;planReady?:boolean;error?:string
}){
 const [hidden,setHidden]=useState(safeHidden)
 const [open,setOpen]=useState(!safeHidden())
 const [bounds,setBounds]=useState<Rect|null>(null)
 const [welcome,setWelcome]=useState(!safeHidden())
 const phase=step===0?(landing?'start':fieldReady?'next':'map'):step===1?(assigned>=zoneCount?'next':cropPending?'zone':'crops'):(planReady?'result':'plan')
 const target=phase==='start'?'bio-start':phase==='next'?'bio-next':phase==='map'?'bio-map':phase==='zone'?'bio-zone-map':phase==='crops'?'bio-crops':phase==='result'?'bio-result':'bio-plan'
 const guide=useMemo(()=>{
  const es=lang==='es'
  const messages:Record<string,[string,string]>={
   start:es?['¡Hola! Soy CHOKLITO','Yo te acompañaré en tres pasos. Si ya tienes tu terreno, pulsa «Dibujar mi terreno». Si quieres practicar, selecciona «Ver un ejemplo».']:['Hi! I’m CHOKLITO','I will guide you through three steps. Choose “Outline my land”, or “Try an example” to practice.'],
   map:es?['Paso 1: tu terreno','Busca el lugar de tu chacra, toca cada esquina en el mapa y cierra el contorno. Si te equivocas, puedes corregirlo.']:['Outline your land','Tap the field corners on the map and confirm the outline.'],
   next:step===0?(es?['¡Ya tenemos tu terreno!','Comprueba el borde verde y pulsa «Registrar cultivos por zona» para comenzar.']:['Your field is ready!','Tap “Record crops” and show what you planted.']):(es?['¡Registraste tus cultivos!','Ahora pulsa «Continuar a mi plan». Con la siembra actual de cada polígono prepararemos tus próximas siembras.']:['Well done!','Your areas are recorded. Tap “Continue to my plan”.']),
   crops:es?['Paso 2: tus cultivos','Tienes '+zoneCount+' polígonos sembrados. Primero elige el cultivo actual y cuándo lo sembraste; después toca su zona en el mapa. Puedes arrastrar los vértices para ajustar su forma.']:['Step 2: your crops','There are '+zoneCount+' areas. Choose what and when you planted, then tap the corresponding area on the map. Move rectangles using their centre or corners.'],
   zone:es?['Marca dónde lo sembraste','¡Ahora arrastra el cultivo hacia el polígono del mapa, como en esta demostración! También puedes tocar el cultivo y luego la zona.']:['Now the map!','Tap the area where you planted that crop. Its color will change when saved.'],
   plan:es?['Paso 3: las próximas siembras','Elige entre 3 y 60 meses, según lo que necesites organizar. Pulsa «Crear mi calendario» para ver qué puedes sembrar en cada zona y en qué mes.']:['Plan your next plantings','Choose how many months ahead to plan and tap “Create my calendar”.'],
   result:es?['¡Tu plan está listo!','Este es el mapa aéreo de tu terreno. Selecciona un año y un mes; verás cómo cambian las propuestas de cultivo y cuándo podrías sembrarlas.']:['Here is your plan!','Explore the years to see what you could plant in each area. Check dates before deciding.']
  }
  return messages[phase]
 },[phase,step,lang,zoneCount])
 useEffect(()=>{if(!hidden)setOpen(true)},[phase,hidden])
 useEffect(()=>{
  if(!open||welcome)return
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
 },[open,target,welcome])
 useEffect(()=>{if(!open||!error)return;setBounds(null)},[error,open])
 const close=(remember:boolean)=>{
  setOpen(false);setBounds(null)
  if(remember){setHidden(true);try{localStorage.setItem(KEY,'hide')}catch{/* private browsing */}}
 }
 const highlight=!welcome&&bounds&&bounds.bottom>bounds.top&&bounds.right>bounds.left
 const overlays=highlight?[
  {top:0,left:0,width:'100vw',height:bounds.top},
  {top:bounds.top,left:0,width:bounds.left,height:bounds.bottom-bounds.top},
  {top:bounds.top,left:bounds.right,width:Math.max(0,window.innerWidth-bounds.right),height:bounds.bottom-bounds.top},
  {top:bounds.bottom,left:0,width:'100vw',height:Math.max(0,window.innerHeight-bounds.bottom)}
 ]:[]
 return <div className="bio-guide-root">
  {welcome&&<div className="choklito-welcome" role="dialog" aria-modal="true" aria-label={lang==='es'?'Bienvenida a CHAKRA X':'Welcome to CHAKRA X'}><div className="choklito-welcome-card"><ChoklitoMascot/><span>CHAKRA X</span><h2>{lang==='es'?'¡Bienvenido a tu chacra inteligente!':'Welcome to your smart field!'}</h2><p>{lang==='es'?'Soy CHOKLITO 🌽. Te mostraré cómo seleccionar tu terreno, indicar qué tienes sembrado y preparar una rotación de cultivos. Primero practicaremos juntos.':'I’m CHOKLITO 🌽. I’ll show you how to choose your field, record its current crops and plan a rotation. Let’s begin together.'}</p><button type="button" onClick={()=>{setWelcome(false);setOpen(true)}}>{lang==='es'?'Comenzar recorrido':'Start guided tour'}</button><button type="button" className="choklito-welcome-skip" onClick={()=>{setWelcome(false);close(true)}}>{lang==='es'?'Explorar por mi cuenta':'Explore on my own'}</button></div></div>}
  {!open?<button type="button" className="bio-repeat" onClick={()=>{setOpen(true);setHidden(false)}} aria-label={lang==='es'?'Abrir guía de CHOKLITO':'Open CHOKLITO guide'}><ChoklitoMascot/><span>{lang==='es'?'Ayuda de CHOKLITO':'CHOKLITO guide'}</span></button>:
  <>
   {highlight&&<div className="bio-shades" aria-hidden="true">{overlays.map((piece,i)=><div key={i} className="bio-shade" style={piece}/>)}</div>}
   <section className={'bio-tour bio-guided-card'+(bounds&&bounds.top>window.innerHeight*.57?' bio-guided-top':'')} role="region" aria-live="polite" aria-label={lang==='es'?'CHOKLITO, tu guía':'CHOKLITO, your guide'}>
    <div className="bio-tour-top"><ChoklitoMascot/><div><span className="bio-kicker">{lang==='es'?'CHOKLITO TE ACOMPAÑA':'CHOKLITO GUIDES YOU'} · {step+1}/3</span>
     <strong>{guide[0]}</strong><p>{error?(lang==='es'?'Revisa esto: ':'Please check: ')+error:guide[1]}</p></div></div>
    {(phase==='crops'||phase==='zone')&&<div className="choklito-drag-example" aria-label={lang==='es'?'Ejemplo animado: arrastrar el cultivo al polígono':'Animated example: drag crop to polygon'}><span>🌽 {lang==='es'?'Cultivo':'Crop'}</span><span className="choklito-example-path"><span className="choklito-moving-crop" aria-hidden="true">🌽</span></span><span>⬡ {lang==='es'?'Zona':'Area'}</span></div>}
    <div className="bio-actions"><button type="button" className="bio-skip" onClick={()=>close(true)}>{lang==='es'?'Salir del tutorial':'Exit tutorial'}</button>
     <button type="button" className="bio-forward" onClick={()=>close(false)}>{lang==='es'?'Entendido':'Got it'}</button></div>
   </section>
  </>}
 </div>
}