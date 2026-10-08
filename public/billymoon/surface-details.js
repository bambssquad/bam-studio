import * as T from './vendor/three.module.js?v=whole-20261008-v10';
// Art-directed micro-height only. Existing source colors, albedo and UV geometry stay authoritative.
const profiles=new Map([[114,'stone'],[117,'stone'],[144,'wood'],[147,'wood'],[93,'wood'],[102,'wood'],[228,'wood'],[229,'wood'],[235,'wood'],[240,'wood'],[336,'wood'],[338,'wood']]);
export function makeHeightTexture(kind){
 if(!['wood','stone','weave'].includes(kind))throw new RangeError('Unknown surface detail');
 const size=128,data=new Uint8Array(size*size*4),tau=Math.PI*2;
 for(let y=0;y<size;y++)for(let x=0;x<size;x++){
  const u=x/size,v=y/size;
  const grain=Math.sin(tau*(u*19+Math.sin(tau*v*2)*.23))*.6+Math.sin(tau*(u*37+Math.sin(tau*v*3)*.3))*.24;
  const stone=Math.sin(tau*(u*13+v*17))*.38+Math.sin(tau*(u*31-v*19))*.26+Math.sin(tau*(u*7+v*23))*.2;
  const weave=Math.cos(tau*u*16)*Math.cos(tau*v*16)*.7+Math.cos(tau*(u+v)*32)*.15;
  const height=Math.round(128+40*(kind==='wood'?grain:kind==='stone'?stone:weave)),i=(y*size+x)*4;
  data[i]=data[i+1]=data[i+2]=height;data[i+3]=255;
 }
 const map=new T.DataTexture(data,size,size,T.RGBAFormat,T.UnsignedByteType);map.name='Original procedural '+kind+' micro-height';map.wrapS=map.wrapT=T.RepeatWrapping;map.magFilter=T.LinearFilter;map.minFilter=T.LinearMipmapLinearFilter;map.generateMipmaps=true;map.colorSpace=T.NoColorSpace;map.needsUpdate=true;return map;
}
export function prepareSurfaceDetails(sourceScene){
 const records=new Map(),textures=new Map();let disposed=false;
 sourceScene.traverse(mesh=>{if(!mesh.isMesh||!mesh.geometry?.attributes.uv)return;for(const material of (Array.isArray(mesh.material)?mesh.material:[mesh.material])){
  const kind=profiles.get(material.userData.sourceMaterialIndex);if(!kind||!material.map||records.has(material))continue;
  const source=material.map,key=JSON.stringify([kind,source.channel,source.offset.toArray(),source.repeat.toArray(),source.rotation,source.center.toArray()]);
  if(!textures.has(key)){const map=makeHeightTexture(kind);map.channel=source.channel;map.offset.copy(source.offset);map.repeat.copy(source.repeat).multiplyScalar(kind==='wood'?5:7);map.rotation=source.rotation;map.center.copy(source.center);textures.set(key,map);}
  records.set(material,{originalMap:material.bumpMap,originalScale:material.bumpScale,map:textures.get(key),scale:kind==='wood'?.0015:.0025});
 }});
 function setEnabled(enabled){if(disposed)return;for(const [material,state]of records){material.bumpMap=enabled?state.map:state.originalMap;material.bumpScale=enabled?state.scale:state.originalScale;material.needsUpdate=true;}}
 return {setEnabled,stats:{materials:records.size,textures:textures.size,estimatedTextureBytes:textures.size*128*128*4*4/3},dispose(){if(disposed)return;setEnabled(false);for(const texture of textures.values())texture.dispose();disposed=true;}};
}
