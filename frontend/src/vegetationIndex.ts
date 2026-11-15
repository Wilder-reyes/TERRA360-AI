/** Display bands for a vegetation index, NOT crop-health diagnoses. Null stays unknown. */
export function vegetationBand(value:number|null){
 if(value===null||!Number.isFinite(value)||value< -1||value>1)return {color:'#87928b',es:'Sin datos',en:'No data'}
 if(value<0.2)return {color:'#c4a46b',es:'Poca vegetación',en:'Little vegetation'}
 if(value<0.4)return {color:'#a9c97b',es:'Vegetación intermedia',en:'Intermediate vegetation'}
 return {color:'#248c52',es:'Más vegetación',en:'More vegetation'}
}
