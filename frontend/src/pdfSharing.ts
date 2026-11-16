import type {ChakraSpatialPlan} from './ChakraZonePlan'

export function planShareSummary(plan:ChakraSpatialPlan,es:boolean){
 const rows=plan.zone_plans.map((z,i)=>(es?'Zona ':'Area ')+String.fromCharCode(65+i)+' · '+z.area_ha.toFixed(2)+' ha\n'+(es?'Actual: ':'Current: ')+(es?z.current_crop:z.current_crop_en||z.current_crop)+'\n'+(es?'Próxima siembra: ':'Next sowing: ')+(es?z.suggested_crop:z.suggested_crop_en||z.suggested_crop)+' · '+(es?z.sow_label_es:z.sow_label_en||z.sow_label_es))
 return 'CHAKRA X\n'+rows.join('\n\n')+'\n\n'+(es?plan.disclaimer_es:plan.disclaimer_en||plan.disclaimer_es)
}
export function downloadPlanPdf(file:File){
 const url=URL.createObjectURL(file),link=document.createElement('a')
 link.href=url;link.download=file.name;document.body.appendChild(link);link.click();link.remove()
 window.setTimeout(()=>URL.revokeObjectURL(url),30000)
}
/** The file is prepared before the click, preserving native user activation. */
export async function sharePlanPdf(file:File,summary:string){
 const data={files:[file],title:'CHAKRA X',text:'CHAKRA X · Plan agrícola'}
 try{
  if(navigator.canShare?.({files:[file]})&&navigator.share){await navigator.share(data);return 'shared' as const}
 }catch(error){if(error instanceof Error&&error.name==='AbortError')return 'cancelled' as const}
 downloadPlanPdf(file)
 window.open('https://wa.me/?text='+encodeURIComponent(summary),'_blank','noopener,noreferrer')
 return 'downloaded' as const
}
