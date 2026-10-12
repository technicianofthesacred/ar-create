/* Local OS return navigation only; no file authority, frame embedding or CORS. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;if(root)root.ArI64Return=api;})(typeof window!=='undefined'?window:null,function(){
 function validateReturnTarget(raw){
  if(typeof raw!=='string'||!raw||raw.length>1024||raw.trim()!==raw||/[\u0000-\u0020\u007f\\]/.test(raw))return null;
  try{const url=new URL(raw);if(url.protocol!=='http:'||!['localhost','127.0.0.1','[::1]'].includes(url.hostname)||!['8888','8894'].includes(url.port)||url.username||url.password||url.search||url.hash)return null;
   if(!/^\/(?:ar-create|writing\/(?:i64os|tea|art|mandala|work|life))\/?$/.test(url.pathname))return null;
   const lexical=raw.match(/^http:\/\/[^/]+(\/[^?#]*)?$/)?.[1]||'/';if(lexical!==url.pathname)return null;
   return url.href;
  }catch{return null;}
 }
 function install(doc,href){const bar=doc.querySelector('.topbar');if(!bar||!href)return;let link=bar.querySelector('.i64-return');if(!link){link=doc.createElement('a');link.className='i64-return';link.textContent='i64 OS';link.setAttribute('aria-label','Return to i64 OS');bar.append(link);}if(link.getAttribute('href')!==href)link.setAttribute('href',href);}
 if(typeof window!=='undefined'&&typeof document!=='undefined'){
  const values=new URLSearchParams(window.location.search).getAll('i64osReturn'),href=values.length===1?validateReturnTarget(values[0]):null;
  if(href){install(document,href);const observer=new MutationObserver(()=>install(document,href));observer.observe(document.getElementById('app')||document.body,{childList:true,subtree:true});window.addEventListener('pagehide',()=>observer.disconnect(),{once:true});}
 }
 return {validateReturnTarget,install};
});
