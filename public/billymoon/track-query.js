import {Vector3} from './vendor/three.module.js?v=drive-20261010-v14';

const EPS=1e-7, MAX_BYTES=1_000_000;
const finite=Number.isFinite;
const cross=(a,b,c)=>(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]);
function onSegment(p,a,b){return Math.abs(cross(a,b,p))<EPS&&p[0]>=Math.min(a[0],b[0])-EPS&&p[0]<=Math.max(a[0],b[0])+EPS&&p[1]>=Math.min(a[1],b[1])-EPS&&p[1]<=Math.max(a[1],b[1])+EPS;}
function inside(p,r){let value=false;for(let i=0,j=r.length-2;i<r.length;j=i,i+=2){const a=[r[j],r[j+1]],b=[r[i],r[i+1]];if(onSegment(p,a,b))return true;if((a[1]>p[1])!==(b[1]>p[1])&&p[0]<(b[0]-a[0])*(p[1]-a[1])/(b[1]-a[1])+a[0])value=!value;}return value;}
function segmentCross(a,b,c,d){const u=cross(a,b,c),v=cross(a,b,d),s=cross(c,d,a),t=cross(c,d,b);return ((u>EPS&&v<-EPS)||(u<-EPS&&v>EPS))&&((s>EPS&&t<-EPS)||(s<-EPS&&t>EPS));}
function segments(r){const out=[];for(let i=0;i<r.length;i+=2)out.push([[r[i],r[i+1]],[r[(i+2)%r.length],r[(i+3)%r.length]]]);return out;}
function ringBounds(r){let a=Infinity,b=Infinity,c=-Infinity,d=-Infinity;for(let i=0;i<r.length;i+=2){a=Math.min(a,r[i]);b=Math.min(b,r[i+1]);c=Math.max(c,r[i]);d=Math.max(d,r[i+1]);}return [a,b,c,d];}
function inBounds(p,b){return p[0]>=b[0]-EPS&&p[0]<=b[2]+EPS&&p[1]>=b[1]-EPS&&p[1]<=b[3]+EPS;}
function ringValid(r){return Array.isArray(r)&&r.length>=6&&r.length%2===0&&r.every(v=>finite(v)&&Math.abs(v)<10000);}
function ringArea(r){let sum=0;for(let i=0;i<r.length;i+=2)sum+=(r[i]-r[0])*(r[(i+3)%r.length]-r[1])-(r[(i+2)%r.length]-r[0])*(r[i+1]-r[1]);return Math.abs(sum)/2;}
function validate(data){
 if(data?.schemaVersion!==1||data.units!=='metres'||!finite(data.height)||!Array.isArray(data.road)||!data.road.length||!Array.isArray(data.obstacles))throw new Error('Data sirkuit tidak valid.');
 let count=0;for(const polygon of [...data.road,...data.obstacles]){if(!ringValid(polygon.outer)||!Array.isArray(polygon.holes)||!polygon.holes.every(ringValid))throw new Error('Batas sirkuit tidak valid.');count+=polygon.outer.length+polygon.holes.reduce((n,r)=>n+r.length,0);}
 if(!Array.isArray(data.bounds)||data.bounds.length!==4||!data.bounds.every(finite)||data.bounds[0]>=data.bounds[2]||data.bounds[1]>=data.bounds[3])throw new Error('Rentang sirkuit tidak valid.');
 if(count>100000)throw new Error('Data sirkuit melebihi batas.');return data;
}
async function boundedBytes(response,limit,signal){
 if(!response.ok)throw new Error(`Data sirkuit tidak tersedia (${response.status}).`);
 const reader=response.body?.getReader();if(!reader){const b=await response.arrayBuffer();if(b.byteLength>limit)throw new Error('Data sirkuit melebihi batas.');return b;}
 const chunks=[];let length=0;try{while(true){signal?.throwIfAborted();const {done,value}=await reader.read();if(done)break;length+=value.byteLength;if(length>limit)throw new Error('Data sirkuit melebihi batas.');chunks.push(value);}}catch(e){await reader.cancel().catch(()=>{});throw e;}const out=new Uint8Array(length);let at=0;for(const chunk of chunks){out.set(chunk,at);at+=chunk.length;}return out.buffer;
}
export async function loadTrack({fetcher=fetch,signal,url=new URL('./driving-track.json',import.meta.url)}={}){
 signal?.throwIfAborted();const bytes=await boundedBytes(await fetcher(url,{signal}),MAX_BYTES,signal),data=JSON.parse(new TextDecoder().decode(bytes));
 if(data.buffer){const b=data.buffer;if(!Number.isInteger(b.bytes)||b.bytes<1||b.bytes+bytes.byteLength>MAX_BYTES||!/^driving-track-[a-f0-9]{12}\.bin$/.test(b.name)||!/^[a-f0-9]{64}$/.test(b.sha256))throw new Error('Identitas data sirkuit tidak valid.');
  const raw=await boundedBytes(await fetcher(new URL(b.name,url),{signal}),b.bytes,signal);signal?.throwIfAborted();const digest=[...new Uint8Array(await crypto.subtle.digest('SHA-256',raw))].map(v=>v.toString(16).padStart(2,'0')).join('');if(raw.byteLength!==b.bytes||digest!==b.sha256)throw new Error('Data sirkuit tidak lengkap atau berubah.');
  const unpack=d=>{if(!Array.isArray(d)||d.length!==2||!d.every(Number.isInteger)||d[0]<0||d[1]<6||d[1]%2||d[0]%8||d[0]+d[1]*8>raw.byteLength)throw new Error('Rentang data sirkuit tidak valid.');return Array.from(new Float64Array(raw,d[0],d[1]));};
  for(const p of [...data.road,...data.obstacles]){p.outer=unpack(p.outer);p.holes=p.holes.map(unpack);}
 }validate(data);validateDrivingQuery(createTrackQuery(data));return data;
}
export function footprint(pose,halfWidth,halfLength){
 const x=pose.position[0],z=pose.position[2],s=Math.sin(pose.yaw),c=Math.cos(pose.yaw);return [[-halfWidth,-halfLength],[halfWidth,-halfLength],[halfWidth,halfLength],[-halfWidth,halfLength]].map(([u,v])=>[x+u*c-v*s,z+u*s+v*c]);
}
export function createTrackQuery(input){
 const data=validate(input),normalized=p=>({...p,holes:p.holes.filter(h=>ringArea(h)>1e-10),bounds:ringBounds(p.outer)}),road=data.road.map(normalized),obstacles=data.obstacles.map(normalized);
 const roadPoint=p=>road.some(r=>inBounds(p,r.bounds)&&inside(p,r.outer)&&!r.holes.some(h=>inside(p,h)));
 const obstaclePoint=p=>obstacles.some(r=>inBounds(p,r.bounds)&&inside(p,r.outer)&&!r.holes.some(h=>inside(p,h)));
 const boundaries=[...road,...obstacles].flatMap(p=>[p.outer,...p.holes]).flatMap(segments),grid=new Map(),CELL=4;
 for(const edge of boundaries){const b=ringBounds(edge.flat());for(let x=Math.floor(b[0]/CELL);x<=Math.floor(b[2]/CELL);x++)for(let z=Math.floor(b[1]/CELL);z<=Math.floor(b[3]/CELL);z++){const k=`${x},${z}`;if(!grid.has(k))grid.set(k,[]);grid.get(k).push(edge);}}
 function nearby(b){const edges=new Set();for(let x=Math.floor(b[0]/CELL);x<=Math.floor(b[2]/CELL);x++)for(let z=Math.floor(b[1]/CELL);z<=Math.floor(b[3]/CELL);z++)for(const e of grid.get(`${x},${z}`)||[])edges.add(e);return edges;}
 function heightAt(x,z){return finite(x)&&finite(z)&&roadPoint([x,z])&&!obstaclePoint([x,z])?data.height:null;}
 function containsFootprint(pose,halfWidth,halfLength){
  if(!pose?.position?.every(finite)||pose.position.length!==3||!finite(pose.yaw)||!finite(halfWidth)||!finite(halfLength)||halfWidth<=0||halfLength<=0)return false;
  const points=footprint(pose,halfWidth,halfLength),ring=points.flat();if(points.some(p=>heightAt(...p)===null)||heightAt(pose.position[0],pose.position[2])===null)return false;
  const sides=segments(ring);for(const [a,b]of nearby(ringBounds(ring))){if(inside(a,ring)||inside(b,ring)||sides.some(([c,d])=>segmentCross(a,b,c,d)))return false;}return true;
 }
 function sweep(from,to,halfWidth,halfLength){
  if(!containsFootprint(from,halfWidth,halfLength))return {blocked:true,pose:from};
  if(!to?.position?.every(finite)||!finite(to.yaw))return {blocked:true,pose:from};
  const distance=Math.hypot(to.position[0]-from.position[0],to.position[2]-from.position[2]),angle=Math.atan2(Math.sin(to.yaw-from.yaw),Math.cos(to.yaw-from.yaw));
  const steps=Math.max(1,Math.ceil(distance/.04),Math.ceil(Math.abs(angle)/.02));if(steps>256)return {blocked:true,pose:from};let last=from;
  for(let i=1;i<=steps;i++){const t=i/steps,p={...to,position:[from.position[0]+(to.position[0]-from.position[0])*t,data.height,from.position[2]+(to.position[2]-from.position[2])*t],yaw:from.yaw+angle*t};if(!containsFootprint(p,halfWidth+.025,halfLength+.025))return {blocked:true,pose:last};last=p;}return {blocked:false,pose:last};
 }
 function findDismount(pose,radius=.25,height=1.75){
  if(!finite(radius)||radius<=0||!finite(height)||height<=0)return null;
  for(const side of [1,-1])for(const offset of [1.25,1.5,1.8]){const p={position:[pose.position[0]+Math.cos(pose.yaw)*offset*side,data.height+.005,pose.position[2]+Math.sin(pose.yaw)*offset*side],yaw:0};if(containsFootprint(p,radius+.05,radius+.05))return p.position;}return null;
 }
 function createWalkingCollider(){return {
  bounds:data.bounds,
  collideCapsule(capsule){const feet=Math.min(capsule.start.y,capsule.end.y)-capsule.radius;if(feet<data.height-.25||feet>=data.height)return false;const x=capsule.start.x,z=capsule.start.z;if(heightAt(x,z)===null)return false;return {normal:new Vector3(0,1,0),depth:data.height-feet};},
  rayIntersect(ray){if(Math.abs(ray.direction.y)<EPS)return false;const t=(data.height-ray.origin.y)/ray.direction.y;if(t<0)return false;const p=ray.at(t,new Vector3());if(heightAt(p.x,p.z)===null)return false;return {position:p,distance:ray.origin.distanceTo(p),normal:new Vector3(0,1,0)};}
 };}
 return {heightAt,containsFootprint,sweep,findDismount,createWalkingCollider,parking:data.parking||[],entry:data.entry,fixtures:data.fixtures||[],height:data.height,stats:{boundaries:boundaries.length,cells:grid.size,roadPolygons:road.length}};
}

export function validateDrivingQuery(query){
 const vec=p=>Array.isArray(p)&&p.length===3&&p.every(finite);
 if(!query||!vec(query.entry)||Math.abs(query.entry[1]-query.height)>.1||!query.containsFootprint({position:query.entry,yaw:0},.3,.3)||!Array.isArray(query.parking)||query.parking.length!==2)throw new Error('Titik masuk kendaraan tidak valid.');
 const seen=new Set();for(const p of query.parking){if(!p||!['kart','motorcycle'].includes(p.kind)||p.id!==p.kind||seen.has(p.id)||!vec(p.position)||Math.abs(p.position[1]-query.height)>.01||!finite(p.yaw)||!query.containsFootprint(p,p.kind==='kart'?.66:.43,p.kind==='kart'?1.12:1.08))throw new Error('Posisi kendaraan belum aman.');seen.add(p.id);}
 return query;
}
