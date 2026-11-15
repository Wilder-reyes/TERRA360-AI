/** Canonical map-layer display metadata, not a claim that a GIBS tile has valid science data. */
export type BaseOrScienceLayer = 'photo'|'terrain'|'vegetation'|'rain'|'hls'
export type ScienceLayer = 'vegetation'|'rain'
export type LayerMetadata = {
 id:ScienceLayer
 nameEs:string;nameEn:string;producer:string;product:string
 resolutionEs:string;resolutionEn:string
 temporalEs:string;temporalEn:string
 unitEs:string;unitEn:string
 wmsLayer:string;sourceUrl:string;worldviewUrl:string
 limitationsEs:string;limitationsEn:string
}
export const GIBS_WMS='https://gibs.earthdata.nasa.gov/wms/epsg3857/best/wms.cgi'
export const GIBS_LAYERS:Record<ScienceLayer,LayerMetadata>={
 vegetation:{
  id:'vegetation',nameEs:'Vegetación NASA',nameEn:'NASA vegetation',producer:'NASA GIBS',product:'MODIS Terra NDVI 8-Day',
  resolutionEs:'250 m nominales, píxel regional',resolutionEn:'250 m nominal regional pixel',
  temporalEs:'Composición de 8 días; la fecha elegida puede corresponder a la escena más cercana disponible',
  temporalEn:'8-day composite; requested date can resolve to the nearest available scene',
  unitEs:'NDVI (índice sin unidad)',unitEn:'NDVI (unitless index)',
  wmsLayer:'MODIS_Terra_NDVI_8Day',
  sourceUrl:'https://nasa-gibs.github.io/gibs-api-docs/available-visualizations/',
  worldviewUrl:'https://worldview.earthdata.nasa.gov/?l=MODIS_Terra_NDVI_8Day',
  limitationsEs:'Imagen regional de referencia. La superposición no identifica cultivos ni mide exactamente tu chacra.',
  limitationsEn:'Regional reference image. The overlay neither identifies crops nor measures your field exactly.'
 },
 rain:{
  id:'rain',nameEs:'Lluvia NASA',nameEn:'NASA rainfall',producer:'NASA GIBS',product:'GPM IMERG Precipitation Rate',
  resolutionEs:'aprox. 0,1° (10 km), regional',resolutionEn:'approx. 0.1° (10 km), regional',
  temporalEs:'Fecha solicitada; verificar periodo efectivo en NASA Worldview',
  temporalEn:'Requested date; verify actual temporal period in NASA Worldview',
  unitEs:'Tasa de precipitación; escala y unidades en leyenda oficial',
  unitEn:'Precipitation rate; color scale and units on official legend',
  wmsLayer:'IMERG_Precipitation_Rate',
  sourceUrl:'https://nasa-gibs.github.io/gibs-api-docs/python-usage/',
  worldviewUrl:'https://worldview.earthdata.nasa.gov/?l=IMERG_Precipitation_Rate',
  limitationsEs:'La imagen no mide lluvia dentro de la chacra. No estima caudal del canal ni riego.',
  limitationsEn:'The image does not measure rain inside the field, river flow, or irrigation.'
 }
}
export function gibsLegendUrl(layer:ScienceLayer){
 const params=new URLSearchParams({SERVICE:'WMS',VERSION:'1.3.0',REQUEST:'GetLegendGraphic',LAYER:GIBS_LAYERS[layer].wmsLayer,FORMAT:'image/png'})
 return `${GIBS_WMS}?${params.toString()}`
}
export function isScienceLayer(layer:BaseOrScienceLayer):layer is ScienceLayer{return layer==='vegetation'||layer==='rain'}
