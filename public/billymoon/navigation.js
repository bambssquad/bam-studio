import {
  Box3, Group, Mesh, Ray, Triangle, Vector3,
} from 'three';
import { Octree } from './vendor/Octree.js?v=bake-20261008-v9';
import { Capsule } from './vendor/Capsule.js?v=bake-20261008-v9';
import { createAvatar } from './avatar.js?v=bake-20261008-v9';
import { AUDITED_DYNAMIC_NAMES } from './audited-dynamic-names.js?v=bake-20261008-v9';

const RADIUS = .25, BODY_HEIGHT = 1.7, STEP = .22, SKIN = .0001;
const SPEED = 2.4, RUN_SPEED = 4.8, GRAVITY = 18, MAX_DT = 1 / 15;
const MAX_TRAVEL = RADIUS / 4, MIN_GROUND_NORMAL = .65;
const DOWN = new Vector3(0, -1, 0);
const KEY_CODES = new Set(['KeyW','KeyS','KeyA','KeyD','ArrowUp','ArrowDown','ArrowLeft','ArrowRight','ShiftLeft','ShiftRight','Space','KeyC']);
const finite = value => Number.isFinite(value) ? value : 0;
const clamp = (value, min, max) => Math.max(min, Math.min(max, finite(value)));

// Architectural source meshes can have reflected transforms and mixed winding.
// Reuse the official Octree's triangle storage/broad phase, testing each nearby
// triangle from the capsule side. No duplicate shell or modified source geometry.
class ArchitecturalOctree extends Octree {
  constructor() {
    super();
    this._flipped = new Triangle();
    this._normal = new Vector3();
    this._center = new Vector3();
    this._point = new Vector3();
  }
  addTriangle(triangle) {
    if(triangle.getArea()>1e-10)super.addTriangle(triangle);
    return this;
  }
  // The stock depth-16 split replicates broad/coplananr architectural triangles
  // across huge numbers of tiny cells. Bound depth, cell width and replication.
  // Leaf queries and all collision narrow-phase still use Three's Octree.
  build() {
    this.calcBox();
    const splitNode=(node,depth)=>{
      const size=node.box.getSize(new Vector3());
      if(depth>0 && (node.triangles.length<=64 || depth>=7 || Math.min(size.x,size.y,size.z)<.4))return;
      const middle=node.box.getCenter(new Vector3()),children=[];
      const padding=1e-10*Math.max(1,node.box.min.length(),node.box.max.length());
      for(let x=0;x<2;x++)for(let y=0;y<2;y++)for(let z=0;z<2;z++){
        // Copy outer boundaries verbatim: min+half can round below the parent's
        // max and silently exclude coplanar faces sitting at that exact bound.
        const min=new Vector3(x?middle.x:node.box.min.x,y?middle.y:node.box.min.y,z?middle.z:node.box.min.z);
        const max=new Vector3(x?node.box.max.x:middle.x,y?node.box.max.y:middle.y,z?node.box.max.z:middle.z);
        children.push(new Octree(new Box3(min,max).expandByScalar(padding)));
      }
      let missing=false;
      for(const triangle of node.triangles) {
        let assigned=false;
        for(const child of children)if(child.box.intersectsTriangle(triangle)){child.triangles.push(triangle);assigned=true;}
        if(!assigned)missing=true;
      }
      // Preserve every original triangle even for unexpected numeric edge cases.
      // A root fallback needs one leaf because Octree queries start at children.
      if(missing) {
        if(depth===0) {
          const leaf=new Octree(node.box.clone().expandByScalar(padding));leaf.triangles=node.triangles;
          node.triangles=[];node.subTrees=[leaf];
        }
        return;
      }
      const replicas=children.reduce((n,child)=>n+child.triangles.length,0);
      if(depth>0 && replicas>node.triangles.length*3.2)return;
      node.triangles=[];node.subTrees=children.filter(child=>child.triangles.length);
      for(const child of node.subTrees)splitNode(child,depth+1);
    };
    splitNode(this,0);
    return this;
  }
  collectCandidates(shape,triangles){const seen=new Set(triangles);const visit=node=>{for(const child of node.subTrees){if(!shape.intersectsBox(child.box))continue;if(child.triangles.length){for(const triangle of child.triangles)if(!seen.has(triangle)){seen.add(triangle);triangles.push(triangle);}}else visit(child);}};visit(this);}
  getCapsuleTriangles(capsule,triangles){this.collectCandidates(capsule,triangles);}
  getRayTriangles(ray,triangles){this.collectCandidates(ray,triangles);}
  triangleCapsuleIntersect(capsule, triangle) {
    triangle.getNormal(this._normal);
    capsule.getCenter(this._center);
    const side = this._center.sub(triangle.a).dot(this._normal);
    const oriented = side < 0 ? this._flipped.set(triangle.c, triangle.b, triangle.a) : triangle;
    return super.triangleCapsuleIntersect(capsule, oriented);
  }
  rayIntersect(ray) {
    const triangles = [];
    this.getRayTriangles(ray, triangles);
    let nearest = false, distance = Infinity;
    for (const triangle of triangles) {
      if (!ray.intersectTriangle(triangle.a, triangle.b, triangle.c, false, this._point)) continue;
      const d = ray.origin.distanceTo(this._point);
      if (d < distance) {
        distance = d;
        nearest = {distance:d,position:this._point.clone(),triangle};
      }
    }
    return nearest;
  }
}

