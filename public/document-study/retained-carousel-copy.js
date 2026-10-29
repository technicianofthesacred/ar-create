/* Explicit retained-original copy controls. Existing native/output owners do all writing. */
(()=>{
 'use strict';
 if(window.retainedCarouselCopy)return;
 const sourceKeys=['projectId','documentId','outputId','sourceHash','outputHash'];
 const metadataKeys=[...sourceKeys,'kind','title','outputRevision','createdAt','slideCount'];
 const prefix='ar-create.retained-carousel-copy.v1:';
 const active=new Map();
 const clone=v=>JSON.parse(JSON.stringify(v));
 const equal=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
 const hash=v=>typeof v==='string'&&/^[a-f0-9]{64}$/.test(v);
 const uuid=v=>typeof v==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(v);
 const text=v=>typeof v==='string'&&v.trim().length>0&&v.length<=512&&!/[\x00-\x1f\x7f]/.test(v);
 const pickSource=v=>Object.fromEntries(sourceKeys.map(k=>[k,v[k]]));
 const sourceValid=s=>s&&sourceKeys.every(k=>k.endsWith('Hash')?hash(s[k]):uuid(s[k]));
 const outputGuard=g=>g&&Number.isSafeInteger(g.revision)&&g.revision>=0&&hash(g.hash)&&Object.keys(g).every(k=>['revision','hash'].includes(k));
 const nativeGuard=g=>g&&Object.keys(g).every(k=>['workflow','bindingHash','correspondenceHash'].includes(k))&&hash(g.bindingHash)&&(g.correspondenceHash===null||hash(g.correspondenceHash))&&g.workflow&&typeof g.workflow==='object'&&!Array.isArray(g.workflow)&&Object.entries(g.workflow).every(([k,v])=>/^[a-zA-Z][a-zA-Z0-9_-]*$/.test(k)&&(v===null||hash(v)));
 const keyFor=p=>prefix+JSON.stringify([...sourceKeys.map(k=>p.source[k]),p.rootBindingId,p.parentStudyId]);
 function validRequest(p){return p&&Object.keys(p).length===8&&Object.keys(p).every(k=>['rootBindingId','parentStudyId','destinationProjectId','destinationDocumentId','expectedOutput','expectedNative','operationId','source'].includes(k))&&uuid(p.rootBindingId)&&text(p.parentStudyId)&&uuid(p.destinationProjectId)&&uuid(p.destinationDocumentId)&&uuid(p.operationId)&&sourceValid(p.source)&&Object.keys(p.source).length===5&&outputGuard(p.expectedOutput)&&nativeGuard(p.expectedNative);}
 function readReceipt(key){
  const raw=localStorage.getItem(key);if(raw===null)return null;
  const r=JSON.parse(raw);
  if(r?.schema!=='ar-create.retained-carousel-copy.v1'||Object.keys(r).some(k=>!['schema','state','request','outputId','title','sourceStale'].includes(k))||r.sourceStale!==undefined&&r.sourceStale!==true||!validRequest(r.request)||keyFor(r.request)!==key||!['pending','complete'].includes(r.state)||r.state==='complete'&&(!uuid(r.outputId)||r.outputId!==r.request.operationId||!text(r.title)))throw Error('The saved copy request needs inspection. It has been kept on this device.');
  return r;
 }
 function previousPending(source,row){
  const matches=[];
  for(let i=0;i<localStorage.length;i++){
   const key=localStorage.key(i);if(!key?.startsWith(prefix))continue;
   const r=readReceipt(key),p=r?.request;
   if(r?.state==='pending'&&p.rootBindingId===row.bindingId&&p.parentStudyId===row.parentStudyId&&['projectId','documentId','outputId'].every(k=>p.source[k]===source[k]))matches.push(r);
  }
  if(matches.length>1)throw Error('More than one earlier request needs inspection. All exact requests are retained on this device.');
  return matches[0]||null;
 }
 function storeReceipt(key,value){localStorage.setItem(key,JSON.stringify(value));if(!equal(readReceipt(key),value))throw Error('This device could not retain the exact copy request.');}
 function mount(host,{source,output,isCurrent=()=>true,onOpen}={}){
  let disposed=false,epoch=0,reads=new AbortController(),rows=[],chosen=null,proof=null,receipt=null,available=false,busy=false;
  const expected=source&&Object.fromEntries(metadataKeys.map(k=>[k,source[k]]));
  const section=document.createElement('section');section.className='retained-carousel-copy';section.setAttribute('aria-label','Working copy');host.append(section);
  const live=()=>!disposed&&host.isConnected&&section.isConnected&&isCurrent()===true;
  function clear(){if(live())section.replaceChildren();}
  function el(tag,value,attrs={}){const node=document.createElement(tag);if(value!==undefined)node.textContent=value;for(const[k,v]of Object.entries(attrs))node.setAttribute(k,v);return node;}
  function button(label,action,disabled=false){const node=el('button',label,{'type':'button','data-rcc-action':action});node.disabled=disabled;return node;}
  function message(value){const node=el('p',value,{'role':'status','class':'rcc-message'});section.append(node);}
  function inspect(){
   if(!receipt)return;const details=el('details',undefined,{'data-rcc-receipt':''});details.append(el('summary','Saved copy request'));
   // Only request identities and revision/hash guards are persisted or displayed.
   details.append(el('p','This exact request is retained on this device. Retrying uses the same copy identity.'));
   const pre=el('pre',JSON.stringify(receipt.request,null,2));details.append(pre);section.append(details);
  }
  function paint(note=''){
   if(!live())return;section.replaceChildren();
   if(!available)return;
   if(!rows.length&&!chosen){section.append(button('Make a working copy','start',busy));if(note)message(note);return;}
   if(receipt?.state==='complete'){message('Working copy created: '+receipt.title+'. Its words need review. '+(receipt.sourceStale?'The original has changed since this copy. ':'')+(typeof onOpen==='function'?'':'Open it from the destination project’s Pieces.'));if(typeof onOpen==='function')section.append(button('Open working copy','open',busy));if(note&&!note.startsWith('Working copy created:'))message(note);inspect();return;}
   section.append(el('p','Choose an existing project draft for the copy. Its words will need their own review.'));
   const label=el('label','Destination draft');const select=el('select',undefined,{'data-rcc-destination':'','aria-label':'Destination draft'});select.append(el('option','Choose a destination…',{'value':''}));
   rows.forEach((row,i)=>{const duplicate=rows.filter(r=>r.title===row.title).length>1;const option=el('option',row.title+(duplicate?' ('+(i+1)+')':''),{'value':String(i)});option.selected=chosen===row;select.append(option);});select.disabled=busy;label.append(select);section.append(label);
   if(receipt){message(note||'An earlier copy request is retained. Inspect it or retry the exact request.');section.append(button('Retry exact copy','retry',busy));inspect();return;}
   if(chosen)section.append(button('Create working copy','create',busy||!proof));
   if(note)message(note);
  }
  async function get(url){if(url.split('?')[0]==='/api/study-draft/catalog'&&window.nativeDraftCatalog)return window.nativeDraftCatalog.read();const response=await fetch(url,{signal:reads.signal});if(!response.ok)throw Error('This working-copy connection is unavailable. No destination was changed.');return response.json();}
  async function capability(replay=false){
   const value=(await get('/api/capabilities'))?.retainedCarouselCopy;
   if(!value||value.configured!==true||value.readOnly!==true||value.requiresExplicitDestination!==true||value.requiresOriginalValidation!==true)return false;
   // An exact saved command may already have committed. Its owner checks the
   // receipt before current source freshness; replay must never repin it.
   if(replay)return true;
   if(value.available!==true||!Array.isArray(value.items))return false;
   return value.items.filter(item=>metadataKeys.every(k=>item[k]===expected[k])).length===1;
  }
  function destinations(catalog){
   const candidates=[...(Array.isArray(catalog?.drafts)?catalog.drafts:[]),...(Array.isArray(catalog?.collections)?catalog.collections:[])];
   const forks=new Set((catalog?.outputBindings||[]).filter(r=>r.kind==='output-fork').map(r=>r.bindingId));
   const result=[];for(const row of candidates){const parent=row.parentStudyId;
    if(!uuid(row.bindingId)||!text(parent)||!text(row.title)||row.bindingStatus!=='ready'||row.kind==='output-fork'||forks.has(row.bindingId)||row.sourceBindingId&&row.sourceBindingId!==row.bindingId)continue;
    if(result.some(r=>r.bindingId===row.bindingId&&r.parentStudyId===parent))continue;
    result.push({bindingId:row.bindingId,parentStudyId:parent,title:row.title});
   }return result;
  }
  function exactScope(v,row){return v?.scope?.rootBindingId===row.bindingId&&v.scope.parentStudyId===row.parentStudyId&&v.documentId===row.bindingId&&uuid(v.photoScope?.projectId)&&uuid(v.photoScope?.documentId)&&outputGuard(v.expectedOutput);}
  async function choose(index){
   const token=++epoch;chosen=rows[index]||null;proof=null;receipt=null;if(!chosen){paint();return;}
   const row=chosen;busy=true;paint('Checking destination…');
   try{
    const lookup={source:pickSource(expected),rootBindingId:row.bindingId,parentStudyId:row.parentStudyId};receipt=readReceipt(keyFor(lookup))||previousPending(expected,row);
    if(receipt){if(live()&&token===epoch)paint();return;}
    const group=new URLSearchParams({rootBindingId:row.bindingId,parentStudyId:row.parentStudyId});
    const [outputs,native]=await Promise.all([get('/api/study/outputs?'+group),get('/api/study-draft/read?'+new URLSearchParams({bindingId:row.bindingId,parentStudyId:row.parentStudyId}))]);
    if(!live()||token!==epoch)return;
    if(!exactScope(outputs,row)||native?.binding?.id!==row.bindingId||native.binding.parentStudyId!==row.parentStudyId||native.binding.authority!=='owned-working-copy'||native.binding.kind==='output-fork'||native.binding.status!=='ready'||native.readiness?.ready!==true||!nativeGuard(native.expected))throw Error('This destination could not be verified. Choose an existing ready project draft.');
    proof={destinationProjectId:outputs.photoScope.projectId,destinationDocumentId:outputs.photoScope.documentId,expectedOutput:clone(outputs.expectedOutput),expectedNative:clone(native.expected)};
    paint('Ready to create a separate copy.');
   }catch(error){if(live()&&token===epoch)paint(error.message);}finally{if(live()&&token===epoch){busy=false;paint(section.querySelector('[role="status"]')?.textContent||'');}}
  }
  async function start(){
   if(busy)return;const token=++epoch;busy=true;paint('Reading existing destinations…');
   try{if(!await capability())throw Error('This original changed or copying is unavailable. Refresh Pieces before trying again.');const catalog=await get('/api/study-draft/catalog');if(!live()||token!==epoch)return;rows=destinations(catalog);paint(rows.length?'':'No existing ready project draft is available. Create or open a draft through its project first.');}
   catch(error){if(live()&&token===epoch)paint(error.message);}finally{if(live()&&token===epoch){busy=false;paint(section.querySelector('[role="status"]')?.textContent||'');}}
  }
  function validatedResult(value,p,replay){
   const v=value?.view,o=v?.output;
   if(!exactScope(v,{bindingId:p.rootBindingId,parentStudyId:p.parentStudyId})||v.photoScope.projectId!==p.destinationProjectId||v.photoScope.documentId!==p.destinationDocumentId||o?.id!==p.operationId||o.id===p.source.outputId||o.kind!=='carousel'||!text(o.title)||!Array.isArray(o.slides)||o.slides.length>200||!replay&&o.slides.length!==expected.slideCount||!equal(pickSource(v.outputOrigins?.[o.id]?.source||{}),p.source)||v.wordOwner?.kind!=='carousel-words'||v.wordOwner.projectId!==p.destinationProjectId||v.wordOwner.documentId!==p.destinationDocumentId||v.wordOwner.outputId!==o.id)throw Error('The copy reply could not be verified. The exact request is retained for inspection and retry.');
   return {outputId:o.id,title:o.title,...v.freshness?.sourceStale===true?{sourceStale:true}:{}};
  }
  async function create(retry=false){
   if(busy||!chosen||(!retry&&!proof)||retry&&receipt?.state!=='pending')return;
   const token=++epoch,row=chosen;busy=true;paint(retry?'Checking the exact retained request…':'Checking original…');
   try{
    if(!await capability(retry))throw Error('This original changed or copying is unavailable. The saved request remains retained; refresh Pieces.');
    if(!live()||token!==epoch||chosen!==row)return;
    const p=retry?receipt.request:{rootBindingId:row.bindingId,parentStudyId:row.parentStudyId,...proof,operationId:crypto.randomUUID(),source:pickSource(expected)};
    if(!validRequest(p)||!retry&&!equal(p.source,pickSource(expected)))throw Error('The exact copy request could not be verified.');
    const key=keyFor(p);receipt=readReceipt(key)||{schema:'ar-create.retained-carousel-copy.v1',state:'pending',request:clone(p)};
    if(receipt.state==='complete'){paint();return;}storeReceipt(key,receipt);
    let job=active.get(key);
    if(!job){
     const request=clone(receipt.request);
     job=(async()=>{
      // Deliberately no AbortSignal: closing a reader cannot cancel a committed write.
      const response=await fetch('/api/study/outputs/copy-retained-carousel',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(request)});
      if(!response.ok){let reason='';try{const detail=await response.json();if(detail.outcome==='not-applied'&&/unsupported|photograph correspondence/.test(detail.error||''))reason='This original has an unsupported layout, photograph slot or formatting. No copy was made; the original is unchanged.';}catch{}throw Error(reason||(response.status===409?'The source or destination changed. The exact request is retained; inspect it before retrying.':'The copy was not confirmed. The exact request is retained for inspection and retry.'));}
      window.nativeDraftCatalog?.mutationSucceeded?.('/api/study/outputs/copy-retained-carousel');const result=validatedResult(await response.json(),request,retry),complete={schema:'ar-create.retained-carousel-copy.v1',state:'complete',request,...result};storeReceipt(key,complete);return complete;
     })();active.set(key,job);job.then(()=>active.delete(key),()=>active.delete(key));
    }
    const result=await job;if(!live()||token!==epoch||chosen!==row)return;receipt=result;paint();
   }catch(error){if(live()&&token===epoch)paint(error.message||'The copy was not confirmed. Its exact request is retained.');}finally{if(live()&&token===epoch){busy=false;paint(section.querySelector('[role="status"]')?.textContent||'');}}
  }
  async function openCopy(){
   if(busy||receipt?.state!=='complete'||typeof onOpen!=='function')return;
   const token=++epoch,saved=receipt;busy=true;paint();
   try{await onOpen({parentStudyId:saved.request.parentStudyId,rootBindingId:saved.request.rootBindingId,outputId:saved.outputId});}
   catch{if(live()&&token===epoch)paint('The working copy is saved. It could not be opened here; try Open working copy again.');}
   finally{if(live()&&token===epoch){busy=false;paint(section.querySelectorAll('[role="status"]')[1]?.textContent||'');}}
  }
  const click=event=>{const action=event.target.closest('button[data-rcc-action]')?.getAttribute('data-rcc-action');if(!live()||event.target.disabled)return;if(action==='start')void start();else if(action==='create')void create();else if(action==='retry')void create(true);else if(action==='open')void openCopy();};
  const change=event=>{if(live()&&event.target.matches('[data-rcc-destination]'))void choose(event.target.value);};
  section.addEventListener('click',click);section.addEventListener('change',change);
  const ready=(async()=>{try{if(!sourceValid(expected)||expected.kind!=='carousel'||output?.id!==expected.outputId||output.kind!=='carousel'||output.outputRevision!==expected.outputRevision||!Array.isArray(output.slides)||output.slides.length!==expected.slideCount)return false;const found=await capability();if(!live())return false;available=found;paint();return found;}catch{clear();return false;}})();
  return {ready,dispose(){if(disposed)return;disposed=true;epoch++;reads.abort();section.removeEventListener('click',click);section.removeEventListener('change',change);section.remove();}};
 }
 window.retainedCarouselCopy={mount};
})();
