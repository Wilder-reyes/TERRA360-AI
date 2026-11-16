import test from 'node:test'
import assert from 'node:assert/strict'
import {sharePlanPdf,planShareSummary} from '../src/pdfSharing.ts'
const file=new File(['%PDF-1.7 results'],'CHAKRA-X-plan.pdf',{type:'application/pdf'})
function navigatorMock(t,value){const descriptor=Object.getOwnPropertyDescriptor(globalThis,'navigator');Object.defineProperty(globalThis,'navigator',{value,configurable:true});t.after(()=>{if(descriptor)Object.defineProperty(globalThis,'navigator',descriptor);else delete globalThis.navigator})}
test('native sharing receives the generated PDF synchronously, preserving user activation',async t=>{
 let called=false,complete
 navigatorMock(t,{canShare:({files})=>files[0]===file,share:data=>{called=true;assert.equal(data.files[0],file);return new Promise(resolve=>{complete=resolve})}})
 const result=sharePlanPdf(file,'real results')
 assert.equal(called,true);complete();assert.equal(await result,'shared')
})
test('cancelling native sharing does not download or open another application',async t=>{
 navigatorMock(t,{canShare:()=>true,share:async()=>{throw new DOMException('cancelled','AbortError')}})
 assert.equal(await sharePlanPdf(file,'results'),'cancelled')
})
test('unsupported browsers download the generated file and prepare actual results for WhatsApp without a picker',async t=>{
 navigatorMock(t,{canShare:()=>false})
 let downloaded=0,opened=''
 const oldDocument=globalThis.document,oldWindow=globalThis.window
 globalThis.document={createElement:tag=>{assert.equal(tag,'a');return {click(){downloaded++},remove(){}}},body:{appendChild(){}}}
 globalThis.window={setTimeout:fn=>fn(),open:url=>{opened=url}}
 t.after(()=>{if(oldDocument===undefined)delete globalThis.document;else globalThis.document=oldDocument;if(oldWindow===undefined)delete globalThis.window;else globalThis.window=oldWindow})
 const summary=planShareSummary({zone_plans:[{area_ha:1.5,current_crop:'Maíz',suggested_crop:'Frijol castilla',sow_label_es:'marzo de 2027'}],disclaimer_es:'Confirma agua y fechas.'},true)
 assert.equal(await sharePlanPdf(file,summary),'downloaded')
 assert.equal(downloaded,1)
 const url=new URL(opened);assert.equal(url.origin,'https://wa.me');assert.match(url.searchParams.get('text'),/Maíz/);assert.match(url.searchParams.get('text'),/marzo de 2027/)
 assert.doesNotMatch(summary,/enviado|sent|adjunto/)
})
