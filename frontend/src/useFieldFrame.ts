import {useEffect} from 'react'
import {useMap} from 'react-leaflet'

/** Fit the real field to the available map viewport, including after a resize.
 * Tile native limits still apply: zooming in enlarges available imagery.
 */
export function useFieldFrame(points:readonly [number,number][]|null,latitude:number,longitude:number){
 const map=useMap(),geometry=JSON.stringify(points)
 useEffect(()=>{
  let frame=0
  const fit=()=>{
   cancelAnimationFrame(frame)
   frame=requestAnimationFrame(()=>{
    map.invalidateSize({pan:false})
    const vertices=JSON.parse(geometry) as [number,number][]|null
    if(vertices&&vertices.length>=3)map.fitBounds(vertices,{padding:[24,24],maxZoom:20,animate:false})
    else map.setView([latitude,longitude],13)
   })
  }
  fit()
  const observer=new ResizeObserver(fit)
  observer.observe(map.getContainer())
  return()=>{cancelAnimationFrame(frame);observer.disconnect()}
 },[map,geometry,latitude,longitude])
}
