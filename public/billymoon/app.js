import {fetchModelPayload} from './model-transfer.js';
import * as THREE from './vendor/three.module.js';
import { OrbitControls } from './vendor/OrbitControls.js';
import { GLTFLoader } from './vendor/GLTFLoader.js';
import { MeshoptDecoder } from './vendor/meshopt_decoder.module.js';
import { buildBatches, restoreSourceMatrices, syncBatches } from './model.js';
import { cameraPose, updateDepthRange } from './camera.js';
import { fetchManifest, fetchOptionalManifest, shaderHealth, decodePayload, setPresentationControlsBusy } from './runtime.js';
import { createPresentation } from './presentation.js';
import { restoreSourceCutouts } from './source-materials.js';
import {createOpenings} from './openings.js';
import {createExploration,snapshotNavigationSource,restoreNavigationLayers} from './exploration.js';
import {prepareMaterials,createFixtureLights} from './materials.js';
import {renderSize} from './resolution.js';
import {prepareSurfaceDetails} from './surface-details.js';
import {createDecor} from './decor.js';
import {interiorCameraPose,createInteriorFill} from './interior-view.js';
import {prepareFloorRepair} from './floor-repair.js';
import {prepareFloorLightmap} from './floor-lightmap.js';
import {createRenderReference} from './render-reference.js';

const $=id=>document.getElementById(id);
const mobile=()=>matchMedia('(max-width:760px)').matches;
let renderer,camera,controls,scene,prepared,currentView='iso',framePending=false,ready=false,lightMode='day';
let presentation,graphicsMode='light',assertShaderHealthy=()=>{};
let surfaceDetails,decor,decorData,detailMode='on',detailIndex=0,floorRepair,interiorFill,floorBake,bakeRequested=false,referenceOpen=false;
let animatedBatches,exploration,openings,materialController,fixtureRig,materialsMode='pbr',resolutionMode='auto',lastFrame=0,dirty=true;
const loadState={phase:'loading',loaded:0,total:0};
window.__billymoon={state:loadState};
function setProgress(value,title,detail){$('progress').style.width=`${Math.min(100,value)}%`;$('load-title').textContent=title;$('load-detail').textContent=detail;}
function fail(error){ready=false;loadState.phase='error';$('loading').hidden=true;$('error').hidden=false;$('error-detail').textContent=error.message||'Model belum bisa dimuat. Periksa koneksi dan coba lagi.';console.error('BILLYMOON:',error);}
function setPanel(open){$('panel-content').hidden=!open;$('settings').classList.toggle('collapsed',!open);$('panel-toggle').setAttribute('aria-expanded',String(open));$('panel-icon').textContent=open?'−':'+';document.querySelector('.view-caption').classList.toggle('covered',open&&mobile());}
$('panel-toggle').addEventListener('click',()=>setPanel($('panel-content').hidden));
$('info').addEventListener('click',()=>{exploration?.clear();$('details').showModal();});
$('close-info').addEventListener('click',()=>$('details').close());
$('retry').addEventListener('click',()=>location.reload());
$('fullscreen').addEventListener('click',async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else await document.documentElement.requestFullscreen();}catch{$('model-status').textContent='Layar penuh tidak tersedia di browser ini.';}});
setPanel(!mobile());
createRenderReference({dialog:$('render-reference'),image:$('reference-image'),status:$('reference-status'),openButtons:[$('open-render'),$('loading-render'),$('error-render')],closeButton:$('close-render'),visitButton:$('visit-render-camera'),onOpen(){referenceOpen=true;exploration?.clear();lastFrame=0;},onClose(){referenceOpen=false;lastFrame=0;requestRender();},onVisit(){if(ready)applyView('interior');}});


