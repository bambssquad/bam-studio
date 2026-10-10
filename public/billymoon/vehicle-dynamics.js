export const VEHICLE_SIZES=Object.freeze({kart:{halfWidth:.66,halfLength:1.12,wheelbase:1.35,maxSpeed:24/3.6},motorcycle:{halfWidth:.43,halfLength:1.08,wheelbase:1.38,maxSpeed:30/3.6}});
const clamp=(v,a,b)=>Number.isFinite(v)?Math.max(a,Math.min(b,v)):0;
export function createVehicleDynamics({kind,query,spawn}){
 const spec=VEHICLE_SIZES[kind];if(!spec||!query?.containsFootprint(spawn,spec.halfWidth,spec.halfLength))throw new Error('Posisi kendaraan belum aman.');
 const copy=p=>({...p,position:[...p.position]});let pose={position:[...spawn.position],yaw:spawn.yaw,speed:0,steer:0},safe=copy(pose),input={throttle:0,brake:0,steer:0},accumulator=0,reverseHold=0;
 function setInput(next={}){input={throttle:clamp(next.throttle,0,1),brake:clamp(next.brake,0,1),steer:clamp(next.steer,-1,1)};}
 function stop(){setInput();pose.speed=0;reverseHold=0;accumulator=0;}
 function reset(){stop();pose={position:[...spawn.position],yaw:spawn.yaw,speed:0,steer:0};safe=copy(pose);}
 function tick(dt){
  let speed=pose.speed;
  if(input.brake>0){if(speed>0){speed=Math.max(0,speed-8*input.brake*dt);reverseHold=0;}else{reverseHold+=dt;if(reverseHold>.2)speed=Math.max(-2,speed-2.8*input.brake*dt);}}
  else if(input.throttle>0){reverseHold=0;speed=speed<0?Math.min(0,speed+8*input.throttle*dt):Math.min(spec.maxSpeed,speed+3.8*input.throttle*dt);}
  else{reverseHold=0;speed=Math.sign(speed)*Math.max(0,Math.abs(speed)-1.4*dt);}
  const target=input.steer*.58/(1+Math.abs(speed)/6),steer=pose.steer+(target-pose.steer)*(1-Math.exp(-10*dt));
  const yaw=pose.yaw+speed/spec.wheelbase*Math.tan(steer)*dt,to={position:[pose.position[0]+Math.sin(yaw)*speed*dt,query.height,pose.position[2]-Math.cos(yaw)*speed*dt],yaw,speed,steer};
  if(Math.abs(speed)<1e-9){pose={...pose,speed:0,steer:Math.abs(steer)<.0001?0:steer};return;}
  const hit=query.sweep(pose,to,spec.halfWidth,spec.halfLength);pose={...hit.pose,speed:hit.blocked?0:speed,steer};
  if(!pose.position.every(Number.isFinite)||!query.containsFootprint(pose,spec.halfWidth,spec.halfLength)){pose={...safe,speed:0,steer:0};stop();}else safe=copy(pose);
 }
 function step(dt){const before=copy(pose),elapsed=clamp(dt,0,.1);accumulator=Math.min(.1,accumulator+elapsed);let steps=0;while(accumulator>=1/120-1e-10&&steps<12){tick(1/120);accumulator-=1/120;steps++;}if(steps===12)accumulator=0;
  const changed=pose.speed!==before.speed||pose.steer!==before.steer||pose.yaw!==before.yaw||pose.position.some((v,i)=>v!==before.position[i]);return {pose:copy(pose),changed,active:Math.abs(pose.speed)>.0001||Math.abs(pose.steer)>.0001||input.throttle>0||input.brake>0||Math.abs(input.steer)>0};}
 return {setInput,step,stop,reset,getPose:()=>copy(pose),spec};
}
