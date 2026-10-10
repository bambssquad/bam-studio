import {Vector3} from './vendor/three.module.js?v=drive-20261010-v14';
import {footprint,validateDrivingQuery} from './track-query.js?v=drive-20261010-v14';
import {createVehicleDynamics,VEHICLE_SIZES} from './vehicle-dynamics.js?v=drive-20261010-v14';
import {createVehicleModel} from './vehicle-models.js?v=drive-20261010-v14';
import {createVehicleCamera} from './vehicle-camera.js?v=drive-20261010-v14';

function overlap(a,b){for(const poly of [a,b])for(let i=0;i<4;i++){const p=poly[i],q=poly[(i+1)%4],axis=[q[1]-p[1],p[0]-q[0]],pa=a.map(v=>v[0]*axis[0]+v[1]*axis[1]),pb=b.map(v=>v[0]*axis[0]+v[1]*axis[1]);if(Math.max(...pa)<Math.min(...pb)||Math.max(...pb)<Math.min(...pa))return false;}return true;}
export function createDriving({query,scene,camera,navigation,wake=()=>{},onStatus=()=>{}}){
 validateDrivingQuery(query);
 const entries=new Map();let phase='walking',active=null,cameraMode='chase',suspended=false,disposed=false;
 const cameraRig=createVehicleCamera({camera,raycast:ray=>navigation.rayIntersect(ray)}),seat=new Vector3(),driverEye=new Vector3();
 function touchesOther(id,p,hw,hl){const poly=footprint(p,hw+.025,hl+.025);for(const [other,e]of entries){if(id===other)continue;const s=VEHICLE_SIZES[e.kind];if(overlap(poly,footprint(e.dynamics.getPose(),s.halfWidth,s.halfLength)))return true;}return false;}
 try{for(const p of query.parking){
  const dynamicQuery={...query,sweep(from,to,hw,hl){const r=query.sweep(from,to,hw,hl);const d=Math.hypot(r.pose.position[0]-from.position[0],r.pose.position[2]-from.position[2]),steps=Math.max(1,Math.ceil(d/.04));let last=from;for(let i=1;i<=steps;i++){const t=i/steps,next={...r.pose,position:from.position.map((v,j)=>v+(r.pose.position[j]-v)*t),yaw:from.yaw+(r.pose.yaw-from.yaw)*t};if(touchesOther(p.id,next,hw,hl))return {blocked:true,pose:last};last=next;}return r;}};
  const dynamics=createVehicleDynamics({kind:p.kind,query:dynamicQuery,spawn:p});const model=createVehicleModel(p.kind);entries.set(p.id,{kind:p.kind,model,dynamics,spawn:p});model.update(dynamics.getPose(),0);scene.add(model.root);
 }
 navigation.setSupplementalCollider(query.createWalkingCollider());
 }catch(error){for(const e of entries.values())e.model.dispose();cameraRig.dispose();throw error;}
 function nearest(position){if(disposed||!Array.isArray(position)||!position.every(Number.isFinite))return null;let best=null;for(const [id,e]of entries){const p=e.dynamics.getPose();const distance=Math.hypot(position[0]-p.position[0],position[1]-p.position[1],position[2]-p.position[2]);if(distance<=2&&(!best||distance<best.distance))best={id,distance};}return best;}
 function poseRider(e,dt=0){const p=e.dynamics.getPose();e.model.root.updateMatrixWorld(true);e.model.seat.getWorldPosition(seat);e.model.driverEye.getWorldPosition(driverEye);navigation.setRidingPose({kind:e.kind,seatPosition:seat.toArray(),yaw:p.yaw,steer:p.steer,lean:e.kind==='motorcycle'?Math.max(-.13,Math.min(.13,p.steer*p.speed*.045)):0,visible:cameraMode==='chase'});return cameraRig.update({...p,kind:e.kind,driverEye},dt);}
 function mount(id){if(disposed||suspended||phase!=='walking'||!entries.has(id))return false;const e=entries.get(id),feet=navigation.getMapPose().position,p=e.dynamics.getPose();if(Math.hypot(feet[0]-p.position[0],feet[1]-p.position[1],feet[2]-p.position[2])>2||Math.abs(p.speed)>.001||!navigation.beginExternalControl())return false;phase='mounting';active=id;cameraRig.reset();e.dynamics.stop();phase='driving';poseRider(e);onStatus('Berkendara · W/S gas/rem · A/D kemudi · V kamera · R reset');wake();return true;}
 function dismount(){if(disposed||phase!=='driving')return false;const e=entries.get(active),p=e.dynamics.getPose();if(Math.abs(p.speed)>=.5){onStatus('Berhenti dahulu untuk turun.');return false;}const exit=query.findDismount(p,.25,1.75);if(!exit||touchesOther(active,{position:exit,yaw:0},.3,.3)||!navigation.endExternalControl({footPosition:exit,yaw:p.yaw})){onStatus('Ruang turun terhalang. Geser kendaraan lalu coba lagi.');return false;}phase='dismounting';e.dynamics.stop();active=null;phase='walking';wake();return true;}
 function setInput(input){if(!disposed&&!suspended&&active)entries.get(active).dynamics.setInput(input);}
 function setSuspended(value){suspended=!!value;for(const e of entries.values())e.dynamics.stop();}
 function setCamera(next){if(!['driver','chase'].includes(next))return;cameraMode=next;cameraRig.setMode(next);if(active)poseRider(entries.get(active));wake();}
 function reset(){if(disposed)return;for(const [id,e]of entries){e.dynamics.reset();e.model.update(e.dynamics.getPose(),0);}cameraRig.reset();if(active)poseRider(entries.get(active));wake();}
 function tick(dt){if(disposed||suspended||!active)return {changed:false,active:false};const e=entries.get(active),before=e.dynamics.getPose(),r=e.dynamics.step(dt),distance=Math.hypot(r.pose.position[0]-before.position[0],r.pose.position[2]-before.position[2])*Math.sign(r.pose.speed);e.model.update(r.pose,distance);const c=poseRider(e,dt);return {changed:r.changed||c.changed,active:r.active||c.active};}
 function park(){setSuspended(true);active=null;phase='walking';cameraRig.reset();}
 return {nearest,mount,dismount,setInput,setSuspended,setCamera,reset,tick,park,getMapPose(){if(!active)return null;const e=entries.get(active),p=e.dynamics.getPose();return {mode:'vehicle',position:[...p.position],heading:p.yaw,vehicleKind:e.kind,grounded:true};},getState:()=>({phase,vehicleId:active,cameraMode,suspended,speed:active?entries.get(active).dynamics.getPose().speed:0}),stats:{triangles:[...entries.values()].reduce((n,e)=>n+e.model.stats.triangles,0),drawCalls:[...entries.values()].reduce((n,e)=>n+e.model.stats.drawCalls,0)},dispose(){if(disposed)return;park();disposed=true;cameraRig.dispose();for(const e of entries.values())e.model.dispose();entries.clear();}};
}
