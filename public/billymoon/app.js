import {fetchModelPayload} from './model-transfer.js?v=drive-20261010-v14';
import {createMapSuspension} from './map-suspension.js?v=drive-20261010-v14';
import {createWholeBuildingBake} from './whole-building-bake.js?v=drive-20261010-v14';
import * as THREE from './vendor/three.module.js?v=drive-20261010-v14';
import { OrbitControls } from './vendor/OrbitControls.js?v=drive-20261010-v14';
import { GLTFLoader } from './vendor/GLTFLoader.js?v=drive-20261010-v14';
import { MeshoptDecoder } from './vendor/meshopt_decoder.module.js?v=drive-20261010-v14';
import { buildBatches, restoreSourceMatrices, syncBatches } from './model.js?v=drive-20261010-v14';
import { cameraPose, updateDepthRange } from './camera.js?v=drive-20261010-v14';
import { fetchManifest, fetchOptionalManifest, shaderHealth, decodePayload, setPresentationControlsBusy } from './runtime.js?v=drive-20261010-v14';
import { createPresentation, NIGHT_LIGHTING } from './presentation.js?v=drive-20261010-v14';
import { restoreSourceCutouts } from './source-materials.js?v=drive-20261010-v14';
import {createOpenings} from './openings.js?v=drive-20261010-v14';
import {createExploration,snapshotNavigationSource,restoreNavigationLayers} from './exploration.js?v=drive-20261010-v14';
import {prepareMaterials,createFixtureLights} from './materials.js?v=drive-20261010-v14';
import {renderSize,rendererEdgeLimit,applyBufferSize} from './resolution.js?v=drive-20261010-v14';
import {prepareSurfaceDetails} from './surface-details.js?v=drive-20261010-v14';
import {createDecor} from './decor.js?v=drive-20261010-v14';
import {interiorCameraPose,createInteriorFill,applyLocalLighting} from './interior-view.js?v=drive-20261010-v14';
import {prepareFloorRepair} from './floor-repair.js?v=drive-20261010-v14';
import {prepareFloorLightmap} from './floor-lightmap.js?v=drive-20261010-v14';
import {createRenderReference} from './render-reference.js?v=drive-20261010-v14';
import {deviceBudget,createFrameBudget,presentationDefaults} from './performance-budget.js?v=drive-20261010-v14';
import {freezeStaticTransforms} from './model.js?v=drive-20261010-v14';
import {prepareWallLightmaps} from './wall-lightmaps.js?v=drive-20261010-v14';
import {prepareGeometryDetail} from './geometry-detail.js?v=drive-20261010-v14';

