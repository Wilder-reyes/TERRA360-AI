import './chackra-team.css'
import {ChakraMark} from './ChakraIcon'

type Lang='es'|'en'
const MEMBERS=[
 {name:'Sebastian Cangalaya',roleEs:'Científico de datos',roleEn:'Data Scientist',photo:'/assets/team/sebastian-cangalaya.webp'},
 {name:'Wilder Reyes',roleEs:'Ingeniero mecatrónico',roleEn:'Mechatronics Engineer',photo:'/assets/team/wilder-reyes.webp'},
 {name:'David Sato',roleEs:'Ingeniero mecatrónico',roleEn:'Mechatronics Engineer',photo:'/assets/team/david-sato.webp'}
] as const

/** Independent page: no agricultural planning state or API calls. */
export default function ChackraTeamPage({lang,onBack}:{lang:Lang;onBack:()=>void}){
 const es=lang==='es'
 return <div className="chackra-team-page">
  <a className="chackra-team-skip" href="#team-content">{es?'Ir al contenido':'Skip to content'}</a>
  <header className="chackra-team-header">
   <button type="button" className="chackra-team-brand" onClick={onBack} aria-label={es?'Volver a CHACKRA X':'Back to CHACKRA X'}><ChakraMark/><span>CHACKRA X</span></button>
   <nav aria-label={es?'Navegación':'Navigation'}>
    <button type="button" onClick={onBack}>{es?'Inicio':'Home'}</button>
    <a href="/como-funciona">{es?'Cómo funciona':'How it works'}</a>
    <a href="/fuentes">{es?'Fuentes':'Sources'}</a>
   </nav>
  </header>
  <main id="team-content" className="chackra-team-main">
   <div className="chackra-team-intro">
    <span className="chackra-team-eyebrow">NASA SPACE APPS CHALLENGE 2026 · FIELD SHIFT</span>
    <h1>{es?'Nuestro equipo':'Our Team'}<span>.</span></h1>
    <p>{es?'Conoce a las personas detrás de CHACKRA X: ciencia, tecnología y creatividad para acercar la observación de la Tierra a la agricultura.':'Meet the people behind CHACKRA X: science, technology and creativity bringing Earth observation closer to agriculture.'}</p>
   </div>
   <section className="chackra-team-grid" aria-label={es?'Integrantes de CHACKRA X':'CHACKRA X members'}>
    {MEMBERS.map((member,i)=><article className="chackra-team-card" key={member.name}>
     <div className="chackra-team-photo">
      <img src={member.photo} alt={es?'Retrato de '+member.name:'Portrait of '+member.name} width="160" height="180" loading={i===0?'eager':'lazy'}/>
      <span className="chackra-team-number" aria-hidden="true">{String(i+1).padStart(2,'0')}</span>
     </div>
     <div className="chackra-team-meta"><h2>{member.name}</h2><p>{es?member.roleEs:member.roleEn}</p></div>
    </article>)}
   </section>
   <div className="chackra-team-end"><p>{es?'Ciencia y diseño para convertir información satelital en decisiones agrícolas comprensibles.':'Science and design to translate satellite information into understandable agricultural decisions.'}</p>
    <button type="button" onClick={onBack}>{es?'Explorar CHACKRA X':'Explore CHACKRA X'} <span aria-hidden="true">↗</span></button>
   </div>
  </main>
  <footer className="chackra-team-footer"><strong>CHACKRA X</strong><span>NASA Space Apps Challenge 2026 · Field Shift</span></footer>
 </div>
}