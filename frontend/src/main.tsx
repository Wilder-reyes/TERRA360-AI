import React, {lazy, Suspense} from 'react'
import {createRoot} from 'react-dom/client'
import RotationApp from './RotationApp'
import 'leaflet/dist/leaflet.css'
import './i18n'
import './style.css'

/** Default view: Field Shift rotation comparator (ES/EN).
 * Previous farmer weather dashboard: ?vista=clima · technical lab: ?vista=tecnica.
 */
const AdvancedApp=lazy(()=>import('./App'))
const FarmerApp=lazy(()=>import('./FarmerApp'))
const view=new URLSearchParams(window.location.search).get('vista')

createRoot(document.getElementById('root')!).render(
 <React.StrictMode>
  <Suspense fallback={<div role="status">Cargando… / Loading…</div>}>
   {view==='tecnica'?<AdvancedApp/>:view==='clima'?<FarmerApp/>:<RotationApp/>}
  </Suspense>
 </React.StrictMode>
)