const $=id=>document.getElementById(id);
const mobile=()=>matchMedia('(max-width:760px)').matches;
const safeMode=new URLSearchParams(location.search).get('safe')==='1',defaults=presentationDefaults(safeMode);
const budget=deviceBudget({width:innerWidth,height:innerHeight,coarsePointer:matchMedia('(any-pointer:coarse)').matches,safeMode:new URLSearchParams(location.search).get('safe')==='1'}),frameBudget=createFrameBudget(budget);
const surfaceEnabled=()=>detailMode==='on'&&materialsMode==='pbr'&&(!budget.phone||graphicsMode==='cinematic');
let renderer,camera,controls,scene,prepared,currentView='iso',framePending=false,ready=false,lightMode='day';
let presentation,graphicsMode=defaults.graphics,shadowRequested=defaults.shadows,assertShaderHealthy=()=>{};
let surfaceDetails,decor,decorData,detailMode='on',detailIndex=0,floorRepair,interiorFill,floorBake,wallBakes,bakeRequested=false,referenceOpen=false;
let mapOpen=!!window.__billymoonMap?.inspect().opened,lastMapPoseAt=-Infinity;
let geometryDetail,geometryConfig,geometryRequested=defaults.nearEdge,wholeBake,bakeScope='whole';
let circuitLighting;
let animatedBatches,exploration,openings,materialController,fixtureRig,materialsMode='pbr',resolutionMode=defaults.resolution,lastFrame=0,dirty=true;
const mapSuspension=createMapSuspension({initialOpen:mapOpen,getControls:()=>controls,getExploration:()=>exploration,onChange(open){mapOpen=open;lastFrame=0;frameBudget.reset();publishMapPose(true);if(!open)requestRender();}});
window.addEventListener('billymoon:map-modal',event=>mapSuspension.setOpen(!!event.detail?.open));
const loadState={phase:'loading',loaded:0,total:0};
const pendingTransfers=new Set();let loadingCancelled=false;
window.__billymoon={state:loadState};
let progressAt=-Infinity,progressTitle='';
function setProgress(value,title,detail){const now=performance.now();if(title===progressTitle&&now-progressAt<150&&value<99)return;progressAt=now;progressTitle=title;$('progress').setAttribute('aria-valuenow',String(Math.round(value)));$('progress').style.width=`${Math.min(100,value)}%`;$('load-title').textContent=title;$('load-detail').textContent=detail;}
function fail(error){exploration?.clear();ready=false;loadingCancelled=true;wholeBake?.release();geometryDetail?.setEnabled(false);for(const controller of pendingTransfers)controller.abort();loadState.phase='error';$('loading').hidden=true;$('error').hidden=false;$('error-detail').textContent=error.message||'Model belum bisa dimuat. Periksa koneksi dan coba lagi.';console.error('BILLYMOON:',error);}
function setPanel(open){exploration?.setSuspended(open,undefined,'settings');$('panel-content').hidden=!open;$('settings').classList.toggle('collapsed',!open);$('panel-toggle').setAttribute('aria-expanded',String(open));$('panel-icon').textContent=open?'−':'+';document.querySelector('.view-caption').classList.toggle('covered',open&&mobile());}
$('panel-toggle').addEventListener('click',()=>setPanel($('panel-content').hidden));
$('info').addEventListener('click',()=>{exploration?.setSuspended(true,undefined,'info');$('details').showModal();});
$('close-info').addEventListener('click',()=>$('details').close());$('details').addEventListener('close',()=>{exploration?.setSuspended(false,undefined,'info');requestRender();});
$('retry').addEventListener('click',()=>location.reload());
$('fullscreen').addEventListener('click',async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else await document.documentElement.requestFullscreen();}catch{$('model-status').textContent='Layar penuh tidak tersedia di browser ini.';}});
setPanel(!mobile());$('graphics').value=graphicsMode;$('resolution').value=resolutionMode;$('geometry-detail').checked=geometryRequested;$('shadows').checked=shadowRequested;
if(budget.phone){$('model-tier').querySelector('[value="detail"]').disabled=true;$('model-tier-note').textContent='HP memakai model optimal 29 MB. Grafik High tetap terpisah dari Detail asli 128 MB untuk desktop.';$('resolution').querySelector('[value="4k"]').textContent='Detail maksimum · dibatasi HP';$('resolution').querySelector('[value="high"]').textContent='Tinggi tetap · batas HP';}
createRenderReference({dialog:$('render-reference'),image:$('reference-image'),status:$('reference-status'),openButtons:[$('open-render'),$('loading-render'),$('error-render')],closeButton:$('close-render'),visitButton:$('visit-render-camera'),onOpen(){referenceOpen=true;exploration?.setSuspended(true,undefined,'reference');lastFrame=0;},onClose(){referenceOpen=false;exploration?.setSuspended(false,undefined,'reference');lastFrame=0;requestRender();},onVisit(){if(ready)applyView('interior');}});


