import * as T from './vendor/three.module.js?v=mono-20261009-v12';
import {geometryDigest} from './floor-repair.js?v=mono-20261009-v12';
import {installBakedDiffuse,loadBoundedTexture} from './floor-lightmap.js?v=mono-20261009-v12';

async function prepareSurface(scene,surface,tier){
 const expected=surface.variants?.[tier],encoding=surface.encoding;if(!expected)throw new Error('Missing wall geometry guards');
 const matches=[];scene.traverse(mesh=>{if(mesh.isMesh&&mesh.name===expected.nodeName)matches.push(mesh);});let mesh=matches[0];
 if(matches.length!==1||mesh.userData.sourceNodeIndex!==expected.sourceNodeIndex||String(mesh.userData.sourceInstance)!==String(expected.sourceInstance)||mesh.userData.sourceLayer!==expected.sourceLayer||Array.isArray(mesh.material)||![T.FrontSide,T.DoubleSide].includes(expected.expectedMaterialSide)||mesh.material.side!==expected.expectedMaterialSide||mesh.material.userData.sourceMaterialIndex!==expected.sourceMaterialIndex)throw new Error('Wall placement identity mismatch');
 const source=mesh.geometry;if(source.groups.length||source.attributes.position.count!==expected.vertexCount||source.index?.count!==expected.indexCount||mesh.matrixWorld.elements.some((v,i)=>Math.abs(v-expected.matrixWorldColumnMajor[i])>1e-10))throw new Error('Wall geometry shape or transform mismatch');
 const digest=await geometryDigest(source);for(const key of Object.keys(digest))if(digest[key]!==expected[key])throw new Error('Wall decoded geometry hash mismatch');
 if(encoding?.resolution?.length!==2||encoding.resolution.some(n=>n!==1024)||encoding.threeTextureChannel!==1||encoding.threeLightMapIntensity!==Math.PI*encoding.radianceScale)throw new Error('Wall lightmap encoding mismatch');
 const uv=expected.uv1;if(!Array.isArray(uv)||uv.length!==source.attributes.position.count*2||uv.some(v=>!Number.isFinite(v)||v<0||v>1))throw new Error('Wall lightmap UV mismatch');
 const selected=new Set(expected.selectedTriangles);if(!selected.size||selected.size!==expected.selectedTriangles.length)throw new Error('Wall triangle mapping mismatch');
 const vertices=[new T.Vector3(),new T.Vector3(),new T.Vector3()],normal=new T.Vector3(),edge=new T.Vector3();
 for(const triangle of selected){if(!Number.isInteger(triangle)||triangle<0||triangle*3+2>=source.index.count)throw new Error('Wall triangle out of bounds');vertices.forEach((v,i)=>v.fromBufferAttribute(source.attributes.position,source.index.getX(triangle*3+i)).applyMatrix4(mesh.matrixWorld));normal.subVectors(vertices[1],vertices[0]).cross(edge.subVectors(vertices[2],vertices[0])).normalize();if(normal.x>-.999)throw new Error('Wall inward normal mismatch');}
 const geometry=source.clone(),originalMaterial=mesh.material,material=originalMaterial.clone();material.userData={...originalMaterial.userData,interiorWallBake:surface.id};installBakedDiffuse(material);geometry.setAttribute('uv1',new T.BufferAttribute(new Float32Array(uv),2));geometry.clearGroups();
 let start=0,last=selected.has(0)?0:1;for(let triangle=1;triangle<=source.index.count/3;triangle++){const next=selected.has(triangle)?0:1;if(triangle===source.index.count/3||next!==last){geometry.addGroup(start*3,(triangle-start)*3,last);start=triangle;last=next;}}
 mesh.geometry=geometry;mesh.material=[material,originalMaterial];matches.length=0;mesh=null;scene=null;
 let texture=null,pending=null,enabled=false,disposed=false,generation=0;
 function setEnabled(value){enabled=!!value&&!!texture&&!disposed;const map=enabled?texture:null;if(material.lightMap!==map){material.lightMap=map;material.lightMapIntensity=encoding.threeLightMapIntensity;material.needsUpdate=true;}}
 async function ensureTexture(loader){if(disposed)return false;if(texture)return true;if(!pending){const token=generation;pending=loadBoundedTexture(loader,surface.url).then(map=>{if(disposed||token!==generation){map.dispose();return false;}map.colorSpace=T.SRGBColorSpace;map.flipY=true;map.channel=1;map.wrapS=map.wrapT=T.ClampToEdgeWrapping;map.minFilter=T.LinearMipmapLinearFilter;map.magFilter=T.LinearFilter;map.generateMipmaps=true;map.needsUpdate=true;texture=map;return true;}).catch(error=>{if(token===generation)pending=null;throw error;});}return pending;}
 return {material,triangles:selected.size,textureBytes:encoding.pngBytes,setEnabled,ensureTexture,isEnabled:()=>enabled,releaseTexture(){setEnabled(false);generation++;texture?.dispose();texture=null;pending=null;},dispose(){if(disposed)return;setEnabled(false);disposed=true;texture?.dispose();material.dispose();geometry.dispose();}};
}
export async function prepareWallLightmaps(sourceScene,config,tier){
 const surfaces=[],reasons=[];sourceScene.updateMatrixWorld(true);
 if(config?.verified)for(const surface of (config.surfaces||[]).slice(0,2)){try{surfaces.push(await prepareSurface(sourceScene,surface,tier));}catch(error){reasons.push(surface.id+': '+error.message);}}
 let disposed=false;
 return {available:surfaces.length>0,reasons,materials:surfaces.map(s=>s.material),stats:{surfaces:surfaces.length,triangles:surfaces.reduce((n,s)=>n+s.triangles,0),textureBytes:surfaces.reduce((n,s)=>n+s.textureBytes,0),estimatedGpuMiB:surfaces.length*1024*1024*4*4/3/1048576},
  async ensureTextures(loader=new T.TextureLoader()){for(const surface of surfaces){if(disposed)return false;await surface.ensureTexture(loader);}return !disposed;},
  setPresentation(requested,time,materials){for(const surface of surfaces)surface.setEnabled(!disposed&&requested&&time==='interior'&&materials==='pbr');},
  isEnabled:()=>surfaces.some(s=>s.isEnabled()),releaseTextures(){for(const surface of surfaces)surface.releaseTexture();},dispose(){if(disposed)return;disposed=true;for(const surface of surfaces)surface.dispose();},
 };
}
