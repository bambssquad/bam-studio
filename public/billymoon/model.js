import * as THREE from './vendor/three.module.js?v=graphics-20261009-v13';
const reflection = new THREE.Matrix4().makeScale(-1, 1, 1);


const patchedMaterials=new WeakSet();
const retainedSourceGeometry=new WeakMap();
export const sourceGeometryForBatch=mesh=>retainedSourceGeometry.get(mesh);
export function exactInstanceNormals(material) {
  if(patchedMaterials.has(material))return;
  const original=THREE.ShaderChunk.defaultnormal_vertex;
  const start=original.indexOf('\ttransformedNormal /= vec3( dot( im[');
  const end=original.indexOf('\n',original.indexOf('transformedNormal = im * transformedNormal;',start));
  if(start<0||end<0)throw new Error('Shader normal instance tidak kompatibel.');
  const patched=original.slice(0,start)+'\ttransformedNormal = mat3( instanceNormal0, instanceNormal1, instanceNormal2 ) * transformedNormal;'+original.slice(end);
  const priorCompile=material.onBeforeCompile,priorCacheKey=material.customProgramCacheKey();
  material.onBeforeCompile=(shader,renderer)=>{
    priorCompile.call(material,shader,renderer);
    shader.vertexShader='attribute vec3 instanceNormal0;\nattribute vec3 instanceNormal1;\nattribute vec3 instanceNormal2;\n'+shader.vertexShader;
    shader.vertexShader=shader.vertexShader.replace('#include <defaultnormal_vertex>',patched);
  };
  material.customProgramCacheKey=()=> priorCacheKey+'|billymoon-exact-instance-normals-v1';
  material.needsUpdate=true;patchedMaterials.add(material);
}
function geometryForBatch(source,items) {
  const geometry=new THREE.BufferGeometry();
  for(const [name,attribute]of Object.entries(source.attributes))geometry.setAttribute(name,attribute);
  geometry.setIndex(source.index);geometry.groups=source.groups.map(g=>({...g}));geometry.boundingBox=source.boundingBox?.clone() || null;geometry.boundingSphere=source.boundingSphere?.clone() || null;
  const columns=[new Float32Array(items.length*3),new Float32Array(items.length*3),new Float32Array(items.length*3)];
  items.forEach((item,i)=>{const e=new THREE.Matrix3().getNormalMatrix(item.matrix).elements;for(let c=0;c<3;c++)columns[c].set(e.slice(c*3,c*3+3),i*3);});
  columns.forEach((values,c)=>geometry.setAttribute('instanceNormal'+c,new THREE.InstancedBufferAttribute(values,3)));
  return geometry;
}

// Reflect locally, reverse winding, then counter-reflect each instance matrix.
// Positions and normals in world space are unchanged; instance determinants stay positive.
export function reflectedGeometry(source) {
  const geometry = source.clone();
  geometry.applyMatrix4(reflection);
  const tangent = geometry.getAttribute('tangent');
  if (tangent) for (let i=0; i<tangent.count; i++) tangent.setW(i, -tangent.getW(i));
  if (!geometry.index) geometry.setIndex(Array.from({length:geometry.attributes.position.count}, (_,i)=>i));
  const a=geometry.index.array;
  for (let i=0;i<a.length;i+=3) [a[i+1],a[i+2]]=[a[i+2],a[i+1]];
  geometry.index.needsUpdate=true;
  geometry.computeBoundingBox(); geometry.computeBoundingSphere();
  return geometry;
}