async function fetchBytes(url,expected,onChunk){
 const controller=new AbortController();pendingTransfers.add(controller);let timer;
 const arm=()=>{clearTimeout(timer);timer=setTimeout(()=>controller.abort(),60000);};
 try{arm();const response=await fetch(url,{signal:controller.signal});if(!response.ok)throw new Error(`Berkas model tidak tersedia (${response.status}).`);
  const reader=response.body?.getReader();if(!reader){const b=await response.arrayBuffer();if(b.byteLength!==expected)throw new Error('Berkas model tidak lengkap. Silakan coba lagi.');onChunk(b.byteLength);return b;}
  const bytes=new Uint8Array(expected);let offset=0;
  while(true){arm();const {done,value}=await reader.read();if(done)break;if(offset+value.byteLength>expected)throw new Error('Ukuran berkas model berubah. Muat ulang halaman.');bytes.set(value,offset);offset+=value.byteLength;onChunk(value.byteLength);}
  if(offset!==expected)throw new Error('Koneksi terputus sebelum model selesai dimuat.');return bytes.buffer;
 }catch(e){if(e.name==='AbortError')throw new Error('Koneksi terlalu lama tidak merespons. Periksa jaringan, lalu coba lagi.');throw e;}finally{clearTimeout(timer);pendingTransfers.delete(controller);}
}
async function loadModel(){
 const params=new URLSearchParams(location.search),detail=params.get('detail')==='1'&&params.get('safe')!=='1'&&!budget.phone;
 const assetBase=detail?'./model/':'./model-light/';
 const manifest=await fetchManifest(assetBase+'manifest.json');
 $('model-tier').value=detail?'detail':'light';
 const files=manifest.files;loadState.total=manifest.bytes;const data=new Map();let next=0;
 const tick=bytes=>{loadState.loaded+=bytes;setProgress(76*loadState.loaded/loadState.total,'Membuka BILLYMOON',`${(loadState.loaded/1e6).toFixed(1)} / ${(loadState.total/1e6).toFixed(1)} MB`);};
 async function worker(){while(next<files.length){if(loadingCancelled)throw new Error('Pemuatan dihentikan. Buka kembali dengan preset aman.');const file=files[next++];const encoded=await fetchModelPayload(file,new URL(assetBase,location.href),fetchBytes,tick);data.set(file.logicalName||file.name,await decodePayload(encoded,file));}}
 await Promise.all(Array.from({length:2},worker));
 setProgress(79,'Menyiapkan material','Memproses geometri dan tekstur');await new Promise(r=>setTimeout(r,30));
 const json=JSON.parse(new TextDecoder().decode(data.get(manifest.entry)));data.delete(manifest.entry);
 const urls=[];
 for(const buffer of json.buffers||[]) if(buffer.uri){const bytes=data.get(buffer.uri);if(!bytes)throw new Error('Salah satu bagian model tidak ditemukan.');const url=URL.createObjectURL(new Blob([bytes]));urls.push(url);data.delete(buffer.uri);buffer.uri=url;}
 for(const img of json.images||[]) if(img.uri&&!img.uri.startsWith('data:')){const bytes=data.get(img.uri);if(!bytes)throw new Error('Tekstur model tidak ditemukan.');const url=URL.createObjectURL(new Blob([bytes]));urls.push(url);data.delete(img.uri);img.uri=url;}
 try{const loader=new GLTFLoader();loader.setMeshoptDecoder(MeshoptDecoder);const gltf=await loader.parseAsync(JSON.stringify(json),'');restoreSourceMatrices(gltf,json);restoreSourceCutouts(gltf);return {gltf,manifest};}finally{urls.forEach(URL.revokeObjectURL);data.clear();}
}
function requestRender(force=true){if(!ready||document.hidden||referenceOpen||mapOpen)return;if(force)dirty=true;if(framePending)return;framePending=true;requestAnimationFrame(drawFrame);}
function drawFrame(time){framePending=false;if(!ready||document.hidden||referenceOpen||mapOpen){lastFrame=0;frameBudget.reset();return;}if(!frameBudget.due(time)){requestRender(false);return;}const dt=lastFrame?Math.min(.1,(time-lastFrame)/1000):1/60;lastFrame=time;
 const state=exploration?.tick(dt)||{changed:false,active:false,shadowDirty:false};if(exploration?.getMode()!=='first'&&exploration?.getMode()!=='third')controls.update();
 if(frameBudget.record(time,state.active&&resolutionMode==='auto')&&resolutionMode==='auto')resize();window.__billymoon.performance=frameBudget.inspect();
 if(circuitLighting?.update(camera.position,lightMode))dirty=true;
 if(geometryDetail?.update(camera.position)){dirty=true;presentation?.refreshShadows();}window.__billymoon.geometryDetail=geometryDetail?.inspect();wholeBake?.update(camera);window.__billymoon.wholeBake=wholeBake?.inspect();
 if(state.motionChanged&&animatedBatches)syncBatches(animatedBatches,openings.root);
 if(state.shadowDirty)presentation?.refreshShadows();
 if(dirty||state.changed||state.shadowDirty){updateDepthRange(camera,prepared.bounds);try{renderer.render(scene,camera);assertShaderHealthy();}catch(error){fail(error);return;}window.__billymoon.renderCalls=renderer.info.render.calls;window.__billymoon.exploration=exploration?.inspect();dirty=false;}
 publishMapPose(false,time);
 if(state.active)requestRender(false);else lastFrame=0;
}
function publishMapPose(force=false,time=performance.now()){if(!ready||!camera||!controls||(!force&&time-lastMapPoseAt<100))return;lastMapPoseAt=time;const walkPose=exploration?.getMapPose(),direction=camera.getWorldDirection(new THREE.Vector3());window.dispatchEvent(new CustomEvent('billymoon:map-pose',{detail:walkPose||{mode:'orbit',position:controls.target.toArray(),heading:Math.hypot(direction.x,direction.z)<.0001?null:Math.atan2(direction.x,-direction.z),flying:false}}));}
function resize(){if(!renderer)return;const w=innerWidth,h=innerHeight;let size;try{const max=rendererEdgeLimit(renderer);size=renderSize(w,h,devicePixelRatio||1,max,resolutionMode,budget,frameBudget.inspect().scale);applyBufferSize(renderer,w,h,size);}catch(error){fail(new Error('Resolusi pilihan belum dapat dialokasikan. Pilih Buka preset aman untuk mencoba pengaturan ringan. '+error.message));return false;}camera.aspect=w/h;camera.updateProjectionMatrix();$('resolution-note').textContent=`${size.width} × ${size.height} px · ${resolutionMode==='auto'?'adaptif':'tetap'}${budget.phone?' · batas HP aktif':''} · tekstur mengikuti model`;requestRender();return true;}
function applyView(view,interiorLighting=true){if(!prepared)return;if(exploration?.getMode()!=='orbit')exploration?.exit();currentView=view;controls.minDistance=.5;
 if(view==='interior'){const p=interiorCameraPose();camera.position.copy(p.position);camera.up.set(0,1,0);camera.fov=p.fov;controls.target.copy(p.target);if(interiorLighting)setLight('interior');}
 else{camera.fov=40;const p=cameraPose(prepared.bounds,camera.aspect,view);camera.position.copy(p.position);camera.up.copy(p.up);camera.near=p.near;camera.far=p.far;controls.target.copy(p.target);}
 camera.updateProjectionMatrix();controls.update();$('view').value=view;
 const labels={iso:['01','Keseluruhan tapak','Isometrik'],front:['02','Tampak depan','Arah fasad model sumber'],top:['03','Tampak atas','Keseluruhan tapak'],interior:['04','Interior kafe','Sudut opsi 2 · tampilan real-time']};const values=labels[view];$('view-number').textContent=values[0];$('view-title').textContent=values[1];$('view-note').textContent=values[2];if(view==='interior'&&mobile())setPanel(false);requestRender();}
