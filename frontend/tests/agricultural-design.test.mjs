import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'

const css=readFileSync(new URL('../src/chakra.css',import.meta.url),'utf8')
function linear(hex){const n=parseInt(hex,16);const a=[n>>16&255,n>>8&255,n&255].map(v=>v/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4);return .2126*a[0]+.7152*a[1]+.0722*a[2]}
function contrast(a,b){const l1=linear(a),l2=linear(b);return(Math.max(l1,l2)+.05)/(Math.min(l1,l2)+.05)}

test('CHAKRA premium dark mode uses the requested final design tokens',()=>{
 for(const [token,color] of Object.entries({
  '--bg-primary':'#050806','--bg-surface':'#111612','--bg-interactive':'#1B211B',
  '--text-primary':'#FFFFFF','--text-secondary':'#B5B8B6',
  '--accent-primary':'#D6F866','--accent-warning':'#D6F866',
  '--radius-card':'28px'})){
   assert.match(css,new RegExp(token+':\\s*'+color,'i'),token)
 }
 assert.match(css,/--touch-min:\s*48px/)
})
test('critical and secondary on-surface text exceed 7:1 contrast',()=>{
 for(const fg of ['FFFFFF','B5B8B6'])for(const bg of ['111612','1B211B'])
  assert.ok(contrast(fg,bg)>=7,`${fg}/${bg} contrast is below 7:1`)
 assert.ok(contrast('050806','D6F866')>=7,'CTA text should be legible on green')
})
test('dark theme is screen-only, preserving dedicated white A4 print styles',()=>{
 assert.match(css,/@media screen/)
 const main=readFileSync(new URL('../src/biotex-farmer.css',import.meta.url),'utf8')
 assert.match(main,/@page\s*\{size:A4 portrait;margin:18mm\}/)
})
