// Verified nonopaque PNG pixels from the uploaded SketchUp model. These are cutouts,
// not blended glass. All listed source baseColor alpha factors are exactly 1.
export const SOURCE_ALPHA_MASKS=new Set([83,106,107,158,196,197,202,204,211,267,271,310,312,354,355,359,360,362,363,364,365]);
export function restoreSourceCutouts(gltf) {
 for(const [material,association] of gltf.parser.associations) {
  if(!material.isMaterial||association.materials===undefined)continue;
  const index=association.materials;material.userData.sourceMaterialIndex=index;
  if(SOURCE_ALPHA_MASKS.has(index)&&material.map){material.alphaTest=.5;material.transparent=false;material.depthWrite=true;material.needsUpdate=true;}
 }
}
