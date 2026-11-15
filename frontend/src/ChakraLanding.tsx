import Icon from './ChakraIcon'

type Props={lang:'es'|'en';onStart:()=>void;onMap:()=>void}

/** A compact invitation: the interactive map immediately below is the hero. */
export default function ChakraLanding({lang,onStart,onMap}:Props){
 const es=lang==='es'
 return <section className="chakra-landing chakra-map-intro" data-bio-target="bio-hero">
  <div className="chakra-badge"><span className="chakra-badge-tag">CHAKRA</span><i/>{es?'Tu tierra. Tu decisión.':'Your land. Your decision.'}</div>
  <h1>{es?<>Conoce tu terreno.<br/>Prepara tu próxima <em>siembra.</em></>:<>Explore your field.<br/>Plan your next <em>planting.</em></>}</h1>
  <p>{es?'Delimita tu tierra, ubica lo que sembraste y revisa un plan por zonas. Tres pasos sencillos, con información científica detrás.':'Outline your field, record crops by area and review a zone-by-zone plan. Three simple steps, backed by evidence.'}</p>
  <div className="chakra-map-intro-actions">
   <button type="button" className="chakra-primary" onClick={onStart}>{es?'Explorar parcela de Barranca':'Explore the Barranca example'}<Icon name="arrow-right" size={18}/></button>
   <button type="button" className="chakra-text-button" onClick={onMap}>{es?'Delimitar otro terreno':'Outline another field'}</button>
  </div>
  <small className="chakra-study-note">{es?'Mapa interactivo a continuación · Barranca es una parcela de estudio con cultivos reales por confirmar.':'Interactive map below · Barranca is a study parcel with actual crops yet to be confirmed.'}</small>
 </section>
}
