import * as THREE from './vendor/three.module.js?v=drive-20261010-v14';
const FOV=40;
export function cameraPose(bounds,aspect,view='iso') {
 const center=bounds.getCenter(new THREE.Vector3());
 const direction=view==='top'?new THREE.Vector3(0,1,.0001):view==='front'?new THREE.Vector3(1,.011,-.139):new THREE.Vector3(1,.78,-1.05);
 direction.normalize();
 const up=view==='top'?new THREE.Vector3(0,0,-1):new THREE.Vector3(0,1,0);
 const right=new THREE.Vector3().crossVectors(up,direction).normalize();
 const trueUp=new THREE.Vector3().crossVectors(direction,right).normalize();
 const tanY=Math.tan(THREE.MathUtils.degToRad(FOV/2)),tanX=tanY*Math.max(.1,aspect);
 let distance=0;
 for(const x of [bounds.min.x,bounds.max.x])for(const y of [bounds.min.y,bounds.max.y])for(const z of [bounds.min.z,bounds.max.z]) {
  const v=new THREE.Vector3(x,y,z).sub(center),depth=v.dot(direction);
  distance=Math.max(distance,depth+Math.abs(v.dot(right))/(tanX*.86),depth+Math.abs(v.dot(trueUp))/(tanY*.86));
 }
 const position=center.clone().addScaledVector(direction,distance);
 return {position,target:center,up,...depthRange(position,bounds)};
}

export function depthRange(position,bounds) {
 const closest=bounds.clampPoint(position,new THREE.Vector3()).distanceTo(position);
 let farthest=0;
 for(const x of [bounds.min.x,bounds.max.x])for(const y of [bounds.min.y,bounds.max.y])for(const z of [bounds.min.z,bounds.max.z])farthest=Math.max(farthest,position.distanceTo(new THREE.Vector3(x,y,z)));
 // The closest AABB point is a conservative lower bound on source surface distance.
 // Keep half of that empty space in front of the model; use a close-inspection fallback inside it.
 return {near:Math.max(.05,closest*.45),far:Math.max(1,farthest*1.08+1)};
}
export function updateDepthRange(camera,bounds) {
 const range=depthRange(camera.position,bounds);
 if(Math.abs(camera.near-range.near)>1e-5||Math.abs(camera.far-range.far)>1e-3){camera.near=range.near;camera.far=range.far;camera.updateProjectionMatrix();}
 return range;
}