function applyFloorPresentation(){const active=lightMode==='interior'&&materialsMode==='pbr',whole=bakeScope==='whole';floorRepair?.setEnabled(active);floorBake?.setPresentation(bakeRequested&&!whole,lightMode,materialsMode);wallBakes?.setPresentation(bakeRequested&&!whole,lightMode,materialsMode);wholeBake?.setPresentation(bakeRequested&&whole,lightMode,materialsMode);window.__billymoon.wallBake={...wallBakes?.stats,enabled:!!wallBakes?.isEnabled()};$('floor-bake').disabled=!ready||!active||(whole?!wholeBake?.available:!floorBake?.available);$('bake-scope').disabled=!ready||!active;window.__billymoon.floorBake={available:!!floorBake?.available,enabled:!!floorBake?.isEnabled()};window.__billymoon.wholeBake=wholeBake?.inspect();if(prepared)window.__billymoon.floorRepair={available:!!floorRepair?.available,enabled:!!floorRepair?.isEnabled(),removedTriangles:floorRepair?.isEnabled()?floorRepair.removedTriangles:0};}


let ambient,key,fill,nightLamps=true,nightTint='warm',nightBrightness=1;
function applyNightControls(){if(circuitLighting){circuitLighting.update(camera.position,lightMode);circuitLighting.setEnabled(nightLamps);circuitLighting.setAppearance(nightTint,nightBrightness);}fixtureRig?.setAppearance(lightMode==='night'?nightTint:'warm',lightMode==='night'?(nightLamps?nightBrightness:0):1);$('night-brightness-value').textContent=`${Math.round(nightBrightness*100)}%`;$('night-lamp-note').textContent=lightMode==='night'?(circuitLighting?'4 lampu terdekat · kafe / sirkuit · tambahan simulasi':'4 lampu kafe · warna dan terang manual'):'Pilih Malam untuk mengatur lampu.';for(const id of ['night-lamps','night-tint','night-brightness'])$(id).disabled=!ready||lightMode!=='night';}
$('night-lamps').addEventListener('change',event=>{nightLamps=event.target.checked;applyNightControls();requestRender();});$('night-tint').addEventListener('change',event=>{nightTint=event.target.value;applyNightControls();requestRender();});$('night-brightness').addEventListener('input',event=>{nightBrightness=Math.max(0,Math.min(1.5,Number(event.target.value)/100));applyNightControls();requestRender();});
function setLight(mode){lightMode=mode;const night=mode==='night',dusk=mode==='dusk',interior=mode==='interior';document.body.classList.toggle('dusk',night||dusk);for(const id of ['day','dusk','night','interior'])$(id).setAttribute('aria-pressed',String(mode===id));
 if(scene){scene.background=new THREE.Color(night?0x101c2c:dusk?0x182a34:interior?0xe5ded2:0xdce6e5);ambient.color.set(night?0xa3b5d4:dusk?0x91afd2:interior?0xffead0:0xe9f2fa);ambient.groundColor.set(night?0x353b43:dusk?0x424451:interior?0xb7a997:0xa6b3a4);ambient.intensity=night?NIGHT_LIGHTING.ambient:dusk?1.45:2.1;key.color.set(night?0x9eb7dc:dusk?0xffbe86:interior?0xffe3bd:0xfff4df);key.intensity=night?NIGHT_LIGHTING.key:dusk?2.4:2.9;fill.intensity=night?NIGHT_LIGHTING.fill:dusk?.55:1;renderer.toneMappingExposure=night?NIGHT_LIGHTING.exposure:dusk?1.05:1;applyLocalLighting(fixtureRig,interiorFill,mode);applyNightControls();applyFloorPresentation();presentation?.apply(graphicsMode,mode,materialsMode==='pbr',shadowRequested);if(ready)compileLightChange();else requestRender();}}