/** Snapshot an iterable of Mesh objects using their CURRENT exact matrixWorld.
 * Does not update/reparent/mutate the input. The returned tree supports
 * capsuleIntersect(), rayIntersect(), and clear(); callers own its lifetime.
 * Useful for a moving door's initial world-space geometry, queried by rigidly
 * inverse-transforming the player capsule into that same source-pose space.
 */
export function buildTriangleOctree(meshes) {
  const root=new Group();
  for(const mesh of meshes) {
    if(!mesh?.isMesh || !mesh.geometry?.getAttribute('position'))continue;
    const proxy=new Mesh(mesh.geometry,mesh.material);
    proxy.matrixAutoUpdate=false;proxy.matrix.copy(mesh.matrixWorld);root.add(proxy);
  }
  if(!root.children.length)throw new Error('No collision mesh snapshots supplied');
  const tree=new ArchitecturalOctree().fromGraphNode(root);
  root.clear();
  if(tree.bounds.isEmpty())throw new Error('Collision meshes contain no nondegenerate triangles');
  return tree;
}

/**
 * DOM-free, metres/Y-up navigation. Caller owns focus/pointer input and rendering.
 * sourceScene must already have current matrixWorld values after exact explicit
 * glTF matrices are restored. This function never updates or reparents the source.
 * setMove(x,y): right / forward in [-1,1]. setLook(dx,dy): right / down in radians.
 * setKey('clear', false), clearInputs(), or setMode('orbit') clears held input.
 * onStatus receives a plain string. Collision coverage is deliberately partial.
 */
