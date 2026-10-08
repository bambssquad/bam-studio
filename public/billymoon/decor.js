import * as T from './vendor/three.module.js?v=phone-20261008-01760e18';
import {mergeGeometries} from './vendor/BufferGeometryUtils.js?v=phone-20261008-01760e18';
import {makeHeightTexture} from './surface-details.js?v=phone-20261008-01760e18';
// Original optional furnishings. Only supplied geometry-audited placement records are accepted.
export function createDecor(placements){
 const root=new T.Group();root.name='Furnitur tambahan · konsep';const textures=['wood','weave','stone'].map(makeHeightTexture);textures[0].repeat.set(3,2);textures[1].repeat.set(3,3);
 const materials={oak:new T.MeshStandardMaterial({color:0x9e7955,roughness:.63,bumpMap:textures[0],bumpScale:.002}),fabric:new T.MeshStandardMaterial({color:0x858d89,roughness:.9,bumpMap:textures[1],bumpScale:.002}),dark:new T.MeshStandardMaterial({color:0x272f2f,roughness:.45,metalness:.45}),ceramic:new T.MeshStandardMaterial({color:0xc6bca8,roughness:.72,bumpMap:textures[2],bumpScale:.0008}),paper:new T.MeshStandardMaterial({color:0xe0d9c4,roughness:.96}),book:new T.MeshStandardMaterial({color:0x647876,roughness:.85}),leaf:new T.MeshStandardMaterial({color:0x41574a,roughness:.9,side:T.DoubleSide})};
 for(const [name,material]of Object.entries(materials))material.name='Original decor '+name;
 const vignettes=[];let triangles=0,drawGroups=0,collider=null,enabled=true,disposed=false;
 for(const placement of placements){
  if(!placement.verified||!['console','lounge','bench'].includes(placement.kind)||!placement.position?.every(Number.isFinite)||placement.position.length!==3||!Number.isFinite(placement.rotationY))throw new Error('A verified furniture placement is required');
  const group=new T.Group();group.name=placement.id;group.position.fromArray(placement.position);group.rotation.y=placement.rotationY;root.add(group);const buckets=new Map();
  function shape(geometry,material,position,rotation=[0,0,0]){const matrix=new T.Matrix4().compose(new T.Vector3(...position),new T.Quaternion().setFromEuler(new T.Euler(...rotation)),new T.Vector3(1,1,1));geometry.applyMatrix4(matrix);if(!buckets.has(material))buckets.set(material,[]);buckets.get(material).push(geometry);}
  const box=(size,p,mat='oak',r)=>shape(new T.BoxGeometry(...size),mat,p,r);
  const cylinder=(r1,r2,h,p,mat='ceramic',segments=12)=>shape(new T.CylinderGeometry(r1,r2,h,segments),mat,p);
  function vase(x,y,z){const profile=[[.065,0],[.08,.04],[.078,.16],[.046,.23],[.04,.27],[.03,.27],[.032,.24],[.038,.18]].map(([a,b])=>new T.Vector2(a,b));shape(new T.LatheGeometry(profile,12),'ceramic',[x,y,z]);for(let i=0;i<3;i++){const dx=(i-1)*.035;cylinder(.003,.003,.24,[x+dx,y+.32,z],'dark',5);const leaf=new T.BufferGeometry();leaf.setAttribute('position',new T.Float32BufferAttribute([0,0,0,.045,.035,.01,.08,.09,0,.03,.1,-.01],3));leaf.setIndex([0,1,2,0,2,3]);leaf.computeVertexNormals();leaf.setAttribute('uv',new T.Float32BufferAttribute([0,0,1,0,1,1,0,1],2));shape(leaf,'leaf',[x+dx,y+.39-i*.027,z],[0,i*2.1,0]);}}
  function books(x,y,z){for(let i=0;i<3;i++){const h=.028;box([.23,h,.15],[x+(i%2)*.012,y+i*.037+h/2,z],'paper',[0,i*.10,0]);box([.245,.006,.16],[x+(i%2)*.012,y+i*.037+h+.003,z],i%2?'oak':'book',[0,i*.10,0]);}}
  function chair(x){for(const xx of [-.25,.25])for(const z of [-.23,.23])box([.035,.32,.035],[x+xx,.16,z],'dark');box([.62,.12,.61],[x,.34,0],'oak');box([.57,.12,.55],[x,.46,.02],'fabric');box([.60,.42,.095],[x,.63,-.265],'fabric',[-.07,0,0]);for(const xx of [-.295,.295])box([.07,.11,.52],[x+xx,.60,-.01],'oak');}
  if(placement.kind==='console'){for(const x of [-.74,.74])for(const z of [-.15,.15])box([.035,.18,.035],[x,.09,z],'dark');box([1.82,.49,.37],[0,.43,0]);box([1.9,.065,.43],[0,.7075,0]);for(const x of [-.445,.445]){box([.85,.42,.022],[x,.435,.197],'oak');box([.022,.12,.026],[x+(x<0?.34:-.34),.47,.22],'dark');}books(-.51,.74,.01);vase(.55,.74,-.015);}
  if(placement.kind==='lounge'){chair(-.65);chair(.65);cylinder(.19,.19,.035,[0,.56,.07],'oak');cylinder(.025,.025,.53,[0,.2775,.07],'dark',8);cylinder(.15,.15,.025,[0,.0125,.07],'dark');books(0,.58,.07);}
  if(placement.kind==='bench'){for(const x of [-.7,.7])for(const z of [-.16,.16])box([.04,.32,.04],[x,.16,z],'dark');box([1.88,.10,.47],[0,.37,0]);box([1.22,.085,.43],[-.26,.4625,0],'fabric');books(.7,.42,0);}
  for(const [name,parts]of buckets){const geometry=mergeGeometries(parts);if(!geometry)throw new Error('Furniture geometry could not be prepared');parts.forEach(g=>g.dispose());const mesh=new T.Mesh(geometry,materials[name]);mesh.name=placement.id+'-'+name;mesh.castShadow=false;mesh.receiveShadow=false;mesh.userData.additionalDecor=true;group.add(mesh);triangles+=geometry.index.count/3;drawGroups++;}
  vignettes.push({root:group,placement});
 }
 root.updateMatrixWorld(true);
 function setEnabled(value){enabled=!!value&&!disposed;root.visible=enabled;}
 return {root,vignettes,stats:{vignettes:vignettes.length,triangles,drawGroups,estimatedTextureBytes:textures.length*128*128*4*4/3},setEnabled,isEnabled:()=>enabled,
  enableCollision(builder){if(!collider&&!disposed){const meshes=[];root.traverse(o=>{if(o.isMesh)meshes.push(o);});collider=builder(meshes);}},
  collideCapsule(capsule){return enabled&&collider?collider.capsuleIntersect(capsule):false;},rayIntersect(ray){return enabled&&collider?collider.rayIntersect(ray):false;},
  dispose(){if(disposed)return;setEnabled(false);collider?.clear();root.traverse(o=>{if(o.isMesh)o.geometry.dispose();});Object.values(materials).forEach(m=>m.dispose());textures.forEach(t=>t.dispose());root.removeFromParent();disposed=true;}};
}
