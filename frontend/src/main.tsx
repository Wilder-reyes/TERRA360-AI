import React from 'react'
import {createRoot} from 'react-dom/client'
import BiotexFarmerApp from './BiotexFarmerApp'
import 'leaflet/dist/leaflet.css'
import './style.css'

// A single application. Historic vista/pilot query parameters do not select pages.
createRoot(document.getElementById('root')!).render(<React.StrictMode><BiotexFarmerApp/></React.StrictMode>)
