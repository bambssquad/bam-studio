import * as T from './vendor/three.module.js?v=map-20261009-v11';
import {exactInstanceNormals} from './model.js?v=map-20261009-v11';
export function installWholeBakeShader(material,uniforms){
 const end=T.ShaderChunk.lights_fragment_end,specularCall='RE_IndirectSpecular( radiance, iblIrradiance, clearcoatRadiance, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );';
 if(!end.includes(specularCall))throw new Error('Whole bake specular shader incompatible');
 const isolatedEnd=end.replace(specularCall,'vec3 wholeDiffuseBeforeSpecular=reflectedLight.indirectDiffuse;\n'+specularCall+'\nif(wholeBaked) reflectedLight.indirectDiffuse=wholeDiffuseBeforeSpecular;');
 material.onBeforeCompile=shader=>{
  Object.assign(shader.uniforms,uniforms);
  for(const marker of ['#include <uv_vertex>'])if(!shader.vertexShader.includes(marker))throw new Error('Whole bake vertex shader incompatible');
  if(!shader.fragmentShader.includes('#include <lights_fragment_end>'))throw new Error('Whole bake diffuse shader incompatible');
  shader.vertexShader=`attribute vec2 bakeUvFront;\nattribute vec2 bakeUvBack;\nattribute vec4 instanceBakeTransform;\nattribute vec2 instanceBakeMeta;\nvarying vec4 vBakeUv;\nvarying vec2 vBakeMeta;\n`+shader.vertexShader;
  shader.vertexShader=shader.vertexShader.replace('#include <uv_vertex>',`#include <uv_vertex>\nvBakeUv=vec4(bakeUvFront.x<0.0?vec2(-1.0):bakeUvFront*instanceBakeTransform.xy+instanceBakeTransform.zw,bakeUvBack.x<0.0?vec2(-1.0):bakeUvBack*instanceBakeTransform.xy+instanceBakeTransform.zw);\nvBakeMeta=instanceBakeMeta;`);
  shader.fragmentShader=`uniform sampler2D wholeOverview;\nuniform sampler2D wholeDetail;\nuniform float wholeDetailPage;\nvarying vec4 vBakeUv;\nvarying vec2 vBakeMeta;\n`+shader.fragmentShader;
  shader.fragmentShader=shader.fragmentShader.replace('#include <lights_fragment_end>',`bool wholeBaked=false;\n#if defined( RE_IndirectDiffuse )\n vec2 wholeUv=gl_FrontFacing?vBakeUv.xy:vBakeUv.zw;\n if(vBakeMeta.x>=0.0 && wholeUv.x>=0.0){\n  float wholePage=floor(vBakeMeta.x+0.5);\n  vec2 wholeTile=vec2(mod(wholePage,4.0),floor(wholePage/4.0));\n  vec3 wholeRadiance=abs(wholePage-wholeDetailPage)<0.25?texture2D(wholeDetail,wholeUv).rgb:texture2D(wholeOverview,(wholeUv+wholeTile)/4.0).rgb;\n  wholeBaked=true;\n  reflectedLight.directDiffuse=vec3(0.0);\n  irradiance=wholeRadiance*(3.141592653589793*vBakeMeta.y);\n }\n#endif\n${isolatedEnd}`);
 };
 material.customProgramCacheKey=()=> 'billymoon-total-static-diffuse-v1';exactInstanceNormals(material);
}
