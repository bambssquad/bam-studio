export function presentationDefaults(safeMode=false){return safeMode?{graphics:'light',resolution:'auto',shadows:false,nearEdge:false}:{graphics:'cinematic',resolution:'high',shadows:true,nearEdge:true};}
// Device hints select a conservative default, never a measured FPS guarantee.
export function deviceBudget({width=1920,height=1080,coarsePointer=false,safeMode=false}={}) {
 const phone=safeMode||(coarsePointer&&Math.min(width,height)<=1024);
 return Object.freeze({phone,antialias:!phone,powerPreference:phone?'default':'high-performance',maxDpr:phone?1:1.4,pixelBudget:phone?900000:2500000,highPixelBudget:phone?1200000:4200000,ultraPixelBudget:phone?1500000:8294400,maxHighDpr:phone?1.25:2,maxUltraDpr:phone?1.75:Infinity,maxRenderEdge:phone?2048:Infinity,shadowSize:phone?512:2048,targetMs:phone?1000/30:0,minScale:phone?.6:1});
}
export function createFrameBudget(policy) {
 let lastRender=null,lastSample=null,sum=0,samples=0,goodWindows=0,scale=1,meanMs=0;
 function clearSamples(){lastSample=null;sum=0;samples=0;goodWindows=0;}
 return {
  due(time){return lastRender===null||!policy.targetMs||time-lastRender>=policy.targetMs-.5;},
  record(time,active){
   lastRender=time;const interval=lastSample===null?0:time-lastSample;lastSample=active?time:null;
   if(!active||interval<=0||interval>250||!policy.phone){sum=0;samples=0;return false;}
   sum+=interval;samples++;if(samples<30)return false;meanMs=sum/samples;sum=0;samples=0;
   const before=scale;
   if(meanMs>policy.targetMs*1.35){scale=Math.max(policy.minScale,Math.round(scale*.85*100)/100);goodWindows=0;}
   else if(meanMs<policy.targetMs*1.08){if(++goodWindows>=3){scale=Math.min(1,Math.round((scale+.1)*100)/100);goodWindows=0;}}
   else goodWindows=0;
   return before!==scale;
  },
  reset(){lastRender=null;clearSamples();},
  inspect(){return {phone:policy.phone,targetMs:policy.targetMs,scale,meanFrameIntervalMs:meanMs};},
 };
}
