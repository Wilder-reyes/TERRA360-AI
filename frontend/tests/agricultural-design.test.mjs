import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'

const css=readFileSync(new URL('../src/agricultural-dark.css',import.meta.url),'utf8')
function linear(hex){const n=parseInt(hex,16);const a=[n>>16&255,n>>8&255,n&255].map(v=>v/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4);return .2126*a[0]+.7152*a[1]+.0722*a[2]}
function contrast(a,b){const l1=linear(a),l2=linear(b);return(Math.max(l1,l2)+.05)/(Math.min(l1,l2)+.05)}

test('Agricultural Dark Mode uses the requested final design tokens',()=>{
 for(const [token,color] of Object.entries({
  '--bg-primary':'#0B0E0C','--bg-surface':'#141A16','--bg-interactive':'#1E2620',
  '--text-primary':'#F0F4F1','--text-secondary':'#A3B2A8',
  '--accent-primary':'#4CD964','--accent-warning':'#F59E0B',
  '--border-subtle':'#35453A'})){
   assert.match(css,new RegExp(token+':\\s*'+color,'i'),token)
 }
 assert.match(css,/--touch-min:\s*48px/)
})
test('critical and secondary on-surface text exceed 7:1 contrast',()=>{
 for(const fg of ['F0F4F1','A3B2A8'])for(const bg of ['141A16','1E2620'])
  assert.ok(contrast(fg,bg)>=7,`${fg}/${bg} contrast is below 7:1`)
 assert.ok(contrast('0B0E0C','4CD964')>=7,'CTA text should be legible on green')
})
test('dark theme is screen-only, preserving dedicated white A4 print styles',()=>{
 assert.match(css,/@media screen/)
 const main=readFileSync(new URL('../src/biotex-farmer.css',import.meta.url),'utf8')
 assert.match(main,/@page\s*\{size:A4 portrait;margin:18mm\}/)
})
