
/// <reference types="vite/client" />

declare module '*.css' {
  const content: string
  export default content
}
declare module 'leaflet' {
  const L: { divIcon: (options: Record<string, unknown>) => any }
  export default L
}
declare module 'react-leaflet' {
  import type { ComponentType, ReactNode } from 'react'
  export const MapContainer: ComponentType<any>
  export const TileLayer: ComponentType<any>
  export const Marker: ComponentType<any>
  export const Polygon: ComponentType<any>
  export const Polyline: ComponentType<any>
  export const Rectangle: ComponentType<any>
  export const CircleMarker: ComponentType<any>
  export const WMSTileLayer: ComponentType<any>
  export const Popup: ComponentType<any>
  export const Tooltip: ComponentType<any>
  export function useMap(): {setView:(center:[number,number],zoom:number)=>void;getZoom:()=>number;fitBounds:(bounds:[number,number][],options?:{maxZoom?:number;padding?:[number,number];animate?:boolean})=>void;latLngToContainerPoint:(p:[number,number])=>{x:number;y:number};getContainer:()=>HTMLElement;containerPointToLatLng:(p:[number,number])=>{lat:number;lng:number};doubleClickZoom:{enable:()=>void;disable:()=>void}}
  export function useMapEvents(events:{click?:(e:{latlng:{lat:number;lng:number}})=>void;dblclick?:(e:{latlng:{lat:number;lng:number}})=>void}):void
}
