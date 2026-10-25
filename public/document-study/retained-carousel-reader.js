/* A transient reader for exact retained originals; never a working-copy owner. */
(()=>{
 if(window.retainedCarouselReader)return;
 const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const fields=['projectId','documentId','outputId','kind','title','outputRevision','createdAt','slideCount','sourceHash','outputHash','copyAllowed'];
 const hash=v=>typeof v==='string'&&/^[a-f0-9]{64}$/.test(v);
 let dialog=null,request=0,controller=null,resize=null,copyController=null;
 function reference(item){return item?.kind==='carousel'&&(item.copyAllowed===undefined||typeof item.copyAllowed==='boolean')&&['projectId','documentId','outputId','title','createdAt'].every(k=>typeof item[k]==='string'&&item[k].length>0)&&Number.isSafeInteger(item.outputRevision)&&item.outputRevision>=0&&Number.isSafeInteger(item.slideCount)&&item.slideCount>=0&&item.slideCount<=200&&hash(item.sourceHash)&&hash(item.outputHash);}
 function close(){request++;copyController?.dispose?.();copyController=null;controller?.abort();controller=null;if(resize)window.removeEventListener('resize',resize);resize=null;const old=dialog;dialog=null;if(old){old.close?.();old.remove();}}
 async function verify(value,item){
  if(!reference(item)||value?.readOnly!==true||value.authority!=='retained-original'||fields.some(k=>value[k]!==item[k]))throw Error('This original changed or returned a different identity. Refresh Pieces before opening it.');
  const o=value.output;
  if(o?.id!==item.outputId||o.kind!=='carousel'||o.outputRevision!==item.outputRevision||o.createdAt!==item.createdAt||(typeof o.title==='string'?o.title:'Untitled carousel')!==item.title||!Array.isArray(o.slides)||o.slides.length!==item.slideCount||o.slides.some(s=>typeof s?.id!=='string'||!s.id||typeof s.text!=='string'||typeof s.template!=='string'||!Array.isArray(s.photos))||new Set(o.slides.map(s=>s.id)).size!==o.slides.length)throw Error('The original carousel could not be verified. Refresh Pieces.');
  const bytes=new TextEncoder().encode(JSON.stringify(o)),digest=await crypto.subtle.digest('SHA-256',bytes),actual=Array.from(new Uint8Array(digest),b=>b.toString(16).padStart(2,'0')).join('');
  if(actual!==item.outputHash)throw Error('The original carousel content changed. Refresh Pieces.');
  return o;
 }
 async function open(item){
  if(!reference(item))throw Error('This original has no exact reference. Refresh Pieces.');
  close();const token=++request,expected=Object.freeze(Object.fromEntries(fields.map(k=>[k,item[k]])));let mode='words',index=0,output=null;const copyHost=document.createElement('div');copyHost.className='rc-copy-host';
  controller=new AbortController();const signal=controller.signal,target=document.createElement('dialog');dialog=target;target.className='retained-carousel-reader';target.setAttribute('aria-labelledby','retained-carousel-title');document.body.append(target);
  const live=()=>dialog===target&&request===token&&target.open&&target.isConnected;
  const head=()=>`<header><button data-rc-back>← Back to pieces</button><h2 id="retained-carousel-title">${esc(expected.title)}</h2><span>Original · read-only</span></header>`;
  function paint(message,retry=false){
   if(!live())return;
   target.innerHTML=head()+(message?`<p class="rc-message" role="status">${esc(message)}${retry?'<br><button data-rc-retry>Try again</button>':''}</p>`:`<nav aria-label="Original carousel view"><button data-rc-mode="words" aria-pressed="${mode==='words'}">Words</button><button data-rc-mode="preview" aria-pressed="${mode==='preview'}">Preview</button><span>${output.slides.length} ${output.slides.length===1?'slide':'slides'}</span></nav><section class="rc-content">${mode==='words'?`<div class="rc-words">${output.slides.map((s,i)=>`<article><h3>Slide ${i+1}</h3><p>${esc(s.text)}</p>${s.credit?`<p class="rc-credit">${esc(s.credit)}</p>`:''}</article>`).join('')}${typeof output.caption==='string'&&output.caption?`<article><h3>Caption</h3><p>${esc(output.caption)}</p></article>`:''}</div>`:'<div class="rc-preview"><div class="rc-preview-nav"><button data-rc-prev '+(index?'':'disabled')+'>Previous</button><span>Slide '+(index+1)+' of '+output.slides.length+'</span><button data-rc-next '+(index<output.slides.length-1?'':'disabled')+'>Next</button></div><p class="rc-photo-state">'+(output.slides.some(s=>s.photos.some(p=>p?.src))?'Original photographs are not loaded or verified here.':'No photographs are saved in this original.')+'</p><div class="rc-frame"><div class="rc-canvas"></div></div></div>'}</section>`);
   if(!message){target.querySelector('header').after(copyHost);copyHost.hidden=expected.copyAllowed===false;if(expected.copyAllowed!==false&&!copyController&&typeof window.retainedCarouselCopy?.mount==='function')copyController=window.retainedCarouselCopy.mount(copyHost,{source:expected,output,isCurrent:live,...(typeof window.realOutputOverview?.onAction==='function'&&typeof window.switchProject==='function'?{onOpen:openCopy}:{})});}
   if(!message&&mode==='preview'){
    const canvas=target.querySelector('.rc-canvas'),s=output.slides[index];
    if(!s){canvas.textContent='No slides in this original.';return;}
    if(typeof IG==='undefined'||!Object.prototype.hasOwnProperty.call(IG.T,s.template)){canvas.textContent='This original template is unavailable. Read the complete words in Words.';return;}
    // Supply only renderable wording/style fields; original photo URLs never reach a renderer or DOM.
    const slide={text:s.text,role:typeof s.role==='string'?s.role:'inner',credit:typeof s.credit==='string'?s.credit:'',label:typeof s.label==='string'?s.label:expected.title,photos:s.photos.map(p=>({src:'',x:Number.isFinite(Number(p?.x))?Number(p.x):50,y:Number.isFinite(Number(p?.y))?Number(p.y):50})),pillar:s.pillar,typography:s.typography};
    const inert=document.createElement('template');inert.innerHTML=IG.render(s.template,slide,{logo:'/ig-assets/teajia-wordmark.png'});inert.content.querySelectorAll('script,iframe,object,embed,link,style').forEach(el=>el.remove());inert.content.querySelectorAll('img').forEach(el=>{if(el.getAttribute('src')!=='/ig-assets/teajia-wordmark.png')el.remove();else{for(const attr of [...el.attributes])if(!['src','alt','style'].includes(attr.name))el.removeAttribute(attr.name);}});inert.content.querySelectorAll('[contenteditable]').forEach(el=>el.removeAttribute('contenteditable'));canvas.append(inert.content);
    fit();
   }
  }
  async function openCopy(ref){
   if(!live())throw Error('This original reader has closed. Reopen Pieces to continue.');
   const parent=ref.parentStudyId;
   if(!state.projects.some(p=>p.id===parent))throw Error('The destination project is not available in this workspace. The saved copy remains intact.');
   if(current().id!==parent)await window.switchProject(parent);
   if(!live()||current().id!==parent)throw Error('The destination did not open. Your current work is retained.');
   const register=await window.realOutputOverview.read({projectId:parent});
   if(!live()||current().id!==parent||register?.projectId!==parent||!register.outputs?.some(o=>o.id===ref.outputId&&o.rootBindingId===ref.rootBindingId))throw Error('The exact saved copy is unavailable. Refresh the destination project’s Pieces.');
   await window.realOutputOverview.onAction({projectId:parent,outputId:ref.outputId,kind:'words'});
   const selected=window.studyOutputConnection?.selection?.();
   if(!live()||current().id!==parent||selected?.projectId!==parent||selected.rootBindingId!==ref.rootBindingId||selected.output?.id!==ref.outputId)throw Error('The exact working copy did not open. Its saved words remain intact.');
   window.workbenchPieces?.close?.();close();
  }
  function fit(){const frame=target.querySelector('.rc-frame'),canvas=target.querySelector('.rc-canvas');if(!frame||!canvas)return;const content=target.querySelector('.rc-content'),preview=target.querySelector('.rc-preview'),nav=target.querySelector('.rc-preview-nav'),note=target.querySelector('.rc-photo-state'),style=getComputedStyle(content),space=content.clientHeight-parseFloat(style.paddingTop||0)-parseFloat(style.paddingBottom||0)-(nav?.getBoundingClientRect().height||0)-(note?.getBoundingClientRect().height||0)-22,width=Math.max(1,Math.min(540,preview.clientWidth||300,space>0?space/1.25:540));canvas.style.transform='scale('+width/1080+')';frame.style.width=width+'px';frame.style.height=width*1.25+'px';}
  resize=fit;window.addEventListener('resize',resize);
  target.addEventListener('cancel',event=>{event.preventDefault();close();});target.addEventListener('close',()=>{if(dialog===target)close();});
  target.addEventListener('click',event=>{const button=event.target.closest('button');if(!button||button.disabled)return;if(button.hasAttribute('data-rc-back'))return close();if(button.hasAttribute('data-rc-retry')){void open(expected);return;}if(!output)return;if(button.dataset.rcMode)mode=button.dataset.rcMode;else if(button.hasAttribute('data-rc-prev'))index=Math.max(0,index-1);else if(button.hasAttribute('data-rc-next'))index=Math.min(output.slides.length-1,index+1);else return;paint();});
  target.showModal();paint('Reading original carousel…');
  try{const params=new URLSearchParams({outputId:expected.outputId,expectedSourceHash:expected.sourceHash,expectedOutputHash:expected.outputHash}),response=await fetch('/api/review/retained-carousel?'+params,{signal});if(!live())return false;if(!response.ok)throw Error('This original is unavailable or has changed. Refresh Pieces before trying again.');const value=await response.json();if(!live())return false;const exact=await verify(value,expected);if(!live())return false;output=exact;paint();return true;}catch(error){if(!live())return false;paint(error.message||'This original could not be read.',true);return false;}
 }
 window.retainedCarouselReader={open,close,reference};
})();
