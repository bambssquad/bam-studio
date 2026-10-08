export function renderSize(width,height,dpr=1,maxTexture=4096,tier='auto') {
 width=Math.max(1,width);height=Math.max(1,height);const longest=Math.max(width,height);
 const budget=tier==='4k'?8294400:tier==='high'?4200000:2500000;
 let ratio=tier==='4k'?3840/longest:Math.min(dpr,tier==='high'?2:width<=760?1.1:1.4);
 ratio=Math.min(ratio,Math.sqrt(budget/(width*height)),maxTexture/longest);
 return {width:Math.max(1,Math.floor(width*ratio)),height:Math.max(1,Math.floor(height*ratio)),ratio};
}
