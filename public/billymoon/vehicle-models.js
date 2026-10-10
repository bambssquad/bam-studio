import * as T from './vendor/three.module.js?v=drive-20261010-v14';
import {VEHICLE_SIZES} from './vehicle-dynamics.js?v=drive-20261010-v14';

// Original procedural objects. No source architecture, textures or trademarks.
export function createVehicleModel(kind){
 const spec=VEHICLE_SIZES[kind];if(!spec)throw new Error('Unknown vehicle');
 const root=new T.Group();root.name=`vehicle-${kind}`;const body=new T.Group();root.add(body);
 const geometries=new Set(),materials=new Set(),wheels=[],front=[];
 const paint=new T.MeshStandardMaterial({vertexColors:true,roughness:.57,metalness:.12}),rubber=new T.MeshStandardMaterial({vertexColors:true,roughness:.87,metalness:0});materials.add(paint);materials.add(rubber);
 function merge(parts,mat=paint,parent=body,name='body'){
  const pos=[],normal=[],color=[];for(const [g,c,p=[0,0,0],rot=[0,0,0]]of parts){const raw=g.index?g.toNonIndexed():g,rgba=new T.Color(c),m=new T.Matrix4().compose(new T.Vector3(...p),new T.Quaternion().setFromEuler(new T.Euler(...rot)),new T.Vector3(1,1,1));raw.applyMatrix4(m);const a=raw.attributes;pos.push(...a.position.array);normal.push(...a.normal.array);for(let i=0;i<a.position.count;i++)color.push(rgba.r,rgba.g,rgba.b);if(raw!==g)raw.dispose();g.dispose();}
  const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(pos,3));g.setAttribute('normal',new T.Float32BufferAttribute(normal,3));g.setAttribute('color',new T.Float32BufferAttribute(color,3));g.computeBoundingSphere();geometries.add(g);const mesh=new T.Mesh(g,mat);mesh.name=name;mesh.castShadow=false;mesh.receiveShadow=false;parent.add(mesh);return mesh;
 }
 const box=(size,c,p,rot)=>[new T.BoxGeometry(...size),c,p,rot],cyl=(r,h,c,p,rot,segments=12)=>[new T.CylinderGeometry(r,r,h,segments),c,p,rot];
 const red=0xc15039,blue=0x537c99,dark=0x252b2e,metal=0xb9bbaf,cream=0xe9e4d5;
 const steering=new T.Group();steering.name='steering';body.add(steering);
 const seat=new T.Object3D(),driverEye=new T.Object3D();seat.name='rider-seat';driverEye.name='driver-eye';body.add(seat,driverEye);
 function wheel(x,y,z,r,w,steered=false){const pivot=new T.Group();pivot.position.set(x,y,z);body.add(pivot);if(steered)front.push(pivot);const mesh=merge([cyl(r,w,0x202325,[0,0,0],[0,0,Math.PI/2]),cyl(r*.48,w+.012,0x959a94,[0,0,0],[0,0,Math.PI/2])],rubber,pivot,`wheel-${wheels.length}`);wheels.push({mesh,r});}
 if(kind==='kart'){
  seat.position.set(0,.34,.22);driverEye.position.set(0,1.1,.12);
  merge([box([.95,.10,1.8],dark,[0,.17,0]),box([.92,.20,.5],red,[0,.26,-.65]),box([.14,.17,1.38],red,[-.51,.27,.05]),box([.14,.17,1.38],red,[.51,.27,.05]),box([.98,.08,.08],metal,[0,.23,-.98]),box([.98,.08,.08],metal,[0,.23,.98]),box([.43,.09,.45],dark,[0,.30,.24]),box([.43,.39,.085],dark,[0,.48,.47],[.15,0,0]),box([.28,.25,.36],metal,[.34,.40,.60]),cyl(.026,.78,metal,[0,.24,-.69],[0,0,Math.PI/2]),cyl(.026,.85,metal,[0,.24,.68],[0,0,Math.PI/2]),box([.11,.02,.15],cream,[-.12,.21,-.53]),box([.11,.02,.15],cream,[.12,.21,-.53])]);
  for(const x of [-.52,.52]){wheel(x,.22,-.7,.22,.23,true);wheel(x,.22,.7,.22,.23);}
  steering.position.set(0,.60,-.18);merge([[new T.TorusGeometry(.17,.021,5,12),dark,[0,0,0],[.40,0,0]],box([.28,.025,.025],metal,[0,0,0]),cyl(.022,.34,metal,[0,-.15,.055],[.35,0,0])],paint,steering,'handle');
 }else{
  seat.position.set(0,.74,.1);driverEye.position.set(0,1.46,-.01);
  merge([box([.31,.17,.49],blue,[0,.66,-.17],[.10,0,0]),box([.31,.10,.62],dark,[0,.70,.17]),box([.23,.31,.34],metal,[0,.37,-.07]),box([.14,.10,.38],blue,[0,.48,.59]),box([.10,.12,.09],0xe89867,[0,.61,.73]),cyl(.035,.96,dark,[0,.42,.11],[.90,0,0]),cyl(.035,.72,metal,[0,.4,.30],[-.9,0,0]),box([.8,.035,.10],dark,[0,.3,-.17]),cyl(.055,.5,metal,[.19,.25,.35],[Math.PI/2,0,0])]);
  wheel(0,.29,.70,.29,.15);const pivot=new T.Group();pivot.position.set(0,.29,-.72);body.add(pivot);front.push(pivot);const w=merge([cyl(.29,.13,0x202325,[0,0,0],[0,0,Math.PI/2]),cyl(.15,.14,metal,[0,0,0],[0,0,Math.PI/2])],rubber,pivot,'wheel-1');wheels.push({mesh:w,r:.29});
  steering.position.set(0,.29,-.72);merge([cyl(.029,.78,metal,[-.10,.33,.10],[.22,0,0]),cyl(.029,.78,metal,[.10,.33,.10],[.22,0,0]),box([.24,.06,.10],metal,[0,.70,.19]),cyl(.026,.23,metal,[-.10,.74,.30],[1.30,0,0]),cyl(.026,.23,metal,[.10,.74,.30],[1.30,0,0]),box([.60,.045,.045],dark,[0,.77,.4]),cyl(.10,.08,cream,[0,.59,.01],[Math.PI/2,0,0]),box([.18,.045,.34],blue,[0,.36,0])],paint,steering,'handle');
 }
 const contactMaterial=new T.MeshBasicMaterial({color:0x181a19,transparent:true,opacity:.19,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-1});materials.add(contactMaterial);const cg=new T.CircleGeometry(1,20);geometries.add(cg);const contact=new T.Mesh(cg,contactMaterial);contact.name='presentation-contact';contact.rotation.x=-Math.PI/2;contact.scale.set(spec.halfWidth*.93,spec.halfLength*.9,1);contact.position.y=.004;root.add(contact);
 const stats={triangles:0,drawCalls:0,textureBytes:0,geometryBytes:0};root.traverse(n=>{if(n.isMesh){stats.drawCalls++;stats.triangles+=(n.geometry.index?.count||n.geometry.attributes.position.count)/3;}});for(const g of geometries)for(const a of Object.values(g.attributes))stats.geometryBytes+=a.array.byteLength;
 let disposed=false;function update(pose,travel=0){if(disposed)return;root.position.fromArray(pose.position);root.rotation.y=-pose.yaw;for(const w of wheels)w.mesh.rotation.x-=travel/w.r;for(const p of front)p.rotation.y=-pose.steer;steering.rotation.y=-pose.steer;body.rotation.z=kind==='motorcycle'?Math.max(-.13,Math.min(.13,pose.steer*pose.speed*.045)):0;}
 return {root,seat,driverEye,contact,halfWidth:spec.halfWidth,halfLength:spec.halfLength,update,stats,dispose(){if(disposed)return;disposed=true;root.removeFromParent();for(const g of geometries)g.dispose();for(const m of materials)m.dispose();}};
}