export async function buildBatches(scene, onProgress=()=>{}, options={}) {
  scene.updateMatrixWorld(true);
  const groups=new Map(), layers=new Map(), root=new THREE.Group();
  const bounds=new THREE.Box3();
  let sourceMeshes=0,triangles=0,enumeration=0;
  scene.traverse(mesh=>{
    if(!mesh.isMesh || mesh.isSkinnedMesh) return;
    const sourceIndex=enumeration++;
    if(!mesh.geometry.boundingBox)mesh.geometry.computeBoundingBox();
    bounds.union(mesh.geometry.boundingBox.clone().applyMatrix4(mesh.matrixWorld));
    if(options.excludeNames?.has(mesh.name))return;
    const layer=String(mesh.userData.sourceLayer || 'Layer0');
    const mirrored=mesh.matrixWorld.determinant()<0;
    const materialKey=(Array.isArray(mesh.material)?mesh.material:[mesh.material]).map(m=>m.uuid).join(',');
    const transparent=(Array.isArray(mesh.material)?mesh.material:[mesh.material]).some(m=>m.transparent);
    const sourceMeshIndex=mesh.userData.sourceMeshIndex;
    const bindingIdentity=options.retainGeometryFor?.has(sourceMeshIndex)?sourceMeshIndex:null;
    const key=JSON.stringify([mesh.geometry.uuid,bindingIdentity,materialKey,layer,mirrored,transparent?mesh.uuid:null]);
    if(!groups.has(key)) groups.set(key,{geometry:mesh.geometry,material:mesh.material,sourceMeshIndex,layer,mirrored,transparent,items:[]});
    groups.get(key).items.push({matrix:mesh.matrixWorld.clone(),sourceIndex,sourceNodeIndex:mesh.userData.sourceNodeIndex,sourceName:mesh.name,sourceInstance:mesh.userData.sourceInstance});
    const n=(mesh.geometry.index?.count || mesh.geometry.attributes.position.count)/3;
    triangles+=n;sourceMeshes++;
    if(!mesh.geometry.boundingBox)mesh.geometry.computeBoundingBox();
    bounds.union(mesh.geometry.boundingBox.clone().applyMatrix4(mesh.matrixWorld));
  });
  if(!enumeration) throw new Error('Model tidak memiliki geometri yang bisa ditampilkan.');
  const batches=[];let splitBatches=0;
  for(const batch of groups.values()){
    const count=batch.items.length,trianglesPerInstance=(batch.geometry.index?.count||batch.geometry.attributes.position.count)/3;
    if(!options.spatial||batch.transparent||count<2||trianglesPerInstance*count<10000){batches.push(batch);continue;}
    const centerBounds=new THREE.Box3(),centers=[];let maxExtent=0;
    for(const item of batch.items){const box=batch.geometry.boundingBox.clone().applyMatrix4(item.matrix),center=box.getCenter(new THREE.Vector3()),size=box.getSize(new THREE.Vector3());centers.push(center);centerBounds.expandByPoint(center);maxExtent=Math.max(maxExtent,size.x,size.y,size.z);}
    const span=centerBounds.getSize(new THREE.Vector3());
    if(maxExtent>16||Math.max(span.x,span.z)<12){batches.push(batch);continue;}
    const bins=new Map();batch.items.forEach((item,i)=>{const c=centers[i],key=`${Math.floor(c.x/12)},${Math.floor(c.y/4)},${Math.floor(c.z/12)}`;if(!bins.has(key))bins.set(key,[]);bins.get(key).push(item);});
    if(bins.size>1)splitBatches++;for(const items of bins.values())batches.push({...batch,items});
  }
  const reflected=new Map();let done=0;
  for(const batch of batches) {
    let geometry=batch.geometry;
    if(batch.mirrored) {
      if(!reflected.has(geometry.uuid)) reflected.set(geometry.uuid,reflectedGeometry(geometry));
      geometry=reflected.get(geometry.uuid);
    }
    if(!layers.has(batch.layer)) {const group=new THREE.Group();group.name=batch.layer;root.add(group);layers.set(batch.layer,{group,count:0});}
    const layer=layers.get(batch.layer);layer.count+=batch.items.length;
    if(batch.mirrored)batch.items.forEach(item=>item.matrix.multiply(reflection));
    geometry=geometryForBatch(geometry,batch.items);
    (Array.isArray(batch.material)?batch.material:[batch.material]).forEach(exactInstanceNormals);
    const out=new THREE.InstancedMesh(geometry,batch.material,batch.items.length);
    out.name=batch.layer;
    out.userData.sourceIndices=batch.items.map(x=>x.sourceIndex);out.userData.sourceNodeIndices=batch.items.map(x=>x.sourceNodeIndex);out.userData.sourceMeshIndex=batch.sourceMeshIndex;out.userData.reflected=batch.mirrored;
    if(options.retainGeometryFor?.has(batch.sourceMeshIndex)){out.userData.sourceNames=batch.items.map(x=>x.sourceName);out.userData.sourceInstances=batch.items.map(x=>x.sourceInstance);const original=new THREE.BufferGeometry();for(const [name,attribute]of Object.entries(batch.geometry.attributes))original.setAttribute(name,attribute);original.setIndex(batch.geometry.index);original.groups=batch.geometry.groups.map(g=>({...g}));original.boundingBox=batch.geometry.boundingBox?.clone();original.boundingSphere=batch.geometry.boundingSphere?.clone();retainedSourceGeometry.set(out,original);}
    batch.items.forEach(({matrix},i)=>out.setMatrixAt(i,matrix));
    out.instanceMatrix.needsUpdate=true;out.computeBoundingBox();out.boundingSphere=out.boundingBox.getBoundingSphere(new THREE.Sphere());
    layer.group.add(out);
    done++;
    if(done%80===0){onProgress(done/batches.length);await new Promise(resolve=>setTimeout(resolve,0));}
  }
  root.updateMatrixWorld(true); onProgress(1);
  return {root,layers,bounds,stats:{sourceMeshes,triangles,instances:sourceMeshes,drawGroups:batches.length,spatiallySplitBatches:splitBatches,layers:layers.size}};
}