async function fetchBytes(url,expected,onChunk){
 const controller=new AbortController();let timer;
 const arm=()=>{clearTimeout(timer);timer=setTimeout(()=>controller.abort(),60000);};
 try{arm();const response=await fetch(url,{signal:controller.signal});if(!response.ok)throw new Error(`Berkas model tidak tersedia (${response.status}).`);
  const reader=response.body?.getReader();if(!reader){const b=await response.arrayBuffer();if(b.byteLength!==expected)throw new Error('Berkas model tidak lengkap. Silakan coba lagi.');onChunk(b.byteLength);return b;}
  const bytes=new Uint8Array(expected);let offset=0;
  while(true){arm();const {done,value}=await reader.read();if(done)break;if(offset+value.byteLength>expected)throw new Error('Ukuran berkas model berubah. Muat ulang halaman.');bytes.set(value,offset);offset+=value.byteLength;onChunk(value.byteLength);}
  if(offset!==expected)throw new Error('Koneksi terputus sebelum model selesai dimuat.');return bytes.buffer;
 }catch(e){if(e.name==='AbortError')throw new Error('Koneksi terlalu lama tidak merespons. Periksa jaringan, lalu coba lagi.');throw e;}finally{clearTimeout(timer);}
}
async function loadModel(){
 const detail=new URLSearchParams(location.search).get('detail')==='1';
 const assetBase=detail?'./model/':'./model-light/';
 const manifest=await fetchManifest(assetBase+'manifest.json');
 $('model-tier').value=detail?'detail':'light';
 const files=manifest.files;loadState.total=manifest.bytes;const data=new Map();let next=0;
 const tick=bytes=>{loadState.loaded+=bytes;setProgress(76*loadState.loaded/loadState.total,'Membuka BILLYMOON',`${(loadState.loaded/1e6).toFixed(1)} / ${(loadState.total/1e6).toFixed(1)} MB`);};
 async function worker(){while(next<files.length){const file=files[next++];const encoded=await fetchModelPayload(file,new URL(assetBase,location.href),fetchBytes,tick);data.set(file.logicalName||file.name,await decodePayload(encoded,file));}}
 await Promise.all(Array.from({length:2},worker));
 setProgress(79,'Menyiapkan material','Memproses geometri dan tekstur');await new Promise(r=>setTimeout(r,30));
 const json=JSON.parse(new TextDecoder().decode(data.get(manifest.entry)));data.delete(manifest.entry);
 const urls=[];
 for(const buffer of json.buffers||[]) if(buffer.uri){const bytes=data.get(buffer.uri);if(!bytes)throw new Error('Salah satu bagian model tidak ditemukan.');const url=URL.createObjectURL(new Blob([bytes]));urls.push(url);data.delete(buffer.uri);buffer.uri=url;}
 for(const img of json.images||[]) if(img.uri&&!img.uri.startsWith('data:')){const bytes=data.get(img.uri);if(!bytes)throw new Error('Tekstur model tidak ditemukan.');const url=URL.createObjectURL(new Blob([bytes]));urls.push(url);data.delete(img.uri);img.uri=url;}
 try{const loader=new GLTFLoader();loader.setMeshoptDecoder(MeshoptDecoder);const gltf=await loader.parseAsync(JSON.stringify(json),'');restoreSourceMatrices(gltf,json);restoreSourceCutouts(gltf);return {gltf,manifest};}finally{urls.forEach(URL.revokeObjectURL);data.clear();}
}
function requestRender(force=true){if(!ready||document.hidden||referenceOpen)return;if(force)dirty=true;if(framePending)return;framePending=true;requestAnimationFrame(drawFrame);}
function drawFrame(time){framePending=false;if(!ready||document.hidden||referenceOpen){lastFrame=0;return;}const dt=lastFrame?Math.min(.1,(time-lastFrame)/1000):1/60;lastFrame=time;
 const state=exploration?.tick(dt)||{changed:false,active:false,shadowDirty:false};if(exploration?.getMode()!=='first'&&exploration?.getMode()!=='third')controls.update();
 if(state.motionChanged&&animatedBatches)syncBatches(animatedBatches,openings.root);
 if(state.shadowDirty)presentation?.refreshShadows();
 if(dirty||state.changed||state.shadowDirty){updateDepthRange(camera,prepared.bounds);try{renderer.render(scene,camera);assertShaderHealthy();}catch(error){fail(error);return;}window.__billymoon.renderCalls=renderer.info.render.calls;window.__billymoon.exploration=exploration?.inspect();dirty=false;}
 if(state.active)requestRender(false);else lastFrame=0;
}
function resize(){if(!renderer)return;const w=innerWidth,h=innerHeight;const max=renderer.capabilities.maxTextureSize||4096;const size=renderSize(w,h,devicePixelRatio||1,max,resolutionMode);renderer.setPixelRatio(size.ratio);renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();$('resolution-note').textContent=`${size.width} × ${size.height} px · tekstur mengikuti model`;requestRender();}
function applyView(view){if(!prepared)return;if(exploration?.getMode()!=='orbit')exploration?.exit();currentView=view;
 if(view==='interior'){const p=interiorCameraPose();camera.position.copy(p.position);camera.up.set(0,1,0);camera.fov=p.fov;controls.target.copy(p.target);setLight('interior');}
 else{camera.fov=40;const p=cameraPose(prepared.bounds,camera.aspect,view);camera.position.copy(p.position);camera.up.copy(p.up);camera.near=p.near;camera.far=p.far;controls.target.copy(p.target);}
 camera.updateProjectionMatrix();controls.update();$('view').value=view;
 const labels={iso:['01','Keseluruhan tapak','Isometrik'],front:['02','Tampak depan','Arah fasad model sumber'],top:['03','Tampak atas','Keseluruhan tapak'],interior:['04','Interior kafe','Sudut opsi 2 · tampilan real-time']};const values=labels[view];$('view-number').textContent=values[0];$('view-title').textContent=values[1];$('view-note').textContent=values[2];if(view==='interior'&&mobile())setPanel(false);requestRender();}
