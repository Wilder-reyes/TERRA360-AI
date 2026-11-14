
import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'

export const supportedLanguages = [
  { code: 'es-PE', name: 'Español', flag: '🇵🇪', enabled: true },
  { code: 'en', name: 'English', flag: '🇺🇸', enabled: true },
  { code: 'qu', name: 'Quechua', flag: '🇵🇪', enabled: false },
  { code: 'ay', name: 'Aimara', flag: '🇧🇴', enabled: false },
  { code: 'pt-BR', name: 'Português', flag: '🇧🇷', enabled: false },
]

const resources = {
  'es-PE': {
    translation: {
      tagline: 'OBSERVACIÓN TERRESTRE · INTELIGENCIA AGRÍCOLA',
      pilot: 'ELIGE TU TERRENO',
      headline: 'Cada cosecha comienza con una decisión.',
      intro: 'Conectamos observaciones de la Tierra de la NASA con conocimiento agrícola local para explorar rotaciones de cultivos más resilientes.',
      workspace: 'ENTORNO PILOTO',
      town: 'Lugar por seleccionar',
      townWarning: 'Punto de referencia de la localidad · no es una parcela agrícola',
      earth: '01 / INTELIGENCIA TERRESTRE',
      conditions: 'Condiciones ambientales',
      refresh: 'Actualizar datos NASA ↻',
      loading: 'Cargando…',
      precipitation: 'PRECIPITACIÓN TOTAL',
      precipitationDescription: 'Suma de los valores diarios de precipitación corregida del periodo consultado',
      temperature: 'TEMPERATURA MEDIA DEL AIRE',
      temperatureDescription: 'Promedio de los valores diarios disponibles de T2M',
      records: 'REGISTROS DIARIOS VÁLIDOS',
      recordsDescription: 'Registros con valores de precipitación disponibles',
      live: 'RESPUESTA DE LA FUENTE',
      connected: 'CONECTADO',
      date: 'Fecha',
      rain: 'Lluvia (mm/día)',
      temp: 'Temp. (°C)',
      humidity: 'HR (%)',
      source: 'Fuente: NASA POWER Daily API · Comunidad agrícola · UTC. Las estimaciones puntuales en cuadrícula no son mediciones in situ. Los valores faltantes se excluyen y no se interpretan como cero.',
      error: 'Error de conexión con NASA POWER',
      connecting: 'Conectando con NASA POWER…',
      next: 'SIGUIENTE MÓDULO',
      nextTitle: 'De la evidencia ambiental a las decisiones agrícolas.',
      nextDescription: 'Siguiente: incorporar precipitación GPM, información del suelo, perfiles de cultivos y el motor de comparación de rotaciones.',
      footer: 'TERRA360 · PILOTO DEMOSTRATIVO · UBICACIÓN LIBRE · TRAZABILIDAD DE DATOS',
      language: 'Idioma',
      preparing: 'En preparación',
    },
  },
  en: {
    translation: {
      tagline: 'EARTH OBSERVATION · AGRICULTURAL INTELLIGENCE',
      pilot: 'CHOOSE YOUR LAND',
      headline: 'Every harvest begins with a decision.',
      intro: 'Connecting NASA Earth observations with local agricultural knowledge to explore more resilient crop rotations.',
      workspace: 'PILOT WORKSPACE',
      town: 'Location not selected',
      townWarning: 'Town reference point · not a farm parcel',
      earth: '01 / EARTH INTELLIGENCE',
      conditions: 'Environmental conditions',
      refresh: 'Refresh NASA data ↻',
      loading: 'Loading…',
      precipitation: 'TOTAL PRECIPITATION',
      precipitationDescription: 'Sum of daily corrected precipitation values in the returned period',
      temperature: 'MEAN AIR TEMPERATURE',
      temperatureDescription: 'Average of available daily T2M values',
      records: 'VALID DAILY RECORDS',
      recordsDescription: 'Records with available precipitation values',
      live: 'LIVE SOURCE RESPONSE',
      connected: 'CONNECTED',
      date: 'Date',
      rain: 'Rain (mm/day)',
      temp: 'Temp. (°C)',
      humidity: 'RH (%)',
      source: 'Source: NASA POWER Daily API · Agricultural community · UTC. Gridded point estimates are not in-situ measurements. Missing values are excluded, not interpreted as zero.',
      error: 'NASA POWER connection error',
      connecting: 'Connecting to NASA POWER…',
      next: 'NEXT MODULE',
      nextTitle: 'From environmental evidence to agricultural decisions.',
      nextDescription: 'Next: add GPM precipitation, soil information, crop profiles and the rotation comparison engine.',
      footer: 'TERRA360 · DEMONSTRATION PILOT · UBICACIÓN LIBRE · DATA PROVENANCE FIRST',
      language: 'Language',
      preparing: 'Coming soon',
    },
  },
}

const savedLanguage = localStorage.getItem('terra360-language')
const initialLanguage = supportedLanguages.some(
  (language) => language.code === savedLanguage && language.enabled,
)
  ? savedLanguage!
  : 'es-PE'

i18n.use(initReactI18next).init({
  resources,
  lng: initialLanguage,
  fallbackLng: 'es-PE',
  interpolation: {
    escapeValue: false,
  },
})

export default i18n
