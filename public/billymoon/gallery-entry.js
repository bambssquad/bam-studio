import {safeViewerUrl} from './resolution.js?v=map-20261009-v11';
// Independent of WebGL, Three.js and the model loader: this remains usable on unsupported GPUs.
import {createLoadingGallery} from './loading-gallery.js?v=map-20261009-v11';
const $=id=>document.getElementById(id),root=$('loading-gallery'),motion=matchMedia('(prefers-reduced-motion: reduce)');
const items=[
 {
  "src": "./reference/loading-cafe-01.webp",
  "alt": "Render aktual area duduk BILLYMOON dari arah berlawanan, dengan kursi bermotif dan meja putih.",
  "caption": "Area duduk kafe, sudut balik"
 },
 {
  "src": "./reference/loading-cafe-02.webp",
  "alt": "Render aktual counter kafe BILLYMOON, perlengkapan pelayanan dan pencahayaan hangat.",
  "caption": "Counter dan pencahayaan interior"
 },
 {
  "src": "./reference/loading-cafe-03.webp",
  "alt": "Render aktual ruang duduk BILLYMOON dari sisi counter, menampilkan susunan kursi dan lantai kayu.",
  "caption": "Ruang duduk dari sisi counter"
 }
];
const gallery=createLoadingGallery({image:$('gallery-image'),caption:$('gallery-caption'),counter:$('gallery-count'),previous:$('gallery-previous'),next:$('gallery-next'),toggle:$('gallery-toggle'),items,reducedMotion:motion.matches});
gallery.show(0);
$('safe-retry').addEventListener('click',()=>{location.href=safeViewerUrl(location.href);});
function sync(){const errorVisible=!$('error').hidden;if(errorVisible){$('error').querySelector('.load-card').prepend(root);$('error-render').hidden=!window.__billymoon;}if(document.hidden||(!errorVisible&&$('loading').hidden))gallery.stop();else gallery.resume();}
new MutationObserver(sync).observe($('loading'),{attributes:true,attributeFilter:['hidden']});
new MutationObserver(sync).observe($('error'),{attributes:true,attributeFilter:['hidden']});
document.addEventListener('visibilitychange',sync);motion.addEventListener?.('change',event=>gallery.setReducedMotion(event.matches));

sync();
