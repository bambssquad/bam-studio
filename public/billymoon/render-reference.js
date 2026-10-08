export function createRenderReference({dialog,image,status,openButtons,closeButton,visitButton,onOpen=()=>{},onClose=()=>{},onVisit=()=>{}}){
 let opened=false;
 const open=()=>{if(opened)return;opened=true;onOpen();dialog.showModal();if(!image.getAttribute('src')){status.textContent='Membuka render…';image.src=image.dataset.src;}};
 const close=()=>dialog.close();
 for(const button of openButtons)button.addEventListener('click',open);closeButton.addEventListener('click',close);
 dialog.addEventListener('close',()=>{if(!opened)return;opened=false;onClose();});
 image.addEventListener('load',()=>{status.textContent='Render offline · 1280 × 720 · opsi 2';});image.addEventListener('error',()=>{status.textContent='Render belum bisa dimuat. Tutup dan coba lagi.';image.removeAttribute('src');});
 visitButton.addEventListener('click',()=>{if(visitButton.disabled)return;close();onVisit();});
 return {open,close,isOpen:()=>opened};
}
