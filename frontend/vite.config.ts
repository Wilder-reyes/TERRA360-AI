import { defineConfig,loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import {apiOrigin} from './src/apiConfig.ts'

export default defineConfig(({mode})=>{
 const env=loadEnv(mode,process.cwd(),'VITE_')
 // Fail the build on malformed origins. Only this public value is exposed;
 // unrelated VITE_* variables do not enter the client bundle.
 const origin=apiOrigin(env.VITE_API_URL,mode==='development')
 return {plugins:[react()],envPrefix:[],define:{'import.meta.env.VITE_API_URL':JSON.stringify(origin)}}
})
