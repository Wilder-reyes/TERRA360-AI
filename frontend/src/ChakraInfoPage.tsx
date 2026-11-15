import ChakraIcon,{ChakraMark} from './ChakraIcon'
type Lang='es'|'en'
type Page='how'|'sources'
type Source={name:string;category:string;url:string;es:string;en:string}
const SOURCES:Source[]=[
 {name:'NASA HLS v2.0',category:'NASA · Satélites',url:'https://hls.gsfc.nasa.gov/data-access-and-tools/',es:'Historial de vegetación del terreno de estudio en Barranca. Nuestro modelo se evaluó solo en esa parcela; no identifica cultivos ni predice cosechas.',en:'Historical vegetation observations for the Barranca study field. Our model was evaluated only on that parcel; it does not identify crops or predict yields.'},
 {name:'NASA POWER',category:'NASA · Clima',url:'https://power.larc.nasa.gov/docs/services/api/temporal/climatology/',es:'Clima regional de referencia para estimar necesidades de agua de los cultivos, no medir el riego real de la chacra.',en:'Regional climate reference for estimating crop-water requirements, not measuring a field’s irrigation.'},
 {name:'NASA GPM IMERG',category:'NASA · Lluvia',url:'https://gpm.nasa.gov/data/imerg',es:'Contexto regional de lluvia. No equivale al caudal disponible en un canal ni a la lluvia medida sobre una parcela.',en:'Regional rainfall context. This is not canal flow or a direct field rainfall measurement.'},
 {name:'NASA GIBS',category:'NASA · Imágenes',url:'https://nasa-gibs.github.io/gibs-api-docs/',es:'Capas de referencia visual. Mostrar una imagen satelital no significa haber validado cada píxel de la parcela.',en:'Visual reference layers. Displaying an image does not imply validated pixel-level parcel observations.'},
 {name:'FAO-56',category:'Agronomía',url:'https://www.fao.org/4/x0490e/x0490e00.htm',es:'Método de referencia para evapotranspiración y coeficientes de cultivos. Sirve para comparar estimaciones, no para prometer ahorro de agua.',en:'Reference method for evapotranspiration and crop coefficients. Supports approximate comparisons, not guaranteed water savings.'},
 {name:'DRA Lima / MIDAGRI',category:'Perú · Agricultura',url:'https://www.gob.pe/institucion/midagri',es:'Referencias regionales de calendarios y cultivos para los valles agrícolas de Lima. Verifica fechas locales antes de sembrar.',en:'Regional calendars and crop references for Lima agricultural valleys. Confirm local planting dates.'},
 {name:'OpenStreetMap',category:'Cartografía',url:'https://www.openstreetmap.org/copyright',es:'Nombres de localidades y búsqueda geográfica. Datos © colaboradores de OpenStreetMap, licencia ODbL.',en:'Place names and geographic lookup. Data © OpenStreetMap contributors, ODbL.'},
 {name:'Esri World Imagery',category:'Cartografía',url:'https://www.esri.com/en-us/arcgis/products/arcgis-platform/services/basemap-layers',es:'Fotografía aérea del mapa con atribución a Esri, Maxar y Earthstar Geographics, según corresponda.',en:'Aerial imagery basemap, attributed to Esri, Maxar and Earthstar Geographics as applicable.'}
]
function FieldMini({variant}:{variant:1|2|3}){
 return <div className="chakra-story-map" aria-hidden="true">
  <svg viewBox="0 0 360 174" role="presentation" focusable="false"><rect width="360" height="174" rx="16" fill="#172b1b"/>
   {Array.from({length:7},(_,x)=>Array.from({length:3},(_,y)=><rect key={x+'-'+y} x={x*54-10} y={y*64-12} width="48" height="60" rx="3" fill={(x+y)%2?'#2e5030':'#36543a'} stroke="#16271c" strokeWidth="2"/>))}
   <polygon points="54,26 290,17 314,136 72,155" fill={variant===1?'#D6F86618':'#D0BC6577'} stroke="#D6F866" strokeWidth="5" strokeLinejoin="round"/>
   {variant!==1&&<><polygon points="146,23 225,21 240,145 164,150" fill="#D3917C" fillOpacity=".9" stroke="#F3F6E7" strokeWidth="2"/><polygon points="225,21 290,17 314,136 240,145" fill="#79BDA3" fillOpacity=".9" stroke="#F3F6E7" strokeWidth="2"/>{variant===2?<><text x="104" y="90" fontSize="25" textAnchor="middle">🌽</text><text x="197" y="85" fontSize="25" textAnchor="middle">🍠</text><text x="270" y="79" fontSize="25" textAnchor="middle">🫛</text></>:<><text x="104" y="90" fontSize="23" textAnchor="middle">🫛</text><text x="197" y="85" fontSize="23" textAnchor="middle">🌽</text><text x="270" y="79" fontSize="23" textAnchor="middle">🥔</text></>}</>}
   {variant===1&&[[54,26],[290,17],[314,136],[72,155]].map(([x,y],i)=><circle key={i} cx={x} cy={y} r="7" fill="#D6F866" stroke="#102014" strokeWidth="3"/>)}
  </svg>
 </div>
}
export default function ChakraInfoPage({page,lang,onBack,onNavigate}:{page:Page;lang:Lang;onBack:()=>void;onNavigate:(p:Page)=>void}){
 const es=lang==='es'
 const how=page==='how'
 return <div className="chakra-information">
  <header className="chakra-info-nav"><button type="button" onClick={onBack} className="chakra-info-brand" aria-label={es?'Volver a CHAKRA':'Back to CHAKRA'}><ChakraMark/> <span>chakra</span></button>
   <nav aria-label={es?'Secciones':'Sections'}>
    <button type="button" onClick={onBack}>{es?'Ir a mi terreno':'My field'}</button>
    <a href="/como-funciona" onClick={e=>{e.preventDefault();onNavigate('how')}} aria-current={how?'page':undefined}>{es?'Cómo funciona':'How it works'}</a>
    <a href="/fuentes" onClick={e=>{e.preventDefault();onNavigate('sources')}} aria-current={!how?'page':undefined}>{es?'Fuentes':'Sources'}</a>
   </nav>
  </header>
  <main className="chakra-info-main">
   <div className="chakra-info-intro"><span className="chakra-info-eyebrow">CHAKRA X · NASA SPACE APPS 2026</span>
    <h1>{how?(es?'Tu próxima siembra empieza en tu mapa.':'Your next planting starts on your map.'):(es?'¿De dónde viene la información?':'Where does the information come from?')}</h1>
    <p>{how?(es?'Tres pasos sencillos. Tú conoces tu tierra; CHAKRA te ayuda a organizar qué sembrar después.':'Three simple steps. You know your land; CHAKRA helps organize what to plant next.'):(es?'Estas son las fuentes que respaldan nuestro piloto. Puedes abrir cada recurso y conocer cómo lo usamos.':'These sources support our pilot. Open each resource to see how it is used.')}</p>
   </div>
   {how?<div className="chakra-story-list">
    {[
     {num:'01',title:es?'Marca tu terreno':'Outline your field',lead:es?'Encuentra tu parcela en el mapa y dibuja sus límites. Si quieres, comienza con el ejemplo de Barranca.':'Find your field on the map and outline its borders. You can start with the Barranca example.'},
     {num:'02',title:es?'Cuéntanos qué sembraste':'Show what you planted',lead:es?'Divide tu terreno en zonas. Elige los cultivos y colócalos en el lugar donde crecieron, indicando el mes.':'Divide your field into areas. Choose crops, mark where they grew, and enter the planting month.'},
     {num:'03',title:es?'Conoce tus próximas siembras':'See your next planting options',lead:es?'Elige de 3 a 60 meses. Recorre un mapa por colores y un calendario por zonas; guarda una guía para revisar tu plan.':'Choose 3 to 60 months. Explore a color-coded map and calendar by area, and keep a guide to review your plan.'}
    ].map((part,i)=><article className="chakra-story-card" key={part.num}>
      <FieldMini variant={(i+1) as 1|2|3}/><div><span>{es?'PASO':'STEP'} {part.num}</span><h2>{part.title}</h2><p>{part.lead}</p></div>
     </article>)}
    <p className="chakra-info-disclaimer">{es?'Los colores del mapa representan lo que declara el agricultor y propuestas de rotación; no identificaciones automáticas de cultivos por satélite.':'Map colors show farmer-entered crops and suggested rotations, not automatic satellite crop identification.'}</p>
   </div>:
   <div className="chakra-source-cards">{SOURCES.map((source,i)=><article className="chakra-source-card" key={source.name}>
    <div className="chakra-source-card-top"><span className="chakra-source-index">{String(i+1).padStart(2,'0')}</span><span>{source.category}</span></div>
    <h2>{source.name}</h2><p>{es?source.es:source.en}</p>
    <a href={source.url} target="_blank" rel="noopener noreferrer">{es?'Consultar fuente oficial':'Open official source'} <span aria-hidden="true">↗</span></a>
   </article>)}</div>}
   <div className="chakra-info-bottom"><p>{es?'¿Quieres preparar tu propio plan?':'Want to prepare your own plan?'}</p><button type="button" onClick={onBack}>{es?'Ir a mi terreno':'Go to my field'} <ChakraIcon name="arrow-right" size={19}/></button></div>
  </main>
 </div>
}