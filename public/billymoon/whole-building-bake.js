import * as T from './vendor/three.module.js?v=mono-20261009-v12';
import {sourceGeometryForBatch,reflectedGeometry} from './model.js?v=mono-20261009-v12';
import {geometryDigest} from './floor-repair.js?v=mono-20261009-v12';
import {loadBoundedTexture} from './floor-lightmap.js?v=mono-20261009-v12';
import {buildBakeGeometry,fetchVerifiedBinary} from './bake-geometry.js?v=mono-20261009-v12';
import {fetchManifest} from './runtime.js?v=mono-20261009-v12';
import {installWholeBakeShader} from './whole-bake-shader.js?v=mono-20261009-v12';
const reflection=new T.Matrix4().makeScale(-1,1,1);
export async function loadVerifiedBakeTexture(asset,{fetcher=fetch,loader=new T.TextureLoader()}={}){
 if(asset?.width!==1024||asset?.height!==1024||!Number.isInteger(asset.bytes)||asset.bytes<1||asset.bytes>1000000)throw new Error('Bake texture budget mismatch');
 const bytes=await fetchVerifiedBinary(asset,fetcher),url=URL.createObjectURL(new Blob([bytes],{type:'image/png'}));let texture;
 try{texture=await loadBoundedTexture(loader,url);const image=texture.image;if((image?.width||image?.naturalWidth)!==1024||(image?.height||image?.naturalHeight)!==1024)throw new Error('Bake texture dimensions mismatch');texture.colorSpace=T.SRGBColorSpace;texture.flipY=true;texture.generateMipmaps=false;texture.minFilter=texture.magFilter=T.LinearFilter;texture.wrapS=texture.wrapT=T.ClampToEdgeWrapping;texture.needsUpdate=true;return texture;}
 catch(error){texture?.dispose();throw error;}finally{URL.revokeObjectURL(url);}
}
export function validateBakePlacement(batch,index,instance,spec){
 if(!Array.isArray(instance.worldMatrixColumnMajor)||instance.worldMatrixColumnMajor.length!==16||instance.worldMatrixColumnMajor.some(v=>!Number.isFinite(v))||![-1,1].includes(instance.determinantSign))throw new Error('Bake source pose guard malformed');
 const {scaleU,scaleV,offsetU,offsetV}=instance;if(![scaleU,scaleV,offsetU,offsetV].every(Number.isFinite)||scaleU<=0||scaleV<=0||offsetU<0||offsetV<0||offsetU+scaleU>1||offsetV+scaleV>1)throw new Error('Bake atlas transform malformed');
 if(batch.userData.sourceMeshIndex!==instance.sourceMeshIndex||batch.userData.sourceNodeIndices[index]!==instance.sourceNodeIndex||batch.userData.sourceNames[index]!==instance.nodeName||String(batch.userData.sourceInstances[index])!==String(instance.sourceInstance))throw new Error('Bake instance identity mismatch');
 const materials=Array.isArray(batch.material)?batch.material:[batch.material];if(materials.some(m=>m.userData.sourceMaterialIndex!==instance.materialIndex||m.side!==(spec.sourceDoubleSided?T.DoubleSide:T.FrontSide)))throw new Error('Bake source material mismatch');
 const source=sourceGeometryForBatch(batch),actual=new T.Matrix4();batch.getMatrixAt(index,actual);if(batch.userData.reflected)actual.multiply(reflection);if(Math.sign(actual.determinant())!==instance.determinantSign)throw new Error('Bake determinant mismatch');
 const expected=new T.Matrix4().fromArray(instance.worldMatrixColumnMajor);source.computeBoundingBox();const b=source.boundingBox;
 for(const x of [b.min.x,b.max.x])for(const y of [b.min.y,b.max.y])for(const z of [b.min.z,b.max.z]){const p=new T.Vector3(x,y,z);if(p.clone().applyMatrix4(actual).distanceTo(p.applyMatrix4(expected))>.0002)throw new Error('Bake source pose mismatch');}
 return b.clone().applyMatrix4(expected);
}
export function correctedFloorIndex(geometry,nodeIndices){
 if(!nodeIndices.includes(4697))return geometry.index;if(nodeIndices.length!==1)throw new Error('Floor repair placement isolation mismatch');
 const order=geometry.userData.sourceTriangleOrder,indices=[];let removed=0;for(let i=0;i<order.length;i++){if(order[i]>=4&&order[i]<=13){removed++;continue;}for(let c=0;c<3;c++)indices.push(geometry.index.getX(i*3+c));}if(removed!==10)throw new Error('Floor repair composition mismatch');return new T.BufferAttribute(new Uint32Array(indices),1);
}
export function createWholeBuildingBake(root,bootstrap,tier,{fetcher=fetch,textureLoader=new T.TextureLoader(),wake=()=>{},onStatus=()=>{}}={}){
 let config=null,loaded=false,pending=null,enabled=false,disposed=false,generation=0,overview=null,detail=null,detailPage=-1,detailPending=null,lastSelection=0,lastPageRequest=-Infinity,failedPages=new Set();
 const originals=[],candidates=[],shared=[],records=[],uniforms={wholeOverview:{value:null},wholeDetail:{value:null},wholeDetailPage:{value:-1}};
 const available=!!bootstrap?.metadataUrl&&Array.isArray(bootstrap.geometryMeshIndices);
 function restore(){enabled=false;for(const record of records){record.batch.geometry=record.originalGeometry;record.batch.material=record.originalMaterial;}}
 function disposeTextures(){generation++;overview?.dispose();detail?.dispose();overview=detail=null;detailPage=-1;uniforms.wholeOverview.value=uniforms.wholeDetail.value=null;uniforms.wholeDetailPage.value=-1;}
 function disposeCandidates(){restore();for(const record of records)record.material.dispose();for(const geometry of candidates)geometry.dispose();for(const geometry of shared)geometry.dispose();records.length=candidates.length=shared.length=0;loaded=false;}
 async function build(config,buffer,token){
  const specs=new Map(config.geometries.map(g=>[g.id,g])),instances=new Map(config.instances.map(i=>[i.sourceNodeIndex,i])),pages=new Map(config.zones.map((z,i)=>[z.id,i])),built=new Map(),seen=new Set();let coveredTriangles=0;
  if(instances.size!==config.instances.length||specs.size!==config.geometries.length||pages.size!==config.zones.length)throw new Error('Duplicate bake metadata identity');
  const batches=[];root.traverse(b=>{if(b.isInstancedMesh&&b.userData.sourceNodeIndices?.some(n=>instances.has(n)))batches.push(b);});
  try{for(const batch of batches){const expected=batch.userData.sourceNodeIndices.map(n=>instances.get(n)),first=expected.find(Boolean),spec=specs.get(first.geometryId),source=sourceGeometryForBatch(batch);if(!source||expected.some(x=>x&&x.geometryId!==spec.id))throw new Error('Bake retained source mismatch');
   let base=built.get(spec.id);if(!base){const hash=await geometryDigest(source),guard=spec.sourceTierGuards;if(disposed||token!==generation)throw new Error('Bake binding cancelled');if(hash.canonicalPositionFloat32Sha256!==guard[tier+'CanonicalPositionSha256']||hash.canonicalIndexUint32Sha256!==guard[tier+'CanonicalIndexSha256'])throw new Error('Bake source geometry hash mismatch');base=buildBakeGeometry(source,spec,buffer);built.set(spec.id,base);shared.push(base);}
   const geometry=batch.userData.reflected?reflectedGeometry(base):base.clone();geometry.userData.sourceTriangleOrder=base.userData.sourceTriangleOrder;candidates.push(geometry);
   const transform=new Float32Array(batch.count*4),meta=new Float32Array(batch.count*2);for(let i=0;i<batch.count;i++){meta[i*2]=-1;const instance=expected[i];if(!instance)continue;if(seen.has(instance.sourceNodeIndex))throw new Error('Duplicate bake receiver');seen.add(instance.sourceNodeIndex);coveredTriangles+=spec.sourceTriangleCount;const bounds=validateBakePlacement(batch,i,instance,spec),page=pages.get(instance.zoneId),scale=config.zones[page]?.detail?.radianceScale;if(!Number.isInteger(page)||!Number.isFinite(scale)||scale<=0)throw new Error('Bake page calibration mismatch');transform.set([instance.scaleU,instance.scaleV,instance.offsetU,instance.offsetV],i*4);meta.set([page,scale],i*2);originals.push({bounds,page});}
   for(let c=0;c<3;c++)geometry.setAttribute('instanceNormal'+c,batch.geometry.attributes['instanceNormal'+c].clone());geometry.setAttribute('instanceBakeTransform',new T.InstancedBufferAttribute(transform,4));geometry.setAttribute('instanceBakeMeta',new T.InstancedBufferAttribute(meta,2));geometry.clearGroups();
   const sourceMaterial=Array.isArray(batch.material)?batch.material.at(-1):batch.material,material=sourceMaterial.clone();material.lightMap=null;installWholeBakeShader(material,uniforms);
   const fullIndex=geometry.index,repairedIndex=correctedFloorIndex(geometry,batch.userData.sourceNodeIndices);records.push({batch,geometry,material,sourceMaterial,originalGeometry:batch.geometry,originalMaterial:batch.material,fullIndex,repairedIndex});
  }if(seen.size!==config.coverage.placements||seen.size!==instances.size||coveredTriangles!==config.coverage.sourceTriangles)throw new Error('Incomplete whole-building receiver binding');}
  catch(error){originals.length=0;disposeCandidates();throw error;}
 }
 async function ensureLoaded(){
  if(disposed||!available)return false;if(loaded&&overview)return true;if(pending)return pending;const token=generation;
  pending=(async()=>{if(!config){config=await fetchManifest(bootstrap.metadataUrl,fetcher,15000);}
   if(!config.verified||config.zones?.length!==16||config.coverage?.placements!==1845||!config.overviewSheet||config.zones.some(z=>z.bakeStatus!=='verified'))throw new Error('Bake seluruh bangunan belum selesai diverifikasi.');
   if(!loaded){onStatus('Memeriksa geometri dan cakupan bake…');const buffer=await fetchVerifiedBinary(config.geometryBinary,fetcher);if(disposed||token!==generation)return false;await build(config,buffer,token);if(disposed||token!==generation){disposeCandidates();originals.length=0;return false;}loaded=true;}
   onStatus('Memuat pencahayaan seluruh bangunan…');const map=await loadVerifiedBakeTexture(config.overviewSheet,{fetcher,loader:textureLoader});if(disposed||token!==generation){map.dispose();return false;}overview=map;uniforms.wholeOverview.value=map;uniforms.wholeDetail.value=map;return true;
  })().catch(error=>{if(!loaded){config=null;disposeCandidates();}throw error;}).finally(()=>{pending=null;});return pending;
 }
 function setPresentation(requested,lighting,materials){const wanted=requested&&lighting==='interior'&&materials==='pbr'&&loaded&&overview&&!disposed;if(!wanted){restore();return false;}for(const r of records){r.material.copy(r.sourceMaterial);r.material.lightMap=null;r.material.needsUpdate=true;r.geometry.setIndex(r.repairedIndex);r.batch.geometry=r.geometry;r.batch.material=r.material;}enabled=true;return true;}
 function release(){restore();disposeTextures();disposeCandidates();originals.length=0;failedPages.clear();}
 function update(camera,now=performance.now()){
  if(!enabled||disposed||now-lastSelection<500||detailPending)return;lastSelection=now;
  const direction=new T.Vector3();camera.getWorldDirection(direction);let winner=-1,best=Infinity,currentScore=Infinity;
  for(const item of originals){const closest=item.bounds.clampPoint(camera.position,new T.Vector3()),v=closest.sub(camera.position),distance=v.length(),facing=distance<.05?1:v.normalize().dot(direction);if(facing<-.15)continue;const size=item.bounds.getSize(new T.Vector3()).length(),score=distance+(1-facing)*3+size*.035;if(item.page===detailPage)currentScore=Math.min(currentScore,score);if(score<best){best=score;winner=item.page;}}
  if(winner<0||winner===detailPage||failedPages.has(winner)||(detailPage>=0&&(best>currentScore*.7||now-lastPageRequest<2500)))return;lastPageRequest=now;const token=generation,page=winner;
  // Release the old detail before decoding the next page; transient residency stays bounded.
  detail?.dispose();detail=null;detailPage=-1;uniforms.wholeDetail.value=overview;uniforms.wholeDetailPage.value=-1;
  detailPending=loadVerifiedBakeTexture(config.zones[page].detail,{fetcher,loader:textureLoader}).then(map=>{if(disposed||!enabled||token!==generation){map.dispose();return;}detail=map;detailPage=page;uniforms.wholeDetail.value=map;uniforms.wholeDetailPage.value=page;wake();}).catch(()=>{if(token===generation){failedPages.add(page);onStatus('Cakupan lengkap aktif; detail zona memakai atlas ringkas.');}}).finally(()=>{detailPending=null;});
 }
 return {available,ensureLoaded,setPresentation,release,update,isEnabled:()=>enabled,inspect:()=>({available,loaded,enabled,placements:loaded?config.coverage.placements:0,sourceTriangles:loaded?config.coverage.sourceTriangles:0,detailPage:detailPage<0?null:config.zones[detailPage].id,residentTextureMiB:(overview?4:0)+(detail?4:0),drawCallDelta:0,removedFloorTriangles:enabled?10:0}),dispose(){if(disposed)return;release();disposeCandidates();originals.length=0;disposed=true;root=null;}};
}