function compileLightChange(){ready=false;loadState.phase='updating';presentationBusy(true);$('graphics-note').textContent='Menyiapkan cahaya…';Promise.resolve().then(()=>renderer.compileAsync(scene,camera)).then(()=>{if(loadState.phase==='error')return;assertShaderHealthy();ready=true;loadState.phase='ready';updateGraphicsNote();requestRender();}).catch(fail).finally(()=>presentationBusy(false));}
for(const id of ['day','dusk','night','interior'])$(id).addEventListener('click',()=>{if(ready)setLight(id);});
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
document.addEventListener('visibilitychange',()=>{lastFrame=0;frameBudget.reset();if(!document.hidden)requestRender();});
window.addEventListener('blur',()=>{lastFrame=0;frameBudget.reset();});
$('scene').addEventListener('webglcontextlost',e=>{e.preventDefault();fail(new Error('Konteks grafis terhenti. Tutup tab lain jika memori penuh, lalu coba lagi.'));});

async function init(){
 try{renderer=new THREE.WebGLRenderer({canvas:$('scene'),antialias:budget.antialias,powerPreference:budget.powerPreference,alpha:false});}catch{throw new Error('Browser ini belum dapat membuka WebGL 2. Aktifkan akselerasi grafis atau gunakan browser lain.');}
 assertShaderHealthy=shaderHealth(renderer,error=>{if(ready)fail(error);});
 renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.shadowMap.enabled=false;
 scene=new THREE.Scene();camera=new THREE.PerspectiveCamera(40,innerWidth/innerHeight,.02,3000);controls=new OrbitControls(camera,$('scene'));controls.enableDamping=false;controls.minDistance=.5;controls.maxDistance=2000;controls.maxPolarAngle=Math.PI*.98;controls.addEventListener('change',requestRender);mapSuspension.sync();
 ambient=new THREE.HemisphereLight();key=new THREE.DirectionalLight();key.position.set(100,130,80);fill=new THREE.DirectionalLight(0xc1daf2);fill.position.set(-100,70,-90);scene.add(ambient,key,fill);setLight(lightMode);if(resize()===false)return;
 let {gltf,manifest}=await loadModel();if(loadingCancelled)return;$('info-geometry').textContent=`${(manifest.triangles/1e6).toFixed(2)} juta segitiga · ${manifest.quality==='light'?'model ringan':'detail asli'}`;
 const [openingMap,navigationMap,pbrData,detailData,floorData,bakeData,wallData,geometryData,wholeBootstrap]=await Promise.all([fetchManifest('./openings-data.json'),fetchManifest('./navigation-data.json'),fetchManifest('./pbr-data.json'),fetchManifest('./decor-data.json'),fetchOptionalManifest('./floor-repair-data.json'),fetchOptionalManifest('./floor-lightmap-data.json'),fetchOptionalManifest('./wall-lightmaps-data.json'),fetchOptionalManifest('./geometry/tray-config-608670dfeed2.json'),fetchOptionalManifest('./whole-bake/bootstrap-680bb92acaf5.json')]);
 floorRepair=await prepareFloorRepair(gltf.scene,floorData?.variants?.[manifest.quality==='light'?'model-light':'model']);
 floorBake=await prepareFloorLightmap(gltf.scene,floorData?.variants?.[manifest.quality==='light'?'model-light':'model'],{...(bakeData||{}),verified:!!bakeData?.verified&&floorRepair.available});
 wallBakes=await prepareWallLightmaps(gltf.scene,wallData,manifest.quality==='light'?'model-light':'model');
 geometryConfig=geometryData;geometryDetail=await prepareGeometryDetail(gltf.scene,geometryData,manifest.quality==='light'?'light':'detail');
 decorData=detailData;decor=createDecor(decorData.placements);
 materialController=prepareMaterials(gltf.scene,pbrData);materialController.apply(true);surfaceDetails=prepareSurfaceDetails(gltf.scene);surfaceDetails.setEnabled(surfaceEnabled());
 openings=createOpenings({sourceScene:gltf.scene,openingMap,onStatus:message=>$('walk-status').textContent=message});
 const navigationSource=snapshotNavigationSource(gltf.scene,navigationMap);
 setProgress(86,'Menyusun tampilan','Mengatur objek dan bukaan');
 prepared=await buildBatches(gltf.scene,p=>setProgress(86+p*10,'Menyusun tampilan',`${Math.round(p*100)}% objek siap`),{excludeNames:openings.dynamicNames,spatial:true,retainGeometryFor:new Set(wholeBootstrap?.geometryMeshIndices||[])});
 prepared.stats.staticMeshes=prepared.stats.sourceMeshes;prepared.stats.dynamicMeshes=openings.meshCount;prepared.stats.sourceMeshes+=openings.meshCount;prepared.stats.triangles+=openings.triangles;prepared.stats.instances+=openings.meshCount;
 if(prepared.stats.triangles!==manifest.triangles||prepared.stats.sourceMeshes!==manifest.placedMeshes)throw new Error('Pemeriksaan kelengkapan model gagal. Coba muat ulang.');
 for(const [name,count]of openings.getLayerCounts()){if(!prepared.layers.has(name)){const group=new THREE.Group();prepared.root.add(group);prepared.layers.set(name,{group,count:0});}prepared.layers.get(name).count+=count;}
 if(geometryDetail.available&&!geometryDetail.bindBatches(prepared.root))geometryDetail.available=false;
 animatedBatches=await buildBatches(openings.root);floorRepair.bindBatches(prepared.root);wholeBake=createWholeBuildingBake(prepared.root,wholeBootstrap,manifest.quality==='light'?'light':'detail',{wake:requestRender,onStatus:text=>$('floor-bake-note').textContent=text});
 if(geometryRequested){try{if(!geometryDetail.available||!await geometryDetail.ensureLoaded())throw new Error('Detail source unavailable');}catch{geometryRequested=false;$('geometry-detail').checked=false;$('geometry-note').textContent='Detail tepi belum termuat; geometri sumber tetap dipakai.';}}if(loadingCancelled)return;
 const displayRoot=new THREE.Group();displayRoot.add(prepared.root,animatedBatches.root,decor.root);scene.add(displayRoot);scene.updateMatrixWorld(true);freezeStaticTransforms(prepared.root);gltf=null;
 presentation=createPresentation(renderer,scene,displayRoot,prepared.bounds,{ambient,key,fill},{shadowSize:budget.shadowSize});fixtureRig=createFixtureLights(scene,pbrData.night);interiorFill=createInteriorFill(scene);
 exploration=createExploration({scene,camera,controls,canvas:$('scene'),sourceScene:navigationSource,navigationMap,openings,decor,wake:requestRender,beforeEnter:restoreLayers,onDrivingReady:(query,createLights)=>{circuitLighting?.dispose();circuitLighting=createLights({scene,fixtureRig});applyNightControls();requestRender();},onDrivingDisabled:()=>{circuitLighting?.dispose();circuitLighting=null;applyNightControls();},onModeChange:mode=>{if(mode!=='orbit')setPanel(false);publishMapPose(true);requestRender();}});
 mapSuspension.sync();createLayers();applyView(budget.phone?'interior':'iso',false);setLight(lightMode);setProgress(99,'Menampilkan model','Menyiapkan tampilan pertama');
 // Compile once, then draw the complete model before dismissing the loader.
 await renderer.compileAsync(scene,camera);if(loadState.phase==='error')return;assertShaderHealthy();renderer.render(scene,camera);assertShaderHealthy();ready=true;
 $('loading').hidden=true;document.body.classList.add('ready');$('view').disabled=false;$('visit-render-camera').disabled=false;$('reset').disabled=false;$('show-all').disabled=false;$('graphics').disabled=false;$('model-tier').disabled=false;$('walk-mode').disabled=false;$('vehicle-enable').disabled=false;$('materials').disabled=false;$('resolution').disabled=false;$('detail-additions').disabled=false;$('detail-focus').disabled=false;$('detail-note').textContent='3 area furnitur konsep · detail permukaan pada PBR + Sinematik di HP';
 applyGeometryPresentation();geometryDetail?.update(camera.position);$('shadows').disabled=false;updateGraphicsNote();applyNightControls();applyFloorPresentation();publishMapPose(true);window.dispatchEvent(new Event('billymoon:model-ready'));$('model-status').textContent=`${prepared.layers.size} layer · ${prepared.stats.sourceMeshes.toLocaleString('id-ID')} objek`;loadState.phase='ready';
 Object.assign(window.__billymoon,{additions:{furniture:decor.stats,surface:surfaceDetails.stats},stats:prepared.stats,renderCalls:renderer.info.render.calls,bounds:{min:prepared.bounds.min.toArray(),max:prepared.bounds.max.toArray()},layerNames:[...prepared.layers.keys()]});requestRender();
}
function applyGeometryPresentation(){geometryDetail?.setEnabled(geometryRequested&&detailMode==='on'&&materialsMode==='pbr');$('geometry-detail').disabled=!ready||!geometryDetail?.available;$('geometry-focus').disabled=!ready||!geometryDetail?.available||detailMode!=='on'||materialsMode!=='pbr';}
function presentationBusy(busy){busy=busy||loadState.phase==='error';for(const id of ['night-lamps','night-tint','night-brightness'])$(id).disabled=busy||!ready||lightMode!=='night';setPresentationControlsBusy([$('graphics'),$('shadows'),$('materials'),$('detail-additions'),$('day'),$('dusk'),$('night'),$('interior'),$('view'),$('geometry-detail'),$('geometry-focus'),$('bake-scope')],busy);$('detail-focus').disabled=busy||detailMode==='off';$('visit-render-camera').disabled=busy||!ready;$('geometry-detail').disabled=busy||!geometryDetail?.available;$('geometry-focus').disabled=busy||!geometryDetail?.available||detailMode!=='on'||materialsMode!=='pbr';$('floor-bake').disabled=busy||!ready||lightMode!=='interior'||materialsMode!=='pbr'||(bakeScope==='whole'?!wholeBake?.available:!floorBake?.available);$('bake-scope').disabled=busy||!ready||lightMode!=='interior'||materialsMode!=='pbr';}
function updateGraphicsNote(){$('graphics-note').textContent=(graphicsMode==='cinematic'?'Sinematik · pantulan lingkungan':'Ringan')+(shadowRequested?' · bayangan aktif':' · bayangan mati');}
$('shadows').addEventListener('change',()=>{if(!ready)return;shadowRequested=$('shadows').checked;presentation.apply(graphicsMode,lightMode,materialsMode==='pbr',shadowRequested);compileLightChange();});
$('graphics').addEventListener('change',async event=>{
 if(!ready){event.target.value=graphicsMode;return;}const mode=event.target.value;ready=false;loadState.phase='updating';presentationBusy(true);$('graphics-note').textContent='Menyiapkan pencahayaan…';
 try{await new Promise(resolve=>setTimeout(resolve,30));graphicsMode=mode;surfaceDetails.setEnabled(surfaceEnabled());applyFloorPresentation();presentation.apply(mode,lightMode,materialsMode==='pbr',shadowRequested);await renderer.compileAsync(scene,camera);if(loadState.phase==='error')return;assertShaderHealthy();renderer.render(scene,camera);assertShaderHealthy();ready=true;loadState.phase='ready';updateGraphicsNote();window.__billymoon.graphics=mode;requestRender();}
 catch(error){fail(new Error('Mode grafik belum berhasil ditampilkan. Pilih Buka preset aman untuk mencoba mode Ringan. '+error.message));}
 finally{presentationBusy(false);}
});
$('model-tier').addEventListener('change',event=>{const url=new URL(location.href);if(event.target.value==='detail'){url.searchParams.delete('safe');url.searchParams.set('detail','1');}else url.searchParams.delete('detail');location.href=url.href;});
$('materials').addEventListener('change',async event=>{if(!ready){event.target.value=materialsMode;return;}ready=false;materialsMode=event.target.value;presentationBusy(true);try{materialController.apply(materialsMode==='pbr');surfaceDetails.setEnabled(surfaceEnabled());applyFloorPresentation();applyGeometryPresentation();presentation.apply(graphicsMode,lightMode,materialsMode==='pbr',shadowRequested);await renderer.compileAsync(scene,camera);if(loadState.phase==='error')return;assertShaderHealthy();renderer.render(scene,camera);assertShaderHealthy();ready=true;requestRender();}catch(error){fail(error);}finally{presentationBusy(false);}});
$('detail-additions').addEventListener('change',async event=>{if(!ready){event.target.value=detailMode;return;}ready=false;detailMode=event.target.value;presentationBusy(true);exploration?.exit();exploration?.resetEntry();try{decor.setEnabled(detailMode==='on');surfaceDetails.setEnabled(surfaceEnabled());applyGeometryPresentation();applyFloorPresentation();presentation.refreshShadows();await renderer.compileAsync(scene,camera);if(loadState.phase==='error')return;assertShaderHealthy();renderer.render(scene,camera);assertShaderHealthy();ready=true;$('detail-note').textContent=detailMode==='on'?'3 area furnitur konsep · detail permukaan pada PBR + Sinematik di HP':'Tambahan disembunyikan · titik jelajah kembali ke awal';requestRender();}catch(error){fail(error);}finally{presentationBusy(false);}});
$('detail-focus').addEventListener('click',()=>{if(!ready||detailMode==='off')return;exploration?.exit();const p=decorData.placements[detailIndex++%decorData.placements.length];camera.position.fromArray(p.inspectionCamera);camera.up.set(0,1,0);camera.fov=55;camera.updateProjectionMatrix();controls.target.fromArray(p.inspectionTarget);controls.update();$('view').value='detail';$('view-number').textContent='DETAIL';$('view-title').textContent=p.label;$('view-note').textContent='Furnitur tambahan · klik lagi untuk area berikutnya';if(mobile())setPanel(false);requestRender();});
async function updateBake(){
 if(!ready){$('floor-bake').checked=bakeRequested;$('bake-scope').value=bakeScope;return;}
 bakeRequested=$('floor-bake').checked;bakeScope=$('bake-scope').value;ready=false;loadState.phase='updating';presentationBusy(true);$('floor-bake-note').textContent='Menyiapkan cahaya bake…';
 try{
  if(bakeScope==='whole'){floorBake?.releaseTexture();wallBakes?.releaseTextures();if(bakeRequested)await wholeBake.ensureLoaded();else wholeBake.release();}
  else{wholeBake?.release();if(bakeRequested){await floorBake.ensureTexture();if(loadState.phase!=='error')await wallBakes?.ensureTextures();}else{floorBake?.releaseTexture();wallBakes?.releaseTextures();}}
  if(loadState.phase==='error')return;applyFloorPresentation();await renderer.compileAsync(scene,camera);if(loadState.phase==='error')return;assertShaderHealthy();renderer.render(scene,camera);assertShaderHealthy();
  $('floor-bake-note').textContent=!bakeRequested?'Bake dimatikan; pencahayaan real-time dipakai.':bakeScope==='whole'?'1.845 objek statis bangunan + tapak · atlas ringkas seluruh cakupan, satu zona detail dekat. Cahaya siang statis; pintu/avatar tidak membentuk bayangan bake.':'Lantai + 2 permukaan dinding kafe · pantulan cahaya statis, detail lebih rapat.';
 }catch(error){
  bakeRequested=false;$('floor-bake').checked=false;wholeBake?.release();floorBake?.releaseTexture();wallBakes?.releaseTextures();applyFloorPresentation();assertShaderHealthy=shaderHealth(renderer,error=>{if(ready)fail(error);});
  try{await renderer.compileAsync(scene,camera);if(loadState.phase==='error')return;assertShaderHealthy();$('floor-bake-note').textContent='Bake belum berhasil dimuat; tampilan sumber tetap tersedia.';}
  catch(fallbackError){fail(fallbackError);}
 }finally{if(loadState.phase!=='error'){ready=true;loadState.phase='ready';applyFloorPresentation();presentationBusy(false);requestRender();}}
}
$('floor-bake').addEventListener('change',updateBake);$('bake-scope').addEventListener('change',updateBake);
async function loadGeometryDetail(inspect=false){
 if(!ready||!geometryDetail?.available)return;geometryRequested=$('geometry-detail').checked;const control=$('geometry-detail');control.disabled=true;$('geometry-focus').disabled=true;
 try{if(geometryRequested)await geometryDetail.ensureLoaded();if(loadState.phase==='error')return;if(inspect&&geometryRequested){exploration?.exit();const p=geometryConfig.inspectionCamera;camera.position.fromArray(p.eyeGltfWorldMetres);camera.up.set(0,1,0);camera.fov=25;camera.updateProjectionMatrix();controls.minDistance=.12;controls.target.fromArray(p.targetGltfWorldMetres);controls.update();$('view').value='detail';$('view-number').textContent='DETAIL';$('view-title').textContent='Tepi baki kayu';$('view-note').textContent='Chamfer mikro · geometri sumber dapat dipulihkan';if(mobile())setPanel(false);}applyGeometryPresentation();$('geometry-note').textContent=geometryRequested?'Tepi baki diperhalus saat kamera dekat. Model sumber tetap tersedia.':'Detail geometri dimatikan; bentuk sumber dipakai.';presentation?.refreshShadows();requestRender();}
 catch{geometryRequested=false;control.checked=false;geometryDetail.setEnabled(false);$('geometry-note').textContent='Detail belum tersedia; bentuk sumber tetap dipakai.';requestRender();}
 finally{if(loadState.phase!=='error')applyGeometryPresentation();}
}
$('geometry-detail').addEventListener('change',()=>loadGeometryDetail());$('geometry-focus').addEventListener('click',()=>{$('geometry-detail').checked=true;loadGeometryDetail(true);});
$('resolution').addEventListener('change',event=>{resolutionMode=event.target.value;resize();});
init().catch(fail);
