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
  export const GeoJSON: ComponentType<any>
  export const Popup: ComponentType<any>
  export const Tooltip: ComponentType<any>
  export function useMap(): {
    setView:(center:[number,number],zoom:number)=>void
    getZoom:()=>number
    invalidateSize:(options?:{pan?:boolean})=>void
    getBounds:()=>{getWest:()=>number;getSouth:()=>number;getEast:()=>number;getNorth:()=>number}
    fitBounds:(bounds:[[number,number],[number,number]],options?:{padding?:[number,number];animate?:boolean})=>void
  }
  export function useMapEvents(events:{click?:(e:{latlng:{lat:number;lng:number}})=>void;moveend?:()=>void}):void
}