function applyFloorPresentation(){const active=lightMode==='interior'&&materialsMode==='pbr';floorRepair?.setEnabled(active);floorBake?.setPresentation(bakeRequested,lightMode,materialsMode);$('floor-bake').disabled=!ready||!active||!floorBake?.available;window.__billymoon.floorBake={available:!!floorBake?.available,enabled:!!floorBake?.isEnabled()};if(prepared)window.__billymoon.floorRepair={available:!!floorRepair?.available,enabled:!!floorRepair?.isEnabled(),removedTriangles:floorRepair?.isEnabled()?floorRepair.removedTriangles:0};}

let ambient,key,fill;
function setLight(mode){lightMode=mode;const night=mode==='night',dusk=mode==='dusk',interior=mode==='interior';document.body.classList.toggle('dusk',night||dusk);for(const id of ['day','dusk','night','interior'])$(id).setAttribute('aria-pressed',String(mode===id));
 if(scene){scene.background=new THREE.Color(night?0x101c2c:dusk?0x182a34:interior?0xe5ded2:0xdce6e5);ambient.color.set(night?0xa3b5d4:dusk?0x91afd2:interior?0xffead0:0xe9f2fa);ambient.groundColor.set(night?0x353b43:dusk?0x424451:interior?0xb7a997:0xa6b3a4);ambient.intensity=night?.25:dusk?1.45:2.1;key.color.set(night?0x9eb7dc:dusk?0xffbe86:interior?0xffe3bd:0xfff4df);key.intensity=night?.15:dusk?2.4:2.9;fill.intensity=night?.1:dusk?.55:1;renderer.toneMappingExposure=night?1:dusk?1.05:1;fixtureRig?.setEnabled(night||interior,interior?.55:1);interiorFill?.setEnabled(interior);applyFloorPresentation();presentation?.apply(graphicsMode,mode,materialsMode==='pbr');requestRender();}}
for(const id of ['day','dusk','night','interior'])$(id).addEventListener('click',()=>setLight(id));
$('view').addEventListener('change',e=>applyView(e.target.value));$('reset').addEventListener('click',()=>applyView('iso'));
function restoreLayers(){restoreNavigationLayers(prepared,openings,animatedBatches,document.querySelectorAll('.layer-row input'));presentation?.refreshShadows();requestRender();}
$('show-all').addEventListener('click',()=>{exploration?.exit();restoreLayers();});
function createLayers(){const container=$('layer-list');container.replaceChildren();const sorted=[...prepared.layers.entries()].sort((a,b)=>a[0]==='Layer0'?-1:b[0]==='Layer0'?1:a[0].localeCompare(b[0]));
 for(const [name,layer] of sorted){const label=document.createElement('label');label.className='layer-row';const text=document.createElement('span');text.className='layer-name';text.textContent=name;const count=document.createElement('span');count.className='layer-count';count.textContent=`${layer.count.toLocaleString('id-ID')} objek`;text.append(count);const input=document.createElement('input');input.type='checkbox';input.checked=true;input.setAttribute('aria-label',`Tampilkan layer ${name}`);input.addEventListener('change',()=>{exploration?.exit();layer.group.visible=input.checked;openings?.setLayerVisible(name,input.checked);if(animatedBatches?.layers.has(name))animatedBatches.layers.get(name).group.visible=input.checked;presentation?.refreshShadows();requestRender();});label.append(text,input);container.append(label);}
 $('info-layers').textContent=`${prepared.layers.size} layer terpakai`;}
