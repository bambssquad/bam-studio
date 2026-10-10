import * as T from './vendor/three.module.js?v=drive-20261010-v14';
import {NIGHT_TINTS} from './materials.js?v=drive-20261010-v14';
export const CIRCUIT_FIXTURES=Object.freeze([
 {id:'north20',base:[20,1.8,-61.52],position:[20,6.2,-61.52],target:[20,1.85,-58.5],distance:12},
 {id:'north57',base:[57,1.8,-61.52],position:[57,6.2,-61.52],target:[57,1.85,-58.5],distance:12},
 {id:'east55',base:[81.5,1.7,-55],position:[81.5,6.1,-55],target:[77,1.85,-55],distance:12},
 {id:'east43',base:[81.5,1.7,-43],position:[81.5,6.1,-43],target:[75,1.85,-43],distance:12}
]);
export function createCircuitLighting({scene,fixtureRig,candidates=CIRCUIT_FIXTURES}){
 if(candidates.length>4)throw new Error('Circuit fixture budget exceeded');
 const root=new T.Group();root.name='designed-circuit-fixtures';scene.add(root);
 const poleGeometry=new T.BoxGeometry(1,1,1),headGeometry=new T.BoxGeometry(.14,.06,.14),poleMaterial=new T.MeshStandardMaterial({color:0x485155,roughness:.75,metalness:.35}),headMaterial=new T.MeshStandardMaterial({color:0xe4d8bd,emissive:NIGHT_TINTS.warm,emissiveIntensity:0,roughness:.5});
 const poles=new T.InstancedMesh(poleGeometry,poleMaterial,candidates.length),heads=new T.InstancedMesh(headGeometry,headMaterial,candidates.length),matrix=new T.Matrix4();root.add(poles,heads);for(let i=0;i<candidates.length;i++){const c=candidates[i],h=c.position[1]-c.base[1];matrix.compose(new T.Vector3(c.base[0],c.base[1]+h/2,c.base[2]),new T.Quaternion(),new T.Vector3(.06,h,.06));poles.setMatrixAt(i,matrix);matrix.makeTranslation(...c.position);heads.setMatrixAt(i,matrix);}poles.computeBoundingSphere();heads.computeBoundingSphere();
 const originals=fixtureRig.getOriginalFixtures().map((f,i)=>({...f,id:'cafe'+i})),all=[...originals,...candidates];let selected=[],mode='day',enabled=true,brightness=1,tint='warm',disposed=false;
 function appearance(){headMaterial.emissive.set(NIGHT_TINTS[tint]||NIGHT_TINTS.warm);headMaterial.emissiveIntensity=mode==='night'&&enabled?brightness*2:0;fixtureRig.setAppearance(mode==='night'?tint:'warm',mode==='night'?(enabled?brightness:0):1);}
 function update(position,timeMode){if(disposed)return false;let changed=mode!==timeMode;mode=timeMode;if(mode!=='night'){if(selected.length){fixtureRig.setAssignments();selected=[];changed=true;}appearance();return changed;}
  const scored=all.map(c=>({c,d:Math.hypot(c.position[0]-position.x,c.position[2]-position.z)-(selected.includes(c.id)?2:0)})).sort((a,b)=>a.d-b.d||a.c.id.localeCompare(b.c.id)),next=scored.slice(0,4).map(x=>x.c),ids=next.map(x=>x.id);if(ids.join('|')!==selected.join('|')){fixtureRig.setAssignments(next);selected=ids;changed=true;}appearance();return changed;
 }
 return {root,update,setAppearance(next,value=1){tint=Object.hasOwn(NIGHT_TINTS,next)?next:'warm';brightness=Number.isFinite(value)?Math.max(0,Math.min(1.5,value)):1;appearance();},setEnabled(value){enabled=!!value;appearance();},inspect:()=>({selected:[...selected],fixtures:candidates.length,activeSlots:4,triangles:candidates.length*24,drawCalls:2,mode,enabled}),dispose(){if(disposed)return;disposed=true;fixtureRig.setAssignments();root.removeFromParent();poles.dispose();heads.dispose();poleGeometry.dispose();headGeometry.dispose();poleMaterial.dispose();headMaterial.dispose();}};
}
