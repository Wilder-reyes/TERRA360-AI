/** Consistent crop colors in farmer-declared zones and future recommendations. */
export type CropVisual={color:string;icon:string;name:string}
const VISUALS:Record<string,CropVisual>={
 maiz_amarillo_duro:{color:'#DFBE62',icon:'🌽',name:'Maíz'},
 maiz_chala:{color:'#D8CB78',icon:'🌽',name:'Maíz chala'},
 camote:{color:'#D99270',icon:'🍠',name:'Camote'},
 papa:{color:'#B4B89A',icon:'🥔',name:'Papa'},
 frijol_grano_seco:{color:'#9ACFAD',icon:'🫘',name:'Frijol'},
 frijol_castilla:{color:'#83BDB7',icon:'🫘',name:'Frijol castilla'},
 vainita:{color:'#70BE9B',icon:'🫛',name:'Vainita'},
 pallar:{color:'#B5C48A',icon:'🫘',name:'Pallar'},
 arveja_verde:{color:'#8FCB82',icon:'🫛',name:'Arveja'},
 cebolla:{color:'#C7A0D7',icon:'🧅',name:'Cebolla'},
 zanahoria:{color:'#E8AB72',icon:'🥕',name:'Zanahoria'},
 brocoli_col:{color:'#8FAF87',icon:'🥦',name:'Brócoli'},
 alfalfa:{color:'#91C6AA',icon:'🌿',name:'Alfalfa'}
}
export function cropVisual(id:string|undefined|null):CropVisual{
 return id?VISUALS[id]||{color:'#BAC8AC',icon:'🌱',name:'Cultivo'}:{color:'#B7C5B0',icon:'·',name:'Sin cultivo'}
}