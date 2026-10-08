export function renderSize(width,height,dpr=1,maxTexture=4096,tier='auto',policy=null,adaptiveScale=1) {
 width=Math.max(1,width);height=Math.max(1,height);const longest=Math.max(width,height);
 const budget=tier==='4k'?(policy?.ultraPixelBudget||8294400):tier==='high'?(policy?.highPixelBudget||4200000):policy?.pixelBudget||2500000;
 let ratio=tier==='4k'?Math.min(3840/longest,policy?.maxUltraDpr||Infinity):Math.min(dpr,tier==='high'?(policy?.maxHighDpr||2):policy?.maxDpr||(width<=760?1.1:1.4));
 if(tier==='auto')ratio*=Math.max(.6,Math.min(1,adaptiveScale));
 ratio=Math.min(ratio,Math.sqrt(budget/(width*height)),maxTexture/longest,(policy?.maxRenderEdge||Infinity)/longest);
 return {width:Math.max(1,Math.floor(width*ratio)),height:Math.max(1,Math.floor(height*ratio)),ratio};
}

export function rendererEdgeLimit(renderer){const gl=renderer.getContext(),viewport=gl.getParameter(gl.MAX_VIEWPORT_DIMS);return Math.min(renderer.capabilities.maxTextureSize||4096,gl.getParameter(gl.MAX_RENDERBUFFER_SIZE)||4096,...(viewport||[4096,4096]));}
export function applyBufferSize(renderer,width,height,size){
 const gl=renderer.getContext();if(gl.isContextLost())throw new Error('Konteks grafis terhenti. Buka kembali dengan preset aman.');
 // Avoid duplicate renderer sizing. Three writes canvas.width before height;
 // shrink height first on portrait-to-landscape rotation to bound the interim area.
 const canvas=renderer.domElement;if(canvas&&size.width>canvas.width&&size.height<canvas.height)canvas.height=size.height;
 renderer.setDrawingBufferSize(width,height,size.ratio);
 if(gl.isContextLost()||gl.drawingBufferWidth!==size.width||gl.drawingBufferHeight!==size.height)throw new Error('Ukuran grafis belum dapat dibuat pada perangkat ini.');
}
export function safeViewerUrl(href){const url=new URL(href);url.searchParams.delete('detail');url.searchParams.set('safe','1');return url.href;}
