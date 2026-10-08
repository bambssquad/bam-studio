import * as THREE from './vendor/three.module.js?v=whole-20261008-v10';
import { RoomEnvironment } from './vendor/RoomEnvironment.js?v=whole-20261008-v10';
import {INTERIOR_BOUNDS} from './interior-view.js?v=whole-20261008-v10';
export function shadowCameraBounds(bounds,position,target) {
 const camera=new THREE.PerspectiveCamera();camera.position.copy(position);camera.lookAt(target);camera.updateMatrixWorld();
 const box=new THREE.Box3();for(const x of [bounds.min.x,bounds.max.x])for(const y of [bounds.min.y,bounds.max.y])for(const z of [bounds.min.z,bounds.max.z])box.expandByPoint(new THREE.Vector3(x,y,z).applyMatrix4(camera.matrixWorldInverse));
 const margin=3;return {left:box.min.x-margin,right:box.max.x+margin,bottom:box.min.y-margin,top:box.max.y+margin,near:Math.max(.1,-box.max.z-margin),far:-box.min.z+margin};
}
export function setShadowVisibility(root,enabled){root.traverse(mesh=>{if(mesh.isMesh){mesh.castShadow=enabled;mesh.receiveShadow=enabled;}});}
export function createPresentation(renderer,scene,model,bounds,lights,options={}) {
 let mode='light',environment,environmentTarget;
 const center=bounds.getCenter(new THREE.Vector3());scene.add(lights.key.target);
 function ensureEnvironment(){if(environment)return;const generator=new THREE.PMREMGenerator(renderer),room=new RoomEnvironment();environmentTarget=generator.fromScene(room,.04);environment=environmentTarget.texture;room.dispose();generator.dispose();}
 function apply(nextMode,time='day',enhanced=false){
  mode=nextMode;const cinematic=mode==='cinematic',dusk=time==='dusk',night=time==='night',interior=time==='interior';
  scene.environment=(cinematic||enhanced)?(ensureEnvironment(),environment):null;scene.environmentIntensity=interior?.42:night?.18:cinematic?(dusk?.38:.52):enhanced?.35:1;
  renderer.shadowMap.enabled=cinematic;renderer.shadowMap.type=THREE.PCFShadowMap;renderer.shadowMap.autoUpdate=false;
  lights.key.castShadow=cinematic;setShadowVisibility(model,cinematic);
  if(cinematic){lights.key.position.copy(center).add(new THREE.Vector3(100,155,85));lights.key.target.position.copy(center);Object.assign(lights.key.shadow.camera,shadowCameraBounds(bounds,lights.key.position,center));lights.key.shadow.camera.updateProjectionMatrix();const size=options.shadowSize||(matchMedia('(max-width:760px)').matches?1024:2048);lights.key.shadow.mapSize.set(size,size);lights.key.shadow.bias=-.00007;lights.key.shadow.normalBias=.045;lights.key.shadow.radius=2;lights.ambient.intensity=dusk?.8:1.1;lights.key.intensity=dusk?2.5:3.0;lights.fill.intensity=dusk?.2:.35;renderer.toneMappingExposure=dusk?1.04:.94;}
  else{if(lights.key.shadow.map){lights.key.shadow.map.dispose();lights.key.shadow.map=null;}if(lights.key.shadow.mapPass){lights.key.shadow.mapPass.dispose();lights.key.shadow.mapPass=null;}lights.key.position.set(100,130,80);lights.key.target.position.set(0,0,0);lights.ambient.intensity=dusk?1.45:2.1;lights.key.intensity=dusk?2.4:2.9;lights.fill.intensity=dusk?.55:1;renderer.toneMappingExposure=dusk?1.05:1;}
  if(night){lights.ambient.intensity=.25;lights.key.intensity=.15;lights.fill.intensity=.1;renderer.toneMappingExposure=1;}
  if(interior){lights.key.position.set(72,13,-4);lights.key.target.position.set(64,2.2,-11);lights.ambient.intensity=.65;lights.key.intensity=2.2;lights.fill.intensity=.22;renderer.toneMappingExposure=1.04;if(cinematic){Object.assign(lights.key.shadow.camera,shadowCameraBounds(INTERIOR_BOUNDS,lights.key.position,lights.key.target.position));lights.key.shadow.camera.updateProjectionMatrix();lights.key.shadow.bias=-.00002;lights.key.shadow.normalBias=.015;}}
  scene.updateMatrixWorld(true);renderer.shadowMap.needsUpdate=cinematic;
 }
 return {apply,refreshShadows(){if(mode==='cinematic')renderer.shadowMap.needsUpdate=true;},dispose(){environmentTarget?.dispose();}};
}
