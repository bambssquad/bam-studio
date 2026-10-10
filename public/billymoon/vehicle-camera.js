import {Vector3,Ray} from './vendor/three.module.js?v=drive-20261010-v14';
export function createVehicleCamera({camera,raycast=()=>false}){
 let mode='chase',fresh=true,disposed=false;const aim=new Vector3(),desired=new Vector3(),forward=new Vector3(),ray=new Ray();
 function constrain(p,origin){ray.origin.copy(origin);ray.direction.copy(p).sub(origin);const length=ray.direction.length();if(length<1e-8)return;ray.direction.divideScalar(length);const hit=raycast(ray);if(hit&&Number.isFinite(hit.distance)&&hit.distance<length+.18)p.copy(origin).addScaledVector(ray.direction,Math.max(0,hit.distance-.18));}
 function update(pose,dt=0){if(disposed)return {changed:false,active:false};const before=camera.position.clone(),old=camera.quaternion.clone();forward.set(Math.sin(pose.yaw),0,-Math.cos(pose.yaw));const target=new Vector3(...pose.position);target.y+=pose.kind==='motorcycle'?1.15:.85;
  if(mode==='driver'){desired.copy(pose.driverEye||target);aim.copy(desired).addScaledVector(forward,4);camera.position.copy(desired);}
  else{desired.copy(target).addScaledVector(forward,-3.4);desired.y+=1.45;constrain(desired,target);const alpha=fresh?1:1-Math.exp(-Math.max(0,Math.min(.1,Number.isFinite(dt)?dt:0))*10);camera.position.lerp(desired,alpha);aim.lerp(target,alpha);if(camera.position.distanceToSquared(desired)<1e-7)camera.position.copy(desired);if(aim.distanceToSquared(target)<1e-7)aim.copy(target);constrain(camera.position,target);}
  camera.up.set(0,1,0);camera.lookAt(aim);camera.updateMatrixWorld();fresh=false;return {changed:!before.equals(camera.position)||!old.equals(camera.quaternion),active:mode==='chase'&&(camera.position.distanceToSquared(desired)>1e-7||aim.distanceToSquared(target)>1e-7)};
 }
 return {setMode(next){if(!['driver','chase'].includes(next))throw new Error('Invalid driving camera');mode=next;fresh=true;},update,reset(){fresh=true;},dispose(){disposed=true;}};
}
