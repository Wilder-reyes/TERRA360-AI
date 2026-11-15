import {apiOrigin} from './apiConfig'

/** VITE_API_URL is a public origin, configurable for development AND production.
 * An empty production value is same-origin, for a deliberately configured proxy.
 */
export const API=apiOrigin(import.meta.env.VITE_API_URL,import.meta.env.DEV)

export function readableApiError(error: unknown, en: boolean): string {
 const e=error instanceof Error?error:null
 const msg=e?.message||''
 const network=(e instanceof TypeError || /failed to fetch|networkerror|network request failed|load failed|fetch failed|connection refused/i.test(msg))
 if(network)return en
  ? 'Could not connect to CHAKRA. Check your connection and try again; the server may be starting.'
  : 'No se pudo conectar con CHAKRA. Comprueba tu conexión e inténtalo de nuevo; el servidor podría estar iniciándose.'
 if(e?.name==='TimeoutError')return en
  ? 'The request took too long. Try again in a moment.'
  : 'La consulta tardó demasiado. Inténtalo nuevamente en un momento.'
 if(msg && msg.length<300)return msg
 return en
  ? 'Could not complete the request. Please try again.'
  : 'No pudimos completar la consulta. Inténtalo de nuevo.'
}

/** A 502–504 response can mean a backend is starting; do not retry POST
 * automatically, since science raster reads and calculations are expensive.
 */
export async function httpErrorMessage(response: Response, en: boolean): Promise<string> {
 if([502,503,504].includes(response.status))return en
  ? 'The server or satellite provider is temporarily unavailable. Please retry shortly.'
  : 'El servidor o proveedor satelital no está disponible temporalmente. Vuelve a intentarlo en un momento.'
 if(response.status===404)return en
  ? 'CHAKRA could not find this API route. Please retry; if it continues, the server connection needs attention.'
  : 'CHAKRA no encontró esta consulta en el servidor. Reintenta; si continúa, hay que revisar la conexión del servicio.'
 if(response.status===429)return en
  ? 'The server is handling too many requests. Please retry shortly.'
  : 'El servidor está procesando demasiadas consultas. Vuelve a intentarlo en un momento.'
 return en
  ? 'Could not obtain the data right now. Please try again.'
  : 'No pudimos obtener los datos en este momento. Inténtalo nuevamente.'
}
