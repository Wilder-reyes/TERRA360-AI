import React, {lazy, Suspense} from 'react'
import {createRoot} from 'react-dom/client'
import BiotexFarmerApp from './BiotexFarmerApp'
const ChalhuasPilotApp=lazy(()=>import('./ChalhuasPilotApp'))
const RotationApp=lazy(()=>import('./RotationApp'))
import 'leaflet/dist/leaflet.css'
import './i18n'
import './style.css'

/** Default view: BIOTEX plain-language planting recommendations; technical comparison remains opt-in (ES/EN).
 * Previous farmer weather dashboard: ?vista=clima · technical lab: ?vista=tecnica.
 */
const AdvancedApp=lazy(()=>import('./App'))
const FarmerApp=lazy(()=>import('./FarmerApp'))
const url=new URLSearchParams(window.location.search)
const view=url.get('vista')
const pilot=url.get('pilot')

createRoot(document.getElementById('root')!).render(
 <React.StrictMode>
  <Suspense fallback={<div role="status">Cargando… / Loading…</div>}>
   {view==='tecnica'?<AdvancedApp/>:view==='clima'?<FarmerApp/>:view==='comparador-tecnico'?<RotationApp/>:pilot==='chalhuas'?<ChalhuasPilotApp/>:<BiotexFarmerApp/>}
  </Suspense>
 </React.StrictMode>
)