$('scene').addEventListener('keydown',e=>{if(!ready||(exploration&&exploration.getMode()!=='orbit'))return;if(e.key==='Home'){e.preventDefault();applyView('iso');return;}
 const offset=camera.position.clone().sub(controls.target);
 if(e.key==='+'||e.key==='='||e.key==='-'){e.preventDefault();offset.multiplyScalar(e.key==='-'?1.15:1/1.15);camera.position.copy(controls.target).add(offset);controls.update();requestRender();return;}
 if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key))return;e.preventDefault();
 if(e.shiftKey){const right=new THREE.Vector3().setFromMatrixColumn(camera.matrix,0),up=new THREE.Vector3().setFromMatrixColumn(camera.matrix,1);const delta=(e.key.includes('Left')||e.key.includes('Right')?right:up).multiplyScalar(offset.length()*.035*(e.key==='ArrowLeft'||e.key==='ArrowDown'?-1:1));camera.position.add(delta);controls.target.add(delta);}
 else {const s=new THREE.Spherical().setFromVector3(offset);s.theta+=(e.key==='ArrowLeft'?.08:e.key==='ArrowRight'?-.08:0);s.phi+=(e.key==='ArrowUp'?-.08:e.key==='ArrowDown'?.08:0);s.makeSafe();camera.up.set(0,1,0);camera.position.copy(controls.target).add(new THREE.Vector3().setFromSpherical(s));}
 controls.update();requestRender();});
window.addEventListener('resize',()=>{resize();document.querySelector('.view-caption').classList.toggle('covered',!$('panel-content').hidden&&mobile());});
document.addEventListener('visibilitychange',()=>{lastFrame=0;if(!document.hidden)requestRender();});
window.addEventListener('blur',()=>{lastFrame=0;});
$('scene').addEventListener('webglcontextlost',e=>{e.preventDefault();fail(new Error('Konteks grafis terhenti. Tutup tab lain jika memori penuh, lalu coba lagi.'));});

