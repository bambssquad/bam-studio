import * as T from './vendor/three.module.js?v=bake-20261008-v9';
const boxFrom=values=>new T.Box3(new T.Vector3(...values[0]),new T.Vector3(...values[1]));
function motionMatrix(item,progress) {
 const t=progress*progress*(3-2*progress);
 if(item.descriptor.motion==='translation')return new T.Matrix4().makeTranslation(...item.axis.clone().multiplyScalar(item.travel*t).toArray());
 return new T.Matrix4().makeTranslation(...item.pivot.toArray()).multiply(new T.Matrix4().makeRotationAxis(item.axis,item.angle*t)).multiply(new T.Matrix4().makeTranslation(...item.pivot.clone().negate().toArray()));
}
export function createOpenings({sourceScene,openingMap,collisionBuilder,onStatus=()=>{}}) {
 sourceScene.updateMatrixWorld(true);const lookup=new Map();sourceScene.traverse(o=>{if(o.isMesh)lookup.set(o.name,o);});
 const root=new T.Group();root.name='Bukaan teridentifikasi';const dynamicNames=new Set(),items=[];let meshCount=0,triangles=0;
 const descriptors=[...(openingMap.hingedDoors||[]),...(openingMap.slidingPanels||[])];
 for(const descriptor of descriptors){
  if(!descriptor.geometryVerified)continue;
  for(const name of descriptor.meshNodeNames){if(!lookup.has(name))throw new Error(`Bagian bukaan tidak ditemukan: ${name}`);if(dynamicNames.has(name))throw new Error(`Bagian ${name} masuk lebih dari satu bukaan.`);}
  const group=new T.Group();group.name='opening-'+descriptor.sourceInstance;root.add(group);
  const item={id:String(descriptor.sourceInstance),descriptor,group,meshes:[],sourceSnapshots:[],progress:0,target:0,axis:new T.Vector3(...descriptor.axisWorld).normalize(),pivot:new T.Vector3(...(descriptor.pivotWorld||[0,0,0])),angle:descriptor.previewAngleRadians||T.MathUtils.degToRad(80),travel:descriptor.suggestedAdditionalOpenTravelMetres||0,sourceBounds:boxFrom(descriptor.boundsWorldMetres),bounds:boxFrom(descriptor.boundsWorldMetres),motion:new T.Matrix4(),sourcePosePartial:descriptor.closedPose==='source-is-partly-open'};
  item.label=`${descriptor.motion==='translation'?'Panel geser':'Pintu'} ${items.length+1} · ${item.sourceBounds.min.y>4?'atas':'dasar'}`;
  for(const name of descriptor.meshNodeNames){const original=lookup.get(name),mesh=new T.Mesh(original.geometry,original.material);mesh.name=name;mesh.userData={...original.userData,dynamicOpening:item.id};mesh.matrixAutoUpdate=false;mesh.matrix.copy(original.matrixWorld);group.add(mesh);item.meshes.push(mesh);item.sourceSnapshots.push({isMesh:true,geometry:original.geometry,material:original.material,matrixWorld:original.matrixWorld.clone()});dynamicNames.add(name);meshCount++;triangles+=(original.geometry.index?.count||original.geometry.attributes.position.count)/3;}
  // Group matrix carries only the rigid world-space animation. Child matrices retain full source affine transforms.
  group.matrixAutoUpdate=false;group.matrix.identity();items.push(item);
 }
 // This temporary lookup must not pin the entire 70k-node imported scene through closures.
 lookup.clear();
 root.updateMatrixWorld(true);
 function enableCollision(builder){for(const item of items)if(!item.collider)item.collider=builder(item.sourceSnapshots);}
 if(collisionBuilder)enableCollision(collisionBuilder);
 const byId=new Map(items.map(item=>[item.id,item]));
 function setTarget(id,open){const item=byId.get(String(id));if(!item)return false;item.target=open?1:0;return true;}
 function update(dt,playerBounds){let changed=false,moving=false,finished=false;const step=Math.min(.1,Math.max(0,Number.isFinite(dt)?dt:0))/1.15;
  for(const item of items){if(item.progress===item.target)continue;let next=T.MathUtils.clamp(item.progress+Math.sign(item.target-item.progress)*step,0,1);if(Math.abs(next-item.target)<1e-8)next=item.target;
   const matrix=motionMatrix(item,next),bounds=item.sourceBounds.clone().applyMatrix4(matrix);
   if(item.target===0&&playerBounds&&bounds.clone().expandByScalar(.06).intersectsBox(playerBounds)){item.target=1;onStatus('Menjauh dari daun pintu sebelum menutup.');moving=true;continue;}
   item.progress=next;item.motion.copy(matrix);item.group.matrix.copy(matrix);item.group.matrixWorldNeedsUpdate=true;item.bounds.copy(bounds);changed=true;
   if(item.progress!==item.target)moving=true;else finished=true;
  }
  if(changed)root.updateMatrixWorld(true);return {changed,moving,finished};
 }
 function nearest(position,distance=3){let best=null,bestDistance=distance;for(const item of items){if(!item.meshes.some(m=>m.visible))continue;const d=item.bounds.distanceToPoint(position);if(d<bestDistance){bestDistance=d;best=item;}}return best;}
 function collideCapsule(capsule){let best=false;const capsuleBounds=new T.Box3().setFromPoints([capsule.start,capsule.end]).expandByScalar(capsule.radius+.001);
  for(const item of items){if(!item.collider||!item.meshes.some(m=>m.visible)||!item.bounds.intersectsBox(capsuleBounds))continue;
   const inverse=item.motion.clone().invert(),local=capsule.clone();local.start.applyMatrix4(inverse);local.end.applyMatrix4(inverse);const hit=item.collider.capsuleIntersect(local);
   if(hit&&(!best||hit.depth>best.depth))best={normal:hit.normal.clone().transformDirection(item.motion),depth:hit.depth};
  }return best;
 }
 function rayIntersect(ray){let nearest=false;for(const item of items){if(!item.collider||!item.meshes.some(m=>m.visible)||!ray.intersectsBox(item.bounds))continue;const inverse=item.motion.clone().invert(),local=ray.clone();local.origin.applyMatrix4(inverse);local.direction.transformDirection(inverse);const hit=item.collider.rayIntersect(local);if(hit&&(!nearest||hit.distance<nearest.distance))nearest={distance:hit.distance,position:hit.position.clone().applyMatrix4(item.motion)};}return nearest;}
 return {root,items,dynamicNames,meshCount,triangles,rayIntersect,enableCollision,setTarget,toggle(id){const item=byId.get(String(id));if(item)item.target=item.target?0:1;},setAll(open){for(const item of items)item.target=open?1:0;},update,nearest,collideCapsule,
  setLayerVisible(name,visible){for(const item of items)for(const mesh of item.meshes)if((mesh.userData.sourceLayer||'Layer0')===name)mesh.visible=visible;},
  dispose(){for(const item of items)item.collider?.clear();root.removeFromParent();},getLayerCounts(){const result=new Map();for(const item of items)for(const mesh of item.meshes){const name=mesh.userData.sourceLayer||'Layer0';result.set(name,(result.get(name)||0)+1);}return result;},
  inspect(){return items.map(item=>({id:item.id,label:item.label,progress:item.progress,target:item.target,sourcePosePartial:item.sourcePosePartial}));}};
}
