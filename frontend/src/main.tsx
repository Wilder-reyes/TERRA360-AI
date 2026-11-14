import React, {lazy, Suspense} from 'react'
import {createRoot} from 'react-dom/client'
import FarmerApp from './FarmerApp'
import './i18n'
import './style.css'

/** Existing technical modules remain available without crowding the farmer UI. */
const AdvancedApp=lazy(()=>import('./App'))
const technical=new URLSearchParams(window.location.search).get('vista')==='tecnica'

createRoot(document.getElementById('root')!).render(
 <React.StrictMode>
  {technical?<Suspense fallback={<div role="status">Cargando herramientas técnicas…</div>}><AdvancedApp/></Suspense>:<FarmerApp/>}
 </React.StrictMode>
)
