export async function fetchManifest(url,fetcher=fetch,timeoutMs=60000) {
 const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),timeoutMs);
 try {const response=await fetcher(url,{signal:controller.signal});if(!response.ok)throw new Error('Daftar berkas model belum tersedia. Coba muat ulang.');return await response.json();}
 catch(error){if(error.name==='AbortError')throw new Error('Koneksi belum merespons. Periksa jaringan, lalu coba lagi.');throw error;}
 finally{clearTimeout(timer);}
}
export function shaderHealth(renderer,onFailure=()=>{}) {
 let failure;
 renderer.debug.checkShaderErrors=true;
 renderer.debug.onShaderError=()=>{failure=new Error('Program grafis tidak berhasil dijalankan. Muat ulang atau coba browser lain.');onFailure(failure);};
 return ()=>{if(failure)throw failure;};
}

export async function decodePayload(bytes,file) {
 if(file.compression!=='gzip')return bytes;
 let decoded;
 if(typeof DecompressionStream==='function')decoded=await new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer();
 else {const {gunzipSync}=await import('./vendor/fflate.module.js?v=mono-20261009-v12');const result=gunzipSync(new Uint8Array(bytes));decoded=result.buffer.slice(result.byteOffset,result.byteOffset+result.byteLength);}
 if(file.decodedBytes!==undefined&&decoded.byteLength!==file.decodedBytes)throw new Error('Ukuran bagian model setelah dekompresi tidak sesuai. Coba muat ulang.');
 return decoded;
}

export function setPresentationControlsBusy(controls,busy){for(const control of controls)control.disabled=busy;}

export async function fetchOptionalManifest(url,fetcher=fetch,timeoutMs=4000){try{return await fetchManifest(url,fetcher,timeoutMs);}catch{return null;}}
