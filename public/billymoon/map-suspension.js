export function createMapSuspension({initialOpen=false,getControls=()=>null,getExploration=()=>null,onChange=()=>{}}={}){
 let open=!!initialOpen,controlsRef=null,navRef=null,savedEnabled=true;
 function sync(){const controls=getControls(),nav=getExploration();if(controls&&controls!==controlsRef){controlsRef=controls;savedEnabled=controls.enabled;if(open)controls.enabled=false;}if(nav&&nav!==navRef){navRef=nav;nav.setSuspended(open,savedEnabled);}}
 function setOpen(value){const next=!!value;sync();if(next===open)return;open=next;const controls=getControls(),nav=getExploration();if(open&&controls)savedEnabled=controls.enabled;nav?.setSuspended(open,savedEnabled);if(controls){if(open)controls.enabled=false;else controls.enabled=!nav?.isSuspended?.()&&(!nav||(nav.getActiveMode?.()??nav.getMode())==='orbit')?(nav?.getOrbitControlsEnabled?.()??savedEnabled):false;}onChange(open);}
 return {sync,setOpen,isOpen:()=>open};
}