export function restoreSourceMatrices(gltf,json) {
 for(const [object,association] of gltf.parser.associations) {
  const source=json.nodes?.[association.nodes];
  if(object.isObject3D&&Number.isInteger(association.meshes))object.userData.sourceMeshIndex=association.meshes;
  if(object.isObject3D&&Number.isInteger(source?.mesh))object.userData.sourceMeshIndex=source.mesh;
  if(object.isObject3D&&Number.isInteger(association.nodes))object.userData.sourceNodeIndex=association.nodes;
  if(source?.matrix&&object.isObject3D) {object.matrix.fromArray(source.matrix);object.matrixAutoUpdate=false;object.matrixWorldNeedsUpdate=true;}
 }
}

export function syncBatches(prepared,sourceScene) {
 sourceScene.updateMatrixWorld(true);const meshes=[];sourceScene.traverse(o=>{if(o.isMesh&&!o.isSkinnedMesh)meshes.push(o);});
 const matrix=new THREE.Matrix4(),normal=new THREE.Matrix3();
 prepared.root.traverse(batch=>{if(!batch.isInstancedMesh)return;for(let i=0;i<batch.count;i++){const source=meshes[batch.userData.sourceIndices[i]];if(!source)throw new Error('Sumber animasi tidak cocok dengan batch.');matrix.copy(source.matrixWorld);if(batch.userData.reflected)matrix.multiply(reflection);batch.setMatrixAt(i,matrix);const values=normal.getNormalMatrix(matrix).elements;for(let c=0;c<3;c++)batch.geometry.attributes['instanceNormal'+c].setXYZ(i,values[c*3],values[c*3+1],values[c*3+2]);}
 batch.instanceMatrix.needsUpdate=true;for(let c=0;c<3;c++)batch.geometry.attributes['instanceNormal'+c].needsUpdate=true;batch.computeBoundingBox();batch.boundingSphere=batch.boundingBox.getBoundingSphere(new THREE.Sphere());});
}

// The prepared static subtree has immutable world transforms. Visibility and geometry
// indices may still change; animated openings and navigation live in separate roots.
export function freezeStaticTransforms(root){root.updateMatrixWorld(true);root.traverse(object=>{object.matrixAutoUpdate=false;object.matrixWorldAutoUpdate=false;});}
