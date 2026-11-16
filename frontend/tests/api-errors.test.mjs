import test from 'node:test'
import assert from 'node:assert/strict'
// Public configuration is covered separately; exercise the pure error handlers.
import {readFileSync} from 'node:fs'
const source=readFileSync(new URL('../src/network.ts',import.meta.url),'utf8')
const {stripTypeScriptTypes}=await import('node:module')
const pure=source.slice(source.indexOf('export function readableApiError'))
const {httpErrorMessage,readableApiError}=await import('data:text/javascript;base64,'+Buffer.from(stripTypeScriptTypes(pure)).toString('base64'))
test('API validation details reach the farmer instead of a generic failure',async()=>{
 assert.equal(await httpErrorMessage(new Response(JSON.stringify({detail:'Cada zona debe quedar dentro del terreno.'}),{status:422}),false),'Cada zona debe quedar dentro del terreno.')
})
test('malformed validation responses and private server errors use helpful safe messages',async()=>{
 assert.match(await httpErrorMessage(new Response('<html>Bad Gateway</html>',{status:422}),false),/Revisa los límites/)
 assert.doesNotMatch(await httpErrorMessage(new Response(JSON.stringify({detail:'private traceback'}),{status:500}),false),/private traceback/)
 assert.match(readableApiError(new DOMException('timeout','TimeoutError'),false),/tardó demasiado/)
})
