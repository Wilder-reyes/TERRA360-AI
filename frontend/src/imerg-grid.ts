/** A schematic geographic 0.1° box for IMERG's nominal source grid.
 * This is NOT a geocoded scientific pixel footprint of the GIBS WMS image.
 * SMAP and MODIS use different projections and are deliberately excluded.
 */
export function imergApproxCell(lat:number,lng:number):[[number,number],[number,number]]{
 if(!Number.isFinite(lat)||!Number.isFinite(lng)||lat < -90||lat > 90||lng < -180||lng > 180)
  throw new RangeError('Invalid geographic point')
 const minLat=Math.min(89.9,Math.floor((lat+90)/.1)*.1-90)
 const minLon=Math.min(179.9,Math.floor((lng+180)/.1)*.1-180)
 return [[Number(minLat.toFixed(4)),Number(minLon.toFixed(4))],
         [Number(Math.min(90,minLat+.1).toFixed(4)),Number(Math.min(180,minLon+.1).toFixed(4))]]
}
