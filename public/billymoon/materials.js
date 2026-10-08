import * as T from './vendor/three.module.js?v=phone-20261008-01760e18';
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
export function createFixtureLights(scene,config){const lights=[],settings=config?.settings||{};
 for(const fixture of (config?.fixtures||[]).slice(0,4)){const light=new T.SpotLight(settings.colorHex||'#ffd3a1',settings.intensityCandela||60,settings.distanceMetres||5,settings.angleRadians||.55,settings.penumbra||.6,settings.decay||2);light.position.fromArray(fixture.position);light.target.position.fromArray(fixture.target);light.castShadow=false;light.visible=false;scene.add(light,light.target);lights.push(light);}
 return {lights,setEnabled(enabled,intensityScale=1){for(const light of lights){light.visible=enabled;light.intensity=(settings.intensityCandela||60)*intensityScale;}},dispose(){for(const light of lights){light.removeFromParent();light.target.removeFromParent();light.dispose();}}};
}
