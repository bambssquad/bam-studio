import * as T from './vendor/three.module.js?v=drive-20261010-v14';
const KEYS=['roughness','metalness','opacity','transparent','depthWrite'];
export function prepareMaterials(sourceScene,config) {
 const profiles=new Map((config.profiles||[]).map(p=>[p.materialIndex,p.settings]));const records=new Map(),variants=new Map();
 function record(material,settings){if(!records.has(material)){const original={};for(const k of KEYS)original[k]=material[k];records.set(material,{original,enhanced:settings||{}});}else if(settings)Object.assign(records.get(material).enhanced,settings);}
 sourceScene.traverse(mesh=>{
  if(!mesh.isMesh)return;let nodeIndex=mesh.userData.sourceNodeIndex;
  if(nodeIndex===undefined)for(let p=mesh.parent;p;p=p.parent)if(p.userData.sourceNodeIndex!==undefined){nodeIndex=p.userData.sourceNodeIndex;break;}
  const layer=mesh.userData.sourceLayer||'Layer0';
  function assign(material){const index=material.userData.sourceMaterialIndex;const rule=(config.glassScopes||[]).find(r=>r.materialIndex===index&&(!r.layer||r.layer===layer)&&(!r.nodeIndices||r.nodeIndices.includes(nodeIndex)));
   if(rule){const key=material.uuid+':'+(rule.layer||'glass');if(!variants.has(key)){const variant=material.clone();variant.userData={...material.userData,pbrGlass:true};variants.set(key,variant);record(variant,{...profiles.get(index),...rule.settings});}return variants.get(key);}
   record(material,profiles.get(index));return material;
  }
  mesh.material=Array.isArray(mesh.material)?mesh.material.map(assign):assign(mesh.material);
 });
 return {apply(enhanced){for(const [material,state]of records){const settings=enhanced?{...state.original,...state.enhanced}:state.original;for(const k of KEYS)if(settings[k]!==undefined)material[k]=settings[k];material.needsUpdate=true;}},stats:{materials:records.size,glassVariants:variants.size,profiles:profiles.size}};
}
export const NIGHT_TINTS=Object.freeze({white:'#fff1dc',warm:'#ffd3a1',orange:'#ffb56b'});
export function createFixtureLights(scene,config){const lights=[],settings=config?.settings||{},originals=(config?.fixtures||[]).slice(0,4).map(f=>({...f,position:[...f.position],target:[...f.target]}));let activeCount=4,enabled=false,modeScale=1,brightness=1,preset='warm';
 for(const fixture of (config?.fixtures||[]).slice(0,4)){const light=new T.SpotLight(settings.colorHex||NIGHT_TINTS.warm,settings.intensityCandela||60,settings.distanceMetres||5,settings.angleRadians||.55,.82,settings.decay||2);light.position.fromArray(fixture.position);light.target.position.fromArray(fixture.target);light.castShadow=false;light.visible=false;scene.add(light,light.target);lights.push(light);}
 function apply(){for(const [index,light]of lights.entries()){light.visible=enabled&&index<activeCount;light.color.set(NIGHT_TINTS[preset]);light.intensity=(settings.intensityCandela||60)*Math.min(1.5,modeScale*brightness);}}
 return {lights,getOriginalFixtures:()=>originals.map(f=>({...f,position:[...f.position],target:[...f.target]})),setAssignments(fixtures=null){const selected=fixtures||originals;if(selected.length!==lights.length)throw new Error('Exactly four lamp slots required');for(const [i,f]of selected.entries()){if(!f.position?.every(Number.isFinite)||f.position.length!==3||!f.target?.every(Number.isFinite)||f.target.length!==3)throw new Error('Invalid lamp position');lights[i].position.fromArray(f.position);lights[i].target.position.fromArray(f.target);lights[i].distance=Math.min(12,Math.max(1,f.distance||settings.distanceMetres||5));lights[i].angle=Math.min(.65,Math.max(.1,f.angle||settings.angleRadians||.55));}apply();},setEnabled(value,intensityScale=1,count=4){enabled=!!value;activeCount=Number.isFinite(count)?Math.max(0,Math.min(4,Math.floor(count))):4;modeScale=Number.isFinite(intensityScale)?Math.max(0,Math.min(1.5,intensityScale)):1;apply();},setAppearance(tint,value=1){preset=Object.hasOwn(NIGHT_TINTS,tint)?tint:'warm';brightness=Number.isFinite(value)?Math.max(0,Math.min(1.5,value)):1;apply();},dispose(){for(const light of lights){light.removeFromParent();light.target.removeFromParent();light.dispose();}}};
}
