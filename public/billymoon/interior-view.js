import * as T from './vendor/three.module.js?v=drive-20261010-v14';
export const INTERIOR_BOUNDS=new T.Box3(new T.Vector3(58,1.7,-20),new T.Vector3(72,10.1,1));
export function interiorCameraPose(){return {position:new T.Vector3(61.25,3.65,-14.65),target:new T.Vector3(65,3.1,-10.4),fov:T.MathUtils.radToDeg(2*Math.atan(Math.tan(T.MathUtils.degToRad(68)/2)/(16/9)))};}
// Art-directed realtime fills at the offline setup positions. Intensities are
// independent Three.js candela choices, never a direct copy of Blender watts.
export function createInteriorFill(scene){const lights=[];
 for(const s of [{position:[67.4,4.8,-10],target:[62,3,-11],intensity:28,distance:11,color:0xffe5c5},{position:[64,5.6,-12],target:[64,2.2,-12],intensity:12,distance:7,color:0xffd4a8}]){const light=new T.SpotLight(s.color,s.intensity,s.distance,1.2,.85,2);light.position.fromArray(s.position);light.target.position.fromArray(s.target);light.castShadow=false;light.visible=false;scene.add(light,light.target);lights.push(light);}
 return {lights,setEnabled(enabled){for(const light of lights)light.visible=!!enabled;},dispose(){for(const light of lights){light.removeFromParent();light.target.removeFromParent();light.dispose();}}};
}

export function applyLocalLighting(fixtures,fill,mode){const interior=mode==='interior';fixtures?.setEnabled(mode==='night'||interior,interior?.55:1,interior?2:4);fill?.setEnabled(interior);}
