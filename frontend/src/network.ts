/** TERRA360 API errors: never leak raw browser "Failed to fetch" in the UI.
 * Production requests go through the same-origin Netlify /api proxy; the
 * developer API origin is configurable ONLY in local Vite development.
 */
export const API = (
  import.meta.env.DEV ? (import.meta.env.VITE_API_URL || 'http://localhost:8000') : ''
).replace(/\/$/, '')

export function readableApiError(error: unknown, en: boolean): string {
 const e=error instanceof Error?error:null
 const msg=e?.message||''
 const network=(e instanceof TypeError || /failed to fetch|networkerror|network request failed|load failed|fetch failed|connection refused/i.test(msg))
 if(network)return en
  ? 'Could not connect to BIOTEX. Check your connection and try again; the server may be starting.'
  : 'No se pudo conectar con BIOTEX. Comprueba tu conexión e inténtalo de nuevo; el servidor podría estar iniciándose.'
 if(e?.name==='TimeoutError')return en
  ? 'The request took too long. Try again in a moment.'
  : 'La consulta tardó demasiado. Inténtalo nuevamente en un momento.'
 if(msg && msg.length<300)return msg
 return en
  ? 'Could not complete the request. Please try again.'
  : 'No pudimos completar la consulta. Inténtalo de nuevo.'
}

/** A 502–504 response can mean Render Free is waking up; do not retry POST
 * automatically, since science raster reads and calculations are expensive.
 */
export async function httpErrorMessage(response: Response, en: boolean): Promise<string> {
 if([502,503,504].includes(response.status))return en
  ? 'The server or satellite provider is temporarily unavailable. Please retry shortly.'
  : 'El servidor o proveedor satelital no está disponible temporalmente. Vuelve a intentarlo en un momento.'
 if(response.status===404)return en
  ? 'This feature is not yet available on the deployed server.'
  : 'Esta función todavía no está disponible en el servidor publicado.'
 if(response.status===429)return en
  ? 'The server is handling too many requests. Please retry shortly.'
  : 'El servidor está procesando demasiadas consultas. Vuelve a intentarlo en un momento.'
 return en
  ? 'Could not obtain the data right now. Please try again.'
  : 'No pudimos obtener los datos en este momento. Inténtalo nuevamente.'
}