export function createNavigation({scene,camera,controls,sourceScene,navigationMap,dynamicNames=[],dynamicCollision=null,dynamicRay=null,onStatus=()=>{}}) {
  if (!scene?.isObject3D || !camera?.isCamera || !sourceScene?.isObject3D) throw new TypeError('scene, camera and sourceScene are required');
  const startInfo = navigationMap?.recommendedStart;
  if (!startInfo?.positionWorldMetres?.every(Number.isFinite) || startInfo.positionWorldMetres.length !== 3) throw new TypeError('An audited recommendedStart is required');
  const allowed = new Set([
    ...(navigationMap.architecturalCollisionCandidates?.meshNodeNames || []),
    ...(navigationMap.floorCandidateMeshNames || []),
    ...(navigationMap.stairs || []).flatMap(s=>s.meshNodeNames || []),
  ]);
  const excluded = new Set([...AUDITED_DYNAMIC_NAMES,...dynamicNames]);
  const staticMeshes=[];
  // MatrixWorld snapshots remain exact, including shear and negative determinant.
  let selectedCount = 0;
  sourceScene.traverse(node => {
    if (!node.isMesh || !allowed.has(node.name) || !node.geometry?.getAttribute('position')) return;
    for (let ancestor=node; ancestor; ancestor=ancestor.parent) if (excluded.has(ancestor.name)) return;
    staticMeshes.push(node);
    selectedCount++;
  });
  if (!selectedCount) throw new Error('No audited static collision meshes found');
  const octree = buildTriangleOctree(staticMeshes);
  const worldBounds = octree.bounds.clone();
  const eyeHeight = clamp(startInfo.eyeHeightMetres || 1.65,1.3,BODY_HEIGHT-.01);
  const startEye = new Vector3().fromArray(startInfo.positionWorldMetres);
  const initialForward = new Vector3().fromArray(startInfo.forwardWorld || [0,0,-1]);
  const initialYaw = Math.atan2(initialForward.x,-initialForward.z);
  const capsule = new Capsule(new Vector3(),new Vector3(),RADIUS);
  const velocity = new Vector3();
  const keyState = new Set();
  const stick = {x:0,y:0};
  const avatarModel=createAvatar(),avatar=avatarModel.root;
  // Static scene shadows are cached. Avoid leaving a moving-avatar shadow behind.
  avatar.traverse(mesh=>{if(mesh.isMesh)mesh.castShadow=false;});
  scene.add(avatar);
  let mode='orbit', yaw=initialYaw, pitch=0, grounded=false, disposed=false;
  let savedOrbit=null, dirty=false, pendingLook=false, cameraSettling=false, flying=false, sprinting=false, verticalInput=0;
  const smoothAim=new Vector3(),desiredCamera=new Vector3();
  let dynamicCollisionHook=typeof dynamicCollision==='function'?dynamicCollision:null;
  const move = new Vector3(), forward = new Vector3(), right = new Vector3();
  const oldEye = new Vector3(), cameraRay = new Ray(), cameraAim = new Vector3();
  const notify = message => onStatus(message);
  notify(`Navigation collision coverage is partial: ${selectedCount} audited static meshes. Dynamic openings require the separate moving-door collider.`);

  function eye(target=new Vector3()) {
    return target.set(capsule.start.x,capsule.start.y-RADIUS+eyeHeight,capsule.start.z);
  }
  function clearInputs() {keyState.clear();stick.x=0;stick.y=0;verticalInput=0;sprinting=false;avatarModel.cancelEmote?.();}
  function reset() {
    clearInputs();avatarModel.reset();flying=false;cameraSettling=false;
    capsule.start.copy(startEye);capsule.start.y += RADIUS-eyeHeight;
    capsule.end.copy(startEye);capsule.end.y += BODY_HEIGHT-RADIUS-eyeHeight;
    velocity.set(0,0,0);yaw=initialYaw;pitch=0;grounded=false;pendingLook=false;
    if (mode!=='orbit') syncCamera();
  }
  function snapshotOrbit() {
    return {position:camera.position.clone(),quaternion:camera.quaternion.clone(),up:camera.up.clone(),fov:camera.fov,
      target:controls?.target?.clone(),enabled:controls?.enabled};
  }
  function restoreOrbit() {
    if (!savedOrbit) return;
    camera.position.copy(savedOrbit.position);camera.quaternion.copy(savedOrbit.quaternion);camera.up.copy(savedOrbit.up);
    if (camera.isPerspectiveCamera) {camera.fov=savedOrbit.fov;camera.updateProjectionMatrix();}
    if (controls) {
      if (savedOrbit.target && controls.target) controls.target.copy(savedOrbit.target);
      controls.enabled=savedOrbit.enabled;
    }
    camera.updateMatrixWorld();savedOrbit=null;dirty=true;
  }
  function setMode(next) {
    if (disposed) return;
    if (!['orbit','first','third'].includes(next)) throw new RangeError(`Unknown navigation mode: ${next}`);
    if (next===mode) return;
    if (mode==='orbit' && next!=='orbit') {savedOrbit=snapshotOrbit();if(controls)controls.enabled=false;}
    if(flying)setFlying(false);clearInputs();avatarModel.reset();mode=next;avatar.visible=mode==='third';dirty=true;
    if (mode==='orbit') restoreOrbit();else syncCamera();
  }
  function cameraHit(ray){const fixedHit=octree.rayIntersect(ray),movingHit=typeof dynamicRay==='function'?dynamicRay(ray.clone()):null;return movingHit&&Number.isFinite(movingHit.distance)&&movingHit.distance>=0&&(!fixedHit||movingHit.distance<fixedHit.distance)?movingHit:fixedHit;}
  function constrainCamera(position,origin){cameraRay.origin.copy(origin);cameraRay.direction.copy(position).sub(origin);const length=cameraRay.direction.length();if(length<1e-8)return;cameraRay.direction.divideScalar(length);const hit=cameraHit(cameraRay);if(hit&&hit.distance<length+.15)position.copy(origin).addScaledVector(cameraRay.direction,Math.max(0,hit.distance-.15));}
  function syncCamera(dt=0) {
    const beforePosition=camera.position.clone(),beforeQuaternion=camera.quaternion.clone();
    const beforeAvatarPosition=avatar.position.clone(),beforeAvatarYaw=avatar.rotation.y;
    const p=eye(),alpha=dt>0?1-Math.exp(-dt*14):1;
    avatar.position.set(p.x,p.y-eyeHeight,p.z);const angle=Math.atan2(Math.sin(-yaw-avatar.rotation.y),Math.cos(-yaw-avatar.rotation.y));avatar.rotation.y+=angle*alpha;if(Math.abs(angle)<.0001)avatar.rotation.y=-yaw;
    camera.up.set(0,1,0);forward.set(Math.sin(yaw)*Math.cos(pitch),Math.sin(pitch),-Math.cos(yaw)*Math.cos(pitch));
    cameraSettling=false;
    if (mode==='first') {
      const previousY=camera.position.y;camera.position.copy(p);camera.position.y=clamp(previousY+(p.y-previousY)*alpha,p.y-.25,p.y+.025);if(Math.abs(camera.position.y-p.y)<.0001)camera.position.y=p.y;else cameraSettling=true;
      cameraAim.copy(camera.position).add(forward);camera.lookAt(cameraAim);
    } else if (mode==='third') {
      desiredCamera.copy(p).addScaledVector(forward,-3.2);desiredCamera.y+=.55;constrainCamera(desiredCamera,p);
      camera.position.lerp(desiredCamera,alpha);smoothAim.lerp(p,alpha);if(camera.position.distanceToSquared(desiredCamera)<1e-8)camera.position.copy(desiredCamera);else cameraSettling=true;if(smoothAim.distanceToSquared(p)<1e-8)smoothAim.copy(p);else cameraSettling=true;
      // Recheck the interpolated camera as well: smoothing must not cross a wall.
      constrainCamera(camera.position,p);camera.lookAt(smoothAim);
    }
    if(avatar.visible&&Math.abs(angle)>.0001)cameraSettling=true;
    camera.updateMatrixWorld();
    if(!camera.position.equals(beforePosition)||!camera.quaternion.equals(beforeQuaternion)||(avatar.visible&&(!avatar.position.equals(beforeAvatarPosition)||avatar.rotation.y!==beforeAvatarYaw)))dirty=true;
  }
  function intersect(c) {
    const fixed=octree.capsuleIntersect(c);
    // Protect controller state from accidental callback mutation. The hook owns
    // broad-phase culling of its moving leaves and returns world-space normals.
    const dynamic=dynamicCollisionHook?.(c.clone());
    if(dynamic && Number.isFinite(dynamic.depth) && dynamic.depth>0 && dynamic.normal?.isVector3 &&
      dynamic.normal.toArray().every(Number.isFinite) && dynamic.normal.lengthSq()>1e-12 && (!fixed || dynamic.depth>fixed.depth)) {
      return {normal:dynamic.normal.clone().normalize(),depth:dynamic.depth};
    }
    return fixed;
  }
  function setDynamicCollision(fn) {
    if(fn!==null && fn!==undefined && typeof fn!=='function')throw new TypeError('Dynamic collision must be a function or null');
    dynamicCollisionHook=fn || null;grounded=false;
  }
  function resolve(c, horizontal=false) {
    let floor=false,blocked=false;
    for(let i=0;i<5;i++) {
      const hit=intersect(c);
      if(!hit || hit.depth<1e-7)break;
      blocked=true;
      if(horizontal) {
        const horizontal2=hit.normal.x**2+hit.normal.z**2;
        if(horizontal2<.0001)break;
        c.translate(new Vector3(hit.normal.x,0,hit.normal.z).multiplyScalar((hit.depth+SKIN)/horizontal2));
      } else {
        c.translate(hit.normal.clone().multiplyScalar(hit.depth+SKIN));
        if(hit.normal.y>=MIN_GROUND_NORMAL)floor=true;
        if((hit.normal.y>0 && velocity.y<0)||(hit.normal.y<0 && velocity.y>0))velocity.y=0;
      }
    }
    return {floor,blocked};
  }
  function clearAt(c) {const hit=intersect(c);return !hit || hit.depth<1e-6;}
  function localSupport(c, maxUp, maxDown, toward=null) {
    const feet=c.start.y-RADIUS;
    const offsets=[new Vector3()];
    if(toward?.lengthSq()>0) offsets.push(toward.clone().normalize().multiplyScalar(RADIUS));
    else offsets.push(new Vector3(RADIUS,0,0),new Vector3(-RADIUS,0,0),new Vector3(0,0,RADIUS),new Vector3(0,0,-RADIUS));
    let height=-Infinity;
    for(const offset of offsets) {
      const ray=new Ray(new Vector3(c.start.x+offset.x,feet+maxUp+SKIN,c.start.z+offset.z),DOWN);
      const hit=octree.rayIntersect(ray);
      if(!hit || hit.distance>maxUp+maxDown+2*SKIN)continue;
      const n=hit.triangle.getNormal(new Vector3());
      if(Math.abs(n.y)<MIN_GROUND_NORMAL)continue;
      height=Math.max(height,hit.position.y);
    }
    return height;
  }
  function tryStep(from,delta) {
    const destination=from.clone();destination.translate(delta);
    const supportY=localSupport(destination,STEP,.002,delta);
    const rise=supportY-(from.start.y-RADIUS);
    if(!Number.isFinite(rise) || rise<=SKIN || rise>STEP)return false;
    const raised=from.clone();
    const lift=rise+SKIN,liftSteps=Math.ceil(lift/.035);
    for(let i=0;i<liftSteps;i++) {
      raised.translate(new Vector3(0,lift/liftSteps,0));
      if(!clearAt(raised))return false;
    }
    raised.translate(delta);
    if(!clearAt(raised))return false;
    capsule.copy(raised);grounded=true;velocity.y=0;return true;
  }
  function substep(dt,inputX,inputY,speed) {
    const before=capsule.clone();
    forward.set(Math.sin(yaw),0,-Math.cos(yaw));right.set(Math.cos(yaw),0,Math.sin(yaw));
    move.copy(forward).multiplyScalar(inputY).addScaledVector(right,inputX).multiplyScalar(speed*dt);
    const wasGrounded=grounded;
    if(move.lengthSq()>0) {
      capsule.translate(move);
      const collision=resolve(capsule,true);
      const progress=capsule.start.clone().sub(before.start).dot(move);
      if(collision.blocked && wasGrounded && progress<move.lengthSq()*.9)tryStep(before,move);
    }
    // Gravity is suspended only on an unchanged confirmed support point. A move
    // performs a short capsule support probe, so walking off an edge falls.
    if(wasGrounded) {
      const support=capsule.clone();support.translate(new Vector3(0,-.006,0));
      const contact=intersect(support);
      grounded=(!!contact && contact.normal.y>=MIN_GROUND_NORMAL) || Number.isFinite(localSupport(capsule,.001,.006));
      if(grounded)velocity.y=0;
    }
    if(!grounded) {
      velocity.y=Math.max(-18,velocity.y-GRAVITY*dt);
      capsule.translate(new Vector3(0,velocity.y*dt,0));
      grounded=resolve(capsule).floor;
    }
    if(capsule.start.y < worldBounds.min.y-8 || capsule.start.x<worldBounds.min.x-10 || capsule.start.x>worldBounds.max.x+10 || capsule.start.z<worldBounds.min.z-10 || capsule.start.z>worldBounds.max.z+10) {
      reset();notify('Returned to the audited entry after leaving collision bounds.');return true;
    }
  }
  function jump(){if(disposed||mode==='orbit'||flying||!grounded)return false;avatarModel.cancelEmote?.();velocity.y=6.3;grounded=false;dirty=true;return true;}
  function setSprinting(value){sprinting=mode!=='orbit'&&!!value;}
  function setVertical(value){verticalInput=flying?clamp(value,-1,1):0;}
  function landBelow(){
    const feet=capsule.start.y-RADIUS,ray=new Ray(new Vector3(capsule.start.x,feet+.002,capsule.start.z),DOWN),hit=octree.rayIntersect(ray);
    if(hit&&hit.distance<60&&Math.abs(hit.triangle.getNormal(new Vector3()).y)>=MIN_GROUND_NORMAL){const candidate=capsule.clone();candidate.translate(new Vector3(0,hit.position.y+SKIN-feet,0));if(clearAt(candidate)){capsule.copy(candidate);grounded=true;velocity.y=0;return true;}}
    reset();notify('Tidak ada lantai aman di bawah. Kembali ke titik masuk.');return false;
  }
  function setFlying(value){if(disposed||mode==='orbit')return false;const next=!!value;if(next===flying)return true;avatarModel.cancelEmote?.();verticalInput=0;velocity.set(0,0,0);keyState.delete('Space');keyState.delete('KeyC');flying=next;if(next)grounded=false;else landBelow();dirty=true;pendingLook=true;return true;}
  function flightStep(dt,inputX,inputY,inputZ,speed){
    forward.set(Math.sin(yaw),0,-Math.cos(yaw));right.set(Math.cos(yaw),0,Math.sin(yaw));move.copy(forward).multiplyScalar(inputY).addScaledVector(right,inputX);move.y=inputZ;if(move.lengthSq()>1)move.normalize();move.multiplyScalar(speed*dt);capsule.translate(move);resolve(capsule);grounded=false;
    if(capsule.start.y>worldBounds.max.y+40){const delta=worldBounds.max.y+40-capsule.start.y;capsule.translate(new Vector3(0,delta,0));}
    if(capsule.start.y<worldBounds.min.y-3||capsule.start.x<worldBounds.min.x-15||capsule.start.x>worldBounds.max.x+15||capsule.start.z<worldBounds.min.z-15||capsule.start.z>worldBounds.max.z+15){reset();notify('Batas jelajah tercapai. Kembali ke titik masuk.');return true;}
  }
  function update(dt) {
    if(disposed)return {changed:false,active:false};
    if(mode==='orbit'){const changed=dirty;dirty=false;return {changed,active:false};}
    const x=stick.x+(keyState.has('KeyD')||keyState.has('ArrowRight')?1:0)-(keyState.has('KeyA')||keyState.has('ArrowLeft')?1:0);
    const y=stick.y+(keyState.has('KeyW')||keyState.has('ArrowUp')?1:0)-(keyState.has('KeyS')||keyState.has('ArrowDown')?1:0);
    const inputLength=Math.max(1,Math.hypot(x,y)),inputX=x/inputLength,inputY=y/inputLength;
    const vertical=flying?clamp(verticalInput+(keyState.has('Space')?1:0)-(keyState.has('KeyC')?1:0),-1,1):0;
    const moving=inputX!==0||inputY!==0||vertical!==0,run=sprinting||keyState.has('ShiftLeft')||keyState.has('ShiftRight');
    const speed=flying?(run?6.4:3.2):(run?RUN_SPEED:SPEED),elapsed=clamp(dt,0,MAX_DT);eye(oldEye);
    if(elapsed>0&&(moving||(!grounded&&!flying))){
      const steps=Math.max(1,Math.ceil(elapsed/(1/120)),Math.ceil((speed+Math.abs(velocity.y)+GRAVITY*elapsed)*elapsed/MAX_TRAVEL));
      for(let i=0;i<steps;i++)if(flying?flightStep(elapsed/steps,inputX,inputY,vertical,speed):substep(elapsed/steps,inputX,inputY,speed))break;
    }
    if(pendingLook||cameraSettling||!eye().equals(oldEye))syncCamera(elapsed);pendingLook=false;
    const now=eye(),distance=Math.hypot(now.x-oldEye.x,now.z-oldEye.z);
    const animation=avatarModel.update({distance,dt:elapsed,pitch,visible:mode==='third',grounded,flying,verticalSpeed:velocity.y,sprinting:run,moving});
    const changed=dirty||animation.changed;dirty=false;
    return {changed,active:moving||(!grounded&&!flying)||animation.active||cameraSettling};
  }
  function playEmote(name){if(mode!=='third'||flying||!grounded)return false;clearInputs();avatarModel.update({distance:0,dt:0,pitch,visible:true,grounded,flying:false,moving:false});return avatarModel.playEmote?.(name)||false;}
  function getMotionState(){return {flying,sprinting:sprinting||keyState.has('ShiftLeft')||keyState.has('ShiftRight'),grounded,verticalInput,emote:avatarModel.getState?.().emote||null};}
  function setMove(x,y) {stick.x=clamp(x,-1,1);stick.y=clamp(y,-1,1);}
  function setLook(dx,dy) {
    if(mode==='orbit'||disposed)return;
    const nextYaw=yaw+clamp(dx,-.35,.35),nextPitch=clamp(pitch-clamp(dy,-.35,.35),-1.35,1.35);
    if(nextYaw!==yaw || nextPitch!==pitch)pendingLook=true;
    yaw=((nextYaw+Math.PI)%(2*Math.PI)+2*Math.PI)%(2*Math.PI)-Math.PI;pitch=nextPitch;
  }
  function setKey(code,down) {
    if(code==='clear' || code==='Blur' || code===null){clearInputs();return;}
    if(!KEY_CODES.has(code))return;
    if(code==='Space'&&down&&!flying&&!keyState.has(code))jump();
    if(down)keyState.add(code);else keyState.delete(code);
  }
  function getPlayerBounds(target=new Box3()) {
    target.min.copy(capsule.start).min(capsule.end).addScalar(-RADIUS);
    target.max.copy(capsule.start).max(capsule.end).addScalar(RADIUS);return target;
  }
  function dispose() {
    if(disposed)return;
    if(mode!=='orbit')setMode('orbit');
    clearInputs();avatarModel.dispose();octree.clear();disposed=true;
  }
  reset();
  return {setMode,setMove,setLook,setKey,jump,setSprinting,setVertical,setFlying,playEmote,getMotionState,clearInputs,setDynamicCollision,refreshCamera(){pendingLook=true;},update,reset,getMode:()=>mode,getPlayerBounds,getEyePosition:eye,dispose};
}
