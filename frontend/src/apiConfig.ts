/** Public API origin only. Secrets must never be passed to the browser. */
export function apiOrigin(value:string|undefined,development:boolean){
 const raw=value?.trim()||''
 if(!raw)return development?'http://localhost:8000':''
 const url=new URL(raw)
 if(!['http:','https:'].includes(url.protocol)||url.username||url.password||url.search||url.hash||url.pathname!=='/')throw Error('VITE_API_URL must be an HTTP(S) origin without credentials, path, query or fragment')
 if(!development&&url.protocol!=='https:'&&!['localhost','127.0.0.1'].includes(url.hostname))throw Error('Production VITE_API_URL must use HTTPS')
 return url.origin
}
