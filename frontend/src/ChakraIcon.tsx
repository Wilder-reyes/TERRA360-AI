import {createElement} from 'react'
import {addIcon} from 'iconify-icon'
import icons from './data/chakraIcons.json'
for(const [name,icon] of Object.entries(icons))addIcon('lucide:'+name,{...icon,width:24,height:24})
export type ChakraIconName=keyof typeof icons
export default function ChakraIcon({name,size=20}:{name:ChakraIconName;size?:number}){
 return createElement('iconify-icon',{icon:'lucide:'+name,width:size,height:size,'aria-hidden':'true',style:{'--icon-stroke-width':'1.5',display:'inline-flex',flexShrink:0}})
}
export function ChakraMark(){return <svg viewBox="0 0 32 32" fill="none" aria-hidden="true"><path d="M5 6h9v9H5V6Zm13 0h9v9h-9V6ZM5 19h9v9H5v-9Zm13 0h9v9h-9v-9Z" stroke="currentColor" strokeWidth="1.5"/><path d="m6 14 7-7m6 7 7-7M6 27l7-7m6 7 7-7" stroke="currentColor" strokeWidth="1.5"/></svg>}
