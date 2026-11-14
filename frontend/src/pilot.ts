/** Official MIDAGRI 2024 statistics-sector centroid (not a surveyed parcel).
 * Sector HUANDO code 15060105, district/province Huaral, region Lima.
 * This is a map navigation reference only, never an AOI or cadastral boundary.
 * Source: https://siea.midagri.gob.pe/portal/media/attachments/publicaciones/superficie/sectores/2024/Padron_Nacional_SE_2024_0403.pdf
 */
export const HUANDO_PILOT = Object.freeze({
  name: 'Huando, Huaral',
  district: 'Huaral',
  province: 'Huaral',
  region: 'Lima',
  country: 'Perú',
  sectorCode: '15060105',
  lat: -11.47918514,
  lng: -77.18041962,
  initialZoom: 13,
  agriculturalAreaHa2024: 1434.31,
  coordinateType: 'official_sector_centroid_not_parcel',
  boundaryValidated: false,
  sourceYear: 2024,
  sourceUrl: 'https://siea.midagri.gob.pe/portal/media/attachments/publicaciones/superficie/sectores/2024/Padron_Nacional_SE_2024_0403.pdf',
} as const)
