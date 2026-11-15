/** Species reference lookup; never imports a catalogue result as farmer history. */
import {useEffect,useRef,useState} from 'react'
import {API,httpErrorMessage,readableApiError} from './network'
type Item={id:string;name:string;scientific_name:string;description?:string}
type Guidance={status:string;climate?:{complete_years:number;annual_rain_mm:number|null};selected_crop?:{name:string;reason:string};limitation?:string;can_recommend_sowing:false}
export default function CropReference({point,en}:{point:{lat:number;lng:number};en:boolean}){
 const [query,setQuery]=useState(''),[items,setItems]=useState<Item[]>([]),[selected,setSelected]=useState<Item|null>(null)
 const [guidance,setGuidance]=useState<Guidance|null>(null),[error,setError]=useState(''),[busy,setBusy]=useState(false)
 const epoch=useRef(0)
 useEffect(()=>()=>{epoch.current++},[])
 async function search(){
  const token=++epoch.current;setError('');setItems([]);setSelected(null);setGuidance(null);setBusy(true)
  try{const r=await fetch(API+'/api/arie/crops?'+new URLSearchParams({query:query.trim(),limit:'12'}));if(!r.ok)throw Error(await httpErrorMessage(r,en));const d=await r.json();if(epoch.current===token)setItems(d.items||[])}
  catch(e){if(epoch.current===token)setError(readableApiError(e,en))}finally{if(epoch.current===token)setBusy(false)}
 }
 async function review(){
  if(!selected)return
  const token=++epoch.current;setError('');setGuidance(null);setBusy(true)
  try{const r=await fetch(API+'/api/arie/crop-guidance?'+new URLSearchParams({latitude:String(point.lat),longitude:String(point.lng),selected_crop:selected.id}));if(!r.ok)throw Error(await httpErrorMessage(r,en));const d=await r.json();if(epoch.current===token)setGuidance(d)}
  catch(e){if(epoch.current===token)setError(readableApiError(e,en))}finally{if(epoch.current===token)setBusy(false)}
 }
 return <details className="b-technical"><summary>{en?'Crop references (optional)':'Referencias de cultivos (opcional)'}</summary>
  <p>{en?'This catalogue does not verify local suitability or add a crop to your history.':'El catálogo no verifica aptitud local ni agrega cultivos a tu historial.'}</p>
  <label>{en?'Search crop name':'Buscar nombre de cultivo'}<input value={query} onChange={e=>setQuery(e.target.value)}/></label>
  <button type="button" className="b-btn b-btn-light" disabled={busy||query.trim().length<2} onClick={search}>{en?'Search catalogue':'Buscar en catálogo'}</button>
  {items.map(item=><button type="button" className="b-btn b-btn-light" key={item.id} onClick={()=>{epoch.current++;setBusy(false);setSelected(item);setGuidance(null)}}>{item.name} · {item.scientific_name}</button>)}
  {selected&&<div><p>{en?'Reference crop':'Cultivo de referencia'}: {selected.name}</p><button type="button" className="b-btn b-btn-light" onClick={review} disabled={busy}>{en?'Review regional reference':'Revisar referencia regional'}</button></div>}
  {guidance&&<div><p>{guidance.selected_crop?.reason}</p><p>{guidance.limitation}</p><p>{en?'Complete years':'Años completos'}: {guidance.climate?.complete_years??0} · {en?'Mean annual rain':'Lluvia anual media'}: {guidance.climate?.annual_rain_mm??'—'} mm</p><p>{en?'Not a planting recommendation. Verify soil, water and variety.':'No es recomendación de siembra. Falta comprobar suelo, agua y variedad.'}</p></div>}
  {error&&<p role="alert">{error}</p>}
 </details>
}
