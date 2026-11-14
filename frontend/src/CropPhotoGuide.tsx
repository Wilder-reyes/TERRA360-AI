/** Local-only camera onboarding: never claims a trained crop-identification model. */
import {useEffect, useMemo, useState} from 'react'
import './crop-photo-guide.css'

const LIMIT_BYTES = 8 * 1024 * 1024
const TYPES = new Set(['image/jpeg', 'image/png', 'image/webp'])

export function CropPhotoGuide({en=false}:{en?:boolean}) {
 const [photo,setPhoto]=useState<File|null>(null)
 const [error,setError]=useState('')
 const preview=useMemo(()=>photo?URL.createObjectURL(photo):null,[photo])
 useEffect(()=>()=>{if(preview)URL.revokeObjectURL(preview)},[preview])
 return <section className="terra-crop-camera" aria-labelledby="terra-crop-camera-title">
   <div>
     <p className="terra-camera-eyebrow">{en?'Easy crop selection':'Tu cultivo, sin complicaciones'}</p>
     <h3 id="terra-crop-camera-title">{en?'Want to recognize your crop from a photo?':'¿Quieres reconocer tu cultivo con una foto?'}</h3>
     <p>{en?'We are preparing crop recognition with field-validated images. You can photograph your plant now, but automatic recognition is not active yet.':'Estamos preparando el reconocimiento de cultivos con fotos reales del campo. Por ahora puedes tomar una foto, pero la identificación automática aún no está disponible.'}</p>
     <label className="terra-camera-label" htmlFor="terra-photo-input">{en?'Take or choose a photo':'Tomar o elegir una foto'}</label>
     <input id="terra-photo-input" type="file" accept="image/jpeg,image/png,image/webp" capture="environment" aria-describedby="terra-photo-help" onChange={e=>{
       const file=e.currentTarget.files?.[0]
       e.currentTarget.value=''
       if(!file)return
       if(!TYPES.has(file.type)||file.size>LIMIT_BYTES||file.size===0){
         setPhoto(null)
         setError(en?'Choose a JPG, PNG or WebP photo smaller than 8 MB.':'Elige una foto JPG, PNG o WebP menor de 8 MB.')
         return
       }
       setError('')
       setPhoto(file)
     }}/>
     <p id="terra-photo-help" className="terra-camera-small">{en?'Your photo stays on this device: it is not uploaded or used to train AI.':'Tu foto se queda en este celular o computadora: no se envía ni se usa para entrenar inteligencia artificial.'}</p>
     {error&&<p className="terra-camera-error" role="alert">{error}</p>}
     {preview&&<div className="terra-camera-preview">
       <img src={preview} alt={en?'Locally chosen crop photo':'Foto de tu cultivo elegida en este dispositivo'}/>
       <div><strong>{en?'Photo ready':'Foto lista'}</strong>
         <p>{en?'This is a local preview, not an AI diagnosis. For now, choose the crop name below.':'Esta es solo una vista previa, no un diagnóstico. Por ahora elige el nombre del cultivo más abajo.'}</p>
         <button type="button" onClick={()=>setPhoto(null)}>{en?'Remove photo':'Quitar foto'}</button>
       </div>
     </div>}
   </div>
 </section>
}