async function init(){
 try{renderer=new THREE.WebGLRenderer({canvas:$('scene'),antialias:true,powerPreference:'high-performance',alpha:false});}catch{throw new Error('Browser ini belum dapat membuka WebGL 2. Aktifkan akselerasi grafis atau gunakan browser lain.');}
 assertShaderHealthy=shaderHealth(renderer,error=>{if(ready)fail(error);});
 renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.shadowMap.enabled=false;
 scene=new THREE.Scene();camera=new THREE.PerspectiveCamera(40,innerWidth/innerHeight,.02,3000);controls=new OrbitControls(camera,$('scene'));controls.enableDamping=false;controls.minDistance=.5;controls.maxDistance=2000;controls.maxPolarAngle=Math.PI*.98;controls.addEventListener('change',requestRender);
 ambient=new THREE.HemisphereLight();key=new THREE.DirectionalLight();key.position.set(100,130,80);fill=new THREE.DirectionalLight(0xc1daf2);fill.position.set(-100,70,-90);scene.add(ambient,key,fill);setLight(lightMode);resize();
 const {gltf,manifest}=await loadModel();$('info-geometry').textContent=`${(manifest.triangles/1e6).toFixed(2)} juta segitiga · ${manifest.quality==='light'?'model ringan':'detail asli'}`;
 const [openingMap,navigationMap,pbrData,detailData,floorData,bakeData]=await Promise.all([fetchManifest('./openings-data.json'),fetchManifest('./navigation-data.json'),fetchManifest('./pbr-data.json'),fetchManifest('./decor-data.json'),fetchOptionalManifest('./floor-repair-data.json'),fetchOptionalManifest('./floor-lightmap-data.json')]);
 floorRepair=await prepareFloorRepair(gltf.scene,floorData?.variants?.[manifest.quality==='light'?'model-light':'model']);
 floorBake=await prepareFloorLightmap(gltf.scene,floorData?.variants?.[manifest.quality==='light'?'model-light':'model'],{...(bakeData||{}),verified:!!bakeData?.verified&&floorRepair.available});
 decorData=detailData;decor=createDecor(decorData.placements);
 materialController=prepareMaterials(gltf.scene,pbrData);materialController.apply(true);surfaceDetails=prepareSurfaceDetails(gltf.scene);surfaceDetails.setEnabled(true);
 openings=createOpenings({sourceScene:gltf.scene,openingMap,onStatus:message=>$('walk-status').textContent=message});
 const navigationSource=snapshotNavigationSource(gltf.scene,navigationMap);
 setProgress(86,'Menyusun tampilan','Mengatur objek dan bukaan');
 prepared=await buildBatches(gltf.scene,p=>setProgress(86+p*10,'Menyusun tampilan',`${Math.round(p*100)}% objek siap`),{excludeNames:openings.dynamicNames,spatial:true});
 prepared.stats.staticMeshes=prepared.stats.sourceMeshes;prepared.stats.dynamicMeshes=openings.meshCount;prepared.stats.sourceMeshes+=openings.meshCount;prepared.stats.triangles+=openings.triangles;prepared.stats.instances+=openings.meshCount;
 if(prepared.stats.triangles!==manifest.triangles||prepared.stats.sourceMeshes!==manifest.placedMeshes)throw new Error('Pemeriksaan kelengkapan model gagal. Coba muat ulang.');
 for(const [name,count]of openings.getLayerCounts()){if(!prepared.layers.has(name)){const group=new THREE.Group();prepared.root.add(group);prepared.layers.set(name,{group,count:0});}prepared.layers.get(name).count+=count;}
 animatedBatches=await buildBatches(openings.root);floorRepair.bindBatches(prepared.root);
 const displayRoot=new THREE.Group();displayRoot.add(prepared.root,animatedBatches.root,decor.root);scene.add(displayRoot);
 presentation=createPresentation(renderer,scene,displayRoot,prepared.bounds,{ambient,key,fill});fixtureRig=createFixtureLights(scene,pbrData.night);interiorFill=createInteriorFill(scene);
 exploration=createExploration({scene,camera,controls,canvas:$('scene'),sourceScene:navigationSource,navigationMap,openings,decor,wake:requestRender,beforeEnter:restoreLayers,onModeChange:mode=>{if(mode!=='orbit')setPanel(false);requestRender();}});
 createLayers();applyView('iso');setLight(lightMode);setProgress(99,'Menampilkan model','Menyiapkan tampilan pertama');
 // Compile once, then draw the complete model before dismissing the loader.
 await renderer.compileAsync(scene,camera);assertShaderHealthy();renderer.render(scene,camera);assertShaderHealthy();ready=true;
 $('loading').hidden=true;document.body.classList.add('ready');$('view').disabled=false;$('visit-render-camera').disabled=false;$('reset').disabled=false;$('show-all').disabled=false;$('graphics').disabled=false;$('model-tier').disabled=false;$('walk-mode').disabled=false;$('materials').disabled=false;$('resolution').disabled=false;$('detail-additions').disabled=false;$('detail-focus').disabled=false;$('detail-note').textContent='3 area furnitur konsep · detail permukaan saat PBR aktif';
 applyFloorPresentation();$('model-status').textContent=`${prepared.layers.size} layer · ${prepared.stats.sourceMeshes.toLocaleString('id-ID')} objek`;loadState.phase='ready';
 Object.assign(window.__billymoon,{additions:{furniture:decor.stats,surface:surfaceDetails.stats},stats:prepared.stats,renderCalls:renderer.info.render.calls,bounds:{min:prepared.bounds.min.toArray(),max:prepared.bounds.max.toArray()},layerNames:[...prepared.layers.keys()]});requestRender();
}
function presentationBusy(busy){setPresentationControlsBusy([$('graphics'),$('materials'),$('detail-additions')],busy);$('detail-focus').disabled=busy||detailMode==='off';$('visit-render-camera').disabled=busy||!ready;$('floor-bake').disabled=busy||!ready||lightMode!=='interior'||materialsMode!=='pbr'||!floorBake?.available;}
$('graphics').addEventListener('change',async event=>{
 if(!ready){event.target.value=graphicsMode;return;}const mode=event.target.value;ready=false;loadState.phase='updating';presentationBusy(true);$('graphics-note').textContent='Menyiapkan pencahayaan…';
 try{await new Promise(resolve=>setTimeout(resolve,30));graphicsMode=mode;presentation.apply(mode,lightMode,materialsMode==='pbr');await renderer.compileAsync(scene,camera);assertShaderHealthy();renderer.render(scene,camera);assertShaderHealthy();ready=true;loadState.phase='ready';$('graphics-note').textContent=mode==='cinematic'?'Bayangan lembut · pantulan lingkungan':'Tampilan ringan · tanpa bayangan tambahan';window.__billymoon.graphics=mode;requestRender();}
 catch(error){fail(new Error('Mode grafik belum berhasil ditampilkan. Coba lagi untuk membuka mode Ringan. '+error.message));}
 finally{presentationBusy(false);}
});
$('model-tier').addEventListener('change',event=>{const url=new URL(location.href);if(event.target.value==='detail')url.searchParams.set('detail','1');else url.searchParams.delete('detail');location.href=url.href;});
$('materials').addEventListener('change',async event=>{if(!ready){event.target.value=materialsMode;return;}ready=false;materialsMode=event.target.value;presentationBusy(true);try{materialController.apply(materialsMode==='pbr');applyFloorPresentation();surfaceDetails.setEnabled(detailMode==='on'&&materialsMode==='pbr');presentation.apply(graphicsMode,lightMode,materialsMode==='pbr');await renderer.compileAsync(scene,camera);assertShaderHealthy();renderer.render(scene,camera);assertShaderHealthy();ready=true;requestRender();}catch(error){fail(error);}finally{presentationBusy(false);}});
$('detail-additions').addEventListener('change',async event=>{if(!ready){event.target.value=detailMode;return;}ready=false;detailMode=event.target.value;presentationBusy(true);exploration?.exit();exploration?.resetEntry();try{decor.setEnabled(detailMode==='on');surfaceDetails.setEnabled(detailMode==='on'&&materialsMode==='pbr');presentation.refreshShadows();await renderer.compileAsync(scene,camera);assertShaderHealthy();renderer.render(scene,camera);assertShaderHealthy();ready=true;$('detail-note').textContent=detailMode==='on'?'3 area furnitur konsep · detail permukaan saat PBR aktif':'Tambahan disembunyikan · titik jelajah kembali ke awal';requestRender();}catch(error){fail(error);}finally{presentationBusy(false);}});
$('detail-focus').addEventListener('click',()=>{if(!ready||detailMode==='off')return;exploration?.exit();const p=decorData.placements[detailIndex++%decorData.placements.length];camera.position.fromArray(p.inspectionCamera);camera.up.set(0,1,0);camera.fov=55;camera.updateProjectionMatrix();controls.target.fromArray(p.inspectionTarget);controls.update();$('view').value='detail';$('view-number').textContent='DETAIL';$('view-title').textContent=p.label;$('view-note').textContent='Furnitur tambahan · klik lagi untuk area berikutnya';if(mobile())setPanel(false);requestRender();});
$('floor-bake').addEventListener('change',async event=>{
 if(!ready||!floorBake?.available){event.target.checked=bakeRequested;return;}
 bakeRequested=event.target.checked;ready=false;loadState.phase='updating';presentationBusy(true);$('floor-bake-note').textContent='Menyiapkan pantulan lantai…';
 try{
  if(bakeRequested)await floorBake.ensureTexture();
  applyFloorPresentation();await renderer.compileAsync(scene,camera);assertShaderHealthy();renderer.render(scene,camera);assertShaderHealthy();
  $('floor-bake-note').textContent='Pencahayaan statis · aktif hanya pada Interior + PBR.';
 }catch(error){
  bakeRequested=false;$('floor-bake').checked=false;floorBake.setPresentation(false,lightMode,materialsMode);
  assertShaderHealthy=shaderHealth(renderer,error=>{if(ready)fail(error);});
  try{await renderer.compileAsync(scene,camera);assertShaderHealthy();$('floor-bake-note').textContent='Cahaya tambahan belum tersedia; tampilan standar dipakai.';}
  catch(fallbackError){fail(fallbackError);}
 }finally{
  if(loadState.phase!=='error'){ready=true;loadState.phase='ready';applyFloorPresentation();presentationBusy(false);requestRender();}
 }
});
$('resolution').addEventListener('change',event=>{resolutionMode=event.target.value;resize();});
init().catch(fail);
